# Character Mind 前端重构设计规范 — 状态层 + 界面/交互/美术

**日期**: 2026-07-01
**状态**: proposed
**前身**: [2026-07-01 TUI 完全重构](./2026-07-01-tui-redesign-design.md)（已实施，commit bd275f7）
**范围**: 在已实施的 TUI 骨架上，分两阶段重构 — B 阶段修状态层地基，C 阶段重做界面/交互/视觉
**参考**: opencode TUI（OpenTUI/SolidJS 实现，消息呈现风格）

---

## 目录

1. [背景与问题](#一背景与问题)
2. [目标与分阶段](#二目标与分阶段)
3. [B 阶段：状态层架构](#三b-阶段状态层架构)
4. [C 阶段：界面](#四c-阶段界面)
5. [C 阶段：交互](#五c-阶段交互)
6. [C 阶段：美术](#六c-阶段美术暖色暮色主题)
7. [死代码删除](#七死代码删除)
8. [测试](#八测试)
9. [风险与验证点](#九风险与验证点)
10. [实施顺序](#十实施顺序)
11. [决策记录](#十一决策记录)

---

## 一、背景与问题

前次 TUI 重设计（bd275f7）搭了 27 文件的骨架，但存在以下问题，需重构解决：

### 架构债（B 阶段）
1. **上帝组件**：`app.tsx` 294 行，混了 agent 装配、事件流消费（110 行 switch）、消息状态、命令分发、通知。
2. **紧耦合**：app.tsx 直接 `new` agent/telemetry/recovery/loop，UI 无法脱离 agent 独立渲染或单测。provider 选择靠 `API_BASE.includes("anthropic"|"longcat")` 字符串嗅探，脆弱；`provider-registry.ts` 存在却没接上。
3. **轮询而非订阅**：agent-state 用 500ms `setInterval` 拉 snapshot，与聊天事件流时间轴不一致。
4. **props 钻取**：messages 从 AppInner→MainLayout→ChatArea→Message 透传 3 层，无统一 store。

### 界面/交互问题（C 阶段）
5. **断线功能**：Dashboard 三 tab 无法切换（没绑 useInput）、MessageMenu 永远打不开、Autocomplete 选中态永远 0、ChatArea 回调恒 undefined。
6. **markdown 渲染失效**：`renderMarkdown` 产出 ANSI 转义字符串直接喂 `<Text>`，Ink 不解析内嵌 ANSI → 助手消息样式乱码。
7. **Dashboard 装不下 v4**：v4 新增无聊/心境12维/叙事/ToM/情感传染等，现有 3 tab + ProgressBar 模式信息组织不足。
8. **死代码**：stream-renderer.ts、span-renderer.ts 整文件零引用；history.ts 导航方法零调用；多处死 import/死导出。

### 假数据
9. Tab3 关系的 trust/familiarity 硬编码 0.5。

---

## 二、目标与分阶段

### 总目标
修好前端架构地基 + 重做界面/交互/视觉，承载 v4 心智架构的可视化。

### B 阶段（状态层重构）
- 拆解 app.tsx 上帝组件
- 引入 zustand 三 store 替代 props 钻取 + 轮询 Context
- 用 AgentPort 接口解耦 UI 与 agent，使 UI 可独立单测
- 接上 provider-registry.ts（替代字符串嗅探）
- 修复 markdown 渲染（ANSI → Ink 原生节点）
- 删除死代码
- 纯逻辑测试

### C 阶段（界面/交互/美术）
- Dashboard 双列分区重做（无 tab，承载 v4 全部心智模块）
- 消息区 opencode 风格 + 情绪标记
- 输入区自适应高度
- StatusBar 情绪简要
- 鼠标 + 键盘交互
- 消息菜单（编辑重发/分支对话/重试/复制）
- 暖色暮色主题
- 3 个新组件（情绪轮盘/心境矩阵/关系坐标图）

### 原则
- **B 先铺地基，C 再做上层**：B 的决策必须为 C 留好扩展点。
- **B 零行为回归**：用户可见的交互行为保持与现状一致。
- **C 零后端改动**：agent/mind/memory 不动，只动 src/ui。

---

## 三、B 阶段：状态层架构

### 3.1 目标文件结构

```
src/ui/
├── app.tsx              ← 薄：调工厂 + 挂 useTurnStream + render
├── agent-port.ts        ← AgentPort 接口 (NEW)
├── agent-factory.ts     ← createAgent() 装配，接 provider-registry (NEW)
├── stores/
│   ├── chat-store.ts    ← useChatStore: messages/event/status/notifications
│   ├── agent-store.ts   ← useAgentStore: snapshot + 2s轮询 + refreshNow()
│   └── theme-store.ts   ← useThemeStore: theme + actions (替代 context+bridge)
├── hooks/
│   └── use-turn-stream.ts  ← 消费 runStream → 调 chat-store.dispatchEvent
├── markdown.tsx         ← renderMarkdown(md, theme) → React.ReactNode[] (改自 .ts)
├── components/          ← C 阶段重做
├── theme/               ← 保留 types/presets/loader，删 context.tsx/bridge.ts
└── (删除) agent-state.ts / span-renderer.ts / stream-renderer.ts
```

### 3.2 状态管理：zustand 三独立 store

选择 zustand（~1KB，React 18 `useSyncExternalStore` 兼容）而非 useReducer/Context，理由：选择性订阅（text_delta 高频更新不引发全树重渲染）、store 可脱离 React 单测、C 阶段 Dashboard 扩展零成本。

| store | 持有状态 | 驱动方式 | 生命周期 |
|-------|----------|----------|----------|
| `useChatStore` | messages, statusText, isGenerating, notifications, pendingToolCalls, turnStartMs | 事件驱动（runStream → dispatchEvent → reduceTurnEvent） | 随 app 挂载/卸载 |
| `useAgentStore` | snapshot | 2s 轮询兜底 + turn 事件即时刷新 | startPolling(agent)/stopPolling()，app 控制 |
| `useThemeStore` | theme | 用户操作（/theme 命令直接调 store.getState()） | 模块级单例，常驻 |

通知（notifications）归 `useChatStore`：入队最近 5 条 + 4s setTimeout 自动移除（保持现状行为，不加去重）。setTimeout 在 store 内部执行，store 不卸载，无泄漏。

### 3.3 AgentPort 接口（解耦缝）

UI 全部依赖 `AgentPort`，不依赖 `CharacterAgent`。接口窄（5 方法），实现深（agent.ts 1000+ 行）——深模块。

```typescript
// src/ui/agent-port.ts
export interface AgentPort {
  runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent>;
  getStateSnapshot(): AgentSnapshot;
  shutdown(): Promise<void>;
  restoreFromCheckpoint(data: unknown): Promise<void>;
  readonly config: { name: string };
}
```

测试时注入 `MockAgent implements AgentPort`：runStream yield 预设事件序列，getStateSnapshot 返回固定快照。

### 3.4 agent 工厂 + provider-registry 接入

`createAgent(configDir, env)` 装配 provider/tracer/ckpt/recovery/loop，用 `provider-registry.ts` 的声明式匹配替代 `API_BASE.includes()` 嗅探。返回 `{ agent, agentName, loop }`。

### 3.5 事件归约：独立纯函数

```typescript
// src/ui/stores/chat-store.ts
export function reduceTurnEvent(state: ChatState, event: TurnEvent): ChatState
```

处理 11 种 TurnEvent（phase_start/phase_end/text_delta/reasoning/tool_start/tool_end/cold_layer_*/cold_skipped/error/done）。`pendingToolCalls: Map<string, string>`（callId → msgId）作为 state 一部分，不靠闭包。store action `dispatchEvent(event)` 一行实现：`set(state => reduceTurnEvent(state, event))`。可单测、可回放。

### 3.6 快照驱动：2s 轮询 + turn 事件即时刷新

agent 无事件订阅机制（无 EventEmitter），状态变化来自 runStream（turn）和 ContinuousLoop（30s tick）。策略：

- **2s 轮询兜底**：useAgentStore 内部 `setInterval(2s)` 拉 snapshot，捕获 ContinuousLoop 的静默 tick。
- **turn 事件即时刷新**：`done` / `phase_end(update_instant)` 时 useTurnStream 调 `refreshNow(agent)`，确保对话推进时 Dashboard 即时刷新。
- agent 层零改动。

### 3.7 主题层迁移：Context + bridge → store

`themeBridge`（模块级可变单例）只被 `commands/builtin/theme.ts` 一处引用（7 个调用点，机械替换）。迁移后：
- `useThemeStore` 为真相源，模块级单例。
- React 外命令直接 `useThemeStore.getState().loadPreset(...)`——天然跨边界，删 `themeBridge` + `syncThemeBridge`。
- 删 `theme/context.tsx`（ThemeProvider/useTheme/useThemeActions）。
- 现有 20+ 处 `useTheme()` 调用机械替换为 `useThemeStore(s => s.theme)`。

### 3.8 markdown 修复

`markdown.ts` → `markdown.tsx`：
- 输入：`(md: string, theme: ThemeConfig)`
- 输出：`React.ReactNode[]`
- 用 Ink 原生 props：`<Text bold>` / `<Text italic>` / `<Text dim>` / `<Text color={theme.colors.X}>` / `<Text backgroundColor={...}>`
- 覆盖现有 6 种语法（# 标题 / > 引用 / - * 列表 / ```代码块 / `内联代码` / **加粗** / *斜体*）
- 着色走 theme，不再硬编码终端色（`38;5;236` 等）

### 3.9 并发控制

`isGenerating` 标志在 useChatStore，InputArea 订阅它禁用输入。hook 启动流前置 true，done/error 置 false。第二次提交被 InputArea 挡掉。AbortController 留待后续（当前无中断 UI 入口）。

---

## 四、C 阶段：界面

### 4.1 终端画布约束

**宽屏优先**：≥100 列常驻仪表盘（右侧 40-44 列），对话区占左侧自适应宽度。
**窄屏降级**：<100 列隐藏仪表盘，仅状态栏 + 对话区 + 输入区。
**色彩**：256 色/真彩。

### 4.2 整体布局（宽屏）

```
┌─ 状态栏 ────────────────────────────────────────────────────┐
│ 林雨 第42轮  愉快+0.42 唤醒+0.18 掌控-0.10  饱和0.31  ⠹生成中│
├─────────────────────────────────────┬────────────────────────┤
│ 对话区 (自适应宽度)                 │ 仪表盘 (40-44列)       │
│                                     │ 双列分区                │
│ ┃ 你今天看起来不太开心              │ ┎左:内心─┒ ┎右:关系─┒  │
│ ┃ 想跟我说说吗                      │ ┃情绪  ┃ ┃关系  ┃      │
│                                     │ ┃稳态  ┃ ┃叙事  ┃      │
│   我感觉到你有些低落…               │ ┃心境  ┃ ┃心智  ┃      │
│   想跟我说说发生了什么吗？          │ ┃无聊  ┃ ┃记忆  ┃      │
│   ▣ 林雨 · 3.2秒                    │ ┃调节  ┃ ┃      ┃      │
│                                     │ ┖──────┚ ┖──────┚      │
│   [+] 内心独白 · 1.2秒              │ (Ctrl+J/K 同步翻页)    │
├─────────────────────────────────────┴────────────────────────┤
│ /dream /think /stats /help  (命令补全)                       │
│ > 输入消息... 回车发送                            (1-5行自适应)│
└──────────────────────────────────────────────────────────────┘
```

**对话区在左，仪表盘在右。**仪表盘内所有标题和标签均为中文。

### 4.3 仪表盘双列分区（无 tab，固定分区，全中文）

取消 tab 概念，所有心智模块固定分区同屏可见，消除"tab 切换"断线问题。内容超出高度时**同步翻页**（两列同步滚动）。**所有分区标题和标签均使用中文**，不出现英文缩写。

**左列 — 内心状态（秒-分变化）**：
- ▎情绪（情绪轮盘组件，见 4.5；副标"愉快/唤醒/掌控"三维）
- ▎稳态（5 维进度条：能量 / 唤醒 / 安全 / 连接 / 掌控）
- ▎心境（心境矩阵组件 4×3 网格；12 维中文名：平和 / 易怒 / 焦虑 / 活力 / 温暖 / 自信 / 感恩 / 骄傲 / 好奇 / 希望 / 敬畏 / 顽皮，按值降序取前 6）
- ▎无聊（无聊强度 + 认知参与度进度条）
- ▎饱和度 + 异稳态负荷（进度条）
- ▎调节（策略文本：重评 / 压抑 / 崩溃 + 崩溃标记）

**右列 — 人际关系（时-天-周变化）**：
- ▎关系（关系坐标图组件 2×2，见 4.5；4 维：信任 / 熟悉 / 回避 / 矛盾）
- ▎叙事（5 维进度条：代理感 / 共融感 / 救赎 / 污染 / 意义感）
- ▎心智理论（用户信念 / 用户欲望 / 用户意图，文本描述）
- ▎记忆（工作记忆 / 短期记忆 / 长期记忆 / 核心图 / 归档 各项计数）

### 4.4 消息样式（opencode 风格 + 情绪）

参考 opencode TUI 实现（OpenTUI/SolidJS），适配角色对话场景：

| 元素 | 用户消息 | 助手消息 |
|------|----------|----------|
| 容器 | `┃` 左边框色块（#CC7EB1 玫粉）+ 面板背景 | 无边框，paddingLeft=3 缩进流式块 |
| 内容 | 纯文本（无 markdown） | markdown 原生渲染（Ink `<Text>` props） |
| 页脚 | 底部时间戳（可选） | `▣ 角色名 · 3.2秒` |
| 分隔 | marginTop=1 空行 + 色块边界 | marginTop=1 空行 |

- **流式指示**：盲文 spinner `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` 80ms + "思考中..." 文案，无文本光标。
- **工具调用**：内联单行（图标 + 描述 + ✓/✗ + 耗时），可点击展开详情。
- **内心独白（推理过程）**：弱化块（暗色）+ `[+] 内心独白 · 1.2秒` 头，默认折叠，点击展开。保留"角色有内心活动"的存在感，不打断对话。

### 4.5 新增组件（3 个）

| 组件 | 数据 | 形态 | 位置 | 中文标签 |
|------|------|------|------|----------|
| 情绪轮盘 | 情绪三维 | 2D 散点（横轴=愉快 / 纵轴=唤醒 / 点大小=掌控） | 左列情绪区 | 愉快 / 唤醒 / 掌控 |
| 心境矩阵 | 心境 12 维 | 4×3 网格小型条形图 | 左列心境区 | 平和/易怒/焦虑/活力/温暖/自信/感恩/骄傲/好奇/希望/敬畏/顽皮 |
| 关系坐标图 | 关系 4 维 | 2×2 坐标（横轴=信任↔回避 / 纵轴=熟悉↔矛盾） | 右列关系区 | 信任 / 熟悉 / 回避 / 矛盾 |

现有组件（进度条 / 热力图 / 火花线）保留，暖色配色重做，标签中文化。

### 4.6 状态栏

```
林雨 第42轮  愉快+0.42 唤醒+0.18 掌控-0.10  饱和0.31  ⠹生成中
```

角色名 + 轮次 + 情绪简要（愉快/唤醒/掌控 三数字）+ 饱和度 + 生成状态。一眼可见角色当前情绪。

### 4.7 输入区

自适应高度：空时 1 行，输入增长自动扩展（最多 5 行），超 5 行可滚动。补全候选浮层在输入上方。

---

## 五、C 阶段：交互

### 5.1 键位/焦点体系

**输入框常驻焦点**（多行编辑需要按键）：
- `Enter` 发送
- `Alt+Enter` 换行
- `↑/↓` 历史导航
- `Tab` 补全确认

**鼠标**（需验证 Ink 兼容，见第九章）：
- 点击仪表盘分区 → 滚动定位
- 点击消息 → 展开操作菜单
- 滚轮 → 滚动对话区/仪表盘

**仪表盘滚动**（键盘后备）：
- `Ctrl+J/K` 上下翻页（鼠标不兼容时使用）
- `Esc` 回输入框/关闭浮层

### 5.2 消息菜单（点击触发）

四项操作：
- **编辑重发**：编辑该用户消息后重新发送，从该消息处重新生成后续
- **分支对话**：从该回复处分支新对话线，保留原始对话不变
- **重试**：用同一用户消息重新跑一轮
- **复制**：复制消息内容到剪贴板

这接上之前断线的 onRetry/onEdit/onBranch 回调，并新增复制。

### 5.3 斜杠命令

补全列表从 `commands/registry` 动态读（消除输入区硬编码死字符串）。补全浮层显示命令名 + 中文说明。现有命令：

| 命令 | 说明 |
|------|------|
| `/dream` | 进入梦境模式 |
| `/think` | 触发深度思考 |
| `/model` | 切换模型 |
| `/stats` | 查看状态统计 |
| `/help` | 显示帮助 |
| `/quit` | 退出 |
| `/theme` | 切换主题 |
| `/clear` | 清屏 |

---

## 六、C 阶段：美术（暖色暮色主题）

### 6.1 核心配色

| 角色 | 色值 | 用途 |
|------|------|------|
| primary | `#706CAA` 紫蓝 | 边框/标题/角色名/助手前缀 ▣ |
| secondary | `#F7DA94` 暖米黄 | 高亮/活跃值/强调 |
| accent | `#CC7EB1` 玫粉 | 用户消息边框/情绪标记 |
| background | `#2a1f1d` 深褐 | 背景（候选，实现时微调） |
| backgroundPanel | `#332624` | 面板/色块背景（候选） |
| success | `#8a9a5b` 苔绿 | 成功/✓ |
| warning | `#e6c229` 金 | 警告/⚠/spinner |
| error | `#c14646` 砖红 | 错误/✗ |
| text | `#d4c4c0` | 主文本 |
| textDim | `#6b5755` 暗灰 | 次要文本/时间戳 |

> 三个品牌色（#706CAA / #F7DA94 / #CC7EB1）为用户指定。辅助色（背景/success/warning/error/text/textDim）为候选值，实现时微调确保与品牌色和谐。主题预设写入 `theme/presets.ts`，替代现有 DEFAULT_THEME。

### 6.2 视觉元素

- **进度条**：`▓▓▓▓▒▒▒░░░` 三级质感（非 `█░`）
- **分隔线**：`┄┄┄┄┄` 虚线（非 `─────`）
- **边框**：`┃` 粗竖线
- **加载动画**：`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` 80ms 循环（盲文点旋转）
- **消息前缀**：用户 `┃`，助手 `▣`

---

## 七、死代码删除

| 文件/成员 | 动作 | 验证 |
|-----------|------|------|
| `src/ui/stream-renderer.ts` | 整删 | 全 repo 零引用（已核验） |
| `src/ui/span-renderer.ts` | 整删 | SpanState 零引用；SpanOp 类型在 generation/types.ts（已核验） |
| `src/ui/theme/bridge.ts` | 整删 | store 取代（7 调用点机械替换） |
| `src/ui/theme/context.tsx` | 整删 | store 取代（20+ useTheme 调用机械替换） |
| `src/ui/agent-state.ts` | 整删 | useAgentStore 取代 |
| `src/ui/history.ts` 的 up/down/search/resetCursor/atNewest | 删，保留 add | 零调用（已核验） |
| `src/ui/components/MultilineEditor.tsx` 的 displayWidth/charDisplayWidth import | 删 | 未使用（已核验） |

---

## 八、测试

B 阶段纯逻辑测试（3 文件），组件渲染测试留待 C 阶段可视化定型后补：

| 文件 | 测什么 |
|------|--------|
| `src/ui/stores/chat-store.test.ts` | `reduceTurnEvent`：11 种 event + 组合序列（text_delta 增量、tool_start/end 配对、done 清状态） |
| `src/ui/agent-factory.test.ts` | `createAgent`：provider 匹配（deepseek/anthropic/openrouter/ollama）+ env fallback |
| `src/ui/markdown.test.tsx` | `renderMarkdown`：6 种语法 → 节点结构断言（标题 bold、代码块 backgroundColor） |

---

## 九、风险与验证点

| 风险 | 验证方式 | 降级方案 |
|------|----------|----------|
| **zustand 在 Ink（react-reconciler）下兼容性** | B 阶段第一步：最小 smoke test（创建 store + 组件订阅 + render） | 不兼容则降级 useReducer + 自定义 hook，架构不受影响（可逆决策） |
| **Ink 鼠标支持** | C 阶段：smoke test useMouse/useStdin 鼠标事件 | 不兼容则降级 Ctrl+J/K 键盘滚动，消息菜单改用快捷键触发 |
| **辅助色与品牌色和谐度** | 实现时对比渲染效果 | 微调色值 |
| **双列分区宽度在 100-110 列终端下的体验** | 多终端宽度手动测试 | 必要时调整 Dashboard 宽度阈值或降级策略 |

---

## 十、实施顺序

### B 阶段（状态层地基）
1. zustand smoke test（确认 Ink 兼容）→ 不兼容则降级 useReducer
2. `agent-port.ts` + `agent-factory.ts`（接 provider-registry）
3. 三 store（chat/agent/theme）
4. `use-turn-stream.ts` + `reduceTurnEvent` 纯函数
5. 重写 `app.tsx`（薄壳）
6. `markdown.ts` → `markdown.tsx`
7. 删死代码 + 迁移所有 useTheme/themeBridge 引用
8. 写 3 测试文件
9. 手动验证：启动 TUI，跑一轮对话，确认行为无回归

### C 阶段（界面/交互/美术）
10. 暖色暮色主题写入 `presets.ts`
11. 3 个新组件（情绪轮盘/心境矩阵/关系坐标图）
12. Dashboard 双列分区重写
13. 消息组件重写（opencode 风格 + 情绪）
14. InputArea 自适应高度 + 补全对接 registry
15. StatusBar 情绪简要
16. 鼠标交互 smoke test → 接通或降级
17. 消息菜单（编辑重发/分支/重试/复制）
18. 内心独白折叠块
19. 手动验证全流程

详细计划由 writing-plans 产出。

---

## 十一、决策记录

经 grilling 流程逐个澄清的 29 个决策：

### B 阶段（Q1–Q13）
| # | 决策点 | 选择 |
|---|--------|------|
| Q1 | 重构目标 | B 分阶段→C |
| Q2 | B 范围 | 状态层 + 死代码 + markdown；断线交互推迟到 C |
| Q3 | 消息状态管理 | zustand |
| Q4 | 快照驱动 | 2s 轮询兜底 + turn 事件即时刷新 |
| Q5 | store 形态 | 三独立 store（chat/agent/theme） |
| Q6 | 主题层 | 迁 store，删 bridge/context |
| Q7 | app.tsx 拆解 | 工厂 + AgentPort 接口（5 方法） |
| Q8 | 事件归约 | 独立纯函数 reducer + store action 调用 |
| Q9 | markdown 修复 | 输出 React 节点，Ink 原生 props |
| Q10 | 死代码清单 | 7 项（已核验耦合） |
| Q11 | 测试范围 | 纯逻辑测试 3 文件 |
| Q12 | 并发控制 | isGenerating 标志挡重入，AbortController 留待后 |
| Q13 | 通知归属 | 归 chat store，保持现状行为不加去重 |

### C 阶段（Q14–Q28）
| # | 决策点 | 选择 |
|---|--------|------|
| Q14 | 界面改动方向 | D 整体重做，以 v4 心智可视化为驱动 |
| Q15 | 终端画布 | A 宽屏优先 ≥100 列，窄屏降级纯聊天 |
| Q16 | Dashboard 布局 | 双列分区 40-44 列 |
| Q17 | tab 机制 | 固定分区无 tab |
| Q18 | 分区编排 | 左内（情绪/稳态/心境/无聊/饱和/调节）右外（关系/叙事/ToM/记忆） |
| Q19 | 消息样式 | opencode 风格 + 情绪标记 |
| Q20 | 输入区 | 自适应高度 1-5 行 + 补全浮层 |
| Q21 | StatusBar | 角色名+轮次+PAD简要+饱和度+生成状态 |
| Q22 | 键位/焦点 | 输入框常驻 + 鼠标（需验证 Ink 兼容） |
| Q23 | 消息菜单 | 编辑重发/分支对话/重试/复制 |
| Q24 | 视觉基调 | 暖色暮色，#706CAA/#F7DA94/#CC7EB1 |
| Q25 | widget | 现有3种 + 情绪轮盘/心境矩阵/关系坐标图 |
| Q26 | Dashboard 滚动 | 同步翻页 |
| Q27 | 内心独白 | 默认折叠弱化块，点击展开 |
| Q28 | 斜杠命令 | 补全从 registry 动态读，不硬编码 |
| Q29 | 布局位置 | ChatArea 在左，Dashboard 在右 |

---

*Character Mind 前端重构设计 · 2026-07-01*
