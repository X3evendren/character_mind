export const GOALS = ['connection', 'autonomy', 'competence', 'integrity', 'curiosity'] as const;
export type Goal = typeof GOALS[number];
export const GOAL_NAMES: Record<Goal, string> = { connection: '联结', autonomy: '自主', competence: '胜任', integrity: '真诚与承诺', curiosity: '探索' };
export interface PsychologicalProfile {
  goalWeights: Record<Goal, number>;
  reactivity: number; memoryCoupling: number;
  emotionHalfLifeMs: number; moodHalfLifeMs: number;
  expressiveness: number; restraint: number; reappraisal: number;
  relationshipLearningRate: number; boundaryPreference: number; decisionInertia: number;
  learningRate: number; discount: number; epistemicWeight: number;
  initiativeThreshold: number; initiativeCooldownMs: number;
}
/** Engineering defaults, not fitted psychological measurements. */
export const DEFAULT_PROFILE: PsychologicalProfile = {
  goalWeights: { connection: .85, autonomy: .8, competence: .6, integrity: .9, curiosity: .75 },
  reactivity: 1.15, memoryCoupling: .35, emotionHalfLifeMs: 900000, moodHalfLifeMs: 10800000,
  expressiveness: .85, restraint: .2, reappraisal: .45, relationshipLearningRate: .6,
  boundaryPreference: .7, decisionInertia: .12,
  learningRate: .18, discount: .65, epistemicWeight: .25,
  initiativeThreshold: .12, initiativeCooldownMs: 300000,
};
export function validateProfile(raw: unknown = {}): PsychologicalProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('心理参数必须是对象');
  const input = raw as Partial<PsychologicalProfile>;
  for (const key of Object.keys(input)) if (!(key in DEFAULT_PROFILE)) throw new Error('未知心理参数：' + key);
  if ('goalWeights' in input && (!input.goalWeights || typeof input.goalWeights !== 'object' || Array.isArray(input.goalWeights) || Object.keys(input.goalWeights).some(k => !GOALS.includes(k as Goal)))) throw new Error('未知目标参数');
  const result = { ...DEFAULT_PROFILE, ...input, goalWeights: { ...DEFAULT_PROFILE.goalWeights, ...input.goalWeights } };
  for (const [key, value] of Object.entries(result)) {
    if (key === 'goalWeights') continue;
    const min = key.endsWith('Ms') ? 1000 : 0;
    const max = key.endsWith('Ms') ? 604800000 : key === 'reactivity' ? 2 : 1;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('心理参数超出范围：' + key);
  }
  for (const value of Object.values(result.goalWeights)) if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('目标权重必须在 0..1 内');
  return structuredClone(result);
}
