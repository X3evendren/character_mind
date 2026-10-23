import type { AgentPort } from './agent-port';
import { router, registerBuiltinCommands } from '../commands';
import { parseSlashCommand } from '../commands/parser';
import { useChatStore } from './stores/chat-store';
import { useAgentStore } from './stores/agent-store';
import { useWorkspaceStore, VIEWS, type View } from './stores/workspace-store';

/** Owns asynchronous work. Renderers never start turns or mutate cognitive state. */
export class WorkspaceSession {
  private abort: AbortController | null = null;
  private active: Promise<void> | null = null;
  private compression: Promise<void> | null = null;
  private closing: Promise<void> | null = null;
  private disposed = false;
  private lastActivity = Date.now();
  private draftPresent = false;
  private proactive = false;
  private initiativeEnabled = true;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(readonly agent: AgentPort) {
    registerBuiltinCommands();
    this.timer = setInterval(() => { void this.pollInitiative(); }, 10000);
    this.timer.unref();
  }

  markActivity(draftPresent?: boolean): void {
    this.lastActivity = Date.now();
    if (draftPresent !== undefined) this.draftPresent = draftPresent;
    if (this.proactive) this.cancel();
  }

  async pollInitiative(now = Date.now()): Promise<void> {
    const ui = useWorkspaceStore.getState();
    if (this.disposed || !this.initiativeEnabled || this.active || this.compression || this.draftPresent || ui.view !== 'chat' || ui.permission || now - this.lastActivity < 90000) return;
    if (!this.agent.runInitiative || !this.agent.getInitiative?.(now)) return;
    this.proactive = true; this.abort = new AbortController();
    useChatStore.getState().beginInitiative();
    this.active = this.consume('', this.abort.signal, true);
    try { await this.active; } finally { this.active = null; this.abort = null; this.proactive = false; this.lastActivity = Date.now(); }
  }

  cancel(): void { this.abort?.abort(new Error('用户取消')); }

  async submit(raw: string): Promise<void> {
    if (this.disposed) return;
    this.markActivity(false);
    if (this.proactive) await this.active;
    let text = raw.trim();
    if (!text) return;
    const chat = useChatStore.getState();
    const ui = useWorkspaceStore.getState();
    try {
      const parsed = parseSlashCommand(text);
      if (parsed) {
        const { name, args } = parsed;
        if (name === 'stop') { this.cancel(); return; }
        if (name === 'initiative') {
          if (args && !['on','off','status'].includes(args)) throw new Error('用法：/initiative on|off|status');
          if (args === 'on' || args === 'off') this.initiativeEnabled = args === 'on';
          useWorkspaceStore.setState({ notice: `主动表达已${this.initiativeEnabled ? '开启' : '关闭'}；有动机且空闲时才会发言。` }); return;
        }
        if (name === 'clear') {
          if (this.active) { useWorkspaceStore.setState({ notice: '请先按 Esc 结束当前回合，再清屏。' }); return; }
          chat.clearMessages(); ui.setView('chat'); return;
        }
        if (name === 'view') {
          if (!VIEWS.includes(args as View)) throw new Error('用法：/view chat|mind|memory|help');
          ui.setView(args as View); return;
        }
        if (['help', 'h', '?'].includes(name)) { ui.setView('help'); return; }
        if (name === 'memory' || name === 'search') {
          useWorkspaceStore.setState({ view: 'memory', query: args, memoryIndex: 0, detailId: null }); return;
        }
        if (name === 'compress') { await this.compress(); return; }
        const result = await router.dispatch(text, { agent: this.agent, args, raw: text });
        if (result.type !== 'prompt') {
          chat.addCommandResult(text, result.output ?? '操作完成', result.type === 'unknown');
          ui.setView('chat'); useAgentStore.getState().refreshNow(); return;
        }
        text = result.promptText ?? text;
      }
      if (this.active || this.compression) {
        useWorkspaceStore.setState({ notice: '当前操作尚未结束；可以浏览视图或按 Esc 取消对话。' }); return;
      }
      this.abort = new AbortController();
      ui.setView('chat');
      chat.submitUserMessage(text);
      this.active = this.consume(text, this.abort.signal);
      try { await this.active; } finally { this.active = null; this.abort = null; }
    } catch (error) {
      chat.addCommandResult(raw, (error as Error).message, true); ui.setView('chat');
    }
  }

  private async consume(text: string, signal: AbortSignal, initiative = false): Promise<void> {
    const chat = useChatStore.getState();
    let completed = false;
    try {
      const stream = initiative ? this.agent.runInitiative!({ signal }) : this.agent.runStream(text, { signal });
      for await (const event of stream) {
        chat.dispatchEvent(event);
        if (event.type === 'done' || event.type === 'phase_end') useAgentStore.getState().refreshNow();
        if (event.type === 'done') {
          completed = true;
          chat.setTurnStateBadge(this.agent.getStateSnapshot().mind);
        }
      }
      if (!completed) throw new Error('回合提前结束');
    } catch (error) {
      chat.dispatchEvent({ type: 'error', phase: 'generate', recoverable: false,
        message: signal.aborted ? '已取消；已记录的输入与工具结果保留。' : (error as Error).message });
    } finally { useAgentStore.getState().refreshNow(); }
  }

  compress(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.compression) return this.compression;
    useWorkspaceStore.setState({ compressing: true, notice: this.active ? '压缩已排队，等待当前回合结束。' : '正在生成记忆摘要…' });
    this.compression = (async () => {
      try {
        const result = await this.agent.compressMemory();
        useChatStore.getState().addCommandResult('/compress', result);
        useWorkspaceStore.setState({ notice: result });
      } catch (error) {
        const message = (error as Error).message;
        useChatStore.getState().addCommandResult('/compress', message, true);
        useWorkspaceStore.setState({ notice: '压缩失败，原始记忆保留；详见对话记录。' });
      } finally {
        useWorkspaceStore.setState({ compressing: false });
        useAgentStore.getState().refreshNow(); this.compression = null;
      }
    })();
    return this.compression;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.disposed = true; clearInterval(this.timer); this.cancel();
    this.closing = (async () => {
      await this.active; await this.compression;
      await this.agent.shutdown();
      useAgentStore.getState().setAgent(null);
    })().catch(error => { this.closing = null; throw error; });
    return this.closing;
  }
}
