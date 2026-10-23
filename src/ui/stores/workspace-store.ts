import { create } from 'zustand';

export const VIEWS = ['chat', 'mind', 'memory', 'help'] as const;
export type View = typeof VIEWS[number];
export const VIEW_NAMES: Record<View, string> = { chat: '对话', mind: '心智', memory: '记忆', help: '帮助' };

interface WorkspaceState {
  view: View;
  query: string;
  memoryIndex: number;
  detailId: string | null;
  compressing: boolean;
  notice: string;
  permission: { tool: string; params: unknown; answer: (approved: boolean) => void } | null;
  setView: (view: View) => void;
}

export const useWorkspaceStore = create<WorkspaceState>(set => ({
  view: 'chat', query: '', memoryIndex: 0, detailId: null, compressing: false, notice: '', permission: null,
  setView: view => set({ view, detailId: null }),
}));
