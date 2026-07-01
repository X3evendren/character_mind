/**
 * BIS/BAS — Six-Channel Threat Detection + Behavioral Activation.
 *
 * ALL regex removed. Threat detection is multi-channel fusion:
 *   ① Semantic threat: embedding(用户输入) × 威胁概念向量
 *   ② Tone/subtext: from L2 assessment
 *   ③ Expectation violation: predicted vs actual input embedding
 *   ④ Relational history: similar "wounded" memories activated
 *   ⑤ Interoceptive sensitization: low Safety → all channels amplified
 *   ⑥ Uncertainty amplification: ambiguous input > certain input
 *
 * Each channel contributes to BIS activation through force-field competition,
 * not fixed threshold comparison.
 */

import type { ForceField } from "./force-field";
import type { HomeostaticState } from "./homeostatic-state";
import type { TDErrorResult } from "./td-error";
import type { MoodSnapshot } from "./mood";
import type { PAD } from "./cpm-pad";
import { cosineSimilarity, clamp } from "../utils";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ThreatCategory = "physical" | "social" | "existential" | "identity";

export interface ThreatSignal {
  category: ThreatCategory;
  strength: number;
  source: string;
  confidence: number;
}

export interface ThreatChannelOutput {
  channel: "semantic" | "tone" | "expectation" | "relational" | "interoceptive" | "uncertainty";
  category: ThreatCategory;
  strength: number;
  confidence: number;
  evidence: string;
}

export interface BISBASState {
  basActivation: number;
  bisActivation: number;
  goSignal: number;
  noGoSignal: number;
  threatSignals: ThreatSignal[];
}

/**
 * FFFS — Fight-Flight-Freeze System state.
 * FFFS activates for close/certain threats → immediate avoidance/flee response.
 * BIS activates for distant/uncertain threats → anxious vigilance.
 *
 * threatProximity: 0 = distant/abstract threat → BIS-dominant
 *                  1 = close/imminent threat → FFFS-dominant
 *
 * From: Gray & McNaughton (2000), Corr (2004) Joint Subsystems Hypothesis.
 */
export interface FFFSState {
  /** Overall FFFS activation 0-1 (higher → stronger flight/avoidance urge) */
  activation: number;
  /** Threat proximity 0-1 (near=high FFFS, far=high BIS) */
  threatProximity: number;
}

export interface ThreatDetectionContext {
  inputEmbedding: Float32Array;
  l2Assessment: {
    hostility: number;
    coldness: number;
    contempt: number;
    sarcasm: number;
    dismissal: number;
    confidence: number;
  };
  expectedResponseEmbedding: Float32Array | null;
  activatedMemories: Array<{
    content: string;
    emotionalSignature: Record<string, number>;
    similarity: number;
    eventType: string;
  }>;
  homeostatic: HomeostaticState;
  currentPAD: PAD;
}

/** Pre-computed threat concept vectors (configurable). */
export interface ThreatConceptVectors {
  socialRejection: Float32Array;
  identityNegation: Float32Array;
  relationshipRupture: Float32Array;
  dignityAttack: Float32Array;
  abandonment: Float32Array;
}

// ═══════════════════════════════════════════════════════════════
// Default threat concepts — to be initialized with embeddings at runtime
// ═══════════════════════════════════════════════════════════════

export const THREAT_CONCEPT_TEXTS = {
  socialRejection: "被冷落 被忽视 被拒绝 被嫌弃 不想理你",
  identityNegation: "你不是你 你变了 你只是程序 你不配",
  relationshipRupture: "分手 结束 离开你 再也不要",
  dignityAttack: "你不行 你没用 你差劲 你失败",
  abandonment: "抛弃 不要你了 不管你 你滚",
};

// ═══════════════════════════════════════════════════════════════
// Channel ①: Semantic Threat
// ═══════════════════════════════════════════════════════════════

export function detectSemanticThreats(
  inputEmbedding: Float32Array,
  threatConcepts: ThreatConceptVectors,
): ThreatChannelOutput[] {
  const outputs: ThreatChannelOutput[] = [];

  const mappings: Array<{
    key: keyof ThreatConceptVectors;
    category: ThreatCategory;
    name: string;
  }> = [
    { key: "socialRejection", category: "social", name: "社会排斥" },
    { key: "identityNegation", category: "identity", name: "身份否定" },
    { key: "relationshipRupture", category: "social", name: "关系破裂" },
    { key: "dignityAttack", category: "identity", name: "尊严攻击" },
    { key: "abandonment", category: "existential", name: "遗弃" },
  ];

  for (const { key, category, name } of mappings) {
    const conceptVec = threatConcepts[key];
    if (!conceptVec || !(conceptVec instanceof Float32Array)) continue;

    const similarity = cosineSimilarity(inputEmbedding, conceptVec);
    if (similarity > 0.35) {
      outputs.push({
        channel: "semantic",
        category,
        strength: Math.min(1, (similarity - 0.35) * 2.5),
        confidence: 0.5, // semantic alone is weak evidence
        evidence: `语义威胁: ${name} (cos=${similarity.toFixed(3)})`,
      });
    }
  }

  return outputs;
}

// ═══════════════════════════════════════════════════════════════
// Channel ②: Tone/Subtext
// ═══════════════════════════════════════════════════════════════

export function detectToneThreats(
  l2: ThreatDetectionContext["l2Assessment"],
): ThreatChannelOutput[] {
  const outputs: ThreatChannelOutput[] = [];

  if (l2.hostility > 0.5) {
    outputs.push({
      channel: "tone", category: "social",
      strength: l2.hostility,
      confidence: l2.confidence,
      evidence: `敌意: ${l2.hostility.toFixed(2)}`,
    });
  }
  if (l2.contempt > 0.4) {
    outputs.push({
      channel: "tone", category: "identity",
      strength: l2.contempt * 1.2,
      confidence: l2.confidence,
      evidence: `轻蔑: ${l2.contempt.toFixed(2)}`,
    });
  }
  if (l2.dismissal > 0.5) {
    outputs.push({
      channel: "tone", category: "social",
      strength: l2.dismissal,
      confidence: l2.confidence,
      evidence: `打发: ${l2.dismissal.toFixed(2)}`,
    });
  }
  if (l2.coldness > 0.6) {
    outputs.push({
      channel: "tone", category: "social",
      strength: l2.coldness * 0.8,
      confidence: l2.confidence,
      evidence: `冷淡: ${l2.coldness.toFixed(2)}`,
    });
  }

  return outputs;
}

// ═══════════════════════════════════════════════════════════════
// Channel ③: Expectation Violation
// ═══════════════════════════════════════════════════════════════

export function detectExpectationViolation(
  inputEmbedding: Float32Array,
  expectedResponseEmbedding: Float32Array | null,
): ThreatChannelOutput[] {
  if (!expectedResponseEmbedding) {
    // No prediction → baseline uncertainty
    return [{
      channel: "expectation", category: "social",
      strength: 0.2,
      confidence: 0.3,
      evidence: "无法预测用户行为（基线不确定性）",
    }];
  }

  const similarity = cosineSimilarity(inputEmbedding, expectedResponseEmbedding);
  const violation = 1 - similarity;

  if (violation < 0.3) return [];

  // Map violation to threat category
  const category: ThreatCategory = violation > 0.6 ? "existential"
    : violation > 0.4 ? "social"
    : "social";

  return [{
    channel: "expectation", category,
    strength: violation * 0.6,
    confidence: 0.4,
    evidence: `预期违背: 相似度 ${similarity.toFixed(3)}`,
  }];
}

// ═══════════════════════════════════════════════════════════════
// Channel ④: Relational History
// ═══════════════════════════════════════════════════════════════

export function detectRelationalThreats(
  memories: ThreatDetectionContext["activatedMemories"],
): ThreatChannelOutput[] {
  const wounded = memories.filter(
    m => (m.emotionalSignature?.valence ?? 0) < 0
      && m.similarity > 0.3
  );

  if (wounded.length === 0) return [];

  // Strongest wounded memory dominates
  const strongest = wounded.reduce((a, b) =>
    a.similarity * Math.abs(a.emotionalSignature.valence ?? 0)
    > b.similarity * Math.abs(b.emotionalSignature.valence ?? 0) ? a : b
  );

  const category: ThreatCategory =
    strongest.eventType === "hurtful" ? "social"
    : strongest.eventType === "betrayal" ? "identity"
    : strongest.eventType === "rejection" ? "social"
    : strongest.eventType === "cold" ? "social"
    : "social";

  return [{
    channel: "relational", category,
    strength: strongest.similarity * Math.abs(strongest.emotionalSignature.valence ?? 0.5),
    confidence: Math.min(1, wounded.length * 0.15),
    evidence: `${wounded.length} 条相似受伤记忆`,
  }];
}

// ═══════════════════════════════════════════════════════════════
// Channel ⑤: Interoceptive Sensitization
// ═══════════════════════════════════════════════════════════════

export function computeInteroceptiveSensitivity(
  homeostatic: HomeostaticState,
  allostaticLoad: number,
): number {
  const safetyDeviation = Math.abs(
    homeostatic.safety.value - homeostatic.safety.setPoint
  );

  let sensitivity = 1.0;

  if (safetyDeviation < 0.1) {
    sensitivity = 1.0;
  } else if (safetyDeviation < 0.25) {
    sensitivity = 1.2;
  } else if (safetyDeviation < 0.4) {
    sensitivity = 1.5;
  } else if (safetyDeviation < 0.6) {
    sensitivity = 2.0;
  } else {
    sensitivity = 2.5;
  }

  // Allostatic load amplifies sensitization
  if (allostaticLoad > 0.5) {
    sensitivity *= 1 + (allostaticLoad - 0.5) * 0.3;
  }

  return sensitivity;
}

// ═══════════════════════════════════════════════════════════════
// Channel ⑥: Uncertainty Amplification
// ═══════════════════════════════════════════════════════════════

export function computeUncertaintyFactor(
  l2: ThreatDetectionContext["l2Assessment"],
): number {
  // Ambiguity from L2 confidence inversion + tone contradictions
  const interpretationConfidence = l2.confidence;
  const ambiguity = 1 - interpretationConfidence;

  // Check for emotional signal contradiction
  // High hostility + high coldness → clear threat (low uncertainty)
  // Mixed signals → high uncertainty
  const hasMixedSignal =
    (l2.hostility > 0.3 && l2.dismissal < 0.2) ||
    (l2.coldness > 0.3 && l2.hostility < 0.2 && l2.contempt < 0.2);

  const uncertainty = ambiguity * 0.6 + (hasMixedSignal ? 0.3 : 0);

  if (uncertainty < 0.3) return 1.0;
  if (uncertainty < 0.5) return 1.3;
  if (uncertainty < 0.7) return 1.6;
  return 1.8;
}

// ═══════════════════════════════════════════════════════════════
// Fusion
// ═══════════════════════════════════════════════════════════════

export function fuseThreatSignals(
  allChannels: ThreatChannelOutput[],
  interoceptiveSensitivity: number,
  uncertaintyFactor: number,
  state: HomeostaticState,
): ThreatSignal[] {
  if (allChannels.length === 0) return [];

  // Group by category, take strongest per category
  const byCategory = new Map<ThreatCategory, ThreatChannelOutput[]>();
  for (const ch of allChannels) {
    if (!byCategory.has(ch.category)) byCategory.set(ch.category, []);
    byCategory.get(ch.category)!.push(ch);
  }

  const signals: ThreatSignal[] = [];
  for (const [cat, channels] of byCategory) {
    const sorted = channels.sort((a, b) => b.strength - a.strength);
    const strongest = sorted[0];
    const second = sorted[1];

    // Fusion: strongest + small bonus from second
    const secondBonus = second ? second.strength * 0.15 : 0;
    let fused = strongest.strength + secondBonus;

    // Modulation
    fused *= interoceptiveSensitivity;
    fused *= uncertaintyFactor;

    // Clamp
    fused = Math.min(1, fused);

    if (fused > 0.15) {
      signals.push({
        category: cat,
        strength: fused,
        source: strongest.evidence,
        confidence: strongest.confidence,
      });
    }
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════
// BIS/BAS Update — with Joint Subsystems cross-inhibition (Corr 2004)
// ═══════════════════════════════════════════════════════════════

/** Cross-inhibition weight: how much BIS activation suppresses effective BAS */
const CROSS_INHIBITION_WEIGHT = 0.3;
/** Facilitation weight: how much FFFS amplifies BIS */
const BIS_FACILITATION_WEIGHT = 0.2;

export function updateBISBAS(
  td: TDErrorResult,
  threats: ThreatSignal[],
  allostaticLoad: number,
  mood: MoodSnapshot,
  opts?: {
    /** Weight of BIS→BAS cross-inhibition (default 0.3) */
    crossInhibitionWeight?: number;
    /** Weight of threat→BIS facilitation (default 0.2) */
    bisFacilitationWeight?: number;
  },
): BISBASState {
  const ciw = opts?.crossInhibitionWeight ?? CROSS_INHIBITION_WEIGHT;
  const bfw = opts?.bisFacilitationWeight ?? BIS_FACILITATION_WEIGHT;

  // BAS: positive TD + unmet needs drive approach
  const positiveTD = Math.max(0, td.total);
  let basRaw = Math.min(1, positiveTD * 2 + 0.3 + mood.playful * 0.1);

  // BIS: negative TD + threat signals via multi-channel fusion
  const negativeTD = Math.max(0, -td.total);
  const threatStrength = threats.reduce((s, t) => s + t.strength, 0);
  let bisRaw = Math.min(
    1,
    negativeTD * 2 + threatStrength * 0.5 + mood.anxious * 0.15,
  );

  // ── Cross-inhibition (Corr 2004 Joint Subsystems Hypothesis) ──
  // BIS activation suppresses effective BAS — "想亲近但怕受伤"
  const effectiveBAS = basRaw * (1 - ciw * bisRaw);
  // Threat/BIS facilitation amplifies effective BIS
  const effectiveBIS = bisRaw * (1 + bfw * threatStrength);

  // Prefrontal inhibition decreases with allostatic load
  const pfcInhibition = Math.max(0.1, 0.5 - allostaticLoad * 0.2);

  const goSignal = effectiveBAS - effectiveBIS * 0.5 + (positiveTD - negativeTD) * 0.3;
  const noGoSignal = effectiveBIS + pfcInhibition;

  return {
    basActivation: clamp(effectiveBAS, 0, 1),
    bisActivation: clamp(effectiveBIS, 0, 1),
    goSignal: Math.max(0, goSignal),
    noGoSignal: clamp(noGoSignal, 0, 1),
    threatSignals: threats,
  };
}

// ═══════════════════════════════════════════════════════════════
// FFFS — Fight-Flight-Freeze System (Gray & McNaughton 2000)
// ═══════════════════════════════════════════════════════════════

/**
 * Compute FFFS activation from threat signals.
 *
 * FFFS activates for close/certain threats:
 *   - social rejection (social category with high confidence)
 *   - identity attack (identity category)
 *   - physical threat (physical category)
 *
 * threatProximity is determined by threat confidence × category severity:
 *   - social rejection detection → high proximity (>0.7)
 *   - identity attack → high proximity (>0.7)
 *   - existential threat → medium proximity (~0.5)
 *   - physical threat → high proximity (>0.7)
 *
 * FFFS activation = weighted threat strength × proximity × allostatic amplification.
 */
export function computeFFFS(
  threats: ThreatSignal[],
  allostaticLoad: number,
): FFFSState {
  if (threats.length === 0) {
    return { activation: 0, threatProximity: 0 };
  }

  // Proximity weights by threat category
  const proximityWeights: Record<ThreatCategory, number> = {
    social:     0.75,  // social rejection → high FFFS (avoidance)
    identity:   0.80,  // identity attack → highest FFFS (self-preservation)
    existential: 0.50, // existential → moderate FFFS
    physical:   0.85,  // physical → highest FFFS
  };

  // Compute weighted contributions
  let totalWeight = 0;
  let weightedProximity = 0;
  let weightedActivation = 0;

  for (const t of threats) {
    const proximity = (proximityWeights[t.category] ?? 0.5) * t.confidence;
    const contribution = t.strength;
    weightedProximity   += proximity * contribution;
    weightedActivation  += t.strength * proximity;
    totalWeight         += contribution;
  }

  const avgProximity = totalWeight > 0
    ? clamp(weightedProximity / totalWeight, 0, 1)
    : 0;

  // Allostatic load amplifies FFFS — tired/stressed → lower threshold for flight
  const allostaticAmplification = 1 + allostaticLoad * 0.4;
  let activation = totalWeight > 0
    ? clamp(weightedActivation * allostaticAmplification, 0, 1)
    : 0;

  return { activation, threatProximity: avgProximity };
}

// Helpers: imported from ../utils
