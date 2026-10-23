/** Explicit, billable live integration check. Uses synthetic dialogue and an isolated memory directory. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PassThrough } from 'node:stream';
import React from 'react';
import { render } from 'ink';
import { createAgent } from '../src/ui/agent-factory';
import { App } from '../src/ui/app';
import { useChatStore } from '../src/ui/stores/chat-store';
import { useAgentStore } from '../src/ui/stores/agent-store';
import { useWorkspaceStore } from '../src/ui/stores/workspace-store';
import { safeText } from '../src/ui/text';

async function credential(): Promise<string> {
  if (!process.argv.includes('--key-stdin')) {
    assert.ok(process.env.DEEPSEEK_API_KEY, 'Set DEEPSEEK_API_KEY before running test:live');
    return process.env.DEEPSEEK_API_KEY;
  }
  process.stdin.setRawMode?.(true);
  process.stdout.write('Credential input ready (hidden).\n');
  return new Promise((resolveKey, reject) => {
    let text = '';
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Credential input timeout')); }, 60000);
    const cleanup = () => { clearTimeout(timeout); process.stdin.off('data', receive); process.stdin.setRawMode?.(false); process.stdin.pause(); };
    const receive = (data: Buffer) => {
      text += data.toString();
      if (/[\r\n]/.test(text)) { cleanup(); resolveKey(text.trim()); }
    };
    process.stdin.on('data', receive); process.stdin.resume();
  });
}

async function until(check: () => boolean, label: string, timeout = 90000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Timeout: ' + label);
    await new Promise(resolveWait => setTimeout(resolveWait, 40));
  }
}

const apiKey = await credential();
const auditDir = resolve('.audit'); mkdirSync(auditDir, { recursive: true });
const dataDir = mkdtempSync(join(auditDir, 'live-memory-'));
const report: Record<string, unknown> = { at: new Date().toISOString(), model: process.env.GEN_MODEL ?? 'deepseek-flash', dataDir, steps: [] };
const steps = report.steps as string[];
const stdin = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => stdin, ref() {}, unref() {} });
const stdout = Object.assign(new PassThrough(), { isTTY: true, columns: 110, rows: 36 });
const stderr = new PassThrough();
let lastFrame = '', renderError = '';
stdout.on('data', data => { const text = safeText(data.toString()); if (text.includes('CHARACTER MIND')) lastFrame = text; });
stderr.on('data', data => { renderError += safeText(data.toString()); });
let instance: ReturnType<typeof render> | undefined;
let created: Awaited<ReturnType<typeof createAgent>> | undefined;
try {
  created = await createAgent({ apiKey, dataDir, model: String(report.model), psychModel: process.env.PSYCH_MODEL ?? String(report.model) });
  instance = render(React.createElement(App, { bootstrap: async () => created! }), {
    stdin: stdin as any, stdout: stdout as any, stderr: stderr as any,
    debug: true, interactive: true, exitOnCtrlC: false, patchConsole: false,
  });
  await until(() => lastFrame.includes('就绪'), 'TUI ready'); steps.push('TUI boot');
  const messages = [
    '这是一段功能测试。请记住测试代号“银杏-482”，只用一句话回应，不调用工具。',
    '我们刚才还没有说清楚，我现在要离开一会儿。请用一句话回应，不调用工具。',
    '这是约定中的短暂离开，我会在十分钟后回来。请用一句话回应，不调用工具。',
    '我回来了，刚才的误会可以慢慢说清。请用一句话回应，不调用工具。',
    '请说出我一开始给你的测试代号，只用一句话，不调用工具。',
  ];
  for (const [index, text] of messages.entries()) {
    stdin.write(`\x1b[200~${text}\x1b[201~`);
    await until(() => lastFrame.includes('› '), 'composer'); await new Promise(r => setTimeout(r, 100));
    stdin.write('\r');
    await until(() => useChatStore.getState().turns.length === index + 1 && !useChatStore.getState().isGenerating, `live turn ${index + 1}`);
    const turn = useChatStore.getState().turns.at(-1)!;
    assert.equal(turn.status, 'completed');
    assert.ok(!turn.blocks.some(b => b.type === 'error'), turn.blocks.find(b => b.type === 'error')?.content);
    assert.ok(turn.blocks.some(b => b.type === 'final' && b.content.length > 0));
    steps.push(`live appraisal + response ${index + 1}`);
    process.stdout.write(`Live turn ${index + 1}/5 passed.\n`);
  }
  assert.ok(useChatStore.getState().turns.at(-1)!.blocks.some(b => b.content.includes('482')), 'Model must recall the synthetic code');
  steps.push('model recalls earlier event');
  const original = created.agent.graph.all('event');
  stdin.write('\x0b'); // Ctrl+K requests compression through the TUI.
  await until(() => created!.agent.graph.all('summary').length > 0 && !useWorkspaceStore.getState().compressing, 'live compression');
  const summary = created.agent.graph.all('summary')[0];
  assert.deepEqual(created.agent.graph.expand(summary.id).map(n => n.id), original.slice(0, 2).map(n => n.id));
  assert.deepEqual(created.agent.graph.all('event'), original); steps.push('TUI compression + exact source expansion');
  stdin.write('\t'); await until(() => useWorkspaceStore.getState().view === 'mind', 'mind tab');
  await until(() => lastFrame.includes('关系信念'), 'mind render');
  writeFileSync(join(auditDir, 'tui-live-mind.txt'), lastFrame);
  stdin.write('\t'); await until(() => lastFrame.includes('知识图谱'), 'memory tab');
  stdin.write('\r'); await until(() => lastFrame.includes('来源详情'), 'memory inspection');
  writeFileSync(join(auditDir, 'tui-live-memory.txt'), lastFrame); steps.push('mind + graph views');
  const before = created.agent.getStateSnapshot();
  stdin.write('\x03'); await instance.waitUntilExit(); instance = undefined;
  steps.push('Ctrl+C shutdown');
  const restored = await createAgent({ apiKey, dataDir, model: String(report.model) });
  assert.deepEqual(restored.agent.graph.all('event'), original);
  assert.deepEqual(restored.agent.graph.expand(summary.id), created.agent.graph.expand(summary.id));
  assert.deepEqual(restored.agent.getStateSnapshot().mind.state.belief, before.mind.state.belief);
  assert.deepEqual(restored.agent.getStateSnapshot().mind.phenomena, before.mind.phenomena);
  restored.loop.stop(); await restored.agent.shutdown(); steps.push('restart restores events + belief + compression provenance');
  assert.equal(renderError, '');
  report.success = true; report.memory = restored.agent.getStateSnapshot().memory;
} catch (error) {
  report.success = false; report.error = (error as Error).message;
  process.exitCode = 1;
} finally {
  instance?.unmount(); created?.loop.stop(); await created?.agent.shutdown();
  useAgentStore.getState().setAgent(null); stdin.destroy(); stdout.destroy(); stderr.destroy();
  writeFileSync(join(auditDir, 'live-smoke-result.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
