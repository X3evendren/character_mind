/**
 * useAnimationFrame — 共享时钟，所有订阅者复用单一 setInterval。
 * 模仿 @anthropic/ink 的 useAnimationFrame，用标准 Ink 实现。
 * 无可见动画时定时器完全停止，不空转。
 */
import { useState, useEffect, useRef } from "react";

/** 单例时钟 */
class SharedClock {
  private interval: ReturnType<typeof setInterval> | null = null;
  private time = 0;
  private subscribers = new Set<(time: number) => void>();
  private lastTick = 0;

  /** 订阅时钟。返回退订函数。 */
  subscribe(intervalMs: number, callback: (time: number) => void): () => void {
    this.subscribers.add(callback);
    this.ensureRunning(intervalMs);
    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  private ensureRunning(intervalMs: number) {
    if (this.interval) return;
    this.lastTick = Date.now();
    this.interval = setInterval(() => {
      const now = Date.now();
      this.time += now - this.lastTick;
      this.lastTick = now;
      for (const cb of this.subscribers) cb(this.time);
    }, intervalMs);
  }

  private stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getTime() { return this.time; }
}

const clock = new SharedClock();

/**
 * 订阅共享时钟。intervalMs=null 时退订(暂停动画)。
 * 返回当前时间(ms)。
 */
export function useAnimationFrame(intervalMs: number | null): number {
  const [time, setTime] = useState(() => clock.getTime());
  const callbackRef = useRef((t: number) => setTime(t));
  callbackRef.current = (t: number) => setTime(t);

  useEffect(() => {
    if (intervalMs === null) return;
    const unsub = clock.subscribe(intervalMs, (t) => callbackRef.current(t));
    return unsub;
  }, [intervalMs]);

  return time;
}