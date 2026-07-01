/**
 * Multi-dimensional TD Error system.
 * δᵢ = rᵢ + γ × Vᵢ(s') − Vᵢ(s)
 *
 * This is the UNIFIED affective signal — pleasure/disappointment/habituation/learning
 * all flow from a single formula. Replaces the multi-module parameter system:
 *   saturation.ts (32 lerp), drives.ts (5 drives), emotion.ts (AffectiveResidue), sublimator.ts
 */

import type { HomeostaticState, HomeostaticSnapshot } from "./homeostatic-state";

// ── Value function weights ──

const V_WEIGHTS: Record<string, number> = {
  energy: 0.15,
  arousal: 0.05,
  safety: 0.30,
  connection: 0.30,
  mastery: 0.20,
};

const GAMMA = 0.9;        // temporal discount
const ALPHA_BASE = 0.15;   // base learning rate
const VARIABLE_NAMES = ["energy", "arousal", "safety", "connection", "mastery"] as const;

export type VariableName = (typeof VARIABLE_NAMES)[number];

// ── OpAL dual-channel learning constants (Collins & Frank 2014) ──

/** D1/Go channel learning rate (positive δ) */
const ALPHA_G = 0.12;
/** D2/NoGo channel learning rate (negative δ) */
const ALPHA_N = 0.08;
/** Go weight (β_G): sensitivity to benefits */
const BETA_G = 1.0;
/** NoGo weight (β_N): sensitivity to costs */
const BETA_N = 0.8;

/** Go/NoGo weights type — Hebbian three-term product accumulator */
export type GoNoGoWeights = Record<VariableName, number>;

/** Initialize fresh Go/NoGo weights */
export function initGoWeights(): GoNoGoWeights {
  return { energy: 0.5, arousal: 0.5, safety: 0.5, connection: 0.5, mastery: 0.5 };
}

export function initNoGoWeights(): GoNoGoWeights {
  return { energy: 0.3, arousal: 0.3, safety: 0.3, connection: 0.3, mastery: 0.3 };
}

// ── TD Error result ──

export interface TDErrorResult {
  energy: number;
  arousal: number;
  safety: number;
  connection: number;
  mastery: number;
  /** Weighted sum of all δ */
  total: number;
  /** Dominant δ dimension */
  dominant: VariableName;
}

// ── Value function ──

export function computeV(
  state: HomeostaticState,
): Record<VariableName, number> {
  const v: Record<string, number> = {};
  for (const name of VARIABLE_NAMES) {
    v[name] = V_WEIGHTS[name] * state.deviation(name);
  }
  return v as Record<VariableName, number>;
}

export function totalV(state: HomeostaticState): number {
  let sum = 0;
  for (const name of VARIABLE_NAMES) {
    sum += V_WEIGHTS[name] * state.deviation(name);
  }
  return Math.max(-1, Math.min(1, sum));
}

// ── Endogenous homeostatic reward ──

/**
 * Compute endogenous homeostatic reward from before/after snapshots.
 *
 * r_homeo[a] = D_before[a] − D_after[a]
 *
 * where D is the absolute deviation from setpoint.
 * A positive reward means the variable moved closer to its setpoint
 * (deviation decreased); negative means it moved further away.
 *
 * Usage pattern:
 *   const before = homeostatic.snapshot();
 *   // ... apply rewards / tick ...
 *   const after = homeostatic.snapshot();
 *   const rHomeo = computeHomeostaticReward(before, after);
 */
export function computeHomeostaticReward(
  before: HomeostaticSnapshot,
  after: HomeostaticSnapshot,
): Record<VariableName, number> {
  const rewards: Record<VariableName, number> = { energy: 0, arousal: 0, safety: 0, connection: 0, mastery: 0 };
  for (const name of VARIABLE_NAMES) {
    const D_before = Math.abs(before[name] - before.setPoints[name]);
    const D_after  = Math.abs(after[name]  - after.setPoints[name]);
    rewards[name] = D_before - D_after;
  }
  return rewards;
}

// ── L0 reward rules (0 token, <1ms) ──

interface RewardRule {
  pattern: RegExp;
  rewards: Record<VariableName, number>;
}

const REWARD_RULES: RewardRule[] = [
  { pattern: /我想你|我爱你|喜欢你|离不开你/, rewards: { energy: 0, arousal: 0.05, safety: 0.02, connection: 0.15, mastery: 0 } },
  { pattern: /晚安|再见.*依恋|舍不得/,     rewards: { energy: 0, arousal: 0, safety: 0, connection: 0.05, mastery: 0 } },
  { pattern: /你真没用|你帮不了我|你真让人失望/, rewards: { energy: 0, arousal: 0, safety: -0.15, connection: -0.10, mastery: -0.25 } },
  { pattern: /谢谢|你帮了大忙|多亏了你/,   rewards: { energy: 0, arousal: 0, safety: 0.05, connection: 0.05, mastery: 0.15 } },
  { pattern: /你累了吗|还好吗|担心你/,     rewards: { energy: 0, arousal: 0, safety: 0.05, connection: 0.20, mastery: 0 } },
  { pattern: /不理你了|不想和你说话|不用了/, rewards: { energy: 0, arousal: 0, safety: -0.05, connection: -0.15, mastery: 0 } },
  { pattern: /你说得对|你的判断很准/,      rewards: { energy: 0, arousal: 0, safety: 0.08, connection: 0, mastery: 0.18 } },
  { pattern: /你错了|你根本不懂|你在胡说/, rewards: { energy: 0, arousal: 0, safety: -0.10, connection: 0, mastery: -0.15 } },
  { pattern: /我很难过|崩溃|绝望|想哭/,    rewards: { energy: -0.02, arousal: 0.10, safety: -0.05, connection: 0, mastery: 0 } },
  { pattern: /好开心|太棒了|哈哈哈/,       rewards: { energy: 0.02, arousal: 0.05, safety: 0.05, connection: 0.03, mastery: 0 } },
  { pattern: /我好害怕|恐怖|吓人/,         rewards: { energy: -0.02, arousal: 0.15, safety: -0.10, connection: 0, mastery: 0 } },
  { pattern: /我生[气你].*了|太过分了/,    rewards: { energy: 0, arousal: 0.10, safety: -0.05, connection: -0.05, mastery: 0 } },
  { pattern: /好无聊|没意思|没兴趣/,       rewards: { energy: -0.05, arousal: -0.02, safety: 0, connection: -0.02, mastery: 0 } },
  { pattern: /教我|教教|我不会|怎么做/,    rewards: { energy: 0, arousal: 0.02, safety: 0, connection: 0, mastery: 0.10 } },
];

/** Compute rule-based reward vector from user input (L0, 0 token) */
export function computeRuleRewards(input: string): Record<VariableName, number> {
  const rewards: Record<VariableName, number> = { energy: 0, arousal: 0, safety: 0, connection: 0, mastery: 0 };
  for (const rule of REWARD_RULES) {
    if (rule.pattern.test(input)) {
      for (const name of VARIABLE_NAMES) {
        rewards[name] += rule.rewards[name];
      }
    }
  }
  return rewards;
}

// ── TD Error computation ──

export function computeTDErrors(
  rewards: Record<VariableName, number>,
  vCurrent: Record<VariableName, number>,
  vNext: Record<VariableName, number>,
): TDErrorResult {
  const td: Record<string, number> = {};
  for (const name of VARIABLE_NAMES) {
    td[name] = rewards[name] + GAMMA * vNext[name] - vCurrent[name];
  }

  // Find dominant dimension
  let dominant: VariableName = "connection";
  let maxAbs = 0;
  for (const name of VARIABLE_NAMES) {
    if (Math.abs(td[name]) > maxAbs) {
      maxAbs = Math.abs(td[name]);
      dominant = name;
    }
  }

  return {
    energy: td.energy,
    arousal: td.arousal,
    safety: td.safety,
    connection: td.connection,
    mastery: td.mastery,
    total: VARIABLE_NAMES.reduce((s, n) => s + td[n] * V_WEIGHTS[n], 0),
    dominant,
  };
}

/**
 * Update V(s) using OpAL dual-channel TD learning (Collins & Frank 2014).
 *
 * Go channel (D1): learns from positive δ — encodes benefits.
 * NoGo channel (D2): learns from negative δ — encodes costs.
 * Hebbian three-term product: weight × δ × eligibility.
 *
 * V[a] = β_G × Go[a] - β_N × NoGo[a]
 */
export function updateV(
  v: Record<VariableName, number>,
  td: TDErrorResult,
): void {
  for (const name of VARIABLE_NAMES) {
    const delta = td[name];
    const alpha = Math.min(0.5, Math.max(0.05, ALPHA_BASE * (1 + Math.abs(delta))));
    v[name] += alpha * delta;
  }
}

/**
 * OpAL dual-channel update — Go/NoGo with asymmetric learning rates.
 * Use this INSTEAD of the symmetric updateV when Go/NoGo weights are available.
 */
export function updateV_opAL(
  v: Record<VariableName, number>,
  goWeights: GoNoGoWeights,
  noGoWeights: GoNoGoWeights,
  td: TDErrorResult,
  alphaG = ALPHA_G,
  alphaN = ALPHA_N,
  betaG = BETA_G,
  betaN = BETA_N,
): void {
  for (const name of VARIABLE_NAMES) {
    const delta = td[name];

    // Hebbian three-term product: weight × δ × eligibility
    // Go channel — learns from positive δ only
    if (delta > 0) {
      goWeights[name] += alphaG * goWeights[name] * delta;
    } else {
      // Negative δ weakens Go weights
      goWeights[name] += alphaG * goWeights[name] * delta * 0.5;
    }
    goWeights[name] = Math.max(0, goWeights[name]);

    // NoGo channel — learns from negative δ
    if (delta < 0) {
      noGoWeights[name] += alphaN * noGoWeights[name] * (-delta);
    }
    noGoWeights[name] = Math.max(0, noGoWeights[name]);

    // Combined value: Go excitation − NoGo inhibition
    v[name] = betaG * goWeights[name] - betaN * noGoWeights[name];
  }
}
