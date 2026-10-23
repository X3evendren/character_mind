import React from 'react';
import { PassThrough } from 'node:stream';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from 'ink';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterAgent } from '../agent/agent';
import { ToolRegistry } from '../tools/registry';
import { GuardPipeline } from '../guard/pipeline';
import { ContinuousLoop } from '../agent/loop';
import { App } from './app';
import { WorkspaceSession } from './session';
import { useChatStore } from './stores/chat-store';
import { useAgentStore } from './stores/agent-store';
import { useWorkspaceStore } from './stores/workspace-store';
import { emptyDraft, insertText, editDraft, InputHistory } from './editor';
import { wrapText, safeText, cellWidth, sliceRows } from './text';
import { markdownRows, memoryNodes, memoryRows, mindRows } from './presentation';
import { confirmTool } from './tool-confirmation';
import { loadThemeFile, saveThemeFile } from './theme/loader';
import { assessment, neutralGoals } from '../../tests/fixtures/appraisal';

function fixture(overrides: Record<string, unknown> = {}) {
  const provider = {
    model: 'fixture', chat: async () => ({ content: '可追溯摘要' }),
    chatStream: async (_messages: unknown, _t: unknown, _m: unknown, _tools: unknown, delta: (t: string) => Promise<void>) => {
      await delta('我记得你的话。'); return { content: '我记得你的话。', toolCalls: [] };
    },
  };
  return new CharacterAgent({ configDir: './config', dataDir: mkdtempSync(join(tmpdir(), 'tui-test-')),
    genProvider: provider as any, psychProvider: provider as any,
    guardPipeline: new GuardPipeline([]), toolRegistry: new ToolRegistry(),
    candidateSelection: false, appraisalProvider: { assess: async () => assessment({ reliability: .7,
      structure: ['conflict_unresolved', 'departure'], contextBinding: .2, controllability: .3, evidence: '事件的主观理解',
      relations: [{ subject: 'user', predicate: '离开', object: 'self' }] }) }, ...overrides });
}

const cleanups: Array<() => void | Promise<void>> = [];
describe('motivated initiative in the workspace', () => {
  it('respects drafts, view, opt out and emits an actual initiative only once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const agent = fixture({ appraisalProvider: { assess: async () => assessment({ goalImpact: { ...neutralGoals, connection: .8, curiosity: 1 }, novelty: 1, anticipated: true, reliability: 1 }) } });
    await agent.run('一起探索新作品');
    const session = new WorkspaceSession(agent); cleanups.push(() => session.close());
    const later = () => vi.setSystemTime(Date.now() + 120000);
    session.markActivity(true); later(); await session.pollInitiative();
    expect(agent.graph.all('event')).toHaveLength(2);
    session.markActivity(false); later();
    useWorkspaceStore.setState({ view: 'mind' }); await session.pollInitiative();
    expect(agent.graph.all('event')).toHaveLength(2);
    useWorkspaceStore.setState({ view: 'chat' }); await session.submit('/initiative off'); later(); await session.pollInitiative();
    expect(agent.graph.all('event')).toHaveLength(2);
    await session.submit('/initiative on'); later(); await session.pollInitiative();
    expect(agent.graph.all('event')).toHaveLength(3);
    expect(useChatStore.getState().turns.at(-1)?.kind).toBe('initiative');
    expect(agent.graph.all('appraisal')).toHaveLength(1);
    later(); await session.pollInitiative(); expect(agent.graph.all('event')).toHaveLength(3);
  });
  it('typing cancels an initiative before it is committed and preserves the next user turn', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const agent = fixture({ appraisalProvider: { assess: async () => assessment({ goalImpact: { ...neutralGoals, curiosity: 1, connection: .9 }, novelty: 1, anticipated: true, reliability: 1 }) } });
    await agent.run('共同的话题'); const session = new WorkspaceSession(agent); cleanups.push(() => session.close());
    vi.setSystemTime(Date.now() + 120000);
    const run = session.pollInitiative(); session.markActivity(true); await run;
    expect(agent.graph.all('event')).toHaveLength(2);
    expect(useChatStore.getState().turns.at(-1)?.status).toBe('interrupted');
    await session.submit('我还在输入'); expect(agent.graph.all('event')).toHaveLength(4);
  });
});
beforeEach(() => {
  useAgentStore.getState().setAgent(null);
  useChatStore.setState({ isGenerating: false }); useChatStore.getState().clearMessages();
  useWorkspaceStore.setState({ view: 'chat', query: '', memoryIndex: 0, detailId: null, compressing: false, notice: '', permission: null });
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  useAgentStore.getState().setAgent(null); vi.useRealTimers();
});

function terminal(agent: CharacterAgent, columns = 100, rows = 28, bootstrap?: () => Promise<any>) {
  const stdin = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => stdin, ref() {}, unref() {} });
  const stdout = Object.assign(new PassThrough(), { isTTY: true, columns, rows });
  const stderr = new PassThrough();
  const frames: string[] = [], errors: string[] = [];
  stdout.on('data', data => { const frame = safeText(data.toString()); if (frame.includes('CHARACTER MIND') || frame.includes('终端过小')) frames.push(frame); });
  stderr.on('data', data => errors.push(data.toString()));
  const app = render(<App bootstrap={bootstrap ?? (async () => { await agent.initialize(); return { agent, agentName: agent.config.name, loop: new ContinuousLoop() }; })} />,
    { stdin: stdin as any, stdout: stdout as any, stderr: stderr as any, debug: true, interactive: true, exitOnCtrlC: false, patchConsole: false });
  cleanups.push(async () => { app.unmount(); await agent.shutdown(); stdin.destroy(); stdout.destroy(); stderr.destroy(); });
  return { frames, errors, app, stdout, last: () => frames.at(-1) ?? '', send: (s: string) => stdin.write(s) };
}

describe('terminal text and editing', () => {
  it('wraps CJK, emoji and combining characters without losing content', () => {
    const text = '中文👨‍👩‍👧‍👦e\u0301abcdef';
    const rows = wrapText(text, 5);
    expect(rows.join('')).toBe(text); expect(rows.every(r => cellWidth(r) <= 5)).toBe(true);
    expect(safeText('\x1b[2J正文\x07')).toBe('正文');
    expect(sliceRows(['a', 'b', 'c', 'd'], 2, 1)).toEqual(['b', 'c']);
  });
  it('deletes a complete grapheme and preserves pasted multiline text', () => {
    let d = insertText(emptyDraft(), '第一行\r\n👨‍👩‍👧‍👦');
    d = editDraft(d, 'backspace'); expect(d.text).toBe('第一行\n');
    d = insertText(d, 'e\u0301'); expect(editDraft(d, 'backspace').text).toBe('第一行\n');
  });
  it('history navigates repeatedly and restores the unsent draft', () => {
    const h = new InputHistory(); h.add('一'); h.add('二');
    expect(h.move(-1, '草稿')).toBe('二'); expect(h.move(-1, '二')).toBe('一');
    expect(h.move(1, '一')).toBe('二'); expect(h.move(1, '二')).toBe('草稿');
  });
  it('Markdown keeps code newlines, links and quotation text', () => {
    const rows = markdownRows('# 标题\n\n```ts\na()\nb()\n```\n\n> 引用\n\n[来源](https://example.com)');
    expect(rows[0]).toMatchObject({ text: '标题', bold: true });
    expect(rows.map(r => r.text).join('\n')).toContain('a()\n  b()');
    expect(rows.some(r => r.text.includes('https://example.com'))).toBe(true);
  });
});

describe('workspace lifecycle and memory', () => {
  it('keeps command output and errors; misspelled commands never dispatch by prefix', async () => {
    const agent = fixture(), session = new WorkspaceSession(agent);
    await session.submit('/stats'); await session.submit('/expand unknown'); await session.submit('/compress_typo');
    const turns = useChatStore.getState().turns;
    expect(turns).toHaveLength(3); expect(turns[1].blocks[0].type).toBe('error');
    expect(turns[2].blocks[0].content).toContain('未知命令'); expect(agent.graph.all()).toHaveLength(0);
    await session.close();
  });
  it('cancels, marks the turn interrupted, releases state and accepts another turn', async () => {
    let interrupted = true;
    const agent = fixture({ appraisalProvider: { assess: async (_i: string, _m: string, signal: AbortSignal) => {
      if (interrupted) await new Promise((_, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); });
      throw new Error('assessment offline');
    } } });
    const session = new WorkspaceSession(agent); const running = session.submit('原始输入');
    await vi.waitFor(() => expect(agent.graph.all('event')).toHaveLength(1));
    session.cancel(); await running;
    expect(useChatStore.getState().turns[0].status).toBe('interrupted');
    expect(useChatStore.getState().currentTurnId).toBeNull();
    interrupted = false; await session.submit('再试一次');
    expect(useChatStore.getState().turns.at(-1)?.status).toBe('completed');
    await session.close();
  });
  it('compresses, inspects emotional links, searches and expands original sources', async () => {
    const agent = fixture(), session = new WorkspaceSession(agent);
    useAgentStore.getState().setAgent(agent);
    for (let i = 0; i < 5; i++) await session.submit('离开事件 ' + i);
    await session.compress();
    const summary = memoryNodes(agent, 'summary')[0]; expect(summary).toBeDefined();
    expect(memoryRows(agent, [], 0, summary.id).map(r => r.text).join('\n')).toContain('离开事件 0');
    const rows = mindRows(agent.getStateSnapshot(), agent).map(r => r.text).join('\n');
    expect(rows).toContain('conflict_unresolved'); expect(rows).toContain('user — 离开 → self');
    expect(rows).toContain('当下现象'); expect(rows).toContain('现象依据与来源');
    expect(rows).toContain('支持度'); expect(rows).toContain('记忆共鸣');
    expect(rows).not.toContain('闪回 ━'); expect(rows).not.toContain('解离 ━');
    const input = agent.graph.all('event')[0];
    const detail = memoryRows(agent, [], 0, input.id).map(r => r.text).join('\n');
    expect(detail).toContain('过程 / 现象 / 关系'); expect(detail).toContain('affective_experience');
    expect(agent.graph.all('event')).toHaveLength(10); await session.close();
  });
  it('tool confirmation is cancelled without starting a second input reader', async () => {
    const abort = new AbortController();
    const result = confirmTool({ name: 'danger' } as any, { path: 'test' }, { signal: abort.signal, workingDir: '.', sessionId: '' });
    expect(useWorkspaceStore.getState().permission?.tool).toBe('danger');
    abort.abort(); expect(await result).toBe(false); expect(useWorkspaceStore.getState().permission).toBeNull();
  });
  it('a failed save can be retried without leaving a live polling loop', async () => {
    const agent = fixture(), session = new WorkspaceSession(agent);
    const shutdown = vi.spyOn(agent, 'shutdown').mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(session.close()).rejects.toThrow('disk unavailable');
    await session.close(); expect(shutdown).toHaveBeenCalledTimes(2);
  });
  it('partial or invalid old themes fall back to valid colors and saving errors propagate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'theme-test-'));
    writeFileSync(join(dir, 'theme.yaml'), 'theme:\n  name: old\n  colors:\n    primary: broken\n    accent: "#112233"\n');
    const theme = loadThemeFile(dir)!;
    expect(theme.colors.accent).toBe('#112233'); expect(theme.colors.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(theme.layout.showDashboard).toBe(true); expect(() => saveThemeFile('', theme)).toThrow('未初始化');
  });
});

describe('actual Ink rendering and keyboard input', () => {
  it('boots, sends Chinese input, changes views and responds to terminal resize', async () => {
    const agent = fixture(), term = terminal(agent, 120, 32);
    await vi.waitFor(() => expect(term.last()).toContain('就绪'), { timeout: 5000 });
    term.send('你好'); await vi.waitFor(() => expect(term.last()).toContain('› 你好'));
    term.send('\r'); await vi.waitFor(() => expect(term.last()).toContain('我记得你的话。'), { timeout: 5000 });
    expect(agent.graph.all('event')).toHaveLength(2);
    term.send('\t'); await vi.waitFor(() => expect(term.last()).toContain('关系信念'));
    term.stdout.columns = 46; term.stdout.rows = 16; term.stdout.emit('resize');
    await vi.waitFor(() => expect(term.last().split('\n').every(line => cellWidth(line) <= 46)).toBe(true));
    expect(term.last().trimEnd().split('\n').length).toBeLessThanOrEqual(16);
    expect(term.errors).toEqual([]);
  });
  it('pastes multiline text without sending, scrolls a long answer and completes commands', async () => {
    const provider = { model: 'fixture', chat: async () => ({ content: '摘要' }), chatStream: async (...args: any[]) => {
      await args[4](Array.from({ length: 50 }, (_, i) => `长回应第 ${i} 行`).join('\n')); return { toolCalls: [] };
    } };
    const agent = fixture({ genProvider: provider }), term = terminal(agent, 70, 20);
    await vi.waitFor(() => expect(term.last()).toContain('就绪'));
    term.send('\x1b[200~第一行\n第二行👨‍👩‍👧‍👦\x1b[201~');
    await vi.waitFor(() => expect(term.last()).toContain('第二行')); expect(agent.graph.all('event')).toHaveLength(0);
    term.send('\r'); await vi.waitFor(() => expect(term.last()).toContain('长回应第 49 行'), { timeout: 5000 });
    term.send('\x1b[5~'); await vi.waitFor(() => expect(term.last()).not.toContain('长回应第 49 行'));
    term.send('/sta'); await vi.waitFor(() => expect(term.last()).toContain('› /sta'));
    term.send('\t'); await vi.waitFor(() => expect(term.last()).toContain('› /stats'));
    term.send('\r'); await vi.waitFor(() => expect(useChatStore.getState().turns.at(-1)?.kind).toBe('command'));
    expect(term.errors).toEqual([]);
  });
  it('shows startup failure, supports retry and exits through shutdown', async () => {
    const agent = fixture(); let calls = 0;
    const shutdown = vi.spyOn(agent, 'shutdown');
    const term = terminal(agent, 80, 24, async () => {
      if (calls++ === 0) throw new Error('测试启动失败');
      await agent.initialize(); return { agent, agentName: agent.config.name, loop: new ContinuousLoop() };
    });
    await vi.waitFor(() => expect(term.last()).toContain('测试启动失败'));
    term.send('/retry'); await vi.waitFor(() => expect(term.last()).toContain('› /retry'));
    term.send('\r'); await vi.waitFor(() => expect(term.last()).toContain('就绪'));
    term.send('\x03'); await vi.waitFor(() => expect(shutdown).toHaveBeenCalled());
    await term.app.waitUntilExit();
  });
  it('shows a tool confirmation inside Ink and denial resumes the response', async () => {
    let calls = 0;
    const execute = vi.fn();
    const registry = new ToolRegistry(); registry.confirmTool = confirmTool;
    registry.register({ name: 'needs_approval', description: 'fixture', riskLevel: 'high', isReadOnly: false, isDestructive: false, isConcurrencySafe: false,
      parameters: { safeParse: (data: unknown) => ({ success: true, data }) } as any,
      execute, formatResult: String, formatError: String });
    const provider = { model: 'fixture', chat: async () => ({ content: '' }), chatStream: async (...args: any[]) => {
      if (calls++ === 0) return { toolCalls: [{ id: 'approval1', name: 'needs_approval', arguments: { note: '展示完整参数' } }] };
      await args[4]('已按你的选择取消操作。'); return { toolCalls: [] };
    } };
    const agent = fixture({ genProvider: provider, toolRegistry: registry }), term = terminal(agent);
    await vi.waitFor(() => expect(term.last()).toContain('就绪'));
    term.send('开始'); await vi.waitFor(() => expect(term.last()).toContain('› 开始')); term.send('\r');
    await vi.waitFor(() => expect(term.last()).toContain('展示完整参数'));
    expect(term.last()).toContain('等待工具授权'); term.send('n');
    await vi.waitFor(() => expect(term.last()).toContain('已按你的选择取消操作。'));
    expect(execute).not.toHaveBeenCalled(); expect(useWorkspaceStore.getState().permission).toBeNull();
    expect(agent.graph.all('event').some(n => n.data.role === 'tool')).toBe(true);
  });
});
