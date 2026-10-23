import type { Appraisal } from '../../src/mind/appraisal.ts';
export const neutralGoals = { connection: 0, autonomy: 0, competence: 0, integrity: 0, curiosity: 0 };
export function assessment(overrides: Partial<Appraisal> = {}): Appraisal {
  return { goalImpact: { ...neutralGoals, connection: -.8, integrity: -.5 }, novelty: .4, urgency: .5, certainty: .7,
    responsibility: 'other', anticipated: false, interaction: 'conversation', reliability: .8,
    structure: ['conflict_unresolved','departure'], contextBinding: .9, controllability: .8,
    evidence: '模型推断：未解决冲突后离开', ...overrides };
}
