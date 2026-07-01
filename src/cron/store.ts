/**
 * CronStore — persistent storage for cron jobs.
 *
 * Saves to a JSON file. Thread-safe via serialized writes.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import type { CronStore, CronJob } from "./types";

export class CronJobStore {
  private filePath: string;

  constructor(baseDir: string) {
    this.filePath = join(baseDir, "cron_jobs.json");
  }

  /** Load all jobs from disk */
  load(): CronStore {
    try {
      if (!existsSync(this.filePath)) {
        return { version: 1, jobs: [] };
      }
      const raw = readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(raw) as CronStore;
      // Normalize: ensure all fields exist
      data.jobs = (data.jobs ?? []).map(j => this.normalizeJob(j));
      return data;
    } catch (err: any) {
      console.warn(`[cron] Failed to load cron store: ${err.message}`);
      return { version: 1, jobs: [] };
    }
  }

  /** Save all jobs to disk */
  save(store: CronStore): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, JSON.stringify(store, null, 2), "utf-8");
    } catch (err: any) {
      console.error(`[cron] Failed to save cron store: ${err.message}`);
    }
  }

  private normalizeJob(j: any): CronJob {
    return {
      id: j.id ?? "",
      name: j.name ?? "unnamed",
      enabled: j.enabled ?? true,
      schedule: {
        kind: j.schedule?.kind ?? "every",
        atMs: j.schedule?.atMs,
        everyMs: j.schedule?.everyMs,
        expr: j.schedule?.expr,
        tz: j.schedule?.tz,
      },
      payload: {
        kind: j.payload?.kind ?? "agent_turn",
        message: j.payload?.message,
        cognitiveEvent: j.payload?.cognitiveEvent,
      },
      state: {
        nextRunAtMs: j.state?.nextRunAtMs ?? null,
        lastRunAtMs: j.state?.lastRunAtMs ?? null,
        lastStatus: j.state?.lastStatus ?? null,
        lastError: j.state?.lastError ?? null,
        runHistory: j.state?.runHistory ?? [],
      },
      createdAtMs: j.createdAtMs ?? Date.now(),
      updatedAtMs: j.updatedAtMs ?? Date.now(),
      deleteAfterRun: j.deleteAfterRun ?? false,
    };
  }
}
