/**
 * AllostaticSelfEfficacy — Metacognition layer tracking the agent's
 * perceived ability to regulate itself across repeated stress cycles.
 *
 * Based on McEwen's allostatic load model (1998) and Bandura's
 * self-efficacy theory (1977):
 *
 *   - selfEfficacy: global estimate of coping ability
 *   - strategySuccessRates: per-strategy outcome tracking
 *   - fatigueLevel: cumulative cost of regulation attempts
 *
 * The dysphoria cascade (selfEfficacy × allostaticLoad) models the
 * learned helplessness pathway: repeated failures under high load
 * erode belief in future success.
 */

import type { TDErrorResult } from "./td-error";

export class AllostaticSelfEfficacy {
  /** Global self-efficacy estimate (0-1, 1 = fully confident in coping) */
  selfEfficacy = 0.6;

  /** Per-strategy success tracking */
  strategySuccessRates = new Map<string, { total: number; success: number }>();

  /** Cumulative regulation fatigue (0-1) */
  fatigueLevel = 0;

  /**
   * Record the outcome of a regulation strategy attempt.
   * Updates both the per-strategy tracker and global self-efficacy.
   */
  recordStrategyOutcome(strategy: string, success: boolean): void {
    let entry = this.strategySuccessRates.get(strategy);
    if (!entry) {
      entry = { total: 0, success: 0 };
      this.strategySuccessRates.set(strategy, entry);
    }
    entry.total += 1;
    if (success) entry.success += 1;

    // Apply small increment to global self-efficacy on success,
    // slightly larger decrement on failure (negativity bias).
    if (success) {
      this.selfEfficacy = Math.min(1, this.selfEfficacy + 0.02);
    } else {
      this.selfEfficacy = Math.max(0, this.selfEfficacy - 0.04);
    }
  }

  /**
   * Compute global self-efficacy as the weighted average of
   * per-strategy success rates, blended with the current estimate.
   *
   * Strategies with more attempts get higher weight.
   */
  getSelfEfficacy(): number {
    const entries = [...this.strategySuccessRates.values()];
    if (entries.length === 0) return this.selfEfficacy;

    let totalWeight = 0;
    let weightedSum = 0;
    for (const e of entries) {
      if (e.total === 0) continue;
      const rate = e.success / e.total;
      const weight = Math.log(1 + e.total); // log-weight to temper dominance
      weightedSum += rate * weight;
      totalWeight += weight;
    }

    const empirical = totalWeight > 0 ? weightedSum / totalWeight : this.selfEfficacy;

    // Blend empirical rate with prior self-efficacy (Bayesian smoothing)
    const alpha = Math.min(0.7, entries.reduce((s, e) => s + e.total, 0) / 20);
    return empirical * alpha + this.selfEfficacy * (1 - alpha);
  }

  /**
   * Dysphoria level — fatigue-depression cascade.
   *
   * When allostatic load is high AND self-efficacy is low, the agent
   * enters a state analogous to learned helplessness / depression.
   *
   *   dysphoria = (1 - selfEfficacy) × allostaticLoad × fatigue
   *
   * Range: 0 (resilient) to 1 (dysphoric).
   */
  getDysphoriaLevel(allostaticLoad: number): number {
    const helplessness = 1 - this.getSelfEfficacy();
    const load = Math.max(0, Math.min(1, allostaticLoad));
    return helplessness * load * this.fatigueLevel;
  }

  /**
   * Periodic update from TD errors and allostatic load.
   *
   * - TD errors update per-strategy success tracking:
   *   positive TD error → strategies "worked"
   *   negative TD error → strategies "failed"
   *
   * - Fatigue accumulates proportionally to allostatic load
   *   and decays slowly when load is low.
   */
  update(td: TDErrorResult, allostaticLoad: number): void {
    const load = Math.max(0, Math.min(1, allostaticLoad));

    // Use TD error total as a proxy for strategy outcome
    // (positive = homeostatic state improved → strategies effective)
    if (td.total > 0.05) {
      this.recordStrategyOutcome("global", true);
    } else if (td.total < -0.05) {
      this.recordStrategyOutcome("global", false);
    }

    // Fatigue dynamics: accumulates under load, decays under low load
    const fatigueRise = load * 0.03;
    const fatigueDecay = (1 - load) * 0.01;
    this.fatigueLevel = Math.max(0, Math.min(1,
      this.fatigueLevel + fatigueRise - fatigueDecay,
    ));

    // Slow recovery of self-efficacy under low load (resilience)
    if (load < 0.3) {
      this.selfEfficacy = Math.min(1, this.selfEfficacy + 0.005);
    }
  }
}
