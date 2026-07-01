/**
 * Provider Types — Complete LLM provider type system.
 * Ported from nanobot/providers/base.py + registry.py.
 *
 * Design: C mode (interface + decorator), keeping IProvider simple.
 * LLMResponse carries structured error metadata so retry/failover
 * decorators can make decisions without parsing error strings.
 */

// ═══════════════════════════════════════════════════════════════
// Tool call types
// ═══════════════════════════════════════════════════════════════

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Provider-specific extra content (e.g. Anthropic cache_control) */
  extraContent?: Record<string, unknown>;
  /** Provider-specific fields on the top-level tool_call object */
  providerSpecificFields?: Record<string, unknown>;
  /** Provider-specific fields on the function sub-object */
  functionProviderSpecificFields?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// Generation settings
// ═══════════════════════════════════════════════════════════════

export interface GenerationSettings {
  temperature: number;
  maxTokens: number;
  reasoningEffort?: string; // OpenAI: minimal/low/medium/high, Anthropic: token count
}

export const DEFAULT_GENERATION: GenerationSettings = {
  temperature: 0.7,
  maxTokens: 4096,
};

// ═══════════════════════════════════════════════════════════════
// LLM Response — full structured error metadata
// ═══════════════════════════════════════════════════════════════

export interface LLMResponse {
  /** Text content (null when tool-only response) */
  content: string | null;
  /** Tool calls requested by the model */
  toolCalls: ToolCall[];
  /** Stop reason: "stop" | "tool_calls" | "length" | "content_filter" | "error" | ... */
  finishReason: string;
  /** Token usage { promptTokens, completionTokens, totalTokens } */
  usage: Record<string, number>;

  // ── Rate limiting ──
  /** Provider-supplied retry wait in seconds (from headers or body) */
  retryAfter: number | null;

  // ── Reasoning / thinking (two formats) ──
  /** DeepSeek/Kimi/OpenAI reasoning_content */
  reasoningContent: string | null;
  /** Anthropic extended thinking blocks: [{ type: "thinking", thinking, signature }] */
  thinkingBlocks: Array<Record<string, unknown>> | null;

  // ── Structured error metadata (used by retry policy) ──
  /** HTTP status code (e.g. 429, 502, 503) */
  errorStatusCode: number | null;
  /** Error kind: "timeout" | "connection" | "api_error" */
  errorKind: string | null;
  /** Provider semantic type, e.g. "insufficient_quota", "rate_limit_exceeded" */
  errorType: string | null;
  /** Provider semantic code, e.g. "rate_limit_exceeded", "billing_hard_limit_reached" */
  errorCode: string | null;
  /** Retry-after seconds extracted from structured error body/headers */
  errorRetryAfterS: number | null;
  /** Whether the provider or our classifier thinks this error is retryable */
  errorShouldRetry: boolean | null;
}

/** Create a quick error response from an exception */
export function errorResponse(
  content: string,
  opts?: {
    statusCode?: number;
    kind?: string;
    errorType?: string;
    errorCode?: string;
    retryAfterS?: number;
    shouldRetry?: boolean;
  },
): LLMResponse {
  return {
    content: `Error calling LLM: ${content}`,
    toolCalls: [],
    finishReason: "error",
    usage: {},
    retryAfter: null,
    reasoningContent: null,
    thinkingBlocks: null,
    errorStatusCode: opts?.statusCode ?? null,
    errorKind: opts?.kind ?? null,
    errorType: opts?.errorType ?? null,
    errorCode: opts?.errorCode ?? null,
    errorRetryAfterS: opts?.retryAfterS ?? null,
    errorShouldRetry: opts?.shouldRetry ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Provider interface
// ═══════════════════════════════════════════════════════════════

/** Callbacks for streaming delta events */
export interface StreamCallbacks {
  onContentDelta?: (text: string) => Promise<void>;
  onThinkingDelta?: (text: string) => Promise<void>;
  onToolCallDelta?: (delta: Record<string, unknown>) => Promise<void>;
  /** Called when a stream recovers after interruption */
  onStreamRecover?: () => Promise<void>;
}

/**
 * Abstract provider interface.
 * Any LLM backend (OpenAI-compatible, Anthropic native, etc) implements this.
 *
 * Decorators (Retry, Fallback) also implement IProvider — they wrap
 * a delegate provider transparently.
 */
export interface IProvider {
  /** The currently-active model name (may differ from default after fallback) */
  readonly model: string;

  /** Generation defaults (temperature, maxTokens, reasoningEffort) */
  generation: GenerationSettings;

  /** Get the provider's default model */
  getDefaultModel(): string;

  /**
   * Non-streaming chat completion.
   *
   * @param messages - Array of { role, content } messages
   * @param tools - Optional tool definitions (provider-normalized format)
   * @param model - Override model name (falls back to this.model)
   * @param maxTokens - Override max tokens (falls back to this.generation.maxTokens)
   * @param temperature - Override temperature (falls back to this.generation.temperature)
   * @param reasoningEffort - Override reasoning effort
   * @param toolChoice - Tool selection strategy ("auto", "required", or specific tool)
   * @param signal - AbortSignal for cancellation
   */
  chat(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    toolChoice?: string | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse>;

  /**
   * Streaming chat completion.
   *
   * Default implementation falls back to `chat()` and delivers full content
   * as a single delta. Providers with native streaming override this.
   */
  chatStream(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    toolChoice?: string | Record<string, unknown>,
    callbacks?: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<LLMResponse>;
}

// ═══════════════════════════════════════════════════════════════
// Provider Spec (registry metadata)
// ═══════════════════════════════════════════════════════════════

export interface ProviderSpec {
  /** Config field name, e.g. "deepseek" */
  name: string;
  /** Model-name keywords for auto-detection (lowercase) */
  keywords: string[];
  /** Env var for API key, e.g. "DEEPSEEK_API_KEY" */
  envKey: string;
  /** Display name for UI, e.g. "DeepSeek" */
  displayName: string;
  /** Backend implementation: "openai_compat" | "anthropic" | "azure_openai" | "bedrock" | "github_copilot" | "openai_codex" */
  backend: "openai_compat" | "anthropic" | "azure_openai" | "bedrock" | "github_copilot" | "openai_codex";

  // ── Detection ──
  /** Whether this provider can route any model (gateway) */
  isGateway: boolean;
  /** Whether this is a local deployment (vLLM, Ollama, LM Studio) */
  isLocal: boolean;
  /** Whether this is an OAuth-based provider (no API key needed) */
  isOAuth: boolean;
  /** Whether user must supply api_base (custom providers) */
  isDirect: boolean;
  /** Match api_key prefix, e.g. "sk-or-" for OpenRouter */
  detectByKeyPrefix: string;
  /** Match substring in api_base URL */
  detectByBaseKeyword: string;
  /** Default API base URL */
  defaultApiBase: string;

  // ── Gateway behavior ──
  /** Strip "provider/" prefix before sending to gateway */
  stripModelPrefix: boolean;
  /** Strip only when the first model segment matches one of these */
  stripModelPrefixes: string[];

  // ── Caching & thinking ──
  /** Whether the provider supports prompt caching */
  supportsPromptCaching: boolean;
  /**
   * How to inject thinking toggle into extra_body:
   * "" = not needed
   * "thinking_type" = { thinking: { type: "enabled"|"disabled" } } (DeepSeek, VolcEngine)
   * "enable_thinking" = { enable_thinking: true|false } (DashScope)
   * "reasoning_split" = { reasoning_split: true|false } (MiniMax)
   */
  thinkingStyle: "" | "thinking_type" | "enable_thinking" | "reasoning_split";
  /** Gateway-native reasoning control style, e.g. "reasoning_effort" */
  gatewayReasoningStyle: string;

  // ── Model-specific quirks ──
  /** Per-model parameter overrides, e.g. { "kimi-k2.5": { temperature: 1.0 } } */
  modelOverrides: Record<string, { temperature?: number; maxTokens?: number }>;

  // ── Reasoning handling ──
  /** Map user reasoning_effort → wire value. e.g. Mistral: low→none, medium→high */
  reasoningEffortRemap: Record<string, string>;
  /** Models that reject reasoning_effort kwarg (substring match on wire model name) */
  implicitReasoningModels: string[];
  /** Extract thinking blocks from content list into reasoning_content (Mistral) */
  extractThinkingBlocks: boolean;
  /** Strip reasoning_content from assistant history messages before sending */
  stripHistoryReasoningContent: boolean;
  /** Treat "reasoning" field as content when "content" is empty (StepFun) */
  reasoningAsContent: boolean;

  // ── Extra headers / env ──
  /** Additional env vars to set, e.g. [["ZHIPUAI_API_KEY", "{api_key}"]] */
  envExtras: Array<[string, string]>;
  /** Default extra HTTP headers */
  defaultExtraHeaders: Record<string, string>;
}
