import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { CharacterAgent } from "../agent/agent";

export type AgentSnapshot = ReturnType<CharacterAgent["getStateSnapshot"]>;

interface AgentStateValue {
  agent: CharacterAgent | null;
  snapshot: AgentSnapshot | null;
}

const AgentStateContext = createContext<AgentStateValue>({ agent: null, snapshot: null });

export function AgentStateProvider({ agent, children }: { agent: CharacterAgent | null; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!agent) return;
    setSnapshot(agent.getStateSnapshot());
    intervalRef.current = setInterval(() => setSnapshot(agent.getStateSnapshot()), 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [agent]);

  return React.createElement(AgentStateContext.Provider, { value: { agent, snapshot } }, children);
}

export function useAgentSnapshot(): AgentSnapshot | null {
  return useContext(AgentStateContext).snapshot;
}
export function useAgent(): CharacterAgent | null {
  return useContext(AgentStateContext).agent;
}
