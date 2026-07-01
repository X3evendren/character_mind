/**
 * Force Field Engine — unified multi-force dynamics replacing all fixed thresholds.
 *
 * Each state variable s(t) is driven by multiple forces:
 *   s(t+dt) = s(t) + Σ(fᵢ × directionᵢ × weightᵢ) × dt + noise
 *
 * Key departure from threshold-based design:
 *   - No "if count ≥ N → trigger"
 *   - States move continuously in high-dimensional space
 *   - Each field has its own time constant τ
 *   - Noise models human moment-to-moment variability
 */

export interface Force {
  name: string;
  /** +1 = pushes state upward, −1 = pushes state downward */
  direction: 1 | -1;
  /** Raw magnitude 0–1 before weighting */
  magnitude: number;
  /** Weight in the net force calculation */
  weight: number;
}

export interface ForceFieldConfig {
  /** Initial value */
  initialValue?: number;
  /** Time constant in minutes (how fast the field responds) */
  tauMinutes: number;
  /** Noise standard deviation (Gaussian) */
  noiseSigma?: number;
  /** Clamp range */
  min?: number;
  max?: number;
  /** Natural regression strength toward 0 (homeostatic attractor, 0–1) */
  regressionStrength?: number;
}

/**
 * A single continuous state variable driven by a force field.
 *
 * Example time scales:
 *   Breakdown urge:   τ=20min  (fast — can crash in a conversation)
 *   Rumination:        τ=15min  (fast — rises and fades within a session)
 *   Interoception:     τ=4h     (slow — changes across a day)
 *   Mood euthymic:     τ=19h    (very slow — changes across days)
 *   Allostatic load:   τ=24h    (slowest active — days to weeks)
 */
export class ForceField {
  private _value: number;
  readonly tauRounds: number;
  readonly dt: number;
  readonly noiseSigma: number;
  readonly min: number;
  readonly max: number;
  readonly regressionStrength: number;

  /** Rounds-per-minute conversion. Default: 1 round ≈ 5 minutes. */
  private static ROUNDS_PER_MINUTE = 1 / 5;

  constructor(config: ForceFieldConfig) {
    this._value = config.initialValue ?? 0.0;
    this.tauRounds = config.tauMinutes / (1 / ForceField.ROUNDS_PER_MINUTE);
    this.dt = 1 / Math.max(1, this.tauRounds); // discrete integration step
    this.noiseSigma = config.noiseSigma ?? 0.05;
    this.min = config.min ?? 0;
    this.max = config.max ?? 1;
    this.regressionStrength = config.regressionStrength ?? 0.03;
  }

  /** Current state value (0–1) */
  get value(): number {
    return this._value;
  }

  /** Apply forces and compute new state */
  update(forces: Force[]): number {
    // Net force: sum of direction × magnitude × weight over all active forces
    const netForce = forces.reduce(
      (sum, f) => sum + f.direction * f.magnitude * f.weight,
      0,
    );

    // Euler integration: Δs = netForce × dt
    const delta = netForce * this.dt;

    // Natural regression toward neutral (homeostatic attractor)
    const regression = -this._value * this.regressionStrength * this.dt;

    // Gaussian noise — same σ produces different results each call
    const noise = gaussianRandom(0, this.noiseSigma);

    // Update
    this._value += delta + regression + noise;

    // Clamp
    this._value = Math.max(this.min, Math.min(this.max, this._value));

    return this._value;
  }

  /** Event-driven discontinuous jump (e.g., "晚安" → sleep drive jumps) */
  jump(delta: number): number {
    this._value = Math.max(this.min, Math.min(this.max, this._value + delta));
    return this._value;
  }

  /** Direct set (for loading from checkpoint) */
  set(v: number): void {
    this._value = Math.max(this.min, Math.min(this.max, v));
  }

  /** Snapshot for serialization */
  snapshot(): number {
    return this._value;
  }
}

/**
 * Box-Muller Gaussian random generator.
 * Deterministic within a session (no seed needed), but
 * different calls produce independent samples.
 */
export function gaussianRandom(mean: number, sigma: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * sigma;
}

/**
 * Force field registry — all dynamic state variables in one place.
 * Each field has its own time constant tuned to empirical data.
 *
 * The registry is created once by the agent and passed to all modules.
 */
export interface ForceFieldRegistry {
  // ── Fast fields (minutes) ──
  breakdownUrge: ForceField;        // τ=20min  — suppression pressure
  rumination: ForceField;           // τ=15min  — 4-subprocess rumination

  // ── Medium fields (hours) ──
  sleepDrive: ForceField;           // τ=2h     — sleep pressure
  boredom: ForceField;              // τ=45min  — cognitive engagement
  playActivation: ForceField;       // τ=1h     — Panksepp PLAY system

  // ── Slow fields (hours–days) ──
  allostaticLoad: ForceField;       // τ=24h    — cumulative strain
  reflectionFatigue: ForceField;    // τ=30min  — post-reflection rest

  // ── Interoceptive precision (per homeostatic variable) ──
  interoEnergy: ForceField;         // τ=4h
  interoArousal: ForceField;        // τ=4h
  interoSafety: ForceField;         // τ=4h
  interoConnection: ForceField;     // τ=4h
  interoMastery: ForceField;        // τ=4h

  // ── Mood (12 dimensions, each with empirical η) ──
  moodEuthymic: ForceField;         // τ=19h    (η=0.003)
  moodIrritable: ForceField;        // τ=2.9h   (η=0.020)
  moodAnxious: ForceField;          // τ=5.8h   (η=0.010)
  moodVital: ForceField;            // τ=4.8h   (η=0.012)
  moodWarm: ForceField;             // τ=14h    (η=0.004)
  moodConfident: ForceField;        // τ=3.8h   (η=0.015)
  moodGrateful: ForceField;         // τ=11.6h  (η=0.005)
  moodProud: ForceField;            // τ=2.3h   (η=0.025)
  moodCurious: ForceField;          // τ=9.6h   (η=0.006)
  moodHopeful: ForceField;          // τ=19h    (η=0.003)
  moodAwed: ForceField;             // τ=29h    (η=0.002)
  moodPlayful: ForceField;          // τ=3.2h   (η=0.018)
}

/**
 * Create all force fields with empirical time constants.
 * Called once at agent initialization.
 */
export function createForceFieldRegistry(): ForceFieldRegistry {
  return {
    // Fast
    breakdownUrge:      new ForceField({ tauMinutes: 20, initialValue: 0.0, noiseSigma: 0.08 }),
    rumination:         new ForceField({ tauMinutes: 15, initialValue: 0.0, noiseSigma: 0.06 }),

    // Medium
    sleepDrive:         new ForceField({ tauMinutes: 120, initialValue: 0.1, noiseSigma: 0.05, regressionStrength: 0.01 }),
    boredom:            new ForceField({ tauMinutes: 45, initialValue: 0.55, noiseSigma: 0.06 }),
    playActivation:     new ForceField({ tauMinutes: 60, initialValue: 0.5, noiseSigma: 0.06 }),

    // Slow
    allostaticLoad:     new ForceField({ tauMinutes: 1440, initialValue: 0.0, noiseSigma: 0.02, regressionStrength: 0.001 }),
    reflectionFatigue:  new ForceField({ tauMinutes: 30, initialValue: 0.0, noiseSigma: 0.05 }),

    // Interoception
    interoEnergy:       new ForceField({ tauMinutes: 240, initialValue: 0.5, noiseSigma: 0.02 }),
    interoArousal:      new ForceField({ tauMinutes: 240, initialValue: 0.5, noiseSigma: 0.02 }),
    interoSafety:       new ForceField({ tauMinutes: 240, initialValue: 0.5, noiseSigma: 0.02 }),
    interoConnection:   new ForceField({ tauMinutes: 240, initialValue: 0.5, noiseSigma: 0.02 }),
    interoMastery:      new ForceField({ tauMinutes: 240, initialValue: 0.5, noiseSigma: 0.02 }),

    // Mood (12D) — empirical η from Verduyn 2015 + Scherer 1994
    moodEuthymic:       new ForceField({ tauMinutes: 1140, initialValue: 0.5, noiseSigma: 0.03 }),
    moodIrritable:      new ForceField({ tauMinutes: 174,  initialValue: 0.3, noiseSigma: 0.06 }),
    moodAnxious:        new ForceField({ tauMinutes: 348,  initialValue: 0.3, noiseSigma: 0.05 }),
    moodVital:          new ForceField({ tauMinutes: 288,  initialValue: 0.5, noiseSigma: 0.05 }),
    moodWarm:           new ForceField({ tauMinutes: 840,  initialValue: 0.5, noiseSigma: 0.04 }),
    moodConfident:      new ForceField({ tauMinutes: 228,  initialValue: 0.5, noiseSigma: 0.06 }),
    moodGrateful:       new ForceField({ tauMinutes: 696,  initialValue: 0.5, noiseSigma: 0.04 }),
    moodProud:          new ForceField({ tauMinutes: 138,  initialValue: 0.4, noiseSigma: 0.07 }),
    moodCurious:        new ForceField({ tauMinutes: 576,  initialValue: 0.5, noiseSigma: 0.05 }),
    moodHopeful:        new ForceField({ tauMinutes: 1140, initialValue: 0.5, noiseSigma: 0.03 }),
    moodAwed:           new ForceField({ tauMinutes: 1740, initialValue: 0.4, noiseSigma: 0.02 }),
    moodPlayful:        new ForceField({ tauMinutes: 192,  initialValue: 0.5, noiseSigma: 0.06 }),
  };
}
