import { randomUUID } from 'node:crypto';
import type { ProcessState } from './process-state.ts';

export interface PhenomenonEvidence {
  intensity: number;
  support: number;
  sourceEventIds: string[];
  factors: Record<string, number>;
  basis: string[];
  regulationDemand: number;
}
export interface Phenomenon extends PhenomenonEvidence {
  id: string;
  kind: string;
  label: string;
  status: 'active' | 'fading' | 'resolved';
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  triggerEventIds: string[];
  ruleVersion: string;
  epistemicStatus: 'model_inference';
}
export interface PhenomenonRule {
  kind: string;
  label: string;
  version: string;
  evaluate(state: Readonly<ProcessState>): PhenomenonEvidence | undefined;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
const currentSource = (s: ProcessState) => s.sourceEventId ? [s.sourceEventId] : [];

/** Rules describe manifestations of process configurations, never clinical diagnoses. */
export const DEFAULT_PHENOMENON_RULES: readonly PhenomenonRule[] = [
  {
    kind: 'affective_experience', label: '情绪体验', version: 'heuristic-v1',
    evaluate(s) {
      const intensity = Math.abs(s.valence) * s.affectAccess;
      return { intensity, support: s.reliability, sourceEventIds: currentSource(s),
        factors: { valence: s.valence, arousal: s.arousal, affectAccess: s.affectAccess },
        basis: ['效价与感受可及性共同形成当前可感的情绪体验。'],
        regulationDemand: s.valence < 0 ? intensity * s.arousal * .3 : 0 };
    },
  },
  {
    kind: 'memory_resonance', label: '记忆共鸣', version: 'heuristic-v1',
    evaluate(s) {
      if (!s.memoryActivations.length) return;
      const intensity = Math.max(...s.memoryActivations.map(a => a.strength));
      return { intensity, support: s.reliability, sourceEventIds: s.memoryActivations.map(a => a.eventId),
        factors: { memoryActivation: intensity, contextBinding: s.contextBinding },
        basis: ['当前关系结构与过去事件相似，激活了有来源的记忆；是否形成再体验另行判断。'], regulationDemand: 0 };
    },
  },
  {
    kind: 'emotional_flashback', label: '情绪性再体验（闪回样）', version: 'heuristic-v1',
    evaluate(s) {
      const sources = s.memoryActivations.filter(a => a.valence < -.2 && a.strength > 0);
      if (!sources.length) return;
      const activation = Math.max(...sources.map(a => a.strength * Math.abs(a.valence)));
      const intensity = activation * (1 - s.contextBinding);
      return { intensity, support: s.reliability, sourceEventIds: sources.map(a => a.eventId),
        factors: { negativeMemoryActivation: activation, contextBinding: s.contextBinding },
        basis: ['负向过去记忆被当前结构激活，同时过去与当下的情境绑定减弱。'], regulationDemand: intensity };
    },
  },
  {
    kind: 'dissociative_detachment', label: '疏离体验（解离样）', version: 'heuristic-v1',
    evaluate(s) {
      if (!s.experience) return;
      const intensity = (1 - s.affectAccess) * (1 - s.selfContinuity);
      return { intensity, support: s.experience.reliability, sourceEventIds: [s.experience.eventId],
        factors: { affectAccess: s.affectAccess, selfContinuity: s.selfContinuity },
        basis: [s.experience.evidence, '感受可及性与自我体验连续性同时降低；低可控性或低情绪强度本身不足以支持此现象。'],
        regulationDemand: intensity };
    },
  },
];

/** The same lifecycle works for every rule; multiple phenomena may coexist. */
export function inferPhenomena(state: ProcessState, previous: readonly Phenomenon[] = [], rules = DEFAULT_PHENOMENON_RULES): Phenomenon[] {
  if (new Set(rules.map(r => r.kind)).size !== rules.length) throw new Error('Duplicate phenomenon rule');
  return rules.flatMap(rule => {
    const prior = previous.find(p => p.kind === rule.kind);
    const evidence = rule.evaluate(structuredClone(state));
    if (evidence && [evidence.intensity, evidence.support, evidence.regulationDemand, ...Object.values(evidence.factors)].some(v => !Number.isFinite(v))) throw new Error('Invalid phenomenon evidence');
    const intensity = unit(evidence?.intensity ?? 0);
    const ongoing = prior && prior.status !== 'resolved';
    const threshold = ongoing ? .01 : .04;
    if (!evidence || intensity < threshold || evidence.support <= 0) {
      if (!prior) return [];
      if (prior.status === 'resolved') return [structuredClone(prior)];
      return [{ ...structuredClone(prior), status: 'resolved' as const, intensity: 0, regulationDemand: 0, updatedAt: state.at, endedAt: state.at }];
    }
    return [{
      ...structuredClone(evidence), intensity, support: unit(evidence.support), regulationDemand: unit(evidence.regulationDemand),
      id: ongoing ? prior.id : randomUUID(), kind: rule.kind, label: rule.label,
      status: ongoing && intensity < prior.intensity - 1e-8 ? 'fading' as const : 'active' as const,
      startedAt: ongoing ? prior.startedAt : state.at, updatedAt: state.at,
      triggerEventIds: [...new Set([...(ongoing ? prior.triggerEventIds : []), ...currentSource(state)])],
      sourceEventIds: [...new Set(evidence.sourceEventIds)],
      ruleVersion: rule.version, epistemicStatus: 'model_inference' as const,
    }];
  });
}
