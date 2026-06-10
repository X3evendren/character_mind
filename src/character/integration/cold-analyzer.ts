/** Cold Path cache — consumed by Hot Path on the next turn. */
import type { PsychologyResult } from "../mind/psychology-engine";
import { EmotionResult, AppraisalResult, MotivationResult, AttachmentResult, DefenseResult, RelationResult } from "../mind/psychology-engine";
import type { AffectiveVector } from "../consciousness/affective-residue";

export interface ColdCache {
  // Layer 0
  affectiveResidueText: string;
  affectiveVector: AffectiveVector;
  // Layer 1
  temporalHorizonText: string;
  // Layer 2
  emotion: EmotionResult;
  appraisal: AppraisalResult;
  motivation: MotivationResult;
  attachment: AttachmentResult;
  defense: DefenseResult;
  relation: RelationResult;
  innerMonologue: string;
  // Layer 3
  selfNarrativeText: string;
  // Meta
  completedAt: number;
  turnGenerated: number;
}

export interface ColdAnalyzeParams {
  input: string;
  response: string;
  taskMode: boolean;
  mindState: any;
  drives: any;
  assistantConfig: any;
  previousResidueVector: AffectiveVector;
  previousRetention: { emotionDominant: string; emotionIntensity: number; unfinished: boolean };
  timeSinceLastTurn: number;
  selfNarrative: string;
  growthLog: any[];
  snapshot: string;
}

/** Create a default coldCache — used for first turn / fallback */
export function createDefaultColdCache(): ColdCache {
  return {
    affectiveResidueText: "",
    affectiveVector: { warmth: 0, weight: 0.3, clarity: 0.1, tension: 0 },
    temporalHorizonText: "",
    emotion: new EmotionResult(),
    appraisal: new AppraisalResult(),
    motivation: new MotivationResult(),
    attachment: new AttachmentResult(),
    defense: new DefenseResult(),
    relation: new RelationResult(),
    innerMonologue: "",
    selfNarrativeText: "",
    completedAt: 0,
    turnGenerated: -1,
  };
}

/**
 * Rule-based quick emotion detection — 0 tokens, <1ms.
 * Used as fallback when coldCache is empty (first turn).
 */
const POSITIVE_WORDS = ["开心","高兴","喜欢","爱","谢谢","太好了","哈哈","嘿嘿","不错","好耶","nice","great","love"];
const NEGATIVE_WORDS = ["难过","伤心","生气","讨厌","烦","无聊","累","痛苦","焦虑","害怕","sad","angry","tired"];
const SURPRISE_WORDS = ["哇","天哪","居然","没想到","什么","what","wow"];
const TRUST_WORDS = ["相信","告诉你","秘密","我觉得","其实","说实话"];

export function detectEmotionHeuristic(input: string): { dominant: string; intensity: number; pleasure: number } {
  const lower = input.toLowerCase();
  let posCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  let negCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  let surCount = SURPRISE_WORDS.filter(w => lower.includes(w)).length;
  let truCount = TRUST_WORDS.filter(w => lower.includes(w)).length;

  if (posCount > negCount && posCount > surCount) {
    return { dominant: "joy", intensity: Math.min(0.8, 0.3 + posCount * 0.15), pleasure: 0.5 };
  }
  if (negCount > posCount) {
    return { dominant: "sadness", intensity: Math.min(0.8, 0.3 + negCount * 0.15), pleasure: -0.3 };
  }
  if (surCount > 0) {
    return { dominant: "surprise", intensity: 0.5, pleasure: 0.1 };
  }
  if (truCount > 0) {
    return { dominant: "trust", intensity: 0.4, pleasure: 0.3 };
  }
  return { dominant: "neutral", intensity: 0.3, pleasure: 0.0 };
}
