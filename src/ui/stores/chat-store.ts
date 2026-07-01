/**
 * Chat Store — 聊天消息/事件流/状态/通知。
 * reduceTurnEvent 是独立纯函数，store action dispatchEvent 一行调用。
 */
import { create } from "zustand";
import type { TurnEvent } from "../../agent/events";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCall?: {
    tool: string;
    args: Record<string, unknown>;
    success: boolean;
    outputPreview: string;
    durationMs: number;
  };
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

export interface ChatState {
  messages: ChatMessage[];
  statusText: string;
  isGenerating: boolean;
  notifications: Notification[];
  pendingToolCalls: Map<string, string>;
  turnStartMs: number | null;
  nextMsgId: number;
}

const initialState: ChatState = {
  messages: [],
  statusText: "",
  isGenerating: false,
  notifications: [],
  pendingToolCalls: new Map(),
  turnStartMs: null,
  nextMsgId: 0,
};

function msgId(state: ChatState): string {
  return `msg_${Date.now()}_${state.nextMsgId}`;
}

/**
 * 事件归约纯函数 — 给定 state + event，返回新 state。
 * 可单测、可回放。不依赖 store。
 */
export function reduceTurnEvent(state: ChatState, event: TurnEvent): ChatState {
  switch (event.type) {
    case "phase_start": {
      return {
        ...state,
        isGenerating: true,
        statusText: `${event.phase}...`,
        turnStartMs: state.turnStartMs ?? Date.now(),
      };
    }
    case "phase_end": {
      return { ...state, statusText: `${event.phase} done` };
    }
    case "text_delta": {
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant") {
        const updated = [...state.messages];
        updated[updated.length - 1] = {
          ...last,
          content: last.content + event.text,
        };
        return { ...state, messages: updated };
      }
      const newMsg: ChatMessage = {
        id: msgId(state),
        role: "assistant",
        content: event.text,
        timestamp: Date.now(),
      };
      return { ...state, messages: [...state.messages, newMsg], nextMsgId: state.nextMsgId + 1 };
    }
    case "reasoning": {
      // reasoning 暂存为 system 消息（C 阶段重做为独立内心独白块）
      const newMsg: ChatMessage = {
        id: msgId(state),
        role: "system",
        content: `[内心独白] ${event.text}`,
        timestamp: Date.now(),
      };
      return { ...state, messages: [...state.messages, newMsg], nextMsgId: state.nextMsgId + 1 };
    }
    case "tool_start": {
      const id = msgId(state);
      const pendingToolCalls = new Map(state.pendingToolCalls);
      pendingToolCalls.set(event.callId, id);
      const toolMsg: ChatMessage = {
        id,
        role: "tool",
        content: "",
        timestamp: Date.now(),
        toolCall: {
          tool: event.tool,
          args: event.args,
          success: false,
          outputPreview: "...",
          durationMs: 0,
        },
      };
      return {
        ...state,
        messages: [...state.messages, toolMsg],
        pendingToolCalls,
        nextMsgId: state.nextMsgId + 1,
        statusText: `工具: ${event.tool}...`,
      };
    }
    case "tool_end": {
      const toolMsgId = state.pendingToolCalls.get(event.callId);
      if (!toolMsgId) return state;
      const messages = state.messages.map((m) => {
        if (m.id === toolMsgId && m.toolCall) {
          return {
            ...m,
            content: event.outputPreview.slice(0, 200),
            toolCall: {
              ...m.toolCall,
              success: event.success,
              outputPreview: event.outputPreview,
              durationMs: event.durationMs,
            },
          };
        }
        return m;
      });
      const pendingToolCalls = new Map(state.pendingToolCalls);
      pendingToolCalls.delete(event.callId);
      return {
        ...state,
        messages,
        pendingToolCalls,
        statusText: `工具 ${event.tool} ${event.success ? "完成" : "失败"}`,
      };
    }
    case "cold_layer_start": {
      return {
        ...state,
        notifications: [
          ...state.notifications.slice(-4),
          { id: `n_${Date.now()}`, type: "info" as const, message: `冷分析: ${event.name}` },
        ],
      };
    }
    case "cold_layer_end":
    case "cold_skipped": {
      return state;
    }
    case "error": {
      const errMsg: ChatMessage = {
        id: msgId(state),
        role: "system",
        content: `错误 [${event.phase}]: ${event.message}`,
        timestamp: Date.now(),
      };
      return {
        ...state,
        messages: [...state.messages, errMsg],
        nextMsgId: state.nextMsgId + 1,
        notifications: [
          ...state.notifications.slice(-4),
          { id: `n_${Date.now()}`, type: "error" as const, message: event.message },
        ],
        isGenerating: false,
      };
    }
    case "done": {
      const elapsed = state.turnStartMs ? ((Date.now() - state.turnStartMs) / 1000).toFixed(1) : "0";
      return {
        ...state,
        isGenerating: false,
        statusText: `第${event.turnId}轮 ${elapsed}秒 ${event.totalTokens}词`,
        pendingToolCalls: new Map(),
        turnStartMs: null,
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
  addNotification: (type: Notification["type"], message: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  ...initialState,
  dispatchEvent: (event) => set((state) => reduceTurnEvent(state, event)),
  submitUserMessage: (text) =>
    set((state) => ({
      ...state,
      messages: [
        ...state.messages,
        { id: msgId(state), role: "user" as const, content: text, timestamp: Date.now() },
      ],
      nextMsgId: state.nextMsgId + 1,
      isGenerating: true,
    })),
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
}));