/**
 * CronService — runtime cron scheduler.
 *
 * Manages cron job registration, scheduling (setTimeout loop),
 * execution, and persistence.
 *
 * Ported from nanobot/cron/service.py.
 */

import type {
  CronJob,
  CronJobState,
  CronSchedule,
  CronRunRecord,
} from "./types";
import { nextJobId } from "./types";
import { CronJobStore } from "./store";

export type CronCallback = (job: CronJob) => Promise<void>;

export class CronService {
  private store: CronJobStore;
  private jobs = new Map<string, CronJob>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private callbacks = new Map<string, CronCallback[]>();
  private running = false;
  private tickInterval = 30_000; // check every 30s
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(baseDir: string) {
    this.store = new CronJobStore(baseDir);
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  start(): void {
    if (this.running) return;

    // Load persisted jobs
    const store = this.store.load();
    for (const job of store.jobs) {
      this.jobs.set(job.id, job);
      this.scheduleNext(job);
    }

    this.running = true;

    // Periodic tick: recompute next-run times
    this.tickTimer = setInterval(() => {
      for (const job of this.jobs.values()) {
        if (job.enabled && !this.timers.has(job.id)) {
          this.scheduleNext(job);
        }
      }
    }, this.tickInterval);
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Persist state
    this.persist();
  }

  // ═══════════════════════════════════════════════════════════
  // Job management
  // ═══════════════════════════════════════════════════════════

  /** Register a new cron job */
  addJob(job: Partial<CronJob> & { schedule: CronSchedule; payload: CronJob["payload"] }): CronJob {
    const full: CronJob = {
      id: job.id ?? nextJobId(),
      name: job.name ?? "unnamed",
      enabled: job.enabled ?? true,
      schedule: job.schedule,
      payload: job.payload,
      state: {
        nextRunAtMs: null,
        lastRunAtMs: null,
        lastStatus: null,
        lastError: null,
        runHistory: [],
      },
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      deleteAfterRun: job.deleteAfterRun ?? false,
    };

    this.jobs.set(full.id, full);
    // Compute next run time immediately (even before start)
    full.state.nextRunAtMs = this.computeNextRun(full.schedule);
    if (this.running && full.enabled) {
      this.scheduleNext(full);
    }
    this.persist();

    return full;
  }

  /** Remove a cron job */
  removeJob(id: string): boolean {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    const existed = this.jobs.delete(id);
    if (existed) this.persist();
    return existed;
  }

  /** Enable/disable a job */
  setEnabled(id: string, enabled: boolean): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.enabled = enabled;
    job.updatedAtMs = Date.now();

    if (enabled) {
      this.scheduleNext(job);
    } else {
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    }

    this.persist();
    return true;
  }

  /** Register a callback for a specific job */
  on(id: string, callback: CronCallback): void {
    const cbs = this.callbacks.get(id) ?? [];
    cbs.push(callback);
    this.callbacks.set(id, cbs);
  }

  /** Register a global callback (fires for every job) */
  onAll(callback: CronCallback): void {
    // Store with special key
    const cbs = this.callbacks.get("__all__") ?? [];
    cbs.push(callback);
    this.callbacks.set("__all__", cbs);
  }

  /** List all jobs */
  list(): CronJob[] {
    return [...this.jobs.values()];
  }

  /** Get a specific job */
  get(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  // ═══════════════════════════════════════════════════════════
  // Scheduling
  // ═══════════════════════════════════════════════════════════

  private scheduleNext(job: CronJob): void {
    const nextRun = this.computeNextRun(job.schedule);
    if (nextRun === null) {
      job.state.nextRunAtMs = null;
      return;
    }

    job.state.nextRunAtMs = nextRun;

    const delay = Math.max(0, nextRun - Date.now());
    const timer = setTimeout(() => {
      this.fireJob(job.id);
    }, delay);

    this.timers.set(job.id, timer);
  }

  private async fireJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || !job.enabled) return;

    this.timers.delete(id);

    const startTime = Date.now();
    let record: CronRunRecord = { runAtMs: startTime, status: "ok", durationMs: 0 };

    try {
      // Fire global callbacks
      const globalCallbacks = this.callbacks.get("__all__") ?? [];
      for (const cb of globalCallbacks) {
        await cb(job);
      }

      // Fire job-specific callbacks
      const jobCallbacks = this.callbacks.get(id) ?? [];
      for (const cb of jobCallbacks) {
        await cb(job);
      }
    } catch (err: any) {
      record.status = "error";
      record.error = err?.message ?? "unknown error";
      job.state.lastError = record.error;
    }

    record.durationMs = Date.now() - startTime;

    // Update state
    job.state.lastRunAtMs = startTime;
    job.state.lastStatus = record.status;
    job.state.runHistory.push(record);

    // Keep only last 100 runs
    if (job.state.runHistory.length > 100) {
      job.state.runHistory = job.state.runHistory.slice(-100);
    }

    // Auto-delete?
    if (job.deleteAfterRun && record.status === "ok") {
      this.removeJob(id);
      return;
    }

    // Schedule next run
    this.scheduleNext(job);
    this.persist();
  }

  private computeNextRun(schedule: CronSchedule): number | null {
    const now = Date.now();

    if (schedule.kind === "at") {
      return schedule.atMs && schedule.atMs > now ? schedule.atMs : null;
    }

    if (schedule.kind === "every") {
      if (!schedule.everyMs || schedule.everyMs <= 0) return null;
      // Next interval from now
      return now + schedule.everyMs;
    }

    if (schedule.kind === "cron" && schedule.expr) {
      return this.parseCronNext(schedule.expr, now);
    }

    return null;
  }

  // Simple cron expression parser for common patterns.
  // Supports: "star-slash-N" (every N minutes), "M H * * *" (daily at H:M).
  // For full cron support (croniter), install the cron npm package.
  private parseCronNext(expr: string, nowMs: number): number | null {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minute, hour] = parts;
    const now = new Date(nowMs);

    // "*/15 * * * *" → every 15 minutes
    if (minute.startsWith("*/") && hour === "*") {
      const interval = parseInt(minute.slice(2));
      if (isNaN(interval) || interval <= 0) return null;
      const currentMin = now.getMinutes();
      const nextMin = Math.ceil(currentMin / interval) * interval;
      const next = new Date(now);
      next.setMinutes(nextMin, 0, 0);
      if (next.getTime() <= nowMs) {
        next.setMinutes(next.getMinutes() + interval);
      }
      return next.getTime();
    }

    // "0 9 * * *" → daily at 09:00
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
      const m = parseInt(minute);
      const h = parseInt(hour);
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= nowMs) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    // Default: every 30 minutes
    return nowMs + 30 * 60 * 1000;
  }

  // ═══════════════════════════════════════════════════════════
  // Persistence
  // ═══════════════════════════════════════════════════════════

  private persist(): void {
    this.store.save({
      version: 1,
      jobs: [...this.jobs.values()],
    });
  }
}
