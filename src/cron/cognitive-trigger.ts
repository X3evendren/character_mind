/**
 * CognitiveCronTrigger — bridge between cron scheduler and cognitive modules.
 *
 * Instead of sending messages, cron fires cognitive events that drive
 * internal agent processes:
 *
 *   drive_check     → drives.ts (check drive levels, initiate action if low)
 *   deep_reflection → deep-reflection.ts (nightly memory consolidation)
 *   boredom_check   → boredom.ts (if idle, trigger exploration)
 *   horizon_review  → horizon.ts (weekly goal review)
 *   memory_consolidation → metabolism.ts (sleep cycle daydream/consolidation)
 *   mood_update     → mood.ts (periodic mood recalculation)
 */

import type { CronService, CronCallback } from "./service";
import type { CronJob } from "./types";

export interface CognitiveTriggerConfig {
  /** Interval for drive checks (default: 30 min) */
  driveCheckMs?: number;
  /** Cron expression for deep reflection (default: "0 3 * * *" — 3 AM daily) */
  deepReflectionCron?: string;
  /** Interval for boredom checks (default: 5 min) */
  boredomCheckMs?: number;
  /** Cron expression for horizon review (default: "0 10 * * 0" — Sunday 10 AM) */
  horizonReviewCron?: string;
  /** Interval for memory consolidation (default: 15 min) */
  memoryConsolidationMs?: number;
  /** Interval for mood update (default: 2 min) */
  moodUpdateMs?: number;
}

export const DEFAULT_COGNITIVE_SCHEDULE: Required<CognitiveTriggerConfig> = {
  driveCheckMs: 30 * 60 * 1000,       // 30 min
  deepReflectionCron: "0 3 * * *",     // 3 AM daily
  boredomCheckMs: 5 * 60 * 1000,       // 5 min
  horizonReviewCron: "0 10 * * 0",     // Sunday 10 AM
  memoryConsolidationMs: 15 * 60 * 1000, // 15 min
  moodUpdateMs: 2 * 60 * 1000,         // 2 min
};

/**
 * Register cognitive trigger jobs on a CronService.
 *
 * Each cognitive event is registered as a cron job. The caller provides
 * a single handler that receives the CognitiveEvent payload and dispatches
 * to the appropriate cognitive module.
 */
export function registerCognitiveTriggers(
  cron: CronService,
  handler: (job: CronJob) => Promise<void>,
  config: CognitiveTriggerConfig = {},
): void {
  const cfg = { ...DEFAULT_COGNITIVE_SCHEDULE, ...config };

  // Drive check — every N minutes
  cron.addJob({
    name: "cognitive:drive_check",
    schedule: { kind: "every", everyMs: cfg.driveCheckMs },
    payload: {
      kind: "cognitive_event",
      cognitiveEvent: { module: "drive_check" },
    },
  });

  // Deep reflection — nightly (3 AM)
  cron.addJob({
    name: "cognitive:deep_reflection",
    schedule: { kind: "cron", expr: cfg.deepReflectionCron },
    payload: {
      kind: "cognitive_event",
      cognitiveEvent: {
        module: "deep_reflection",
        params: { trigger: "scheduled", depth: "full" },
      },
    },
  });

  // Boredom check — every N minutes
  cron.addJob({
    name: "cognitive:boredom_check",
    schedule: { kind: "every", everyMs: cfg.boredomCheckMs },
    payload: {
      kind: "cognitive_event",
      cognitiveEvent: { module: "boredom_check" },
    },
  });

  // Horizon review — weekly (Sunday 10 AM)
  cron.addJob({
    name: "cognitive:horizon_review",
    schedule: { kind: "cron", expr: cfg.horizonReviewCron },
    payload: {
      kind: "cognitive_event",
      cognitiveEvent: { module: "horizon_review" },
    },
  });

  // Memory consolidation — periodic
  cron.addJob({
    name: "cognitive:memory_consolidation",
    schedule: { kind: "every", everyMs: cfg.memoryConsolidationMs },
    payload: {
      kind: "cognitive_event",
      cognitiveEvent: { module: "memory_consolidation" },
    },
  });

  // Mood update — frequent
  cron.addJob({
    name: "cognitive:mood_update",
    schedule: { kind: "every", everyMs: cfg.moodUpdateMs },
    payload: {
      kind: "cognitive_event",
      cognitiveEvent: { module: "mood_update" },
    },
  });

  // Register the global handler
  cron.onAll(handler);
}
