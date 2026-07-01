/**
 * BaseProvider — shared message sanitization, role enforcement, and image
 * stripping logic ported from nanobot/providers/base.py.
 *
 * All concrete providers (OpenAICompatProvider, AnthropicProvider, etc.)
 * extend this to get the same message normalization nanobot provides.
 */

import type {
  IProvider,
  LLMResponse,
  GenerationSettings,
  StreamCallbacks,
} from "./types";
import { errorResponse, DEFAULT_GENERATION } from "./types";

// ═══════════════════════════════════════════════════════════════
// Constants (ported from nanobot base.py)
// ═══════════════════════════════════════════════════════════════

const STREAM_IDLE_TIMEOUT_ENV = "NANOBOT_STREAM_IDLE_TIMEOUT_S";
const DEFAULT_STREAM_IDLE_TIMEOUT_S = 90;
const MAX_STREAM_IDLE_TIMEOUT_S = 3600;

const SYNTHETIC_USER_CONTENT = "(conversation continued)";

/** Role keys allowed in provider-safe messages */
const ALLOWED_MESSAGE_KEYS: ReadonlySet<string> = new Set([
  "role", "content", "name", "tool_calls", "tool_call_id",
]);

// ═══════════════════════════════════════════════════════════════
// Stream idle timeout
// ═══════════════════════════════════════════════════════════════

export function resolveStreamIdleTimeoutS(
  envValue?: string,
  fallback = DEFAULT_STREAM_IDLE_TIMEOUT_S,
  maximum = MAX_STREAM_IDLE_TIMEOUT_S,
): number {
  const raw = envValue ?? process.env[STREAM_IDLE_TIMEOUT_ENV];
  if (!raw?.trim()) return fallback;
  const value = parseFloat(raw);
  if (isNaN(value) || value <= 0) return fallback;
  return Math.min(value, maximum);
}

// ═══════════════════════════════════════════════════════════════
// Tool argument parsing (ported from parse_tool_arguments)
// ═══════════════════════════════════════════════════════════════

export function parseToolArguments(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (typeof args !== "string") return args as Record<string, unknown>;

  const trimmed = args.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    // Preserve non-object parsed values so callers can reject them
    if (parsed === null) return {};
    return parsed as unknown as Record<string, unknown>;
  } catch {
    return args as unknown as Record<string, unknown>;
  }
}

/** Repairs tool arguments for provider history replay (uses json_repair-like logic) */
export function toolArgumentsForReplay(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (typeof args === "object" && !Array.isArray(args)) return args as Record<string, unknown>;
  if (typeof args !== "string") return {};

  const trimmed = args.trim();
  if (!trimmed) return {};

  // Try strict JSON first, then repair common JSON issues
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return relaxedJsonParse(trimmed);
  }
}

/** Relaxed JSON parse — handles common LLM JSON output issues */
function relaxedJsonParse(s: string): Record<string, unknown> {
  try {
    // Try fixing common issues: unquoted keys, trailing commas, single quotes
    const fixed = s
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // unquoted keys
      .replace(/,\s*}/g, "}")                           // trailing comma in object
      .replace(/,\s*]/g, "]")                           // trailing comma in array
      .replace(/'/g, '"');                              // single quotes → double
    return JSON.parse(fixed);
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════
// Message sanitization (ported from nanobot/_sanitize_empty_content)
// ═══════════════════════════════════════════════════════════════

type ChatMessage = { role: string; content: string | Array<Record<string, unknown>> | null; [key: string]: unknown };

export function sanitizeEmptyContent(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    const content = msg.content;

    // String content
    if (typeof content === "string" && !content) {
      const clean = { ...msg };
      clean.content = (msg.role === "assistant" && msg.tool_calls) ? null : "(empty)";
      result.push(clean);
      continue;
    }

    // Array content
    if (Array.isArray(content)) {
      const newItems: Array<Record<string, unknown>> = [];
      let changed = false;

      for (const item of content) {
        if (
          typeof item === "object" && item !== null &&
          (item.type === "text" || item.type === "input_text" || item.type === "output_text") &&
          !item.text
        ) {
          changed = true;
          continue; // skip empty text blocks
        }
        if (typeof item === "object" && item !== null && "_meta" in item) {
          const { _meta, ...rest } = item;
          newItems.push(rest);
          changed = true;
        } else {
          newItems.push(item);
        }
      }

      if (changed) {
        const clean = { ...msg };
        if (newItems.length > 0) {
          clean.content = newItems;
        } else if (msg.role === "assistant" && msg.tool_calls) {
          clean.content = null;
        } else {
          clean.content = "(empty)";
        }
        result.push(clean);
        continue;
      }
    }

    // Dict content → wrap in list
    if (typeof content === "object" && content !== null && !Array.isArray(content)) {
      result.push({ ...msg, content: [content as Record<string, unknown>] });
      continue;
    }

    result.push(msg);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Role alternation enforcement (ported from nanobot/_enforce_role_alternation)
// ═══════════════════════════════════════════════════════════════

/**
 * Merge consecutive same-role messages and drop trailing assistant messages.
 *
 * Many providers (OpenAI-compat, Azure, vLLM, Ollama) reject requests where
 * the last message is "assistant" (prefill not supported) or two consecutive
 * non-system messages share the same role.
 */
export function enforceRoleAlternation(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return messages;

  const merged: ChatMessage[] = [];

  for (const msg of messages) {
    const role = msg.role;
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;

    if (
      prev &&
      role !== "system" &&
      role !== "tool" &&
      prev.role === role &&
      (role === "user" || role === "assistant")
    ) {
      if (role === "assistant") {
        const prevHasTools = !!prev.tool_calls;
        const currHasTools = !!msg.tool_calls;

        // Newer assistant with tool_calls replaces older
        if (currHasTools) {
          merged[merged.length - 1] = { ...msg };
          continue;
        }
        if (prevHasTools) continue; // keep tool-call message
      }

      // Merge string content
      const prevContent = prev.content;
      const currContent = msg.content;
      if (typeof prevContent === "string" && typeof currContent === "string") {
        prev.content = (prevContent + "\n\n" + currContent).trim();
      } else {
        merged[merged.length - 1] = { ...msg };
      }
    } else {
      merged.push({ ...msg });
    }
  }

  // Drop trailing assistant messages (providers can't handle prefilling)
  let lastPopped: ChatMessage | null = null;
  while (merged.length > 0 && merged[merged.length - 1].role === "assistant") {
    lastPopped = merged.pop()!;
  }

  // If removing trailing assistant left only system messages, recover by
  // converting the last popped assistant to a user message
  if (
    merged.length > 0 &&
    lastPopped &&
    !merged.some(m => m.role === "user" || m.role === "tool")
  ) {
    merged.push({ ...lastPopped, role: "user" });
  }

  // Safety net: ensure first non-system message is not bare assistant
  for (let i = 0; i < merged.length; i++) {
    const m = merged[i];
    if (m.role !== "system") {
      if (m.role === "assistant" && !m.tool_calls) {
        merged.splice(i, 0, { role: "user", content: SYNTHETIC_USER_CONTENT });
      }
      break;
    }
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════
// Image stripping (ported from nanobot/_strip_image_content)
// ═══════════════════════════════════════════════════════════════

const IMAGE_PLACEHOLDER =
  "[Image not delivered to model — do not describe or reference it]";

export function stripImageContent(messages: ChatMessage[]): ChatMessage[] | null {
  let found = false;
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    const content = msg.content;
    if (Array.isArray(content)) {
      const newContent: Array<Record<string, unknown>> = [];
      for (const block of content) {
        if (typeof block === "object" && block !== null && block.type === "image_url") {
          newContent.push({ type: "text", text: IMAGE_PLACEHOLDER });
          found = true;
        } else {
          newContent.push(block);
        }
      }
      result.push({ ...msg, content: newContent });
    } else {
      result.push(msg);
    }
  }

  return found ? result : null;
}

/** In-place image stripping — mutates message content lists */
export function stripImageContentInPlace(messages: ChatMessage[]): boolean {
  let found = false;
  for (const msg of messages) {
    const content = msg.content;
    if (Array.isArray(content)) {
      for (let i = 0; i < content.length; i++) {
        const block = content[i];
        if (typeof block === "object" && block !== null && block.type === "image_url") {
          content[i] = { type: "text", text: IMAGE_PLACEHOLDER };
          found = true;
        }
      }
    }
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════
// Prompt cache marker indices (for Anthropic prompt caching)
// ═══════════════════════════════════════════════════════════════

export function toolCacheMarkerIndices(tools: Array<Record<string, unknown>>): number[] {
  if (tools.length === 0) return [];

  const tailIdx = tools.length - 1;
  let lastBuiltinIdx: number | null = null;

  for (let i = tailIdx; i >= 0; i--) {
    const name = extractToolName(tools[i]);
    if (!name.startsWith("mcp_")) {
      lastBuiltinIdx = i;
      break;
    }
  }

  const ordered: number[] = [];
  for (const idx of [lastBuiltinIdx, tailIdx]) {
    if (idx !== null && !ordered.includes(idx)) {
      ordered.push(idx);
    }
  }
  return ordered;
}

function extractToolName(tool: Record<string, unknown>): string {
  if (typeof tool.name === "string") return tool.name;
  const fn = tool.function as Record<string, unknown> | undefined;
  if (fn && typeof fn.name === "string") return fn.name;
  return "";
}

// ═══════════════════════════════════════════════════════════════
// Request message sanitization
// ═══════════════════════════════════════════════════════════════

export function sanitizeRequestMessages(
  messages: ChatMessage[],
  allowedKeys?: ReadonlySet<string>,
): ChatMessage[] {
  const keys = allowedKeys ?? ALLOWED_MESSAGE_KEYS;
  return messages.map(msg => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(msg)) {
      if (keys.has(k)) clean[k] = v;
    }
    if (msg.role === "assistant" && !("content" in msg)) {
      clean.content = null;
    }
    return clean as unknown as ChatMessage;
  });
}

// ═══════════════════════════════════════════════════════════════
// BaseProvider — abstract class all providers extend
// ═══════════════════════════════════════════════════════════════

export abstract class BaseProvider implements IProvider {
  public generation: GenerationSettings;

  protected apiKey: string;
  protected apiBase: string;

  constructor(
    defaultModel: string,
    apiKey: string,
    apiBase: string,
    generation?: Partial<GenerationSettings>,
  ) {
    this._model = defaultModel;
    this.apiKey = apiKey;
    this.apiBase = apiBase;
    this.generation = { ...DEFAULT_GENERATION, ...generation };
  }

  protected _model: string;
  get model(): string {
    return this._model;
  }

  setModel(m: string): void {
    this._model = m;
  }

  abstract getDefaultModel(): string;

  abstract chat(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    toolChoice?: string | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse>;

  // Default stream falls back to non-streaming, delivering full content as single delta
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
    const response = await this.chat(
      messages, tools, model, maxTokens, temperature,
      reasoningEffort, toolChoice, signal,
    );
    if (callbacks?.onContentDelta && response.content) {
      await callbacks.onContentDelta(response.content);
    }
    return response;
  }

  // ── Safe wrappers that convert exceptions to error responses ──

  protected async safeChat(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    toolChoice?: string | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    try {
      return await this.chat(
        messages, tools, model, maxTokens, temperature,
        reasoningEffort, toolChoice, signal,
      );
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) throw err;
      return errorResponse(err?.message ?? "Unknown error", {
        kind: err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ? "connection" : undefined,
      });
    }
  }

  protected async safeChatStream(
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
    try {
      return await this.chatStream(
        messages, tools, model, maxTokens, temperature,
        reasoningEffort, toolChoice, callbacks, signal,
      );
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) throw err;
      return errorResponse(err?.message ?? "Unknown error");
    }
  }

  // ── Image stripping: try without images on non-transient error ──

  async tryWithoutImages(
    originalMessages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    call: (
      msgs: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    ) => Promise<LLMResponse>,
  ): Promise<LLMResponse> {
    const stripped = stripImageContent(originalMessages as ChatMessage[]);
    if (!stripped) {
      return errorResponse("Non-transient error (no images to strip)");
    }
    const result = await call(stripped);
    // Permanently strip images from original messages so subsequent
    // iterations don't repeat the error-retry cycle
    if (result.finishReason !== "error") {
      stripImageContentInPlace(originalMessages as ChatMessage[]);
    }
    return result;
  }
}
