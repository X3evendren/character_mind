/**
 * SetPoint Drift — long-term personality adaptation.
 *
 * When a variable is consistently above/below its setpoint over weeks,
 * the setpoint slowly drifts. This models:
 *   - Dependence: consistently high connection → needs more to feel satisfied
 *   - Adaptation: consistently low safety → learns to function with less
 */

import type { HomeostaticState } from "./homeostatic-state";

const DRIFT_MIN_DAYS = 14;
const MAX_WEEKLY_DRIFT = 0.05;

/** Check and apply setpoint drift for all driftable variables */
export function applySetpointDrift(
  state: HomeostaticState,
  dataDays: number,
): void {
  if (dataDays < DRIFT_MIN_DAYS) return;

  for (const name of ["safety", "connection", "mastery"] as const) {
    const v = state[name];
    if (!v.driftable) continue;

    const ema = v.recentEma;
    const drift = (ema - v.setPoint) * v.driftRate * (dataDays / 7);

    // Clamp drift to max weekly rate
    const clamped = Math.max(-MAX_WEEKLY_DRIFT, Math.min(MAX_WEEKLY_DRIFT, drift));
    v.setPoint = Math.max(0.3, Math.min(0.9, v.setPoint + clamped));
  }
}

/** Update EMA of recent values (called once per turn) */
export function updateRecentEMA(state: HomeostaticState): void {
  const alpha = 0.01; // slow EMA
  for (const name of ["safety", "connection", "mastery"] as const) {
    const v = state[name];
    if (!v.driftable) continue;
    v.recentEma = alpha * v.value + (1 - alpha) * v.recentEma;
  }
}
