/**
 * Interoception System — perception of internal bodily/emotional state.
 *
 * Humans don't read their internal state directly — they infer it through
 * Bayesian integration of noisy interoceptive signals and prior predictions.
 *
 *   P(state | signal) ∝ P(signal | state) × P(state)
 *
 * Interoceptive precision π = 1/σ² controls how much the agent trusts
 * internal signals vs. top-down predictions.
 *
 * From: Seth & Friston (2016), Barrett (2016), Cea (2024)
 */

import { gaussianRandom } from "./force-field";
import { capitalize } from "../utils";
import type { ForceField } from "./force-field";
import type { HomeostaticState } from "./homeostatic-state";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface InteroceptiveState {
  /** Perceived value for each homeostatic variable (0–1) */
  perceived: {
    energy: number;
    arousal: number;
    safety: number;
    connection: number;
    mastery: number;
  };
  /** Confidence in each perception (0–1) */
  confidence: {
    energy: number;
    arousal: number;
    safety: number;
    connection: number;
    mastery: number;
  };
  /** Overall interoceptive accuracy */
  globalPrecision: number;
  /** Whether the agent is currently body-focused */
  attentionDirected: boolean;
}

export interface InteroceptionConfig {
  /** Baseline interoceptive precision (personality-derived) */
  baselinePrecision: {
    energy: number;
    arousal: number;
    safety: number;
    connection: number;
    mastery: number;
  };
  /** Noise variance multiplier (personality-derived alexithymia) */
  alexithymiaBaseline: number;
}

// ═══════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_INTEROCEPTION_CONFIG: InteroceptionConfig = {
  baselinePrecision: {
    energy: 0.5,
    arousal: 0.5,
    safety: 0.5,
    connection: 0.5,
    mastery: 0.5,
  },
  alexithymiaBaseline: 0.3,
};

// ═══════════════════════════════════════════════════════════════
// Core
// ═══════════════════════════════════════════════════════════════

/**
 * Infer perceived internal state via Bayesian integration.
 *
 * For each homeostatic variable:
 *   prior = s*_predicted (allostatic prediction — what the brain EXPECTS)
 *   likelihood = actual value + noise (noisy interoceptive signal)
 *   posterior = weighted average of prior and likelihood
 *     weight = π_intero / (π_intero + π_prior)
 *
 * π_intero: interoceptive precision (how much to trust body signals)
 * π_prior:  prior precision (how much to trust the prediction)
 */
export function inferInteroceptiveState(
  homeostatic: HomeostaticState,
  predictedSetPoints: {
    energy: number;
    arousal: number;
    safety: number;
    connection: number;
    mastery: number;
  },
  precisionFields: {
    interoEnergy: ForceField;
    interoArousal: ForceField;
    interoSafety: ForceField;
    interoConnection: ForceField;
    interoMastery: ForceField;
  },
  config: InteroceptionConfig,
  allostaticLoad: number,
  attentionDirected: boolean,
): InteroceptiveState {
  const vars = ["energy", "arousal", "safety", "connection", "mastery"] as const;

  const perceived: Record<string, number> = {};
  const confidence: Record<string, number> = {};

  for (const v of vars) {
    const actual = homeostatic[v].value;
    const prior = predictedSetPoints[v];
    const fieldKey = `intero${capitalize(v)}` as keyof typeof precisionFields;
    const pi_intero = precisionFields[fieldKey].value; // 0–1, dynamic
    const pi_prior = 0.4; // prior precision (fixed, moderate)

    // Likelihood: actual state + interoceptive noise
    const noiseStd = (1 - pi_intero) * 0.3 + config.alexithymiaBaseline * 0.2;
    const noisySignal = actual + gaussianRandom(0, noiseStd);

    // Bayesian fusion: posterior = weighted average
    const weight = pi_intero / (pi_intero + pi_prior);
    perceived[v] = prior * (1 - weight) + noisySignal * weight;

    // Confidence in perception: higher when prior and signal agree
    const agreement = 1 - Math.abs(noisySignal - prior);
    confidence[v] = pi_intero * 0.5 + agreement * 0.5;
  }

  const globalPrecision = Object.values(precisionFields).reduce(
    (s, f) => s + f.value, 0
  ) / vars.length;

  return {
    perceived: {
      energy: perceived.energy,
      arousal: perceived.arousal,
      safety: perceived.safety,
      connection: perceived.connection,
      mastery: perceived.mastery,
    },
    confidence: {
      energy: confidence.energy,
      arousal: confidence.arousal,
      safety: confidence.safety,
      connection: confidence.connection,
      mastery: confidence.mastery,
    },
    globalPrecision,
    attentionDirected,
  };
}

/**
 * Update interoceptive precision force fields.
 *
 * Forces that INCREASE precision:
 *   - Quiet environment (low external noise)
 *   - Strong emotional signal (too strong to ignore)
 *   - Solitude (no social distraction)
 *   - Body-focused attention
 *   - Baseline sensitivity (anxious personality → chronic high precision)
 *
 * Forces that DECREASE precision:
 *   - External noise / distraction
 *   - Flow state (attention absorbed elsewhere)
 *   - High allostatic load → locked-in → precision collapse
 *   - Cumulative suppression → "forgetting how you feel"
 *   - Alexithymia baseline
 */
export function updateInteroceptivePrecision(
  fields: {
    interoEnergy: ForceField;
    interoArousal: ForceField;
    interoSafety: ForceField;
    interoConnection: ForceField;
    interoMastery: ForceField;
  },
  homeostatic: HomeostaticState,
  allostaticLoad: number,
  suppressionCumulative: number,
  attentionDirection: "internal" | "external",
  externalNoise: number,
): void {
  const vars = ["energy", "arousal", "safety", "connection", "mastery"] as const;

  for (const v of vars) {
    const fieldKey = `intero${capitalize(v)}` as keyof typeof fields;
    const field = fields[fieldKey];
    const deviation = Math.abs(homeostatic[v].value - homeostatic[v].setPoint);

    const forces = [
      // ↑ Forces increasing precision
      {
        name: "quiet_env",
        direction: 1 as const,
        magnitude: 1 - externalNoise,
        weight: 0.3,
      },
      {
        name: "strong_signal",
        direction: 1 as const,
        magnitude: Math.min(1, deviation * 1.5),
        weight: 0.35,
      },
      {
        name: "internal_attention",
        direction: 1 as const,
        magnitude: attentionDirection === "internal" ? 0.6 : 0,
        weight: 0.25,
      },

      // ↓ Forces decreasing precision
      {
        name: "external_noise",
        direction: -1 as const,
        magnitude: externalNoise,
        weight: 0.3,
      },
      {
        name: "flow_state",
        direction: -1 as const,
        magnitude: attentionDirection === "external" ? 0.5 : 0,
        weight: 0.4,
      },
      {
        name: "allostatic_lockdown",
        direction: -1 as const,
        magnitude: allostaticLoad > 0.6 ? allostaticLoad : 0,
        weight: 0.35,
      },
      {
        name: "suppression_blunting",
        direction: -1 as const,
        magnitude: suppressionCumulative,
        weight: 0.25,
      },
    ];

    field.update(forces);
  }
}

// ═══════════════════════════════════════════════════════════════
// Interoceptive POMDP — Partially Observable Markov Decision Process
// for cardiac phase + arousal state inference
//
// Simplified 2x2 transition matrices track hidden states over time,
// enabling Bayesian filtering of interoceptive observations.
// ═══════════════════════════════════════════════════════════════

/** Hidden cardiac phase state: systole (0) or diastole (1). */
export interface InteroceptiveHiddenState {
  cardiacPhase: number;   // 0 = systole, 1 = diastole
  cardiacArousal: number; // 0 = low arousal (parasympathetic), 1 = high (sympathetic)
}

/** Noisy observation of interoceptive state. */
export interface InteroceptiveObservation {
  perceivedPhase: number;      // 0–1, noisy read of cardiacPhase
  perceivedArousal: number;    // 0–1, noisy read of cardiacArousal
  confidence: number;          // 0–1, observation reliability
}

/** Policy: action the agent can take to modulate interoception. */
export interface InteroceptivePolicy {
  label: string;
  targetCardiacPhase?: number;   // preferred phase after action
  targetArousal?: number;        // preferred arousal after action
  precision: number;             // 0–1, confidence in this policy
}

/**
 * Cardiac phase transition matrix (2x2).
 *
 *   P(systole → systole)     P(systole → diastole)
 *   P(diastole → systole)    P(diastole → diastole)
 *
 * At rest: diastole is longer (~0.6 of cycle).
 * Under arousal: systole fraction increases (shorter diastole).
 */
export function cardiacPhaseTransition(arousal: number): [[number, number], [number, number]] {
  // Higher arousal → more likely to stay in / transition to systole
  const pSystoleStay = 0.35 + arousal * 0.15;
  const pDiastoleStay = 0.65 - arousal * 0.15;
  return [
    [pSystoleStay, 1 - pSystoleStay],
    [1 - pDiastoleStay, pDiastoleStay],
  ];
}

/**
 * Cardiac arousal transition matrix (2x2).
 *
 * Autonomic arousal has inertia — it doesn't flip instantly.
 */
export function cardiacArousalTransition(allostaticLoad: number): [[number, number], [number, number]] {
  // High allostatic load → arousal tends to stay high
  const pLowStay = 0.7 - allostaticLoad * 0.2;
  const pHighStay = 0.3 + allostaticLoad * 0.3;
  return [
    [pLowStay, 1 - pLowStay],
    [1 - pHighStay, pHighStay],
  ];
}

/**
 * Observation likelihood: P(observation | hidden state).
 *
 * Higher precision → observation better reflects true state.
 */
export function observationLikelihood(
  observation: InteroceptiveObservation,
  hidden: InteroceptiveHiddenState,
  precision: number,
): number {
  // Phase agreement: how close is perceivedPhase to hidden cardiacPhase?
  const phaseError = Math.abs(observation.perceivedPhase - hidden.cardiacPhase);
  const phaseLikelihood = Math.exp(-phaseError / (0.1 + (1 - precision) * 0.3));

  // Arousal agreement
  const arousalError = Math.abs(observation.perceivedArousal - hidden.cardiacArousal);
  const arousalLikelihood = Math.exp(-arousalError / (0.1 + (1 - precision) * 0.3));

  // Combined likelihood (product of independent channels)
  return phaseLikelihood * arousalLikelihood * observation.confidence;
}

/**
 * Interoceptive precision parameters — control the gain on observations.
 */
export interface InteroceptivePrecisionParams {
  cardiacPhasePrecision: number;   // 0–1, precision on phase channel
  cardiacArousalPrecision: number; // 0–1, precision on arousal channel
}

/** Default precision parameters. */
export const DEFAULT_POMDP_PRECISION: InteroceptivePrecisionParams = {
  cardiacPhasePrecision: 0.6,
  cardiacArousalPrecision: 0.5,
};

/**
 * Simplified Bayesian belief update for interoceptive POMDP.
 *
 * Given a prior belief over hidden states (4 discrete states for the 2×2
 * phase × arousal grid) and a new observation, compute the posterior belief.
 *
 * This is a filtered belief state, not full POMDP planning — sufficient
 * for interoceptive inference without computational overhead.
 */
export function updateInteroceptiveBelief(
  priorBelief: number[],  // length 4: [sys+low, sys+high, dia+low, dia+high]
  observation: InteroceptiveObservation,
  allostaticLoad: number,
  precision: InteroceptivePrecisionParams,
): number[] {
  const phaseT = cardiacPhaseTransition(allostaticLoad);
  const arousalT = cardiacArousalTransition(allostaticLoad);

  // Hidden states: [systole+low, systole+high, diastole+low, diastole+high]
  const hiddenStates: InteroceptiveHiddenState[] = [
    { cardiacPhase: 0, cardiacArousal: 0 },
    { cardiacPhase: 0, cardiacArousal: 1 },
    { cardiacPhase: 1, cardiacArousal: 0 },
    { cardiacPhase: 1, cardiacArousal: 1 },
  ];

  // Prediction step: prior × transition
  const predicted: number[] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const fromPhase = hiddenStates[i].cardiacPhase;
    const fromArousal = hiddenStates[i].cardiacArousal;
    for (let j = 0; j < 4; j++) {
      const toPhase = hiddenStates[j].cardiacPhase;
      const toArousal = hiddenStates[j].cardiacArousal;
      const transProb = phaseT[fromPhase][toPhase] * arousalT[fromArousal][toArousal];
      predicted[j] += priorBelief[i] * transProb;
    }
  }

  // Update step: predicted × observation likelihood
  const jointPrecision =
    (precision.cardiacPhasePrecision + precision.cardiacArousalPrecision) / 2;
  const posterior: number[] = [0, 0, 0, 0];
  let evidence = 0;
  for (let i = 0; i < 4; i++) {
    posterior[i] = predicted[i] * observationLikelihood(observation, hiddenStates[i], jointPrecision);
    evidence += posterior[i];
  }

  // Normalize
  if (evidence > 0) {
    for (let i = 0; i < 4; i++) posterior[i] /= evidence;
  } else {
    // If no evidence, keep prior
    for (let i = 0; i < 4; i++) posterior[i] = priorBelief[i];
  }

  return posterior;
}

/**
 * Initialize a uniform belief over the 4 hidden states.
 */
export function initInteroceptiveBelief(): number[] {
  return [0.25, 0.25, 0.25, 0.25];
}

// Helpers: gaussianRandom imported from ./force-field
