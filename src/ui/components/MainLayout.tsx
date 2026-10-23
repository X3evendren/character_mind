import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput, usePaste, useStdout } from 'ink';
import type { WorkspaceSession } from '../session';
import { useThemeStore } from '../stores/theme-store';
import { useChatStore } from '../stores/chat-store';
import { useAgentStore } from '../stores/agent-store';
import { useWorkspaceStore, VIEWS, VIEW_NAMES } from '../stores/workspace-store';
import { commandItems, conversationRows, helpRows, memoryNodes, memoryRows, mindRows, PHASE_NAMES, wrapRows, type Row } from '../presentation';
import { editDraft, emptyDraft, InputHistory, insertText } from '../editor';
import { fitText, sliceRows, wrapText } from '../text';

function Lines({ rows, width, height }: { rows: Row[]; width: number; height: number }) {
  const colors = useThemeStore(s => s.theme.colors);
  return <Box flexDirection="column" width={width} height={height} overflow="hidden">
    {rows.map((r, i) => <Box key={i} height={1} flexShrink={0}><Text color={colors[r.tone ?? 'text']} bold={r.bold} wrap="truncate-end">{r.text || ' '}</Text></Box>)}
  </Box>;
}

export function MainLayout({ session, bootError, onQuit, onRetry }: {
  session: WorkspaceSession | null; bootError: string | null; onQuit: () => void; onRetry: () => void;
}) {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
  useEffect(() => {
    const resize = () => setSize({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    stdout.on('resize', resize); return () => { stdout.off('resize', resize); };
  }, [stdout]);
  const theme = useThemeStore(s => s.theme);
  const chat = useChatStore();
  const snapshot = useAgentStore(s => s.snapshot);
  const ui = useWorkspaceStore();
  const [draft, setDraft] = useState(emptyDraft);
  const history = useRef(new InputHistory());
  const [offset, setOffset] = useState(0);
  const agent = session?.agent ?? null;
  const width = Math.max(1, size.columns - 1), height = Math.max(1, size.rows - 1);
  const tiny = size.columns < 36 || size.rows < 12;
  const showSidebar = width >= 112 && height >= 23 && theme.layout.showDashboard && ui.view === 'chat';
  const sidebarWidth = showSidebar ? 34 : 0;
  const panelWidth = width - sidebarWidth;
  const textWidth = Math.max(1, panelWidth - 4);
  const editorWidth = Math.max(1, width - 3);
  const editorText = draft.text.slice(0, draft.cursor) + '▏' + draft.text.slice(draft.cursor);
  const editorWrapped = wrapText(editorText, editorWidth);
  const cursorRow = wrapText(draft.text.slice(0, draft.cursor) + '▏', editorWidth).length - 1;
  const editorStart = Math.max(0, cursorRow - 2);
  const editorLines = draft.text ? editorWrapped.slice(editorStart, editorStart + 3) : ['输入消息或 /命令'];
  const bodyHeight = Math.max(3, height - 5 - editorLines.length);
  const viewportHeight = Math.max(1, bodyHeight - 2);
  const nodes = useMemo(() => memoryNodes(agent, ui.query), [agent, ui.query, snapshot]);
  const selected = Math.min(ui.memoryIndex, Math.max(0, nodes.length - 1));
  const sourceRows: Row[] = ui.permission ? [
    { text: `等待工具授权 · ${ui.permission.tool}`, tone: 'warning', bold: true },
    { text: 'Y 执行 · N / Esc 拒绝 · 30 秒未选择则拒绝', tone: 'warning' },
    { text: '参数：' }, { text: JSON.stringify(ui.permission.params, null, 2) },
  ] : ui.view === 'chat' ? conversationRows(chat.turns, snapshot?.agentName ?? agent?.config.name ?? '角色', chat.debugMode)
    : ui.view === 'mind' ? mindRows(snapshot, agent)
    : ui.view === 'memory' ? memoryRows(agent, nodes, selected, ui.detailId) : helpRows();
  const displayRows = !ui.permission && ui.view === 'memory' && !ui.detailId
    ? sourceRows.map(r => ({ ...r, text: fitText(r.text, textWidth) })) : wrapRows(sourceRows, textWidth);
  const maxOffset = Math.max(0, displayRows.length - viewportHeight);
  const fromEnd = ui.view === 'chat' && !ui.permission;
  const visible = sliceRows(displayRows, viewportHeight, offset, fromEnd);
  useEffect(() => { setOffset(0); }, [ui.view, ui.detailId, ui.query, ui.permission]);
  useEffect(() => {
    if (ui.view !== 'memory' || ui.detailId) return;
    setOffset(o => selected + 3 < o ? selected + 3 : selected + 3 >= o + viewportHeight ? selected + 4 - viewportHeight : o);
  }, [selected, ui.view, ui.detailId, viewportHeight]);
  const candidates = draft.text.startsWith('/') && !/\s/.test(draft.text)
    ? commandItems().filter(c => c.name.startsWith(draft.text.slice(1))) : [];
  const replaceDraft = (text: string) => setDraft({ text, cursor: text.length });
  const submit = () => {
    const text = draft.text.trim();
    if (!text) {
      if (ui.view === 'memory' && nodes[selected]) useWorkspaceStore.setState({ detailId: nodes[selected].id });
      return;
    }
    if (/^\/(quit|exit|q)(\s|$)/i.test(text)) { onQuit(); return; }
    if (text === '/retry' && !session) { onRetry(); replaceDraft(''); return; }
    if (!session) {
      if (/^\/(help|h|\?)$/.test(text)) { ui.setView('help'); replaceDraft(''); }
      return;
    }
    if ((chat.isGenerating || ui.compressing) && !text.startsWith('/')) {
      useWorkspaceStore.setState({ notice: '输入草稿已保留；等待当前操作完成，或按 Esc 取消对话。' }); return;
    }
    history.current.add(text); replaceDraft(''); setOffset(0);
    void session.submit(text);
  };
  usePaste(text => { if (!ui.permission) { setDraft(d => insertText(d, text)); history.current.reset(); } });
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { onQuit(); return; }
    if (tiny) return;
    if (ui.permission && !key.pageUp && !key.pageDown) {
      if (input.toLowerCase() === 'y') ui.permission.answer(true);
      else if (input.toLowerCase() === 'n' || key.escape) ui.permission.answer(false);
      return;
    }
    if (key.escape) {
      if (ui.detailId) useWorkspaceStore.setState({ detailId: null });
      else if (chat.isGenerating) session?.cancel();
      else useWorkspaceStore.setState({ notice: '' });
      return;
    }
    if (key.ctrl && input === 'k') { void session?.compress(); return; }
    if (key.ctrl && input === 'f') { ui.setView('memory'); replaceDraft('/search '); return; }
    if (key.ctrl && input === 'g') { ui.setView('mind'); return; }
    if (key.ctrl && input === 'l') { void session?.submit('/clear'); return; }
    if (key.pageUp || (key.ctrl && key.upArrow)) {
      const amount = key.pageUp ? viewportHeight : 1;
      setOffset(o => Math.min(maxOffset, Math.max(0, o + (fromEnd ? amount : -amount)))); return;
    }
    if (key.pageDown || (key.ctrl && key.downArrow)) {
      const amount = key.pageDown ? viewportHeight : 1;
      setOffset(o => Math.min(maxOffset, Math.max(0, o + (fromEnd ? -amount : amount)))); return;
    }
    if (key.tab) {
      if (candidates.length) replaceDraft('/' + candidates[0].name + ' ');
      else ui.setView(VIEWS[(VIEWS.indexOf(ui.view) + (key.shift ? 3 : 1)) % VIEWS.length]);
      return;
    }
    if (key.return) { if (key.meta || key.shift) setDraft(d => insertText(d, '\n')); else submit(); return; }
    if (key.upArrow || key.downArrow) {
      const delta = key.upArrow ? -1 : 1;
      if (ui.view === 'memory' && !ui.detailId && !draft.text) useWorkspaceStore.setState({ memoryIndex: Math.max(0, Math.min(nodes.length - 1, selected + delta)) });
      else replaceDraft(history.current.move(delta, draft.text));
      return;
    }
    const action = key.leftArrow ? 'left' : key.rightArrow ? 'right'
      : key.backspace ? 'backspace' : key.delete ? 'delete'
      : key.home || (key.ctrl && input === 'a') ? 'home' : key.end || (key.ctrl && input === 'e') ? 'end' : null;
    if (action) { setDraft(d => editDraft(d, action)); return; }
    if (input && !key.ctrl && !key.meta) { setDraft(d => insertText(d, input)); history.current.reset(); }
  });
  const state = ui.permission ? '等待工具授权 · Y / N' : bootError ? '启动失败 · /retry 重试' : !session ? '正在加载…' : ui.compressing ? '压缩处理中' : chat.isGenerating
    ? PHASE_NAMES[chat.statusText.replace(/ done$/, '')] ?? chat.statusText : '就绪';
  const notice = bootError ?? ui.notice ?? '';
  const footer = ui.permission ? 'Y 执行 · N / Esc 拒绝 · PgUp/Dn 查看参数 · Ctrl+C 退出' : candidates.length ? candidates.map(c => `/${c.name}`).join('  ')
    : 'Enter 发送 · Tab 切换 · PgUp/Dn 滚动 · Esc 取消 · Ctrl+K 压缩 · Ctrl+C 退出';
  const header = `CHARACTER MIND  /  ${snapshot?.agentName ?? agent?.config.name ?? '心智工作台'}`;
  if (tiny) return <Box flexDirection="column" width={width} height={height} overflow="hidden">
    <Text color={theme.colors.secondary}>{fitText('终端过小，请调整到至少 36×12', width)}</Text>
    <Text>{fitText('Ctrl+C 保存并退出', width)}</Text>
  </Box>;
  return <Box flexDirection="column" width={width} height={height} overflow="hidden">
    <Text color={theme.colors.secondary} bold wrap="truncate-end">{fitText(header, width)}</Text>
    <Box height={1} flexShrink={0}>
      {VIEWS.map(view => <Text key={view} color={view === ui.view ? theme.colors.secondary : theme.colors.textDim} bold={view === ui.view}>{` ${view === ui.view ? '●' : '○'} ${VIEW_NAMES[view]}  `}</Text>)}
    </Box>
    <Box height={bodyHeight} flexShrink={0}>
      <Box borderStyle="round" borderColor={theme.colors.primary} flexDirection="column" width={panelWidth} height={bodyHeight} paddingX={1} overflow="hidden">
        <Lines rows={visible} width={textWidth} height={viewportHeight} />
      </Box>
      {showSidebar && <Box borderStyle="round" borderColor={theme.colors.textDim} flexDirection="column" width={sidebarWidth} height={bodyHeight} paddingX={1} overflow="hidden">
        <Lines rows={wrapRows(mindRows(snapshot, agent, true), sidebarWidth - 4).slice(0, viewportHeight)} width={sidebarWidth - 4} height={viewportHeight} />
      </Box>}
    </Box>
    <Text color={bootError ? theme.colors.error : theme.colors.textDim} wrap="truncate-end">{fitText(`${state} · ${Math.min(offset, maxOffset)}/${maxOffset}${notice ? ' · ' + notice : ''}`, width)}</Text>
    <Text color={theme.colors.primary}>{'─'.repeat(width)}</Text>
    {editorLines.map((line, i) => <Box key={i} height={1} flexShrink={0}><Text color={theme.colors.accent}>{i === 0 ? '› ' : '  '}</Text><Text color={draft.text ? theme.colors.text : theme.colors.textDim} wrap="truncate-end">{line}</Text></Box>)}
    <Text color={theme.colors.textDim} wrap="truncate-end">{fitText(footer, width)}</Text>
  </Box>;
}
