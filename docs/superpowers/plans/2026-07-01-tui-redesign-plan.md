# TUI 完全重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 257 行基础 Ink UI 重构为多面板、可自定义、功能完整的终端界面

**Architecture:** Ink 5 + React 18，18 个组件文件，ThemeContext 驱动配色，AgentStateProvider 提供实时数据订阅，Markdown→ANSI 自研渲染

**Tech Stack:** Ink 5, React 18, TypeScript, js-yaml (主题加载), node:fs/path/os

## Global Constraints

- tsc --noEmit 零错误（UI 目录开启 strict 模式）
- vitest run 现有 18 测试全部通过
- 终端宽度 ≥80 列正常渲染，≥100 列显示左侧面板，<80 列纯对话模式
- 配色 #706CAA / #F7DA94 / #CC7EB1，全部 256 色终端一致
- 消息操作快捷键备选方案：Alt+M（主）+ Ctrl+O（备选）
- 不引入 Web 依赖（无 express/socket.io/electron）

---

## 文件结构

```
src/ui/
├── app.tsx                    # [重写] App 入口 + AgentStateProvider
├── theme/
│   ├── types.ts              # [新] ThemeConfig 类型
│   ├── presets.ts            # [新] 4 预设主题
│   ├── context.tsx           # [新] ThemeContext + ThemeProvider
│   └── loader.ts            # [新] YAML 加载/保存
├── components/
│   ├── MainLayout.tsx        # [新] 左右面板 Flex 布局（响应式）
│   ├── StatusBar.tsx         # [新] 顶部状态栏
│   ├── ChatArea.tsx          # [新] 消息列表（可滚动）
│   ├── Message.tsx           # [新] 单条消息组件
│   ├── MessageMenu.tsx       # [新] 消息操作弹出菜单
│   ├── NotificationToast.tsx # [新] 通知 toast
│   ├── InputArea.tsx         # [新] 底部输入区容器
│   ├── MultilineEditor.tsx   # [新] 多行编辑器
│   ├── Autocomplete.tsx      # [新] 自动补全弹出面板
│   ├── Dashboard.tsx         # [新] 左侧仪表盘容器
│   ├── DashboardHeader.tsx   # [新] 角色名 + 火花线
│   └── dashboard/
│       ├── Tab1_Overview.tsx      # [新] 概览面板
│       ├── Tab2_Details.tsx       # [新] 细节面板
│       └── Tab3_Relationships.tsx # [新] 记忆/关系面板
├── widgets/
│   ├── ProgressBar.tsx       # [新] ████░░ 进度条组件
│   ├── Sparkline.tsx         # [新] 迷你火花线组件
│   ├── Heatmap.tsx           # [新] 热力图组件
│   └── ToolCallCard.tsx      # [新] 工具调用内联卡片
├── markdown.ts               # [新] Markdown → ANSI 渲染器
├── agent-state.ts            # [新] AgentStateProvider (Context + 500ms 订阅)
├── span-renderer.ts          # [保留] SpanState（移入 Context）
├── stream-renderer.ts        # [保留] 降级 readline 渲染器
└── history.ts                # [保留] 增强 Ctrl+R 搜索
```

---

### Task 1: 主题系统基础设施

**Files:**
- Create: `src/ui/theme/types.ts`
- Create: `src/ui/theme/presets.ts`
- Create: `src/ui/theme/context.tsx`
- Create: `src/ui/theme/loader.ts`

- [ ] **Step 1: 类型定义 `types.ts`**

```typescript
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textDim: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeLayout {
  leftPanelWidth: number;
  showDashboard: boolean;
  dashboardDefaultTab: number;
}

export interface ThemeTypography {
  roleNameBold: boolean;
  timestampFormat: string;
}

export interface ThemeAnimation {
  streaming: boolean;
  progressBars: boolean;
  sparkline: boolean;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  layout: ThemeLayout;
  typography: ThemeTypography;
  animation: ThemeAnimation;
}
```

- [ ] **Step 2: 预设主题 `presets.ts`**

```typescript
import type { ThemeConfig } from "./types";

export const DEFAULT_THEME: ThemeConfig = {
  name: "default",
  colors: {
    primary: "#706CAA", secondary: "#F7DA94", accent: "#CC7EB1",
    background: "#1A1A2E", surface: "#242442",
    text: "#E8E8F0", textDim: "#8888A0",
    success: "#80C080", warning: "#F7DA94", error: "#E08080",
  },
  layout: { leftPanelWidth: 32, showDashboard: true, dashboardDefaultTab: 0 },
  typography: { roleNameBold: true, timestampFormat: "HH:mm" },
  animation: { streaming: true, progressBars: true, sparkline: true },
};

export const DARK_THEME: ThemeConfig = {
  ...DEFAULT_THEME, name: "dark",
  colors: { primary: "#AAAAAA", secondary: "#DDDDDD", accent: "#999999",
    background: "#000000", surface: "#111111", text: "#CCCCCC", textDim: "#666666",
    success: "#88AA88", warning: "#CCCC88", error: "#AA8888" },
};

export const WARM_THEME: ThemeConfig = {
  ...DEFAULT_THEME, name: "warm",
  colors: { primary: "#C4956A", secondary: "#E8C48A", accent: "#D4A574",
    background: "#2A2218", surface: "#3A3228", text: "#F0E0D0", textDim: "#807060",
    success: "#80A080", warning: "#E8C48A", error: "#C08060" },
};

export const FOREST_THEME: ThemeConfig = {
  ...DEFAULT_THEME, name: "forest",
  colors: { primary: "#6A9B6A", secondary: "#A0C080", accent: "#80A870",
    background: "#182218", surface: "#283228", text: "#D0E8D0", textDim: "#608060",
    success: "#80C080", warning: "#C0C060", error: "#C06060" },
};

export const PRESETS: Record<string, ThemeConfig> = {
  default: DEFAULT_THEME, dark: DARK_THEME, warm: WARM_THEME, forest: FOREST_THEME,
};
```

- [ ] **Step 3: ThemeContext `context.tsx`**

```typescript
import React, { createContext, useContext, useState, useCallback } from "react";
import type { ThemeConfig } from "./types";
import { DEFAULT_THEME, PRESETS } from "./presets";
import { loadThemeFile, saveThemeFile } from "./loader";

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
  loadPreset: (name: string) => void;
  setColor: (key: keyof ThemeConfig["colors"], value: string) => void;
  save: (name?: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>(null!);

export function ThemeProvider({ children, configDir }: { children: React.ReactNode; configDir: string }) {
  const [theme, setThemeState] = useState<ThemeConfig>(() => loadThemeFile(configDir) ?? DEFAULT_THEME);

  const setTheme = useCallback((t: ThemeConfig) => setThemeState(t), []);
  const loadPreset = useCallback((name: string) => {
    const preset = PRESETS[name];
    if (preset) setThemeState({ ...preset, name });
  }, []);
  const setColor = useCallback((key: keyof ThemeConfig["colors"], value: string) => {
    setThemeState(t => ({ ...t, colors: { ...t.colors, [key]: value } }));
  }, []);
  const save = useCallback((name?: string) => {
    saveThemeFile(configDir, name ? { ...theme, name } : theme);
  }, [theme, configDir]);

  return React.createElement(ThemeContext.Provider, { value: { theme, setTheme, loadPreset, setColor, save } }, children);
}

export function useTheme(): ThemeConfig { return useContext(ThemeContext).theme; }
export function useThemeActions(): Omit<ThemeContextValue, "theme"> {
  const { theme: _, ...actions } = useContext(ThemeContext);
  return actions;
}
```

- [ ] **Step 4: 加载器 `loader.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { ThemeConfig } from "./types";
import { DEFAULT_THEME } from "./presets";

export function loadThemeFile(configDir: string): ThemeConfig | null {
  try {
    const yaml = require("js-yaml");
    const path = join(configDir, "theme.yaml");
    if (!existsSync(path)) return null;
    const raw = yaml.load(readFileSync(path, "utf-8"));
    return (raw?.theme as ThemeConfig) ?? null;
  } catch { return null; }
}

export function saveThemeFile(configDir: string, theme: ThemeConfig): void {
  try {
    const yaml = require("js-yaml");
    const path = join(configDir, "theme.yaml");
    writeFileSync(path, yaml.dump({ theme }), "utf-8");
  } catch { /* ignore */ }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/theme/ && git commit -m "feat(ui): theme system — ThemeConfig types, 4 presets, ThemeContext, YAML loader"
```

---

### Task 2: 基础 Widget 组件

**Files:**
- Create: `src/ui/widgets/ProgressBar.tsx`
- Create: `src/ui/widgets/Sparkline.tsx`
- Create: `src/ui/widgets/Heatmap.tsx`
- Create: `src/ui/widgets/ToolCallCard.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1
- Produces: `ProgressBar(props)`, `Sparkline(props)`, `Heatmap(props)`, `ToolCallCard(props)`

- [ ] **Step 1: ProgressBar**

```typescript
import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/context";

export function ProgressBar({ label, value, max, width = 10 }: {
  label: string; value: number; max: number; width?: number;
}) {
  const theme = useTheme();
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const filled = Math.round(ratio * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return React.createElement(Text, null,
    React.createElement(Text, { color: theme.colors.textDim }, `${label.padEnd(6)} `),
    React.createElement(Text, { color: ratio > 0.7 ? theme.colors.success : ratio > 0.3 ? theme.colors.secondary : theme.colors.error }, bar),
    React.createElement(Text, { color: theme.colors.textDim }, ` ${value.toFixed(2)}/${max.toFixed(2)}`),
  );
}
```

- [ ] **Step 2: Sparkline (迷你折线图)**

```typescript
import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/context";

const SPARK_CHARS = ["▁","▂","▃","▄","▅","▆","▇","█"];

export function Sparkline({ data, width = 20, label }: { data: number[]; width?: number; label?: string }) {
  const theme = useTheme();
  if (data.length === 0) return React.createElement(Text, null);
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
  const sampled = data.length <= width ? data : data.slice(-width);
  const line = sampled.map(v => SPARK_CHARS[Math.min(7, Math.floor((v - min) / range * 7))]).join("");
  return React.createElement(Text, null,
    label ? React.createElement(Text, { color: theme.colors.textDim }, `${label} `) : null,
    React.createElement(Text, { color: theme.colors.primary }, line),
    React.createElement(Text, { color: theme.colors.textDim }, ` ${data[data.length-1].toFixed(2)}`),
  );
}
```

- [ ] **Step 3: Heatmap (热力图行)**

```typescript
import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/context";

export function Heatmap({ items, width = 10 }: {
  items: Array<{ label: string; value: number }>; width?: number;
}) {
  const theme = useTheme();
  return React.createElement(Text, null,
    ...items.map(({ label, value }) => {
      const filled = Math.round(Math.max(0, Math.min(1, value)) * width);
      const bar = "█".repeat(filled) + "░".repeat(width - filled);
      const color = value > 0.7 ? theme.colors.accent : value > 0.4 ? theme.colors.primary : theme.colors.textDim;
      return React.createElement(Text, { key: label },
        React.createElement(Text, { color: theme.colors.textDim }, `${label.padEnd(12)} `),
        React.createElement(Text, { color }, bar),
        React.createElement(Text, { color: theme.colors.textDim }, ` ${value.toFixed(2)}\n`),
      );
    }),
  );
}
```

- [ ] **Step 4: ToolCallCard**

```typescript
import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/context";

const TOOL_ICONS: Record<string, string> = {
  read_file: "📄", exec_command: "$", search_files: "🔍", search_content: "🔎",
  write_file: "✎", edit_file: "✐", web_fetch: "🌐", web_search: "🔎",
};

export function ToolCallCard({ tool, args, success, outputPreview, durationMs }: {
  tool: string; args: Record<string, unknown>; success: boolean; outputPreview: string; durationMs: number;
}) {
  const theme = useTheme();
  const icon = TOOL_ICONS[tool] ?? "↳";
  const detail = tool === "exec_command" ? (args.command as string)?.slice(0, 60)
    : tool === "read_file" ? (args.path as string)?.slice(0, 60)
    : tool === "write_file" ? (args.path as string)?.slice(0, 60)
    : "";
  return React.createElement(Text, { color: theme.colors.textDim },
    React.createElement(Text, { color: theme.colors.secondary }, `  ${icon} ${tool} `),
    React.createElement(Text, null, detail),
    React.createElement(Text, { color: success ? theme.colors.success : theme.colors.error }, ` ${success ? "✓" : "✗"}`),
    React.createElement(Text, null, ` ${outputPreview.slice(0, 40)} · ${durationMs}ms`),
  );
}
```

- [ ] **Step 5: Commit**

---

### Task 3: Agent 状态订阅 + Markdown 渲染器

**Files:**
- Create: `src/ui/agent-state.ts`
- Create: `src/ui/markdown.ts`
- Modify: `src/agent/agent.ts` (添加 `getStateSnapshot()` 方法)

- [ ] **Step 1: Agent 添加 `getStateSnapshot()` 方法**

在 `CharacterAgent` 类中添加：

```typescript
/** Lightweight state snapshot for UI rendering (no allocations, just reads). */
getStateSnapshot(): {
  agentName: string; turnCount: number; saturation: number;
  homeostatic: HomeostaticSnapshot;
  pad: PAD | null; bisbas: BISBASState | null;
  mood: MoodSnapshot; drives: Record<string, number>;
  regulation: { strategy: string; suppressionCumulative: number; breakdown: boolean };
  memory: { wm: number; stm: number; ltm: number; core: number; archive: number };
  relationship: { trust: number; familiarity: number; avoidance: number; ambivalence: number };
  narrative: { agency: number; communion: number; redemption: number; contamination: number; meaning: number };
  metabolism: { lastDaydream: number; lastQuick: number; lastFull: number };
} {
  return {
    agentName: this.config.name ?? "林雨",
    turnCount: this.turnCount,
    saturation: this.saturation.s,
    homeostatic: this.homeostatic.snapshot(),
    pad: this.currentPAD,
    bisbas: this.currentBISBAS,
    mood: this.currentMood,
    drives: this.drives.toDict(),
    regulation: {
      strategy: this.breakdownState.inBreakdown ? "breakdown" : "reappraisal",
      suppressionCumulative: this.suppressionCumulative,
      breakdown: this.breakdownState.inBreakdown,
    },
    memory: {
      wm: this.workingMemory.length,
      stm: this.shortTermMemory.length,
      ltm: this.longTermMemory.length,
      core: this.coreGraph.length,
      archive: this.archiveMemory.length,
    },
    relationship: {
      trust: this.saturationDetector.trust ?? 0.5,
      familiarity: this.saturationDetector.familiarity ?? 0.5,
      avoidance: this.saturationDetector.avoidance ?? 0.1,
      ambivalence: this.saturationDetector.ambivalence ?? 0.1,
    },
    narrative: {
      agency: this.narrativeIdentity?.themes?.agency ?? 0.5,
      communion: this.narrativeIdentity?.themes?.communion ?? 0.5,
      redemption: this.narrativeIdentity?.themes?.redemption ?? 0.3,
      contamination: this.narrativeIdentity?.themes?.contamination ?? 0.1,
      meaning: this.narrativeIdentity?.themes?.meaning ?? 0.5,
    },
    metabolism: {
      lastDaydream: this.metabolism?.stats?.lastDaydream ?? 0,
      lastQuick: this.metabolism?.stats?.lastQuick ?? 0,
      lastFull: this.metabolism?.stats?.lastFull ?? 0,
    },
  };
}
```

- [ ] **Step 2: AgentStateProvider `agent-state.ts`**

```typescript
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { CharacterAgent } from "../agent/agent";

export type AgentSnapshot = ReturnType<CharacterAgent["getStateSnapshot"]>;

interface AgentStateValue {
  agent: CharacterAgent | null;
  snapshot: AgentSnapshot | null;
}

const AgentStateContext = createContext<AgentStateValue>({ agent: null, snapshot: null });

export function AgentStateProvider({ agent, children }: { agent: CharacterAgent | null; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!agent) return;
    setSnapshot(agent.getStateSnapshot());
    intervalRef.current = setInterval(() => setSnapshot(agent.getStateSnapshot()), 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [agent]);

  return React.createElement(AgentStateContext.Provider, { value: { agent, snapshot } }, children);
}

export function useAgentSnapshot(): AgentSnapshot | null {
  return useContext(AgentStateContext).snapshot;
}
export function useAgent(): CharacterAgent | null {
  return useContext(AgentStateContext).agent;
}
```

- [ ] **Step 3: Markdown→ANSI 渲染器 `markdown.ts`**

```typescript
const CSI = "\x1b[";
const C = {
  bold: `${CSI}1m`, italic: `${CSI}3m`, dim: `${CSI}2m`, reset: `${CSI}0m`,
  codeBg: `${CSI}48;5;236m`, blockBorder: `${CSI}38;5;240m`,
};

export interface AnsiSpan {
  text: string;
  ansi: string;
}

export function renderMarkdown(md: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const lines = md.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) {
      spans.push({ text: line, ansi: `${C.dim}${C.codeBg} ${line} ${C.reset}` });
      continue;
    }
    if (line.startsWith("# ")) {
      spans.push({ text: line.slice(2), ansi: `${C.bold}${line.slice(2)}${C.reset}` });
      continue;
    }
    if (line.startsWith("> ")) {
      spans.push({ text: line.slice(2), ansi: `${C.dim}│ ${line.slice(2)}${C.reset}` });
      continue;
    }
    if (/^[\-\*] /.test(line)) {
      spans.push({ text: line, ansi: `  • ${renderInline(line.slice(2))}` });
      continue;
    }
    spans.push({ text: line, ansi: renderInline(line) });
  }
  return spans;
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, `${C.bold}$1${C.reset}`)
    .replace(/\*(.+?)\*/g, `${C.italic}$1${C.reset}`)
    .replace(/`(.+?)`/g, `${C.dim}${C.codeBg}$1${C.reset}`);
}
```

- [ ] **Step 4: Commit**

---

### Task 4: 消息组件

**Files:**
- Create: `src/ui/components/Message.tsx`
- Create: `src/ui/components/MessageMenu.tsx`
- Create: `src/ui/components/NotificationToast.tsx`
- Create: `src/ui/components/ChatArea.tsx`

**Interfaces:**
- Consumes: `useTheme()` (Task 1), `useAgent()` (Task 3), `renderMarkdown` (Task 3)
- Produces: `<Message>`, `<MessageMenu>`, `<NotificationToast>`, `<ChatArea>`

- [ ] **Step 1: Message.tsx**

```typescript
import React, { useState } from "react";
import { Text, Box } from "ink";
import { useTheme } from "../theme/context";
import { renderMarkdown } from "../markdown";
import { ToolCallCard } from "../widgets/ToolCallCard";
import { MessageMenu } from "./MessageMenu";

export type MessageRole = "user" | "assistant" | "system" | "tool";
export interface ChatMessage {
  id: string; role: MessageRole; content: string; timestamp: number;
  toolCall?: { name: string; args: Record<string, unknown>; success: boolean; outputPreview: string; durationMs: number };
}

export function Message({ msg, onRetry, onEdit, onBranch }: {
  msg: ChatMessage;
  onRetry?: () => void; onEdit?: (newText: string) => void; onBranch?: () => void;
}) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const time = new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  if (msg.role === "system") {
    return React.createElement(Text, { color: theme.colors.textDim }, `  ── ${msg.content} ──`);
  }
  if (msg.role === "tool" && msg.toolCall) {
    return React.createElement(ToolCallCard, { ...msg.toolCall });
  }

  const isUser = msg.role === "user";
  const prefix = isUser ? "❯" : "│";
  const prefixColor = isUser ? theme.colors.accent : theme.colors.primary;
  const align = isUser ? "flex-end" : "flex-start";

  return React.createElement(Box, { flexDirection: "column", alignItems: align, marginBottom: 1 },
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Text, { color: prefixColor, bold: true }, `${prefix} `),
      React.createElement(Text, { color: theme.colors.textDim }, time),
      !isUser ? React.createElement(Text, { color: theme.colors.secondary, dimColor: !menuOpen },
        " · Alt+M", // hint
      ) : null,
    ),
    React.createElement(Box, { paddingLeft: 2 },
      React.createElement(Text, null,
        ...(isUser
          ? [React.createElement(Text, { color: theme.colors.text }, msg.content)]
          : renderMarkdown(msg.content).map((s, i) =>
              React.createElement(Text, { key: i }, s.ansi)
            )
        )
      ),
    ),
    menuOpen && React.createElement(MessageMenu, {
      isUser, onRetry, onEdit, onBranch, onClose: () => setMenuOpen(false),
    }),
  );
}
```

- [ ] **Step 2: MessageMenu.tsx** — 浮动操作菜单（类似实现略）
- [ ] **Step 3: NotificationToast.tsx** — 右上角浮动通知（类似实现略）
- [ ] **Step 4: ChatArea.tsx** — 可滚动消息列表容器（类似实现略）

---

### Task 5: 左侧仪表盘面板

**Files:**
- Create: `src/ui/components/Dashboard.tsx`
- Create: `src/ui/components/DashboardHeader.tsx`
- Create: `src/ui/components/dashboard/Tab1_Overview.tsx`
- Create: `src/ui/components/dashboard/Tab2_Details.tsx`
- Create: `src/ui/components/dashboard/Tab3_Relationships.tsx`

**Interfaces:**
- Consumes: `useAgentSnapshot()` (Task 3), `useTheme()` (Task 1), widgets (Task 2)

- [ ] **Dashboard.tsx** — Tab 容器，useState 跟踪 activeTab，Tab 键切换
- [ ] **DashboardHeader.tsx** — 角色名（bold, primary色）+ 饱和度 Sparkline（最近20值从state历史获取）
- [ ] **Tab1_Overview.tsx** — 5 稳态 ProgressBar + PAD 坐标 ProgressBar + 当前情绪 + 异稳态负荷 + 饱和度
- [ ] **Tab2_Details.tsx** — 14D Heatmap + 5 驱力 ProgressBar + BIS/BAS 双条
- [ ] **Tab3_Relationships.tsx** — 记忆统计 + 关系 4 维 + 叙事主题

---

### Task 6: 输入区组件

**Files:**
- Create: `src/ui/components/MultilineEditor.tsx`
- Create: `src/ui/components/Autocomplete.tsx`
- Create: `src/ui/components/InputArea.tsx`

- [ ] **MultilineEditor.tsx** — Enter发送/Alt+Enter换行，最大6行，语法高亮（`/cmd`→secondary, `@mention`→primary, `` `code` ``→dim），光标渲染 █/▌
- [ ] **Autocomplete.tsx** — 浮动面板，上下选择，Enter确认，Esc取消。触发：`/`/`@file`/`@mem`/`@tool`
- [ ] **InputArea.tsx** — 组合 MultilineEditor + Autocomplete + URL 预览条

---

### Task 7: 主布局 + App 重写

**Files:**
- Create: `src/ui/components/MainLayout.tsx`
- Create: `src/ui/components/StatusBar.tsx`
- Modify: `src/ui/app.tsx` (完全重写)

- [ ] **MainLayout.tsx** — 响应式 Flex 布局：`stdout.columns >= 100` → 左右面板；`>=80` → 纯对话；`<80` → 紧凑模式
- [ ] **StatusBar.tsx** — turn数·延迟·tokens·通知铃铛 `🔔`
- [ ] **app.tsx 重写** — ThemeProvider > AgentStateProvider > MainLayout。保留现有 agent 初始化逻辑、ContinuousLoop、checkpoint recovery、command routing。消息流用 `agent.runStream` async generator 驱动 ChatArea。

---

### Task 8: 入口链 + 主题命令注册

**Files:**
- Modify: `src/ink-main.tsx`
- Modify: `src/commands/builtin/` (添加 theme 命令)
- Modify: `src/ui/history.ts` (增强 Ctrl+R 搜索)

- [ ] **ink-main.tsx** — 简化为 `render(<App />)`
- [ ] **/theme 命令** — 注册到 commands/builtin/theme.ts
- [ ] **history.ts 增强** — 添加 `searchEntries(query: string): string[]` 方法（Ctrl+R 搜索用）

---

### Task 9: 全局验证 + 集成

- [ ] `tsc --noEmit` 零错误（ui/ 目录 strict 模式）
- [ ] `vitest run` 18/18 保持
- [ ] 手动 smoke test：启动 → 初始化 → 发送消息 → 查看仪表盘刷新 → 切换 Tab → 发送命令 → /quit

---

## 验证清单

| 检查项 | 验证方式 |
|--------|---------|
| tsc --noEmit | CI / 手动 |
| vitest run | 18/18 |
| 主题切换 | `/theme dark` → 颜色即时变化 |
| 仪表盘刷新 | 发送消息后左侧面板数据变化 |
| Markdown 渲染 | AI 回复中 `**bold**` `*italic*` `` `code` `` 正确渲染 |
| 多行输入 | Alt+Enter 换行，Enter 发送 |
| 自动补全 | `/` → 弹出命令列表 |
| 响应式 | 终端宽度 < 80 → 隐藏左侧面板 |
| 消息操作 | Alt+M → 菜单弹出 |
