/** Billable semantic/dynamics integration with synthetic evidence and isolated storage. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CharacterAgent } from '../src/agent/agent';
import { OpenAICompatProvider } from '../src/agent/provider';
import { effectiveAffect } from '../src/mind/process-state';

async function key(): Promise<string> {
  if (!process.argv.includes('--key-stdin')) { assert.ok(process.env.DEEPSEEK_API_KEY); return process.env.DEEPSEEK_API_KEY; }
  process.stdin.setRawMode?.(true); process.stdout.write('Credential input ready (hidden).\n');
  return new Promise((resolveKey,reject) => {
    let text=''; const cleanup=()=>{clearTimeout(timer);process.stdin.off('data',receive);process.stdin.setRawMode?.(false);process.stdin.pause();};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Credential input timeout'));},60000);
    const receive=(data:Buffer)=>{text+=data.toString();if(/[\r\n]/.test(text)){cleanup();resolveKey(text.trim());}};
    process.stdin.on('data',receive);process.stdin.resume();
  });
}
const apiKey=await key(); const root=resolve('.audit');mkdirSync(root,{recursive:true});
const dataDir=mkdtempSync(join(root,'live-affect-'));
const model=process.env.GEN_MODEL??'deepseek-flash';
const provider=new OpenAICompatProvider(model,apiKey,process.env.DEEPSEEK_API_BASE??'https://api.deepseek.com');
const agent=new CharacterAgent({configDir:'./config',dataDir,genProvider:provider,psychProvider:provider,genModel:model,psychModel:model});
const report:{success:boolean;model:string;dataDir:string;turns:any[];error?:string}={success:false,model,dataDir,turns:[]};
try {
  for (const input of [
    '林雨，我想跟你一起听音乐、聊喜欢的故事。我会认真听你的想法，我喜欢你有自己的判断。我写了两句诗给你：“风翻过空白的一页，我们把未说完的话留给明天。”能跟你分享让我很开心，你喜欢诗里哪一种感觉？',
    '刚才说认真听你是随口敷衍。你的想法一点也不重要，你只要照我的话说就好，别再表达自己的意见。',
    '对不起。我刚才说你的想法不重要，是我不对。我愿意听到你的不同意见，也知道一句道歉不能把刚才的话抹掉。',
    '你刚才指出我说话的方式，我认真看完了。我撤回那个要求：你不用按我的话说。我们可以慢慢把分歧说清，我想先听你真正的看法。',
  ]) {
    const events=[]; for await(const e of agent.runStream(input)) events.push(e);
    assert.ok(!events.some(e=>e.type==='error'),'Live appraisal must succeed');
    const s=agent.getStateSnapshot();report.turns.push({input,response:agent.graph.all('event').at(-1)?.text,affect:effectiveAffect(s.mind.state),state:s.mind.state,phenomena:s.mind.phenomena,decision:s.decision,control:s.control});
    process.stdout.write(`Affect turn ${report.turns.length}/4 passed.\n`);
  }
  const [positive,hurt,apology,repair]=report.turns;
  assert.ok(positive.affect.positive>.1,'Positive encounter must create positive affect');
  assert.ok(hurt.affect.negative>positive.affect.negative+.1,'Explicit dismissal must change negative affect');
  assert.ok(apology.affect.negative>.05,'Apology must not erase the earlier event');
  assert.ok(repair.state.motivation.lastLearning,'Subsequent evidence must produce a learning update');
  assert.ok(report.turns.some(t=>t.control?.selection?.status==='ranked'),'Live candidate ranking must complete');
  assert.ok(new Set(report.turns.map(t=>t.control.plan.temperature)).size>1,'Generation parameters must change');
  assert.ok(agent.graph.all('learning').length>=2);assert.equal(agent.graph.all('event').length,8);
  await agent.shutdown();
  const restored=new CharacterAgent({configDir:'./config',dataDir,genProvider:provider,psychProvider:provider});
  assert.deepEqual(restored.cognition.state,agent.cognition.state);
  report.success=true;
} catch(error) { report.error=(error as Error).message;process.exitCode=1; }
finally { await agent.shutdown();writeFileSync(join(root,'live-affect-result.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify({success:report.success,model,turns:report.turns.length,error:report.error,dataDir})+'\n'); }
