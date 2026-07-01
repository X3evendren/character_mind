/**
 * Emotion Regulation — 5 strategies + breakdown cascade via force fields.
 *
 * Five regulation strategies in preference order (personality-derived):
 *   1. Cognitive Reappraisal  — reinterpret meaning of stimulus
 *   2. Situation Modification — change the situation
 *   3. Attentional Deployment  — shift attention away
 *   4. Acceptance              — let the emotion flow without resistance
 *   5. Expressive Suppression  — suppress outward emotional expression
 *
 * Breakdown is NOT "count ≥ N → crash".
 * It's a continuous force field where suppression pressure accumulates
 * and control capacity fluctuates based on fatigue, allostatic load,
 * and incoming emotional triggers.
 *
 * From: Gross (2015) Process Model, Nolen-Hoeksema, Barrett
 */

import type { ForceField } from "./force-field";
import type { PAD } from "./cpm-pad";
import type { RuminationState } from "./rumination";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface RegulationProfile {
  reappraisalAbility: number;     // 0–1
  suppressionTendency: number;    // 0–1
  situationModification: number;  // 0–1
  acceptanceTolerance: number;    // 0–1
  attentionalFlexibility: number; // 0–1
  ruminationVulnerability: number; // 0–1
}

export type RegulationStrategy =
  | "cognitive_reappraisal"
  | "situation_modification"
  | "attentional_deployment"
  | "acceptance"
  | "expressive_suppression"
  | "none";

export interface RegulationAttempt {
  strategy: RegulationStrategy;
  success: boolean;
  costPaid: boolean;
  /** Energy cost incurred */
  energyCost: number;
  /** Effect on the emotion */
  emotionReduction: number;
}

/**
 * Approximate latency for each regulation strategy (in ms).
 * From Gross (2015) Process Model timing estimates:
 *   - suppression is fastest (response-focused, acts on output)
 *   - reappraisal is moderate (cognitive, requires reinterpretation)
 *   - situation modification is slowest (requires environmental change)
 */
export const strategyLatency: Record<RegulationStrategy, number> = {
  expressive_suppression:    50,
  cognitive_reappraisal:    500,
  acceptance:               300,
  attentional_deployment:   200,
  situation_modification:  2000,
  none:                       0,
};

export interface BreakdownState {
  /** Current breakdown urge c(t) 0–1 */
  urge: number;
  /** Whether currently in breakdown */
  inBreakdown: boolean;
  /** Frames since breakdown started */
  breakdownFrames: number;
  /** Strategies tried and their outcomes */
  attemptedStrategies: RegulationAttempt[];
}

// ═══════════════════════════════════════════════════════════════
// Regulation strategy selection
// ═══════════════════════════════════════════════════════════════

/**
 * Select and execute regulation strategies based on personality profile
 * and current emotional state.
 *
 * Dual-pathway intensity gating (Sheppes et al. 2011):
 *   - emotionIntensity > 0.7  → prefer attentional strategies (distraction)
 *     because high-intensity emotions overwhelm cognitive resources
 *   - emotionIntensity <= 0.7 → prefer cognitive strategies (reappraisal)
 *     because moderate emotions allow semantic processing
 */
export function selectRegulationStrategy(
  profile: RegulationProfile,
  emotionIntensity: number,
  allostaticLoad: number,
): RegulationStrategy[] {
  if (emotionIntensity < 0.15) return ["none"];

  const strategies: RegulationStrategy[] = [];

  // Intensity gating: high intensity → attentional first; moderate → cognitive first
  const highIntensity = emotionIntensity > 0.7;

  // Primary strategy (personality-driven preference, modulated by intensity)
  if (highIntensity) {
    // High intensity — prefer attentional (distraction) over cognitive
    if (profile.attentionalFlexibility > 0.4) {
      strategies.push("attentional_deployment");
    } else if (profile.reappraisalAbility > 0.5) {
      strategies.push("cognitive_reappraisal");
    } else {
      strategies.push("acceptance");
    }
  } else {
    // Moderate intensity — prefer cognitive (reappraisal) over attentional
    if (profile.reappraisalAbility > 0.5) {
      strategies.push("cognitive_reappraisal");
    } else if (profile.situationModification > profile.reappraisalAbility) {
      strategies.push("situation_modification");
    } else {
      strategies.push("acceptance");
    }
  }

  // Backup strategies
  const backups: RegulationStrategy[] = [];
  if (profile.attentionalFlexibility > 0.4 && strategies[0] !== "attentional_deployment") {
    backups.push("attentional_deployment");
  }
  if (profile.acceptanceTolerance > 0.5 && strategies[0] !== "acceptance") {
    backups.push("acceptance");
  }
  // Cognitive reappraisal as backup when not primary (for high-intensity fallback)
  if (profile.reappraisalAbility > 0.5 && strategies[0] !== "cognitive_reappraisal") {
    backups.push("cognitive_reappraisal");
  }
  if (profile.suppressionTendency > 0.3) {
    backups.push("expressive_suppression");
  }

  // High allostatic load → fewer options work
  const availableBackups = allostaticLoad > 0.6
    ? backups.slice(0, 1)
    : backups;

  return [...strategies, ...availableBackups];
}

// ═══════════════════════════════════════════════════════════════
// Breakdown force field
// ═══════════════════════════════════════════════════════════════

export interface BreakdownForces {
  /** Forces pushing toward breakdown */
  driving: Array<{ name: string; magnitude: number }>;
  /** Forces holding back breakdown */
  controlling: Array<{ name: string; magnitude: number }>;
}

/**
 * Compute forces acting on the breakdown urge c(t).
 */
export function computeBreakdownForces(
  suppressionCumulative: number,
  unexpressedEmotionIntensity: number,
  allostaticLoad: number,
  energyValue: number,
  pad: PAD,
  safetyDelta: number,
  profile: RegulationProfile,
): BreakdownForces {
  return {
    driving: [
      // Cumulative suppression pressure
      {
        name: "suppression_accumulation",
        magnitude: Math.min(1, suppressionCumulative),
      },
      // Unexpressed emotion intensity
      {
        name: "unexpressed",
        magnitude: Math.abs(pad.pleasure) * 0.4 + Math.abs(pad.arousal) * 0.3,
      },
      // Allostatic load — high load = less control
      {
        name: "allostatic",
        magnitude: allostaticLoad * 0.5,
      },
      // Cognitive fatigue
      {
        name: "fatigue",
        magnitude: (1 - energyValue) * 0.3,
      },
      // Trigger event intensity
      {
        name: "trigger",
        magnitude: Math.abs(safetyDelta) * 0.5,
      },
    ],

    controlling: [
      // Cognitive reappraisal capacity
      {
        name: "reappraisal",
        magnitude: profile.reappraisalAbility * energyValue * 0.4,
      },
      // Acceptance — "I accept I'm uncomfortable"
      {
        name: "acceptance",
        magnitude: profile.acceptanceTolerance * 0.35,
      },
      // Attention shift — new stimuli reduce pressure
      {
        name: "distraction",
        magnitude: profile.attentionalFlexibility * 0.3,
      },
      // Social safety — user expressing care
      {
        name: "social_safety",
        magnitude: pad.pleasure > 0.2 ? pad.pleasure * 0.25 : 0,
      },
    ],
  };
}

/**
 * Update the breakdown force field.
 */
export function updateBreakdown(
  breakdownFF: ForceField,
  forces: BreakdownForces,
): number {
  const allForces = [
    ...forces.driving.map(f => ({
      name: f.name,
      direction: 1 as const,
      magnitude: f.magnitude,
      weight: 1.0,
    })),
    ...forces.controlling.map(f => ({
      name: f.name,
      direction: -1 as const,
      magnitude: f.magnitude,
      weight: 1.0,
    })),
  ];

  return breakdownFF.update(allForces);
}

// ═══════════════════════════════════════════════════════════════
// Strategy effects
// ═══════════════════════════════════════════════════════════════

/**
 * Compute the effect of cognitive reappraisal.
 *
 * Attempts to reinterpret the stimulus meaning.
 * More effective when energy is high and allostatic load is low.
 */
export function attemptReappraisal(
  ability: number,
  allostaticLoad: number,
): { success: boolean; emotionReduction: number; energyCost: number } {
  const effectiveAbility = ability * (1 - allostaticLoad * 0.5);
  const success = effectiveAbility > 0.3 && Math.random() < effectiveAbility;

  return {
    success,
    emotionReduction: success ? effectiveAbility * 0.4 : 0,
    energyCost: 0.02, // reappraisal is cognitively expensive
  };
}

/**
 * Compute the effect of expressive suppression.
 *
 * Suppresses outward expression but internal state is NOT reduced.
 * In fact, suppression has a physiological cost.
 *
 * Suppression rebound (Gross & Levenson 1997):
 *   Suppressed emotions don't disappear — they return stronger later.
 *   reboundResidual = original intensity × 1.5 × suppressionDuration (frames).
 *
 * Allostatic load penalty:
 *   When allostaticLoad > 0.7, suppression effectiveness drops
 *   (effectivenessPenalty = 0.3), making it harder to suppress.
 */
export function attemptSuppression(
  tendency: number,
  emotionIntensity: number,
  allostaticLoad = 0,
  suppressionDuration = 0,
): {
  success: boolean;
  internalCost: number;
  allostaticCost: number;
  /** Residual emotion that will rebound later (Gross & Levenson 1997) */
  reboundResidual: number;
} {
  // Allostatic load penalty: high load → suppression is harder
  const effectivenessPenalty = allostaticLoad > 0.7 ? 0.3 : 0;
  const effectiveTendency = Math.max(0.1, tendency - effectivenessPenalty);
  const success = effectiveTendency > 0.3 && Math.random() < effectiveTendency * 0.8;

  // Rebound: suppressed emotion returns stronger (Gross & Levenson 1997)
  const reboundResidual = success
    ? emotionIntensity * 1.5 * Math.max(1, suppressionDuration)
    : 0;

  return {
    success,
    // Suppression does NOT reduce internal emotion
    internalCost: success ? emotionIntensity * 0.05 : 0,
    // But it DOES increase allostatic burden
    allostaticCost: success ? 0.005 : 0,
    reboundResidual,
  };
}

/**
 * Compute the effect of acceptance.
 *
 * Letting emotion flow without resistance.
 * When successful, accelerates natural emotion decay.
 */
export function attemptAcceptance(
  tolerance: number,
  emotionIntensity: number,
): { success: boolean; decayAcceleration: number } {
  const success = tolerance > 0.4 && Math.random() < tolerance;

  return {
    success,
    // Acceptance doesn't reduce emotion, it accelerates its natural decay
    decayAcceleration: success ? 0.3 : 0,
  };
}

/**
 * Assess the full breakdown state from the force field.
 */
export function assessBreakdown(
  breakdownFF: ForceField,
  prevBreakdownFrames: number,
  suppressionCumulative: number,
): { state: BreakdownState; suppressionReset: number } {
  const urge = breakdownFF.value;
  let inBreakdown = prevBreakdownFrames > 0;
  let frames = prevBreakdownFrames;
  let suppressionReset = suppressionCumulative;

  if (urge > 0.9) {
    // Enter breakdown
    inBreakdown = true;
    frames = prevBreakdownFrames + 1;
  } else if (urge < 0.3 && inBreakdown) {
    // Exit breakdown — natural recovery
    inBreakdown = false;
    frames = 0;
    // After breakdown, release accumulated suppression pressure
    suppressionReset = 0;
  } else if (inBreakdown) {
    frames = prevBreakdownFrames + 1;
  }

  return {
    state: {
      urge,
      inBreakdown,
      breakdownFrames: frames,
      attemptedStrategies: [],
    },
    suppressionReset,
  };
}

/**
 * Compute how rumination and emotion regulation interact.
 *
 * When rumination is active:
 *   - Reappraisal ability is halved (cognitive resources consumed)
 *   - Attentional flexibility drops sharply
 *   - Acceptance becomes harder
 */
export function ruminationRegulationModulation(
  rumination: RuminationState,
  profile: RegulationProfile,
): RegulationProfile {
  if (!rumination.active) return profile;

  const r = rumination.intensity;
  return {
    ...profile,
    reappraisalAbility: profile.reappraisalAbility * (1 - r * 0.5),
    attentionalFlexibility: profile.attentionalFlexibility * (1 - r * 0.6),
    acceptanceTolerance: profile.acceptanceTolerance * (1 - r * 0.4),
  };
}
