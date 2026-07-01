/**
 * Cron Types — scheduled task definitions.
 *
 * Ported from nanobot/cron/types.py, extended with cognitive event payloads.
 */

// ═══════════════════════════════════════════════════════════════
// Schedule
// ═══════════════════════════════════════════════════════════════

export interface CronSchedule {
  /** "at": one-shot at timestamp | "every": recurring interval | "cron": cron expression */
  kind: "at" | "every" | "cron";
  /** For "at": Unix timestamp in ms */
  atMs?: number;
  /** For "every": interval in ms */
  everyMs?: number;
  /** For "cron": standard cron expression, e.g. "0 9 * * *" */
  expr?: string;
  /** Timezone for cron expressions (IANA tz name) */
  tz?: string;
}

// ═══════════════════════════════════════════════════════════════
// Payload — what to do when the job fires
// ═══════════════════════════════════════════════════════════════

export type CronPayloadKind = "system_event" | "agent_turn" | "cognitive_event";

export interface CronPayload {
  kind: CronPayloadKind;
  /** For "agent_turn": the message to inject into the agent's turn pipeline */
  message?: string;
  /** For "cognitive_event": which cognitive module to trigger */
  cognitiveEvent?: CognitiveEvent;
}

/**
 * Cognitive events — trigger internal agent processes rather than
 * sending external messages.
 */
export interface CognitiveEvent {
  /** Module to trigger */
  module: "drive_check" | "deep_reflection" | "boredom_check" | "horizon_review" | "memory_consolidation" | "mood_update";
  /** Additional parameters for the module */
  params?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// Job & State
// ═══════════════════════════════════════════════════════════════

export interface CronRunRecord {
  runAtMs: number;
  status: "ok" | "error" | "skipped";
  durationMs: number;
  error?: string;
}

export interface CronJobState {
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: CronRunRecord["status"] | null;
  lastError: string | null;
  runHistory: CronRunRecord[];
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  state: CronJobState;
  createdAtMs: number;
  updatedAtMs: number;
  /** Auto-delete after a single successful run */
  deleteAfterRun: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Store (persistence)
// ═══════════════════════════════════════════════════════════════

export interface CronStore {
  version: number;
  jobs: CronJob[];
}

// ═══════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════

/** Generate a unique cron job ID */
let _jobCounter = 0;
export function nextJobId(): string {
  return `cron_${++_jobCounter}_${Date.now().toString(36)}`;
}
