/**
 * Homeostatic State — 5-variable bottom-up emergent system.
 * Replaces: saturation.ts (32 lerp), drives.ts (5 drives), emotion.ts (AffectiveResidue)
 *
 * Each variable has a setpoint and a current value.
 * Deviation from setpoint → motivation. Fulfillment → return to setpoint.
 * Setpoint drift → personality formation over long-term interaction.
 */

// ── Individual variable type ──

export interface HomeostaticVar {
  /** Current value, clamped to [min, max] */
  value: number;
  /** Target value — drifts slowly over long-term interaction */
  setPoint: number;
  /** Allowed range */
  min: number;
  max: number;
  /** Whether this variable's setpoint can drift */
  driftable: boolean;
  /** Drift rate (EMA weight per day) */
  driftRate: number;
  /** Weight in allostatic load calculation */
  allostaticWeight: number;
  /** EMA of recent values for drift computation */
  recentEma: number;
}

// ── Complete homeostatic state ──

export interface HomeostaticSnapshot {
  energy: number;
  arousal: number;
  safety: number;
  connection: number;
  mastery: number;
  allostaticLoad: number;
  setPoints: {
    energy: number;
    arousal: number;
    safety: number;
    connection: number;
    mastery: number;
  };
}

/** 5-variable homeostatic system */
export class HomeostaticState {
  energy: HomeostaticVar;
  arousal: HomeostaticVar;
  safety: HomeostaticVar;
  connection: HomeostaticVar;
  mastery: HomeostaticVar;
  allostaticLoad = 0;

  constructor(config?: Partial<Record<string, number>>) {
    this.energy = {
      value: 0.70, setPoint: 0.70, min: 0, max: 1,
      driftable: false, driftRate: 0, allostaticWeight: 0.05, recentEma: 0.70,
    };
    this.arousal = {
      value: 0.50, setPoint: 0.50, min: 0.1, max: 0.9,
      driftable: false, driftRate: 0, allostaticWeight: 0.05, recentEma: 0.50,
    };
    this.safety = {
      value: 0.60, setPoint: 0.60, min: 0, max: 1,
      driftable: true, driftRate: 0.02, allostaticWeight: 0.40, recentEma: 0.60,
    };
    this.connection = {
      value: config?.connectionSetPoint ?? 0.70, setPoint: config?.connectionSetPoint ?? 0.70,
      min: 0, max: 1, driftable: true, driftRate: 0.03, allostaticWeight: 0.30, recentEma: config?.connectionSetPoint ?? 0.70,
    };
    this.mastery = {
      value: 0.60, setPoint: 0.60, min: 0, max: 1,
      driftable: true, driftRate: 0.025, allostaticWeight: 0.20, recentEma: 0.60,
    };
  }

  /** Deviation from setpoint: positive = above, negative = below */
  deviation(name: keyof HomeostaticSnapshot["setPoints"]): number {
    const v = this[name as keyof this] as HomeostaticVar;
    return v.value - v.setPoint;
  }

  /** Apply delta to a variable (clamped to range) */
  apply(name: keyof HomeostaticSnapshot["setPoints"], delta: number): void {
    const v = this[name as keyof this] as HomeostaticVar;
    v.value = Math.max(v.min, Math.min(v.max, v.value + delta));
  }

  /** Decay all variables toward setpoints */
  tick(dtSeconds: number): void {
    for (const name of ["energy", "arousal", "safety", "connection", "mastery"] as const) {
      const v = this[name] as HomeostaticVar;
      const tau = name === "safety" ? 1800 : 300; // safety recovers slower
      const rate = 1 - Math.exp(-dtSeconds / tau);
      v.value += (v.setPoint - v.value) * rate;
    }
    // Allostatic load recovery: exp(-t/1800)
    this.allostaticLoad *= Math.exp(-dtSeconds / 1800);
  }

  /** Update allostatic load from current deviations */
  updateAllostaticLoad(durationMinutes: number): void {
    let load = 0;
    for (const name of ["energy", "arousal", "safety", "connection", "mastery"] as const) {
      const v = this[name] as HomeostaticVar;
      load += Math.abs(v.value - v.setPoint) * durationMinutes * v.allostaticWeight;
    }
    this.allostaticLoad += load;
    this.allostaticLoad = Math.max(0, this.allostaticLoad);
  }

  /** Check allostatic load thresholds */
  allostaticLevel(): "normal" | "mild" | "moderate" | "severe" {
    if (this.allostaticLoad > 2.0) return "severe";
    if (this.allostaticLoad > 1.0) return "moderate";
    if (this.allostaticLoad > 0.5) return "mild";
    return "normal";
  }

  /** Snapshot for serialization */
  snapshot(): HomeostaticSnapshot {
    return {
      energy: this.energy.value,
      arousal: this.arousal.value,
      safety: this.safety.value,
      connection: this.connection.value,
      mastery: this.mastery.value,
      allostaticLoad: this.allostaticLoad,
      setPoints: {
        energy: this.energy.setPoint,
        arousal: this.arousal.setPoint,
        safety: this.safety.setPoint,
        connection: this.connection.setPoint,
        mastery: this.mastery.setPoint,
      },
    };
  }

  /** Restore from snapshot */
  restore(snap: HomeostaticSnapshot): void {
    this.energy.value = snap.energy;
    this.arousal.value = snap.arousal;
    this.safety.value = snap.safety;
    this.connection.value = snap.connection;
    this.mastery.value = snap.mastery;
    this.allostaticLoad = snap.allostaticLoad;
    this.energy.setPoint = snap.setPoints.energy;
    this.arousal.setPoint = snap.setPoints.arousal;
    this.safety.setPoint = snap.setPoints.safety;
    this.connection.setPoint = snap.setPoints.connection;
    this.mastery.setPoint = snap.setPoints.mastery;
  }

  /** Summary for prompt injection */
  formatForPrompt(): string {
    const effects = this.getNeuromodulatoryEffects();
    return [
      `精力: ${this.energy.value.toFixed(2)}/${this.energy.setPoint.toFixed(2)}`,
      `激活: ${this.arousal.value.toFixed(2)}/${this.arousal.setPoint.toFixed(2)}`,
      `安全: ${this.safety.value.toFixed(2)}/${this.safety.setPoint.toFixed(2)}`,
      `连接: ${this.connection.value.toFixed(2)}/${this.connection.setPoint.toFixed(2)}`,
      `掌控: ${this.mastery.value.toFixed(2)}/${this.mastery.setPoint.toFixed(2)}`,
      `应激负荷: ${this.allostaticLoad.toFixed(2)} (${this.allostaticLevel()})`,
      effects.cognitiveNarrowing ? "⚠认知窄化" : "",
    ].filter(Boolean).join(" · ");
  }

  /**
   * Downstream neuromodulatory effects of allostatic load (McEwen 1998, Sterling 1988).
   *
   * Allostatic load is not just an accumulator — it actively modulates:
   *   - Arousal baseline (chronically elevated under high load)
   *   - Safety perception (progressively eroded)
   *   - Learning rate (impaired prefrontal function)
   *   - Cognitive narrowing (rigid, stereotyped thinking under severe load)
   */
  getNeuromodulatoryEffects(): {
    /** Arousal baseline shift — high load = chronically elevated arousal */
    arousalShift: number;
    /** Safety decay — high load erodes safety perception */
    safetyDecay: number;
    /** Learning rate impairment — prefrontal function degrades */
    learningRateImpairment: number;
    /** Cognitive narrowing — rigid thinking when load > 0.7 */
    cognitiveNarrowing: boolean;
    /** Severity level for UI / prompt injection */
    severity: "normal" | "mild" | "moderate" | "severe";
  } {
    const load = this.allostaticLoad;
    return {
      arousalShift: load * 0.3,
      safetyDecay: load * 0.15,
      learningRateImpairment: Math.max(0, load - 0.6) * 0.5,
      cognitiveNarrowing: load > 0.7,
      severity: this.allostaticLevel(),
    };
  }
}
