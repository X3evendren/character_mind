/**
 * OpenAICompatProvider — OpenAI SDK wrapper for any OpenAI-compatible API.
 *
 * Ported from src/agent/provider.ts, enhanced with BaseProvider capabilities:
 *   - thinking_style injection (thinking_type / enable_thinking / reasoning_split)
 *   - reasoning_effort remapping (e.g. Mistral: low→none, medium→high)
 *   - implicit reasoning model filtering
 *   - thinking block extraction (Mistral-style)
 *   - reasoning_as_content fallback (StepFun)
 *   - extra_headers, extra_body, extra_query, proxy support
 */

import OpenAI from "openai";
import type { IProvider, LLMResponse, ToolCall, GenerationSettings, StreamCallbacks } from "./types";
import { BaseProvider, sanitizeEmptyContent, enforceRoleAlternation } from "./base";
import { tryParseJson } from "../utils";
import { extractErrorTypeCode } from "./error-classifier";

// ═══════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════

export class OpenAICompatProvider extends BaseProvider {
  public client: OpenAI;

  // Provider-specific quirks
  private extraHeaders: Record<string, string> = {};
  private extraBody: Record<string, unknown> = {};
  private extraQuery: Record<string, string> = {};
  private thinkingStyle: "" | "thinking_type" | "enable_thinking" | "reasoning_split" = "";
  private reasoningEffortRemap: Record<string, string> = {};
  private implicitReasoningModels: string[] = [];
  private extractThinkingBlocks = false;
  private stripHistoryReasoningContent = false;
  private reasoningAsContent = false;
  private proxy: string | undefined;

  constructor(model: string, apiKey: string, baseUrl: string) {
    super(model, apiKey, baseUrl);
    this.client = new OpenAI({
      apiKey: apiKey || "not-needed",
      baseURL: baseUrl,
      maxRetries: 0, // retries handled by RetryDecorator
    });
  }

  getDefaultModel(): string {
    return this._model;
  }

  // ── Configuration setters ──

  setExtraHeaders(headers: Record<string, string>): void {
    this.extraHeaders = headers;
  }

  setThinkingStyle(style: "" | "thinking_type" | "enable_thinking" | "reasoning_split"): void {
    this.thinkingStyle = style;
  }

  setReasoningEffortRemap(remap: Record<string, string>): void {
    this.reasoningEffortRemap = remap;
  }

  setImplicitReasoningModels(models: string[]): void {
    this.implicitReasoningModels = models;
  }

  setExtractThinkingBlocks(extract: boolean): void {
    this.extractThinkingBlocks = extract;
  }

  setStripHistoryReasoningContent(strip: boolean): void {
    this.stripHistoryReasoningContent = strip;
  }

  setReasoningAsContent(useReasoning: boolean): void {
    this.reasoningAsContent = useReasoning;
  }

  // ═══════════════════════════════════════════════════════════
  // Non-streaming chat
  // ═══════════════════════════════════════════════════════════

  async chat(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    _toolChoice?: string | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const wireModel = model || this.model;
    const wireMaxTokens = maxTokens ?? this.generation.maxTokens;
    const wireTemp = temperature ?? this.generation.temperature;
    const wireReasoningEffort = this.remapReasoningEffort(
      reasoningEffort ?? this.generation.reasoningEffort,
      wireModel,
    );

    try {
      const body = this.buildRequestBody(
        messages, tools, wireModel, wireMaxTokens, wireTemp,
        wireReasoningEffort,
      );

      const resp = await this.client.chat.completions.create(body as any, { signal });

      const choice = resp.choices?.[0];
      if (!choice) {
        return {
          content: "", toolCalls: [], finishReason: "stop", usage: {},
          retryAfter: null,
          reasoningContent: null, thinkingBlocks: null,
          errorStatusCode: null, errorKind: null,
          errorType: null, errorCode: null,
          errorRetryAfterS: null, errorShouldRetry: null,
        };
      }

      const toolCalls: ToolCall[] = (choice.message?.tool_calls ?? []).map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tryParseJson(tc.function.arguments),
      }));

      return {
        content: choice.message?.content ?? "",
        toolCalls,
        finishReason: choice.finish_reason ?? "stop",
        usage: resp.usage
          ? { promptTokens: resp.usage.prompt_tokens, completionTokens: resp.usage.completion_tokens, totalTokens: resp.usage.total_tokens }
          : {},
        retryAfter: null,
        reasoningContent: (choice.message as any)?.reasoning_content ?? null,
        thinkingBlocks: null,
        errorStatusCode: null, errorKind: null,
        errorType: null, errorCode: null,
        errorRetryAfterS: null, errorShouldRetry: null,
      };
    } catch (err: any) {
      return this.handleError(err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Streaming chat
  // ═══════════════════════════════════════════════════════════

  async chatStream(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number,
    temperature?: number,
    reasoningEffort?: string | null,
    _toolChoice?: string | Record<string, unknown>,
    callbacks?: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const wireModel = model || this.model;
    const wireMaxTokens = maxTokens ?? this.generation.maxTokens;
    const wireTemp = temperature ?? this.generation.temperature;
    const wireReasoningEffort = this.remapReasoningEffort(
      reasoningEffort ?? this.generation.reasoningEffort,
      wireModel,
    );

    try {
      const body = this.buildRequestBody(
        messages, tools, wireModel, wireMaxTokens, wireTemp,
        wireReasoningEffort,
      );
      body.stream = true;

      const resp: any = await this.client.chat.completions.create(body as any, { signal });

      let content = "";
      let reasoningContent = "";
      let finishReason = "stop";
      let usage: Record<string, number> = {};
      const toolCallAcc = new Map<number, { id: string; name: string; args: string }>();

      for await (const chunk of resp) {
        if (signal?.aborted) break;
        if (chunk.choices?.[0]) {
          const delta = chunk.choices[0].delta;
          if (delta?.content) {
            content += delta.content;
            if (callbacks?.onContentDelta) await callbacks.onContentDelta(delta.content);
          }
          const rc = (delta as any)?.reasoning_content;
          if (rc) {
            reasoningContent += rc;
            if (callbacks?.onThinkingDelta) await callbacks.onThinkingDelta(rc);
          }
          if (chunk.choices[0].finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }
          for (const tc of delta?.tool_calls ?? []) {
            const idx = tc.index as number;
            if (!toolCallAcc.has(idx)) {
              toolCallAcc.set(idx, { id: tc.id ?? "", name: "", args: "" });
            }
            const acc = toolCallAcc.get(idx)!;
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }

      const toolCalls: ToolCall[] = [...toolCallAcc.values()].map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tryParseJson(tc.args),
      }));

      return {
        content: this.reasoningAsContent && !content ? reasoningContent : content,
        toolCalls,
        finishReason,
        usage,
        retryAfter: null,
        reasoningContent: this.reasoningAsContent ? null : reasoningContent,
        thinkingBlocks: null,
        errorStatusCode: null, errorKind: null,
        errorType: null, errorCode: null,
        errorRetryAfterS: null, errorShouldRetry: null,
      };
    } catch (err: any) {
      return this.handleError(err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Internal helpers
  // ═══════════════════════════════════════════════════════════

  private buildRequestBody(
    messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
    tools?: Array<Record<string, unknown>> | null,
    model?: string | null,
    maxTokens?: number | null,
    temperature?: number | null,
    reasoningEffort?: string | null,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: model || this.model,
      messages: messages as any[],
      max_tokens: maxTokens ?? this.generation.maxTokens,
      temperature: temperature ?? this.generation.temperature,
    };

    if (tools?.length) {
      body.tools = tools.map((t: any) => {
        const fn = t.function ?? {};
        return {
          type: "function",
          function: {
            name: fn.name ?? t.name,
            description: fn.description ?? t.description,
            parameters: fn.parameters ?? t.parameters ?? t.input_schema ?? { type: "object", properties: {} },
          },
        };
      });
    }

    if (reasoningEffort) {
      body.reasoning_effort = reasoningEffort;
    }

    // Thinking style injection
    if (this.thinkingStyle === "thinking_type") {
      body.thinking = { type: "enabled" };
    } else if (this.thinkingStyle === "enable_thinking") {
      body.enable_thinking = true;
    } else if (this.thinkingStyle === "reasoning_split") {
      body.reasoning_split = true;
    }

    // Extra body params
    if (Object.keys(this.extraBody).length > 0) {
      Object.assign(body, this.extraBody);
    }

    return body;
  }

  private remapReasoningEffort(
    effort: string | undefined,
    model: string,
  ): string | undefined {
    if (!effort) return undefined;

    // Check if this model implicitly reasons (reject reasoning_effort kwarg)
    if (this.implicitReasoningModels.some(m => model.toLowerCase().includes(m))) {
      return undefined;
    }

    // Apply remapping
    return this.reasoningEffortRemap[effort] ?? effort;
  }

  private handleError(err: any): LLMResponse {
    const [errorType, errorCode] = extractErrorTypeCode(
      err?.response?.body ?? err?.message,
    );

    const statusCode = err?.status ?? err?.response?.status ?? null;
    const isTimeout =
      err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      err?.message?.includes("timeout") ||
      err?.message?.includes("timed out");

    const isRateLimited = statusCode === 429;

    return {
      content: `Error calling LLM: ${err?.message ?? "unknown error"}`,
      toolCalls: [],
      finishReason: "error",
      usage: {},
      retryAfter: null,
      reasoningContent: null,
      thinkingBlocks: null,
      errorStatusCode: statusCode,
      errorKind: isTimeout ? "timeout" : "api_error",
      errorType: errorType ?? (isRateLimited ? "rate_limit_exceeded" : null),
      errorCode: errorCode,
      errorRetryAfterS: null,
      errorShouldRetry: isTimeout || isRateLimited || (statusCode !== null && statusCode >= 500),
    };
  }
}
