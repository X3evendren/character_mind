/**
 * FallbackDecorator — wraps a primary provider with fallback chain.
 *
 * Ported from nanobot/providers/fallback_provider.py.
 *
 * When the primary provider fails with a non-retryable error (billing/quota),
 * the FallbackDecorator transparently switches to the next provider in the chain.
 *
 * Design: the fallback chain is a list of IProvider instances (pre-built by
 * the factory). Each fallback is tried in order until one succeeds. If all
 * fail, the last error is returned.
 */

import type {
  IProvider,
  LLMResponse,
  GenerationSettings,
  StreamCallbacks,
} from "./types";
import { errorResponse } from "./types";
import { classifyResponse, ErrorCategory, isArrearageResponse } from "./error-classifier";

export interface FallbackConfig {
  /** Ordered list of fallback providers (primary is NOT included — it's the delegate) */
  fallbacks: IProvider[];
  /** Only trigger fallback for these error categories (default: non-retryable + arrearage) */
  triggerOn?: ErrorCategory[];
  /** Only trigger fallback if isArrearageResponse returns true (billing/quota errors) */
  arrearageOnly?: boolean;
}

export class FallbackDecorator implements IProvider {
  private delegate: IProvider;
  private fallbacks: IProvider[];
  private triggerOn: ErrorCategory[];
  private arrearageOnly: boolean;

  constructor(delegate: IProvider, config: FallbackConfig) {
    this.delegate = delegate;
    this.fallbacks = config.fallbacks;
    this.triggerOn = config.triggerOn ?? [
      ErrorCategory.NON_RETRYABLE,
      ErrorCategory.UNKNOWN,
    ];
    this.arrearageOnly = config.arrearageOnly ?? false;
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

  // ── Core: try primary, fall through on failure ──

  private shouldFallback(response: LLMResponse): boolean {
    if (response.finishReason !== "error") return false;

    if (this.arrearageOnly) {
      return isArrearageResponse(response);
    }

    const category = classifyResponse(response);
    return this.triggerOn.includes(category);
  }

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
    // Try primary
    const primaryResponse = await this.delegate.chat(
      messages, tools, model, maxTokens, temperature,
      reasoningEffort, toolChoice, signal,
    );

    if (!this.shouldFallback(primaryResponse)) return primaryResponse;

    // Try each fallback
    let lastError = primaryResponse;
    for (const fallback of this.fallbacks) {
      console.warn(
        `Primary provider failed, falling back to ${fallback.model} (${fallback.getDefaultModel()})`
      );
      try {
        const resp = await fallback.chat(
          messages, tools, model ?? fallback.model, maxTokens, temperature,
          reasoningEffort, toolChoice, signal,
        );
        if (resp.finishReason !== "error") return resp;
        lastError = resp;
      } catch (err: any) {
        console.warn(`Fallback ${fallback.model} threw: ${err?.message}`);
        lastError = errorResponse(`Fallback failed: ${err?.message}`);
      }
    }

    return lastError;
  }

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
    const primaryResponse = await this.delegate.chatStream(
      messages, tools, model, maxTokens, temperature,
      reasoningEffort, toolChoice, callbacks, signal,
    );

    if (!this.shouldFallback(primaryResponse)) return primaryResponse;

    // For streaming fallback, use non-streaming to avoid double delta emission
    let lastError = primaryResponse;
    for (const fallback of this.fallbacks) {
      console.warn(
        `Primary stream failed, falling back to ${fallback.model} (non-streaming)`
      );
      try {
        const resp = await fallback.chat(
          messages, tools, model ?? fallback.model, maxTokens, temperature,
          reasoningEffort, toolChoice, signal,
        );
        if (resp.finishReason !== "error") {
          // Deliver full content as single delta so the UI still works
          if (resp.content && callbacks?.onContentDelta) {
            await callbacks.onContentDelta(resp.content);
          }
          return resp;
        }
        lastError = resp;
      } catch (err: any) {
        console.warn(`Fallback stream ${fallback.model} threw: ${err?.message}`);
        lastError = errorResponse(`Stream fallback failed: ${err?.message}`);
      }
    }

    return lastError;
  }
}
