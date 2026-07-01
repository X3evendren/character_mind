/**
 * Precision-Weighted Unified Arbitration — Bayesian model selection over
 * internal world-models (hot path, body, self, narrative, relation).
 *
 * Each modality carries its own prediction error. Precision weights determine
 * how much each modality's error contributes to the unified decision to
 * engage cold-path reflection (Parker et al., 2022; Parr & Friston, 2019).
 */

/** Per-modality precision weights — higher = that modality is trusted more. */
export interface PrecisionWeights {
  hot: number;
  body: number;
  self: number;
  narrative: number;
  relation: number;
}

/** Default balanced weights when nothing is known. */
export const DEFAULT_PRECISION_WEIGHTS: PrecisionWeights = {
  hot: 0.5,
  body: 0.5,
  self: 0.5,
  narrative: 0.5,
  relation: 0.5,
};

/**
 * Derive precision weights from attachment style and relationship trust.
 *
 * Attachment theory (Bowlby, Ainsworth) predicts which sensory channel
 * is weighted most heavily under uncertainty:
 *
 *   - secure: balanced, moderate body + relation weight
 *   - anxious: high relation weight (hypervigilant to social cues)
 *   - avoidant: low relation weight, high self/narrative (self-reliance)
 *   - fearful: high body weight (hypervigilant to threat), low narrative
 */
export function computePrecisionWeights(
  attachmentStyle: string,
  trust: number,
): PrecisionWeights {
  const normalizedTrust = Math.max(0, Math.min(1, trust));
  const base: PrecisionWeights = { ...DEFAULT_PRECISION_WEIGHTS };

  switch (attachmentStyle.toLowerCase()) {
    case "secure":
      base.hot = 0.5 + normalizedTrust * 0.1;
      base.body = 0.5 + normalizedTrust * 0.1;
      base.self = 0.45 + normalizedTrust * 0.1;
      base.narrative = 0.5;
      base.relation = 0.4 + normalizedTrust * 0.2;
      break;

    case "anxious":
      base.hot = 0.4;
      base.body = 0.45;
      base.self = 0.35;
      base.narrative = 0.4;
      base.relation = 0.6 + normalizedTrust * 0.15;
      break;

    case "avoidant":
      base.hot = 0.3;
      base.body = 0.35;
      base.self = 0.65;
      base.narrative = 0.55;
      base.relation = 0.2 + normalizedTrust * 0.1;
      break;

    case "fearful":
      base.hot = 0.45;
      base.body = 0.6;
      base.self = 0.3;
      base.narrative = 0.3;
      base.relation = 0.4 + normalizedTrust * 0.1;
      break;

    case "disorganized":
      base.hot = 0.55;
      base.body = 0.55;
      base.self = 0.3;
      base.narrative = 0.25;
      base.relation = 0.35;
      break;

    default:
      // unknown: moderate all
      break;
  }

  return base;
}

/**
 * Unified prediction error — weighted maximum across modalities.
 *
 * Using max (not sum) reflects the winner-take-all character of
 * precision-weighted error: the most salient error dominates the
 * decision to reflect (Feldman & Friston, 2010).
 */
export function unifiedPredictionError(
  pe: { hot: number; body: number; self: number; narrative: number; relation: number },
  weights: PrecisionWeights,
): number {
  const weighted = [
    pe.hot * weights.hot,
    pe.body * weights.body,
    pe.self * weights.self,
    pe.narrative * weights.narrative,
    pe.relation * weights.relation,
  ];
  return Math.max(...weighted);
}

/**
 * Gate decision: should the agent engage cold-path reflection?
 *
 * Returns true when the unified precision-weighted prediction error
 * exceeds the given threshold.
 */
export function shouldReflect(unifiedPE: number, threshold: number): boolean {
  return unifiedPE > threshold;
}
