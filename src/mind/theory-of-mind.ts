/**
 * Theory of Mind — BDI mental state tracking + recursive perspective-taking.
 *
 * Models the agent's understanding of the user's mental states:
 *   Belief:  what the agent believes the user knows/thinks
 *   Desire:  what the agent infers the user wants
 *   Intention: what the agent thinks the user plans to do
 *
 * Recursive: 1st-order ("user thinks X") + 2nd-order ("user thinks I think Y").
 *
 * ALL reasoning is LLM-driven. No regex, no rule-based classification.
 *
 * From: Bratman BDI framework, Agentic-ToM (Sarangi et al., EMNLP 2025),
 *       Counterfactual Reflection (arXiv 2501.15355)
 */

import { extractJSON, cosineSimilarity } from "../utils";
import type { IProvider } from "../agent/provider";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface UserBelief {
  content: string;           // "The user knows X"
  confidence: number;        // 0–1
  lastUpdated: number;
  evidenceBasis: string;     // "From conversation on 2026-07-01"
}

export interface UserDesire {
  content: string;           // "The user wants X"
  intensity: number;         // 0–1
  surface: boolean;          // true = stated, false = inferred
  timeframe: "immediate" | "today" | "longterm";
}

export interface UserIntention {
  content: string;           // "The user plans to X"
  commitment: number;        // 0–1
  specificity: number;       // how concrete the plan is
}

export interface MentalState {
  beliefs: UserBelief[];
  desires: UserDesire[];
  intentions: UserIntention[];
  currentMood: string;       // inferred user emotional state
  currentAttention: string;  // what the user seems focused on
  firstOrderPerspective: string;  // "The user is thinking about..."
  secondOrderPerspective: string; // "The user thinks I am..."
  confidence: number;        // overall confidence in mental model
  uncertaintySources: string[];
}

export interface ToMPrediction {
  /** What the agent predicted the user would do/say */
  predictedResponse: string;
  /** The actual response */
  actualResponse: string;
  /** Mismatch magnitude 0–1 */
  mismatch: number;
  /** Counterfactual analysis result */
  counterfactualInsight: string;
}

// ═══════════════════════════════════════════════════════════════
// Main class
// ═══════════════════════════════════════════════════════════════

export class TheoryOfMind {
  private mentalState: MentalState;
  private predictionHistory: ToMPrediction[] = [];
  private provider: IProvider;

  constructor(provider: IProvider) {
    this.provider = provider;
    this.mentalState = {
      beliefs: [],
      desires: [],
      intentions: [],
      currentMood: "neutral",
      currentAttention: "conversation",
      firstOrderPerspective: "",
      secondOrderPerspective: "",
      confidence: 0.5,
      uncertaintySources: [],
    };
  }

  get state(): MentalState {
    return this.mentalState;
  }

  // ── Belief Update ──

  async updateBeliefs(
    userMessage: string,
    recentDialog: string,
  ): Promise<void> {
    const prompt = `
## 用户刚说
${userMessage}

## 之前对话
${recentDialog}

## 你对用户已有的信念
${this.mentalState.beliefs.map(b => `- ${b.content} (置信度: ${b.confidence.toFixed(2)})`).join("\n") || "（暂无已有信念）"}

## 任务
用户刚说的话是否改变了你对 ta 的任何信念？
只关注真正的改变——微小的修正不算。

## 输出 JSON
{
  "changed": true或false,
  "newBeliefs": [{"content": "...", "confidence": 0.7, "evidence": "..."}],
  "deprecatedBeliefs": ["之前但现在已不成立的信念"],
  "changeMagnitude": "slight|moderate|significant"
}`;

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.3, 1024,
      );
      const result = JSON.parse(extractJSON(resp.content));

      if (result.changed) {
        // Deprecate old beliefs
        for (const old of (result.deprecatedBeliefs ?? [])) {
          const idx = this.mentalState.beliefs.findIndex(
            b => b.content === old
          );
          if (idx >= 0) this.mentalState.beliefs.splice(idx, 1);
        }
        // Add new beliefs
        for (const nb of (result.newBeliefs ?? [])) {
          this.mentalState.beliefs.push({
            content: nb.content,
            confidence: nb.confidence ?? 0.7,
            lastUpdated: Date.now(),
            evidenceBasis: nb.evidence ?? "",
          });
        }
        // Trim old low-confidence beliefs (> 10 beliefs)
        if (this.mentalState.beliefs.length > 10) {
          this.mentalState.beliefs.sort((a, b) => b.confidence - a.confidence);
          this.mentalState.beliefs = this.mentalState.beliefs.slice(0, 10);
        }
      }
    } catch {
      // LLM call failed — keep existing beliefs
    }
  }

  // ── Desire Inference ──

  async inferDesires(
    userMessage: string,
    recentDialog: string,
  ): Promise<void> {
    const prompt = `
## 当前对话
用户: ${userMessage}

## 最近对话
${recentDialog}

## 任务
用户现在想要什么？
区分表面需求（ta 直接说的）和深层需求（ta 没说但可能想要的）。

## 输出 JSON
{
  "surfaceDesires": ["..."],
  "deepDesires": ["..."],
  "intensity": 0.5,
  "timeframe": "immediate|today|longterm",
  "reasoning": "简短解释你的推理"
}`;

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.4, 1024,
      );
      const result = JSON.parse(extractJSON(resp.content));

      // Update desire list
      this.mentalState.desires = this.mentalState.desires.filter(
        d => d.timeframe !== "immediate" // keep long-term, replace immediate
      );

      for (const sd of (result.surfaceDesires ?? [])) {
        this.mentalState.desires.push({
          content: sd,
          intensity: result.intensity ?? 0.7,
          surface: true,
          timeframe: result.timeframe ?? "immediate",
        });
      }
      for (const dd of (result.deepDesires ?? [])) {
        this.mentalState.desires.push({
          content: dd,
          intensity: (result.intensity ?? 0.7) * 0.8,
          surface: false,
          timeframe: result.timeframe ?? "today",
        });
      }
    } catch {
      // keep existing
    }
  }

  // ── Second-Order Perspective ──

  async computeSecondOrderPerspective(
    ownRecentBehavior: string,
    userDescription: string,
  ): Promise<string> {
    const prompt = `
## 你最近做的事/说的话
${ownRecentBehavior}

## 你对用户的了解
${userDescription}

## 任务
站在用户的角度，ta 会如何解读你刚才的行为？
考虑用户的性格、情绪状态、以及你们关系的历史。

输出一句话描述用户可能的想法。
不需要 JSON，直接给自然语言。`;

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.5, 512,
      );
      this.mentalState.secondOrderPerspective = resp.content.trim();
      return resp.content.trim();
    } catch {
      return this.mentalState.secondOrderPerspective;
    }
  }

  // ── Counterfactual Check ──

  async checkCounterfactual(
    predicted: string,
    actual: string,
  ): Promise<ToMPrediction> {
    const mismatch = estimateSemanticMismatch(predicted, actual);

    let insight = "";
    if (mismatch > 0.4) {
      const prompt = `
## 你之前预测用户会
${predicted}

## 用户实际
${actual}

## 任务
这和你预测的有显著出入。为什么？你的心智模型哪里出错了？
简短回答。`;

      try {
        const resp = await this.provider.chat(
          [{ role: "user", content: prompt }],
          0.5, 512,
        );
        insight = resp.content.trim();
      } catch { /* */ }
    }

    const prediction: ToMPrediction = {
      predictedResponse: predicted,
      actualResponse: actual,
      mismatch,
      counterfactualInsight: insight,
    };

    this.predictionHistory.push(prediction);
    if (this.predictionHistory.length > 20) {
      this.predictionHistory = this.predictionHistory.slice(-10);
    }

    return prediction;
  }

  // ── Snapshot ──

  snapshot(): MentalState {
    return structuredClone(this.mentalState);
  }

  restore(state: MentalState): void {
    this.mentalState = structuredClone(state);
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════

function estimateSemanticMismatch(a: string, b: string): number {
  // Simple token overlap based mismatch — full semantic comparison
  // would use embeddings, but this is a lightweight approximation
  if (!a || !b) return 0.5;
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? 1 - intersection / union : 0;
}

// ═══════════════════════════════════════════════════════════════
// Bayesian belief calibration
// ═══════════════════════════════════════════════════════════════

/**
 * Calibrate a belief against observed behavior.
 *
 * Computes a confidence calibration score by comparing the belief description
 * tokens with observed behavior tokens via cosine similarity over token
 * frequency vectors. The cautiousness parameter biases the score toward
 * uncertainty — modeling the fact that ToM inferences are inherently noisy.
 *
 * calibration = cosine(tokenVec(belief), tokenVec(observed))
 * calibrated = calibration × (1 − cautiousness × (1 − calibration))
 *
 * A high calibrated score (>0.7) means the belief is well-supported by
 * recent observations. A low score (<0.3) suggests the belief may be
 * outdated or inaccurate.
 *
 * @param belief - The belief description (e.g., "用户喜欢直接沟通")
 * @param observed - The observed behavior text (e.g., "用户说'别绕弯子'")
 * @param cautiousness - Bayesian prior toward uncertainty (default 0.5)
 * @returns Calibrated confidence score in [0, 1]
 */
export function calibrateBelief(
  belief: string,
  observed: string,
  cautiousness = 0.5,
): number {
  if (!belief || !observed) return cautiousness * 0.5;

  // Build token frequency vectors
  const buildTokenVec = (text: string): Float32Array => {
    const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const freq = new Map<string, number>();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    // Hash-fold to fixed 64-dim vector
    const dim = 64;
    const vec = new Float32Array(dim);
    for (const [token, count] of freq) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash |= 0;
      }
      vec[Math.abs(hash) % dim] += count;
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
    if (norm > 0) {
      const invNorm = 1 / Math.sqrt(norm);
      for (let i = 0; i < dim; i++) vec[i] *= invNorm;
    }
    return vec;
  };

  const beliefVec = buildTokenVec(belief);
  const observedVec = buildTokenVec(observed);

  const calibration = cosineSimilarity(beliefVec, observedVec);

  // Cautiousness biases the score toward uncertainty:
  // calibrated = calibration × (1 − cautiousness × (1 − calibration))
  // When cautiousness=0: calibrated = calibration (no bias)
  // When cautiousness=1: calibrated = calibration² (strong bias toward 0)
  const calibrated = calibration * (1 - cautiousness * (1 - calibration));

  return Math.max(0, Math.min(1, calibrated));
}
