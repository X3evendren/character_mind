/**
 * RetryDecorator — wraps any IProvider with retry logic.
 *
 * Ported from nanobot/providers/base.py `_run_with_retry` + `chat_stream_with_retry`.
 *
 * Two modes:
 *   - "standard": 3 retries with delays [1s, 2s, 4s], only transient errors
 *   - "persistent": unlimited retries (capped at 60s delay), gives up after
 *     10 consecutive identical errors
 *
 * Stream handling:
 *   - If content was already emitted before the error, suppresses delta
 *     callbacks on retry (prevents duplicate text in UI)
 *   - If onStreamRecover is provided, creates a new stream segment
 */

import type {
  IProvider,
  LLMResponse,
  GenerationSettings,
  StreamCallbacks,
} from "./types";
import { errorResponse } from "./types";
import {
  classifyResponse,
  ErrorCategory,
  isArrearageResponse,
  extractRetryAfterFromResponse,
  extractErrorTypeCode,
} from "./error-classifier";
import { stripImageContent, stripImageContentInPlace } from "./base";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type RetryMode = "standard" | "persistent";

export interface RetryConfig {
  /** Retry mode: "standard" (3 retries) or "persistent" (unlimited) */
  mode: RetryMode;
  /** Standard retry delays in seconds (default: [1, 2, 4]) */
  delays?: number[];
  /** Max delay for persistent mode (default: 60s) */
  persistentMaxDelay?: number;
  /** Consecutive identical error limit for persistent mode (default: 10) */
  persistentIdenticalErrorLimit?: number;
  /** Callback for retry wait notifications (e.g., UI status updates) */
  onRetryWait?: (message: string) => Promise<void>;
  /** Callback for stream recovery notifications */
  onStreamRecover?: () => Promise<void>;
}

const DEFAULT_STANDARD_DELAYS = [1, 2, 4];
const DEFAULT_PERSISTENT_MAX_DELAY = 60;
const DEFAULT_PERSISTENT_ERROR_LIMIT = 10;
const RETRY_HEARTBEAT_CHUNK = 30; // seconds — max sleep chunk between onRetryWait calls

// ═══════════════════════════════════════════════════════════════
// RetryDecorator
// ═══════════════════════════════════════════════════════════════

export class RetryDecorator implements IProvider {
  private delegate: IProvider;
  private config: Required<RetryConfig>;

  constructor(delegate: IProvider, config: RetryConfig = { mode: "standard" }) {
    this.delegate = delegate;
    this.config = {
      mode: config.mode,
      delays: config.delays ?? DEFAULT_STANDARD_DELAYS,
      persistentMaxDelay: config.persistentMaxDelay ?? DEFAULT_PERSISTENT_MAX_DELAY,
      persistentIdenticalErrorLimit:
        config.persistentIdenticalErrorLimit ?? DEFAULT_PERSISTENT_ERROR_LIMIT,
      onRetryWait: config.onRetryWait ?? (async () => {}),
      onStreamRecover: config.onStreamRecover ?? (async () => {}),
    };
  }

  // ── IProvider passthrough ──

  get model(): string {
    return this.delegate.model;
  }

  get generation(): GenerationSettings {
    return this.delegate.generation;
  }

  set generation(g: GenerationSettings) {
    this.delegate.generation = g;
  }

  getDefaultModel(): string {
    return this.delegate.getDefaultModel();
  }

  // ── chat (non-streaming) with retry ──

  async chat(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    toolChoice?: string | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    return this.runWithRetry(
      () =>
        this.delegate.chat(
          messages, tools, model, maxTokens, temperature,
          reasoningEffort, toolChoice, signal,
        ),
      messages,
    );
  }

  // ── chatStream with retry ──

  async chatStream(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    toolChoice?: string | Record<string, unknown>,
    callbacks?: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    let hasStreamedContent = false;

    // Wrapper that tracks whether content was emitted
    const trackingCallbacks: StreamCallbacks | undefined = callbacks
      ? {
          ...callbacks,
          onContentDelta: async (text: string) => {
            if (text) hasStreamedContent = true;
            await callbacks.onContentDelta?.(text);
          },
        }
      : undefined;

    const result = await this.runWithRetry(
      () =>
        this.delegate.chatStream(
          messages, tools, model, maxTokens, temperature,
          reasoningEffort, toolChoice, trackingCallbacks, signal,
        ),
      messages,
      {
        streamGuard: () => !hasStreamedContent,
        onStreamRecover: async () => {
          hasStreamedContent = false;
          await this.config.onStreamRecover();
        },
        onStreamRecoverFallback: () => {
          // Suppress delta callbacks on retry after partial stream
          callbacks = undefined;
          return undefined;
        },
      },
    );

    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // Core retry machinery
  // ═══════════════════════════════════════════════════════════

  private async runWithRetry(
    call: () => Promise<LLMResponse>,
    originalMessages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    streamOpts?: {
      streamGuard?: () => boolean;
      onStreamRecover?: () => Promise<void>;
      onStreamRecoverFallback?: () => StreamCallbacks | undefined;
    },
  ): Promise<LLMResponse> {
    const persistent = this.config.mode === "persistent";
    const delays = [...this.config.delays];
    let attempt = 0;
    let lastResponse: LLMResponse | null = null;
    let lastErrorKey: string | null = null;
    let identicalErrorCount = 0;

    while (true) {
      attempt++;

      let response: LLMResponse;
      try {
        response = await call();
      } catch (err: any) {
        if (err?.name === "AbortError") throw err;
        response = errorResponse("Unexpected exception in retry loop", {
          kind: "connection",
        });
      }

      // Success
      if (response.finishReason !== "error") return response;

      lastResponse = response;

      // ── Stream guard: if content was already emitted, check if we should retry ──
      if (streamOpts?.streamGuard && !streamOpts.streamGuard()) {
        const isTimeout = (response.errorKind ?? "").toLowerCase() === "timeout";

        if (isTimeout) {
          if (streamOpts.onStreamRecover) {
            console.warn(
              "LLM stream stalled after content was emitted; " +
              "starting a new stream segment and retrying"
            );
            await streamOpts.onStreamRecover();
          } else {
            console.warn(
              "LLM stream stalled after content was emitted; " +
              "suppressing delta callbacks and retrying"
            );
            streamOpts.onStreamRecoverFallback?.();
          }
        } else {
          console.warn(
            "LLM stream failed after content was emitted; skipping retry"
          );
          return response;
        }
      }

      // ── Identical error detection (for persistent mode) ──
      const errorKey = (response.content ?? "").trim().toLowerCase() || null;
      if (errorKey && errorKey === lastErrorKey) {
        identicalErrorCount++;
      } else {
        lastErrorKey = errorKey;
        identicalErrorCount = errorKey ? 1 : 0;
      }

      // ── Classify error ──
      const category = classifyResponse(response);

      // Non-retryable: try stripping images, otherwise give up
      if (category === ErrorCategory.NON_RETRYABLE) {
        // Try without images
        const stripped = stripImageContent(
          originalMessages as any[],
        );
        if (stripped) {
          console.warn(
            "Non-transient LLM error with image content, retrying without images"
          );
          const result = await call();
          if (result.finishReason !== "error") {
            stripImageContentInPlace(
              originalMessages as any[],
            );
          }
          return result;
        }
        return response;
      }

      // Unknown / not retryable-like → give up
      if (category !== ErrorCategory.RETRYABLE) {
        return response;
      }

      // ── Persistent mode: check identical error limit ──
      if (persistent && identicalErrorCount >= this.config.persistentIdenticalErrorLimit) {
        console.warn(
          `Stopping persistent retry after ${identicalErrorCount} identical transient errors: ` +
          (response.content ?? "").slice(0, 120).toLowerCase()
        );
        if (this.config.onRetryWait) {
          await this.config.onRetryWait(
            `Persistent retry stopped after ${identicalErrorCount} identical errors.`
          );
        }
        return response;
      }

      // ── Standard mode: check retry count ──
      if (!persistent && attempt > delays.length) {
        console.warn(
          `LLM request failed after ${attempt - 1} retries, giving up: ` +
          (response.content ?? "").slice(0, 120).toLowerCase()
        );
        if (this.config.onRetryWait) {
          await this.config.onRetryWait(
            `Model request failed after ${attempt} retries, giving up.`
          );
        }
        break;
      }

      // ── Compute delay ──
      const baseDelay = delays[Math.min(attempt - 1, delays.length - 1)];
      const extractedDelay = extractRetryAfterFromResponse(response);
      let delay = extractedDelay ?? baseDelay;

      if (persistent) {
        delay = Math.min(delay, this.config.persistentMaxDelay);
      }

      const maxAttempts = persistent ? "∞" : String(delays.length);
      console.warn(
        `LLM transient error (attempt ${attempt}/${maxAttempts}), ` +
        `retrying in ${Math.round(delay)}s: ` +
        (response.content ?? "").slice(0, 120).toLowerCase()
      );

      await this.sleepWithHeartbeat(delay, attempt, persistent);
    }

    return (
      lastResponse ??
      errorResponse("Retry exhausted with no response")
    );
  }

  // ── Sleep with heartbeat notifications ──

  private async sleepWithHeartbeat(
    delaySec: number,
    attempt: number,
    persistent: boolean,
  ): Promise<void> {
    let remaining = Math.max(0, delaySec);

    while (remaining > 0) {
      if (this.config.onRetryWait) {
        const kind = persistent ? "persistent retry" : "retry";
        const sec = Math.max(1, Math.round(remaining));
        await this.config.onRetryWait(
          `Model request failed, ${kind} in ${sec}s (attempt ${attempt}).`
        );
      }
      const chunk = Math.min(remaining, RETRY_HEARTBEAT_CHUNK);
      await sleep(chunk * 1000);
      remaining -= chunk;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
