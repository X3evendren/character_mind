/**
 * Subagent Types — background task delegation system.
 *
 * Subagents are tool-only workers with no personality. They receive an
 * instruction, execute tools in a loop, and return a concise result.
 * The main consciousness remains the sole personality-bearing entity.
 */

import type { ToolDef, ToolContext, ToolResult } from "../tools/types";

// ═══════════════════════════════════════════════════════════════
// Task definition
// ═══════════════════════════════════════════════════════════════

export interface SubagentTask {
  /** Unique task ID (auto-generated if not provided) */
  id: string;
  /** Natural-language instruction for the subagent */
  instruction: string;
  /** Additional context (file contents, memory records, etc.) */
  context?: string;
  /** Which tools the subagent can use. "all" or a list of tool names. Default: read-only tools */
  toolPolicy: "all" | "readonly" | string[];
  /** Maximum conversation turns before forced termination (default: 5) */
  maxTurns: number;
  /** Hard timeout in milliseconds (default: 60_000) */
  timeoutMs: number;
  /** Filesystem isolation mode (default: "shared") */
  isolation: "shared" | "worktree";
}

export type SubagentStatus = "pending" | "running" | "done" | "error" | "timeout" | "cancelled";

// ═══════════════════════════════════════════════════════════════
// Result
// ═══════════════════════════════════════════════════════════════

export interface SubagentResult {
  taskId: string;
  status: SubagentStatus;
  /** The subagent's conclusion (concise summary of findings) */
  output: string;
  /** Individual tool call results for transparency */
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    success: boolean;
    output: string;
    error?: string;
  }>;
  /** Number of LLM turns consumed */
  turns: number;
  /** Wall-clock elapsed time in ms */
  elapsedMs: number;
  /** Error message if status is "error" */
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// State (for monitoring)
// ═══════════════════════════════════════════════════════════════

export interface SubagentState {
  task: SubagentTask;
  status: SubagentStatus;
  startedAt: number;
  completedAt?: number;
  turns: number;
  lastActivity?: string; // human-readable last action
}

// ═══════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_MAX_TURNS = 5;
export const DEFAULT_TIMEOUT_MS = 60_000;

let _taskCounter = 0;
export function nextTaskId(): string {
  return `sub_${++_taskCounter}_${Date.now().toString(36)}`;
}
