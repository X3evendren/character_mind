/**
 * Subagent Memory — isolated working memory for background tasks.
 *
 * Subagents get a fresh, empty working memory. After execution, only the
 * conclusion is returned to the main agent. Tool call history is recorded
 * for transparency but discarded after the task completes.
 */

import type { SubagentResult } from "./types";

export interface MemoryEntry {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
}

/**
 * Lightweight in-memory conversation buffer for subagent execution.
 * Not persisted — subagent memory is ephemeral.
 */
export class SubagentMemory {
  private entries: MemoryEntry[] = [];
  private _conclusion = "";

  /** Add a message to the conversation history */
  push(entry: MemoryEntry): void {
    this.entries.push(entry);
  }

  /** Get all messages for the LLM context */
  getMessages(): MemoryEntry[] {
    return [...this.entries];
  }

  /** Get the raw conversation for tool result aggregation */
  getConversation(): ReadonlyArray<MemoryEntry> {
    return this.entries;
  }

  /** Extract tool calls from the conversation */
  getToolCallHistory(): SubagentResult["toolCalls"] {
    const results: SubagentResult["toolCalls"] = [];
    for (const entry of this.entries) {
      if (entry.role === "tool") {
        // Tool results come after assistant entries with tool_calls
        // We match them by looking at the previous assistant entry
        const prevIdx = this.entries.indexOf(entry) - 1;
        const prev = prevIdx >= 0 ? this.entries[prevIdx] : null;
        if (prev?.toolCalls) {
          for (const tc of prev.toolCalls) {
            results.push({
              tool: tc.name,
              args: safeParseJson(tc.arguments),
              success: !entry.content.startsWith("Error:"),
              output: entry.content,
              error: entry.content.startsWith("Error:") ? entry.content : undefined,
            });
          }
        }
      }
    }
    return results;
  }

  /** Set the final conclusion (last assistant message) */
  set conclusion(text: string) {
    this._conclusion = text;
  }

  get conclusion(): string {
    return this._conclusion;
  }

  /** Number of user+assistant turns (not system/tool) */
  get turnCount(): number {
    let count = 0;
    for (const e of this.entries) {
      if (e.role === "user" || e.role === "assistant") count++;
    }
    return Math.ceil(count / 2); // each turn = user + assistant pair
  }

  /** Clear all memory */
  reset(): void {
    this.entries = [];
    this._conclusion = "";
  }
}

function safeParseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}
