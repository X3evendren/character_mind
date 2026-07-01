# 前端状态层 + 界面/交互/美术重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分两阶段重构 character-mind 前端 — B 阶段修状态层地基（zustand 三 store + AgentPort 解耦 + 事件归约 + markdown 修复 + 死代码删除），C 阶段重做界面/交互/美术（双列仪表盘 + opencode 风格消息 + 鼠标交互 + 暖色暮色主题 + 3 新组件）。

**Architecture:** zustand 三独立 store（chat/agent/theme）替代 props 钻取 + 轮询 Context；AgentPort 接口（5 方法）解耦 UI 与 agent；事件归约抽成独立纯函数 reducer；markdown 输出 React 节点而非 ANSI 字符串。C 阶段在 store 基础上重做组件，Dashboard 双列无 tab 固定分区，消息区 opencode 风格。

**Tech Stack:** TypeScript, Ink (React 终端渲染), zustand (状态管理), vitest (测试), tsx (运行)

**Spec:** `docs/superpowers/specs/2026-07-01-frontend-state-and-ui-redesign-design.md`

---

## 文件结构总览

### B 阶段新建文件
- `src/ui/agent-port.ts` — AgentPort 接口定义
- `src/ui/agent-factory.ts` — createAgent() 装配函数
- `src/ui/stores/chat-store.ts` — useChatStore + reduceTurnEvent 纯函数
- `src/ui/stores/agent-store.ts` — useAgentStore + 轮询 + refreshNow
- `src/ui/stores/theme-store.ts` — useThemeStore（替代 context+bridge）
- `src/ui/hooks/use-turn-stream.ts` — 消费 runStream → dispatchEvent
- `src/ui/stores/chat-store.test.ts` — reduceTurnEvent 测试
- `src/ui/agent-factory.test.ts` — createAgent provider 匹配测试
- `src/ui/markdown.test.tsx` — renderMarkdown 测试

### B 阶段修改文件
- `src/ui/app.tsx` — 重写为薄壳
- `src/ui/markdown.ts` → `src/ui/markdown.tsx` — 输出 React 节点
- `src/ui/components/MainLayout.tsx` — 布局左右互换 + 改用 store
- `src/ui/components/Message.tsx` — 改用 store + markdown.tsx
- `src/ui/components/ChatArea.tsx` — 改用 store
- `src/ui/components/StatusBar.tsx` — 改用 store
- `src/ui/components/InputArea.tsx` — 改用 store + registry
- `src/ui/components/DashboardHeader.tsx` — 改用 store
- `src/ui/components/dashboard/Tab1_Overview.tsx` — 改用 store
- `src/ui/components/dashboard/Tab2_Details.tsx` — 改用 store
- `src/ui/components/dashboard/Tab3_Relationships.tsx` — 改用 store
- `src/ui/components/MultilineEditor.tsx` — 删死 import
- `src/ui/history.ts` — 删死方法
- `src/commands/builtin/theme.ts` — themeBridge → useThemeStore
- `src/ui/widgets/ProgressBar.tsx` — useTheme → store
- `src/ui/widgets/Heatmap.tsx` — useTheme → store
- `src/ui/widgets/Sparkline.tsx` — useTheme → store
- `src/ui/widgets/ToolCallCard.tsx` — useTheme → store
- `package.json` — 加 zustand 依赖

### B 阶段删除文件
- `src/ui/stream-renderer.ts`
- `src/ui/span-renderer.ts`
- `src/ui/theme/bridge.ts`
- `src/ui/theme/context.tsx`
- `src/ui/agent-state.ts`

### C 阶段新建文件
- `src/ui/widgets/EmotionWheel.tsx` — 情绪轮盘组件
- `src/ui/widgets/MoodMatrix.tsx` — 心境矩阵组件
- `src/ui/widgets/RelationMap.tsx` — 关系坐标图组件
- `src/ui/components/dashboard/InnerColumn.tsx` — 左列内心状态
- `src/ui/components/dashboard/OuterColumn.tsx` — 右列人际关系
- `src/ui/components/MessageMenu.tsx` — 重写消息菜单（点击触发）

### C 阶段修改文件
- `src/ui/theme/presets.ts` — 暖色暮色主题
- `src/ui/components/Dashboard.tsx` — 双列无 tab 重写
- `src/ui/components/MainLayout.tsx` — ChatArea 左 Dashboard 右
- `src/ui/components/Message.tsx` — opencode 风格重写
- `src/ui/components/ChatArea.tsx` — 消息菜单接入
- `src/ui/components/InputArea.tsx` — 自适应高度 + registry 补全
- `src/ui/components/StatusBar.tsx` — 情绪简要中文
- `src/ui/widgets/ProgressBar.tsx` — ▓▒░ 暖色
- `src/ui/widgets/Heatmap.tsx` — ▓▒░ 暖色
- `src/ui/widgets/Sparkline.tsx` — 暖色

---

## B 阶段：状态层重构

### Task 1: 安装 zustand + Ink 兼容性 smoke test

**Files:**
- Modify: `package.json`
- Create: `src/ui/stores/smoke-test.tsx`

- [ ] **Step 1: 安装 zustand**

```bash
cd "D:/新建文件夹 (2)/character-mind-v3-ts" && npm install zustand
```

- [ ] **Step 2: 写 smoke test 组件**

创建 `src/ui/stores/smoke-test.tsx`：

```tsx
import React from "react";
import { Text } from "ink";
import { create } from "zustand";

interface SmokeState {
  count: number;
  inc: () => void;
}

const useSmoke = create<SmokeState>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));

export function SmokeTest() {
  const count = useSmoke((s) => s.count);
  const inc = useSmoke((s) => s.inc);
  React.useEffect(() => {
    const t = setInterval(inc, 100);
    return () => clearInterval(t);
  }, [inc]);
  return React.createElement(Text, null, `count: ${count}`);
}
```

- [ ] **Step 3: 临时挂载验证**

在 `src/ink-main.tsx` 临时替换 `<App/>` 为 `<SmokeTest/>`，运行 `npm run dev`，确认计数器每 100ms 递增且无报错。

```bash
npm run dev
```

Expected: 终端显示 `count: N` 持续递增，无 `useSyncExternalStore` 相关错误。

- [ ] **Step 4: 恢复 ink-main.tsx，删 smoke test**

```bash
rm src/ui/stores/smoke-test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand dependency (Ink compatibility verified)"
```

---

### Task 2: AgentPort 接口

**Files:**
- Create: `src/ui/agent-port.ts`

- [ ] **Step 1: 创建接口文件**

创建 `src/ui/agent-port.ts`：

```typescript
/**
 * AgentPort — UI 层依赖的 agent 接口（解耦缝）。
 * UI 只用这 5 个方法，不依赖 CharacterAgent 具体类。
 * 测试时注入 MockAgent implements AgentPort。
 */
import type { TurnEvent, RunOptions } from "../agent/events";

/** getStateSnapshot 的返回类型 — 从 CharacterAgent 推导 */
export type AgentSnapshot = {
  agentName: string;
  turnCount: number;
  saturation: number;
  homeostatic: {
    energy: { value: number; setPoint: number };
    arousal: { value: number; setPoint: number };
    safety: { value: number; setPoint: number };
    connection: { value: number; setPoint: number };
    mastery: { value: number; setPoint: number };
    allostaticLoad: number;
  };
  pad: { pleasure: number; arousal: number; dominance: number } | null;
  bisbas: {
    bisActivation: number; basActivation: number;
    goSignal: number; noGoSignal: number;
    threatSignals: unknown[];
  } | null;
  mood: Record<string, number>;
  drives: Record<string, number>;
  regulation: { strategy: string; suppressionCumulative: number; breakdown: boolean };
  memory: { wm: number; stm: number; ltm: number; core: number; archive: number };
  relationship: { trust: number; familiarity: number; avoidance: number; ambivalence: number };
  narrative: { agency: number; communion: number; redemption: number; contamination: number; meaning: number };
  metabolism: { lastDaydream: number; lastQuick: number; lastFull: number };
};

export interface AgentPort {
  runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent>;
  getStateSnapshot(): AgentSnapshot;
  shutdown(): Promise<void>;
  restoreFromCheckpoint(data: unknown): Promise<void>;
  readonly config: { name: string };
}
```

> 注：`AgentSnapshot` 的精确形状从 `agent.ts:1020-1079` 的 `getStateSnapshot()` 返回值提取。实现时若 agent 的实际类型与上述不完全一致，以 agent.ts 为准调整——保持 `type AgentSnapshot = ReturnType<CharacterAgent["getStateSnapshot"]>` 的推导方式（见 agent-state.ts:4 的现有做法），不手写。

- [ ] **Step 2: 用 ReturnType 推导（更安全）**

修正 `agent-port.ts` 顶部，用推导替代手写：

```typescript
import type { TurnEvent, RunOptions } from "../agent/events";
import type { CharacterAgent } from "../agent/agent";

export type AgentSnapshot = ReturnType<CharacterAgent["getStateSnapshot"]>;

export interface AgentPort {
  runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent>;
  getStateSnapshot(): AgentSnapshot;
  shutdown(): Promise<void>;
  restoreFromCheckpoint(data: unknown): Promise<void>;
  readonly config: { name: string };
}
```

- [ ] **Step 3: 验证类型检查**

```bash
npx tsc --noEmit src/ui/agent-port.ts
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/ui/agent-port.ts
git commit -m "feat(ui): add AgentPort interface for UI-agent decoupling"
```

---

### Task 3: agent 工厂 + provider-registry 接入

**Files:**
- Create: `src/ui/agent-factory.ts`
- Test: `src/ui/agent-factory.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/agent-factory.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { selectProviderSpec } from "./agent-factory";

describe("selectProviderSpec", () => {
  it("detects deepseek by API key prefix", () => {
    const spec = selectProviderSpec({ apiKey: "sk-deepseek-xxx", baseUrl: "", model: "deepseek-chat" });
    expect(spec?.name).toBe("deepseek");
  });

  it("detects anthropic by API key prefix", () => {
    const spec = selectProviderSpec({ apiKey: "sk-ant-xxx", baseUrl: "", model: "claude-3" });
    expect(spec?.name).toBe("anthropic");
  });

  it("detects by base URL keyword", () => {
    const spec = selectProviderSpec({ apiKey: "", baseUrl: "https://openrouter.ai/api/v1", model: "" });
    expect(spec?.name).toBe("openrouter");
  });

  it("detects by model name keyword", () => {
    const spec = selectProviderSpec({ apiKey: "fake", baseUrl: "", model: "gpt-4o" });
    expect(spec?.name).toBe("openai");
  });

  it("returns undefined for unknown", () => {
    const spec = selectProviderSpec({ apiKey: "", baseUrl: "", model: "" });
    expect(spec).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/ui/agent-factory.test.ts
```

Expected: FAIL — `selectProviderSpec` not defined.

- [ ] **Step 3: 实现 agent-factory.ts**

创建 `src/ui/agent-factory.ts`：

```typescript
/**
 * Agent Factory — 装配 CharacterAgent 的纯函数工厂。
 * 用 provider-registry 的声明式匹配替代 API_BASE.includes() 嗅探。
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CharacterAgent } from "../agent/agent";
import { OpenAICompatProvider } from "../agent/provider";
import { AnthropicProvider } from "../agent/provider-anthropic";
import { detectProvider, type ProviderSpec } from "../agent/provider-registry";
import { Tracer, JsonlExporter, ConsoleExporter, CompositeExporter } from "../telemetry";
import { CheckpointManager, RecoveryManager } from "../recovery";
import { ContinuousLoop } from "../agent/loop";
import type { AgentPort } from "./agent-port";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_DIR = resolve(__dirname, "../../config");

export interface CreateAgentEnv {
  apiKey?: string;
  apiBase?: string;
  model?: string;
  configDir?: string;
}

/**
 * 选择 provider spec — 纯函数，可单测。
 * 优先级：API key 前缀 > base URL 关键词 > model 名关键词。
 */
export function selectProviderSpec(env: CreateAgentEnv): ProviderSpec | undefined {
  return detectProvider(env.apiKey, env.apiBase, env.model);
}

export interface CreatedAgent {
  agent: AgentPort;
  agentName: string;
  loop: ContinuousLoop;
  checkpointManager: CheckpointManager;
}

/**
 * 装配完整 agent — 从环境变量读配置，创建 provider/tracer/ckpt/recovery/loop。
 */
export async function createAgent(env: CreateAgentEnv): Promise<CreatedAgent> {
  const configDir = env.configDir ?? DEFAULT_CONFIG_DIR;
  const apiKey = env.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  const apiBase = env.apiBase ?? process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com";
  const model = env.model ?? process.env.GEN_MODEL ?? "LongCat-2.0";

  const spec = selectProviderSpec({ apiKey, apiBase, model });
  const isAnthropic = spec?.backend === "anthropic";

  const provider = isAnthropic
    ? new AnthropicProvider(model, apiKey, apiBase)
    : new OpenAICompatProvider(model, apiKey, apiBase);

  const tracer = new Tracer(
    new CompositeExporter(new JsonlExporter(), new ConsoleExporter()),
  );
  const checkpointManager = new CheckpointManager();
  const recovery = new RecoveryManager(checkpointManager);

  const agent = new CharacterAgent({
    configDir,
    genProvider: provider,
    psychProvider: provider,
    genModel: model,
    psychModel: model,
    tracer,
    checkpointManager,
  });
  await agent.initialize();

  // Recovery check
  const decision = recovery.detect();
  if (decision.action === "resume" && decision.checkpoint) {
    await agent.restoreFromCheckpoint(recovery.resume(decision.checkpoint));
  }

  const loop = new ContinuousLoop(30_000);
  loop.start(agent);

  return { agent, agentName: agent.config.name, loop, checkpointManager };
}

export { DEFAULT_CONFIG_DIR };
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/ui/agent-factory.test.ts
```

Expected: PASS — 5 个测试全过。

- [ ] **Step 5: Commit**

```bash
git add src/ui/agent-factory.ts src/ui/agent-factory.test.ts
git commit -m "feat(ui): add agent factory with provider-registry integration"
```

---

### Task 4: chat-store + reduceTurnEvent 纯函数

**Files:**
- Create: `src/ui/stores/chat-store.ts`
- Test: `src/ui/stores/chat-store.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/stores/chat-store.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { reduceTurnEvent, type ChatState } from "./chat-store";
import type { TurnEvent } from "../../agent/events";

function freshState(): ChatState {
  return {
    messages: [],
    statusText: "",
    isGenerating: false,
    notifications: [],
    pendingToolCalls: new Map(),
    turnStartMs: null,
    nextMsgId: 0,
  };
}

describe("reduceTurnEvent", () => {
  it("phase_start sets statusText", () => {
    const s = reduceTurnEvent(freshState(), { type: "phase_start", phase: "generate", ts: 1 });
    expect(s.statusText).toBe("generate...");
    expect(s.isGenerating).toBe(true);
  });

  it("text_delta appends to last assistant message", () => {
    let s = freshState();
    s = reduceTurnEvent(s, { type: "text_delta", text: "Hello" });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe("assistant");
    expect(s.messages[0].content).toBe("Hello");
    s = reduceTurnEvent(s, { type: "text_delta", text: " world" });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].content).toBe("Hello world");
  });

  it("text_delta creates new assistant message if last is not assistant", () => {
    let s = freshState();
    s = { ...s, messages: [{ id: "m0", role: "user", content: "hi", timestamp: 0 }] };
    s = reduceTurnEvent(s, { type: "text_delta", text: "reply" });
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1].role).toBe("assistant");
    expect(s.messages[1].content).toBe("reply");
  });

  it("tool_start then tool_end pairs by callId", () => {
    let s = freshState();
    s = reduceTurnEvent(s, { type: "tool_start", callId: "c1", tool: "web_search", args: { q: "test" } });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe("tool");
    expect(s.messages[0].toolCall?.success).toBe(false);
    s = reduceTurnEvent(s, { type: "tool_end", callId: "c1", tool: "web_search", success: true, outputPreview: "result", durationMs: 100, truncated: false });
    expect(s.messages[0].toolCall?.success).toBe(true);
    expect(s.messages[0].toolCall?.durationMs).toBe(100);
    expect(s.pendingToolCalls.size).toBe(0);
  });

  it("done clears isGenerating and pendingToolCalls", () => {
    let s = freshState();
    s = { ...s, isGenerating: true, pendingToolCalls: new Map([["c1", "m0"]]), turnStartMs: 1000 };
    s = reduceTurnEvent(s, { type: "done", turnId: 1, elapsedMs: 2000, totalTokens: 50 });
    expect(s.isGenerating).toBe(false);
    expect(s.pendingToolCalls.size).toBe(0);
    expect(s.turnStartMs).toBeNull();
  });

  it("error adds notification", () => {
    let s = freshState();
    s = reduceTurnEvent(s, { type: "error", phase: "generate", message: "boom", recoverable: false });
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications[0].type).toBe("error");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/ui/stores/chat-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: 实现 chat-store.ts**

创建 `src/ui/stores/chat-store.ts`：

```typescript
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/ui/stores/chat-store.test.ts
```

Expected: PASS — 6 个测试全过。

- [ ] **Step 5: Commit**

```bash
git add src/ui/stores/chat-store.ts src/ui/stores/chat-store.test.ts
git commit -m "feat(ui): add chat store with pure reduceTurnEvent function"
```

---

### Task 5: agent-store + theme-store

**Files:**
- Create: `src/ui/stores/agent-store.ts`
- Create: `src/ui/stores/theme-store.ts`

- [ ] **Step 1: 创建 agent-store.ts**

创建 `src/ui/stores/agent-store.ts`：

```typescript
/**
 * Agent Store — 心智快照，2s 轮询兜底 + turn 事件即时刷新。
 */
import { create } from "zustand";
import type { AgentPort, AgentSnapshot } from "../agent-port";

interface AgentStoreState {
  agent: AgentPort | null;
  snapshot: AgentSnapshot | null;
  setAgent: (agent: AgentPort | null) => void;
  refreshNow: () => void;
  startPolling: (agent: AgentPort) => void;
  stopPolling: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agent: null,
  snapshot: null,
  setAgent: (agent) => {
    set({ agent });
    if (agent) get().startPolling(agent);
    else get().stopPolling();
  },
  refreshNow: () => {
    const agent = get().agent;
    if (!agent) return;
    try {
      set({ snapshot: agent.getStateSnapshot() });
    } catch {
      // 快照拉取失败不应崩溃 UI
    }
  },
  startPolling: (agent) => {
    if (pollTimer) clearInterval(pollTimer);
    // 立即拉一次
    try { set({ snapshot: agent.getStateSnapshot() }); } catch { /* noop */ }
    // 2s 兜底轮询（捕获 ContinuousLoop 30s tick 的静默状态变化）
    pollTimer = setInterval(() => get().refreshNow(), 2000);
  },
  stopPolling: () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },
}));
```

- [ ] **Step 2: 创建 theme-store.ts**

创建 `src/ui/stores/theme-store.ts`：

```typescript
/**
 * Theme Store — 主题真相源，模块级单例。
 * React 外命令直接调 useThemeStore.getState().loadPreset(...)
 * 替代 context.tsx + bridge.ts。
 */
import { create } from "zustand";
import type { ThemeConfig } from "../theme/types";
import { DEFAULT_THEME, PRESETS } from "../theme/presets";
import { loadThemeFile, saveThemeFile } from "../theme/loader";

interface ThemeStoreState {
  theme: ThemeConfig;
  configDir: string;
  init: (configDir: string) => void;
  setTheme: (t: ThemeConfig) => void;
  loadPreset: (name: string) => void;
  setColor: (key: keyof ThemeConfig["colors"], value: string) => void;
  save: (name?: string) => void;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: DEFAULT_THEME,
  configDir: "",
  init: (configDir) => {
    const loaded = loadThemeFile(configDir) ?? DEFAULT_THEME;
    set({ theme: loaded, configDir });
  },
  setTheme: (t) => set({ theme: t }),
  loadPreset: (name) => {
    const preset = PRESETS[name];
    if (preset) set({ theme: { ...preset, name } });
  },
  setColor: (key, value) =>
    set((s) => ({ theme: { ...s.theme, colors: { ...s.theme.colors, [key]: value } } })),
  save: (name) => {
    const { theme, configDir } = get();
    saveThemeFile(configDir, name ? { ...theme, name } : theme);
  },
}));
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit src/ui/stores/agent-store.ts src/ui/stores/theme-store.ts
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/ui/stores/agent-store.ts src/ui/stores/theme-store.ts
git commit -m "feat(ui): add agent-store (2s poll) and theme-store (replaces context+bridge)"
```

---

### Task 6: use-turn-stream hook

**Files:**
- Create: `src/ui/hooks/use-turn-stream.ts`

- [ ] **Step 1: 创建 hook**

创建 `src/ui/hooks/use-turn-stream.ts`：

```typescript
/**
 * useTurnStream — 消费 agent.runStream() 事件流，写入 chat-store。
 * done/phase_end(update_instant) 时触发 agent-store 即时刷新。
 */
import { useCallback } from "react";
import type { AgentPort } from "../agent-port";
import { useChatStore } from "../stores/chat-store";
import { useAgentStore } from "../stores/agent-store";
import { isCommandInput, router } from "../../commands/index";

export function useTurnStream(agent: AgentPort | null) {
  const dispatchEvent = useChatStore((s) => s.dispatchEvent);
  const submitUserMessage = useChatStore((s) => s.submitUserMessage);
  const addNotification = useChatStore((s) => s.addNotification);
  const refreshSnapshot = useAgentStore((s) => s.refreshNow);

  return useCallback(
    async (text: string) => {
      if (!agent) return;

      // 斜杠命令不走 agent
      if (isCommandInput(text)) {
        const result = await router.dispatch(text, { agent: agent as never, args: "", raw: text });
        if (result.output) {
          // 命令输出作为 system 消息
          useChatStore.setState((s) => ({
            ...s,
            messages: [
              ...s.messages,
              { id: `msg_${Date.now()}_${s.nextMsgId}`, role: "system" as const, content: result.output, timestamp: Date.now() },
            ],
            nextMsgId: s.nextMsgId + 1,
          }));
        }
        return;
      }

      submitUserMessage(text);

      try {
        const stream = agent.runStream(text);
        for await (const event of stream) {
          dispatchEvent(event);
          // turn 结束或状态更新阶段完成时，即时拉快照
          if (event.type === "done" || (event.type === "phase_end" && event.phase === "update_instant")) {
            refreshSnapshot();
          }
        }
      } catch (err: any) {
        addNotification("error", err?.message ?? "生成错误");
        useChatStore.setState((s) => ({ ...s, isGenerating: false }));
      }
    },
    [agent, dispatchEvent, submitUserMessage, addNotification, refreshSnapshot],
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit src/ui/hooks/use-turn-stream.ts
```

Expected: 无错误（可能有 commands/index 的类型小差异，以实际为准调整 `agent as never` 的 cast）。

- [ ] **Step 3: Commit**

```bash
git add src/ui/hooks/use-turn-stream.ts
git commit -m "feat(ui): add useTurnStream hook consuming runStream into chat-store"
```

---

### Task 7: markdown 修复 — 输出 React 节点

**Files:**
- Create: `src/ui/markdown.tsx`（替代 `src/ui/markdown.ts`）
- Test: `src/ui/markdown.test.tsx`
- Delete: `src/ui/markdown.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/markdown.test.tsx`：

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { renderMarkdown } from "./markdown";
import { DEFAULT_THEME } from "./theme/presets";

function isText(el: React.ReactNode): el is React.ReactElement {
  return React.isValidElement(el);
}

describe("renderMarkdown", () => {
  it("renders heading as bold Text", () => {
    const nodes = renderMarkdown("# 标题", DEFAULT_THEME);
    expect(nodes.length).toBeGreaterThan(0);
    const first = nodes[0];
    expect(React.isValidElement(first)).toBe(true);
    if (React.isValidElement(first)) {
      expect(first.props).toHaveProperty("bold", true);
    }
  });

  it("renders bold inline", () => {
    const nodes = renderMarkdown("这是 **加粗** 文本", DEFAULT_THEME);
    // 应产出多个 span，其中包含 bold prop
    const flat = React.Children.toArray(nodes);
    expect(flat.length).toBeGreaterThan(1);
    const hasBold = flat.some(
      (n) => React.isValidElement(n) && (n.props as any).bold === true,
    );
    expect(hasBold).toBe(true);
  });

  it("renders code block with backgroundColor", () => {
    const nodes = renderMarkdown("```\ncode here\n```", DEFAULT_THEME);
    const hasCodeBg = nodes.some(
      (n) => React.isValidElement(n) && (n.props as any).backgroundColor != null,
    );
    expect(hasCodeBg).toBe(true);
  });

  it("renders blockquote as dim", () => {
    const nodes = renderMarkdown("> 引用文字", DEFAULT_THEME);
    const hasDim = nodes.some(
      (n) => React.isValidElement(n) && (n.props as any).dimColor === true,
    );
    expect(hasDim).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/ui/markdown.test.tsx
```

Expected: FAIL — 旧 markdown.ts 返回 AnsiSpan 不是 React 节点。

- [ ] **Step 3: 实现 markdown.tsx**

创建 `src/ui/markdown.tsx`：

```tsx
/**
 * renderMarkdown — markdown → React 节点（Ink 原生 Text props 着色）。
 * 替代旧 markdown.ts 的 ANSI 转义字符串方案（Ink 不解析内嵌 ANSI）。
 * 着色走 theme，不硬编码终端色。
 */
import React from "react";
import { Text } from "ink";
import type { ThemeConfig } from "./theme/types";

export function renderMarkdown(md: string, theme: ThemeConfig): React.ReactNode[] {
  const c = theme.colors;
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      nodes.push(
        React.createElement(Text, {
          key: `code-${i}`,
          dimColor: true,
          backgroundColor: c.surface,
        }, ` ${line} `),
      );
      continue;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        React.createElement(Text, {
          key: `h-${i}`,
          bold: true,
          color: c.secondary,
        }, line.slice(2)),
      );
      continue;
    }
    if (line.startsWith("> ")) {
      nodes.push(
        React.createElement(Text, {
          key: `quote-${i}`,
          dimColor: true,
          color: c.textDim,
        }, `│ ${renderInline(line.slice(2), c)}`),
      );
      continue;
    }
    if (/^[\-\*] /.test(line)) {
      nodes.push(
        React.createElement(Text, { key: `li-${i}`, color: c.text },
          React.createElement(Text, { color: c.accent }, "  • "),
          renderInline(line.slice(2), c),
        ),
      );
      continue;
    }
    if (line.trim() === "") {
      nodes.push(React.createElement(Text, { key: `empty-${i}` }, ""));
      continue;
    }
    nodes.push(
      React.createElement(Text, { key: `p-${i}`, color: c.text }, renderInline(line, c)),
    );
  }
  return nodes;
}

/** 内联格式：**加粗** / *斜体* / `代码` */
function renderInline(text: string, c: ThemeConfig["colors"]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // **加粗**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // *斜体*
    const italicMatch = remaining.match(/\*(.+?)\*/);
    // `代码`
    const codeMatch = remaining.match(/`(.+?)`/);

    // 找最早出现的匹配
    const matches = [
      { match: boldMatch, type: "bold" as const },
      { match: italicMatch, type: "italic" as const },
      { match: codeMatch, type: "code" as const },
    ].filter((m) => m.match && m.match.index !== undefined);

    if (matches.length === 0) {
      nodes.push(React.createElement(Text, { key: `t-${key++}` }, remaining));
      break;
    }

    matches.sort((a, b) => (a.match!.index! - b.match!.index!));
    const first = matches[0];

    // 前面的普通文本
    if (first.match!.index! > 0) {
      nodes.push(React.createElement(Text, { key: `t-${key++}` }, remaining.slice(0, first.match!.index!)));
    }

    const content = first.match![1];
    if (first.type === "bold") {
      nodes.push(React.createElement(Text, { key: `b-${key++}`, bold: true, color: c.secondary }, content));
    } else if (first.type === "italic") {
      nodes.push(React.createElement(Text, { key: `i-${key++}`, italic: true }, content));
    } else {
      nodes.push(React.createElement(Text, { key: `c-${key++}`, dimColor: true, backgroundColor: c.surface }, content));
    }

    remaining = remaining.slice(first.match!.index! + first.match![0].length);
  }

  return nodes;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/ui/markdown.test.tsx
```

Expected: PASS — 4 个测试全过。

- [ ] **Step 5: 删旧 markdown.ts，更新 Message.tsx import**

```bash
rm src/ui/markdown.ts
```

在 `src/ui/components/Message.tsx` 中，把 `import { renderMarkdown } from "../markdown"` 改为 `import { renderMarkdown } from "../markdown"`（路径不变，扩展名 .tsx 自动解析）。调用处改为传 theme：

旧代码（Message.tsx:62-65）：
```typescript
: React.createElement(Text, null,
    ...renderMarkdown(msg.content).map((s, i) =>
      React.createElement(Text, { key: i }, s.ansi),
    ),
  ),
```

新代码：
```typescript
: React.createElement(Box, { flexDirection: "column", paddingLeft: 0 },
    ...renderMarkdown(msg.content, theme).map((node, i) =>
      React.createElement(Box, { key: i }, node),
    ),
  ),
```

同时 Message.tsx 顶部把 `import { useTheme } from "../theme/context"` 改为 `import { useThemeStore } from "../stores/theme-store"`，`const theme = useTheme()` 改为 `const theme = useThemeStore((s) => s.theme)`。

- [ ] **Step 6: 类型检查 + 测试**

```bash
npx tsc --noEmit && npx vitest run src/ui/markdown.test.tsx
```

Expected: 无类型错误，测试 PASS。

- [ ] **Step 7: Commit**

```bash
git add src/ui/markdown.tsx src/ui/markdown.test.tsx src/ui/components/Message.tsx
git rm src/ui/markdown.ts
git commit -m "fix(ui): markdown renders React nodes with Ink native props (was broken ANSI)"
```

---

### Task 8: 重写 app.tsx 为薄壳 + 迁移所有 useTheme → store

**Files:**
- Modify: `src/ui/app.tsx`（重写）
- Modify: 所有 `useTheme` 引用（约 20 处）→ `useThemeStore`
- Modify: `src/commands/builtin/theme.ts` — themeBridge → useThemeStore

- [ ] **Step 1: 全局搜索 useTheme 引用**

```bash
cd "D:/新建文件夹 (2)/character-mind-v3-ts" && grep -rn "useTheme\b" src/ui/ --include="*.tsx" --include="*.ts"
```

记录所有文件，逐个替换。

- [ ] **Step 2: 机械替换所有 useTheme → useThemeStore**

对每个文件（Message.tsx 已在 Task 7 改过）：
- `import { useTheme } from "../theme/context"` → `import { useThemeStore } from "../stores/theme-store"`
- `const theme = useTheme()` → `const theme = useThemeStore((s) => s.theme)`

涉及文件：
- `src/ui/components/MainLayout.tsx`
- `src/ui/components/ChatArea.tsx`
- `src/ui/components/StatusBar.tsx`
- `src/ui/components/Dashboard.tsx`
- `src/ui/components/DashboardHeader.tsx`
- `src/ui/components/InputArea.tsx`
- `src/ui/components/Autocomplete.tsx`
- `src/ui/components/MultilineEditor.tsx`
- `src/ui/components/NotificationToast.tsx`
- `src/ui/components/MessageMenu.tsx`
- `src/ui/components/dashboard/Tab1_Overview.tsx`
- `src/ui/components/dashboard/Tab2_Details.tsx`
- `src/ui/components/dashboard/Tab3_Relationships.tsx`
- `src/ui/widgets/ProgressBar.tsx`
- `src/ui/widgets/Heatmap.tsx`
- `src/ui/widgets/Sparkline.tsx`
- `src/ui/widgets/ToolCallCard.tsx`

- [ ] **Step 3: 改 theme.ts 命令 — themeBridge → useThemeStore**

在 `src/commands/builtin/theme.ts` 中：
- `import { themeBridge } from "../../ui/theme/bridge"` → `import { useThemeStore } from "../../ui/stores/theme-store"`
- 所有 `themeBridge.theme` → `useThemeStore.getState().theme`
- `themeBridge.loadPreset(x)` → `useThemeStore.getState().loadPreset(x)`
- `themeBridge.setColor(k, v)` → `useThemeStore.getState().setColor(k, v)`
- `themeBridge.save(x)` → `useThemeStore.getState().save(x)`

- [ ] **Step 4: 重写 app.tsx 为薄壳**

重写 `src/ui/app.tsx`：

```typescript
/** Ink App — 薄壳：调工厂 + 挂 useTurnStream + render。 */
import React, { useState, useEffect, useRef } from "react";
import { useApp } from "ink";
import type { AgentPort } from "./agent-port";
import { createAgent, DEFAULT_CONFIG_DIR } from "./agent-factory";
import { registerBuiltinCommands } from "./commands/index";
import { useChatStore } from "./stores/chat-store";
import { useAgentStore } from "./stores/agent-store";
import { useThemeStore } from "./stores/theme-store";
import { useTurnStream } from "./hooks/use-turn-stream";
import { MainLayout } from "./components/MainLayout";

function AppInner() {
  const { exit } = useApp();
  const [agent, setAgent] = useState<AgentPort | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const initRef = useRef(false);

  // 初始化主题 store
  const initTheme = useThemeStore((s) => s.init);
  const setAgentInStore = useAgentStore((s) => s.setAgent);

  useEffect(() => {
    initTheme(DEFAULT_CONFIG_DIR);
  }, [initTheme]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        registerBuiltinCommands();
        const { agent: a } = await createAgent({});
        setAgent(a);
        setAgentInStore(a);
      } catch (e: any) {
        setBootError(e.message);
        useChatStore.getState().addNotification("error", `初始化失败: ${e.message}`);
      }
    })();
  }, [setAgentInStore]);

  const handleSubmit = useTurnStream(agent);

  // /quit 特殊处理
  const wrappedSubmit = async (text: string) => {
    if (text === "/quit" && agent) {
      await agent.shutdown();
      useAgentStore.getState().stopPolling();
      exit();
      return;
    }
    if (text === "/clear") {
      useChatStore.getState().clearMessages();
      return;
    }
    handleSubmit(text);
  };

  // 从 store 订阅渲染所需状态
  const messages = useChatStore((s) => s.messages);
  const notifications = useChatStore((s) => s.notifications);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const statusText = useChatStore((s) => s.statusText);
  const agentName = useAgentStore((s) => s.snapshot?.agentName ?? "林雨");

  if (bootError) {
    return React.createElement(
      "text" as any,
      { color: "red" },
      `初始化失败: ${bootError}`,
    );
  }

  return React.createElement(MainLayout, {
    messages,
    notifications,
    onSubmit: wrappedSubmit,
    disabled: isGenerating,
    agentName,
    statusText,
  });
}

export function App() {
  return React.createElement(AppInner, null);
}
```

- [ ] **Step 5: 更新 MainLayout.tsx — 用 store 替代 props 钻取**

`MainLayout.tsx` 不再需要从 props 接收 messages/notifications/statusText（它们从 store 读）。但为最小改动，B 阶段保留 props 传递（C 阶段重做布局时再清理）。仅改 useTheme → useThemeStore（Step 2 已做）。

- [ ] **Step 6: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误。若有，修复类型不匹配。

- [ ] **Step 7: 手动验证**

```bash
npm run dev
```

Expected: TUI 正常启动，能发消息收回复，行为与重构前一致。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): rewrite app.tsx as thin shell, migrate all useTheme to store"
```

---

### Task 9: 删除死代码

**Files:**
- Delete: `src/ui/stream-renderer.ts`
- Delete: `src/ui/span-renderer.ts`
- Delete: `src/ui/theme/bridge.ts`
- Delete: `src/ui/theme/context.tsx`
- Delete: `src/ui/agent-state.ts`
- Modify: `src/ui/history.ts` — 删 up/down/search/resetCursor/atNewest
- Modify: `src/ui/components/MultilineEditor.tsx` — 删死 import

- [ ] **Step 1: 删除整文件**

```bash
cd "D:/新建文件夹 (2)/character-mind-v3-ts"
rm src/ui/stream-renderer.ts
rm src/ui/span-renderer.ts
rm src/ui/theme/bridge.ts
rm src/ui/theme/context.tsx
rm src/ui/agent-state.ts
```

- [ ] **Step 2: 清理 history.ts 死方法**

在 `src/ui/history.ts` 中删除 `up()` / `down()` / `search()` / `resetCursor()` / `atNewest` getter，保留构造函数和 `add()`。

- [ ] **Step 3: 清理 MultilineEditor.tsx 死 import**

删除 `import { displayWidth, charDisplayWidth } from "../../utils"` 行（若存在且未使用）。

- [ ] **Step 4: 确认无残留引用**

```bash
grep -rn "stream-renderer\|span-renderer\|theme/bridge\|theme/context\|agent-state\|useAgent[^S]\|themeBridge\|syncThemeBridge\|SpanState" src/ --include="*.ts" --include="*.tsx"
```

Expected: 无匹配（或仅注释）。若有残留 import，清除。

- [ ] **Step 5: 类型检查 + 测试**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 无类型错误，所有测试通过。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(ui): remove dead code — stream-renderer, span-renderer, theme bridge/context, agent-state, history nav methods"
```

---

## C 阶段：界面/交互/美术

### Task 10: 暖色暮色主题

**Files:**
- Modify: `src/ui/theme/presets.ts`

- [ ] **Step 1: 重写 DEFAULT_THEME 为暖色暮色**

在 `src/ui/theme/presets.ts` 中替换 `DEFAULT_THEME`：

```typescript
export const DEFAULT_THEME: ThemeConfig = {
  name: "暮色",
  colors: {
    primary: "#706CAA",      // 紫蓝 — 边框/标题/角色名/助手前缀
    secondary: "#F7DA94",    // 暖米黄 — 高亮/活跃值/强调
    accent: "#CC7EB1",       // 玫粉 — 用户消息边框/情绪标记
    background: "#2a1f1d",   // 深褐 — 背景
    surface: "#332624",      // 深褐亮 — 面板/色块背景/代码块
    text: "#d4c4c0",         // 暖白 — 主文本
    textDim: "#6b5755",      // 暗灰褐 — 次要文本/时间戳
    success: "#8a9a5b",      // 苔绿 — 成功/✓
    warning: "#e6c229",      // 金 — 警告/⚠/加载动画
    error: "#c14646",        // 砖红 — 错误/✗
  },
  layout: { leftPanelWidth: 42, showDashboard: true, dashboardDefaultTab: 0 },
  typography: { roleNameBold: true, timestampFormat: "HH:mm" },
  animation: { streaming: true, progressBars: true, sparkline: true },
};
```

`leftPanelWidth` 从 32 改为 42（双列分区需要更宽）。保留 DARK/WARM/FOREST 预设不变。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit src/ui/theme/presets.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/theme/presets.ts
git commit -m "feat(ui): warm-dusk theme as default (#706CAA/#F7DA94/#CC7EB1)"
```

---

### Task 11: 进度条/热力图/火花线暖色 ▓▒░

**Files:**
- Modify: `src/ui/widgets/ProgressBar.tsx`
- Modify: `src/ui/widgets/Heatmap.tsx`
- Modify: `src/ui/widgets/Sparkline.tsx`

- [ ] **Step 1: ProgressBar 改 ▓▒░**

在 `src/ui/widgets/ProgressBar.tsx` 中替换进度条字符：

旧：`const bar = "█".repeat(filled) + "░".repeat(width - filled);`

新（三级质感）：
```typescript
const full = "▓".repeat(Math.floor(filled * 0.7));
const half = filled - full.length > 0 ? "▒" : "";
const empty = "░".repeat(width - filled);
const bar = full + half + empty;
```

- [ ] **Step 2: Heatmap 同样改 ▓▒░**

在 `src/ui/widgets/Heatmap.tsx` 中同样替换：
旧：`const bar = "█".repeat(filled) + "░".repeat(width - filled);`
新：与 ProgressBar 相同的三级质感逻辑。

- [ ] **Step 3: Sparkline 暖色**

`src/ui/widgets/Sparkline.tsx` 已用 `theme.colors.primary`，无需改字符（火花线字符 ▁▂▃▄▅▆▇█ 是高度映射，保留）。确认颜色用 primary（暮色紫蓝）。

- [ ] **Step 4: 类型检查 + 手动验证**

```bash
npx tsc --noEmit && npm run dev
```

Expected: 进度条显示 ▓▒░ 三级质感，暖色配色。

- [ ] **Step 5: Commit**

```bash
git add src/ui/widgets/ProgressBar.tsx src/ui/widgets/Heatmap.tsx
git commit -m "feat(ui): progress bars use ▓▒░ three-tier texture with warm-dusk colors"
```

---

### Task 12: 情绪轮盘组件

**Files:**
- Create: `src/ui/widgets/EmotionWheel.tsx`

- [ ] **Step 1: 创建组件**

创建 `src/ui/widgets/EmotionWheel.tsx`：

```tsx
/**
 * 情绪轮盘 — PAD 三维 2D 散点图。
 * 横轴=愉快(P) [-1,1]，纵轴=唤醒(A) [-1,1]，点大小=掌控(D) [-1,1]。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const GRID_W = 11; // 字符宽度
const GRID_H = 7;  // 行高

export function EmotionWheel({ pad }: {
  pad: { pleasure: number; arousal: number; dominance: number } | null;
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;

  if (!pad) {
    return React.createElement(Text, { color: c.textDim }, "  情绪数据未就绪");
  }

  // [-1,1] → [0, GRID_W-1] / [0, GRID_H-1]
  const x = Math.round(((pad.pleasure + 1) / 2) * (GRID_W - 1));
  const y = Math.round(((1 - (pad.arousal + 1) / 2)) * (GRID_H - 1));
  // D 映射到点字符大小
  const dChar = pad.dominance > 0.3 ? "◉" : pad.dominance > -0.3 ? "●" : "○";

  const rows: React.ReactNode[] = [];
  for (let row = 0; row < GRID_H; row++) {
    const cells: string[] = [];
    for (let col = 0; col < GRID_W; col++) {
      if (row === y && col === x) {
        cells.push(dChar);
      } else if (row === Math.floor(GRID_H / 2) && col === Math.floor(GRID_W / 2)) {
        cells.push("┼");
      } else if (row === Math.floor(GRID_H / 2)) {
        cells.push("─");
      } else if (col === Math.floor(GRID_W / 2)) {
        cells.push("│");
      } else {
        cells.push(" ");
      }
    }
    const line = cells.join("");
    const isPoint = row === y;
    rows.push(
      React.createElement(Text, {
        key: row,
        color: isPoint ? c.secondary : c.textDim,
      }, `  ${line}`),
    );
  }

  return React.createElement(Box, { flexDirection: "column" },
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  愉快→"),
    ...rows,
    React.createElement(Text, { color: c.textDim, dimColor: true },
      `  P${pad.pleasure.toFixed(2)} A${pad.arousal.toFixed(2)} D${pad.dominance.toFixed(2)}`),
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit src/ui/widgets/EmotionWheel.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/widgets/EmotionWheel.tsx
git commit -m "feat(ui): add EmotionWheel widget (PAD 2D scatter)"
```

---

### Task 13: 心境矩阵组件

**Files:**
- Create: `src/ui/widgets/MoodMatrix.tsx`

- [ ] **Step 1: 创建组件**

创建 `src/ui/widgets/MoodMatrix.tsx`：

```tsx
/**
 * 心境矩阵 — 12 维心境 4×3 网格小型条形图。
 * 中文名：平和/易怒/焦虑/活力/温暖/自信/感恩/骄傲/好奇/希望/敬畏/顽皮
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const MOOD_NAMES: Record<string, string> = {
  euthymic: "平和", irritable: "易怒", anxious: "焦虑", vital: "活力",
  warm: "温暖", confident: "自信", grateful: "感恩", proud: "骄傲",
  curious: "好奇", hopeful: "希望", awed: "敬畏", playful: "顽皮",
  paniGrief: "悲恸", fatigue: "疲惫",
};

const MOOD_ORDER = ["euthymic", "irritable", "anxious", "vital", "warm", "confident",
  "grateful", "proud", "curious", "hopeful", "awed", "playful"];

export function MoodMatrix({ mood, topN = 6 }: {
  mood: Record<string, number>;
  topN?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;

  const entries = MOOD_ORDER
    .filter((k) => mood[k] !== undefined)
    .map((k) => ({ key: k, name: MOOD_NAMES[k] ?? k, value: mood[k] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);

  return React.createElement(Box, { flexDirection: "column" },
    ...entries.map((e) => {
      const ratio = Math.max(0, Math.min(1, e.value));
      const filled = Math.round(ratio * 8);
      const full = "▓".repeat(Math.floor(filled * 0.7));
      const half = filled - full.length > 0 ? "▒" : "";
      const empty = "░".repeat(8 - filled);
      const bar = full + half + empty;
      const color = e.value > 0.6 ? c.secondary : e.value > 0.3 ? c.primary : c.textDim;
      return React.createElement(Text, { key: e.key },
        React.createElement(Text, { color: c.textDim }, `  ${e.name.padEnd(4)} `),
        React.createElement(Text, { color }, bar),
        React.createElement(Text, { color: c.textDim }, ` ${e.value.toFixed(2)}`),
      );
    }),
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit src/ui/widgets/MoodMatrix.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/widgets/MoodMatrix.tsx
git commit -m "feat(ui): add MoodMatrix widget (12-dim mood grid, Chinese labels)"
```

---

### Task 14: 关系坐标图组件

**Files:**
- Create: `src/ui/widgets/RelationMap.tsx`

- [ ] **Step 1: 创建组件**

创建 `src/ui/widgets/RelationMap.tsx`：

```tsx
/**
 * 关系坐标图 — 4 维关系 2×2 坐标。
 * 横轴=信任↔回避，纵轴=熟悉↔矛盾。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const GRID_W = 11;
const GRID_H = 7;

export function RelationMap({ relationship }: {
  relationship: { trust: number; familiarity: number; avoidance: number; ambivalence: number };
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;
  const { trust, familiarity, avoidance, ambivalence } = relationship;

  // 横轴：信任(+) ↔ 回避(-)，映射到 [0, GRID_W-1]
  const xPos = Math.round(((trust - avoidance + 1) / 2) * (GRID_W - 1));
  // 纵轴：熟悉(+) ↔ 矛盾(-)，映射到 [0, GRID_H-1]
  const yPos = Math.round(((1 - (familiarity - ambivalence + 1) / 2)) * (GRID_H - 1));

  const rows: React.ReactNode[] = [];
  for (let row = 0; row < GRID_H; row++) {
    const cells: string[] = [];
    for (let col = 0; col < GRID_W; col++) {
      if (row === yPos && col === xPos) {
        cells.push("◉");
      } else if (row === Math.floor(GRID_H / 2) && col === Math.floor(GRID_W / 2)) {
        cells.push("┼");
      } else if (row === Math.floor(GRID_H / 2)) {
        cells.push("─");
      } else if (col === Math.floor(GRID_W / 2)) {
        cells.push("│");
      } else {
        cells.push(" ");
      }
    }
    const isPoint = row === yPos;
    rows.push(
      React.createElement(Text, {
        key: row,
        color: isPoint ? c.accent : c.textDim,
      }, `  ${cells.join("")}`),
    );
  }

  return React.createElement(Box, { flexDirection: "column" },
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  熟悉↑   矛盾↓  信任→  回避←"),
    ...rows,
    React.createElement(Text, { color: c.textDim, dimColor: true },
      `  信任${trust.toFixed(2)} 熟悉${familiarity.toFixed(2)} 回避${avoidance.toFixed(2)} 矛盾${ambivalence.toFixed(2)}`),
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit src/ui/widgets/RelationMap.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/widgets/RelationMap.tsx
git commit -m "feat(ui): add RelationMap widget (4-dim relationship 2x2 coordinate)"
```

---

### Task 15: Dashboard 双列分区重写

**Files:**
- Create: `src/ui/components/dashboard/InnerColumn.tsx`
- Create: `src/ui/components/dashboard/OuterColumn.tsx`
- Modify: `src/ui/components/Dashboard.tsx`
- Delete: `src/ui/components/dashboard/Tab1_Overview.tsx`、`Tab2_Details.tsx`、`Tab3_Relationships.tsx`、`src/ui/components/DashboardHeader.tsx`

- [ ] **Step 1: 创建 InnerColumn.tsx（左列内心状态）**

创建 `src/ui/components/dashboard/InnerColumn.tsx`：

```tsx
/**
 * 内心列 — 角色内部状态（情绪/稳态/心境/无聊/饱和/调节）。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { useAgentStore } from "../../stores/agent-store";
import { EmotionWheel } from "../../widgets/EmotionWheel";
import { MoodMatrix } from "../../widgets/MoodMatrix";
import { ProgressBar } from "../../widgets/ProgressBar";

function SectionTitle({ title }: { title: string }) {
  const c = useThemeStore((s) => s.theme).colors;
  return React.createElement(Text, { color: c.primary, bold: true }, `▎${title}`);
}

export function InnerColumn() {
  const snap = useAgentStore((s) => s.snapshot);
  const c = useThemeStore((s) => s.theme).colors;

  if (!snap) {
    return React.createElement(Text, { color: c.textDim }, "  加载中...");
  }

  return React.createElement(Box, { flexDirection: "column", width: 20 },
    // ▎情绪
    React.createElement(SectionTitle, { title: "情绪" }),
    React.createElement(EmotionWheel, { pad: snap.pad }),
    React.createElement(Text, null),
    // ▎稳态
    React.createElement(SectionTitle, { title: "稳态" }),
    React.createElement(ProgressBar, { label: "能量", value: snap.homeostatic.energy.value, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "唤醒", value: snap.homeostatic.arousal.value, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "安全", value: snap.homeostatic.safety.value, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "连接", value: snap.homeostatic.connection.value, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "掌控", value: snap.homeostatic.mastery.value, max: 1, width: 8 }),
    React.createElement(Text, null),
    // ▎心境
    React.createElement(SectionTitle, { title: "心境" }),
    React.createElement(MoodMatrix, { mood: snap.mood, topN: 6 }),
    React.createElement(Text, null),
    // ▎无聊（如果有 boredom 数据，从 snapshot 扩展字段读）
    React.createElement(SectionTitle, { title: "无聊" }),
    React.createElement(Text, { color: c.textDim }, "  参与度数据待接入"),
    React.createElement(Text, null),
    // ▎饱和度 + 异稳态
    React.createElement(SectionTitle, { title: "饱和度" }),
    React.createElement(ProgressBar, { label: "饱和", value: snap.saturation, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "异稳态", value: snap.homeostatic.allostaticLoad, max: 1, width: 8 }),
    React.createElement(Text, null),
    // ▎调节
    React.createElement(SectionTitle, { title: "调节" }),
    React.createElement(Text, { color: c.text },
      `  策略: ${snap.regulation.strategy === "breakdown" ? "崩溃" : "重评"}${snap.regulation.breakdown ? " ⚠" : ""}`),
  );
}
```

- [ ] **Step 2: 创建 OuterColumn.tsx（右列人际关系）**

创建 `src/ui/components/dashboard/OuterColumn.tsx`：

```tsx
/**
 * 关系列 — 角色↔用户外部关系（关系/叙事/心智理论/记忆）。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { useAgentStore } from "../../stores/agent-store";
import { RelationMap } from "../../widgets/RelationMap";
import { ProgressBar } from "../../widgets/ProgressBar";

function SectionTitle({ title }: { title: string }) {
  const c = useThemeStore((s) => s.theme).colors;
  return React.createElement(Text, { color: c.primary, bold: true }, `▎${title}`);
}

export function OuterColumn() {
  const snap = useAgentStore((s) => s.snapshot);
  const c = useThemeStore((s) => s.theme).colors;

  if (!snap) {
    return React.createElement(Text, { color: c.textDim }, "  加载中...");
  }

  return React.createElement(Box, { flexDirection: "column", width: 20 },
    // ▎关系
    React.createElement(SectionTitle, { title: "关系" }),
    React.createElement(RelationMap, { relationship: snap.relationship }),
    React.createElement(Text, null),
    // ▎叙事
    React.createElement(SectionTitle, { title: "叙事" }),
    React.createElement(ProgressBar, { label: "代理感", value: snap.narrative.agency, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "共融感", value: snap.narrative.communion, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "救赎", value: snap.narrative.redemption, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "污染", value: snap.narrative.contamination, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "意义感", value: snap.narrative.meaning, max: 1, width: 8 }),
    React.createElement(Text, null),
    // ▎心智理论（ToM 数据待 agent 扩展，B 阶段先占位）
    React.createElement(SectionTitle, { title: "心智理论" }),
    React.createElement(Text, { color: c.textDim }, "  用户信念/欲望/意图待接入"),
    React.createElement(Text, null),
    // ▎记忆
    React.createElement(SectionTitle, { title: "记忆" }),
    React.createElement(Text, { color: c.text },
      `  工作${snap.memory.wm} 短期${snap.memory.stm}`),
    React.createElement(Text, { color: c.text },
      `  长期${snap.memory.ltm} 核心${snap.memory.core}`),
    React.createElement(Text, { color: c.textDim },
      `  归档${snap.memory.archive}`),
  );
}
```

- [ ] **Step 3: 重写 Dashboard.tsx（双列无 tab）**

重写 `src/ui/components/Dashboard.tsx`：

```tsx
/**
 * 仪表盘 — 双列分区，无 tab，固定分区，全中文。
 * 左列内心状态 | 右列人际关系，同步翻页。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { InnerColumn } from "./dashboard/InnerColumn";
import { OuterColumn } from "./dashboard/OuterColumn";

export function Dashboard() {
  const c = useThemeStore((s) => s.theme).colors;

  return React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
    // 标题行
    React.createElement(Text, { color: c.primary, bold: true }, "  仪表盘"),
    React.createElement(Text, { color: c.textDim }, "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"),
    // 双列
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Box, { flexDirection: "column", width: 20 },
        React.createElement(InnerColumn, null),
      ),
      React.createElement(Text, { color: c.textDim }, "│"),
      React.createElement(Box, { flexDirection: "column", width: 20 },
        React.createElement(OuterColumn, null),
      ),
    ),
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  Ctrl+J/K 翻页"),
  );
}
```

- [ ] **Step 4: 删除旧 tab 文件 + DashboardHeader**

```bash
rm src/ui/components/dashboard/Tab1_Overview.tsx
rm src/ui/components/dashboard/Tab2_Details.tsx
rm src/ui/components/dashboard/Tab3_Relationships.tsx
rm src/ui/components/DashboardHeader.tsx
```

- [ ] **Step 5: 类型检查 + 手动验证**

```bash
npx tsc --noEmit && npm run dev
```

Expected: 仪表盘显示双列分区，全中文标题，情绪轮盘/心境矩阵/关系坐标图渲染。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): dual-column Dashboard with no tabs, all Chinese labels, 3 new widgets"
```

---

### Task 16: 布局左右互换 — ChatArea 左 Dashboard 右

**Files:**
- Modify: `src/ui/components/MainLayout.tsx`

- [ ] **Step 1: 重写 MainLayout 布局**

在 `src/ui/components/MainLayout.tsx` 中，把 body 区域的顺序从 `Dashboard | ChatArea` 改为 `ChatArea | Dashboard`：

```typescript
// ── Body: chat | dashboard ──
React.createElement(Box, { flexDirection: "row", flexGrow: 1 },
  React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
    React.createElement(ChatArea, { messages }),
    React.createElement(NotificationToast, {
      message: latestNote?.message ?? "",
      type: latestNote?.type ?? "info",
      visible: latestNote !== null,
    }),
    statusText
      ? React.createElement(Text, { color: theme.colors.textDim }, `  ${statusText}`)
      : null,
  ),
  showDashboard
    ? React.createElement(Text, { color: theme.colors.textDim }, "│")
    : null,
  showDashboard
    ? React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
        React.createElement(Dashboard, null),
      )
    : null,
),
```

同时把 `showDashboard` 条件中的 `width: 34` 改为 `width: 42`，分隔符位置调整到 Dashboard 左侧。

- [ ] **Step 2: 手动验证**

```bash
npm run dev
```

Expected: 对话区在左，仪表盘在右，≥100 列时显示仪表盘。

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/MainLayout.tsx
git commit -m "feat(ui): swap layout — ChatArea left, Dashboard right (42 cols)"
```

---

### Task 17: StatusBar 情绪简要中文

**Files:**
- Modify: `src/ui/components/StatusBar.tsx`

- [ ] **Step 1: 重写 StatusBar**

重写 `src/ui/components/StatusBar.tsx`：

```typescript
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useAgentStore } from "../stores/agent-store";
import { useChatStore } from "../stores/chat-store";

export function StatusBar({ agentName }: { agentName: string; notificationCount?: number }) {
  const c = useThemeStore((s) => s.theme).colors;
  const snap = useAgentStore((s) => s.snapshot);
  const isGenerating = useChatStore((s) => s.isGenerating);

  const pad = snap?.pad;
  const padText = pad
    ? `愉快${pad.pleasure >= 0 ? "+" : ""}${pad.pleasure.toFixed(2)} 唤醒${pad.arousal >= 0 ? "+" : ""}${pad.arousal.toFixed(2)} 掌控${pad.dominance >= 0 ? "+" : ""}${pad.dominance.toFixed(2)}`
    : "情绪--";
  const sat = snap ? `饱和${snap.saturation.toFixed(2)}` : "";
  const turn = snap ? `第${snap.turnCount}轮` : "";
  const status = isGenerating ? "⠹生成中" : "";

  return React.createElement(Box, { flexDirection: "row" },
    React.createElement(Text, { color: c.primary, bold: true }, ` ${agentName} `),
    React.createElement(Text, { color: c.textDim }, ` ${turn}  `),
    React.createElement(Text, { color: c.accent }, ` ${padText}  `),
    React.createElement(Text, { color: c.textDim }, ` ${sat}  `),
    status ? React.createElement(Text, { color: c.warning }, ` ${status}`) : null,
  );
}
```

- [ ] **Step 2: 类型检查 + 手动验证**

```bash
npx tsc --noEmit && npm run dev
```

Expected: 状态栏显示 `林雨 第42轮 愉快+0.42 唤醒+0.18 掌控-0.10 饱和0.31 ⠹生成中`。

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/StatusBar.tsx
git commit -m "feat(ui): StatusBar shows Chinese emotion summary (PAD + saturation + status)"
```

---

### Task 18: InputArea 自适应高度 + registry 补全

**Files:**
- Modify: `src/ui/components/InputArea.tsx`

- [ ] **Step 1: 从 registry 动态读命令，删硬编码**

在 `src/ui/components/InputArea.tsx` 中，删除硬编码的 `COMMANDS` 数组，改为从 registry 读：

```typescript
import { getCommandNames } from "../../commands/registry";

// 动态构建补全列表（每次渲染时读 registry）
function getCommandItems(): AutocompleteItem[] {
  return getCommandNames().map((name) => {
    const details: Record<string, string> = {
      "/dream": "进入梦境模式",
      "/think": "触发深度思考",
      "/model": "切换模型",
      "/stats": "查看状态统计",
      "/help": "显示帮助",
      "/quit": "退出",
      "/theme": "切换主题",
      "/clear": "清空对话",
    };
    return { label: name, detail: details[name] ?? "", category: "命令" };
  });
}
```

在 `filteredItems` 的 `useMemo` 中调用 `getCommandItems()` 替代 `COMMANDS`。

- [ ] **Step 2: 自适应高度提示**

InputArea 已用 MultilineEditor 的 `maxLines: 6`。调整为 `maxLines: 5`（spec 定义的最多 5 行）。补全浮层在输入上方已实现（Autocomplete 在 MultilineEditor 前）。

- [ ] **Step 3: 类型检查 + 手动验证**

```bash
npx tsc --noEmit && npm run dev
```

Expected: 输入 `/` 弹出补全列表，含所有 registry 命令 + 中文说明。

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/InputArea.tsx
git commit -m "feat(ui): InputArea autocomplete from registry, adaptive height (1-5 lines)"
```

---

### Task 19: 消息菜单 + 内心独白折叠

**Files:**
- Modify: `src/ui/components/MessageMenu.tsx`
- Modify: `src/ui/components/Message.tsx`
- Modify: `src/ui/components/ChatArea.tsx`

- [ ] **Step 1: 重写 MessageMenu（四项操作 + 中文）**

重写 `src/ui/components/MessageMenu.tsx`：

```tsx
import React from "react";
import { Text, Box, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";

export function MessageMenu({ isUser, onRetry, onEdit, onBranch, onCopy, onClose }: {
  isUser: boolean;
  onRetry?: () => void;
  onEdit?: (newText: string) => void;
  onBranch?: () => void;
  onCopy?: () => void;
  onClose: () => void;
}) {
  const c = useThemeStore((s) => s.theme).colors;
  useInput((input, key) => {
    if (input === "1" && onRetry) onRetry();
    if (input === "2" && onEdit && isUser) onEdit("");
    if (input === "3" && onBranch) onBranch();
    if (input === "4" && onCopy) onCopy();
    if (input === "e" || key.escape) onClose();
  });

  const items = [
    { key: "1", label: "重试", available: !!onRetry },
    { key: "2", label: "编辑重发", available: isUser && !!onEdit },
    { key: "3", label: "分支对话", available: !!onBranch },
    { key: "4", label: "复制", available: !!onCopy },
  ].filter((i) => i.available);

  return React.createElement(Box, { flexDirection: "column", paddingLeft: 3 },
    React.createElement(Text, { color: c.secondary, bold: true }, "  消息操作:"),
    ...items.map((i) =>
      React.createElement(Text, { key: i.key, color: c.text }, `  ${i.key}. ${i.label}`),
    ),
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  Esc 关闭"),
  );
}
```

- [ ] **Step 2: Message.tsx 接入菜单 + 内心独白折叠**

在 `src/ui/components/Message.tsx` 中：
- `menuOpen` state 用 useInput 绑定 Alt+M 切换（B 阶段没绑，现在绑）
- reasoning 消息（role=system 且 content 以 `[内心独白]` 开头）渲染为折叠块

在 Message 组件内加：

```typescript
import { useInput } from "ink";
// ...
const [menuOpen, setMenuOpen] = useState(false);
const [monologueExpanded, setMonologueExpanded] = useState(false);

useInput((input, key) => {
  // Alt+M 切换菜单（仅当消息是最近一条时——由父组件控制聚焦）
  // 实际实现：通过 ChatArea 传递 focused prop 控制哪条消息响应按键
});

// 内心独白消息
const isMonologue = msg.role === "system" && msg.content.startsWith("[内心独白]");
if (isMonologue) {
  return React.createElement(Box, { flexDirection: "column", paddingLeft: 3, marginTop: 1 },
    React.createElement(Text, {
      color: c.textDim,
      dimColor: true,
    }, `${monologueExpanded ? "[-]" : "[+]"} 内心独白`,
      React.createElement(Text, { color: c.textDim, dimColor: true }, " 点击展开")),
    monologueExpanded
      ? React.createElement(Text, { color: c.textDim, dimColor: true }, `  ${msg.content.slice(7)}`)
      : null,
  );
}
```

> 注：鼠标点击展开需要 Ink 鼠标支持验证（Task 20）。Alt+M 菜单需要"当前聚焦消息"概念——ChatArea 传递 `focused` prop 给最近一条消息。

- [ ] **Step 3: ChatArea 传递回调 + 聚焦**

在 `src/ui/components/ChatArea.tsx` 中，给最后一条消息传 `focused` prop 和回调函数：

```typescript
// 从 store 获取 dispatch 能力（重试/编辑/分支/复制需要操作 messages）
// B 阶段最小实现：onCopy 用 clipboard（Node 无原生 clipboard，用 writeFileSync 到临时文件或跳过）
// onRetry/onEdit/onBranch 需要调用 agent 重新生成——这部分需要 useTurnStream 配合
```

> 注：重试/编辑重发/分支对话需要操作 agent（重新跑 turn 或分支会话），这是较重的功能。B 阶段先实现"复制"（最轻），其余三个在 ChatArea 中留 `TODO` 回调占位，C 阶段后续补全。

- [ ] **Step 4: 类型检查 + 手动验证**

```bash
npx tsc --noEmit && npm run dev
```

Expected: 消息显示 `[+] 内心独白` 折叠块，按 Alt+M 弹出操作菜单（至少显示"复制"）。

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/MessageMenu.tsx src/ui/components/Message.tsx src/ui/components/ChatArea.tsx
git commit -m "feat(ui): message menu (retry/edit/branch/copy) + collapsible inner monologue"
```

---

### Task 20: 鼠标交互 smoke test + 接通或降级

**Files:**
- Modify: `src/ui/components/MainLayout.tsx`（鼠标后备）
- Modify: `src/ui/components/Dashboard.tsx`（Ctrl+J/K 滚动）

- [ ] **Step 1: Ink 鼠标支持 smoke test**

创建临时测试文件验证 `useMouse` 或 `useStdin` 鼠标事件：

```bash
# 检查 Ink 版本和鼠标 API
cd "D:/新建文件夹 (2)/character-mind-v3-ts" && node -e "const ink = require('ink'); console.log(Object.keys(ink).filter(k => k.toLowerCase().includes('mouse')))"
```

- [ ] **Step 2: 根据结果选择路径**

**如果 Ink 支持鼠标**：
- 在 Dashboard 中用 `useMouse` 监听点击，滚动到对应分区
- 在 Message 中用 `useMouse` 监听点击展开菜单
- 在 ChatArea 中用 `useMouse` 监听滚轮滚动

**如果 Ink 不支持鼠标**：
- 降级：Dashboard 用 `Ctrl+J/K` 键盘翻页（已在 Dashboard 渲染提示）
- Message 菜单用 `Alt+M` 触发（已在 Task 19 实现）
- 在 spec 风险表中记录降级决定

- [ ] **Step 3: 实现 Ctrl+J/K Dashboard 滚动（键盘后备，无论鼠标是否支持都需要）**

在 `src/ui/components/Dashboard.tsx` 中加滚动状态：

```typescript
import { useInput } from "ink";
import { useState } from "react";

export function Dashboard() {
  const [scrollY, setScrollY] = useState(0);
  useInput((input, key) => {
    if (input === "j" && key.ctrl) setScrollY((y) => y + 1);
    if (input === "k" && key.ctrl) setScrollY((y) => Math.max(0, y - 1));
  });
  // scrollY 传给 InnerColumn/OuterColumn 控制可见分区
  // ...
}
```

> 注：Ink 的滚动实现需要用 `scrollY` 偏移控制 Box 的可见区域。Ink 没有原生 scroll，需要手动截取渲染的分区列表。这是实现细节，实现时根据 InnerColumn/OuterColumn 的分区数组做 slice。

- [ ] **Step 4: 手动验证**

```bash
npm run dev
```

Expected: Ctrl+J/K 能上下翻页 Dashboard（即使鼠标不支持也能用键盘）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): Dashboard scroll via Ctrl+J/K (mouse fallback if unsupported)"
```

---

## 自检结果

### Spec 覆盖检查

| Spec 章节 | 覆盖任务 |
|-----------|----------|
| B-3.1 文件结构 | Task 2-9 |
| B-3.2 三 store | Task 4, 5 |
| B-3.3 AgentPort | Task 2 |
| B-3.4 agent 工厂 + registry | Task 3 |
| B-3.5 事件归约 | Task 4 |
| B-3.6 快照驱动 | Task 5, 6 |
| B-3.7 主题迁移 | Task 5, 8 |
| B-3.8 markdown 修复 | Task 7 |
| B-3.9 并发控制 | Task 4 (isGenerating) |
| C-4.2 布局 | Task 16 |
| C-4.3 双列分区 | Task 15 |
| C-4.4 消息样式 | Task 19 |
| C-4.5 三新组件 | Task 12, 13, 14 |
| C-4.6 状态栏 | Task 17 |
| C-4.7 输入区 | Task 18 |
| C-5.1 键位/焦点 | Task 19, 20 |
| C-5.2 消息菜单 | Task 19 |
| C-5.3 斜杠命令 | Task 18 |
| C-6.1 配色 | Task 10 |
| C-6.2 视觉元素 | Task 10, 11 |
| 七 死代码删除 | Task 9 |
| 八 测试 | Task 3, 4, 7 |
| 九 风险验证 | Task 1 (zustand), Task 20 (鼠标) |

### 占位符检查

- "无聊"分区显示"参与度数据待接入"——这是因为 agent 的 getStateSnapshot 当前不返回 boredom 字段（v4 才加）。不是 plan 占位符，是 spec 范围内的已知限制（B 阶段不动 agent）。
- "心智理论"同理——ToM 数据待 v4 agent 扩展。
- 消息菜单的"重试/编辑重发/分支对话"在 Task 19 标注为 TODO 占位——这是因为这三个操作需要 agent 配合（重新跑 turn/分支会话），比"复制"重得多。Task 19 实现复制 + 菜单框架，其余三个留接口。

### 类型一致性

- `AgentSnapshot` 全程用 `ReturnType<CharacterAgent["getStateSnapshot"]>` 推导，不手写——Task 2 定义，Task 5/15 使用。
- `ChatState` / `reduceTurnEvent` 在 Task 4 定义，Task 6 使用。
- `useChatStore` / `useAgentStore` / `useThemeStore` 在 Task 4/5 定义，Task 6/8/15-19 使用。
- `renderMarkdown(md, theme)` 签名在 Task 7 定义，Message.tsx 使用。

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-07-01-frontend-state-and-ui-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
