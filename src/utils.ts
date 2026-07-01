/**
 * Shared utilities — single source of truth.
 */

/** Cosine similarity between two Float32Array vectors */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** Clamp value to [lo, hi] */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Extract JSON object from LLM response text (greedy outermost match) */
export function extractJSON(text: string): string {
  // Find the first { and the last } — handles nested objects
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return text.slice(start, end + 1);
}

/** Simple Jaccard token overlap for semantic mismatch estimation */
export function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Average an array of Float32Array embeddings */
export function averageEmbedding(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) return new Float32Array(0);
  const dim = embeddings[0].length;
  const result = new Float32Array(dim);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) result[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) result[i] /= embeddings.length;
  return result;
}

/** Capitalize first character of a string */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Safely parse JSON, returning empty object on failure */
export function tryParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

// ═══════════════════════════════════════════════════════════════
// ACT-R Dynamic Activation Decay (Pavlik & Anderson 2005)
// + Inverted U-shape Emotion Modulation (McGaugh 2004)
// ═══════════════════════════════════════════════════════════════

/** ACT-R decay rate parameters */
export const ACTR_DECAY = {
  c: 0.15,    // exponent scaling (higher = more sensitive to activation level)
  a: 0.20,    // floor decay rate (minimum, never decays below this)
  retrievalBoost: 1.5, // testing effect: successful retrieval strengthens encoding
  emotionOpt: 0.7,     // optimal emotion intensity for memory retention (inverted U)
};

/**
 * ACT-R dynamic decay rate — decay accelerates as activation increases.
 * d(t) = c × exp(m(t)) + a
 *
 * This NATURALLY implements the spacing effect:
 *   - High activation (recently used) → high decay rate → needs frequent retrieval
 *   - Low activation (rarely used) → low decay rate → persists passively
 */
export function actrDynamicDecayRate(currentActivation: number): number {
  const { c, a } = ACTR_DECAY;
  return c * Math.exp(currentActivation) + a;
}

/**
 * Inverted U-shape emotion modulation (McGaugh 2004).
 * Moderate emotion → optimal retention.
 * Extreme emotion (panic, despair) → impaired retention.
 *
 * emotionBoost = α × emotion / (1 + (emotion / emotionOpt)²)
 */
export function invertedUEmotionBoost(
  emotionIntensity: number,
  alpha = 1.0,
  emotionOpt = ACTR_DECAY.emotionOpt,
): number {
  return alpha * emotionIntensity / (1 + Math.pow(emotionIntensity / emotionOpt, 2));
}

/**
 * ACT-R activation value after multiple retrievals.
 * m(t) = ln(Σᵢ bᵢ × (t - tᵢ)^(-dᵢ))
 *
 * Each retrieval event i at time tᵢ contributes bᵢ × elapsed^(-dᵢ).
 *
 * @param retrievalHistory - array of { encodingStrength, elapsedSeconds, decayRate }
 */
export function actrActivation(
  retrievalHistory: Array<{
    encodingStrength: number;
    elapsedSeconds: number;
    decayRate: number;
  }>,
): number {
  if (retrievalHistory.length === 0) return Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const { encodingStrength, elapsedSeconds, decayRate } of retrievalHistory) {
    if (elapsedSeconds <= 0) continue;
    sum += encodingStrength * Math.pow(elapsedSeconds, -decayRate);
  }
  return sum > 0 ? Math.log(sum) : Number.NEGATIVE_INFINITY;
}

/**
 * Full ACT-R memory activation with emotion modulation.
 *
 * A(t) = A₀ × exp(-t × d(m) × (1 + emotionBoost + β·salience))
 *
 * where d(m) = c × exp(m(t)) + a (dynamic decay rate)
 * and emotionBoost = inverted U (McGaugh 2004)
 */
export function actrMemoryActivation(
  baseActivation: number,
  elapsedSeconds: number,
  currentActivation: number,
  emotionIntensity: number,
  salience: number,
  opts?: {
    alpha?: number;     // emotion boost scalar (default 1.0)
    beta?: number;      // salience boost scalar (default 0.3)
    decayC?: number;    // override c
    decayA?: number;    // override a
    emotionOpt?: number; // override optimal emotion
  },
): number {
  const alpha = opts?.alpha ?? 1.0;
  const beta = opts?.beta ?? 0.3;
  const c = opts?.decayC ?? ACTR_DECAY.c;
  const a = opts?.decayA ?? ACTR_DECAY.a;
  const eOpt = opts?.emotionOpt ?? ACTR_DECAY.emotionOpt;

  const decayRate = c * Math.exp(currentActivation) + a;
  const emotionBoost = invertedUEmotionBoost(emotionIntensity, alpha, eOpt);
  const totalBoost = 1 + emotionBoost + beta * salience;

  return baseActivation * Math.exp(-elapsedSeconds * decayRate * totalBoost);
}

/**
 * Retrieval encoding boost — testing effect (Pavlik & Anderson 2005).
 * Successful retrieval increases encoding strength by 50%.
 */
export function retrievalBoost(currentEncoding: number): number {
  return currentEncoding * ACTR_DECAY.retrievalBoost;
}
