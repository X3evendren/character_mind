/**
 * Anthropic Provider — raw HTTP wrapper for longcat / Anthropic-compatible APIs.
 *
 * Longcat API docs: https://longcat.chat/platform/docs/APIDocs.html
 *   - Anthropic endpoint: POST {base}/v1/messages
 *   - Auth: Authorization: Bearer {apiKey}
 *   - Model: LongCat-2.0-Preview
 */

import type { IProvider, LLMResponse, ToolCall } from "./provider";
import { tryParseJson } from "../utils";

export class AnthropicProvider implements IProvider {
  public model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(model: string, apiKey: string, baseUrl: string) {
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private url(): string {
    return `${this.baseUrl}/v1/messages`;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
    };
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    temperature = 0.7,
    maxTokens = 4096,
    tools?: any,
    modelOverride = "",
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const model = modelOverride || this.model;

    // Extract system message (Anthropic: top-level param)
    const systemMsg = messages.find(m => m.role === "system");
    const chatMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const anthropicTools = tools?.map((t: any) => ({
      name: t.function?.name ?? t.name,
      description: t.function?.description ?? t.description,
      input_schema: t.function?.parameters ?? t.input_schema ?? { type: "object", properties: {} },
    }));

    const body: Record<string, unknown> = {
      model,
      messages: chatMessages,
      max_tokens: maxTokens,
      temperature,
    };
    if (systemMsg) body.system = systemMsg.content;
    if (anthropicTools?.length) body.tools = anthropicTools;

    const resp = await fetch(this.url(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Anthropic API ${resp.status}: ${errText.slice(0, 300)}`);
    }

    const data = await resp.json() as any;
    const content = data.content ?? [];

    let textContent = "";
    const toolCalls: ToolCall[] = [];
    for (const block of content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id ?? "", name: block.name ?? "", arguments: block.input ?? {} });
      }
    }

    return {
      content: textContent,
      reasoningContent: "",
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
      } : {},
      finishReason: data.stop_reason ?? "end_turn",
      toolCalls,
    };
  }

  async chatStream(
    messages: Array<{ role: string; content: string }>,
    temperature = 0.7,
    maxTokens = 4096,
    _tools?: any,
    onDelta?: (text: string) => Promise<void>,
    modelOverride = "",
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    const model = modelOverride || this.model;

    const systemMsg = messages.find(m => m.role === "system");
    const chatMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const anthropicTools = _tools?.map((t: any) => ({
      name: t.function?.name ?? t.name,
      description: t.function?.description ?? t.description,
      input_schema: t.function?.parameters ?? t.input_schema ?? { type: "object", properties: {} },
    }));

    const body: Record<string, unknown> = {
      model,
      messages: chatMessages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    };
    if (systemMsg) body.system = systemMsg.content;
    if (anthropicTools?.length) body.tools = anthropicTools;

    const resp = await fetch(this.url(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Anthropic API ${resp.status}: ${errText.slice(0, 300)}`);
    }

    let content = "";
    let finishReason = "end_turn";
    let usage: Record<string, number> = {};
    const toolUseAcc: Map<number, { id: string; name: string; input: string }> = new Map();

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
                if (onDelta) await onDelta(event.delta.text);
              } else if (event.delta?.type === "input_json_delta" && event.delta.partial_json) {
                const idx = event.index ?? 0;
                if (!toolUseAcc.has(idx)) toolUseAcc.set(idx, { id: "", name: "", input: "" });
                toolUseAcc.get(idx)!.input += event.delta.partial_json;
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

    return { content, reasoningContent: "", usage, finishReason, toolCalls };
  }
}
