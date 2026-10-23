import type { ToolDef, ToolContext } from '../tools/types';
import { useWorkspaceStore } from './stores/workspace-store';

/** Shares Ink's input owner; never starts a competing readline prompt. */
export function confirmTool(tool: ToolDef, params: unknown, ctx: ToolContext): Promise<boolean> {
  if (ctx.signal?.aborted || useWorkspaceStore.getState().permission) return Promise.resolve(false);
  return new Promise(resolve => {
    const finish = (approved: boolean) => {
      clearTimeout(timer); ctx.signal?.removeEventListener('abort', abort);
      useWorkspaceStore.setState({ permission: null }); resolve(approved);
    };
    const abort = () => finish(false);
    const timer = setTimeout(abort, 30000);
    ctx.signal?.addEventListener('abort', abort, { once: true });
    useWorkspaceStore.setState({ permission: { tool: tool.name, params, answer: finish } });
  });
}
