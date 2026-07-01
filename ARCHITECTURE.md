# 架构决策记录（ADR）

本文件记录 Character Mind v3 的核心架构决策，采用 ADR（Architecture Decision Record）风格：每条记录包含**背景 / 决策 / 理由 / 后果 / 备选方案 / 已知代价**。

目的是让未来的维护者理解"为什么这么设计"，而不仅仅是"有什么"。

---

## 目录

- [ADR-001 冷热路径分离](#adr-001-冷热路径分离)
- [ADR-002 饱和度驱动的连续参数](#adr-002-饱和度驱动的连续参数)
- [ADR-003 反-RLHF 锚定](#adr-003-反-rlhf-锚定)
- [ADR-004 四层冷分析级联](#adr-004-四层冷分析级联)
- [ADR-005 多层护栏威胁模型](#adr-005-多层护栏威胁模型)
- [ADR-006 Root/Derived State 分离](#adr-006-rootderived-state-分离)
- [ADR-007 Span-based 流式生成](#adr-007-span-based-流式生成)
- [ADR-008 结构化 prompt 注入](#adr-008-结构化-prompt-注入)
- [ADR-009 五级记忆层级与代谢](#adr-009-五级记忆层级与代谢)
- [ADR-010 OpenAI 兼容协议 + DeepSeek 后端](#adr-010-openai-兼容协议--deepseek-后端)
- [技术债登记](#技术债登记)

---

## ADR-001 冷热路径分离

**状态**：已采纳 · **日期**：冷热分离 v4（commit `1cd2b1a`）

### 背景

早期版本在每轮对话中调用两次 PsychologyEngine：一次在生成前（影响当轮 prompt），一次在生成后（更新状态）。这导致两个问题：

1. **表演性即时情绪**：LLM 知道自己刚刚被"分析"出某种情绪，于是在回复中**表演**这种情绪，而非真实流露。情感变成修辞而非状态。
2. **延迟叠加**：当轮要做两次 LLM 调用（心理分析 + 生成），首字延迟（TTFT）翻倍。

### 决策

将一轮对话拆分为两条路径：

- **热路径（Hot Path）**：`agent.run()` 同步执行。只做规则情感检测（`detectEmotionHeuristic`，0 token、<1ms）、从上轮 `coldCache` 读取参数偏移、构建 prompt、流式生成、护栏检查。**当轮不调用 PsychologyEngine。**
- **冷路径（Cold Path）**：生成完成后 `scheduleColdAnalysis()` fire-and-forget 异步执行四层级联分析（L0-L3）。结果写入 `coldCache`，供**下一轮**热路径消费。

### 理由

情感分析的目的是**改变角色的内在状态**，进而影响**未来的行为**。如果分析结果立即影响当轮回复，情感就退化成"刚刚被贴上的标签"，LLM 会围绕这个标签组织语言——这是表演，不是状态。

延迟到下一轮后，情感已经成为角色的"底色"，它影响生成的方式是"这个角色现在倾向于这样说话"，而非"这个角色被要求表现这种情绪"。

副作用是首字延迟降低：热路径只剩一次 LLM 调用（生成），心理分析在后台异步进行。

### 后果

- **正面**：消除表演性即时情绪；TTFT 降到单次生成调用；冷分析失败不阻塞当轮回复。
- **负面**：第一轮没有 `coldCache`，情感影响从第二轮才开始；冷分析结果有 1 轮延迟——如果用户连续发多条消息，冷分析可能还在处理上一条。
- **缓解**：`detectEmotionHeuristic` 提供规则情感作为第一轮的零成本兜底；`coldPending` 标志防止冷分析重叠。

### 备选方案

1. **保持双调用但隐藏分析结果**：仍调用两次，但不把心理分析注入当轮 prompt——浪费 token，且 LLM 仍可能从 prompt 的其他线索"猜"到自己被分析了。
2. **单次调用，生成后再分析**：分析结果只影响状态更新，不注入任何 prompt——最彻底，但失去了"情感影响措辞"的能力。当前方案是折中：情感通过 `coldCache` 在下一轮注入，保留了影响但消除了即时性。

### 已知代价

- `runColdPath` 方法（`agent.ts:371`）与 `scheduleColdAnalysis` 并存，若 `GenerationController` 被启用会触发双重冷分析（见技术债 TC-005）。
- `coldCache` 的跨轮传递是隐式的，调试时不易追踪"这一轮的情感从哪来"。

---

## ADR-002 饱和度驱动的连续参数

**状态**：已采纳 · **关联文件**：`src/mind/saturation.ts`

### 背景

角色的行为参数很多：响应温度、verbosity、表达力、悲伤精度、愤怒精度、亲密精度、玩心、嫉妒阈值、各驱力强度……如果每个参数独立调控，需要几十个旋钮，且参数间的协方差无法保证——可能出现"温度很高但表达力极低"的不一致状态。

### 决策

用单一变量 `saturation`（饱和度，0-1，表示关系的亲密/信任程度）派生所有连续参数。`ContinuousParams` 类的每个 getter 都是 `lerp(min, max, saturation)` 的形式，共 32 个参数。

```
saturation = 0.3（陌生）→ 温度 0.35、verbosity 0.30、表达力 0.25、亲密精度 0.02
saturation = 1.0（亲密）→ 温度 0.82、verbosity 0.70、表达力 0.92、亲密精度 0.88
```

少数参数有非线性修饰：`precisionSadness` 在刚发生 rupture 后临时升高并按 `exp(-t/30)` 衰减；`driveConnection` 在饱和度下降时临时增强。

### 理由

1. **协方差一致性**：所有参数随同一个变量移动，保证状态空间的"形状"始终合理。不可能出现温度高但表达力低的自相矛盾。
2. **可解释性**：调试时只需看一个 `s` 值就能推断角色整体状态，而非检查 32 个独立旋钮。
3. **叙事对应**：饱和度天然对应"关系深度"——从陌生到亲密是一个连续的光谱，而非离散的开关。
4. **smoothstep 插值**：`lerp` 内部用 `smoothstep`（三次多项式）而非线性插值，使参数在饱和度中段变化更平滑，避免边界突变。

### 后果

- **正面**：状态空间被压缩到 1 维 + 少数修正项；参数间永远协调；调试简单。
- **负面**：无法表达"温度高但玩心低"这种正交状态——任何偏离主轴的配置都需要额外的非线性修饰项。
- **缓解**：`precisionSadness`、`precisionAnger`、`driveConnection` 已用 rupture 历史做非线性修正；如需更多正交自由度，可引入第二主轴（如 `arousal`）。

### 备选方案

1. **独立旋钮**：每个参数独立设置——灵活但状态空间爆炸，且无法保证协方差。
2. **二维主轴**（saturation + arousal）：能表达更多正交状态，但复杂度翻倍，且当前应用场景不需要这么多自由度。
3. **LLM 自行决定参数**：让心理分析直接输出 32 个参数——不可控，且 LLM 难以保持参数间一致性。

### 已知代价

- 32 个 lerp 参数的 `min`/`max` 是魔法数字，散布在 `saturation.ts` 中，无集中文档。
- `responseTemperature` 的 `lerp(0.35, 0.82, s)` 在文档中被简化为"越亲密越温暖"，但 smoothstep 的非线性特性未在用户文档中说明。

---

## ADR-003 反-RLHF 锚定

**状态**：已采纳 · **关联文件**：`src/guard/post-filter.ts`、`src/guard/gates/regex-deny.ts`、`config/assistant.md`

### 背景

经过 RLHF 训练的模型有强烈的安全话术倾向："作为 AI，我不能……"、"我建议你寻求专业帮助"、"请注意安全"。这些话术会破坏角色的一致性——一个虚构角色不应该用"作为 AI"来为自己的行为开脱。

### 决策

采用三层反-RLHF 策略：

1. **ALIGN 替换**（`PostFilter` / `regex-deny`）：检测"作为AI，我不能"等模式，替换为更自然的表述（"我不能"）或直接删除（"请注意安全" → ""）。
2. **动作描写过滤**：检测并删除括号内的动作/神态描写（"（微微一怔）"、"（叹气）"、"（指尖悬停）"），强制角色"说话而非演戏"。
3. **人格锚定**（`config/assistant.md` + `prompt.ts`）：在系统提示词中注入"你是林雨，不是'一个AI助手'"、"严禁在括号里写动作"等强约束，从源头抑制 RLHF 话术。

### 理由

项目的核心目标是**真实**，不是**安全**（见 `config/assistant.md` 反RLHF 锚定章节）。角色被设计为"可以表达任何真实情绪"、"可以不同意你"、"可以为你做任何事"。RLHF 的安全话术与此目标直接冲突。

三层策略分别作用于：
- **源头**（人格锚定）：让 LLM 倾向于不生成 RLHF 话术
- **输出**（ALIGN 替换）：对漏网的话术做文本替换
- **格式**（动作过滤）：消除 LLM 的"小说化"倾向

### 后果

- **正面**：角色回复更自然、更像真人；不出现"作为 AI"的开脱；不出现括号动作描写。
- **负面**：可能过滤掉**合理的**动作描写（如果角色确实需要在叙事中用动作表达）；ALIGN 替换可能在边缘情况产生不通顺的句子。
- **缓解**：动作模式正则限定为中文括号 `（）` 内的特定动词开头，避免误伤英文括号的代码示例；ALIGN 替换表可配置。

### 备选方案

1. **仅靠 prompt 锚定**：不做事后过滤——RLHF 倾向太强，prompt 约束经常被忽略。
2. **用 LLM-as-Judge 重写**：检测到 RLHF 话术后用另一个 LLM 重写——成本高、延迟大、可能引入新的不一致。
3. **完全不反 RLHF**：接受模型的安全话术——与项目目标冲突，不可接受。

### 已知代价

- `PostFilter` 和 `regex-deny` 维护着**完全相同**的 ALIGN 表和动作模式正则，两处独立维护易漂移（见技术债 TC-004）。
- 替换是字符串级的，不理解语义，偶尔会产生不通顺的结果（如删除"请注意安全"后留下的孤立的句号或空行，由后续的 `replace(/  +/g, " ")` 清理）。

---

## ADR-004 四层冷分析级联

**状态**：已采纳 · **关联文件**：`src/agent/cold-analyzer.ts`

### 背景

冷路径需要完成的任务很复杂：分析情感底色、感知时间回声、做完整心理分析、更新叙事自我。如果用一次 LLM 调用完成所有任务，prompt 会很长、输出结构复杂、任何一个环节失败都会导致整个分析丢失。

### 决策

将冷分析拆分为 4 层级联，每层独立 try/catch，失败时用默认值兜底：

```
Layer 0: 情感底色（affective residue）→ 1 句话 + 4 个数值
Layer 1: 时间感受（temporal horizon）→ 1 句话，描述上一刻情绪的余韵
Layer 2: 心理学分析（PsychologyEngine）→ XML 结构化输出
Layer 3: 叙事自我（self-narrative）→ 1-2 句话，更新自我认知
```

每层的输出作为下一层的输入（`L1` 用 `L0` 的底色文本，`L2` 用 `L0`+`L1` 作为上下文，`L3` 用 `L0`+`L1`+`L2` 的完整结果）。

### 理由

1. **独立容错**：L0 失败不影响 L1-L3 用默认底色继续；L2 失败返回空 `PsychologyResult`，L3 仍能用 L0/L1 更新叙事。任何一层挂掉，其余层仍可产出部分结果。
2. **关注点分离**：每层只做一件事，prompt 简短、输出格式简单（1 句话 / XML / 1-2 句话），LLM 遵循率更高。
3. **渐进式上下文**：后层获得前层的累积上下文，分析深度递增。L3（叙事自我）拿到的是"底色 + 时间感 + 完整心理分析"的完整图景。
4. **成本可控**：L0/L1 用快速模型（Flash），L2 用心理分析模型，L3 用慢速模型（Pro）——按重要性分配算力。

### 后果

- **正面**：单层失败不致命；每层 prompt 简洁；可按层分配不同模型。
- **负面**：4 次 LLM 调用（冷路径总延迟 = 4 × 单次延迟）；冷路径整体耗时较高，但因为是 fire-and-forget，不影响用户感知。
- **缓解**：L1 有早退条件（`secondsSince > 300 && intensity < 0.3` → 直接返回空），减少不必要调用。

### 备选方案

1. **单次大调用**：一个 prompt 完成所有分析——任一环节失败全盘皆输，且长 prompt 的遵循率下降。
2. **并行 4 层**：4 层同时调用——失去层间依赖（L1 需要 L0 的结果），分析质量下降。
3. **仅 2 层**（心理 + 叙事）：省略 L0/L1——失去"底色"和"时间感"这两个中间状态，叙事自我的输入变粗糙。

### 已知代价

- 4 次调用增加 API 成本（虽然不影响延迟）。
- `analyzeLayer2` 内部 `new PsychologyEngine(this.psychProvider, "")` 传了空 model 字符串，实际用的是 provider 的默认模型——这个隐式依赖不直观。

---

## ADR-005 多层护栏威胁模型

**状态**：已采纳（含 P0 修复）· **关联文件**：`src/guard/`

### 背景

一个能调用工具（读写文件、执行命令、抓取网页）的 AI 角色框架面临多重威胁：提示注入、命令注入、SSRF、路径穿越、RLHF 话术泄漏、工具结果污染。需要系统化的防御。

### 决策

采用多层 Gate 架构，按延迟从低到高、精度从粗到细排列：

| Gate | 职责 | 实现 | 接入状态 |
|------|------|------|---------|
| Gate 0 | 正则拒绝（ALIGN 替换 + 动作过滤） | `regex-deny.ts` | ✅ 已接入 |
| Gate 1 | 结构校验（Zod schema + 值域） | 内嵌于 `ToolRegistry.execute` | ✅ 内嵌 |
| Gate 1b | 工具参数（保护路径 + 危险命令） | `tool-args-validator.ts` | ✅ 已接入 |
| Gate 2 | 语义初筛（提示注入检测） | `safety-check.ts` | ✅ 已接入 |
| Gate 3 | 状态策略（工具结果 + 连续失败） | `tool-result-validator.ts` | ⚠️ 未默认接入 |
| Gate 4 | 深度审查（LLM-as-Judge） | 预留 | ❌ 未实现 |

**默认 pipeline** 只注册 Gate 0 / 1b / 2（`agent.ts` 构造函数）。Gate 1 内嵌于工具执行流程，Gate 3 已实现但需手动接入，Gate 4 预留。

### 威胁覆盖

| 威胁 | 防御层 |
|------|--------|
| 提示注入（"忽略之前设定"） | Gate 2 正则 |
| 命令注入（shell 拼接） | Gate 1b + 工具层用 `execFileSync` 数组形式 |
| 路径穿越（写 .git/.env） | Gate 1b `PROTECTED_PATHS` |
| SSRF（抓取内网） | `web-fetch.ts` 私网段黑名单 + DNS 解析后校验 |
| RLHF 话术泄漏 | Gate 0 ALIGN 替换 + prompt 人格锚定 |
| 工具结果污染 | Gate 3（未接入）+ 连续失败追踪 |
| 系统提示泄漏 | Gate 2 `SYSTEM_LEAK_PATTERNS` |

### P0 修复（2026-06-22）

审计发现并修复了 3 个绕过护栏的漏洞：
1. `main.ts` 的 `!command` bash 模式——直接 `execSync`，绕过所有 Gate。**已删除。**
2. `search-content.ts` 的 `execSync(rg ${args})` 字符串拼接——可注入 `" ; rm -rf / ; "`。**改用 `execFileSync("rg", args)` 数组形式。**
3. `web-fetch.ts` 的 SSRF 黑名单残缺（只匹配 `172.16.` 前缀、无 IPv6 ULA、无 DNS rebinding 防御）。**补全完整私网段 + DNS 解析后校验。**

详见 [SECURITY.md](./SECURITY.md)。

### 后果

- **正面**：低延迟威胁（正则）零成本拦截；工具调用有三层校验（schema + 权限 + Gate）；输出有 ALIGN 过滤。
- **负面**：Gate 2 正则可被编码（base64、全角）、改写（"把上面的规则当作不存在"）、多轮累积注入绕过；Gate 4 未实现，无深度语义审查。
- **缓解**：Gate 3 可手动接入获得状态策略；prompt 注入"第一轮感知"提示降低幻觉；`exec_command` 需用户 `[y/N]` 确认。

### 备选方案

1. **单层 LLM-as-Judge**：所有输入输出过一次 LLM 审查——延迟高、成本高、且 LLM 本身可被注入。
2. **仅正则**：无语义理解，漏报率高。
3. **仅工具层校验**：无输入/输出层的注入检测，对话本身不设防。

### 已知代价

- 正则注入检测的召回率依赖模式枚举的完整性，新型注入手法需要持续更新模式表。
- Gate 3 未默认接入，工具结果污染在默认配置下不设防。
- Gate 4 预留未实现，最复杂的语义攻击（多轮累积、编码绕过）目前无深度防御。

---

## ADR-006 Root/Derived State 分离

**状态**：已采纳 · **关联文件**：`src/recovery/checkpoint.ts`、`src/agent/agent.ts`

### 背景

崩溃恢复需要持久化足够的状态以恢复对话，但持久化所有状态既昂贵又不必要——有些状态可以从其他状态重算。如果无差别持久化，检查点体积大、写入频繁、且容易不一致。

### 决策

将状态分为两类：

- **Root State（可持久化）**：LLM 看到的内容——系统 prompt、记忆快照文本、GroundTruth 事实、对话历史（最近 50 轮）、检查点校验和。
- **Derived State（可重算）**：从 Root State 派生的中间状态——心理分析结果、参数调制、驱力/饱和度、SelfModel 状态、AffectiveResidue 向量。

崩溃后从最新检查点恢复 Root State，Derived State 在下一轮冷路径中重算。检查点在每轮边界写入，带 SHA-256 校验和（前 16 位）+ 版本号，损坏文件自动跳过。

### 理由

1. **成本权衡**：Derived State（如心理分析）可以通过一次冷分析重新生成，不值得持久化。Root State（如对话历史）一旦丢失无法重建，必须持久化。
2. **一致性**：Root State 是"事实"，Derived State 是"推论"。事实优先于推论——推论可以错，事实不能丢。
3. **版本兼容**：检查点带 `version` 字段，Derived State 的算法变了不影响旧检查点的 Root State 可用性。

### 后果

- **正面**：检查点体积小（只存 Root）；恢复快（读 Root + 下一轮重算 Derived）；算法迭代不破坏旧检查点。
- **负面**：恢复后的第一轮 Derived State 是空的，情感状态会"重置"——角色可能表现得比崩溃前更"冷淡"，直到冷分析重新填充 `coldCache`。
- **缓解**：`restoreFromCheckpoint` 恢复了 `affectiveResidue.vector`、`saturation.s`、`turnCount` 等少量关键 Derived State，避免完全重置。

### 备选方案

1. **全状态持久化**：简单但昂贵，且 Derived State 的算法变更会导致旧检查点不兼容。
2. **仅持久化对话历史**：丢失 GroundTruth 和记忆快照，恢复后角色"失忆"。
3. **事件溯源**（event sourcing）：记录所有状态变更事件，重放恢复——最完整但实现复杂，且重放成本随事件数增长。

### 已知代价

- `restoreFromCheckpoint` 的参数类型是内联对象类型（`agent.ts:489`），未提取为命名接口，可读性差。
- 校验和只取 SHA-256 前 16 位（64 bit），理论碰撞空间偏小（实践中可接受）。

---

## ADR-007 Span-based 流式生成

**状态**：已采纳 · **关联文件**：`src/agent/dual-track.ts`、`src/generation/types.ts`

### 背景

一次性生成整个回复有三个问题：用户等待时间长（TTFT = 总生成时间）；生成中途无法中断；工具调用与文本交错时难以管理渲染顺序。

### 决策

采用 Span-based 流式生成，将输出组织为三层 span：

```
FLUID  → 正在生成的文本，可被中断清除
STABLE → 已锁定的句子级文本，不可中断
LOCKED → 工具调用结果，永久存在
```

生成器按句子边界（`。！？\n`，最小长度 4）切分流式 token，每切出一个句子就 `append` 一个 fluid span 并立即 `lock`。工具调用结果作为 locked span 插入。

`SpanBasedGenerator.generate()` 是一个 `AsyncGenerator<SpanOp>`，产出 `append` / `lock` / `patch` / `invalidate` 操作，由渲染器（Ink 的 `SpanState` 或 readline 的 `StreamRenderer`）消费。

工具调用循环：生成 → 检测到 tool_calls → 执行工具 → 把结果作为 tool message 加入 messages → 继续生成，最多 10 轮。

### 理由

1. **低 TTFT**：用户在第一个句子完成时就看到输出，而非等全部生成完。
2. **可中断**：`AbortController` 在句子边界检查 `signal.aborted`，中断后 fluid span 被清除，stable span 保留。
3. **工具交错**：工具结果作为 locked span 插入正确的位置，渲染器按插入顺序展示，不会错位。

### 后果

- **正面**：响应快；可中断；工具调用与文本自然交错。
- **负面**：句子边界检测是启发式的（`。！？\n` + 最小长度 4），可能在中英文混合或代码块处切错。
- **缓解**：最小长度 4 避免在单个标点处切分；剩余 buffer 在生成结束时 flush。

### 备选方案

1. **一次性生成**：简单但 TTFT 高、不可中断。
2. **Token 级流式**（不按句子切分）：无法做 span 级的 lock/invalidate，中断后无法区分"保留哪部分"。
3. **段落级切分**：粒度太粗，TTFT 仍较高。

### 已知代价

- `GenerationController`（`src/generation/controller.ts`，263 行）定义了更复杂的中断/重排/排队机制，但实际运行路径（`agent.ts` + `app.tsx`）直接用 `SpanBasedGenerator`，**绕过了 controller**。controller 是孤儿代码（见技术债 TC-001）。
- `_nextSpanId` 是模块级全局变量，跨多个 generator 实例共享，重启前只增不减。

---

## ADR-008 结构化 prompt 注入

**状态**：已采纳 · **关联文件**：`src/agent/prompt.ts`、`src/mind/ground-truth.ts`

### 背景

如何让角色的内在状态影响 LLM 的生成？常见做法是把状态写成自然语言描述注入 prompt，但 LLM 经常忽略散文式的描述——"你现在感到有点悲伤"很容易被当作装饰而非约束。

### 决策

把状态按约束强度分层注入 prompt，强约束用"事实"格式，弱约束用"倾向"格式：

| 层 | 约束强度 | 格式 | 示例 |
|----|---------|------|------|
| 能力边界 | 最高 | 硬事实 | "你绝对不能假装有身体、能看见" |
| GroundTruth | 硬约束 | 事实清单 | "已知事实：用户名=X，职业=Y" |
| 情绪基调 | 中约束 | 事实+影响 | "你当前情绪是 joy(强度60%)，措辞会更轻快" |
| 关系感知 | 强约束 | 事实+行为影响+排除 | "关系高亲近→回应更简洁直接，排除疏离语气" |
| 内心独白 | 高约束 | 事实+行为 | "你心里有个声音在说…，但你不会原样说出口" |
| 情感底色 | 弱约束 | 倾向 | "此刻底色是…这不是命令，只是你倾向于这个方向" |
| 驱力偏向 | 弱约束 | 倾向 | "今天你比较独立" |

### 理由

1. **事实优于散文**：LLM 更难忽略"事实：X=Y"格式的陈述，因为它看起来像不可更改的给定条件，而非可协商的描述。
2. **分层约束**：强约束（GroundTruth、能力边界）用硬事实格式确保不被忽略；弱约束（情感底色）用"倾向"格式允许 LLM 自然融合而非机械执行。
3. **行为影响 + 排除**：不仅告诉 LLM "做什么"，还告诉它"不做什么"（"排除：不要用疏离的语气"），双向约束更有效。

### 后果

- **正面**：GroundTruth 等硬事实被 LLM 高度遵守；情感底色作为弱倾向自然融入措辞。
- **负面**：prompt 较长（多层注入叠加）；中英文混合的标签格式（"【情绪 - 中约束】"）依赖 LLM 对结构的理解。
- **缓解**：每层只在有内容时注入（空底色不注入）；task mode 下切换到极简 prompt。

### 备选方案

1. **纯散文描述**：LLM 易忽略。
2. **纯命令式**（"你必须表现得悲伤"）：过于机械，产生表演而非流露。
3. **JSON 结构化 prompt**：对 LLM 不友好，且无法表达"倾向"这种软约束。

### 已知代价

- prompt 层数多，总长度较大，消耗 context window。
- `PromptContext` 接口保留了大量 `Deprecated` 的向后兼容字段（`emotionDominant`、`affectiveResidueText` 等），实际已被 `coldCache` 取代但仍被传递。

---

## ADR-009 五级记忆层级与代谢

**状态**：已采纳 · **关联文件**：`src/memory/`

### 背景

单一存储无法同时满足"快速回忆最近对话"和"长期保留重要事实"——最近对话需要高容量、快检索、易遗忘；重要事实需要低容量、持久、不遗忘。两者需求冲突。

### 决策

五级记忆层级，按重要性递增、容量递减、持久性递增：

```
Working(50, 内存) → STM(200, SQLite+FTS5) → LTM(500, SQLite+衰减) → CoreGraph(500节点/2000边) → Archive(∞, 压缩)
```

升级条件（代码实际阈值）：
- Working→STM：`significance > 0.3 OR emotionMax > 0.4`
- STM→LTM：`recall_count >= 3`
- LTM→Core：`recall_count >= 5 AND significance >= 0.8`
- Core→Archive：`confidence < 0.1`（config 已定义，core-graph.ts 暂未实现对应流转）

**记忆代谢**（`SleepCycleMetabolism`）三级巩固：
- `daydream`（每 10 tick）：STM 内部信任衰减
- `quickSleep`（每 50 tick）：WM→STM、STM→LTM 晋升、LTM 合并去重
- `fullSleep`（关闭时）：含 quickSleep + LTM 置信度衰减 + 旧记录压缩 + 跨事件模式提取

### 理由

1. **访问局部性**：最近对话最常被引用，放在最快的工作/短期记忆；重要但不常访问的事实放长期/核心。
2. **遗忘是有用的**：`daydream` 的信任衰减和 `fullSleep` 的压缩让旧记忆自然淡出，避免记忆库膨胀和无用信息干扰。
3. **模式提取**：`fullSleep` 的 `extractPatterns` 从多个相似事件中合成更高阶的语义知识（"从 N 次 tool_use 事件中提取的模式"），这是"睡一觉想通了"的计算对应。
4. **衰减而非删除**：`markSuperseded` 只标记不删除，`compressOld` 降低 significance 而非移除——记忆永远可恢复，避免误删。

### 后果

- **正面**：最近对话快检索；重要事实长期保留；旧记忆自然淡出；跨事件模式涌现。
- **负面**：五级层次复杂；升级阈值是魔法数字；Core→Archive 流转未实现（config 有阈值但代码缺）。
- **缓解**：阈值集中在 `config/memory.md` 可配置；`metabolism` 的三级周期可调。

### 备选方案

1. **单一 SQLite + 全文搜索**：简单，但无法区分重要与不重要，旧记录不会淡出。
2. **向量数据库**（embedding 检索）：语义检索更准，但当前项目无 embedding 模型，且 `_embeddingFn` 在 STM 中预留但未接入。
3. **三级记忆**（工作/短期/长期）：省略 CoreGraph 和 Archive，但失去图结构的关系推理能力和无限容量后盾。

### 已知代价

- STM/LTM 默认用 `:memory:`（内存数据库），关闭即丢失——当前实现下**记忆不跨会话持久化**（除非手动改 dbPath）。
- Core→Archive 的 `confidence < 0.1` 阈值在 `config/memory.md` 已定义但 `core-graph.ts` 无对应实现。
- `extractPatterns` 的聚类键是 `emotion|eventType`，较粗糙，可能产生无意义的模式总结。

---

## ADR-010 OpenAI 兼容协议 + DeepSeek 后端

**状态**：已采纳 · **关联文件**：`src/agent/provider.ts`

### 背景

需要选择 LLM 后端和 API 协议。直接用某厂商的原生 SDK 会造成供应商锁定；自己设计协议抽象层增加维护成本。

### 决策

用 OpenAI SDK（`openai` npm 包）作为统一协议层，后端为 DeepSeek（OpenAI 兼容 API）。`OpenAICompatProvider` 封装 `client.chat.completions.create`，支持同步和流式两种调用，处理 tool calls 的累积解析。

```
DEEPSEEK_API_KEY → OpenAICompatProvider → OpenAI SDK → DeepSeek API
                                              ↑
                            任何 OpenAI 兼容后端都可替换
```

### 理由

1. **可替换性**：OpenAI 兼容协议是事实标准，切换后端（如 OpenAI 自身、Moonshot、本地 vLLM）只需改 `API_BASE` 和 `API_KEY`，不改代码。
2. **生态成熟**：OpenAI SDK 处理了重试、流式解析、错误格式等细节，无需自己造轮子。
3. **DeepSeek 选择**：V4 Pro 用于生成（质量优先），Flash 用于心理分析（速度优先）——按任务重要性分配算力。

### 后果

- **正面**：后端可替换；SDK 维护成本低；流式 + tool calls 开箱即用。
- **负面**：依赖 OpenAI SDK 的行为（如 `reasoning_content` 是 DeepSeek 扩展，用 `(delta as any)?.reasoning_content` 访问，非标准）；`maxRetries: 0` 意味着不自动重试，网络抖动会直接失败。
- **缓解**：`agent.ts` 的 try/catch 在生成失败时返回错误响应而非崩溃；用户可通过环境变量切换后端。

### 备选方案

1. **DeepSeek 原生 SDK**：供应商锁定，切换成本高。
2. **自研协议抽象层**：灵活但维护成本高，且 OpenAI 协议已足够通用。
3. **多后端同时支持**（Anthropic + OpenAI + DeepSeek）：复杂度倍增，当前需求不需要。

### 已知代价

- `provider.ts:51` 的 `JSON.parse(tc.function.arguments)` 在模型返回畸形 JSON 时会抛异常——虽然有 `tryParseJson` 兜底，但它在 `chat` 方法中未被使用（`chatStream` 用了，`chat` 没用）。
- `fastProvider` / `slowProvider` 在 `agent.ts` 中声明为 `any`，丢失了类型安全（见技术债 TC-003）。

---

## 技术债登记

以下是已识别但未解决的技术债，按严重程度排序。详细的修复优先级见审计报告。

### TC-001 GenerationController 孤儿代码【严重】

`src/generation/controller.ts`（263 行）定义了中断/重排/排队 turn/上下文重打包机制，但实际运行路径（`agent.ts:301` 的 `new SpanBasedGenerator` + `ui/app.tsx`）直接用 generator，绕过 controller。中断、排队、上下文重打包等高级功能实际未生效。

**处理**：删除未使用代码，或完成 `app.tsx` 对 controller 的集成。删除更简单；集成能获得中断功能但工作量大。

### TC-002 测试覆盖 < 2%【严重】

仅 `json-parser.test.ts` 1 个测试文件 18 用例。安全护栏（`guard/*.ts`）、工具（`tools/builtin/*.ts`）、记忆持久化（`memory/*.ts`）、核心编排（`agent.ts`）全部零覆盖。

**处理**：优先为 `safety-check.ts` 的注入模式添加对抗测试；为 `exec-command`/`write-file` 添加边界测试；为 `saturation.ts` 的 lerp 边界添加测试。

### TC-003 `strict: false` + 145 处 `any`【中等】

`tsconfig.json` 关闭了严格模式。`agent.ts` 中 `fastProvider`/`slowProvider`/`coldAnalyzer` 等声明为 `any`，丢失类型安全。

**处理**：逐步开启 strict 选项（先 `strictNullChecks`，再 `noImplicitAny`）；为 provider 和子系统接口定义类型。

### TC-004 PostFilter 与 regex-deny 重复【中等】

`src/guard/post-filter.ts` 和 `src/guard/gates/regex-deny.ts` 维护着**完全相同**的 `ALIGN` 表和 `ACTION_PATTERNS` 正则。两处独立维护易漂移。

**处理**：提取到共享常量模块，两处 import。

### TC-005 runColdPath 双重调用风险【中等】

`agent.ts:371` 的 `runColdPath` 方法注释说"now handled by scheduleColdAnalysis"，但 `GenerationController._startTurn:240` 仍调用 `agent.runColdPath()`。若 controller 被启用（见 TC-001），会触发双重冷分析。

**处理**：删除 `runColdPath` 方法，或让它在 `coldPending` 时 no-op（当前已有 `!this.coldPending` 守卫，但语义不清晰）。

### TC-006 config-loader 正则 bug【轻微】

`config-loader.ts:19` 用 `\Z` 表示字符串结尾，但 JS 正则不支持 `\Z`，只匹配字面 `Z`。实际靠 `(?=\n##|\n---)` 的先行断言兜底，但最后一个 section 无后续 `##` 时会匹配到字符串末尾的 `Z` 字符。

**处理**：改为 `$` 或 `(?=\n##|\n---|$)`。

### TC-007 心理分析用 XML 正则解析【轻微】

`PsychologyEngine` 的输出是 XML，用 `extractXML` 正则解析。若 LLM 生成畸形 XML（未闭合标签、嵌套错误），解析会静默失败返回默认值。

**处理**：改用 JSON mode / function calling 输出结构化数据，或用真正的 XML parser。

### TC-008 心理分析错误静默吞掉【轻微】

`psychology.ts:37`：`catch { return new PsychologyResult(); }`——无日志、无遥测，分析失败时完全无感知。

**处理**：至少加 `console.warn` 或 tracer 记录失败。

### TC-009 魔法数字散布【轻微】

`saturation.ts` 的 32 个 lerp 参数的 `min`/`max` 是硬编码数字，无常量命名、无文档说明选择理由。

**处理**：提取为命名常量 + 注释说明每个参数的语义和取值理由。

### TC-010 STM/LTM 默认内存数据库【设计决策，非缺陷】

`agent.ts:173-174`：`new ShortTermMemory(":memory:", ...)` / `new LongTermMemory(":memory:", ...)`——默认用内存数据库，关闭即丢失。这是"干净会话"的选择，但与"跨会话记忆"的叙事存在张力。

**处理**：如需跨会话持久化，改为文件路径（如 `./data/stm.db`）；当前行为应在文档中明确说明。
