import { describe, it, expect } from "vitest";
import { reduceTurnEvent, type ChatState } from "./chat-store";

function freshState(): ChatState {
  return {
    turns: [], currentTurnId: null, isGenerating: false, statusText: "",
    notifications: [], debugMode: false, pendingToolCalls: new Map(),
    turnStartMs: null, nextTurnId: 0, nextBlockId: 0,
  };
}

function stateWithTurn(state: ChatState): ChatState {
  const turn = {
    id: "turn_1", turnId: 0,
    userMessage: { content: "hi", timestamp: Date.now() },
    blocks: [], status: "streaming" as const, timestamp: Date.now(),
  };
  return { ...state, turns: [turn], currentTurnId: "turn_1", isGenerating: true, turnStartMs: Date.now() };
}

describe("reduceTurnEvent", () => {
  it("phase_start sets isGenerating and statusText", () => {
    const s = reduceTurnEvent(stateWithTurn(freshState()), { type: "phase_start", phase: "generate", ts: 1 });
    expect(s.isGenerating).toBe(true);
    expect(s.statusText).toContain("generate");
  });

  it("text_delta creates final block if none exists", () => {
    let s = stateWithTurn(freshState());
    s = reduceTurnEvent(s, { type: "text_delta", text: "Hello" });
    const turn = s.turns[0];
    expect(turn.blocks).toHaveLength(1);
    expect(turn.blocks[0].type).toBe("final");
    expect(turn.blocks[0].content).toBe("Hello");
    expect(turn.blocks[0].status).toBe("streaming");
  });

  it("text_delta appends to existing final block", () => {
    let s = stateWithTurn(freshState());
    s = reduceTurnEvent(s, { type: "text_delta", text: "Hello" });
    s = reduceTurnEvent(s, { type: "text_delta", text: " world" });
    const turn = s.turns[0];
    expect(turn.blocks).toHaveLength(1);
    expect(turn.blocks[0].content).toBe("Hello world");
  });

  it("tool_start creates tool_call block, tool_end updates it", () => {
    let s = stateWithTurn(freshState());
    s = reduceTurnEvent(s, { type: "tool_start", callId: "c1", tool: "web_search", args: { q: "test" } });
    const turn = s.turns[0];
    expect(turn.blocks).toHaveLength(1);
    expect(turn.blocks[0].type).toBe("tool_call");
    expect(turn.blocks[0].status).toBe("streaming");
    expect(s.pendingToolCalls.has("c1")).toBe(true);

    s = reduceTurnEvent(s, { type: "tool_end", callId: "c1", tool: "web_search", success: true, outputPreview: "result", durationMs: 100, truncated: false });
    const block = s.turns[0].blocks[0];
    expect(block.toolSuccess).toBe(true);
    expect(block.toolResult).toBe("result");
    expect(block.durationMs).toBe(100);
    expect(block.status).toBe("done");
    expect(s.pendingToolCalls.has("c1")).toBe(false);
  });

  it("reasoning creates collapsed reasoning block", () => {
    let s = stateWithTurn(freshState());
    s = reduceTurnEvent(s, { type: "reasoning", text: "hmm", ts: 1 });
    const block = s.turns[0].blocks[0];
    expect(block.type).toBe("reasoning");
    expect(block.collapsed).toBe(true);
    expect(block.content).toBe("hmm");
  });

  it("done marks turn completed and clears isGenerating", () => {
    let s = stateWithTurn(freshState());
    s = reduceTurnEvent(s, { type: "done", turnId: 1, elapsedMs: 2000, totalTokens: 50 });
    const turn = s.turns[0];
    expect(turn.status).toBe("completed");
    expect(turn.elapsedMs).toBe(2000);
    expect(turn.totalTokens).toBe(50);
    expect(s.isGenerating).toBe(false);
    expect(s.currentTurnId).toBeNull();  // turn closed
  });

  it("error marks turn interrupted and adds notification", () => {
    let s = stateWithTurn(freshState());
    s = reduceTurnEvent(s, { type: "error", phase: "generate", message: "boom", recoverable: false });
    const turn = s.turns[0];
    expect(turn.status).toBe("interrupted");
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications[0].type).toBe("error");
    expect(s.isGenerating).toBe(false);
  });
});
