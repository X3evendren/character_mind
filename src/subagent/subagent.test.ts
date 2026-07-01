/**
 * Subagent system tests.
 */
import { describe, it, expect } from "vitest";
import { SubagentMemory } from "./memory";
import { buildSubagentPrompt } from "./prompt";
import { createIsolation } from "./isolation";
import { DEFAULT_MAX_TURNS, DEFAULT_TIMEOUT_MS, nextTaskId } from "./types";

describe("SubagentMemory", () => {
  it("starts empty", () => {
    const m = new SubagentMemory();
    expect(m.getMessages()).toEqual([]);
    expect(m.turnCount).toBe(0);
    expect(m.conclusion).toBe("");
  });

  it("stores and retrieves messages", () => {
    const m = new SubagentMemory();
    m.push({ role: "system", content: "sys" });
    m.push({ role: "user", content: "hello" });
    m.push({ role: "assistant", content: "hi" });
    expect(m.getMessages().length).toBe(3);
  });

  it("counts turns correctly (user+assistant pairs)", () => {
    const m = new SubagentMemory();
    m.push({ role: "user", content: "q" });
    m.push({ role: "assistant", content: "a" });
    m.push({ role: "user", content: "q2" });
    m.push({ role: "assistant", content: "a2" });
    expect(m.turnCount).toBe(2);
  });

  it("ignores system and tool messages in turn count", () => {
    const m = new SubagentMemory();
    m.push({ role: "system", content: "sys" });
    m.push({ role: "user", content: "q" });
    m.push({ role: "assistant", content: "a", toolCalls: [{ id: "1", name: "t", arguments: "{}" }] });
    m.push({ role: "tool", content: "result", toolCallId: "1" });
    expect(m.turnCount).toBe(1);
  });

  it("extracts tool call history", () => {
    const m = new SubagentMemory();
    m.push({ role: "system", content: "sys" });
    m.push({ role: "user", content: "task" });
    m.push({
      role: "assistant",
      content: "doing...",
      toolCalls: [{ id: "1", name: "read_file", arguments: '{"path":"/test.txt"}' }],
    });
    m.push({ role: "tool", content: "file contents here", toolCallId: "1" });
    const history = m.getToolCallHistory();
    expect(history.length).toBe(1);
    expect(history[0].tool).toBe("read_file");
    expect(history[0].args.path).toBe("/test.txt");
    expect(history[0].success).toBe(true);
  });

  it("detects tool errors", () => {
    const m = new SubagentMemory();
    m.push({ role: "user", content: "task" });
    m.push({
      role: "assistant",
      content: "",
      toolCalls: [{ id: "1", name: "bad_tool", arguments: "{}" }],
    });
    m.push({ role: "tool", content: "Error: something went wrong", toolCallId: "1" });
    const history = m.getToolCallHistory();
    expect(history[0].success).toBe(false);
    expect(history[0].error).toContain("something went wrong");
  });

  it("supports set conclusion and reset", () => {
    const m = new SubagentMemory();
    m.conclusion = "task completed";
    expect(m.conclusion).toBe("task completed");
    m.reset();
    expect(m.getMessages().length).toBe(0);
    expect(m.conclusion).toBe("");
  });
});

describe("buildSubagentPrompt", () => {
  it("generates function-mode prompt without personality", () => {
    const prompt = buildSubagentPrompt(
      { id: "t1", instruction: "Find all .ts files", toolPolicy: "readonly", maxTurns: 3, timeoutMs: 10000, isolation: "shared" },
      [{ name: "search_files", description: "Search for files", parameters: {} as any, isReadOnly: true, isDestructive: false, isConcurrencySafe: true, riskLevel: "low", execute: async () => ({ success: true, output: "", truncated: false }), formatResult: (r: any) => r, formatError: (e: any) => e }],
    );
    expect(prompt).toContain("background task worker");
    expect(prompt).toContain("no personality");
    expect(prompt).toContain("Find all .ts files");
    expect(prompt).toContain("search_files");
    expect(prompt).toContain("Maximum 3 turns");
    // Should forbid emotional language (the instruction tells the model not to use these)
    expect(prompt).toContain('do not use "I feel"');
  });

  it("includes context when provided", () => {
    const prompt = buildSubagentPrompt(
      { id: "t1", instruction: "analyze", context: "some file content here", toolPolicy: "all", maxTurns: 5, timeoutMs: 10000, isolation: "shared" },
      [],
    );
    expect(prompt).toContain("some file content here");
    expect(prompt).toContain("## Context");
  });

  it("shows no-tools message when tools empty", () => {
    const prompt = buildSubagentPrompt(
      { id: "t1", instruction: "do nothing", toolPolicy: "readonly", maxTurns: 1, timeoutMs: 10000, isolation: "shared" },
      [],
    );
    expect(prompt).toContain("no tools available");
  });
});

describe("createIsolation", () => {
  it('shared mode returns current directory', () => {
    const ctx = createIsolation("shared");
    expect(ctx.workDir).toBe(process.cwd());
    expect(() => ctx.cleanup()).not.toThrow();
  });
});

describe("defaults", () => {
  it("DEFAULT_MAX_TURNS is 5", () => {
    expect(DEFAULT_MAX_TURNS).toBe(5);
  });

  it("DEFAULT_TIMEOUT_MS is 60s", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(60_000);
  });

  it("nextTaskId generates unique IDs", () => {
    const a = nextTaskId();
    const b = nextTaskId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^sub_\d+_/);
  });
});
