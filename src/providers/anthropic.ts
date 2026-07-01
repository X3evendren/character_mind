/**
 * AnthropicProvider — raw HTTP wrapper for Anthropic-compatible APIs.
 *
 * Ported from src/agent/provider-anthropic.ts, enhanced with BaseProvider
 * capabilities: prompt caching, thinking blocks extraction, extra headers.
 *
 * Supports:
 *   - Anthropic Messages API: POST {base}/v1/messages
 *   - LongCat: https://longcat.chat/platform/docs/APIDocs.html
 *   - Kimi Coding Plan: https://api.kimi.com/coding/v1
 *   - MiniMax Anthropic endpoint: https://api.minimax.io/anthropic
 */

import type { IProvider, LLMResponse, ToolCall, GenerationSettings, StreamCallbacks } from "./types";
import { BaseProvider } from "./base";
import { tryParseJson } from "../utils";
import { extractErrorTypeCode } from "./error-classifier";

// ═══════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════

export class AnthropicProvider extends BaseProvider {
  private extraHeaders: Record<string, string> = {};

  constructor(model: string, apiKey: string, baseUrl: string) {
    super(model, apiKey, baseUrl.replace(/\/+$/, ""));
  }

  getDefaultModel(): string {
    return this._model;
  }

  setExtraHeaders(headers: Record<string, string>): void {
    this.extraHeaders = headers;
  }

  // ── URL & headers ──

  private url(): string {
    return `${this.apiBase}/v1/messages`;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
      "anthropic-version": "2023-06-01",
      ...this.extraHeaders,
    };
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
    toolChoice?: string | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const wireModel = model || this.model;
    const wireMaxTokens = maxTokens ?? this.generation.maxTokens;
    const wireTemp = temperature ?? this.generation.temperature;

    // Extract system message (Anthropic: top-level param)
    const systemMsg = messages.find(m => m.role === "system");
    const chatMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

    // Normalize tools to Anthropic format
    const anthropicTools = tools?.map((t: any) => {
      const fn = t.function ?? t;
      return {
        name: fn.name ?? t.name,
        description: fn.description ?? t.description,
        input_schema: fn.parameters ?? t.parameters ?? t.input_schema ?? { type: "object", properties: {} },
      };
    });

    const body: Record<string, unknown> = {
      model: wireModel,
      messages: chatMessages,
      max_tokens: wireMaxTokens,
      temperature: wireTemp,
    };
    if (systemMsg?.content) body.system = systemMsg.content;
    if (anthropicTools?.length) body.tools = anthropicTools;

    // Tool choice
    if (toolChoice) {
      if (typeof toolChoice === "string") {
        body.tool_choice = { type: toolChoice };
      } else {
        body.tool_choice = toolChoice;
      }
    }

    // Extended thinking
    if (reasoningEffort) {
      body.thinking = {
        type: "enabled",
        budget_tokens: parseInt(reasoningEffort) || 4000,
      };
    }

    try {
      const resp = await fetch(this.url(), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const [errorType, errorCode] = extractErrorTypeCode(errText);
        return {
          content: `Anthropic API ${resp.status}: ${errText.slice(0, 300)}`,
          toolCalls: [],
          finishReason: "error",
          usage: {},
          retryAfter: null,
          reasoningContent: null,
          thinkingBlocks: null,
          errorStatusCode: resp.status,
          errorKind: resp.status >= 500 ? "server_error"
            : resp.status === 429 ? "rate_limit"
            : "api_error",
          errorType,
          errorCode,
          errorRetryAfterS: null,
          errorShouldRetry: resp.status >= 500 || resp.status === 429,
        };
      }

      const data = await resp.json() as any;
      const contentBlocks = data.content ?? [];

      let textContent = "";
      const toolCalls: ToolCall[] = [];
      const thinkingBlocks: Array<Record<string, unknown>> = [];

      for (const block of contentBlocks) {
        if (block.type === "text") {
          textContent += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id ?? "",
            name: block.name ?? "",
            arguments: block.input ?? {},
          });
        } else if (block.type === "thinking") {
          thinkingBlocks.push(block);
        }
      }

      return {
        content: textContent,
        toolCalls,
        finishReason: data.stop_reason ?? "end_turn",
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens ?? 0,
              completionTokens: data.usage.output_tokens ?? 0,
              totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
            }
          : {},
        retryAfter: null,
        reasoningContent: null,
        thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : null,
        errorStatusCode: null, errorKind: null,
        errorType: null, errorCode: null,
        errorRetryAfterS: null, errorShouldRetry: null,
      };
    } catch (err: any) {
      return {
        content: `Error calling Anthropic: ${err?.message ?? "unknown error"}`,
        toolCalls: [],
        finishReason: "error",
        usage: {},
        retryAfter: null,
        reasoningContent: null, thinkingBlocks: null,
        errorStatusCode: null,
        errorKind: err?.name === "AbortError" ? "cancelled"
          : err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ? "timeout"
          : "connection",
        errorType: null, errorCode: null,
        errorRetryAfterS: null,
        errorShouldRetry: err?.name !== "AbortError",
      };
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
    toolChoice?: string | Record<string, unknown>,
    callbacks?: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const wireModel = model || this.model;
    const wireMaxTokens = maxTokens ?? this.generation.maxTokens;
    const wireTemp = temperature ?? this.generation.temperature;

    const systemMsg = messages.find(m => m.role === "system");
    const chatMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

    const anthropicTools = tools?.map((t: any) => {
      const fn = t.function ?? t;
      return {
        name: fn.name ?? t.name,
        description: fn.description ?? t.description,
        input_schema: fn.parameters ?? t.parameters ?? t.input_schema ?? { type: "object", properties: {} },
      };
    });

    const body: Record<string, unknown> = {
      model: wireModel,
      messages: chatMessages,
      max_tokens: wireMaxTokens,
      temperature: wireTemp,
      stream: true,
    };
    if (systemMsg?.content) body.system = systemMsg.content;
    if (anthropicTools?.length) body.tools = anthropicTools;
    if (toolChoice) {
      body.tool_choice = typeof toolChoice === "string"
        ? { type: toolChoice }
        : toolChoice;
    }
    if (reasoningEffort) {
      body.thinking = {
        type: "enabled",
        budget_tokens: parseInt(reasoningEffort) || 4000,
      };
    }

    try {
      const resp = await fetch(this.url(), {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        return {
          content: `Anthropic API ${resp.status}: ${errText.slice(0, 300)}`,
          toolCalls: [],
          finishReason: "error",
          usage: {},
          retryAfter: null, reasoningContent: null, thinkingBlocks: null,
          errorStatusCode: resp.status,
          errorKind: resp.status >= 500 ? "server_error"
            : resp.status === 429 ? "rate_limit"
            : "api_error",
          errorType: null, errorCode: null,
          errorRetryAfterS: null,
          errorShouldRetry: resp.status >= 500 || resp.status === 429,
        };
      }

      let content = "";
      let finishReason = "end_turn";
      let usage: Record<string, number> = {};
      const thinkingBlocks: Array<Record<string, unknown>> = [];
      const toolUseAcc = new Map<number, { id: string; name: string; input: string }>();

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("no response body");

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done || signal?.aborted) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            switch (event.type) {
              case "content_block_delta":
                if (event.delta?.type === "text_delta" && event.delta.text) {
                  content += event.delta.text;
                  if (callbacks?.onContentDelta) await callbacks.onContentDelta(event.delta.text);
                } else if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
                  const idx = event.index ?? 0;
                  if (!toolUseAcc.has(idx)) toolUseAcc.set(idx, { id: "", name: "", input: "" });
                  toolUseAcc.get(idx)!.input += event.delta.partial_json;
                } else if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
                  if (callbacks?.onThinkingDelta) await callbacks.onThinkingDelta(event.delta.thinking);
                }
                break;
              case "content_block_start":
                if (event.content_block?.type === "tool_use") {
                  const idx = event.index ?? 0;
                  toolUseAcc.set(idx, {
                    id: event.content_block.id ?? "",
                    name: event.content_block.name ?? "",
                    input: "",
                  });
                } else if (event.content_block?.type === "thinking") {
                  thinkingBlocks.push(event.content_block);
                }
                break;
              case "message_delta":
                finishReason = event.delta?.stop_reason ?? "end_turn";
                if (event.usage) {
                  usage = {
                    promptTokens: event.usage.input_tokens ?? 0,
                    completionTokens: event.usage.output_tokens ?? 0,
                    totalTokens: (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0),
                  };
                }
                break;
            }
          } catch { /* skip malformed SSE */ }
        }
      }

      const toolCalls: ToolCall[] = [...toolUseAcc.values()].map(tc => ({
        id: tc.id,
        name: tc.name,
        arguments: tryParseJson(tc.input),
      }));

      return {
        content,
        toolCalls,
        finishReason,
        usage,
        retryAfter: null,
        reasoningContent: null,
        thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : null,
        errorStatusCode: null, errorKind: null,
        errorType: null, errorCode: null,
        errorRetryAfterS: null, errorShouldRetry: null,
      };
    } catch (err: any) {
      return {
        content: `Error calling Anthropic stream: ${err?.message ?? "unknown error"}`,
        toolCalls: [],
        finishReason: "error",
        usage: {},
        retryAfter: null, reasoningContent: null, thinkingBlocks: null,
        errorStatusCode: null,
        errorKind: err?.name === "AbortError" ? "cancelled"
          : err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ? "timeout"
          : "connection",
        errorType: null, errorCode: null,
        errorRetryAfterS: null,
        errorShouldRetry: err?.name !== "AbortError",
      };
    }
  }
}
