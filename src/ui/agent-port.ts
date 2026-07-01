/**
 * AgentPort — UI 层依赖的 agent 接口（解耦缝）。
 * UI 只用这 5 个方法，不依赖 CharacterAgent 具体类。
 * 测试时注入 MockAgent implements AgentPort。
 */
import type { TurnEvent, RunOptions } from "../agent/events";
import type { CharacterAgent } from "../agent/agent";

export type AgentSnapshot = ReturnType<CharacterAgent["getStateSnapshot"]>;

export interface AgentPort {
  runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent>;
  getStateSnapshot(): AgentSnapshot;
  shutdown(): Promise<void>;
  restoreFromCheckpoint(data: unknown): Promise<void>;
  readonly config: { name: string };
}