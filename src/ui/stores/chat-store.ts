/**
 * Chat Store — Turn/Block 执行图结构。
 * reduceTurnEvent 是独立纯函数，store action dispatchEvent 一行调用。
 */
import { create } from "zustand";
import type { TurnEvent, TurnPhase } from "../../agent/events";

/** Turn 硬上限:超出时丢弃最旧的 turns，防长会话 OOM。 */
const MAX_TURNS = 50;

export interface Block {
  id: string;
  type: "plan" | "reasoning" | "tool_call" | "tool_result" | "final" | "error";
  content: string;
  status: "streaming" | "done";
  // tool 专用
  callId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  toolSuccess?: boolean;
  durationMs?: number;
  // reasoning 专用
  collapsed?: boolean;
  summary?: string;
}

export interface Turn {
  id: string;
  turnId: number;
  userMessage: { content: string; timestamp: number };
  blocks: Block[];
  status: "streaming" | "completed" | "interrupted";
  timestamp: number;
  elapsedMs?: number;
  totalTokens?: number;
  stateBadge?: { pad?: { pleasure: number; arousal: number; dominance: number } };
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

export interface ChatState {
  turns: Turn[];
  currentTurnId: string | null;
  isGenerating: boolean;
  statusText: string;
  notifications: Notification[];
  debugMode: boolean;
  pendingToolCalls: Map<string, string>; // callId -> blockId
  turnStartMs: number | null;
  lastTokenMs: number | null; // 最近一次 text_delta 的时间(ms)，用于 stalled 检测
  nextTurnId: number;
  nextBlockId: number;
}

const initialState: ChatState = {
  turns: [],
  currentTurnId: null,
  isGenerating: false,
  statusText: "",
  notifications: [],
  debugMode: false,
  pendingToolCalls: new Map(),
  turnStartMs: null,
  lastTokenMs: null,
  nextTurnId: 0,
  nextBlockId: 0,
};

// ── Helpers ──

function turnId(state: ChatState): string {
  return `turn_${Date.now()}_${state.nextTurnId}`;
}

function blockId(state: ChatState): string {
  return `blk_${Date.now()}_${state.nextBlockId}`;
}

function getCurrentTurn(state: ChatState): Turn | undefined {
  if (!state.currentTurnId) return undefined;
  return state.turns.find((t) => t.id === state.currentTurnId);
}

/** Update the current turn immutably; no-op if there is no current turn. */
function updateCurrentTurn(state: ChatState, updater: (turn: Turn) => Turn): ChatState {
  if (!state.currentTurnId) return state;
  return {
    ...state,
    turns: state.turns.map((t) => (t.id === state.currentTurnId ? updater(t) : t)),
  };
}

/** Append a block to the current turn; no-op if there is no current turn. */
function appendBlock(state: ChatState, block: Block): ChatState {
  return updateCurrentTurn(state, (turn) => ({ ...turn, blocks: [...turn.blocks, block] }));
}

/** Index of the last block of a given type in the current turn (-1 if none). */
function lastBlockIndexOf(turn: Turn | undefined, type: Block["type"]): number {
  if (!turn) return -1;
  for (let i = turn.blocks.length - 1; i >= 0; i--) {
    if (turn.blocks[i].type === type) return i;
  }
  return -1;
}

function nextBlockIdState(state: ChatState): { id: string; state: ChatState } {
  const id = blockId(state);
  return { id, state: { ...state, nextBlockId: state.nextBlockId + 1 } };
}

function addNotificationToState(state: ChatState, type: Notification["type"], message: string): ChatState {
  return {
    ...state,
    notifications: [
      ...state.notifications.slice(-4),
      { id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, message },
    ],
  };
}

/**
 * 事件归约纯函数 — 给定 state + event，返回新 state。
 * 可单测、可回放。不依赖 store。Turn 由 submitUserMessage 创建，
 * reducer 只处理事件流（不创建 Turn）。
 */
export function reduceTurnEvent(state: ChatState, event: TurnEvent): ChatState {
  switch (event.type) {
    case "phase_start": {
      // Turn 由 submitUserMessage 创建；此处只更新状态文案。
      return {
        ...state,
        isGenerating: true,
        statusText: `${event.phase}`,
        turnStartMs: state.turnStartMs ?? Date.now(),
      };
    }
    case "phase_end": {
      return { ...state, statusText: `${event.phase} done` };
    }
    case "text_delta": {
      const turn = getCurrentTurn(state);
      if (!turn) return state;
      const lastFinalIdx = lastBlockIndexOf(turn, "final");
      const withToken = { ...state, lastTokenMs: Date.now() };
      if (lastFinalIdx !== -1 && turn.blocks[lastFinalIdx].status === "streaming") {
        return updateCurrentTurn(withToken, (t) => {
          const blocks = t.blocks.slice();
          blocks[lastFinalIdx] = {
            ...blocks[lastFinalIdx],
            content: blocks[lastFinalIdx].content + event.text,
          };
          return { ...t, blocks };
        });
      }
      // 无 final 块（或已完成）→ 创建新的 streaming final 块
      const { id, state: nextState } = nextBlockIdState(withToken);
      const block: Block = {
        id,
        type: "final",
        content: event.text,
        status: "streaming",
      };
      return appendBlock(nextState, block);
    }
    case "reasoning": {
      const { id, state: nextState } = nextBlockIdState(state);
      const block: Block = {
        id,
        type: "reasoning",
        content: event.text,
        status: "done",
        collapsed: true,
      };
      return appendBlock(nextState, block);
    }
    case "tool_start": {
      const { id, state: nextState } = nextBlockIdState(state);
      const block: Block = {
        id,
        type: "tool_call",
        content: "",
        status: "streaming",
        callId: event.callId,
        toolName: event.tool,
        toolArgs: event.args,
      };
      const pendingToolCalls = new Map(nextState.pendingToolCalls);
      pendingToolCalls.set(event.callId, id);
      return {
        ...appendBlock(nextState, block),
        pendingToolCalls,
        statusText: `工具: ${event.tool}...`,
      };
    }
    case "tool_end": {
      const blockId = state.pendingToolCalls.get(event.callId);
      if (!blockId) return state;
      const pendingToolCalls = new Map(state.pendingToolCalls);
      pendingToolCalls.delete(event.callId);
      const nextState = {
        ...state,
        pendingToolCalls,
        statusText: `工具 ${event.tool} ${event.success ? "完成" : "失败"}`,
      };
      return updateCurrentTurn(nextState, (t) => ({
        ...t,
        blocks: t.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                status: "done",
                toolSuccess: event.success,
                toolResult: event.outputPreview,
                durationMs: event.durationMs,
              }
            : b,
        ),
      }));
    }
    case "cold_layer_start": {
      const { id, state: nextState } = nextBlockIdState(state);
      const block: Block = {
        id,
        type: "reasoning",
        content: "",
        status: "streaming",
        collapsed: true,
        summary: event.name,
      };
      return appendBlock(nextState, block);
    }
    case "cold_layer_end": {
      // 找到最后一个 summary 匹配 event.name 的 reasoning 块，追加 summary 到 content
      const turn = getCurrentTurn(state);
      if (!turn) return state;
      let targetIdx = -1;
      for (let i = turn.blocks.length - 1; i >= 0; i--) {
        const b = turn.blocks[i];
        if (b.type === "reasoning" && b.summary === event.name) {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx === -1) return state;
      return updateCurrentTurn(state, (t) => {
        const blocks = t.blocks.slice();
        blocks[targetIdx] = {
          ...blocks[targetIdx],
          content: blocks[targetIdx].content + event.summary,
          status: "done",
        };
        return { ...t, blocks };
      });
    }
    case "cold_skipped": {
      return state;
    }
    case "error": {
      const { id, state: withBlockId } = nextBlockIdState(state);
      const errorBlock: Block = {
        id,
        type: "error",
        content: `错误 [${event.phase}]: ${event.message}`,
        status: "done",
      };
      let nextState = appendBlock(withBlockId, errorBlock);
      // 标记当前 turn 为 interrupted
      nextState = updateCurrentTurn(nextState, (t) => ({ ...t, status: "interrupted" }));
      // 添加通知
      nextState = addNotificationToState(nextState, "error", event.message);
      return {
        ...nextState,
        isGenerating: false,
      };
    }
    case "done": {
      const elapsedSec = (event.elapsedMs / 1000).toFixed(1);
      const nextState = updateCurrentTurn(state, (t) => ({
        ...t,
        status: "completed",
        elapsedMs: event.elapsedMs,
        totalTokens: event.totalTokens,
      }));
      return {
        ...nextState,
        isGenerating: false,
        currentTurnId: null, // turn 已关闭
        pendingToolCalls: new Map(),
        turnStartMs: null,
        lastTokenMs: null,
        statusText: `第${event.turnId}轮 ${elapsedSec}秒 ${event.totalTokens}词`,
      };
    }
    default: {
      return state;
    }
  }
}

// ── Store ──

interface ChatStore extends ChatState {
  dispatchEvent: (event: TurnEvent) => void;
  submitUserMessage: (text: string) => void;
  setTurnStateBadge: (pad: { pleasure: number; arousal: number; dominance: number }) => void;
  addNotification: (type: Notification["type"], message: string) => void;
  clearMessages: () => void;
  toggleDebugMode: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  ...initialState,
  dispatchEvent: (event) => set((state) => reduceTurnEvent(state, event)),
  submitUserMessage: (text) =>
    set((state) => {
      const id = turnId(state);
      const turn: Turn = {
        id,
        turnId: state.nextTurnId,
        userMessage: { content: text, timestamp: Date.now() },
        blocks: [],
        status: "streaming",
        timestamp: Date.now(),
      };
      return {
        ...state,
        turns: [...state.turns, turn].slice(-MAX_TURNS),
        currentTurnId: id,
        nextTurnId: state.nextTurnId + 1,
        isGenerating: true,
        turnStartMs: Date.now(),
      };
    }),
  setTurnStateBadge: (pad) =>
    set((state) => {
      // done 事件会清空 currentTurnId，此时回退到最后一个 turn(刚完成的轮次)，
      // 以便在 turn 收尾后仍能盖上最终 PAD 状态徽章。
      const targetId = state.currentTurnId ?? state.turns[state.turns.length - 1]?.id;
      if (!targetId) return state;
      return {
        ...state,
        turns: state.turns.map((t) =>
          t.id === targetId ? { ...t, stateBadge: { pad } } : t,
        ),
      };
    }),
  addNotification: (type, message) =>
    set((state) => {
      const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const notifications = [...state.notifications.slice(-4), { id, type, message }];
      setTimeout(() => {
        set((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== id) }));
      }, 4000);
      return { ...state, notifications };
    }),
  clearMessages: () => set({ ...initialState }),
  toggleDebugMode: () => set((state) => ({ ...state, debugMode: !state.debugMode })),
}));
