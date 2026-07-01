/**
 * Agent Store — 心智快照，2s 轮询兜底 + turn 事件即时刷新。
 */
import { create } from "zustand";
import type { AgentPort, AgentSnapshot } from "../agent-port";

interface AgentStoreState {
  agent: AgentPort | null;
  snapshot: AgentSnapshot | null;
  setAgent: (agent: AgentPort | null) => void;
  refreshNow: () => void;
  startPolling: (agent: AgentPort) => void;
  stopPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agent: null,
  snapshot: null,
  setAgent: (agent) => {
    set({ agent });
    if (agent) get().startPolling(agent);
    else get().stopPolling();
  },
  refreshNow: () => {
    const agent = get().agent;
    if (!agent) return;
    try {
      set({ snapshot: agent.getStateSnapshot() });
    } catch {
      // 快照拉取失败不应崩溃 UI
    }
  },
  startPolling: (agent) => {
    if (pollTimer) clearInterval(pollTimer);
    // 立即拉一次
    try { set({ snapshot: agent.getStateSnapshot() }); } catch { /* noop */ }
    // 2s 兜底轮询（捕获 ContinuousLoop 30s tick 的静默状态变化）
    pollTimer = setInterval(() => get().refreshNow(), 2000);
  },
  stopPolling: () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },
}));