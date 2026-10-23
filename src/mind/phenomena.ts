import { randomUUID } from 'node:crypto';
import type { ProcessState } from './process-state.ts';
import { effectiveAffect } from './process-state.ts';

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
    kind: 'affective_experience', label: '情绪体验', version: 'process-v3',
    evaluate(s) {
      const affect = effectiveAffect(s);
      const intensity = Math.max(affect.positive,affect.negative) * s.affectAccess;
      return { intensity, support: s.reliability, sourceEventIds: [...s.affectSourceIds],
        factors: { positive: affect.positive, negative: affect.negative, valence: s.valence, arousal: s.arousal, affectAccess: s.affectAccess },
        basis: ['正向与负向过程分别保留；净效价相抵不代表没有感受。'],
        regulationDemand: s.valence < 0 ? intensity * s.arousal * .3 : 0 };
    },
  },
  {
    kind: 'mixed_affect', label: '矛盾感受', version: 'process-v3',
    evaluate(s) {
      const a=effectiveAffect(s), intensity=Math.min(a.positive,a.negative)*s.affectAccess;
      return {intensity,support:s.reliability,sourceEventIds:[...s.affectSourceIds],factors:{positive:a.positive,negative:a.negative},basis:['来自不同经历或目标的正负过程同时存在，分别保留其来源。'],regulationDemand:0};
    },
  },
  {
    kind: 'positive_engagement', label: '愉悦与投入', version: 'process-v3',
    evaluate(s) {
      const intensity=effectiveAffect(s).positive*s.affectAccess*(.4+.6*s.arousal);
      return {intensity,support:s.reliability,sourceEventIds:[...s.affectSourceIds],factors:{positive:effectiveAffect(s).positive,arousal:s.arousal},basis:['目标满足、兴趣与正向记忆支持当前投入；激活程度可以随喜悦增加。'],regulationDemand:0};
    },
  },
  {
    kind: 'unresolved_hurt', label: '仍有介意', version: 'process-v3',
    evaluate(s) {
      const concerns=s.concerns.filter(c=>['connection','integrity','autonomy'].includes(c.goal));
      const load=Math.max(0,...concerns.map(c=>c.load));
      const intensity=effectiveAffect(s).negative*load*s.affectAccess;
      return {intensity,support:s.reliability,sourceEventIds:[...new Set(concerns.flatMap(c=>c.sourceEventIds))],factors:{negative:effectiveAffect(s).negative,unresolvedLoad:load},basis:['负向感受与尚未解决的关系或自主目标同时存在；表达克制不自动消除这些过程。'],regulationDemand:intensity*.2};
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
      const sources = s.memoryActivations.filter(a => a.negative > .2 && a.strength > 0);
      if (!sources.length) return;
      const activation = Math.max(...sources.map(a => a.strength * a.negative));
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
      status: ongoing && (intensity < prior.intensity - 1e-8 || (prior.status === 'fading' && intensity <= prior.intensity + 1e-8)) ? 'fading' as const : 'active' as const,
      startedAt: ongoing ? prior.startedAt : state.at, updatedAt: state.at,
      triggerEventIds: [...new Set([...(ongoing ? prior.triggerEventIds : []), ...currentSource(state)])],
      sourceEventIds: [...new Set(evidence.sourceEventIds)],
      ruleVersion: rule.version, epistemicStatus: 'model_inference' as const,
    }];
  });
}
