/**
 * AgentPort — UI 层依赖的 agent 接口（解耦缝）。
 * UI 通过此接口访问会话、快照和图谱，不依赖 CharacterAgent 具体类。
 * 测试时注入 MockAgent implements AgentPort。
 */
import type { TurnEvent, RunOptions } from "../agent/events";
import type { CharacterAgent } from "../agent/agent";
import type { KnowledgeGraph } from '../memory/knowledge-graph';

export type AgentSnapshot = ReturnType<CharacterAgent["getStateSnapshot"]>;

export interface AgentPort {
  runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent>;
  getStateSnapshot(): AgentSnapshot;
  shutdown(): Promise<void>;
  readonly config: { name: string };
  readonly graph: Pick<KnowledgeGraph, 'all' | 'get' | 'expand' | 'related' | 'interpretationContext'>;
  compressMemory(): Promise<string>;
  getModelInfo(): { generation: string; appraisal: string };
}
