/**
 * Cron Scheduler — cognitive clock for the agent.
 *
 * Schedules internal cognitive events (drive checks, deep reflection,
 * boredom detection, etc.) and external agent turns (timed messages).
 */

export { CronService, type CronCallback } from "./service";
export { CronJobStore } from "./store";
export {
  registerCognitiveTriggers,
  DEFAULT_COGNITIVE_SCHEDULE,
} from "./cognitive-trigger";

export type { CognitiveTriggerConfig } from "./cognitive-trigger";
export type {
  CronSchedule,
  CronPayload,
  CronJob,
  CronJobState,
  CronRunRecord,
  CronStore,
  CognitiveEvent,
  CronPayloadKind,
} from "./types";
