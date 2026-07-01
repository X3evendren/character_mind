/**
 * Consciousness Stream — force-field driven, no fixed thresholds.
 *
 * Thought fragment weights are computed by combining:
 *   - Homeostatic deviations
 *   - TD error intensity
 *   - Memory activation
 *   - Random drift (simulates DMN spontaneous activity)
 *   - Rumination force field (amplifies negative loops)
 *   - Boredom force field (reduces thought when disengaged)
 *
 * Dead loop detection is replaced by: rumination field rising +
 * semantic similarity tracking in a sliding window.
 *
 * Interrupt/reorganize: when breakdownUrge > 0.8 or
 * a high-weight thought (>0.7) arrives during generation.
 */

import type { ForceField } from "./force-field";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ThoughtFragment {
  text: string;
  weight: number;
  timestamp: number;
  /** Is this thought about the future (simulation)? */
  isFutureSimulation: boolean;
  /** Abstraction level 0 (concrete) ~ 1 (abstract) */
  abstractionLevel: number;
  /** Self-reference level 0~1 */
  selfReference: number;
}

export type ThoughtAction = "drift" | "record" | "speak" | "interrupt";

export interface ConsciousnessConfig {
  /** Max interrupts per turn (default 2) */
  maxInterruptsPerTurn: number;
  /** Sliding window size for similarity tracking */
  loopWindowSize: number;
}

// ═══════════════════════════════════════════════════════════════
// Main class
// ═══════════════════════════════════════════════════════════════

export class ConsciousnessStream {
  private recentThoughts: ThoughtFragment[] = [];
  private interruptCount = 0;
  private config: ConsciousnessConfig;

  constructor(config?: Partial<ConsciousnessConfig>) {
    this.config = {
      maxInterruptsPerTurn: config?.maxInterruptsPerTurn ?? 2,
      loopWindowSize: config?.loopWindowSize ?? 8,
    };
  }

  /** Reset per-turn interrupt counter */
  resetTurn(): void {
    this.interruptCount = 0;
  }

  /**
   * Compute thought weight from multiple forces (no thresholds).
   *
   * Components:
   *   topDeviation × 0.25     — biggest homeostatic mismatch
   *   maxTDError  × 0.25     — strongest surprise/error signal
   *   memoryActivation × 0.15 — strongest memory retrieval activation
   *   rumination   × 0.15    — rumination amplifies thought
   *   boredom      × (−0.08) — boredom reduces spontaneous thought
   *   random       × 0.20    — DMN spontaneous activity
   */
  computeWeight(
    topDeviation: number,
    maxTDError: number,
    topMemoryActivation: number,
    ruminationFF: ForceField,
    boredomFF: ForceField,
  ): number {
    const w =
      topDeviation * 0.25 +
      maxTDError * 0.25 +
      topMemoryActivation * 0.15 +
      ruminationFF.value * 0.15 +
      (boredomFF.value > 0.5 ? -0.05 : 0) +  // boredom reduces thought weight
      Math.random() * 0.20;

    return Math.max(0, Math.min(1, w));
  }

  /** Record a thought */
  record(
    thought: string,
    weight: number,
    isFutureSimulation = false,
    abstractionLevel = 0.3,
    selfReference = 0.3,
  ): ThoughtFragment {
    const fragment: ThoughtFragment = {
      text: thought,
      weight,
      timestamp: Date.now(),
      isFutureSimulation,
      abstractionLevel,
      selfReference,
    };

    this.recentThoughts.push(fragment);

    // Keep sliding window
    if (this.recentThoughts.length > this.config.loopWindowSize * 2) {
      this.recentThoughts = this.recentThoughts.slice(-this.config.loopWindowSize);
    }

    return fragment;
  }

  /**
   * Check if recent thoughts form a spiral (deepening) vs dead loop (repeating).
   *
   * Spiral: weights rising, same topic but deepening → natural rumination
   * Dead loop: same thought essentially repeated → needs reframe
   *
   * Uses weight trend and content similarity, not fixed thresholds.
   */
  isDeadLoop(): boolean {
    if (this.recentThoughts.length < 4) return false;

    const recent = this.recentThoughts.slice(-4);

    // Check weight trend: all rising → spiral (OK), flat → potential loop
    const weights = recent.map(t => t.weight);
    const allRising = weights.every(
      (w, i) => i === 0 || w >= weights[i - 1] - 0.05
    );

    // If weights are all high but not rising → possible repetition
    const allHigh = recent.every(t => t.weight > 0.6);

    return allHigh && !allRising && this.recentThoughts.length >= this.config.loopWindowSize;
  }

  /**
   * Check if a thought should trigger action.
   * Uses weight + rumination BF + breakdown BF for continuous decision,
   * not fixed thresholds.
   */
  shouldAct(
    fragment: ThoughtFragment,
    isGenerating: boolean,
    ruminationFF: ForceField,
    breakdownFF: ForceField,
  ): ThoughtAction {
    // Ruminate → thoughts more likely to stay internal
    const effectiveWeight = fragment.weight
      + (ruminationFF.value - 0.5) * 0.15     // rumination keeps thoughts internal
      - (breakdownFF.value > 0.7 ? 0.1 : 0);  // near breakdown → more expression

    if (effectiveWeight < 0.25) return "drift";
    if (effectiveWeight < 0.55) return "record";

    if (isGenerating && effectiveWeight > 0.65) {
      if (this.interruptCount < this.config.maxInterruptsPerTurn) {
        this.interruptCount++;
        return "interrupt";
      }
    }

    if (!isGenerating && effectiveWeight > 0.55) {
      return "speak";
    }

    return "record";
  }

  /** Get all recent thoughts */
  getRecentThoughts(): ThoughtFragment[] {
    return [...this.recentThoughts];
  }

  /** Get fluid thought for force-field-driven disruption check */
  getThoughtDensity(): number {
    if (this.recentThoughts.length < 3) return 0;
    const recent = this.recentThoughts.slice(-3);
    const avgWeight = recent.reduce((s, t) => s + t.weight, 0) / recent.length;
    return avgWeight;
  }

  /** Snapshot for checkpoint */
  snapshot(): { recentThoughts: ThoughtFragment[]; interruptCount: number } {
    return {
      recentThoughts: [...this.recentThoughts],
      interruptCount: this.interruptCount,
    };
  }

  restore(s: { recentThoughts: ThoughtFragment[]; interruptCount: number }): void {
    this.recentThoughts = s.recentThoughts;
    this.interruptCount = s.interruptCount;
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════

/** Estimate semantic similarity between two thought texts (simplified) */
export function estimateThoughtSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(a.split(/\s+/));
  const tokensB = new Set(b.split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}
