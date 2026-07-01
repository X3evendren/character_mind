/**
 * Boredom System — cognitive homeostatic regulation via force field.
 *
 * Boredom is NOT "nothing to do". It is a cognitive engagement deviation signal:
 *   b(t) = max(0, c* − c(t))
 *   where c* = engagement setpoint, c(t) = current cognitive engagement
 *
 * HHVG Mapping (Yu, Chang & Kanai):
 *   KL divergence D_KL(P||Q) → devaluation of known information → boredom
 *   ΔD_KL → curiosity reward → exploration drive
 *
 * From: Danckert et al. (2025) Communications Psychology,
 *       Schöfer et al. (2025) ESANN,
 *       HHVG algorithm (Frontiers in Neurorobotics)
 */

import { cosineSimilarity } from "../utils";
import type { ForceField } from "./force-field";
import type { IProvider } from "../agent/provider";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface BoredomState {
  /** Current cognitive engagement c(t) 0–1 */
  cognitiveEngagement: number;
  /** Engagement setpoint c* (personality-derived) */
  engagementSetPoint: number;
  /** Boredom intensity b(t) */
  boredomIntensity: number;
  /** Current situation novelty */
  novelty: number;
  /** How predictable the current situation is */
  predictability: number;
  /** Goal relevance × self-relevance — how meaningful this feels */
  meaningfulness: number;
  /** Urge to explore / seek novelty */
  explorationUrge: number;
  /** Has the agent mentally disengaged from the conversation? */
  disengaged: boolean;
}

export interface BoredomForces {
  engaging: Array<{ name: string; magnitude: number }>;
  disengaging: Array<{ name: string; magnitude: number }>;
}

// ═══════════════════════════════════════════════════════════════
// Force computation
// ═══════════════════════════════════════════════════════════════

export function computeBoredomForces(
  novelty: number,
  predictability: number,
  meaningfulness: number,
  socialStimulation: number,
  fatigue: number,
  playfulness: number,
): BoredomForces {
  return {
    // Forces that INCREASE cognitive engagement (make things interesting)
    engaging: [
      { name: "novelty",      magnitude: novelty * 0.35 },
      { name: "meaning",      magnitude: meaningfulness * 0.30 },
      { name: "social",       magnitude: socialStimulation * 0.20 },
      { name: "play",         magnitude: playfulness * 0.15 },
    ],

    // Forces that DECREASE cognitive engagement (make things boring)
    disengaging: [
      { name: "routine",      magnitude: predictability * 0.30 },
      { name: "monotony",     magnitude: (1 - novelty) * 0.35 },
      { name: "empty",        magnitude: (1 - meaningfulness) * 0.25 },
      { name: "rest_tendency",magnitude: fatigue * 0.10 },
    ],
  };
}

export function updateBoredom(
  boredomFF: ForceField,
  forces: BoredomForces,
): number {
  const allForces = [
    ...forces.engaging.map(f => ({
      name: f.name, direction: 1 as const, magnitude: f.magnitude, weight: 1.0,
    })),
    ...forces.disengaging.map(f => ({
      name: f.name, direction: -1 as const, magnitude: f.magnitude, weight: 1.0,
    })),
  ];
  return boredomFF.update(allForces);
}

// ═══════════════════════════════════════════════════════════════
// Assessment
// ═══════════════════════════════════════════════════════════════

export function assessBoredom(
  boredomFF: ForceField,
  engagementSetPoint: number,
  novelty: number,
  predictability: number,
  meaningfulness: number,
): BoredomState {
  const c = boredomFF.value;
  const b = Math.max(0, engagementSetPoint - c);

  return {
    cognitiveEngagement: c,
    engagementSetPoint,
    boredomIntensity: b,
    novelty,
    predictability,
    meaningfulness,
    explorationUrge: b * 0.6 + novelty * 0.2,
    disengaged: b > 0.6,
  };
}

// ═══════════════════════════════════════════════════════════════
// Boredom → behavior effects
// ═══════════════════════════════════════════════════════════════

export interface BoredomBehaviorEffects {
  topicChangeUrge: number;
  explorationUrge: number;
  playUrge: number;
  silenceProbabilityMod: number;
  attentionWithdrawal: number;
  shouldSeekStimulation: boolean;
}

export function computeBoredomBehavior(
  state: BoredomState,
): BoredomBehaviorEffects {
  const b = state.boredomIntensity;

  return {
    topicChangeUrge:    b > 0.2 ? b * 0.5 : 0,
    explorationUrge:    b > 0.3 ? b * 0.6 : 0,
    playUrge:           b > 0.3 ? b * 0.4 : 0,
    silenceProbabilityMod: b > 0.5 ? b * 0.3 : 0,
    attentionWithdrawal:   b > 0.7 ? (b - 0.7) * 2 : 0,
    shouldSeekStimulation: b > 0.4,
  };
}

// ═══════════════════════════════════════════════════════════════
// Novelty computation
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate the novelty of current input relative to recent history.
 * Uses embedding cosine distance (no regex).
 */
export function estimateNovelty(
  currentEmbedding: Float32Array,
  recentEmbeddings: Float32Array[],
): number {
  if (recentEmbeddings.length === 0) return 1.0; // first message = maximally novel

  // Average similarity to recent N embeddings
  let totalSim = 0;
  for (const emb of recentEmbeddings) {
    totalSim += cosineSimilarity(currentEmbedding, emb);
  }
  const avgSimilarity = totalSim / recentEmbeddings.length;

  // Novelty = 1 - average similarity
  return 1 - avgSimilarity;
}

/**
 * Estimate predictability: how well the expected response matches actual.
 */
export function estimatePredictability(
  expectedEmbedding: Float32Array | null,
  actualEmbedding: Float32Array,
): number {
  if (!expectedEmbedding) return 0.5; // baseline when no prediction
  return cosineSimilarity(expectedEmbedding, actualEmbedding);
}

// Helpers: imported from ../utils
