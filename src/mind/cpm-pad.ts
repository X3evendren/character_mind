/**
 * CPM 4-dimensional event appraisal + PAD 3-dimensional emotion space.
 *
 * CPM: suddenness, goal_relevance, conduciveness, power
 * PAD: Pleasure, Arousal, Dominance
 *
 * PAD is computed from CPM + TD errors + allostatic load.
 * PAD then maps to generation parameters (temperature, top_p, max_tokens).
 */

import type { TDErrorResult } from "./td-error";
import type { HomeostaticState } from "./homeostatic-state";

// ── CPM Appraisal ──

export interface CPMAppraisal {
  suddenness: number;       // 0-1, how unexpected
  goalRelevance: number;    // 0-1, how relevant to needs
  conduciveness: number;    // -1 to 1, favorable or not
  power: number;            // 0-1, agent's control
}

export function computeCPM(
  td: TDErrorResult,
  allostaticLoad: number,
  availableTools: number,
  transitionFrequency: number,
): CPMAppraisal {
  // Suddenness: inverse of transition frequency
  const suddenness = Math.min(1, 1 / (transitionFrequency + 0.01));

  // Goal relevance: magnitude of TD error + allostatic amplification
  const goalRelevance = Math.min(1,
    Math.abs(td.total) * (1 + allostaticLoad / 2)
  );

  // Conduciveness: sign of weighted TD error
  const conduciveness = Math.max(-1, Math.min(1, td.total));

  // Power: available tools + strategies
  const power = (availableTools + 1) / (availableTools + 2);

  return { suddenness, goalRelevance, conduciveness, power };
}

// ── PAD Emotion Space ──

export interface PAD {
  pleasure: number;   // -1 to 1
  arousal: number;    // 0 to 1
  dominance: number;  // 0 to 1
}

export function computePAD(
  cpm: CPMAppraisal,
  td: TDErrorResult,
  allostaticLoad: number,
  recentSuccessRate: number,
): PAD {
  const pleasure = cpm.conduciveness * 0.6
    + td.connection * 0.3
    + td.mastery * 0.1;

  const arousal = cpm.goalRelevance * 0.5
    + Math.abs(td.total) * 0.3
    + Math.min(1, allostaticLoad) * 0.2;

  const dominance = cpm.power * 0.5
    + td.mastery * 0.3
    + recentSuccessRate * 0.2;

  return {
    pleasure: Math.max(-1, Math.min(1, pleasure)),
    arousal: Math.max(0, Math.min(1, arousal)),
    dominance: Math.max(0, Math.min(1, dominance)),
  };
}

// ── PAD → Generation Parameters ──

export interface GenParams {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export function padToGenParams(
  pad: PAD,
  state: HomeostaticState,
  baseTemp?: number,
  baseMaxTokens?: number,
): GenParams {
  const bt = baseTemp ?? 0.7;
  const bmt = baseMaxTokens ?? 500;

  // Temperature: pleasure↑→warmer, high-arousal→cautious, dominance→freer
  const temp = bt
    + pad.pleasure * 0.08
    + (pad.arousal - 0.5) * 0.1
    + pad.dominance * 0.05;

  // Energy factor
  const energyFactor = state.energy.value < 0.4 ? 0.7
    : state.energy.value > 0.8 ? 1.2
    : 1.0;

  // Mastery factor
  const masteryFactor = state.mastery.value < 0.3 ? 0.8 : 1.0;

  const maxTokens = Math.round(bmt * energyFactor * masteryFactor);

  // Top-p: high arousal → narrow attention (lower top-p)
  const topP = 0.9 + (pad.arousal - 0.5) * (-0.15);

  return {
    temperature: Math.max(0.3, Math.min(1.1, temp)),
    maxTokens: Math.max(100, Math.min(1000, maxTokens)),
    topP: Math.max(0.7, Math.min(0.98, topP)),
  };
}

/** Weak-constraint emotional tone for prompt injection */
export function padToPromptHint(pad: PAD): string {
  const pleasureWords = pad.pleasure > 0.3 ? "愉悦、满足" : pad.pleasure < -0.3 ? "低落、不快" : "平稳";
  const arousalWords = pad.arousal > 0.7 ? "警觉、兴奋" : pad.arousal < 0.3 ? "放松、慵懒" : "清醒";
  const dominanceWords = pad.dominance > 0.7 ? "自信、掌控" : pad.dominance < 0.3 ? "无力、被动" : "适中";

  return `此刻你的情绪底色是${pleasureWords}，身体状态是${arousalWords}，掌控感${dominanceWords}。这不是命令——你不必表演这种情绪。这只是告诉你此刻你内心的基调，它自然地影响着你的措辞和节奏。`;
}
