import { GOALS, type Goal } from './profile.ts';
import { RELATION_DIMENSIONS, type RelationDimension } from './process-state.ts';
import { POLICIES, type Policy } from './motivation.ts';
export interface ActionForecast { policy: Policy; goalChange: Record<Goal, number>; confidence: number; evidence: string; }
export interface Appraisal {
  goalImpact: Record<Goal, number>;
  novelty: number; urgency: number; certainty: number;
  responsibility: 'self' | 'other' | 'situation' | 'unclear';
  anticipated: boolean; interaction: 'conversation' | 'task';
  reliability: number; structure: string[]; contextBinding: number; controllability: number; evidence: string;
  relationship?: Array<{ dimension: RelationDimension; value: number; confidence: number; basis: 'statement' | 'observed'; evidence: string }>;
  repair?: { kind: 'acknowledgement' | 'clarification' | 'fulfilled'; targets: Goal[]; evidence: string };
  experience?: { affectAccess: number; selfContinuity: number; evidence: string };
  relations?: Array<{ subject: string; predicate: string; object: string }>;
  forecasts?: ActionForecast[];
}
const bounded = (n: unknown, min = 0) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= 1;
const text = (s: unknown, max = 2000): s is string => typeof s === 'string' && !!s.trim() && s.length <= max;
export function validateAppraisal(raw: unknown): Appraisal {
  const a = raw as Appraisal;
  if (!a || !a.goalImpact || !GOALS.every(k => bounded(a.goalImpact[k], -1)) || !text(a.evidence)) throw new Error('Invalid appraisal goals or evidence');
  if (![a.novelty, a.urgency, a.certainty, a.reliability, a.contextBinding, a.controllability].every(v => bounded(v))) throw new Error('Invalid appraisal dimension');
  if (!['self','other','situation','unclear'].includes(a.responsibility) || typeof a.anticipated !== 'boolean' || !['conversation','task'].includes(a.interaction)) throw new Error('Invalid appraisal context');
  if (!Array.isArray(a.structure) || a.structure.length > 16 || a.structure.some(x => !text(x, 100))) throw new Error('Invalid structural tags');
  if (a.relationship !== undefined && (!Array.isArray(a.relationship) || a.relationship.length > 3 || new Set(a.relationship.map(r => r?.dimension)).size !== a.relationship.length || a.relationship.some(r => !r || !RELATION_DIMENSIONS.includes(r.dimension) || !bounded(r.value) || !bounded(r.confidence) || !['statement','observed'].includes(r.basis) || !text(r.evidence)))) throw new Error('Invalid relationship evidence');
  if (a.repair !== undefined && (!a.repair || !['acknowledgement','clarification','fulfilled'].includes(a.repair.kind) || !Array.isArray(a.repair.targets) || !a.repair.targets.length || a.repair.targets.length > GOALS.length || a.repair.targets.some(g => !GOALS.includes(g)) || !text(a.repair.evidence))) throw new Error('Repair requires targets and evidence');
  if (a.experience !== undefined && (!a.experience || ![a.experience.affectAccess,a.experience.selfContinuity].every(v => bounded(v)) || !text(a.experience.evidence))) throw new Error('Experience requires an evidence basis');
  if (a.relations !== undefined && (!Array.isArray(a.relations) || a.relations.length > 16 || a.relations.some(r => !r || [r.subject,r.predicate,r.object].some(s => !text(s,100))))) throw new Error('Invalid subjective relation');
  if (a.forecasts !== undefined && (!Array.isArray(a.forecasts) || a.forecasts.length > 5 || new Set(a.forecasts.map(x => x?.policy)).size !== a.forecasts.length || a.forecasts.some(x => !x || !POLICIES.includes(x.policy) || !bounded(x.confidence) || !text(x.evidence) || !x.goalChange || !GOALS.every(g => bounded(x.goalChange[g], -1))))) throw new Error('Invalid action forecast');
  return {
    goalImpact: Object.fromEntries(GOALS.map(k => [k,a.goalImpact[k]])) as Record<Goal,number>,
    novelty: a.novelty, urgency: a.urgency, certainty: a.certainty, responsibility: a.responsibility,
    anticipated: a.anticipated, interaction: a.interaction, reliability: a.reliability,
    structure: [...new Set(a.structure)], contextBinding: a.contextBinding, controllability: a.controllability, evidence: a.evidence.trim(),
    ...(a.relationship ? { relationship: a.relationship.map(({dimension,value,confidence,basis,evidence}) => ({dimension,value,confidence,basis,evidence})) } : {}),
    ...(a.repair ? { repair: { kind: a.repair.kind, targets: [...new Set(a.repair.targets)], evidence: a.repair.evidence } } : {}),
    ...(a.experience ? { experience: { affectAccess: a.experience.affectAccess, selfContinuity: a.experience.selfContinuity, evidence: a.experience.evidence } } : {}),
    ...(a.relations ? { relations: a.relations.map(({subject,predicate,object}) => ({subject,predicate,object})) } : {}),
    ...(a.forecasts ? { forecasts: a.forecasts.map(({policy,goalChange,confidence,evidence}) => ({policy,goalChange:Object.fromEntries(GOALS.map(g => [g,goalChange[g]])) as Record<Goal,number>,confidence,evidence})) } : {}),
  };
}
