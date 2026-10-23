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
  | { type: "error"; phase: TurnPhase; message: string; recoverable: boolean }
  | { type: "done"; turnId: number; elapsedMs: number; totalTokens: number };

// ── Cognitive turn phases ──

export type TurnPhase =
  | "guard_input"
  | "appraise"
  | "decide"
  | "generate"
  | "guard_output"
  | "commit_memory";

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
