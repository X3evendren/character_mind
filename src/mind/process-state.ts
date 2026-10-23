import type { Goal } from './profile.ts';
import type { MotivationState } from './motivation.ts';
import type { Neuromodulation } from './neuromodulation.ts';
import type { ActionForecast } from './appraisal.ts';
export const RELATION_DIMENSIONS = ['goodwill', 'reliability', 'availability'] as const;
export type RelationDimension = typeof RELATION_DIMENSIONS[number];
export interface BeliefEstimate { alpha: number; beta: number; }
export const beliefMean = (b: BeliefEstimate) => b.alpha / (b.alpha + b.beta);
export interface MemoryActivation {
  eventId: string; appraisalId: string; sharedStructure: string[];
  strength: number; valence: number; arousal: number; positive: number; negative: number;
}
export interface Concern { goal: Goal; load: number; sourceEventIds: string[]; evidence: string; }
export interface Regulation {
  strategy: 'express' | 'reflect' | 'contain' | 'orient';
  strength: number; expressionScale: number; reason: string;
}
/** Causal process estimates; emotion and other named phenomena are readouts. */
export interface ProcessState {
  version: 3; at: number;
  belief: Record<RelationDimension, BeliefEstimate>;
  positive: number; negative: number;
  mood: { positive: number; negative: number };
  valence: number; arousal: number;
  contextBinding: number; agency: number; affectAccess: number; selfContinuity: number;
  memoryActivations: MemoryActivation[];
  concerns: Concern[]; regulation: Regulation;
  motivation: MotivationState;
  neuromodulation: Neuromodulation;
  appraisal: {
    goalImpact: Record<Goal, number>; novelty: number; urgency: number; certainty: number;
    responsibility: 'self' | 'other' | 'situation' | 'unclear'; anticipated: boolean;
    interaction: 'conversation' | 'task'; repairKind: 'none' | 'acknowledgement' | 'clarification' | 'fulfilled';
    forecasts?: ActionForecast[];
  };
  affectSourceIds: string[];
  sourceEventId: string | null; reliability: number;
  experience?: { eventId: string; reliability: number; evidence: string };
}
export const effectiveAffect = (s: ProcessState) => ({
  positive: Math.min(1, .75 * s.positive + .25 * s.mood.positive),
  negative: Math.min(1, .75 * s.negative + .25 * s.mood.negative),
});
