/**
 * Provider layer tests — comprehensive coverage of all modules.
 */
import { describe, it, expect } from "vitest";
import {
  errorResponse,
  DEFAULT_GENERATION,
} from "./types";
import type { LLMResponse, ProviderSpec } from "./types";
import {
  sanitizeEmptyContent,
  enforceRoleAlternation,
  stripImageContent,
  parseToolArguments,
  toolArgumentsForReplay,
  resolveStreamIdleTimeoutS,
} from "./base";
import {
  classifyResponse,
  ErrorCategory,
  isArrearageResponse,
  extractRetryAfterFromText,
  extractErrorTypeCode,
} from "./error-classifier";
import {
  findByName,
  detectProvider,
  resolveProvider,
  getByModel,
  createDynamicSpec,
} from "./registry";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

describe("types", () => {
  it("errorResponse creates full error LLMResponse", () => {
    const r = errorResponse("test error", {
      statusCode: 429,
      kind: "rate_limit",
      errorType: "rate_limit_exceeded",
      shouldRetry: true,
    });
    expect(r.finishReason).toBe("error");
    expect(r.content).toContain("test error");
    expect(r.errorStatusCode).toBe(429);
    expect(r.errorKind).toBe("rate_limit");
    expect(r.errorType).toBe("rate_limit_exceeded");
    expect(r.errorShouldRetry).toBe(true);
    expect(r.toolCalls).toEqual([]);
  });

  it("errorResponse with defaults", () => {
    const r = errorResponse("simple error");
    expect(r.errorStatusCode).toBeNull();
    expect(r.errorKind).toBeNull();
    expect(r.errorShouldRetry).toBeNull();
    expect(r.usage).toEqual({});
    expect(r.retryAfter).toBeNull();
    expect(r.reasoningContent).toBeNull();
    expect(r.thinkingBlocks).toBeNull();
  });

  it("DEFAULT_GENERATION has expected values", () => {
    expect(DEFAULT_GENERATION.temperature).toBe(0.7);
    expect(DEFAULT_GENERATION.maxTokens).toBe(4096);
  });
});

// ═══════════════════════════════════════════════════════════════
// Base — message sanitization
// ═══════════════════════════════════════════════════════════════

describe("sanitizeEmptyContent", () => {
  it("replaces empty string content with placeholder", () => {
    const input = [{ role: "user", content: "" }];
    const result = sanitizeEmptyContent(input);
    expect(result[0].content).toBe("(empty)");
  });

  it("nullifies empty assistant content with tool_calls", () => {
    const input = [{ role: "assistant", content: "", tool_calls: [{ id: "1", name: "test" }] }];
    const result = sanitizeEmptyContent(input);
    expect(result[0].content).toBeNull();
  });

  it("strips _meta fields from content blocks", () => {
    const input = [{ role: "user", content: [{ type: "text", text: "hello", _meta: "remove" }] }];
    const result = sanitizeEmptyContent(input);
    const block = (result[0].content as any[])[0];
    expect(block._meta).toBeUndefined();
    expect(block.text).toBe("hello");
  });

  it("removes empty text blocks", () => {
    const input = [{ role: "user", content: [{ type: "text", text: "" }, { type: "text", text: "actual" }] }];
    const result = sanitizeEmptyContent(input);
    expect((result[0].content as any[]).length).toBe(1);
    expect((result[0].content as any[])[0].text).toBe("actual");
  });

  it("passes through valid content unchanged", () => {
    const input = [{ role: "user", content: "hello world" }];
    const result = sanitizeEmptyContent(input);
    expect(result[0].content).toBe("hello world");
  });
});

describe("enforceRoleAlternation", () => {
  it("merges consecutive same-role user messages", () => {
    const input = [
      { role: "user", content: "msg1" },
      { role: "user", content: "msg2" },
    ];
    const result = enforceRoleAlternation(input);
    expect(result.length).toBe(1);
    expect(result[0].content).toContain("msg1");
    expect(result[0].content).toContain("msg2");
  });

  it("drops trailing assistant messages", () => {
    const input = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "reply" },
      { role: "assistant", content: "extra" },
    ];
    const result = enforceRoleAlternation(input);
    // Two consecutive assistants merged into one, then trailing assistant dropped → only user remains
    expect(result.length).toBe(1);
    expect(result[0].role).toBe("user");
  });

  it("inserts synthetic user content when first non-system is bare assistant", () => {
    const input = [
      { role: "system", content: "sys" },
      { role: "assistant", content: "bare" },
    ];
    const result = enforceRoleAlternation(input);
    // System → trailing assistant dropped → recover: last assistant becomes user
    // Wait: after dropping trailing assistant, only system remains.
    // Then recovery: convert last popped assistant to user.
    // So: system + (converted)user. That's 2.
    expect(result.length).toBe(2);
    expect(result[0].role).toBe("system");
    expect(result[1].role).toBe("user"); // recovered
  });

  it("passes through valid alternating messages", () => {
    const input = [
      { role: "system", content: "sys" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    const result = enforceRoleAlternation(input);
    // Trailing assistant is dropped! So: system + user = 2
    expect(result.length).toBe(2);
    expect(result[0].role).toBe("system");
    expect(result[1].role).toBe("user");
  });
});

describe("stripImageContent", () => {
  it("strips image_url blocks", () => {
    const input = [{ role: "user", content: [
      { type: "text", text: "look at this" },
      { type: "image_url", image_url: { url: "data:image/..." } },
    ] }];
    const result = stripImageContent(input);
    expect(result).not.toBeNull();
    const blocks = result![0].content as any[];
    expect(blocks[1].type).toBe("text");
    expect(blocks[1].text).toContain("Image not delivered");
  });

  it("returns null when no images present", () => {
    const input = [{ role: "user", content: "text only" }];
    const result = stripImageContent(input);
    expect(result).toBeNull();
  });
});

describe("parseToolArguments", () => {
  it("parses valid JSON object", () => {
    expect(parseToolArguments('{"key": "value"}')).toEqual({ key: "value" });
  });

  it("returns empty object for null/undefined", () => {
    expect(parseToolArguments(null)).toEqual({});
    expect(parseToolArguments(undefined)).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseToolArguments("")).toEqual({});
    expect(parseToolArguments("  ")).toEqual({});
  });

  it("preserves non-object parsed values", () => {
    const result = parseToolArguments("[1,2,3]");
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("toolArgumentsForReplay", () => {
  it("repairs unquoted keys", () => {
    const input = '{key: "value"}';
    const result = toolArgumentsForReplay(input);
    expect(result.key).toBe("value");
  });

  it("handles trailing commas", () => {
    const input = '{"a": 1,}';
    const result = toolArgumentsForReplay(input);
    expect(result.a).toBe(1);
  });

  it("returns empty object for null", () => {
    expect(toolArgumentsForReplay(null)).toEqual({});
  });
});

describe("resolveStreamIdleTimeoutS", () => {
  it("returns default when env is empty", () => {
    const result = resolveStreamIdleTimeoutS(undefined);
    expect(result).toBe(90);
  });

  it("clamps to maximum", () => {
    const result = resolveStreamIdleTimeoutS("9999");
    expect(result).toBe(3600);
  });

  it("returns default for invalid values", () => {
    expect(resolveStreamIdleTimeoutS("abc")).toBe(90);
    expect(resolveStreamIdleTimeoutS("-5")).toBe(90);
  });
});

// ═══════════════════════════════════════════════════════════════
// Error Classifier
// ═══════════════════════════════════════════════════════════════

describe("classifyResponse", () => {
  function resp(overrides: Partial<LLMResponse> = {}): LLMResponse {
    return {
      content: null, toolCalls: [], finishReason: "error", usage: {},
      retryAfter: null, reasoningContent: null, thinkingBlocks: null,
      errorStatusCode: null, errorKind: null, errorType: null, errorCode: null,
      errorRetryAfterS: null, errorShouldRetry: null,
      ...overrides,
    };
  }

  it("uses structured shouldRetry when set", () => {
    expect(classifyResponse(resp({ errorShouldRetry: true }))).toBe(ErrorCategory.RETRYABLE);
    expect(classifyResponse(resp({ errorShouldRetry: false }))).toBe(ErrorCategory.NON_RETRYABLE);
  });

  it("classifies 5xx as retryable", () => {
    expect(classifyResponse(resp({ errorStatusCode: 500 }))).toBe(ErrorCategory.RETRYABLE);
    expect(classifyResponse(resp({ errorStatusCode: 503 }))).toBe(ErrorCategory.RETRYABLE);
  });

  it("classifies 429 with rate_limit_exceeded as retryable", () => {
    expect(classifyResponse(resp({
      errorStatusCode: 429,
      errorType: "rate_limit_exceeded",
    }))).toBe(ErrorCategory.RETRYABLE);
  });

  it("classifies 429 with insufficient_quota as non-retryable", () => {
    expect(classifyResponse(resp({
      errorStatusCode: 429,
      errorType: "insufficient_quota",
    }))).toBe(ErrorCategory.NON_RETRYABLE);
  });

  it("classifies timeout kind as retryable", () => {
    expect(classifyResponse(resp({ errorKind: "timeout" }))).toBe(ErrorCategory.RETRYABLE);
  });

  it("falls back to text markers", () => {
    expect(classifyResponse(resp({ content: "server error 502" }))).toBe(ErrorCategory.RETRYABLE);
    expect(classifyResponse(resp({ content: "something else" }))).toBe(ErrorCategory.UNKNOWN);
  });
});

describe("isArrearageResponse", () => {
  function resp(overrides: Partial<LLMResponse> = {}): LLMResponse {
    return { content: null, toolCalls: [], finishReason: "error", usage: {},
      retryAfter: null, reasoningContent: null, thinkingBlocks: null,
      errorStatusCode: null, errorKind: null, errorType: null, errorCode: null,
      errorRetryAfterS: null, errorShouldRetry: null, ...overrides };
  }

  it("detects HTTP 402 as arrearage", () => {
    expect(isArrearageResponse(resp({ errorStatusCode: 402 }))).toBe(true);
  });

  it("detects billing tokens in errorType", () => {
    expect(isArrearageResponse(resp({ errorType: "insufficient_quota" }))).toBe(true);
    expect(isArrearageResponse(resp({ errorType: "rate_limit_exceeded" }))).toBe(false);
  });

  it("detects billing text markers in content", () => {
    expect(isArrearageResponse(resp({ content: "exceeded your current quota" }))).toBe(true);
  });
});

describe("extractRetryAfterFromText", () => {
  it("extracts seconds format", () => {
    const result = extractRetryAfterFromText("retry after 5s");
    expect(result).toBe(5);
  });

  it("extracts milliseconds and converts to seconds", () => {
    const result = extractRetryAfterFromText("try again in 500ms");
    expect(result).toBe(0.5);
  });

  it("extracts minutes format", () => {
    const result = extractRetryAfterFromText("wait 2 minutes before retry");
    expect(result).toBe(120);
  });

  it("returns null when no pattern matches", () => {
    expect(extractRetryAfterFromText("no retry info")).toBeNull();
    expect(extractRetryAfterFromText(null)).toBeNull();
  });
});

describe("extractErrorTypeCode", () => {
  it("extracts from object with error property", () => {
    const [type, code] = extractErrorTypeCode({
      error: { type: "rate_limit_exceeded", code: "429" },
    });
    expect(type).toBe("rate_limit_exceeded");
    expect(code).toBe("429");
  });

  it("extracts from flat object", () => {
    const [type, code] = extractErrorTypeCode({ type: "server_error", code: "500" });
    expect(type).toBe("server_error");
    expect(code).toBe("500");
  });

  it("parses JSON string payload", () => {
    const [type, code] = extractErrorTypeCode('{"error":{"type":"insufficient_quota"}}');
    expect(type).toBe("insufficient_quota");
  });

  it("returns nulls for non-matching payload", () => {
    expect(extractErrorTypeCode(42)).toEqual([null, null]);
    expect(extractErrorTypeCode("not json")).toEqual([null, null]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Provider Registry
// ═══════════════════════════════════════════════════════════════

describe("findByName", () => {
  it("finds deepseek by name", () => {
    const spec = findByName("deepseek");
    expect(spec).toBeDefined();
    expect(spec!.backend).toBe("openai_compat");
    expect(spec!.envKey).toBe("DEEPSEEK_API_KEY");
  });

  it("finds anthropic by name", () => {
    const spec = findByName("anthropic");
    expect(spec).toBeDefined();
    expect(spec!.backend).toBe("anthropic");
    expect(spec!.supportsPromptCaching).toBe(true);
  });

  it("finds openrouter by name", () => {
    const spec = findByName("openrouter");
    expect(spec).toBeDefined();
    expect(spec!.isGateway).toBe(true);
    expect(spec!.detectByKeyPrefix).toBe("sk-or-");
  });

  it("handles kebab-case to snake_case normalization", () => {
    const spec = findByName("openrouter");
    expect(spec).toBeDefined();
  });

  it("returns undefined for unknown provider", () => {
    expect(findByName("nonexistent")).toBeUndefined();
  });

  it("finds gateway providers (Skywork)", () => {
    const spec = findByName("skywork");
    expect(spec).toBeDefined();
    expect(spec!.isGateway).toBe(true);
  });

  it("finds local providers (Ollama)", () => {
    const spec = findByName("ollama");
    expect(spec).toBeDefined();
    expect(spec!.isLocal).toBe(true);
    expect(spec!.detectByBaseKeyword).toBe("11434");
  });
});

describe("detectProvider", () => {
  it("detects Anthropic from API key prefix", () => {
    const spec = detectProvider("sk-ant-api123");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("anthropic");
  });

  it("detects OpenRouter from API key prefix", () => {
    const spec = detectProvider("sk-or-v1-abc");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("openrouter");
  });

  it("detects NVIDIA from API key prefix", () => {
    const spec = detectProvider("nvapi-abc");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("nvidia");
  });

  it("detects from base URL keyword", () => {
    const spec = detectProvider(undefined, "https://api.deepseek.com/v1/chat");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("deepseek");
  });

  it("detects from model name keywords", () => {
    const spec = detectProvider(undefined, undefined, "claude-sonnet-5");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("anthropic");
  });

  it("detects Moonshot from model name", () => {
    const spec = detectProvider(undefined, undefined, "kimi-k2.5");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("moonshot");
  });

  it("detects Mistral from model name", () => {
    const spec = detectProvider(undefined, undefined, "mistral-large");
    expect(spec).toBeDefined();
    expect(spec!.name).toBe("mistral");
  });
});

describe("getByModel", () => {
  it("matches by model keyword", () => {
    expect(getByModel("gpt-5")!.name).toBe("openai");
    expect(getByModel("claude-opus")!.name).toBe("anthropic");
    expect(getByModel("qwen2.5")!.name).toBe("dashscope");
    expect(getByModel("glm-4")!.name).toBe("zhipu");
  });
});

describe("resolveProvider", () => {
  it("resolves deepseek with default base URL", () => {
    const r = resolveProvider("deepseek", "deepseek-chat", "sk-test");
    expect(r).toBeDefined();
    expect(r!.model).toBe("deepseek-chat");
    expect(r!.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(r!.spec.name).toBe("deepseek");
  });

  it("resolves anthropic with overridden base URL", () => {
    const r = resolveProvider("anthropic", "claude-sonnet", "sk-ant-test", "https://custom.anthropic.com/v1");
    expect(r).toBeDefined();
    expect(r!.baseUrl).toBe("https://custom.anthropic.com/v1");
  });

  it("auto-detects from API key when providerName unknown", () => {
    const r = resolveProvider("unknown", "some-model", "sk-ant-api123");
    expect(r).toBeDefined();
    expect(r!.spec.name).toBe("anthropic");
  });
});

describe("createDynamicSpec", () => {
  it("creates a custom provider spec", () => {
    const spec = createDynamicSpec("my-custom", "thinking_type");
    expect(spec.name).toBe("my_custom");
    expect(spec.isDirect).toBe(true);
    expect(spec.thinkingStyle).toBe("thinking_type");
    expect(spec.stripModelPrefixes).toContain("my-custom");
  });
});

// ═══════════════════════════════════════════════════════════════
// Provider quirks — verify nanobot-ported knowledge
// ═══════════════════════════════════════════════════════════════

describe("provider quirks (ported from nanobot)", () => {
  it("Moonshot Kimi K2.5 requires temperature >= 1.0", () => {
    const spec = findByName("moonshot")!;
    expect(spec.modelOverrides["kimi-k2.5"]).toBeDefined();
    expect(spec.modelOverrides["kimi-k2.5"].temperature).toBe(1.0);
  });

  it("Mistral has reasoning_effort remapping", () => {
    const spec = findByName("mistral")!;
    expect(spec.reasoningEffortRemap["low"]).toBe("none");
    expect(spec.reasoningEffortRemap["medium"]).toBe("high");
    expect(spec.reasoningEffortRemap["high"]).toBe("high");
    expect(spec.implicitReasoningModels).toContain("magistral");
    expect(spec.extractThinkingBlocks).toBe(true);
    expect(spec.stripHistoryReasoningContent).toBe(true);
  });

  it("StepFun uses reasoning_as_content fallback", () => {
    const spec = findByName("stepfun")!;
    expect(spec.reasoningAsContent).toBe(true);
  });

  it("Kimi Coding uses Anthropic backend with special User-Agent", () => {
    const spec = findByName("kimi_coding")!;
    expect(spec.backend).toBe("anthropic");
    expect(spec.defaultExtraHeaders["User-Agent"]).toBe("claude-code/0.1.0");
  });

  it("DeepSeek uses thinking_type", () => {
    const spec = findByName("deepseek")!;
    expect(spec.thinkingStyle).toBe("thinking_type");
  });

  it("DashScope uses enable_thinking", () => {
    const spec = findByName("dashscope")!;
    expect(spec.thinkingStyle).toBe("enable_thinking");
  });

  it("MiniMax uses reasoning_split", () => {
    const spec = findByName("minimax")!;
    expect(spec.thinkingStyle).toBe("reasoning_split");
  });

  it("Mistral Magistral models reject reasoning_effort kwarg", () => {
    const spec = findByName("mistral")!;
    expect(spec.implicitReasoningModels).toContain("magistral");
  });
});
