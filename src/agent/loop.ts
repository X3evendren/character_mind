import type { CharacterAgent } from './agent';
/** Elapsed-time relaxation, using the same cognitive state as the turn pipeline. */
export class ContinuousLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private readonly intervalMs = 30000) {}
  start(agent: CharacterAgent): void {
    if (this.timer) return;
    this.timer = setInterval(() => agent.cognition.advance(), this.intervalMs);
    this.timer.unref();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
  get running(): boolean { return this.timer !== null; }
}
