/**
 * Turn Event Protocol — structured transparency events yielded by agent.run().
 *
 * Replaces the old "agent.run(input, onDelta) → final text" black box with
 * a structured async generator that the UI consumes for live rendering.
 */

// ── TurnEvent discriminated union ──

export type TurnEvent =
  | { type: "phase_start"; phase: TurnPhase; ts: number }
  | { type: "phase_end"; phase: TurnPhase; ts: number; durationMs: number }
  | { type: "text_delta"; text: string }
  | { type: "reasoning"; text: string; ts: number }
  | { type: "tool_start"; callId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_end"; callId: string; tool: string; success: boolean; outputPreview: string; durationMs: number; truncated: boolean }
  | { type: "cold_layer_start"; layer: 0 | 1 | 2; name: string; ts: number }
  | { type: "cold_layer_end"; layer: 0 | 1 | 2; name: string; success: boolean; durationMs: number; summary: string }
  | { type: "cold_skipped"; reason: string }
  | { type: "error"; phase: TurnPhase; message: string; recoverable: boolean }
  | { type: "done"; turnId: number; elapsedMs: number; totalTokens: number };

// ── Turn phases (9 stages, strict order) ──

export type TurnPhase =
  | "guard_input"
  | "restore_memory"
  | "read_state"
  | "build_prompt"
  | "generate"
  | "guard_output"
  | "update_instant"
  | "cold_analyze"
  | "checkpoint";

// ── Cold analysis layer names (3-layer fusion model) ──

export const COLD_LAYER_NAMES: readonly [string, string, string] = [
  "冷回顾",
  "维度评估",
  "深度反思",
] as const;

// ── Run options ──

export interface RunOptions {
  signal?: AbortSignal;
}

export interface RunResult {
  turnId: number;
  response: string;
  totalTokens: number;
  elapsedMs: number;
}
