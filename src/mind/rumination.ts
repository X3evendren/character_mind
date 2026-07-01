/**
 * Rumination — 4-subprocess self-sustaining cognitive loop.
 *
 * Rumination is NOT "thinking about negative things".
 * It is four subprocesses running simultaneously, reinforcing each other:
 *
 *   ① Attentional stickiness  — attention locked on negative material
 *   ② Abstract overgeneralization — concrete event → abstract self-concept
 *   ③ Memory retrieval bias      — mood-congruent memory amplification
 *   ④ Behavioral inertia         — Go/NoGo pathway bias toward NoGo
 *
 * Rumination is a force-field state r(t) ∈ [0, 1], driven by multiple
 * competing forces with a time constant of ~15 minutes.
 *
 * From: Nolen-Hoeksema Response Styles Theory, Watkins abstractness theory,
 *       Koster impaired disengagement hypothesis
 */

import type { ForceField } from "./force-field";
import type { MoodSnapshot } from "./mood";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface RuminationState {
  /** Overall rumination intensity r(t) */
  intensity: number;
  /** Subprocess activation levels */
  subprocesses: {
    stickiness: number;      // ① attentional stickiness
    abstraction: number;     // ② abstract overgeneralization
    memoryBias: number;      // ③ mood-congruent memory bias
    inertia: number;         // ④ behavioral inertia
  };
  /** When rumination was last reinforced */
  lastReinforcedAt: number;
  /** The triggering event */
  triggerEvent: string;
  /** Is rumination currently active (> 0.2) */
  active: boolean;
  /** Classification: rumination vs reflection */
  mode: "rumination" | "reflection" | "none";
}

export interface RuminationConfig {
  /** Personality-derived vulnerability */
  vulnerability: number;
  /** Personality-derived abstraction bias */
  abstractionBias: number;
}

export const DEFAULT_RUMINATION_CONFIG: RuminationConfig = {
  vulnerability: 0.4,
  abstractionBias: 0.5,
};

// ═══════════════════════════════════════════════════════════════
// Force computation
// ═══════════════════════════════════════════════════════════════

export interface RuminationForces {
  /** Forces driving rumination ↑ */
  driving: Array<{ name: string; magnitude: number }>;
  /** Forces suppressing rumination ↓ */
  suppressing: Array<{ name: string; magnitude: number }>;
}

export function computeRuminationForces(
  ruminationFF: ForceField,
  mood: MoodSnapshot,
  config: RuminationConfig,
  selfReference: number,
  abstractionLevel: number,
  closureSignal: number,
  noveltySignal: number,
  userPositiveAffect: number,
  reappraisalAbility: number,
): RuminationForces {
  const r = ruminationFF.value;

  return {
    driving: [
      // ① Attentional stickiness: current thought valence matches trigger
      // Sticky attention prolongs rumination
      {
        name: "stickiness",
        magnitude: r > 0.2 ? 0.3 : 0.1,
      },
      // ② Abstract overgeneralization
      {
        name: "abstraction",
        magnitude: config.abstractionBias * selfReference * 0.4,
      },
      // ③ Memory bias: dysphoric + anxious mood → biased retrieval → more material
      {
        name: "memory_bias",
        magnitude: mood.euthymic < 0.4 ? (0.5 - mood.euthymic) * 0.6 : 0,
      },
      {
        name: "anxious_bias",
        magnitude: mood.anxious > 0.3 ? mood.anxious * 0.3 : 0,
      },
      // ④ Unresolved feeling: high goal relevance + low closure
      {
        name: "unresolved",
        magnitude: (1 - closureSignal) * 0.35,
      },
      // ⑤ Empty-loop inertia: already ruminating → tendency to continue
      {
        name: "inertia",
        magnitude: r * 0.2,
      },
      // ⑥ Vulnerability: pre-existing tendency
      {
        name: "vulnerability",
        magnitude: config.vulnerability * 0.2,
      },
    ],

    suppressing: [
      // Concrete reframing: reappraisal turns abstract → concrete
      {
        name: "concrete_reframe",
        magnitude: reappraisalAbility * (1 - abstractionLevel) * 0.35,
      },
      // Novel stimulus: new input breaks the loop
      {
        name: "novelty",
        magnitude: noveltySignal * 0.3,
      },
      // Closure: "this is resolved"
      {
        name: "closure",
        magnitude: closureSignal * 0.4,
      },
      // Positive affect: hard to ruminate when happy
      {
        name: "positive_affect",
        magnitude: mood.euthymic * 0.2 + userPositiveAffect * 0.25,
      },
      // Natural decay: without reinforcement, rumination fades
      {
        name: "time_decay",
        magnitude: 0.08,
      },
      // Boredom: getting tired of the same thoughts
      {
        name: "boredom",
        magnitude: mood.curious < 0.3 ? 0.2 : 0,
      },
    ],
  };
}

/**
 * Apply rumination forces to the force field.
 */
export function updateRumination(
  ruminationFF: ForceField,
  forces: RuminationForces,
): number {
  const allForces = [
    ...forces.driving.map(f => ({
      name: f.name,
      direction: 1 as const,
      magnitude: f.magnitude,
      weight: 1.0,
    })),
    ...forces.suppressing.map(f => ({
      name: f.name,
      direction: -1 as const,
      magnitude: f.magnitude,
      weight: 1.0,
    })),
  ];

  return ruminationFF.update(allForces);
}

/**
 * Update subprocess activation levels from the main rumination intensity.
 *
 * Subprocesses activate at different rates:
 *   - Stickiness activates first (attention locks)
 *   - Memory bias follows (retrieval shifts)
 *   - Abstraction rises (thinking becomes more general)
 *   - Inertia builds last (behavior freezes)
 */
export function updateSubprocesses(
  r: number,
  prev: RuminationState["subprocesses"],
  selfReference: number,
  abstractionLevel: number,
): RuminationState["subprocesses"] {
  const alpha = 0.3; // subprocess smoothness

  return {
    stickiness:  prev.stickiness  + alpha * (r * 0.8 - prev.stickiness),
    abstraction: prev.abstraction + alpha * (r * abstractionLevel - prev.abstraction),
    memoryBias:  prev.memoryBias  + alpha * (r * 0.7 - prev.memoryBias),
    inertia:     prev.inertia     + alpha * (r * 0.5 - prev.inertia),
  };
}

/**
 * Classify whether current thought pattern is rumination or reflection.
 *
 * Rumination signals:
 *   - Abstract, self-referential ("Why am I always...")
 *   - Past-focused, no action plan
 *
 * Reflection signals:
 *   - Concrete, situational ("That time when I...")
 *   - Future-focused, action-oriented ("Next time I will...")
 */
export function classifyRuminationVsReflection(
  thoughtText: string,
  abstractionLevel: number,
  selfReference: number,
  hasActionPlan: boolean,
  timeFocus: "past" | "present" | "future",
  moodEuthymic: number,
): "rumination" | "reflection" | "none" {
  // Strong reflection signal: concrete + future + action
  if (abstractionLevel < 0.4 && timeFocus === "future" && hasActionPlan) {
    return "reflection";
  }

  // Strong rumination signal: abstract + past + no action
  if (abstractionLevel > 0.6 && timeFocus === "past" && !hasActionPlan && selfReference > 0.7) {
    return "rumination";
  }

  // Ambiguous: biased by current mood
  if (moodEuthymic > 0.5) {
    return "reflection"; // positive mood → interpret as reflection
  } else if (moodEuthymic < 0.3) {
    return "rumination"; // negative mood → interpret as rumination
  }

  return "none";
}

/**
 * Compute how much the memory retrieval system should be biased
 * by current rumination state.
 */
export function ruminationMemoryBias(
  rumination: RuminationState,
): {
  emotionBoostMultiplier: number;
  negativityBias: number;
  graphDiffusionExtraHop: number;
  edgeThresholdReduction: number;
} {
  if (!rumination.active) {
    return {
      emotionBoostMultiplier: 1.0,
      negativityBias: 1.0,
      graphDiffusionExtraHop: 0,
      edgeThresholdReduction: 0,
    };
  }

  return {
    emotionBoostMultiplier: 1 + rumination.subprocesses.memoryBias * 1.5,
    negativityBias: 1 + rumination.subprocesses.memoryBias * 0.8,
    graphDiffusionExtraHop: rumination.subprocesses.memoryBias > 0.5 ? 1 : 0,
    edgeThresholdReduction: rumination.subprocesses.memoryBias * 0.3,
  };
}
