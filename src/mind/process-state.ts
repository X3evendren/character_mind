import type { Belief } from './cognitive-core.ts';

export interface MemoryActivation {
  eventId: string;
  appraisalId: string;
  sharedStructure: string[];
  strength: number;
  valence: number;
  arousal: number;
}

/** Continuous process estimates. No named phenomenon is a causal state variable. */
export interface ProcessState {
  version: 2;
  at: number;
  belief: Belief;
  valence: number;
  arousal: number;
  contextBinding: number;
  agency: number;
  affectAccess: number;
  selfContinuity: number;
  memoryActivations: MemoryActivation[];
  sourceEventId: string | null;
  reliability: number;
  experience?: { eventId: string; reliability: number; evidence: string };
}
