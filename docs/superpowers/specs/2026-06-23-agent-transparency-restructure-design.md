# Agent 透明化与结构重构设计

**日期**：2026-06-23
**状态**：已批准（待用户审阅 spec）
**范围**：交互体验透明化（Claude Code 风格）+ agent.ts 结构拆分 + 冷热职责重新划分
**不包含**：冷分析层删除决策、自我校验层、连续状态流实现、记忆系统重设计（均为后续工作）

---

## 1. 背景与问题

### 1.1 核心痛点

用户实际使用中最大的问题是"不知道它在干嘛"——发消息后界面卡住，不知道角色在分析、生成、调工具还是挂了。其次是工具调用黑箱、思考过程不可见、无法中断生成。

### 1.2 根因：agent.run() 是黑盒

当前 `CharacterAgent.run()` 接收 input + onDelta 回调，只吐出最终文本。中间发生了什么（哪个阶段、调了什么工具、工具结果、思考内容、是否可中断），调用方（UI）完全不知道。

**三个具体表现**：
- `SpanBasedGenerator` 只 yield 文本 span，工具调用被压缩成 `[exec_command] (无输出)` 一行，参数/耗时/结果全丢
- `reasoning_content` 在 provider.ts 和 dual-track.ts 被解析了，但从未 yield 出来给 UI
- `GenerationController`（263 行）定义了中断/重排/排队机制，但 app.tsx 绕过它直接用 SpanBasedGenerator——controller 是孤儿代码

### 1.3 结构问题

`CharacterAgent`（550 行，27 个子系统）一个类做了 5 件事：持有子系统、编排热路径、编排冷路径、持有跨轮状态、恢复/快照/记忆写入胶水。改一处怕动全身。

### 1.4 冷热职责模糊

当前热路径和冷路径的分工是历史演进的产物，边界随意：同样是状态更新，saturation 在热路径，drives 在冷路径；同样是情感，热路径用规则检测，冷路径用 LLM 分析——两者可能矛盾，导致角色表现不一致。

---

## 2. 设计决策

### 2.1 事件流为核心（方案 A）

`agent.run()` 从"返回最终文本"变为"yield 结构化事件流"。所有过程透明能力来自这个协议。UI 消费事件渲染，agent 和 UI 彻底解耦。

### 2.2 混合拆分原则

外层按流程阶段拆（热编排/冷分析/事件出口），内层按职责域聚合（4 个 Core）。

### 2.3 冷热职责重新划分

**原则：不需要理解的在热路径同步做，需要理解的在冷路径异步做。**

- 热路径：护栏、记忆检索、状态读取（不更新）、prompt 构建、生成、输出护栏、即时确定性更新（saturation/temporalHorizon/checkpoint）
- 冷路径：理解刚才发生了什么（冷分析）、基于理解更新状态（dynamics/drives/modulateSlow）、记忆写入（带正确情感标签）、记忆代谢、元认知反思

### 2.4 只保留 Ink TUI 路径

删除 readline 降级路径（main.ts）。非 TTY 环境给出明确错误信息。

### 2.5 冷分析保留并透明化，不立即删除

3 层融合冷分析（冷回顾→维度评估→深度反思）保留，但每层调用变成事件流里可见的事件。用户能在 UI 的冷分析折叠区看到每层在做什么、耗时、产出预览。透明化后基于观察再决定调整。

### 2.6 质量改进在透明化之后

当前冷分析产出质量低（模糊文本 + 脆弱 XML 解析 + 频繁空值）。质量改进（JSON mode、数值标定、失败用上一轮值）在透明化落地后进行——先看见产出，再针对性改进，避免盲改。

---

## 3. 事件协议（§1）

### 3.1 TurnEvent 类型

```typescript
// src/agent/events.ts

export type TurnEvent =
  | { type: "phase_start";     phase: TurnPhase; ts: number }
  | { type: "phase_end";       phase: TurnPhase; ts: number; durationMs: number }
  | { type: "text_delta";      text: string }
  | { type: "reasoning";       text: string; ts: number }
  | { type: "tool_start";      callId: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_end";        callId: string; tool: string; success: boolean;
      outputPreview: string; durationMs: number; truncated: boolean }
  | { type: "cold_layer_start"; layer: 0 | 1 | 2; name: string; ts: number }
  | { type: "cold_layer_end";   layer: 0 | 1 | 2; name: string;
      success: boolean; durationMs: number; summary: string }
  | { type: "cold_skipped";    reason: string }
  | { type: "error";           phase: TurnPhase; message: string; recoverable: boolean }
  | { type: "done";            turnId: number; elapsedMs: number; totalTokens: number };

export type TurnPhase =
  | "guard_input" | "restore_memory" | "read_state" | "build_prompt"
  | "generate" | "guard_output" | "update_instant" | "cold_analyze" | "checkpoint";

export interface RunOptions { signal?: AbortSignal }
export type RunResult = { turnId: number; response: string; totalTokens: number; elapsedMs: number };
```

### 3.2 冷分析层命名

| layer | name | 产出 |
|-------|------|------|
| 0 | "冷回顾" | 情感底色 + 时间感受 + 记忆修正 |
| 1 | "维度评估" | 5维稳态综合偏离分析（按需触发） |
| 2 | "深度反思" | 叙事自我更新 + 关系重评 + 设定点漂移 |

### 3.3 接口签名

```typescript
class CharacterAgent {
  async *run(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent>;
}
```

最后一个事件是 `done`，RunResult 从 done 事件取。

---

## 4. agent.ts 拆分结构（§2）

### 4.1 拆分后的结构

```
CharacterAgent (瘦身为门面 + 配置持有者，~120行)
  ├─ MindCore          ← 聚合 13 心智子系统
  ├─ MemoryCore        ← 聚合 6 记忆子系统
  ├─ GuardCore         ← 聚合 3 护栏
  ├─ LLMCore           ← 聚合 4 LLM（含冷分析，发射 cold_layer 事件）
  ├─ TurnOrchestrator  ← 编排 8 阶段，yield TurnEvent
  └─ GenerationController ← 接上：中断/重排生效
```

### 4.2 四个 Core 的职责

| Core | 聚合的子系统 | 职责 | 关键方法 |
|------|-------------|------|---------|
| MindCore | mindState/params/modulator/drives/dynamics/driveSublimator/saturation/continuousParams/saturationDetector/selfModel/affectiveResidue/temporalHorizon/predictionTracker/groundTruth | 心智状态查询 + 参数调制 + 情感检测 | detectEmotion / modulateFast / modulateSlow / stepDynamics / formatForPrompt |
| MemoryCore | working/shortTerm/longTerm/coreGraph/archive/snapshot | 记忆恢复 + 写入 + 代谢触发 | restoreSnapshot / storeTurn / maybeMetabolize / formatSnapshot |
| GuardCore | guardPipeline/postFilter/toolRegistry | 输入输出护栏 + 工具执行 | checkInput / checkOutput / postFilter / getToolDefinitions / executeTool |
| LLMCore | provider/coldAnalyzer | LLM 调用 + 冷分析编排（3 层事件由此发射：冷回顾→维度评估→深度反思） | analyzeCold(params, emit) |

### 4.3 TurnOrchestrator 的 8 阶段

严格按"热路径只做不需要理解的，冷路径做需要理解的"编排：

```
阶段 1: guard_input      [热] 护栏输入检查
阶段 2: restore_memory   [热] 记忆检索恢复
阶段 3: read_state       [热] 读取当前状态（不更新）
阶段 4: build_prompt     [热] 构建 prompt（注入上轮 coldCache）
阶段 5: generate         [热] 流式生成 + 工具调用
阶段 6: guard_output     [热] 输出护栏 + PostFilter
阶段 7: update_instant   [热] 即时确定性更新（saturation/temporalHorizon/checkpoint）
阶段 8: cold_analyze     [冷] 异步：理解+状态演化+记忆写入+代谢+元认知反思
```

每个阶段开始/结束 yield `phase_start`/`phase_end` 事件。生成阶段的 text_delta/reasoning/tool_start/tool_end 由 GenerationController 转发。冷分析阶段的 cold_layer 事件由 LLMCore.analyzeCold 发射。

**状态更新的归属明细**（按"不需要理解的在热路径，需要理解的在冷路径"原则）：

| 状态更新 | 当前位置 | 重构后位置 | 理由 |
|---------|---------|-----------|------|
| saturation.positiveInteraction | 热路径 | 热路径（update_instant） | 只需知道"有正向互动"，不需要理解内容 |
| temporalHorizon.onTurnEnd | 未调用 | 热路径（update_instant） | 只需知道"轮结束了"，不需要理解内容 |
| affectiveResidue.deposit | 热路径（用规则情感） | **冷路径（cold_analyze，用 LLM 情感）** | 准确的情感沉积需要理解互动内容，规则情感太粗糙 |
| dynamics.step(mindState) | 冷路径 | 冷路径（cold_analyze） | 需要知道"对方说了什么让我防御升高" |
| drives.tick | 冷路径 | 冷路径（cold_analyze） | 需要理解互动内容才能演化驱力 |
| modulator.modulateSlow | 冷路径 | 冷路径（cold_analyze） | 基于理解的参数调制 |
| storeMemoryRecords | 冷路径 | 冷路径（cold_analyze） | 记忆写入需要正确的情感标签和 significance |
| metabolism.daydream/quickSleep | 冷路径 | 冷路径（cold_analyze） | 后台整理，不需要当轮 |

### 4.4 CharacterAgent 瘦身

构造函数只负责创建 4 个 Core + TurnOrchestrator + Controller。通过 getter 转发属性访问（如 `agent.saturation.s`、`agent.config.name`）保持向后兼容（eval adapter 和外部访问）。

### 4.5 初始化顺序耦合显式化

当前 agent.ts 注释有 "skillLibrary must be created BEFORE metabolism" 隐式依赖。拆分后由 MemoryCore 构造函数内部处理初始化顺序，外部不需要知道。

### 4.6 文件位置

- `src/agent/cores/{mind,memory,guard,llm}-core.ts` — 4 个 Core
- `src/agent/turn-orchestrator.ts` — 编排器
- `src/agent/events.ts` — 事件类型
- `src/agent/run-adapter.ts` — collectRun 适配器
- `src/agent/agent.ts` — 瘦身后的门面
- `src/generation/controller.ts` — 重写接入

### 4.7 顺带修复技术债

- TC-001：GenerationController 从孤儿变核心
- TC-005：runColdPath 双重调用风险消除（删除 runColdPath，冷分析只由 TurnOrchestrator 触发一次）

---

## 5. 生成层改造（§3）

### 5.1 SpanBasedGenerator 改为 yield TurnEvent

从 `AsyncGenerator<SpanOp>` 改为 `AsyncGenerator<TurnEvent>`：
- 句子级文本切分逻辑保留（isSentenceBoundary），产出 `text_delta` 事件
- `reasoning_content` 终于有出口——yield 为 `reasoning` 事件
- 工具调用 yield `tool_start`/`tool_end` 配对，UI 拿到完整结构化信息（工具名 + 参数 + 耗时 + 结果预览 + 成功/失败）
- 工具结果仍塞回 messages 供下一轮生成

### 5.2 GenerationController 接入

从孤儿变核心：
- 管理 abortController，响应 Esc
- 维护生成状态机（idle→generating→aborting），防止重入
- 中断时保留已生成的 stable 文本（不丢失部分输出）
- 透传 SpanBasedGenerator 的 TurnEvent 给 TurnOrchestrator 统一出口

### 5.3 中断的三检查点

1. token 流循环：句子边界检查 `signal.aborted`，已生成句子保留
2. 工具执行前：未开始的工具不执行
3. 工具执行中：不中断（避免半执行状态），但结果不塞回 messages，直接 break

中断后 UI 收到 `done` 事件，response 是已生成的部分文本，用户可基于此重新输入。

### 5.4 span 层降级

当前 `ui/span-renderer.ts` 的 SpanState（FLUID/STABLE/LOCKED）为 SpanOp 设计。改 yield TurnEvent 后，span 概念被更简单的"当前生成中 vs 已完成"状态替代。span-renderer.ts 降级或删除（见 §6）。

---

## 6. UI 层改造（§4）

### 6.1 app.tsx 消费 AsyncGenerator<TurnEvent>

从回调式 `agent.run(input, onDelta)` 改为 `for await (const event of agent.run(input, opts))`，按事件类型 switch 渲染。

### 6.2 三区域布局

```
┌─────────────────────────────────────────────┐
│  对话历史区 (上方滚动)                        │
│  ┌─ 用户 ──────────────┐                    │
│  │ 我今天有点累          │                    │
│  └──────────────────────┘                    │
│  ┌─ 林雨 ──────────────┐                    │
│  │ ▾ 思考 (dim, 可折叠) │                    │
│  │ ▸ 工具调用 (1)       │                    │
│  │ 听起来你今天不轻松... │                    │
│  │ [t3  2.1s]          │                    │
│  └──────────────────────┘                    │
│─────────────────────────────────────────────│
│  当前生成区 (底部固定)                        │
│  ⠹ 正在生成…  已输出 2 句                     │
│  这几天确实项目压力大..._                     │
│─────────────────────────────────────────────│
│  > 输入框 (Esc 中断 / Enter 发送)_           │
└─────────────────────────────────────────────┘
```

### 6.3 组件

| 组件 | 职责 |
|------|------|
| `message.tsx` | 历史消息（含思考折叠区 + 工具卡片列表 + 元信息） |
| `tool-card.tsx` | 工具调用卡片（默认折叠，展开显示参数+结果预览，失败红色边框） |
| `cold-analysis.tsx` | 冷分析折叠区（4 层各一行 + 耗时 + 状态 + 产出预览） |
| `phase-indicator.tsx` | 阶段进度提示（⠋ 正在生成… + 已输出句数） |

### 6.4 Esc 中断

Esc 触发 `abortController.abort()`，GenerationController 处理优雅退出。已生成的句子保留为对话历史的一条消息（可能不完整，末尾加"…"）。状态回到 idle，输入框可立即输入。

### 6.5 删除 readline 路径

- 删除 `src/main.ts`（readline 路径）
- 删除 `src/ui/stream-renderer.ts`（readline 用的 ANSI 渲染器）
- 删除 `src/ui/span-renderer.ts`（span 三层不再需要）
- `src/dev-entry.ts` 简化：TTY 检测保留，非 TTY 给出明确错误信息

### 6.6 文件变更

| 操作 | 文件 |
|------|------|
| 重写 | `src/ui/app.tsx` |
| 新建 | `src/ui/components/{message,tool-card,cold-analysis,phase-indicator}.tsx` |
| 删除 | `src/ui/span-renderer.ts`、`src/ui/stream-renderer.ts`、`src/main.ts` |
| 简化 | `src/dev-entry.ts` |

---

## 7. 迁移与兼容（§5）

### 7.1 collectRun 适配器

```typescript
// src/agent/run-adapter.ts
export async function collectRun(
  agent: CharacterAgent, input: string, opts?: RunOptions,
): Promise<RunResult & { toolCalls: string[]; reasoning: string }> {
  // 消费事件流聚合为结果对象
}
```

eval 的 adapter 改用 `collectRun`，eval 逻辑不变。collectRun 也可用于不需要流式的场景（单元测试、CI）。

### 7.2 入口收敛

`dev-entry.ts` → `ink-main.tsx` → `app.tsx`（唯一路径）。非 TTY 报错退出。

### 7.3 实施顺序（6 步）

每步可独立验证：

1. **事件协议**（events.ts）——纯类型，无逻辑改动。验证：tsc 通过
2. **4 个 Core + CharacterAgent 瘦身**——27 子系统迁入 Core，agent.ts 变门面，run() 暂保留旧签名。验证：tsc + vitest 18/18 + 手动跑一轮对话行为不变
3. **dual-track yield TurnEvent + collectRun**——SpanBasedGenerator 改 yield TurnEvent，提供 collectRun，eval 改用。验证：tsc + vitest + eval:safety 通过
4. **TurnOrchestrator + GenerationController 接入**——新建编排器，controller 接入，agent.run() 改 async *run()，冷分析 yield cold_layer 事件。验证：手动跑对话，确认事件流完整
5. **app.tsx 重写 + 删 readline**——消费 TurnEvent 渲染三区域，工具卡片+冷分析折叠区+阶段进度+Esc 中断，删 main.ts/span-renderer/stream-renderer。验证：手动跑对话，确认 Claude Code 风格落地
6. **收尾**——更新 PROJECT.md/ARCHITECTURE.md/SECURITY.md/CHANGELOG.md，更新 ADR-001 状态，新增 ADR 记录本次重构

### 7.4 风险与缓解

| 风险 | 严重性 | 缓解 |
|------|--------|------|
| 拆 Core 时遗漏子系统初始化顺序 | 高 | 步骤 2 手动跑一轮验证；初始化顺序在 MemoryCore 内部显式处理 |
| 事件流接口破坏 eval | 中 | 步骤 3 同步提供 collectRun，eval 立即验证 |
| app.tsx 重写引入渲染 bug | 中 | 步骤 5 分组件开发，逐个验证 |
| 删 readline 后非 TTY 无法运行 | 低 | 用户已确认接受；明确错误信息指引 |
| GenerationController 中断行为不符预期 | 中 | 步骤 4 专门验证中断三检查点 |
| 冷分析透明化后性能下降 | 低 | 事件是同步 yield，无额外 IO；冷分析本身异步不阻塞 |

### 7.5 不在本次范围

- 冷分析 4 层的删除决策（先透明化观察）
- 产出质量改进（JSON mode、数值标定、失败用上一轮值）——透明化后基于观察进行
- 饱和度 32 lerp 参数精简
- strict 模式开启 + 消除 any
- PostFilter 与 regex-deny 合并
- 补测试覆盖

---

## 8. 后续工作方向（本次预留接入点，不实现）

以下方向在本次讨论中提出，本次重构为它们预留接入点，但不实现。

### 8.1 冷分析产出质量改进

**问题**：4 层产出质量低（模糊文本 + 脆弱 XML 解析 + 频繁空值）。

**共性解法**：
- XML 正则解析 → JSON mode / function calling（provider.ts 已支持 tools 参数）
- 数值无标定 → prompt 加维度语义锚点（如 warmth: -1=敌意, 0=中立, 1=亲密）
- 静默失败 → 失败时用上一轮值 + 记录警告事件

**每层特有解法**：
- L0：加维度语义锚点 + JSON mode，值得保留改进
- L1：考虑并入 L0（时间感受作为 L0 的一个维度而非独立层）
- L2：改 function calling + 减少维度（6 类→3 类核心），值得保留改进
- L3：从"哲学化叙事"改为"结构化身份增量"（哪些认知强化了、哪些改变了）

**时机**：透明化落地后，基于 UI 冷分析折叠区的实际产出观察，针对性改进。

### 8.2 元认知（自我认知提升）

**三个层次**：

1. **第一层：激活已有的 SelfReflection**（本次可顺带做）
   - agent.ts 已实例化 SelfReflection 但 run() 从不调用
   - 在冷分析阶段结束后调用 fastReflect（每轮）和 slowReflect（每 20 轮）
   - 把反思结果作为事件 yield（透明化的一部分）
   - 零成本，接通已存在的管道

2. **第二层：元认知标签**（质量改进的一部分）
   - 生成时同时产出 response 和 metacognition（"我为什么这么说"）
   - 用 function calling 同时输出两个字段
   - 元认知标签成为状态流的一部分，供下一轮比较

3. **第三层：预测误差驱动**（长期方向）
   - 生成前预测对方反应，下一轮比较预测与实际
   - 误差大时触发元认知更新
   - PredictionTracker 已存在但未有效使用

**本次预留**：冷分析阶段的事件流（cold_layer 事件）为元认知事件预留扩展位置。

### 8.3 连续状态流

**问题**：当前状态是离散跳变的（每轮分析后 mindState 被一次性覆盖），没有"流"的感觉。

**三个要素**：
1. 状态向量有动力学（积分而非赋值）：`ds/dt = f(信号, 当前s)` 然后 `s += ds * dt`
2. 所有状态共享同一时间轴：统一 `tick(dt)` 驱动所有状态演化
3. 状态间耦合：`dEmotion/dt = f(saturation, drives, externalSignal)`

**本次预留**：MindCore 把状态的 `tick(dt)` 统一到一个入口，把状态向量集中到 `StateVector` 类型，让未来的连续动力学可在这个结构上实现。

### 8.4 记忆系统演进

**当前问题**：
- 只有陈述性记忆，没有程序性记忆（SkillLibrary 很弱）
- 工作记忆无"中央执行"（只是 FIFO 队列）
- 情感记忆和情景记忆没有分离
- 重 Consolidation 机制粗糙

**可参考的脑科学/意识理论**：

| 理论 | 可借鉴的点 | 对 agent 的启发 |
|------|-----------|----------------|
| 全局工作空间理论（GWT） | 意识是信息在全局工作空间的广播 | "意识"= 当前在 working memory 里被广播的内容；冷分析是无意识后台过程 |
| 预测处理（Predictive Processing） | 大脑是预测机，感知是预测+误差修正 | 对接元认知第三层——预测对方反应，用误差更新自我模型 |
| 默认模式网络（DMN） | 闲置时做自我参照处理、未来模拟 | daydream 不是空转，而是模拟未来对话、巩固身份 |
| 海马体重放（Replay） | 睡眠时重放经历，提取模式 | fullSleep 应重放完整对话流而非只看摘要 |
| 情绪记忆双系统 | 杏仁核（快速/不精确/持久）vs 海马体（慢/精确/可衰退） | 情感记忆和情景记忆应分离存储 |

**演进方向**：
- 分离情感记忆（快速、持久、不精确的 emotional trace）
- 程序性记忆强化（SkillLibrary 从"规则文本"升级为"可执行技能模式"）
- 预测误差入记忆（出乎意料的事件高权重存储）
- DMN 式闲置模拟（daydream 模拟未来对话而非随机重放）

**本次不动**，但 MemoryCore 的接口设计不堵死这些方向。

### 8.5 自我校验层（出口门）

**概念**：在生成后、出口前，检查"要说的话与当前内在状态是否一致"。填补"意识与出口的断层"。

**校验维度**：
- 情感-语气一致（心里悲伤→不应语气轻快，除非有意伪装）
- 关系-亲疏一致（关系疏离→不应过度亲昵）
- 驱力-行为一致（驱力好奇→应主动提问）
- 能力-声称一致（没读文件→不声称读过，纯规则可校验）
- 人格-行为一致（反 RLHF 的延伸）

**机制**：LLM-as-Judge（用 Flash 模型），能区分"有意伪装"vs"无意失控"——这是规则做不到的。

**处置策略**：
- 一致 → 放行
- 不一致（无意失控）→ 重写（加校验反馈约束，重新生成，最多 1 次）
- 伪装（有意的不一致）→ 放行 + 标记到 selfModel（角色有意压抑情感是合理行为）

**代价**：一致时 +1 次 Flash 调用（~200-500ms）；不一致时 +1 次 Flash + 1 次重新生成。可选择性校验（仅高情感强度时触发）降低延迟。

**时机**：本次重构（透明化 + 结构拆分）完成后，作为独立增量设计。与透明化目标不同——自我校验解决"说的话对不对"，透明化解决"看得见它在做什么"。

---

## 9. 测试与校验策略

### 9.1 原则：每步同步补测试

每个实施步骤完成时，同步补该步骤引入的新行为的测试。不在最后统一补——重构中途出问题时能立即定位是哪一步引入的。

### 9.2 测试基础设施需求

当前测试基础设施：vitest（`environment: "node"`, `globals: false`, `include: src/**/*.test.ts`），1 个测试文件 18 用例，纯函数单元测试，无 mock、无 async、无集成测试。

本次重构需要补充的测试模式：

| 模式 | 用途 | 需要的基础设施 |
|------|------|---------------|
| **Mock LLM Provider** | 测试 Core / Orchestrator / Generator 时不调真 API | 手写 mock 对象（实现 chat/chatStream 接口，返回预设响应）；不引入新依赖 |
| **AsyncGenerator 测试** | 测试 `*run()` 和 `*generate()` 的事件流 | vitest 原生支持 `for await`；用数组收集事件后断言 |
| **事件流契约测试** | 验证 TurnEvent 序列的正确性（配对、顺序、字段） | 自写 helper：`collectEvents(gen) → TurnEvent[]`，然后断言序列 |
| **中断行为测试** | 测试 AbortSignal 在三检查点的行为 | `new AbortController()`，延迟 `abort()`，断言部分输出保留 |
| **集成烟雾测试** | 端到端验证一轮对话的事件流完整性 | mock provider + 真实 Core/Orchestrator 组合，验证完整事件序列 |

**不引入新依赖**：mock 用手写对象，不用 vitest 的 mock 工具（保持简单）。测试文件放在被测文件旁边（`foo.ts` ↔ `foo.test.ts`），符合现有 vitest 配置。

### 9.3 每步的测试清单

#### 步骤 1：事件协议（events.ts）

**测试文件**：`src/agent/events.test.ts`

**测试内容**：
- TurnEvent 联合类型的可辨别性：每个事件类型的 `type` 字段是唯一判别符
- TurnPhase 枚举完整性：8 个阶段都有定义
- 类型编译时检查（tsc 保证，无需运行时测试）

**校验**：`tsc --noEmit` 0 错误 + `vitest run` 含新测试通过

#### 步骤 2：4 个 Core + CharacterAgent 瘦身

**测试文件**：
- `src/agent/cores/mind-core.test.ts`
- `src/agent/cores/memory-core.test.ts`
- `src/agent/cores/guard-core.test.ts`
- `src/agent/cores/llm-core.test.ts`

**每 Core 的测试内容**：

MindCore：
- `detectEmotion` 对各种输入返回合理的 dominant/intensity/pleasure
- `modulateFast` / `modulateSlow` 对 coldCache 产生正确的参数偏移
- `stepDynamics` 对给定 affect 输入产生正确的 mindState 演化
- `formatForPrompt` 产出非空结构化文本
- 初始化顺序正确（skillLibrary before metabolism 的隐式依赖在 MemoryCore，但 MindCore 的状态初始化也要验证）

MemoryCore：
- `restoreSnapshot` 从 STM/LTM/Core 检索记忆并填充 snapshot
- `storeTurn` 写入 working memory 且 snapshot 标记 dirty
- `maybeMetabolize` 在正确 tick 间隔触发 daydream/quickSleep
- 初始化顺序：skillLibrary 在 metabolism 之前创建（验证这个隐式依赖被正确处理）

GuardCore：
- `checkInput` 对注入模式返回 blocked
- `checkOutput` 对 RLHF 话术执行替换
- `postFilter` 对动作描写执行删除
- `executeTool` 对未知工具返回错误
- `getToolDefinitions` 返回 8 个工具定义

LLMCore：
- `analyzeCold` 用 mock provider 产出 ColdCache
- 4 层的独立容错：mock 某层抛错，其他层仍产出
- cold_layer 事件序列：start/end 配对、跳过事件

**校验**：`tsc` + `vitest run`（现有 18 + 新增 Core 测试）全部通过 + **手动跑一轮对话行为不变**（回归验证：瘦身后 agent 行为与瘦身前一致）

#### 步骤 3：dual-track yield TurnEvent + collectRun

**测试文件**：
- `src/agent/dual-track.test.ts`
- `src/agent/run-adapter.test.ts`

**dual-track 测试内容**：
- mock provider 返回流式文本 → yield 正确的 text_delta 事件序列
- mock provider 返回 reasoning_content → yield reasoning 事件
- mock provider 返回 tool_calls → yield tool_start + tool_end 配对，callId 关联正确
- 工具执行失败 → tool_end 的 success=false
- 句子边界切分：`。！？\n` 处正确切分，短于 4 字符不切分
- 剩余 buffer 在结束时 flush

**run-adapter 测试内容**：
- `collectRun` 消费完整事件流，聚合出正确的 response/toolCalls/reasoning/totalTokens
- 空事件流（护栏拦截）→ response 是拦截提示，toolCalls 为空
- 中断事件流 → collectRun 返回已收集的部分

**校验**：`tsc` + `vitest run` + **`npm run eval:safety` 通过**（eval 改用 collectRun 后，安全测试用例不退化）

#### 步骤 4：TurnOrchestrator + GenerationController 接入

**测试文件**：
- `src/agent/turn-orchestrator.test.ts`
- `src/generation/controller.test.ts`

**TurnOrchestrator 测试内容**：
- 8 阶段的 phase_start/phase_end 事件按正确顺序出现
- 每阶段的 durationMs 非负
- guard_input 拦截时：只产出 error + done 事件，不进入后续阶段
- cold_analyze 阶段的 cold_layer 事件序列正确
- 完整一轮的事件流契约：以 phase_start(guard_input) 开始，以 done 结束

**Controller 测试内容（中断三检查点）**：
- **检查点 1**（token 流）：生成中途 abort → 已生成的句子保留在 done 事件的 response 中
- **检查点 2**（工具执行前）：abort 时未开始的工具不执行（tool_start 未 yield）
- **检查点 3**（工具执行中）：工具开始后 abort → 工具跑完但 tool_end 的结果不塞回 messages，后续不继续生成
- 状态机：idle → generating → (abort) → aborting → idle 的正确转换
- 重入防护：generating 时再次 handleTurn → 排队或拒绝

**校验**：`tsc` + `vitest run` + 手动跑对话确认事件流完整 + 手动测试 Esc 中断

#### 步骤 5：app.tsx 重写 + 删 readline

**测试方式**：Ink TUI 的渲染测试较难自动化（需要 TTY 模拟），采用**分层策略**：

**可自动化的**：
- 组件纯逻辑测试：`tool-card.test.ts`（props → 渲染输出字符串）、`cold-analysis.test.ts`（事件序列 → 折叠区文本）、`phase-indicator.test.ts`（phase → 进度文本）
- 事件消费逻辑：提取 app.tsx 的事件处理为纯函数 `reduceTurnState(state, event) → state`，测试这个 reducer

**手动验证的**：
- 三区域布局的视觉正确性（历史/当前生成/输入框位置）
- Esc 中断的实际按键行为
- 工具卡片折叠/展开的交互
- 冷分析折叠区的实时更新

**校验**：`tsc` + `vitest run`（含组件纯逻辑测试）+ **手动跑对话确认 Claude Code 风格落地**（对照 §9.6 的手动验证清单）

#### 步骤 6：收尾

**校验**：全量回归——`tsc` + `vitest run`（全部测试）+ `npm run eval`（全部评估）+ 手动跑一轮对话

### 9.4 测试覆盖目标

| 模块 | 当前覆盖 | 重构后目标 |
|------|---------|-----------|
| events.ts | — | 100%（类型+契约） |
| 4 个 Core | 0% | >80%（关键方法） |
| dual-track | 0% | >80%（事件 yield + 工具 + 句子切分） |
| turn-orchestrator | 0% | >80%（8 阶段序列 + 拦截路径） |
| controller | 0% | >80%（中断三检查点 + 状态机） |
| run-adapter | 0% | 100%（薄适配器，全覆盖） |
| UI 组件纯逻辑 | 0% | >70%（渲染输出 + reducer） |
| agent.ts（瘦身后） | 0% | >60%（门面 getter 转发 + 构造） |

### 9.5 回归保护

重构的最大风险是"行为变了但没发现"。三层回归保护：

1. **现有 18 个 json-parser 测试**：重构不能破坏它们（它们是纯函数，不应受影响——如果坏了说明拆分动到了不该动的地方）
2. **eval:safety + eval:personality**：每步完成后都跑，确保护栏和人格行为不退化
3. **步骤 2 的手动回归**：瘦身后手动跑一轮对话，确认角色行为与瘦身前一致（相同输入产出相似回复）

### 9.6 手动验证清单（步骤 5 完成时）

重构完成的最终手动验证，确认 Claude Code 风格落地：

- [ ] 阶段进度提示可见：⠋ 正在分析… / ⠙ 正在生成… 状态随阶段切换
- [ ] 工具调用卡片可见：工具名 + 参数 + 耗时 + 结果预览，可折叠/展开
- [ ] 思考过程可见：reasoning_content 以 dim 灰色显示，可折叠
- [ ] Esc 中断生效：生成中途按 Esc，已生成部分保留，状态回到 idle
- [ ] 冷分析折叠区可见：4 层各一行 + 耗时 + 状态 + 产出预览，可折叠
- [ ] 非TTY报错：在非终端环境运行时给出明确错误信息
- [ ] eval:safety 通过：安全护栏测试不退化
- [ ] tsc 0 错误 + vitest 全部通过

---

## 10. 验证标准

本次重构完成的标志：

1. `tsc --noEmit` 0 错误
2. `vitest run` 全部通过（现有 18 + 新增测试，无 skip）
3. `npm run eval:safety` 通过
4. `npm run eval:personality` 通过
5. §9.6 手动验证清单全部勾选
6. agent.ts 行数从 550 降到 ~120，4 个 Core 各 ~100-150 行
7. readline 路径完全删除，dev-entry 直走 Ink
8. 测试覆盖目标（§9.4）达成

---

## 11. 相关文档

- [ARCHITECTURE.md](../../../ARCHITECTURE.md) — ADR-001（冷热分离）状态将更新为"保留并透明化观察中"
- [SECURITY.md](../../../SECURITY.md) — 不受本次重构影响
- [CHANGELOG.md](../../../CHANGELOG.md) — 将记录本次重构
