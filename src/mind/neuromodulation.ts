import type { ProcessState } from './process-state.ts';
import type { Appraisal } from './appraisal.ts';

/** Dimensionless computational analogues, NOT neurotransmitter concentrations.
 * These signals share the appraisal → outcome → learning → action loop.
 * Coefficients are engineering assumptions; see docs/dynamics.md for evidence. */
export interface Neuromodulation {
  rewardPredictionError: number; rewardRate: number; incentive: number;
  alerting: number; uncertainty: number; socialSalience: number; attachment: number;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
const signed = (n: number) => Math.max(-1, Math.min(1, n));
export function initialNeuromodulation(): Neuromodulation {
  return { rewardPredictionError: 0, rewardRate: 0, incentive: 0, alerting: .2, uncertainty: .3, socialSalience: 0, attachment: 0 };
}
export function decayNeuromodulation(n: Neuromodulation, fast: number, slow: number): void {
  n.rewardPredictionError *= fast; n.rewardRate *= slow; n.incentive *= fast;
  n.alerting = .2 + (n.alerting - .2) * fast;
  n.uncertainty = .3 + (n.uncertainty - .3) * slow;
  n.socialSalience *= fast;
  // Attachment requires new relational evidence to change; silence is not rejection.
}
export function observeNeuromodulation(s: ProcessState, a: Appraisal): void {
  const n = s.neuromodulation, r = a.reliability;
  const surprise = Math.max(a.novelty, ...Object.values(a.goalImpact).map(Math.abs));
  n.alerting = unit(n.alerting + .6 * r * (Math.max(a.urgency, surprise) - n.alerting));
  n.uncertainty = unit(n.uncertainty + .25 * r * (1 - a.certainty - n.uncertainty));
  const social = Math.max(Math.abs(a.goalImpact.connection), Math.abs(a.goalImpact.integrity), ...(a.relationship ?? []).map(x => x.confidence));
  n.socialSalience = unit(n.socialSalience + .5 * r * (social - n.socialSalience));
  // Context-sensitive salience can amplify adverse as well as friendly evidence.
  for (const x of a.relationship ?? []) {
    if (x.basis !== 'observed' || x.dimension === 'availability') continue;
    n.attachment = unit(n.attachment + .06 * r * x.confidence * (x.value - n.attachment));
  }
  const opportunity = Math.max(0, ...Object.values(a.goalImpact));
  n.incentive = unit(n.incentive + .35 * r * (opportunity * (a.anticipated ? 1 : .6) - n.incentive));
}
export function signalReward(s: ProcessState, reward: number, error: number, confidence: number): void {
  const n = s.neuromodulation;
  n.rewardPredictionError = signed(error * confidence);
  n.rewardRate = signed(.95 * n.rewardRate + .05 * confidence * reward);
  n.incentive = unit(n.incentive + .2 * confidence * error);
}
/** A single set of bounded gains is consumed by memory, belief, RL, policy and generation. */
export function modulationGains(s: ProcessState) {
  const n = s.neuromodulation;
  return {
    attention: .85 + .4 * n.alerting - .15 * n.uncertainty,
    social: 1 + .4 * n.socialSalience,
    learning: .65 + .5 * n.alerting + .25 * Math.abs(n.rewardPredictionError),
    exploration: .5 + n.uncertainty,
    vigor: .7 + .55 * n.incentive + .3 * Math.max(0, n.rewardRate),
    affiliation: 1 + .25 * n.attachment,
  };
}
