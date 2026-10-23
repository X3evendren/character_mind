import { GOALS, GOAL_NAMES, type Goal, type PsychologicalProfile } from './profile.ts';
import { beliefMean, effectiveAffect, type ProcessState } from './process-state.ts';
import { modulationGains, signalReward } from './neuromodulation.ts';

export const POLICIES = ['engage','clarify','express_feeling','share_joy','set_boundary','ground','repair','explore','cooperate','wait'] as const;
export type Policy = typeof POLICIES[number];
export interface ActionValue { value: number; visits: number; success: number; failure: number; }
export interface MotivationState {
  satisfaction: Record<Goal, number>;
  energy: number;
  actionValues: Record<string, Partial<Record<Policy, ActionValue>>>;
  pending?: { policy: Policy; context: string; decisionId: string; sourceEventId: string; potential: number; at: number };
  lastLearning?: { reward: number; predictionError: number; confidence: number; sourceEventId: string; decisionId: string; policy: Policy };
  lastInitiativeAt: number | null;
  lastInitiativeSourceId: string | null;
}
export interface PolicyScore {
  policy: Policy; score: number; reason: string;
  expectedProgress: number; informationGain: number; learnedValue: number; cost: number;
  forecastContribution: number;
}
export const unit = (n: number) => Math.max(0,Math.min(1,n));
export const signed = (n: number) => Math.max(-1,Math.min(1,n));
export function initialMotivation(): MotivationState {
  return { satisfaction: Object.fromEntries(GOALS.map(g => [g,.65])) as Record<Goal,number>, energy: .85, actionValues: {}, lastInitiativeAt: null, lastInitiativeSourceId: null };
}
/** A psychological analogue of drive reduction, not a physiological measurement. */
export function drivePotential(s: ProcessState, profile: PsychologicalProfile): number {
  return GOALS.reduce((n,g) => n + profile.goalWeights[g] * Math.max(0,.8-s.motivation.satisfaction[g]) ** 2,0) / GOALS.length;
}
export function goalDrives(s: ProcessState, profile: PsychologicalProfile): Record<Goal,number> {
  return Object.fromEntries(GOALS.map(g => [g,unit(profile.goalWeights[g] * (Math.max(0,.8-s.motivation.satisfaction[g]) + .45 * (s.concerns.find(c=>c.goal===g)?.load ?? 0)))])) as Record<Goal,number>;
}
const entropy = (p:number) => p <= 0 || p >= 1 ? 0 : -p*Math.log(p)-(1-p)*Math.log(1-p);
/** Exact mutual information for a binary latent state and symmetric noisy observation. */
export function expectedInformationGain(prior: number, accuracy: number): number {
  const pYes = prior*accuracy+(1-prior)*(1-accuracy);
  const yesPosterior = pYes ? prior*accuracy/pYes : prior;
  const noPosterior = pYes < 1 ? prior*(1-accuracy)/(1-pYes) : prior;
  return Math.max(0,entropy(prior)-pYes*entropy(yesPosterior)-(1-pYes)*entropy(noPosterior));
}
export function decisionContext(s: ProcessState, p: PsychologicalProfile): string {
  const drives = goalDrives(s,p);
  const need = GOALS.reduce((a,b)=>drives[a]>=drives[b]?a:b);
  const affect = effectiveAffect(s);
  return `${need}:${affect.negative > .35 ? 'strained' : affect.positive > .35 ? 'positive' : 'neutral'}:${beliefMean(s.belief.reliability) < .45 ? 'guarded' : 'open'}`;
}
export function scorePolicies(s: ProcessState, p: PsychologicalProfile, previous?: Policy, initiative = false): PolicyScore[] {
  const a = s.appraisal, affect = effectiveAffect(s), drives = goalDrives(s,p);
  const gains = modulationGains(s);
  const trust = beliefMean(s.belief.goodwill), availability = beliefMean(s.belief.availability);
  const concern = Math.max(0,...s.concerns.map(c=>c.load));
  const regulationDemand = Math.max(1-s.contextBinding,(1-s.affectAccess)*(1-s.selfContinuity));
  const curiosity = Math.max(drives.curiosity,Math.max(0,a.goalImpact.curiosity)*p.goalWeights.curiosity);
  const task = a.interaction === 'task';
  // Hand-specified transition priors are transparent and are blended with learned values.
  const prior: Record<Policy,number> = {
    engage: .18+.2*trust+.15*affect.positive,
    clarify: (1-a.certainty)*(.3+.55*concern)+.15*drives.integrity,
    express_feeling: affect.negative*(.45+.45*p.expressiveness)+.25*drives.connection,
    share_joy: affect.positive*(.5+.4*s.arousal),
    set_boundary: Math.max(drives.autonomy,drives.integrity)*p.boundaryPreference*(a.responsibility==='other'?1:.4)+.3*affect.negative*s.agency,
    ground: regulationDemand*(.7+.3*s.arousal),
    repair: (a.repairKind!=='none'?.45:0)+drives.connection*.3+concern*trust*.2,
    explore: curiosity*(.55+.35*a.novelty),
    cooperate: task ? .95 : .05,
    wait: initiative ? .24+.2*(1-s.motivation.energy)+.2*(1-availability) : .02,
  };
  const explanations: Record<Policy,string> = {
    engage:'愿意继续交流', clarify:'用新的信息检验当前理解', express_feeling:'表达当前受触动的具体目标',
    share_joy:'分享正向体验与期待', set_boundary:'维护自主与承诺边界', ground:'恢复对当下和自身感受的接触',
    repair:'回应修复机会并保留尚未解决的部分', explore:'推进有来源的兴趣与问题', cooperate:'推进明确的共同任务', wait:'等待更合适的时机与反馈',
  };
  const context = decisionContext(s,p), values = s.motivation.actionValues[context] ?? {};
  return POLICIES.filter(policy => !initiative || ['clarify','express_feeling','share_joy','repair','explore','wait'].includes(policy)).map(policy => {
    const learned = values[policy];
    const success = learned ? learned.success/(learned.success+learned.failure) : .5;
    const affiliation = ['engage','repair','share_joy'].includes(policy) ? gains.affiliation : 1;
    const forecast = a.forecasts?.find(x=>x.policy===policy);
    // Predicted goal progress is a provisional world-model estimate, not new evidence.
    const forecastContribution = forecast ? GOALS.reduce((v,g)=>v+forecast.goalChange[g]*p.goalWeights[g]*(.3+drives[g]),0)/GOALS.length : 0;
    const forecastWeight = forecast ? .45*forecast.confidence*s.reliability : 0;
    const expectedProgress = (1-forecastWeight)*prior[policy]*(.7+.6*success)*affiliation + forecastWeight*forecastContribution*3;
    const accuracy = policy==='clarify' ? .85 : policy==='explore' ? .75 : policy==='repair' ? .65 : .5;
    const informationGain = expectedInformationGain(trust,accuracy)*(policy==='explore'?curiosity:1-a.certainty);
    const learnedWeight = learned ? Math.min(.5,learned.visits/(learned.visits+8)) : 0;
    const cost = policy==='wait' ? 0 : (.035+(1-s.motivation.energy)*.15+(initiative?.08:0))/gains.vigor;
    const taskBonus = task && policy==='cooperate' ? .6 : task && policy!=='ground' ? -.15 : 0;
    const score = (1-learnedWeight)*expectedProgress + learnedWeight*(learned?.value ?? 0) + p.epistemicWeight*gains.exploration*informationGain-cost+(previous===policy?p.decisionInertia*.2:0)+taskBonus;
    return { policy, score, reason: `${explanations[policy]}；主要驱力：${GOAL_NAMES[GOALS.reduce((x,y)=>drives[x]>=drives[y]?x:y)]}${forecast ? '；行动预测：'+forecast.evidence : ''}`, expectedProgress, informationGain, learnedValue: learned?.value ?? 0, cost, forecastContribution };
  }).sort((a,b)=>b.score-a.score);
}
/** TD learning uses the next observed turn; generated candidates never supply rewards. */
export function learnFromFeedback(s: ProcessState, profile: PsychologicalProfile, sourceEventId: string, confidence: number, beforePotential: number): MotivationState['lastLearning'] | undefined {
  const pending = s.motivation.pending;
  if (!pending || pending.sourceEventId===sourceEventId) return;
  delete s.motivation.pending; // One outcome can update the preceding action at most once.
  if (confidence <= 0) return;
  const reward = signed(4*(beforePotential-drivePotential(s,profile)));
  const nextContext = decisionContext(s,profile);
  const future = Math.max(0,...Object.values(s.motivation.actionValues[nextContext] ?? {}).map(v=>v.value));
  const bucket = s.motivation.actionValues[pending.context] ??= {};
  const value = bucket[pending.policy] ??= { value: 0, visits: 0, success: 1, failure: 1 };
  const predictionError = reward+profile.discount*future-value.value;
  signalReward(s,reward,predictionError,confidence);
  value.value = signed(value.value+profile.learningRate*modulationGains(s).learning*confidence*predictionError);
  value.visits++;
  // Neutral observations provide no spurious success/failure evidence.
  if (reward>0) value.success += confidence*Math.abs(reward);
  if (reward<0) value.failure += confidence*Math.abs(reward);
  return s.motivation.lastLearning = { reward, predictionError, confidence, sourceEventId, decisionId: pending.decisionId, policy: pending.policy };
}
