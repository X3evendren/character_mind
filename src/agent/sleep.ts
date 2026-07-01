/**
 * Sleep System — batch processing during offline periods.
 *
 * Sleep is triggered automatically when sleep_drive > 0.8 AND
 * no active conversation for > 30 minutes.
 *
 * Sleep cycles simulate 4 NREM/REM cycles (each ~90min in humans,
 * compressed to computation time).
 *
 * Functions:
 *   - Memory consolidation (system consolidation: hippocampal → cortical)
 *   - Synaptic downscaling (weak edges pruned)
 *   - Emotional memory "distillation" (keep gist, reduce intensity)
 *   - Fear extinction (re-evaluate Safety threats in safe context)
 *   - Creative association (random distant memory pairs → new edges)
 *   - Energy restoration
 *   - Allostatic load halving
 *   - Interoceptive precision reset
 *   - Mood natural decay
 *
 * Results in a "morning snapshot" → today's baseline.
 */

import type { ForceField } from "../mind/force-field";

// ═══════════════════════════════════════════════════════════════
// Sleep drive monitoring
// ═══════════════════════════════════════════════════════════════

export interface CircadianInfo {
  hour: number;
  /** Raw circadian pressure contribution */
  pressure: number;
  /** Time of day label */
  phase: "morning" | "afternoon" | "evening" | "night" | "late_night";
}

/**
 * Compute circadian pressure based on time of day.
 * High at 02:00-05:00, low at 10:00-18:00, rising after 21:00.
 */
export function computeCircadianPressure(hour: number): CircadianInfo {
  let pressure: number;
  let phase: CircadianInfo["phase"];

  if (hour >= 0 && hour < 6) {
    pressure = 0.85;
    phase = "late_night";
  } else if (hour >= 6 && hour < 9) {
    pressure = 0.45;
    phase = "morning";
  } else if (hour >= 9 && hour < 12) {
    pressure = 0.15;
    phase = "morning";
  } else if (hour >= 12 && hour < 17) {
    pressure = 0.10;
    phase = "afternoon";
  } else if (hour >= 17 && hour < 21) {
    pressure = 0.25;
    phase = "evening";
  } else if (hour >= 21 && hour < 23) {
    pressure = 0.55;
    phase = "night";
  } else {
    pressure = 0.75;
    phase = "night";
  }

  return { hour, pressure, phase };
}

/**
 * Update sleep drive based on circadian rhythm, wake duration,
 * energy, allostatic load, and emotional exhaustion.
 */
export function updateSleepDrive(
  sleepFF: ForceField,
  circadianPressure: number,
  hoursAwake: number,
  energyValue: number,
  allostaticLoad: number,
  engagedInConversation: boolean,
): number {
  const forces = [
    // ↑ sleep pressure
    { name: "circadian",     direction: 1 as const, magnitude: circadianPressure * 0.4, weight: 1.0 },
    { name: "wake_hours",     direction: 1 as const, magnitude: Math.min(1, hoursAwake / 16) * 0.3, weight: 1.0 },
    { name: "energy_debt",    direction: 1 as const, magnitude: (1 - energyValue) * 0.25, weight: 1.0 },
    { name: "allostatic_rest",direction: 1 as const, magnitude: allostaticLoad * 0.2, weight: 1.0 },

    // ↓ keep awake
    { name: "engagement",     direction: -1 as const, magnitude: engagedInConversation ? 0.35 : 0, weight: 1.0 },
  ];

  return sleepFF.update(forces);
}
