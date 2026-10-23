import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KnowledgeGraph } from '../src/memory/knowledge-graph.ts';
import { CognitiveCore, validateAppraisal, type Appraisal } from '../src/mind/cognitive-core.ts';
import { LanguageAppraisalProvider } from '../src/mind/appraisal-provider.ts';
import { importLegacyMemory } from '../src/memory/import-legacy.ts';
import { inferPhenomena, type PhenomenonRule } from '../src/mind/phenomena.ts';
import { assessment, neutralGoals } from './fixtures/appraisal.ts';

function episode(core: CognitiveCore, text: string, appraisal = assessment(), now = 1) {
  const event = core.observe(text, 'user', now);
  core.appraise(event.id, appraisal, now);
  return event;
}
test('raw observations survive an appraisal failure and restart', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'mind-test-')), 'graph.json');
  const core = new CognitiveCore(new KnowledgeGraph(path), 0);
  const event = core.observe('我的名字是小明', 'user', 1);
  assert.throws(() => core.appraise(event.id, assessment({ reliability: NaN }), 1));
  const loaded = new KnowledgeGraph(path);
  assert.equal(loaded.get(event.id)?.text, '我的名字是小明');
  assert.equal(loaded.all('appraisal').length, 0);
});
test('same evidence is counted once even after restart', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'mind-test-')), 'graph.json');
  const core = new CognitiveCore(new KnowledgeGraph(path), 0);
  const event = episode(core, '我们还没解决争执，我走了');
  const before = structuredClone(core.state);
  core.appraise(event.id, assessment(), 1);
  assert.deepEqual(core.state, before);
  const restored = new CognitiveCore(new KnowledgeGraph(path), 1);
  restored.appraise(event.id, assessment(), 2);
  assert.deepEqual(restored.state, before);
});
test('contextual appraisals distinguish identical words', () => {
  const safe = new CognitiveCore(new KnowledgeGraph(), 0);
  const threatened = new CognitiveCore(new KnowledgeGraph(), 0);
  episode(safe, '我先走了', assessment({ goalImpact: { ...neutralGoals, connection: .4 }, structure: ['return_promised', 'departure'] }));
  episode(threatened, '我先走了');
  assert.ok(safe.state.valence > threatened.state.valence);
  assert.ok(safe.state.motivation.satisfaction.connection > threatened.state.motivation.satisfaction.connection);
});
test('structural recurrence triggers affect with provenance across different wording', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  const source = episode(core, '争执之后，对方关门离开');
  episode(core, '事情没说清，对方挂断电话', assessment({ contextBinding: .05, controllability: .05,
    experience: { affectAccess: .05, selfContinuity: .05, evidence: '角色既有记录描述感受隔膜和自身体验疏离' } }), 2);
  const flashback = core.phenomena.find(p => p.kind === 'emotional_flashback');
  assert.ok(flashback && flashback.intensity > 0);
  assert.ok(core.phenomena.some(p => p.kind === 'dissociative_detachment' && p.intensity > 0));
  assert.ok(flashback.sourceEventIds.includes(source.id));
  assert.ok(core.state.affectAccess < 1);
  assert.ok(!('flashback' in core.state) && !('dissociation' in core.state));
  assert.equal(core.graph.get(source.id)?.text, '争执之后，对方关门离开');
});
test('unrelated structures do not create flashback sources', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  episode(core, '争执之后离开');
  episode(core, '收到礼物', assessment({ structure: ['gift', 'support'], contextBinding: .1 }), 2);
  assert.ok(!core.phenomena.some(p => p.kind === 'emotional_flashback'));
  assert.deepEqual(core.state.memoryActivations, []);
});
test('unsupported assessment cannot create intrusion or detachment', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  episode(core, '争执之后离开');
  episode(core, '歧义输入', assessment({ reliability: 0, controllability: 0, contextBinding: 0 }), 2);
  assert.ok(!core.phenomena.some(p => p.kind === 'emotional_flashback' || p.kind === 'dissociative_detachment'));
  assert.equal(core.state.contextBinding,1);
  assert.deepEqual(core.state.memoryActivations,[]);
});
test('grounded interpretation prevents old event from becoming current fact', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  episode(core, '争执之后离开');
  episode(core, '这是过去的记忆，现在我在安全的房间', assessment({ contextBinding: 1 }), 2);
  assert.ok(!core.phenomena.some(p => p.kind === 'emotional_flashback'));
  assert.ok(core.phenomena.some(p => p.kind === 'memory_resonance'));
  assert.equal(core.state.contextBinding, 1);
});
test('elapsed time is independent of tick frequency', () => {
  const a = new CognitiveCore(new KnowledgeGraph(), 0);
  const b = new CognitiveCore(new KnowledgeGraph(), 0);
  episode(a, '紧张'); episode(b, '紧张');
  a.advance(600001);
  for (let t=100001; t<=600001; t+=100000) b.advance(t);
  for (const k of ['arousal','valence','affectAccess','selfContinuity','contextBinding'] as const) assert.ok(Math.abs(a.state[k]-b.state[k]) < 1e-10);
  assert.throws(() => a.advance(0));
});
test('long stress sequences remain bounded and normalized', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  for (let i=1; i<=150; i++) episode(core, '持续冲突', assessment({ contextBinding: .05, controllability: .05 }), i);
  const s = core.state;
  assert.ok(Object.values(s.belief).every(b => Number.isFinite(b.alpha) && Number.isFinite(b.beta) && b.alpha > 0 && b.beta > 0));
  for (const v of [s.arousal,s.affectAccess,s.selfContinuity,s.contextBinding,s.agency,...core.phenomena.map(p=>p.intensity)]) assert.ok(Number.isFinite(v) && v>=0 && v<=1);
  assert.ok(core.decide(core.graph.all('event').at(-1)!.id).some(x => x.policy === 'ground'));
});
test('compression preserves nested raw evidence and independent emotional links', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  const a = episode(core, '没有答应明天回来');
  const b = episode(core, '感到难过但不知道对方动机', assessment(), 2);
  const c = core.observe('之后对方道歉', 'user', 3);
  const summary = core.graph.compress([a.id,b.id], '否定承诺；角色难过；动机不明');
  const nested = core.graph.compress([summary.id,c.id], '争执与修复经过');
  assert.deepEqual(core.graph.expand(nested.id).map(n=>n.text), [a.text,b.text,c.text]);
  assert.equal(core.graph.all('appraisal').length, 2);
  assert.equal(core.graph.all('state').length, 2);
  const state = core.graph.related(core.graph.all('appraisal')[1].id, 'updates')[0];
  const phenomena = core.graph.related(state.id, 'manifests');
  assert.ok(phenomena.length > 0);
  assert.ok(phenomena.some(p => core.graph.related(p.id, 'reactivates').some(n => n.id === a.id)));
});
test('detachment needs experience evidence, not low agency, neutral affect or threat alone', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  episode(core, '控制不了局面', assessment({ controllability: 0, contextBinding: 0 }), 1);
  assert.ok(!core.phenomena.some(p => p.kind === 'dissociative_detachment'));
  episode(core, '中性输入', assessment({ goalImpact: neutralGoals, structure: [] }), 2);
  assert.ok(!core.phenomena.some(p => p.kind === 'dissociative_detachment'));
  episode(core, '我知道这是现在，但像隔着玻璃感受自己', assessment({ contextBinding: 1,
    experience: { affectAccess: .05, selfContinuity: .05, evidence: '角色自述感受隔膜与自身疏离，仍知道自己在当下' } }), 3);
  assert.equal(core.state.contextBinding, 1);
  assert.ok(core.phenomena.some(p => p.kind === 'dissociative_detachment' && p.status === 'active'));
  const s = structuredClone(core.state);
  for (const arousal of [.01, .99]) assert.ok(inferPhenomena({ ...s, arousal }).some(p => p.kind === 'dissociative_detachment'));
});

test('generic phenomenon rules share an episode lifecycle and cannot mutate process state', () => {
  const state = new CognitiveCore(new KnowledgeGraph(), 0).state;
  const rule: PhenomenonRule = { kind: 'test_curiosity', label: '好奇', version: 'test-v1', evaluate(s) {
    s.belief.goodwill.alpha = 0; // Deliberately mutate the isolated input, not the core.
    return { intensity: s.arousal, support: 1, sourceEventIds: [], factors: { arousal: s.arousal }, basis: ['test'], regulationDemand: 0 };
  } };
  const first = inferPhenomena(state, [], [rule]);
  assert.equal(state.belief.goodwill.alpha, 1);
  assert.equal(first[0].status, 'active');
  const fading = inferPhenomena({ ...state, at: 1, arousal: .02 }, first, [rule]);
  assert.equal(fading[0].id, first[0].id); assert.equal(fading[0].status, 'fading');
  const resolved = inferPhenomena({ ...state, at: 2, arousal: .001 }, fading, [rule]);
  assert.equal(resolved[0].status, 'resolved'); assert.equal(resolved[0].endedAt, 2);
  const next = inferPhenomena({ ...state, at: 3 }, resolved, [rule]);
  assert.notEqual(next[0].id, first[0].id); assert.equal(next[0].startedAt, 3);
  assert.throws(() => inferPhenomena(state, [], [rule, rule]), /Duplicate/);
});

test('missing experience observations retain the last basis while the phenomenon fades', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0);
  const source = episode(core, '体验依据', assessment({ experience: { affectAccess: 0, selfContinuity: 0, evidence: '角色感到自我疏离、感受隔膜' } }), 1);
  const first = core.phenomena.find(p => p.kind === 'dissociative_detachment')!;
  assert.ok(first);
  episode(core, '没有新的体验观察', assessment({ structure: [], reliability: 0 }), 2);
  const next = core.phenomena.find(p => p.kind === 'dissociative_detachment')!;
  assert.equal(next.id, first.id); assert.equal(next.status, 'fading');
  assert.deepEqual(next.sourceEventIds, [source.id]);
  assert.ok(next.intensity > 0 && next.intensity < first.intensity);
});

test('passive decay and phenomenon episode IDs survive checkpoint and restart without new evidence', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'mind-test-')), 'graph.json');
  const core = new CognitiveCore(new KnowledgeGraph(path), 0);
  episode(core, '旧冲突', assessment(), 1);
  episode(core, '类似结构', assessment({ contextBinding: .05 }), 2);
  const ids = core.phenomena.map(p => p.id);
  core.advance(60002); core.checkpoint();
  const count = core.graph.all().length; core.checkpoint(); assert.equal(core.graph.all().length, count);
  const restored = new CognitiveCore(new KnowledgeGraph(path), 60002);
  assert.deepEqual(restored.state, core.state); assert.deepEqual(restored.phenomena, core.phenomena);
  assert.deepEqual(restored.phenomena.map(p => p.id), ids);
  assert.equal(restored.graph.all('appraisal').length, 2);
  restored.advance(60000002);
  assert.ok(restored.phenomena.every(p => p.status === 'resolved'));
});

test('legacy emotion migration preserves evidence without turning syndrome scores into new facts', () => {
  const graph = new KnowledgeGraph();
  const legacy = graph.add('emotion', 'old', { state: { at: 0, belief: { safe: .1, threat: .6, loss: .1, repair: .1, uncertain: .1 }, valence: -.5, arousal: .8, orientation: .2, dissociation: 1, flashback: 1, intrusions: ['fabricated'] } });
  const core = new CognitiveCore(graph, 1);
  assert.equal(core.state.valence, -.5); assert.equal(core.state.arousal, .8);
  assert.equal(core.state.affectAccess, 1); assert.deepEqual(core.state.memoryActivations, []);
  assert.deepEqual(core.phenomena, []);
  core.checkpoint();
  assert.deepEqual(graph.get(legacy.id), legacy);
  assert.ok(graph.all('state')[0].data.migration);
  const restored = new CognitiveCore(graph, 1); assert.deepEqual(restored.state, core.state);
});

test('checkpoint save retries do not duplicate process or phenomenon records', () => {
  const graph = new KnowledgeGraph(), core = new CognitiveCore(graph, 0);
  episode(core, '事件', assessment(), 1); core.advance(1001);
  const save = graph.save.bind(graph);
  graph.save = () => { throw new Error('disk offline'); };
  assert.throws(() => core.checkpoint(), /disk offline/);
  const nodes = graph.all(); graph.save = save; core.checkpoint();
  assert.deepEqual(graph.all(), nodes);
});

test('invalid experience observations cannot mutate state or create evidence', () => {
  const core = new CognitiveCore(new KnowledgeGraph(), 0), event = core.observe('输入', 'user', 1);
  const state = structuredClone(core.state);
  for (const experience of [{ affectAccess: 0, selfContinuity: 0, evidence: '' }, { affectAccess: NaN, selfContinuity: 0, evidence: '依据' }]) {
    assert.throws(() => core.appraise(event.id, assessment({ experience }), 1));
    assert.deepEqual(core.state, state); assert.equal(core.graph.all('appraisal').length, 0);
  }
});

test('compression rejects protected, duplicate and missing sources', () => {
  const graph = new KnowledgeGraph();
  const a=graph.add('event','a'), b=graph.add('event','b');
  assert.throws(()=>graph.compress([a.id,b.id], 'summary', [a.id]));
  assert.throws(()=>graph.compress([a.id,a.id], 'summary'));
  assert.throws(()=>graph.compress([a.id,'missing'], 'summary'));
  assert.equal(graph.all('summary').length, 0);
});
test('subjective relationships and emotion share a traceable event source', () => {
  const core=new CognitiveCore(new KnowledgeGraph(),0);
  const event=episode(core,'对方说不会回来',assessment({relations:[{subject:'user',predicate:'未承诺回来',object:'self'}]}));
  const interpretation=core.graph.all('appraisal')[0];
  const relation=core.graph.related(interpretation.id,'asserts')[0];
  assert.equal(relation.data.eventId,event.id);
  assert.equal(relation.data.epistemicStatus,'subjective_model_inference');
  assert.equal(core.graph.related(relation.id,'subject')[0].text,'user');
  const state = core.graph.related(interpretation.id,'updates')[0];
  assert.equal(state.kind, 'state');
  assert.ok(core.graph.related(state.id, 'manifests').every(p => core.graph.related(p.id, 'grounded_in').some(n => n.id === event.id)));
});
test('compressed old memory can be retrieved in Chinese and nested summaries avoid duplication', () => {
  const graph=new KnowledgeGraph();
  const a=graph.add('event','小明没有答应回来',{role:'user'},1);
  const b=graph.add('event','听到了',{role:'assistant'},2);
  const c=graph.add('event','后来和好了',{role:'user'},3);
  const summary=graph.compress([a.id,b.id],'未承诺回来');
  const nested=graph.compress([summary.id,c.id],'旧事经过');
  for(let i=0;i<10;i++)graph.add('event','其他话题',{role:'user'},10+i);
  const context=JSON.parse(graph.context('小明当时是否答应回来',3000));
  assert.ok(context.some((n:any)=>n.id===a.id));
  assert.ok(context.some((n:any)=>n.id===nested.id));
  assert.ok(!context.some((n:any)=>n.id===summary.id));
});
test('invalid model output cannot mutate beliefs', async () => {
  assert.throws(()=>validateAppraisal(assessment({ goalImpact: { ...neutralGoals, connection: 2 } })));
  const provider = new LanguageAppraisalProvider({ chat: async()=>({content:'not JSON'}) } as any);
  await assert.rejects(provider.assess('hello','[]'));
});
test('LLM structured appraisal uses configured model and validated fields', async () => {
  let captured: any[] = [];
  const controller = new AbortController();
  const provider = new LanguageAppraisalProvider({ chat: async(...args: any[]) => {
    captured = args;
    return { content: JSON.stringify({...assessment(), unexpected: 'discard me'}), finishReason: 'stop' };
  }} as any, 'assessment-model');
  const result = await provider.assess('当前输入','历史',controller.signal);
  assert.equal(captured[4],'assessment-model');
  assert.deepEqual(JSON.parse(captured[0][1].content),{input:'当前输入',memory:'历史'});
  assert.ok(!('unexpected' in result));
  controller.abort(); assert.equal(captured[5].aborted,true);
});
test('malformed LLM output gets one bounded correction with the same deadline', async () => {
  let calls = 0;
  let deadline: AbortSignal;
  const provider = new LanguageAppraisalProvider({ chat: async(...args: any[]) => {
    calls++;
    if(calls===1) { deadline=args[5]; assert.ok(deadline instanceof AbortSignal); return {content:'invalid JSON'}; }
    assert.equal(args[5],deadline);
    assert.ok(args[0].at(-1).content.includes('未通过校验'));
    return {content:JSON.stringify(assessment())};
  }} as any);
  assert.equal((await provider.assess('x','[]')).evidence,assessment().evidence);
  assert.equal(calls,2);
});
test('invalid values and truncated output are rejected after two attempts', async () => {
  for(const response of [
    {content:JSON.stringify(assessment({reliability:2}))},
    {content:JSON.stringify(assessment()),finishReason:'length'},
    {content:JSON.stringify({structure:[]})},
  ]) {
    let calls=0;
    const provider=new LanguageAppraisalProvider({chat:async()=>{calls++;return response;}} as any);
    await assert.rejects(provider.assess('x','[]'),/after correction/);
    assert.equal(calls,2);
  }
});
test('cancellation and transport failures do not trigger format retries', async () => {
  let calls=0;
  const provider=new LanguageAppraisalProvider({chat:async()=>{calls++;throw new Error('unavailable');}} as any);
  const controller=new AbortController();controller.abort();
  await assert.rejects(provider.assess('x','[]',controller.signal));
  assert.equal(calls,0);
  await assert.rejects(provider.assess('x','[]'),/unavailable/);
  assert.equal(calls,1);
});
test('legacy migration is read-only, idempotent and preserves complete records', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const dir=mkdtempSync(join(tmpdir(),'legacy-mind-'));
  const dbPath=join(dir,'stm.db');
  const db=new DatabaseSync(dbPath);
  db.exec('CREATE TABLE stm (content TEXT, timestamp REAL, emotional_signature TEXT)');
  db.prepare('INSERT INTO stm VALUES (?, ?, ?)').run('旧记忆',123,'{"sadness":0.8}');
  db.close();
  const before=readFileSync(dbPath);
  const graph=new KnowledgeGraph();
  assert.equal(await importLegacyMemory(graph,dir),1);
  assert.equal(await importLegacyMemory(graph,dir),0);
  assert.deepEqual(readFileSync(dbPath),before);
  assert.equal((graph.all('event')[0].data.legacy as any).emotional_signature,'{"sadness":0.8}');
});
