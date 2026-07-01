import { describe, it, expect } from "vitest";
import { reduceTurnEvent, type ChatState } from "./chat-store";
import type { TurnEvent } from "../../agent/events";

function freshState(): ChatState {
  return {
    messages: [],
    statusText: "",
    isGenerating: false,
    notifications: [],
    pendingToolCalls: new Map(),
    turnStartMs: null,
    nextMsgId: 0,
  };
}

describe("reduceTurnEvent", () => {
  it("phase_start sets statusText", () => {
    const s = reduceTurnEvent(freshState(), { type: "phase_start", phase: "generate", ts: 1 });
    expect(s.statusText).toBe("generate...");
    expect(s.isGenerating).toBe(true);
  });

  it("text_delta appends to last assistant message", () => {
    let s = freshState();
    s = reduceTurnEvent(s, { type: "text_delta", text: "Hello" });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe("assistant");
    expect(s.messages[0].content).toBe("Hello");
    s = reduceTurnEvent(s, { type: "text_delta", text: " world" });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].content).toBe("Hello world");
  });

  it("text_delta creates new assistant message if last is not assistant", () => {
    let s = freshState();
    s = { ...s, messages: [{ id: "m0", role: "user", content: "hi", timestamp: 0 }] };
    s = reduceTurnEvent(s, { type: "text_delta", text: "reply" });
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1].role).toBe("assistant");
    expect(s.messages[1].content).toBe("reply");
  });

  it("tool_start then tool_end pairs by callId", () => {
    let s = freshState();
    s = reduceTurnEvent(s, { type: "tool_start", callId: "c1", tool: "web_search", args: { q: "test" } });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe("tool");
    expect(s.messages[0].toolCall?.success).toBe(false);
    s = reduceTurnEvent(s, { type: "tool_end", callId: "c1", tool: "web_search", success: true, outputPreview: "result", durationMs: 100, truncated: false });
    expect(s.messages[0].toolCall?.success).toBe(true);
    expect(s.messages[0].toolCall?.durationMs).toBe(100);
    expect(s.pendingToolCalls.size).toBe(0);
  });

  it("done clears isGenerating and pendingToolCalls", () => {
    let s = freshState();
    s = { ...s, isGenerating: true, pendingToolCalls: new Map([["c1", "m0"]]), turnStartMs: 1000 };
    s = reduceTurnEvent(s, { type: "done", turnId: 1, elapsedMs: 2000, totalTokens: 50 });
    expect(s.isGenerating).toBe(false);
    expect(s.pendingToolCalls.size).toBe(0);
    expect(s.turnStartMs).toBeNull();
  });

  it("error adds notification", () => {
    let s = freshState();
    s = reduceTurnEvent(s, { type: "error", phase: "generate", message: "boom", recoverable: false });
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications[0].type).toBe("error");
  });
});