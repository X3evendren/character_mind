/**
 * 12-Dimensional Mood System — empirical time constants from affective science.
 *
 * Each mood is a leaky integrator over emotion signals:
 *   dm/dt = −η·m(t) + A(t)    (Bennett et al., Psychological Review, 2022)
 *
 * Discrete: m_t = m_{t−1}·(1−η) + A_t
 *
 * Mood feeds back as a prior on future emotional computation (bidirectional loop).
 *
 * Empirical half-lives from:
 *   - Verduyn & Lavrijsen (2015): 27 emotions, N=233
 *   - Scherer & Wallbott (1994): 7 emotions, N=2,400+, 37 countries
 *   - Fan et al. (2018): minute-scale Twitter emotion dynamics
 */

import { clamp, capitalize } from "../utils";
import type { ForceField } from "./force-field";
import type { PAD } from "./cpm-pad";
import type { TDErrorResult } from "./td-error";

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

/** Per-round emotion signal window for mood integration */
export const MOOD_INTEGRATION_WINDOW = 3;

// ═══════════════════════════════════════════════════════════════
// Panksepp Primary Affective Systems (7 subcortical circuits)
// ═══════════════════════════════════════════════════════════════

export interface PankseppPrimarySystem {
  name: string;
  activation: number;       // 0–1 current activation
  threshold: number;        // activation threshold for output
  riseTime: number;         // how fast it ramps up (0–1)
  decayRate: number;        // leak rate per tick (0–1)
  neuroModulation: Record<string, number>; // cross-system modulation weights
}

export const PANIKSEPP_SYSTEMS: ReadonlyArray<Omit<PankseppPrimarySystem, "activation" | "neuroModulation"> & { defaultActivation: number; modulations: Record<string, number> }> = [
  {
    name: "SEEKING",
    defaultActivation: 0.5,
    threshold: 0.3,
    riseTime: 0.15,
    decayRate: 0.05,
    modulations: { PLAY: 0.2, FEAR: -0.15, PANIC_GRIEF: -0.1 },
  },
  {
    name: "RAGE",
    defaultActivation: 0.15,
    threshold: 0.4,
    riseTime: 0.25,
    decayRate: 0.15,
    modulations: { SEEKING: -0.2, CARE: -0.3, PLAY: -0.25, FEAR: -0.1 },
  },
  {
    name: "FEAR",
    defaultActivation: 0.15,
    threshold: 0.35,
    riseTime: 0.3,
    decayRate: 0.1,
    modulations: { SEEKING: -0.3, PLAY: -0.3, LUST: -0.2, CARE: 0.05 },
  },
  {
    name: "LUST",
    defaultActivation: 0.1,
    threshold: 0.4,
    riseTime: 0.2,
    decayRate: 0.08,
    modulations: { PLAY: 0.15, SEEKING: 0.1, PANIC_GRIEF: -0.2 },
  },
  {
    name: "CARE",
    defaultActivation: 0.3,
    threshold: 0.2,
    riseTime: 0.1,
    decayRate: 0.03,
    modulations: { PANIC_GRIEF: -0.4, PLAY: 0.2, SEEKING: 0.1, RAGE: -0.3, FEAR: 0.05 },
  },
  {
    name: "PANIC_GRIEF",
    defaultActivation: 0.1,
    threshold: 0.3,
    riseTime: 0.25,
    decayRate: 0.12,
    modulations: { SEEKING: -0.25, PLAY: -0.3, CARE: 0.3, FEAR: 0.15, LUST: -0.1 },
  },
  {
    name: "PLAY",
    defaultActivation: 0.2,
    threshold: 0.2,
    riseTime: 0.12,
    decayRate: 0.06,
    modulations: { SEEKING: 0.15, FEAR: -0.3, RAGE: -0.25, CARE: 0.1, PANIC_GRIEF: -0.2 },
  },
];

/** Initialize the 7 primary systems to default activations. */
export function initPrimarySystems(): Record<string, PankseppPrimarySystem> {
  const systems: Record<string, PankseppPrimarySystem> = {};
  for (const def of PANIKSEPP_SYSTEMS) {
    systems[def.name] = {
      name: def.name,
      activation: def.defaultActivation,
      threshold: def.threshold,
      riseTime: def.riseTime,
      decayRate: def.decayRate,
      neuroModulation: { ...def.modulations },
    };
  }
  return systems;
}

/**
 * Update the 7 Panksepp primary-process affective systems from
 * CPM/PAD appraisal, TD errors, and current mood state.
 *
 * Each system integrates bottom-up emotional signals with
 * top-down mood biasing and cross-system neuromodulation.
 */
export function updatePrimarySystems(
  systems: Record<string, PankseppPrimarySystem>,
  pad: PAD,
  td: TDErrorResult,
  mood: MoodSnapshot,
): void {
  // ── Compute raw drive signals from PAD + TD ──

  // SEEKING: appetitive motivation — pleasure + positive TD
  const seekingDrive = Math.max(0, pad.pleasure * 0.3 + Math.max(0, td.total) * 0.25 + mood.curious * 0.15);

  // RAGE: frustration — high arousal + negative TD + irritation
  const rageDrive = Math.max(0, pad.arousal * 0.25 + Math.max(0, -td.total) * 0.2 + mood.irritable * 0.2);

  // FEAR: threat detection — low safety + high arousal + negative TD + anxiety
  const fearDrive = Math.max(0, (1 - pad.pleasure) * 0.2 + pad.arousal * 0.2 + Math.max(0, -td.total) * 0.15 + mood.anxious * 0.25);

  // LUST: mild appetitive + low dominance (receptivity) + playful mood
  const lustDrive = Math.max(0, pad.pleasure * 0.15 + (1 - pad.dominance) * 0.1 + mood.playful * 0.1);

  // CARE: prosocial — positive pleasure + connection-driven + warm mood
  const careDrive = Math.max(0, pad.pleasure * 0.2 + mood.warm * 0.2 + mood.grateful * 0.1);

  // PANIC_GRIEF: separation distress — low pleasure + low dominance + pained mood
  const panicDrive = Math.max(0, (1 - pad.pleasure) * 0.25 + (1 - pad.dominance) * 0.15 + mood.anxious * 0.1);

  // PLAY: social joy — safety + positive arousal + playful mood
  const playDrive = Math.max(0, pad.pleasure * 0.2 + Math.max(0, pad.arousal - 0.3) * 0.15 + mood.playful * 0.2);

  const driveSignals: Record<string, number> = {
    SEEKING: seekingDrive,
    RAGE: rageDrive,
    FEAR: fearDrive,
    LUST: lustDrive,
    CARE: careDrive,
    PANIC_GRIEF: panicDrive,
    PLAY: playDrive,
  };

  // ── Apply rise/decay dynamics + cross-system modulation ──
  for (const [name, system] of Object.entries(systems)) {
    const drive = driveSignals[name] ?? 0;

    // Rise toward drive signal (bounded)
    const rise = Math.min(drive, system.riseTime * (1 - system.activation));

    // Decay toward baseline
    const baselineDef = PANIKSEPP_SYSTEMS.find(s => s.name === name);
    const baseline = baselineDef?.defaultActivation ?? 0.2;
    const decay = system.decayRate * (system.activation - baseline);

    // Cross-system neuromodulation
    let crossMod = 0;
    for (const [otherName, modWeight] of Object.entries(system.neuroModulation)) {
      const other = systems[otherName];
      if (other) {
        crossMod += other.activation * modWeight * 0.1;
      }
    }

    // Update activation
    system.activation = Math.max(0.01, Math.min(1, system.activation + rise - decay + crossMod));
  }
}

export interface MoodSnapshot {
  euthymic: number;
  irritable: number;
  anxious: number;
  vital: number;
  warm: number;
  confident: number;
  grateful: number;
  proud: number;
  curious: number;
  hopeful: number;
  awed: number;
  playful: number;
  /** Panksepp PANIC/GRIEF composite (0–1) */
  paniGrief: number;
  /** Cumulative regulation fatigue (0–1) */
  fatigue: number;
}

export const MOOD_DIMENSIONS = [
  "euthymic", "irritable", "anxious", "vital",
  "warm", "confident", "grateful", "proud",
  "curious", "hopeful", "awed", "playful",
] as const;

export type MoodDimension = typeof MOOD_DIMENSIONS[number];

export type MoodForces = Record<MoodDimension, Array<{
  name: string;
  /** contribution to the emotion signal A(t) for this mood dimension */
  signal: number;
}>>;

/**
 * Compute mood signals A(t) from current emotional state.
 * Each mood dimension has a specific integration source.
 *
 * Positive signal → mood rises; negative signal → mood drops.
 * Signals are clipped to [−1, 1] before integration.
 */
export function computeMoodSignals(
  pad: PAD,
  tdError: TDErrorResult,
  bisActivation: number,
  threatDetected: boolean,
  novelty: number,
  timeDepth: number,
  safetyValue: number,
  connectionValue: number,
  energyValue: number,
  masteryValue: number,
  arousalValue: number,
): MoodForces {
  return {
    // Layer 1: Core affective moods (Bennett/Eldar base)
    euthymic: [
      { name: "P_pleasure", signal: clamp(pad.pleasure * 0.3, -0.3, 0.4) },
      { name: "TD_positive", signal: clamp(tdError.total * 0.15, -0.2, 0.25) },
    ],
    irritable: [
      { name: "BIS_activation", signal: clamp(bisActivation * 0.35, -0.1, 0.5) },
      { name: "safety_drop", signal: clamp(-safetyValue * 0.2, -0.3, 0.3) },
    ],
    anxious: [
      { name: "threat_signal", signal: threatDetected ? 0.35 : -0.1 },
      { name: "safety_drop", signal: clamp(-safetyValue * 0.25, -0.2, 0.4) },
      { name: "uncertainty", signal: pad.arousal > 0.3 ? 0.15 : 0 },
    ],

    // Layer 2: Homeostasis-derived moods
    vital: [
      { name: "energy_above_setpoint", signal: clamp(energyValue * 0.25, -0.3, 0.3) },
      { name: "arousal_moderate", signal: clamp((0.5 - Math.abs(arousalValue - 0.5)) * 0.2, 0, 0.25) },
    ],
    warm: [
      { name: "connection_rise", signal: clamp(connectionValue * 0.2, -0.2, 0.3) },
      { name: "social_positive", signal: pad.pleasure > 0.2 ? 0.15 : 0 },
    ],
    confident: [
      { name: "mastery_positive", signal: clamp(masteryValue * 0.25, -0.25, 0.3) },
      { name: "TD_positive", signal: clamp(tdError.total * 0.1, -0.15, 0.2) },
    ],

    // Layer 3: Social evaluation moods
    grateful: [
      { name: "social_surprise_positive", signal: pad.pleasure > 0.3 && novelty > 0.4 ? 0.2 : 0 },
      { name: "connection_warmth", signal: clamp(connectionValue * 0.15, -0.1, 0.2) },
    ],
    proud: [
      { name: "mastery_win", signal: tdError.total > 0.15 ? 0.25 : 0 },
      { name: "dominance_high", signal: clamp(pad.dominance * 0.2, -0.1, 0.3) },
    ],

    // Layer 4: Cognitive-future moods
    curious: [
      { name: "novelty_positive", signal: clamp(novelty * 0.3, -0.1, 0.35) },
      { name: "boredom_inverse", signal: -0.1 }, // baseline boredom → curiosity signal
    ],
    hopeful: [
      { name: "future_positive_TD", signal: clamp(tdError.total * 0.2, -0.2, 0.3) },
      { name: "safety_ok", signal: safetyValue > 0.3 ? 0.1 : -0.1 },
    ],

    // Layer 5: Transcendent moods
    awed: [
      { name: "time_depth", signal: clamp(timeDepth * 0.25, -0.1, 0.3) },
      { name: "beauty_novelty", signal: novelty > 0.5 && pad.pleasure > 0.3 ? 0.2 : 0 },
    ],
    playful: [
      { name: "safety_x_connection", signal: clamp(safetyValue * connectionValue * 0.3, 0, 0.35) },
      { name: "positive_arousal", signal: pad.pleasure > 0 && pad.arousal > 0.2 ? 0.15 : 0 },
    ],
  };
}

/**
 * Update all 12 mood dimensions using their force fields.
 *
 * Each mood's ForceField.update() is called with forces derived
 * from the current emotion signals. The force field handles
 * its own dt, noise, regression.
 */
export function updateMoods(
  fields: Record<string, ForceField>,
  signals: MoodForces,
): MoodSnapshot {
  for (const dim of MOOD_DIMENSIONS) {
    const field = fields[`mood${capitalize(dim)}`];
    if (!field) continue;

    const dimSignals = signals[dim];
    const forces = dimSignals.map(s => ({
      name: s.name,
      direction: (s.signal >= 0 ? 1 : -1) as 1 | -1,
      magnitude: Math.abs(s.signal),
      weight: 1.0,
    }));

    field.update(forces);
  }

  return snapshotMoods(fields);
}

export function snapshotMoods(fields: Record<string, ForceField>): MoodSnapshot {
  return {
    euthymic:  fields.moodEuthymic?.value  ?? 0.5,
    irritable: fields.moodIrritable?.value ?? 0.3,
    anxious:   fields.moodAnxious?.value   ?? 0.3,
    vital:     fields.moodVital?.value     ?? 0.5,
    warm:      fields.moodWarm?.value      ?? 0.5,
    confident: fields.moodConfident?.value ?? 0.5,
    grateful:  fields.moodGrateful?.value  ?? 0.5,
    proud:     fields.moodProud?.value     ?? 0.4,
    curious:   fields.moodCurious?.value   ?? 0.5,
    hopeful:   fields.moodHopeful?.value   ?? 0.5,
    awed:      fields.moodAwed?.value      ?? 0.4,
    playful:   fields.moodPlayful?.value   ?? 0.5,
    paniGrief: fields.moodPaniGrief?.value ?? 0.1,
    fatigue:   fields.moodFatigue?.value   ?? 0,
  };
}

/**
 * Mood → downstream feedback loops.
 *
 * Mood biases future emotional computation as a prior:
 *   - CPM appraisal bias
 *   - PAD baseline shift
 *   - TD error learning rate modulation
 *   - Consciousness stream weight modulation
 */
export function computeMoodFeedbacks(mood: MoodSnapshot): {
  cpmBias: {
    goalRelevance: number;
    conduciveness: number;
    power: number;
    suddenness: number;
  };
  padShift: { P: number; A: number; D: number };
  learningRateMod: number;
  thoughtWeightMod: number;
} {
  const m = mood;

  return {
    cpmBias: {
      goalRelevance:  m.euthymic * 0.15  - m.irritable * 0.1  - m.hopeful * 0.1,
      conduciveness:  m.euthymic * 0.2   - m.irritable * 0.15 - m.anxious * 0.1,
      power:          m.confident * 0.25  - m.anxious * 0.3    - m.proud * 0.15,
      suddenness:     m.anxious * 0.2    + m.irritable * 0.1,
    },

    padShift: {
      P: (m.euthymic - 0.5) * 0.2   + m.grateful * 0.1   - m.irritable * 0.08 - m.warm * 0.05,
      A: m.anxious * 0.2            + m.vital * 0.15       + m.curious * 0.1  - m.euthymic * 0.08,
      D: m.confident * 0.2          + m.euthymic * 0.08    + m.playful * 0.08 - m.anxious * 0.2 - m.proud * 0.1,
    },

    learningRateMod:
      1 + (1 - m.euthymic) * 0.15 + m.anxious * 0.08 - m.playful * 0.05,

    thoughtWeightMod:
      1 + m.curious * 0.2 + m.awed * 0.15 - m.irritable * 0.05,
  };
}

// Helpers: clamp imported from ../utils
