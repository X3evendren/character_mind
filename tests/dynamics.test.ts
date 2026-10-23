import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CognitiveCore } from '../src/mind/cognitive-core.ts';
import { KnowledgeGraph } from '../src/memory/knowledge-graph.ts';
import { DEFAULT_PROFILE, validateProfile } from '../src/mind/profile.ts';
import { beliefMean, effectiveAffect } from '../src/mind/process-state.ts';
import { expectedInformationGain, scorePolicies } from '../src/mind/motivation.ts';
import { modulationGains } from '../src/mind/neuromodulation.ts';
import { responsePlan } from '../src/agent/response-controller.ts';
import { CharacterAgent } from '../src/agent/agent.ts';
import { ToolRegistry } from '../src/tools/registry.ts';
import { GuardPipeline } from '../src/guard/pipeline.ts';
import { assessment, neutralGoals } from './fixtures/appraisal.ts';

function core() { return new CognitiveCore(new KnowledgeGraph(), 0); }
function event(c: CognitiveCore, a = assessment(), now = c.state.at + 1) {
  const n = c.observe(a.evidence, 'user', now); c.appraise(n.id, a, now); return n;
}
function action(c: CognitiveCore, id: string) { c.decide(id); c.markAction(c.graph.all('decision').at(-1)!.id, id); }
const joy = () => assessment({ goalImpact: { ...neutralGoals, connection: .8, curiosity: 1 }, novelty: 1, urgency: .1, anticipated: true, reliability: 1, structure: ['shared_interest','discovery'], evidence: '共同探索喜欢的作品' });

test('positive events cause arousal, mixed feelings retain both sources, apology is not erasure', () => {
  const c = core(); const hurt = event(c); const negative = effectiveAffect(c.state).negative;
  event(c, joy());
  assert.ok(c.state.arousal > .3); assert.ok(effectiveAffect(c.state).positive > .4);
  assert.ok(effectiveAffect(c.state).negative >= negative - .001);
  assert.ok(c.phenomena.some(x => x.kind === 'mixed_affect' && x.sourceEventIds.includes(hurt.id)));
  event(c, assessment({ goalImpact: neutralGoals, structure: [], repair: { kind: 'acknowledgement', targets: ['connection','integrity'], evidence: '明确承认伤害' } }));
  assert.ok(effectiveAffect(c.state).negative > .2); assert.ok(c.state.concerns.length > 0);
});
test('fulfilled repair has more effect than acknowledgment and unrelated targets do not erase concerns', () => {
  const a = core(), b = core(), unrelated = core(); [a,b,unrelated].forEach(c=>event(c));
  for (const [c,kind,targets] of [[a,'acknowledgement',['connection']],[b,'fulfilled',['connection']],[unrelated,'fulfilled',['competence']]] as const) {
    event(c, assessment({ goalImpact: neutralGoals, structure: [], repair: { kind, targets: [...targets], evidence: '修复证据' } }));
  }
  assert.ok(b.state.concerns[0].load < a.state.concerns[0].load);
  assert.ok(unrelated.state.concerns[0].load > a.state.concerns[0].load);
});
test('restraint changes expression, not internal affect or unresolved memory', () => {
  const a = core(), b = new CognitiveCore(new KnowledgeGraph(), 0, { ...DEFAULT_PROFILE, restraint: .9 });
  event(a); event(b);
  assert.deepEqual(effectiveAffect(a.state),effectiveAffect(b.state));
  assert.equal(a.state.concerns[0].load,b.state.concerns[0].load);
  const plan = (c:CognitiveCore) => responsePlan(c.state,c.profile,scorePolicies(c.state,c.profile)[0]);
  assert.ok(plan(b).expression < plan(a).expression); assert.ok(plan(b).temperature < plan(a).temperature);
});
test('observed behavior updates belief more than promises; social salience is not automatic trust', () => {
  const promise = core(), observed = core(), adverse = core();
  for (const [c,basis,value] of [[promise,'statement',1],[observed,'observed',1],[adverse,'observed',0]] as const) event(c, assessment({ goalImpact: neutralGoals, structure: [], relationship:[{ dimension:'goodwill',value,confidence:1,basis,evidence:'本次关系证据' }] }));
  assert.ok(beliefMean(observed.state.belief.goodwill)>beliefMean(promise.state.belief.goodwill));
  assert.equal(promise.state.neuromodulation.attachment,0);
  assert.ok(observed.state.neuromodulation.attachment>0);
  assert.ok(adverse.state.neuromodulation.socialSalience>0);
  assert.ok(beliefMean(adverse.state.belief.goodwill)<.5);
});
test('TD outcome, dopamine analogue and future policy share one learning event; self speech is not reward', () => {
  const c = core(); const source = event(c); action(c,source.id);
  const self = c.observe('我自己觉得已经解决了','assistant',2);
  assert.throws(()=>c.appraise(self.id,joy(),2),/external/);
  assert.equal(c.state.neuromodulation.rewardPredictionError,0);
  const feedback = event(c,joy(),3); const learning = c.state.motivation.lastLearning!;
  assert.ok(learning.reward > 0); assert.ok(learning.predictionError > 0);
  assert.equal(learning.sourceEventId,feedback.id);
  assert.ok(c.state.neuromodulation.rewardPredictionError>0);
  assert.ok(Object.values(c.state.motivation.actionValues).some(v=>Object.values(v).some(x=>x.value>0)));
  const snapshot=structuredClone(c.state); c.appraise(feedback.id,joy(),4); assert.deepEqual(c.state,snapshot);
  assert.equal(c.graph.all('learning').length,1);
});
test('negative feedback yields negative prediction error and neutral feedback gives no success credit', () => {
  const c=core(); const first=event(c,joy()); action(c,first.id); event(c);
  assert.ok(c.state.motivation.lastLearning!.reward<0); assert.ok(c.state.neuromodulation.rewardPredictionError<0);
  const neutral=core(); const source=event(neutral,assessment({goalImpact:neutralGoals,structure:[]})); action(neutral,source.id);
  event(neutral,assessment({goalImpact:neutralGoals,structure:[]}),10000001);
  assert.equal(neutral.state.motivation.lastLearning!.reward,0);
  const v=Object.values(neutral.state.motivation.actionValues).flatMap(x=>Object.values(x))[0];
  assert.equal(v.success,1); assert.equal(v.failure,1);
});
test('modulation affects learning, policy costs and attention without manufacturing pleasure', () => {
  const c=core(), baseline=structuredClone(c.state);
  c.state.neuromodulation.incentive=1; c.state.neuromodulation.alerting=1;
  c.state.neuromodulation.rewardPredictionError=1;
  assert.deepEqual(effectiveAffect(c.state),effectiveAffect(baseline));
  assert.ok(modulationGains(c.state).learning>modulationGains(baseline).learning);
  assert.ok(modulationGains(c.state).attention>modulationGains(baseline).attention);
  const cost=(s:typeof baseline)=>scorePolicies(s,c.profile).find(x=>x.policy==='explore')!.cost;
  assert.ok(cost(c.state)<cost(baseline));
});
test('all passive dynamics are elapsed-time invariant and do not invent relationship evidence or rewards', () => {
  const a=core(), b=core(); event(a,joy());event(b,joy());
  const beliefs=structuredClone(a.state.belief);
  a.advance(900001);for(let t=100001;t<=900001;t+=100000)b.advance(t);
  for(const k of Object.keys(a.state.neuromodulation) as Array<keyof typeof a.state.neuromodulation>) assert.ok(Math.abs(a.state.neuromodulation[k]-b.state.neuromodulation[k])<1e-10);
  assert.deepEqual(a.state.belief,beliefs);assert.equal(a.graph.all('learning').length,0);
});
test('information gain is zero for an uninformative observation and forecasts change utility without changing facts', () => {
  assert.equal(expectedInformationGain(.5,.5),0);assert.ok(expectedInformationGain(.5,.85)>0);
  const c=core();event(c);const before=structuredClone(c.state);
  const baseline=scorePolicies(c.state,c.profile).find(x=>x.policy==='clarify')!.score;
  c.state.appraisal.forecasts=[{policy:'clarify',goalChange:{...neutralGoals,connection:.9,integrity:.9},confidence:1,evidence:'澄清或许能解决误解'}];
  assert.notEqual(scorePolicies(c.state,c.profile).find(x=>x.policy==='clarify')!.score,baseline);
  assert.deepEqual(c.state.belief,before.belief);assert.equal(c.state.positive,before.positive);
});
test('initiative requires a specific drive, idle interval and cooldown; own initiative supplies no new appraisal', () => {
  const quiet=core();event(quiet,assessment({goalImpact:neutralGoals,structure:[],certainty:1}));
  quiet.advance(120001);assert.equal(quiet.initiative(120001),undefined);
  const c=core();const source=event(c,joy());assert.equal(c.initiative(1001),undefined);
  c.advance(120001);assert.ok(c.initiative(120001));
  c.decide(source.id,true);c.markAction(c.graph.all('decision').at(-1)!.id,source.id,true);
  assert.equal(c.initiative(720001),undefined);assert.equal(c.graph.all('appraisal').length,1);
});
test('task mode suppresses initiative and keeps bounded deterministic generation controls', () => {
  const c=core();event(c,{...joy(),interaction:'task'});c.advance(120001);
  assert.equal(c.initiative(120001),undefined);
  const scores=scorePolicies(c.state,c.profile), plan=responsePlan(c.state,c.profile,scores[0]);
  assert.equal(scores[0].policy,'cooperate');assert.equal(plan.candidateCount,1);assert.equal(plan.temperature,.35);
  assert.throws(()=>validateProfile({goalWeights:null}));assert.throws(()=>validateProfile({reactivity:NaN}));
});
test('v2 migration preserves source data and avoids inventing relationship confidence or learned rewards', () => {
  const graph=new KnowledgeGraph();const source=graph.add('event','旧事',{role:'user'});
  const old=graph.add('state','旧状态',{state:{version:2,at:0,valence:-.4,arousal:.7,contextBinding:.5,sourceEventId:source.id,reliability:.8,belief:{safe:.1,threat:.9}},phenomena:[]});
  const c=new CognitiveCore(graph,0);assert.equal(c.state.valence,-.4);assert.equal(beliefMean(c.state.belief.goodwill),.5);
  assert.deepEqual(c.state.motivation.actionValues,{});assert.equal(c.state.neuromodulation.attachment,0);assert.deepEqual(graph.get(old.id),old);
});

function agent(providerOverrides:Record<string,unknown>={}, opts:Record<string,unknown>={}) {
  const provider={model:'fixture',chat:async()=>({content:'alternate',finishReason:'stop',usage:{totalTokens:5},toolCalls:[]}),chatStream:async(...args:any[])=>{await args[4]('first');return {content:'first',finishReason:'stop',usage:{totalTokens:10},toolCalls:[]};},...providerOverrides};
  return new CharacterAgent({configDir:'./config',dataDir:mkdtempSync(join(tmpdir(),'dynamics-')),genProvider:provider as any,psychProvider:provider as any,toolRegistry:new ToolRegistry(),guardPipeline:new GuardPipeline([]),appraisalProvider:{assess:async()=>assessment()},...opts});
}
test('candidate reranking commits only selected response, records controls and does not reward the judge', async()=>{
  let calls=0;
  const a=agent({chat:async()=>({content:++calls===1?'emotionally matched':JSON.stringify({scores:[{grounding:1,affect:.1,policy:.2,naturalness:.7},{grounding:1,affect:1,policy:1,naturalness:.9}]}),finishReason:'stop',usage:{totalTokens:5},toolCalls:[]})});
  const result=await a.run('具体事件');assert.equal(result.response,'emotionally matched');assert.equal(result.totalTokens,20);
  assert.deepEqual(a.graph.all('event').map(n=>n.text),['具体事件','emotionally matched']);
  assert.equal(a.graph.all('learning').length,0);assert.equal(a.graph.all('control')[0].data.decisionId,a.graph.all('decision')[0].id);
  assert.equal((a.graph.all('control')[0].data.selection as any).status,'ranked');
});
test('malformed judgment falls back and truncated generation never becomes a complete memory', async()=>{
  const a=agent();assert.equal((await a.run('事件')).response,'first');
  assert.equal((a.graph.all('control')[0].data.selection as any).status,'fallback');
  const broken=agent({chatStream:async(...args:any[])=>{await args[4]('half');return{finishReason:'length',toolCalls:[]};}});
  await assert.rejects(broken.run('事件'),/截断/);assert.deepEqual(broken.graph.all('event').map(n=>n.data.role),['user']);
});
test('initiative uses no fake user, no tools and no appraisal, and a completed action cannot repeat',async()=>{
  let toolOptions:any;
  const a=agent({chatStream:async(...args:any[])=>{toolOptions=args[3];await args[4]('我还想听你说说那首曲子。');return{finishReason:'stop',toolCalls:[]};}},{candidateSelection:false});
  const source=a.cognition.observe('共同探索喜欢的作品','user',Date.now()-120000);a.cognition.appraise(source.id,joy());
  assert.ok(a.getInitiative());for await(const _ of a.runInitiative()){}
  assert.deepEqual(toolOptions,[]);assert.equal(a.graph.all('appraisal').length,1);assert.equal(a.graph.all('learning').length,0);
  assert.deepEqual(a.graph.all('event').map(n=>n.data.role),['user','assistant']);assert.equal(a.getInitiative(),undefined);
  assert.equal(a.graph.related(a.graph.all('event').at(-1)!.id,'continues')[0].id,source.id);
});
test('a cancelled alternative cannot be committed and background ticks cannot mutate an active turn',async()=>{
  const abort=new AbortController();
  const a=agent({chat:async()=>{abort.abort();return{content:'alternate',toolCalls:[]};}});
  const turn=a.runStream('事件',{signal:abort.signal});await turn.next();
  const at=a.cognition.state.at;a.tick(at+100000);assert.equal(a.cognition.state.at,at);
  await assert.rejects(async()=>{for await(const _ of turn){}});
  assert.deepEqual(a.graph.all('event').map(n=>n.data.role),['user']);
  a.tick(at-100000);assert.ok(a.cognition.state.at>=at);
});
test('default character has no tools and unexpected model tool calls cannot execute',async()=>{
  const a=agent({}, {toolRegistry:undefined,candidateSelection:false});await a.initialize();
  assert.deepEqual(a.toolRegistry.getDefinitions(),[]);
  let executed=false;a.toolRegistry.execute=async()=>{executed=true;throw new Error('must not execute');};
  a.fastProvider.chatStream=async()=>({content:'',reasoningContent:'',usage:{},finishReason:'tool_calls',toolCalls:[{id:'unexpected',name:'exec_command',arguments:{command:'echo test'}}]});
  await assert.rejects(a.run('普通交流'),/unavailable/);assert.equal(executed,false);
  assert.deepEqual(a.graph.all('event').map(n=>n.data.role),['user']);
});
test('blocked initiative cannot repeatedly retry the same source or create a pending rewarded action',async()=>{
  const a=agent({}, {candidateSelection:false,guardPipeline:new GuardPipeline([{name:'block',onOutput:()=>({passed:false,action:'block'})}])});
  const source=a.cognition.observe('共同兴趣','user',Date.now()-120000);a.cognition.appraise(source.id,joy());
  assert.ok(a.getInitiative());for await(const _ of a.runInitiative()){}
  assert.equal(a.cognition.state.motivation.pending,undefined);assert.equal(a.getInitiative(),undefined);
  assert.equal(a.graph.all('learning').length,0);
});
