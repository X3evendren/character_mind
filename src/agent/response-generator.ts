/** Response generation and tool execution, after the cognitive state update. */
import type { SpanOp } from "../generation/types";
import type { ToolRegistry } from "../tools/registry";
import type { ToolCall } from "./provider";
import type { Tracer } from "../telemetry";
import type { TurnEvent } from './events';
type ToolEvent = Extract<TurnEvent, { type: 'tool_start' | 'tool_end' }>;

let _nextSpanId = 1;
function nextSpanId(): string { return `s${_nextSpanId++}`; }

interface StreamToken { text: string; done: boolean; toolCalls?: ToolCall[]; reasoningContent?: string; }
const SENTENCE_END = /[。！？\n]/g;
const MIN_SENTENCE_LEN = 4;

/** Find the last sentence-ending position in the buffer.
 *  Returns the split point (chars to yield) or -1 if no boundary found. */
function findSentenceSplit(text: string): number {
  if (text.length < MIN_SENTENCE_LEN) return -1;
  let lastIdx = -1;
  let m: RegExpExecArray | null;
  SENTENCE_END.lastIndex = 0;
  while ((m = SENTENCE_END.exec(text)) !== null) {
    lastIdx = m.index + 1; // include the sentence-end char
  }
  return lastIdx;
}

/** Convert callback-based chatStream to async iterator with abort support. */
async function* streamTokens(
  provider: any, messages: any[], temperature: number, maxTokens: number,
  tools: any, signal: AbortSignal, model: string,
): AsyncGenerator<StreamToken> {
  const buffer: string[] = [];
  let streamDone = false;
  let streamError: Error | null = null;
  let toolCalls: ToolCall[] = [];
  let reasoningContent = "";

  const promise = provider.chatStream(
    messages, temperature, maxTokens, tools,
    async (delta: string) => { buffer.push(delta); },
    model, signal,
  ).then((r: any) => { toolCalls = r.toolCalls ?? []; reasoningContent = r.reasoningContent ?? ""; streamDone = true; })
   .catch((e: Error) => { streamError = e; streamDone = true; });

  let idx = 0;
  while (!streamDone) {
    if (signal.aborted) break;
    while (idx < buffer.length) { yield { text: buffer[idx], done: false }; idx++; }
    await new Promise(r => setTimeout(r, 30));
  }
  while (idx < buffer.length) { yield { text: buffer[idx], done: false }; idx++; }
  if (streamError) throw streamError;
  yield { text: "", done: true, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, reasoningContent: reasoningContent || undefined };
}

export class ResponseGenerator {
  private fastProvider: any;
  private toolRegistry?: ToolRegistry;
  private tracer?: Tracer;
  private maxToolRounds = 10;
  onToolResult?: (call: ToolCall, result: { success: boolean; output: string; error?: string }) => void;

  constructor(fastProvider: any, toolRegistry?: ToolRegistry, tracer?: Tracer, private readonly model = '') {
    this.fastProvider = fastProvider;
    this.toolRegistry = toolRegistry;
    this.tracer = tracer;
  }

  async *generate(
    systemPrompt: string, userMessage: string, signal: AbortSignal,
    tools?: any, temperature = 0.6, maxTokens = 300,
  ): AsyncGenerator<SpanOp | ToolEvent> {
    const effectiveTools = tools ?? this.toolRegistry?.getDefinitions();
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    for (let round = 0; round < this.maxToolRounds && !signal.aborted; round++) {
      const lastToken: StreamToken = { text: "", done: false };
      let buffer = "";
      let assistantContent = "";
      let startPos = 0;

      const chatTTFT = performance.now();
      let firstToken = true;
      let ttftMs = 0;

      for await (const token of streamTokens(
        this.fastProvider, messages, temperature, maxTokens, effectiveTools, signal, this.model,
      )) {
        if (signal.aborted) break;
        if (firstToken && token.text) {
          ttftMs = performance.now() - chatTTFT;
          firstToken = false;
        }
        if (token.done) { Object.assign(lastToken, token); break; }
        if (token.text) {
          assistantContent += token.text;
          buffer += token.text;
          // Yield all complete sentences from the buffer, keep the trailing fragment
          let splitPoint: number;
          while ((splitPoint = findSentenceSplit(buffer)) > 0) {
            const sentence = buffer.slice(0, splitPoint);
            buffer = buffer.slice(splitPoint);
            const spanId = nextSpanId();
            const endPos = startPos + sentence.length;
            yield { type: "append", span: { id: spanId, layer: "fluid", text: sentence, startPos, endPos } };
            yield { type: "lock", spanId };
            startPos = endPos;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim() && !signal.aborted) {
        const spanId = nextSpanId();
        yield { type: "append", span: { id: spanId, layer: "fluid", text: buffer, startPos, endPos: startPos + buffer.length } };
        yield { type: "lock", spanId };
      }

      // Record chat span
      const chatLatency = performance.now() - chatTTFT;
      this.tracer?.recordChat(
        this.model || this.fastProvider.model || "unknown",
        { totalTokens: 0 },
        ttftMs, chatLatency,
      );

      if (signal.aborted) return;

      // Tool calls?
      const toolCalls = lastToken.toolCalls;
      if (!toolCalls || toolCalls.length === 0) break;
      if (!this.toolRegistry) break;

      const assistantMsg: any = { role: "assistant", content: assistantContent || null };
      if (lastToken.reasoningContent) assistantMsg.reasoning_content = lastToken.reasoningContent;
      assistantMsg.tool_calls = toolCalls.map((tc: ToolCall) => ({
        id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
      messages.push(assistantMsg);

      for (const tc of toolCalls) {
        signal.throwIfAborted();
        yield { type: 'tool_start', callId: tc.id, tool: tc.name, args: tc.arguments };
        const toolStart = performance.now();
        const result = await this.toolRegistry.execute(tc.name, tc.arguments, {
          workingDir: process.cwd(), sessionId: "", signal,
        });
        const toolDur = performance.now() - toolStart;
        this.tracer?.recordToolCall(tc.name, tc.arguments, {
          success: result.success,
          output: result.output,
          error: result.error,
        }, toolDur, result.truncated);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result.output });
        this.onToolResult?.(tc, result);
        yield { type: 'tool_end', callId: tc.id, tool: tc.name, success: result.success, outputPreview: result.output.slice(0, 2000), durationMs: toolDur, truncated: result.truncated || result.output.length > 2000 };
      }
    }
  }
}
