import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CharacterAgent } from '../src/agent/agent.ts';
import { ToolRegistry } from '../src/tools/registry.ts';
import { GuardPipeline } from '../src/guard/pipeline.ts';
import { assessment } from './fixtures/appraisal.ts';

function create(overrides: Record<string, unknown> = {}) {
  const provider = {
    model: 'fixture', chat: async () => ({ content: '测试摘要' }),
    chatStream: async (_messages: unknown, _t: unknown, _m: unknown, _tools: unknown, onDelta: (text:string)=>Promise<void>) => {
      await onDelta('测试回应。'); return { toolCalls: [], content: '测试回应。' };
    },
  };
  return new CharacterAgent({
    configDir: './config', dataDir: mkdtempSync(join(tmpdir(), 'agent-core-')),
    genProvider: provider as any, psychProvider: provider as any,
    toolRegistry: new ToolRegistry(), guardPipeline: new GuardPipeline([]),
    appraisalProvider: { assess: async () => assessment() }, candidateSelection: false,
    ...overrides,
  });
}
test('both public APIs infer phenomena before generation and remember every turn', async () => {
  const agent=create();
  let prompt='';
  agent.hooks.push({beforeBuild:async ctx=>{
    assert.ok(agent.cognition.state.negative>.2);
    assert.equal(agent.graph.all('event').at(-1)?.data.role,'user');
    prompt=ctx.systemPrompt;
  }});
  const first=await agent.run('我的名字是小明');
  assert.equal(first.response,'测试回应。');
  for await (const _ of agent.runStream('你记得我的名字吗')) {}
  assert.ok(prompt.includes('小明'));
  assert.equal(agent.graph.all('event').length,4);
  assert.equal(agent.graph.all('state').length,4);
  assert.ok(prompt.includes('当前现象推断'));
  assert.ok(agent.graph.all('phenomenon').length >= 2);
});
test('assessment outage retains observations and permits a recoverable response', async () => {
  const agent=create({ appraisalProvider:{assess:async()=>{throw new Error('fixture unavailable');}} });
  const events=[];
  for await(const e of agent.runStream('仍然保存这条消息')) events.push(e);
  assert.ok(events.some(e=>e.type==='error' && e.recoverable));
  assert.equal(agent.graph.all('event').length,2);
  assert.equal(agent.graph.all('appraisal').length,0);
  assert.equal(events.at(-1)?.type,'done');
});
test('blocked output never reaches text_delta or assistant memory', async () => {
  const agent=create({ guardPipeline: new GuardPipeline([{ name:'test-block', onOutput: async()=>({passed:false,action:'block',reason:'test'}) }]) });
  const events=[];
  for await(const e of agent.runStream('hello')) events.push(e);
  assert.ok(events.filter(e=>e.type==='text_delta').every(e=>e.text !== '测试回应。'));
  assert.equal(agent.graph.all('event').at(-1)?.text,'(回应被安全护栏拦截)');
});
test('interrupted turns preserve input and release the turn lock', async () => {
  const controller=new AbortController();
  const agent=create({ appraisalProvider:{assess:async()=>{controller.abort();controller.signal.throwIfAborted();}} });
  await assert.rejects(async()=>{for await(const _ of agent.runStream('先保存',{signal:controller.signal})) {}});
  assert.equal(agent.graph.all('event').length,1);
  await agent.run('下一轮仍可执行');
});
test('compression protects recent context and expands earlier events exactly', async () => {
  const agent=create();
  for(let i=0;i<6;i++) await agent.run('事件 '+i);
  const original=agent.graph.all('event').map(n=>n.text);
  await agent.compressMemory();
  const summary=agent.graph.all('summary')[0];
  assert.deepEqual(agent.graph.expand(summary.id).map(n=>n.text),original.slice(0,4));
  assert.deepEqual(agent.graph.all('event').map(n=>n.text),original);
});
test('compression requested during a turn waits for the completed boundary', async () => {
  const agent=create();
  for(let i=0;i<5;i++) await agent.run('往事 '+i);
  const turn=agent.runStream('现在');
  await turn.next();
  let completed=false;
  const compress=agent.compressMemory().then(()=>{completed=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(completed,false);
  for await(const _ of turn) {}
  await compress;
  assert.equal(completed,true);
});
test('actual tool output is remembered as tool evidence rather than assistant speech', async () => {
  const registry=new ToolRegistry();
  let toolSignal: AbortSignal | undefined;
  registry.register({ name:'fixture',description:'test',riskLevel:'low',isReadOnly:true,isDestructive:false,isConcurrencySafe:true,
    parameters:{safeParse:(x:unknown)=>({success:true,data:x})} as any,
    execute:async(_args,ctx)=>{toolSignal=ctx.signal;return {success:true,output:'工具证据',truncated:false};},
    formatResult:()=> '工具证据',formatError:e=>e,
  });
  let calls=0;
  const provider={model:'fixture',chat:async()=>({content:''}),chatStream:async(messages:any,_t:any,_m:any,_tools:any,delta:any)=>{
    calls++;
    if(calls===1)return {content:'',toolCalls:[{id:'call1',name:'fixture',arguments:{}}]};
    assert.ok(messages.some((m:any)=>m.role==='tool'&&m.content==='工具证据'));
    await delta('根据结果作答。');return {content:'根据结果作答。',toolCalls:[]};
  }};
  const agent=create({genProvider:provider,toolRegistry:registry});
  const result=await agent.run('检查一下');
  assert.equal(result.response,'根据结果作答。');
  assert.equal(result.toolResults.length,1);
  assert.ok(toolSignal instanceof AbortSignal);
  assert.equal(agent.graph.all('event').filter(n=>n.data.role==='tool')[0].text,'工具证据');
});

test('callback failure releases the turn lock and queued compression', async () => {
  const agent = create();
  let compression: Promise<string> | undefined;
  await assert.rejects(agent.run('第一轮', async () => {
    compression = agent.compressMemory();
    throw new Error('display failed');
  }), /display failed/);
  await compression;
  const next = await agent.run('下一轮');
  assert.equal(next.response, '测试回应。');
  assert.equal(agent.graph.all('event').length, 4);
});

test('configured generation model reaches response and compression requests', async () => {
  const seen: string[] = [];
  const provider = {
    chat: async (...args: any[]) => { seen.push(args[4]); return { content: '完整摘要' }; },
    chatStream: async (...args: any[]) => {
      seen.push(args[5]); await args[4]('模型回应。'); return { toolCalls: [] };
    },
  };
  const agent = create({ genProvider: provider, genModel: 'chosen-model' });
  for (let i = 0; i < 5; i++) await agent.run('事件 ' + i);
  await agent.compressMemory();
  assert.equal(seen.length, 6);
  assert.ok(seen.every(model => model === 'chosen-model'));
});

test('truncated compression preserves the view and permits a later retry', async () => {
  const agent = create();
  for (let i = 0; i < 5; i++) await agent.run('事件 ' + i);
  const before = agent.graph.all();
  const chat = agent.slowProvider.chat;
  agent.slowProvider.chat = async () => ({ content: '不完整摘要', finishReason: 'length' }) as any;
  await assert.rejects(agent.compressMemory(), /截断/);
  assert.deepEqual(agent.graph.all(), before);
  agent.slowProvider.chat = chat;
  await agent.compressMemory();
  assert.equal(agent.graph.all('summary').length, 1);
});

test('cancellation during output checking does not commit an assistant event', async () => {
  const controller = new AbortController();
  const agent = create({ guardPipeline: new GuardPipeline([{
    name: 'cancel-output', onOutput: async () => {
      controller.abort(); return { passed: true, action: 'allow' };
    },
  }]) });
  const deltas: string[] = [];
  await assert.rejects(async () => {
    for await (const event of agent.runStream('保留输入', { signal: controller.signal })) {
      if (event.type === 'text_delta') deltas.push(event.text);
    }
  });
  assert.deepEqual(deltas, []);
  assert.deepEqual(agent.graph.all('event').map(n => n.data.role), ['user']);
  await agent.run('可以继续');
});
