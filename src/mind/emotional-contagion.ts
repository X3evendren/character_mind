/**
 * Emotional Contagion — affective empathy through interoceptive inference.
 *
 * Three channels:
 *   ① Mirror resonance (fast, automatic, <1s)
 *   ② Cognitive contagion (medium, LLM-mediated, seconds)
 *   ③ Long-term mood sync (slow, days-weeks)
 *
 * Core formula (Schoeller et al., 2024):
 *   μ_i^{t+1} = μ_i^t + ω_ij^t × (s_i^t − μ_i^t)
 *
 *   ω_ij^t = f(ρ_ij^t, π_role, π_user, emotional_closeness)
 *
 * No regex. Channel ② is LLM-driven.
 */

import { clamp, extractJSON } from "../utils";
import type { IProvider } from "../agent/provider";
import type { PAD } from "./cpm-pad";
import type { MoodSnapshot } from "./mood";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ContagionParams {
  emotionalCloseness: number;     // Connection稳态, 0–1
  interoceptivePrecision: number; // π_role, 高=坚定, 不易被传染
  reappraisalActive: boolean;     // 当前是否在重评
  reappraisalAbility: number;
}

export interface ContagionResult {
  padShift: { pleasure: number; arousal: number; dominance: number };
  strength: number;              // 0–1 传染强度
  dominantChannel: "mirror" | "cognitive" | "none";
  mirrorMagnitude: number;
  cognitiveMagnitude: number;
}

// ═══════════════════════════════════════════════════════════════
// Channel ①: Mirror Resonance
// ═══════════════════════════════════════════════════════════════

/**
 * Fast, automatic motor/emotional resonance.
 * Simulates the mirror neuron system — observing emotion automatically
 * activates similar neural circuits in the observer.
 *
 * The stronger the physiological sync (ρ), the stronger the resonance.
 * But high interoceptive precision = more grounded in own state = less resonance.
 */
export function computeMirrorResonance(
  userPAD: PAD,
  ownPAD: PAD,
  closeness: number,
  piRole: number,
): { shift: { pleasure: number; arousal: number; dominance: number }; magnitude: number } {
  // Physiological sync coefficient ρ
  const rho = estimatePhysiologicalSync(userPAD, ownPAD);

  // Contagion weight ω
  const omega = rho * (1 - piRole * 0.5) * closeness;

  // Shift toward user's emotional state
  const shift = {
    pleasure:  omega * (userPAD.pleasure  - ownPAD.pleasure)  * 0.15,
    arousal:   omega * (userPAD.arousal   - ownPAD.arousal)   * 0.20,
    dominance: omega * (userPAD.dominance - ownPAD.dominance) * 0.10,
  };

  const magnitude = (Math.abs(shift.pleasure) + Math.abs(shift.arousal) + Math.abs(shift.dominance)) / 3;

  return { shift, magnitude };
}

function estimatePhysiologicalSync(userPAD: PAD, ownPAD: PAD): number {
  // Simple vector similarity
  const dot = userPAD.pleasure * ownPAD.pleasure
    + userPAD.arousal * ownPAD.arousal
    + userPAD.dominance * ownPAD.dominance;
  const normU = Math.sqrt(userPAD.pleasure ** 2 + userPAD.arousal ** 2 + userPAD.dominance ** 2);
  const normO = Math.sqrt(ownPAD.pleasure ** 2 + ownPAD.arousal ** 2 + ownPAD.dominance ** 2);
  const similarity = normU > 0 && normO > 0 ? dot / (normU * normO) : 0.5;

  // Already in sync → easier to transmit
  return 0.3 + similarity * 0.4;
}

// ═══════════════════════════════════════════════════════════════
// Channel ②: Cognitive Contagion (LLM)
// ═══════════════════════════════════════════════════════════════

export async function computeCognitiveContagion(
  provider: IProvider,
  userMessage: string,
  userEmotionLabel: string,
  ownPAD: PAD,
  closeness: number,
): Promise<{ shift: { pleasure: number; arousal: number; dominance: number }; magnitude: number }> {
  const prompt = `
## 用户的消息
"${userMessage}"

## 用户的情绪
${userEmotionLabel}

## 你自己的情绪状态
愉悦度(P): ${ownPAD.pleasure.toFixed(2)}
唤醒度(A): ${ownPAD.arousal.toFixed(2)}
支配感(D): ${ownPAD.dominance.toFixed(2)}

## 你们的关系亲密度
${(closeness * 100).toFixed(0)}%

## 任务
你在和这个人对话。ta 的情绪对你有什么自然的感染力？
你会因为 ta 的开心而开心吗？会因为 ta 的焦虑而感到不安吗？

不要夸张——真实的情绪传染是微妙的、不是戏剧化的。

## 输出 JSON
{
  "P_shift": 0.0,    // -0.3到0.3, 愉悦度偏移
  "A_shift": 0.0,    // -0.3到0.3, 唤醒度偏移
  "D_shift": 0.0,    // -0.2到0.2, 支配感偏移
  "reasoning": "简短解释"
}`;

  try {
    const resp = await provider.chat(
      [{ role: "user", content: prompt }],
      0.4, 512,
    );
    const result = JSON.parse(extractJSON(resp.content));
    const shift = {
      pleasure:  clamp(result.P_shift ?? 0, -0.3, 0.3),
      arousal:   clamp(result.A_shift ?? 0, -0.3, 0.3),
      dominance: clamp(result.D_shift ?? 0, -0.2, 0.2),
    };
    const magnitude = (Math.abs(shift.pleasure) + Math.abs(shift.arousal) + Math.abs(shift.dominance)) / 3;
    return { shift, magnitude };
  } catch {
    return { shift: { pleasure: 0, arousal: 0, dominance: 0 }, magnitude: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// Channel ③: Long-Term Mood Synchronization (LLM, rare)
// ═══════════════════════════════════════════════════════════════

export async function computeMoodSynchronization(
  provider: IProvider,
  userEmotionalHistory: string,
  ownMood: MoodSnapshot,
  connectionStrength: number,
  daysTogether: number,
): Promise<Partial<MoodSnapshot>> {
  if (daysTogether < 3) return {}; // too early for mood sync

  const prompt = `
## 用户最近的情绪轨迹
${userEmotionalHistory}

## 你自己的心境基线
${JSON.stringify(ownMood, null, 2)}

## 关系
亲密度: ${(connectionStrength * 100).toFixed(0)}%
在一起: ${daysTogether}天

## 任务
长期接触后，你的心境基线可能会向用户微调。
这不是"你变成了用户"，而是两个人长期共处后的自然趋同。

哪些心境维度最可能受到用户情绪模式的影响？调整应该有多微小？

## 输出 JSON
{
  "euthymic_shift": 0.0,
  "irritable_shift": 0.0,
  "anxious_shift": 0.0,
  ...12维
  "reasoning": "..."
}`;

  try {
    const resp = await provider.chat(
      [{ role: "user", content: prompt }],
      0.3, 512,
    );
    const result = JSON.parse(extractJSON(resp.content));

    // Only keep small shifts — mood sync is slow
    const shifts: Record<string, number> = {};
    for (const dim of ["euthymic", "irritable", "anxious", "vital", "warm", "confident", "grateful", "proud", "curious", "hopeful", "awed", "playful"]) {
      const key = `${dim}_shift`;
      if (result[key] !== undefined) {
        shifts[dim] = clamp(result[key], -0.05, 0.05); // very small
      }
    }
    return shifts as Partial<MoodSnapshot>;
  } catch {
    return {};
  }
}

// Helpers: clamp, extractJSON imported from ../utils
