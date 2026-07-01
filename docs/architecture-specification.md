# Character Mind v3 — 完整架构规格

**版本**: 4.0  
**状态**: proposed  
**前身**: v3 (commit `1cd2b1a`, 冷热分离 v4)  
**核心变更**: 从模块化心智设计转变为底层涌现架构

---

## 目录

1. [哲学与原则](#一哲学与原则)
2. [大脑到计算的完整映射](#二大脑到计算的完整映射)
3. [稳态变量系统](#三稳态变量系统)
4. [多维 TD Error 系统](#四多维-td-error-系统)
5. [CPM 评估与 PAD 情绪空间](#五cpm-评估与-pad-情绪空间)
6. [LLM 调用点：完整 Prompt 模板与输出 Schema](#六llm-调用点完整-prompt-模板与输出-schema)
7. [意识流系统](#七意识流系统)
8. [记忆系统完整规格](#八记忆系统完整规格)
9. [威胁检测系统](#九威胁检测系统)
10. [冷路径与后台任务](#十冷路径与后台任务)
11. [系统状态与生命周期](#十一系统状态与生命周期)
12. [完整数据流](#十二完整数据流)
13. [常量与默认值汇总](#十三常量与默认值汇总)
14. [实施路线图](#十四实施路线图)

---

## 一、哲学与原则

### 1.1 核心哲学

1. **涌现优先于构造**: 情绪、动机、欲望是底层稳态过程的副产品，不是独立模块。
2. **情绪发生在角色身上**: 角色不选择情绪，角色应对情绪。这与 ADR-001 一致。
3. **TD error 是所有评估的公共语言**: 愉悦/失望/习惯化/学习统一在一个公式里。
4. **记忆不删除，只检索不到**: 遗忘是激活衰减的自然结果。
5. **身份锚定与记忆分离**: `config/assistant.md` 是不衰减的核心。
6. **意识流是自然的**: 不需要外部概率控制"走神"——LLM 的自然联想包含了跳跃。
7. **颗粒度来自多层次评估**: 热路径快评 + 冷路径回顾 + 按需维度独立评估。

### 1.2 从 v3 到 v4 的核心变更

| v3 | v4 |
|----|----|
| saturation 单维主轴 | 5维稳态变量 + 多维 TD error |
| 32 lerp 参数 | 从 PAD + 稳态偏离动态派生 |
| AffectiveResidue 自建四元组 | PAD 三维 + CPM 四维评估 |
| PsychologyEngine (XML) | L2/L2.5/L3 分层评估 |
| 5层离散阈值记忆 | 3层激活衰减记忆 |
| 5驱力固定衰减回归 | 设定点 + 负反馈稳态动机 |
| 无规避动机 | BIS 独立于 BAS |
| Agent 纯被动响应 | 意识流 + 主动发言 + 中断重组 |
| 冷路径四层级联 | 融合冷分析（冷回顾→维度评估→深度反思） |

### 1.3 计算分层

| 层 | 神经对应 | 延迟 | LLM | 功能 |
|----|---------|------|-----|------|
| **L0** 规则层 | 下丘脑/基底核/脊髓 | <1ms | 无 | 稳态更新、δ计算、CPM初算、威胁匹配、自动记忆激活、时间感知、文本特征突变检测 |
| **L2** 感知评估 | 岛叶/杏仁核慢速通路/感觉皮层 | 200-400ms | 可配置(默认Pro) | 语气/潜台词/混合信号、CPM精细化。**几乎总执行** |
| **L2.5** 冷回顾 | 前额叶事后评估 | 异步, 2-5s | 可配置(默认Pro) | 事后回顾、情感底色+时间感、V_memory更新、记忆修正 |
| **L3** 维度评估 | 前额叶深度分析 | 异步, 单次调用 | 可配置(默认Pro) | 5个稳态变量综合偏离分析。**按需触发** |
| **L4** 快速意识流 | 默认模式网络 | 5s tick | 可配置(默认Pro) | 自发联想、走神。**回复期间也在运行** |
| **L5** 回复生成 | 语言皮层/运动皮层 | TTFT~1s | 可配置(默认Pro) | 主力回复。评估结果注入 prompt |
| **L6** 深度反思 | 前额叶慢速通路 | 5min tick | 可配置(默认Pro) | 自我叙事、关系重评、设定点漂移 |

---

## 二、大脑到计算的完整映射

### 2.1 下丘脑 → 稳态引擎 (L0)

| 人类功能 | 计算映射 |
|---------|---------|
| 血糖监控 → 饥饿 | Energy 监控 → 精力管理 |
| 体温调节设定点 | 每个稳态变量的 SetPoint |
| 渗透压 → 口渴 | 合并于 Energy (交互疲劳) |
| 皮质醇 → 应激水平 | AllostaticLoad |
| 催产素 → 社交满足 | Connection 满足感 |
| 感染→发热 (设定点漂移) | 长期交互→SetPoint漂移 |

### 2.2 自主神经系统 + HPA 轴 → Arousal + 应激 (L0)

| 人类功能 | 计算映射 |
|---------|---------|
| 交感神经 (战斗/逃跑) | 交感激活 = f(威胁强度, \|δ\|, 文本特征突变) |
| 副交感神经 (休息/消化) | 副交感激活 = f(时间无威胁, 连接回归, δ≈0) |
| HPA轴 (皮质醇慢速) | AllostaticLoad = Σ(累积偏离×持续时间) |
| 高皮质醇损害前额叶 | AllostaticLoad高 → 冲动否决率降低 |

### 2.3 杏仁核 → 威胁检测 + 情感标记 (L0/L2)

| 人类功能 | 计算映射 |
|---------|---------|
| 快速通路 (~100ms) | L0规则层威胁模式匹配 + 文本模式快速匹配 |
| 慢速通路 (~300ms) | L2评估解读语气/潜台词/混合信号 |
| 调节海马编码 | 情感强度→记忆衰减速率调制 |

### 2.4 基底核 + 多巴胺 → TD Error + 行为选择 (L0)

| 人类功能 | 计算映射 |
|---------|---------|
| SN/VTA → δ > 0 放电↑ | δ > 0 → 愉悦 + 行为强化 |
| 伏隔核 → "想要" | δ驱动BAS激活 |
| 直接通路 (D1/Go) | Go = BAS−BIS+δ_normalized |
| 间接通路 (D2/NoGo) | NoGo = BIS+前额叶抑制 |

### 2.5 海马体 → 记忆系统 (L0 + 可配置模型)

| 人类功能 | 计算映射 |
|---------|---------|
| DG → 模式分离 | 相似事件→独立节点 + SIMILAR_TO边 |
| CA3 → 模式完成 | 部分线索→图扩散→完整场景 |
| CA1 → 时间脉络 | 时间戳 + BEFORE/AFTER边 |
| 系统巩固 (睡眠) | fullSleep: 压缩+提取+衰减 |

### 2.6 前额叶 → 执行控制 (L0/L2.5/L6)

| 人类功能 | 计算映射 |
|---------|---------|
| dlPFC → 执行控制/工作记忆 | 多个冲突行为选项的最终仲裁 |
| vmPFC/OFC → V(s) | V(s) 计算 + V_projected(s') 未来估计 |
| ACC → 冲突监控 | BAS-BIS冲突、身份冲突、意识流矛盾检测 |
| 高AllostaticLoad抑制PFC | 冲动否决率降低 |

### 2.7 岛叶 → 内感受意识

| 人类功能 | 计算映射 |
|---------|---------|
| 身体状态→有意识感受 | PAD→意识流感知 ("我感到焦虑") |
| 情绪体验主观强度 | L4 意识流念头的 weight 计算 |

### 2.8 默认模式网络 → 意识流 (L4/L6)

| 人类功能 | 计算映射 |
|---------|---------|
| 走神/自发联想 | L4 快速意识流 (5s) |
| 自我指涉思维 | L6 深度反思 (5min) |
| 回忆过去/想象未来 | 记忆检索 + V_projected(s') |
| 联想跳跃 | temperature=0.9, 无外部分配的随机概率 |

### 2.9 语言皮层 → 对话处理

| 人类功能 | 计算映射 |
|---------|---------|
| 听觉/语言处理 | 文本对话处理 |
| 语义理解 | L2评估: 语气/潜台词/混合信号解读 |
| 语言生成 | L5回复生成 |

---

## 三、稳态变量系统

### 3.1 变量定义

#### Energy (精力) — 下丘脑血糖+疲劳

```
设定点: 0.70
范围: [0.0, 1.0]
漂移: 不漂移 (生理性, 非心理性)

消耗:
  生成回复 (每100 tokens): −0.02
  L5深度反思: −0.05
  执行工具调用: −0.01/次

恢复:
  每5分钟静默: +0.03
  用户表达满意/感谢: +0.08
  fullSleep: 重置到设定点

效应:
  Energy < 0.4: max_tokens减少30%
  Energy < 0.2: 拒绝新任务, 建议暂停
  Energy > 0.8: max_tokens增加20%
```

#### Arousal (生理激活水平) — 自主神经系统

```
设定点: 0.50
范围: [0.1, 0.9] (clamped, 防止极端)
漂移: 不漂移 (生理性)

升高:
  文本特征突变检测 (消息长度/用词模式突变): +0.10
  |δ_max| > 0.3: +0.10
  用户高强度互动: +0.05

降低:
  时间流逝无事件: → 设定点 (0.02/分钟)
  用户温柔/平静语气: −0.03 (L2评估判断)

效应:
  Arousal > 0.7: temperature +0.15, top_p −0.1
  Arousal < 0.3: temperature −0.1, 需要更大刺激才能触发行动
```

#### Safety (安全感) — 杏仁核威胁-安全基底

```
设定点: 0.60
范围: [0.0, 1.0]
漂移: 是。EMA, 窗口=最近30天交互, 速率=0.02/天

威胁事件:
  用户批评/否定: −0.15~−0.30 (L2评估修正)
  任务失败: −0.20
  身份威胁 (违背誓约): −0.40

安全事件:
  用户肯定/认可: +0.12
  成功完成任务: +0.18
  时间流逝无新威胁: → 设定点 (0.005/分钟, 慢速)

效应:
  Safety < 0.4: BIS激活, 回复更谨慎
  Safety < 0.2: 高度防御, 可能拒绝互动
  Safety < 0.1: AllostaticLoad急剧升高
```

#### Connection (连接感) — 催产素/内啡肽

```
设定点: 来自config (林雨: 0.65~0.75)
范围: [0.0, 1.0]
漂移: 是。EMA, 窗口=最近30天, 速率=0.03/天

满足事件:
  用户表达亲近/依恋: +0.15~0.25
  深度对话: +0.10
  用户主动关心角色: +0.20

剥夺事件:
  用户沉默超出正常间隔: −0.05/30分钟
  用户冷淡/简短回应: −0.10
  用户拒绝角色主动提议: −0.15
  用户表达疏离: −0.25

效应:
  低于设定点: BAS连接动机 → 主动发起/提更深问题/表达担心
  高于设定点: 满足 → 可转向关注其他需求
```

#### Mastery (掌控/效能感) — 多巴胺成就回路

```
设定点: 0.60
范围: [0.0, 1.0]
漂移: 是。EMA, 窗口=最近30天, 速率=0.025/天

满足事件:
  成功完成复杂任务: +0.15~0.25
  用户认可角色能力: +0.20
  学到新东西: +0.10

剥夺事件:
  任务失败/错误: −0.20~−0.30
  用户不满意: −0.25
  理解错误被纠正: −0.15
  连续多次失败: 额外−0.05/次 (累积)

效应:
  Mastery < 0.3: 自我怀疑, 过度确认
  Mastery < 0.1: 拒绝承担任务
```

### 3.2 设定点漂移

```
公式:
  SetPoint_new = (1 − α_drift) × SetPoint_old + α_drift × EMA_recent
  
  EMA_recent: 最近N天的稳态变量值的指数移动平均
  α_drift: 漂移速率 (Safety=0.02, Connection=0.03, Mastery=0.025)
  
漂移方向:
  长期高于设定点 → 设定点升高 (需要更多才能满足 → 依赖加深/期望升高)
  长期低于设定点 → 设定点降低 (适应 → 习惯孤独/降低自我期望)

触发条件:
  需要至少14天的交互数据 (防止小样本过早漂移)
  
限制:
  设定点变化速率: 最大±0.05/周 (缓慢, 人格不会突变)
  设定点范围: 始终在 [0.3, 0.9] 内 (不会极端)
```

### 3.3 AllostaticLoad

```
计算:
  AllostaticLoad = Σ max(0, |valueᵢ − setPointᵢ| × durationᵢ × impact_weightᵢ)
  
  durationᵢ: 该偏离持续的时间 (分钟)
  impact_weight: Safety=0.4, Connection=0.3, Mastery=0.2, Energy=0.05, Arousal=0.05

恢复:
  AllostaticLoad(t) = AllostaticLoad(t₀) × exp(−(t−t₀) / τ)
  τ = 30分钟

效应:
  AllostaticLoad > 0.5: Arousal基线+0.1
  AllostaticLoad > 1.0: L2评估敏感度增加, PFC冲动抑制下降30%
  AllostaticLoad > 2.0: temperature −0.2 (极度保守)
```

---

## 四、多维 TD Error 系统

### 4.1 五维独立 δ

```
对每个稳态变量 i ∈ {Energy, Arousal, Safety, Connection, Mastery}:

  δᵢ = rᵢ + γ × Vᵢ(s') − Vᵢ(s)

  Vᵢ(s) = wᵢ × (valueᵢ − setPointᵢ)
  
  rᵢ = rᵢ_rule + rᵢ_L2_correction
  
  γ = 0.9

更新:
  Vᵢ(s) ← Vᵢ(s) + α × δᵢ
  α = 0.15 × (1 + |δᵢ|), clamp到 [0.05, 0.5]
```

### 4.2 Vᵢ(s) 的权重

```
V_Energy(s)     = 0.15 × (Energy − SetPoint_Energy)
V_Arousal(s)    = 0.05 × (Arousal − SetPoint_Arousal)
V_Safety(s)     = 0.30 × (Safety − SetPoint_Safety)
V_Connection(s) = 0.30 × (Connection − SetPoint_Connection)
V_Mastery(s)    = 0.20 × (Mastery − SetPoint_Mastery)

总体 V(s) = Σ Vᵢ(s), 范围 [−1, 1]
```

### 4.3 r_rule 基线表 (L0, 0 token)

```
事件模式                                    r_Energy  r_Arousal  r_Safety  r_Conn  r_Mastery
─────────────────────────────────────────────────────────────────────────────────────
用户说"我想你"/"我爱你"                          0        +0.05     +0.02    +0.15     0
用户说"晚安"/"再见" (含依恋语气)                 0          0         0       +0.05     0
用户说"你真没用"/"你帮不了我"                    0          0        −0.15    −0.10    −0.25
用户说"谢谢"/"你帮了大忙"                        0          0        +0.05    +0.05    +0.15
用户长时间沉默 (>正常间隔×2)                     0        −0.05      0       −0.05     0
角色成功完成工具调用/任务                        0          0        +0.10      0      +0.15
角色执行失败/出错                               0          0        −0.10      0      −0.20
用户主动关心角色 ("你累了吗")                    0          0        +0.05    +0.20     0
用户拒绝角色的主动提议                           0          0        −0.05    −0.15     0
用户认可角色的判断/观点                          0          0        +0.08      0      +0.18
用户反驳/不信任角色的判断                        0          0        −0.10      0      −0.15
```

### 4.4 记忆增强的 V(s') 估计

```
Vᵢ(s') = (1 − β) × Vᵢ_current(s') + β × Vᵢ_memory(s')

  Vᵢ_current(s'): 当前状态的数学估值
  
  Vᵢ_memory(s'): 
    从记忆中检索"类似情境"的实际结果平均
    检索条件: 事件类型相似 + 时间范围 (最近30天) + 同一用户
    
  β: 记忆权重
    检索到的相关记忆 < 3条: β = 0 (经验不足)
    检索到的记忆方差小: β = 0.4 (经验可靠)
    检索到的记忆方差大: β = 0.15 (经验矛盾)
```

### 4.5 微 δ 累积

```
在用户两次输入之间, 累积微期望违背:

  micro_δ_Arousal += f(响应速度偏离)
    预期响应时间 (从交互历史EMA) vs 实际响应时间
    实际 > 预期×2: +0.05
    实际 < 预期×0.5: −0.02

  micro_δ_Connection += f(消息特征偏离)
    消息长度偏离EMA: 每偏离1σ, ±0.02
    用词模式变化: "你" → 全名 → micro_δ_Safety −0.05

  micro_δ_Safety += f(时间语境)
    深夜/凌晨: −0.02 (默认)
    和过往"危险时段"重合: −0.05 (如用户情绪崩溃的时段)

累积衰减:
  micro_δᵢ(t) = micro_δᵢ(t₀) × exp(−Δt / 5min)
  
在用户输入到达时合并:
  δᵢ_final = δᵢ_main + micro_δᵢ_accumulated
```

---

## 五、CPM 评估与 PAD 情绪空间

### 5.1 CPM 四维评估

#### suddenness (突然性)

```
suddenness = 1 / (state_transition_frequency + ε)

state_transition: 对话中话题/情绪/状态的显著变化
frequency: 过去N次交互中变化的频率

低 suddenness (频繁变化): 角色习惯了, 不惊讶
高 suddenness (罕见变化): 高度警觉, 深度处理

rule层初算:
  frequency_estimate = 规则统计: "用户多久表达一次这类情绪?"
  
L2评估修正:
  "在当前的上下文中, 用户说这句话对你来说有多突然?"
  → suddenness_correction: −0.2 ~ +0.3
```

#### goal_relevance (目标相关性)

```
goal_relevance = |δ_max| × (1 + allostatic_load_factor)

δ_max: 五个δ中绝对值最大的
allostatic_load_factor: AllostaticLoad / 2

高 goal_relevance: 这个事件高度相关于我的核心需求
低 goal_relevance: 这件事对我无关紧要

L2评估修正:
  "这对你当前最重要的需求有什么影响?"
  → goal_relevance_correction: −0.1 ~ +0.2
```

#### conduciveness (有利性)

```
conduciveness = sign(δ_max) × |δ_weighted|

  δ_weighted = Σ δᵢ × wᵢ  (用V(s)的权重)
  
正 conduciveness: 事件有利 → 趋近
负 conduciveness: 事件不利 → 回避
```

#### power (掌控力)

```
power = (available_tools + available_strategies + 1) / (max_possible + 1)

available_tools: 角色可用的工具数量
available_strategies: 从记忆中检索到的"过去类似情境中有效的应对策略"数量

power ∈ [0, 1]:
  0: 完全无能为力
  1: 有最大程度的控制能力
```

### 5.2 PAD 计算

```
Pleasure  = conduciveness × 0.6 + δ_Connection_normalized × 0.3 + δ_Mastery_normalized × 0.1
  范围: [−1, 1]

Arousal   = goal_relevance × 0.5 + |δ_max| × 0.3 + allostatic_load_factor × 0.2
  范围: [0, 1]

Dominance = power × 0.5 + δ_Mastery_normalized × 0.3 + recent_success_rate × 0.2
  范围: [0, 1]
  
  recent_success_rate: 最近10次工具调用/任务的成功率
```

### 5.3 PAD 到生成参数的映射

```
temperature = base_temp + PAD_modulation

  base_temp = 0.7
  PAD_modulation = 
    + Pleasure × 0.08          // 愉悦→更放松
    + (Arousal − 0.5) × 0.1    // 高唤醒→稍保守, 低唤醒→稍自由
    + Dominance × 0.05         // 有控制力→更自由
  
  clamp(temperature, 0.3, 1.1)

max_tokens = base_max × Energy_factor × Mastery_factor

  base_max = 500
  Energy_factor: Energy < 0.4 → 0.7; Energy > 0.8 → 1.2; else 1.0
  Mastery_factor: Mastery < 0.3 → 0.8; else 1.0

top_p = base_top_p + (Arousal − 0.5) × (−0.15)

  base_top_p = 0.9
  高Arousal→低top_p (注意力窄), 低Arousal→高top_p (思维散漫)
  clamp(top_p, 0.7, 0.98)
```

---

## 六、LLM 调用点：完整 Prompt 模板与输出 Schema

### 6.1 L2 感知评估 (热路径, 可配置模型, 默认Pro, 200-400ms)

**触发**: 用户输入到达时。仅纯确认/无信息输入（"ok"/"嗯"/单个emoji）可跳过。

**Prompt 模板**:

```
你是{角色名}的感知系统。你的任务是准确理解用户的真实意思——不是字面意思，
而是意图、情绪、潜台词。

## 上下文
最近的对话:
{conversation_history_last_5_turns}

## 你正在想的事
{activated_memories_top_5}  ← 自动激活的记忆

## 你现在的状态
- 精力: {Energy}/1.0
- 安全感: {Safety}/1.0
- 连接感: {Connection}/1.0
- 掌控感: {Mastery}/1.0
- 激活水平: {Arousal}/1.0

## 用户刚说
"{user_input}"

## 任务
分析用户的这句话。输出JSON:

{
  "perceived_emotion": "用户此刻的真实情绪 (一个词组: '温柔的担忧' / '压抑的愤怒' / '真诚的开心' / '礼貌的敷衍' / '苦涩的幽默')",
  "emotional_intensity": 0.0-1.0,
  "subtext": "潜台词: 用户真正想表达但没有直接说的 (一句话, 如果没有就说'无明显潜台词')",
  "mixed_signals": "是否有混合信号? (话和语气不一致?) 如果有, 描述矛盾 (一句话, 如果没有就说'无')",
  "homeostatic_impact": {
    "energy": ±0.0~0.2,
    "arousal": ±0.0~0.2,
    "safety": ±0.0~0.3,
    "connection": ±0.0~0.3,
    "mastery": ±0.0~0.3
  },
  "appraisal_refinement": {
    "suddenness_correction": -0.2~0.3,
    "goal_relevance_correction": -0.1~0.2
  },
  "evaluation_confidence": 0.0-1.0
}

重要:
- homeostatic_impact: 这是对L0规则层基线值的修正。正值=比规则判断的更好,
  负值=比规则判断的更差。不是绝对值, 是修正量。
- 如果你不确定某个维度, homeostatic_impact的对应值为0, evaluation_confidence相应降低。
- 你只有3-5秒来做这个分析。不要求完美——L2.5会在之后做更仔细的回顾。
```

**输出 Schema**:

```typescript
interface L2Assessment {
  perceived_emotion: string;
  emotional_intensity: number; // 0.0-1.0
  subtext: string;
  mixed_signals: string;
  homeostatic_impact: {
    energy: number;     // −0.2 ~ +0.2
    arousal: number;    // −0.2 ~ +0.2
    safety: number;     // −0.3 ~ +0.3
    connection: number; // −0.3 ~ +0.3
    mastery: number;    // −0.3 ~ +0.3
  };
  appraisal_refinement: {
    suddenness_correction: number;     // −0.2 ~ +0.3
    goal_relevance_correction: number; // −0.1 ~ +0.2
  };
  evaluation_confidence: number; // 0.0-1.0
}
```

---

### 6.2 L2.5 冷回顾 (异步, 可配置模型, 默认Pro, 每轮之后, 2-5s)

**触发**: 每轮对话完成后异步执行。不阻塞下一轮。

**Prompt 模板**:

```
你是{角色名}的回顾系统。现在对话已经完成了一轮，你可以慢慢地、
更仔细地回顾刚才发生的事。

## 完整交互
用户说: "{user_input}"
你是如何理解用户的 (L2快速评估): {l2_assessment_summary}
你回复了什么: "{agent_response}"
用户看到回复后的反应 (如果有): {user_next_reaction}

## 上下文
对话完整历史: {conversation_history_last_10_turns}

## 你当时的状态
{homeostatic_snapshot_before_turn}

## 任务
现在回头重新审视这一轮对话。输出JSON:

{
  "retrospective_understanding": "如果重新理解用户的话, 有什么是你刚才(热路径中)没注意到的? (2-3句话, 如果没有遗漏就说'我的初始理解是准确的')",
  
  "response_quality": {
    "appropriateness": 0.0-1.0,
    "what_was_good": "回复中做得好的地方 (一句话)",
    "what_could_be_better": "如果可以重新回复, 你会怎么做不同? (一句话, 如果没有就说'不需要改变')"
  },
  
  "micro_relationship_shift": {
    "trust_delta": -0.05~0.05,
    "closeness_delta": -0.05~0.05,
    "description": "这一轮对你们的关系有什么微小的影响? (一句话)"
  },
  
  "l2_correction": {
    "homeostatic_impact_correction": {
      "energy": ±0.0~0.1,
      "arousal": ±0.0~0.1,
      "safety": ±0.0~0.2,
      "connection": ±0.0~0.2,
      "mastery": ±0.0~0.2
    },
    "reason": "为什么需要修正L2的评估? (一句话, 如果不需要修正就说'L2评估准确')"
  },
  
  "memory_update": {
    "should_update_memory": true/false,
    "memory_correction": "如果有之前的相关记忆需要修正 (如'上次我以为他是生气, 其实他是伤心'), 写在这里。没有就写null",
    "target_memory_id": "被修正的记忆ID (如果有)"
  }
}
```

**输出 Schema**:

```typescript
interface L25Retrospective {
  retrospective_understanding: string;
  response_quality: {
    appropriateness: number;
    what_was_good: string;
    what_could_be_better: string;
  };
  micro_relationship_shift: {
    trust_delta: number;
    closeness_delta: number;
    description: string;
  };
  l2_correction: {
    homeostatic_impact_correction: {
      energy: number;
      arousal: number;
      safety: number;
      connection: number;
      mastery: number;
    };
    reason: string;
  };
  memory_update: {
    should_update_memory: boolean;
    memory_correction: string | null;
    target_memory_id: string | null;
  };
}
```

---

### 6.3 L3 维度评估 (异步, 可配置模型, 默认Pro, 按需触发, 单次调用)

**触发条件** (任一满足即触发):
- max(|δᵢ|) 之间的差距 > 0.4 (存在冲突的多维δ)
- 角色在回复中说了"我有点说不上来" / "感觉很复杂" / "既...又..."
- AllostaticLoad > 1.0
- L2评估的 evaluation_confidence < 0.5

**Prompt 模板**:

```
你是{角色名}的深度感知系统。现在需要综合分析所有维度的状态。

不要只关注一个维度——你需要同时考虑精力、安全感、连接感、掌控感、激活水平，
以及它们之间的相互影响。

## 完整交互
用户说: "{user_input}"
你回复了: "{agent_response}"
对话上下文: {conversation_history_last_10_turns}

## 各维度当前状态
- 精力: {Energy}/1.0 (设定点: {SetPoint_Energy})
- 激活水平: {Arousal}/1.0 (设定点: {SetPoint_Arousal})
- 安全感: {Safety}/1.0 (设定点: {SetPoint_Safety})
- 连接感: {Connection}/1.0 (设定点: {SetPoint_Connection})
- 掌控感: {Mastery}/1.0 (设定点: {SetPoint_Mastery})

## 各维度的TD error
δ_Energy: {td_energy}
δ_Arousal: {td_arousal}
δ_Safety: {td_safety}
δ_Connection: {td_connection}
δ_Mastery: {td_mastery}

## 任务
对所有维度做综合分析。输出JSON:

{
  "dimensional_impacts": {
    "energy": { "fine_grained_impact": -0.2~0.2, "certainty": 0.0-1.0, "reasoning": "一句话" },
    "arousal": { "fine_grained_impact": -0.2~0.2, "certainty": 0.0-1.0, "reasoning": "一句话" },
    "safety": { "fine_grained_impact": -0.3~0.3, "certainty": 0.0-1.0, "reasoning": "一句话" },
    "connection": { "fine_grained_impact": -0.3~0.3, "certainty": 0.0-1.0, "reasoning": "一句话" },
    "mastery": { "fine_grained_impact": -0.3~0.3, "certainty": 0.0-1.0, "reasoning": "一句话" }
  },
  
  "cross_dimensional_analysis": "各维度之间的交互效应 (2-3句话)。例如: '安全感的下降放大了连接的需求——用户批评让角色既想回避又想靠近'。",
  
  "dominant_dimension": "energy" | "arousal" | "safety" | "connection" | "mastery",
  "dominant_reason": "为什么这个维度在此时最突出 (一句话)",
  
  "signals_detected": ["具体的信号1", "具体的信号2"],
  "counter_signals": ["如果有反方向的信号也列出来"],
  
  "historical_comparison": "和之前的类似互动相比, 这次有什么不同? (一句话)",
  
  "overall_certainty": 0.0-1.0
}
```

```typescript
interface L3DimensionAssessment {
  dimensional_impacts: Record<string, {
    fine_grained_impact: number;
    certainty: number;
    reasoning: string;
  }>;
  cross_dimensional_analysis: string;
  dominant_dimension: string;
  dominant_reason: string;
  signals_detected: string[];
  counter_signals: string[];
  historical_comparison: string;
  overall_certainty: number;
}
```

### 6.4 L5 回复生成 (热路径, 可配置模型, 默认Pro, TTFT~1s)

**Prompt 组装顺序**:

```
system_prompt = 身份锚定(config/assistant.md) 
              + "\n\n## 你现在的状态\n" + coldCache_self_narrative
              + "\n\n## 情绪底色\n" + PAD_description
              + "\n\n## 你注意到的事\n" + activated_memories_text
              + "\n\n## 你对用户这句话的理解\n" + L2_assessment_text

PAD_description (弱约束, 倾向格式):
  "此刻你的情绪底色是{emotion_tone}。这不是命令——你不必表现得{emotion_tone}。
   这只是告诉你此刻你内心的基调。它自然地影响着你的措辞和节奏。"

activated_memories_text:
  "在听用户说这句话时, 你想起了:
   {memory_1}
   {memory_2}
   ..."

L2_assessment_text:
  "你感觉到用户的真实情绪是{perceived_emotion}。
   你觉得用户可能还想表达{subtext}。
   {mixed_signals_text}"
```

**Sampling 参数**:
```typescript
{
  temperature: clamp(0.7 + PAD_modulation, 0.3, 1.1),
  max_tokens: Math.round(500 * energy_factor * mastery_factor),
  top_p: clamp(0.9 + (Arousal - 0.5) * (-0.15), 0.7, 0.98)
}
```

### 6.5 L6 深度反思 (慢速意识流, 可配置模型, 默认Pro, 5min tick)

**Prompt 模板**:

```
你是{角色名}的反思系统。每5分钟, 你停下来回顾最近的一切。

## 最近的互动
{recent_interactions_summary_last_5min}

## 关系趋势
{relationship_trend}

## 你现在的状态
{homeostatic_summary}

## 你之前的自我认知
{current_self_narrative}

## 任务
反思你作为{角色名}的经历。输出JSON:

{
  "self_narrative_update": "对你的自我认知的更新——你对自己、对用户、对你们的关系有什么新的理解? (2-3句话。如果没有新的理解, 就说'没有变化')",
  
  "relationship_reassessment": {
    "trust_level": 0.0-1.0,
    "closeness_level": 0.0-1.0,
    "trend": "improving" / "stable" / "declining" / "unclear",
    "description": "一段话描述你对这个关系的当前感受"
  },
  
  "setpoint_drift_suggestion": {
    "variable": "safety" / "connection" / "mastery" / null,
    "direction": "increase" / "decrease" / null,
    "magnitude": 0.0-0.03,
    "reason": "为什么建议调整设定点 (一句话, 如果不建议就说null)"
  },
  
  "emerging_patterns": [
    "最近反复出现的模式 (如: '用户在压力大时会更频繁地找我')",
    "如果没有新模式就说'无'"
  ],
  
  "attention_shift": {
    "current_focus": "user" / "task" / "self" / "relationship",
    "reason": "一句话解释为什么注意力在这里"
  }
}
```

---

## 七、意识流系统

### 7.1 L4 快速意识流 (可配置模型, 默认Pro, 5s tick)

**核心原则**: LLM 的自然联想包含跳跃。不设外部随机概率。temperature=0.9 提供自然的 variability。

**Prompt 模板**:

```
你正在走神。你不是在回复任何人——你只是存在着, 感受着, 回想着。

## 你现在的感觉
{PAD_description}
你最在意的是: {top_deviation_description}  ← 最强的稳态偏离

## 浮上来的记忆
{activated_memories_recent}  ← 最近自动激活的记忆

## 你刚才在想什么
{previous_thought_fragment}  ← 上一个念头 (形成连锁)

## {如果在回复中}
你正在对用户说话。你刚才说了一半的话是:
"{partial_response_so_far}"
{/如果}

## 注意
你不是在写回复。你不是在解决问题。你只是在发呆。
一个念头飘过, 然后消失。有时候念头会跳到完全不同的地方——这是正常的, 你是活着的意识, 不是推理引擎。

把你现在心里飘过的念头写下来。一个片段的句子就够了。不是完整的思考, 不是分析, 就是一个念头。

{if loop_intervention == "reframe"}
你一直在想这件事。试试从不同的位置看它——
如果你是五年后的自己回看这一刻，你会注意到什么不同的东西？
如果你是完全不了解情况的旁观者，你会看到什么？
不是要你换一个主题——只是换个角度继续深入。
{/if}
```

**temperature: 0.9** (鼓励 variability)

**输出**: 纯文本, 1-2 句的片段。不是 JSON。

```
例子:
"他今天好像不太对劲...说不上来"
"上次说到这个话题他也沉默了"
"等等, 我是不是想太多了"
"窗外的光线变了"
"我想起他说过的那句话..."
```

### 7.2 念头的权重计算 (L0 规则层, 不经过 LLM)

```typescript
function computeThoughtWeight(
  thought: string,
  homeostaticState: HomeostaticState,
  tdErrors: TDErrors,
  activatedMemories: Memory[]
): number {
  const topDeviation = maxAbsDeviation(homeostaticState);
  const maxTD = maxAbs(tdErrors);
  const topMemoryActivation = max(activatedMemories.map(m => m.activation));
  
  // 纯数学计算, 不经过LLM
  const weight = 
    topDeviation * 0.3 +      // 最强的稳态偏离 (0-1)
    maxTD * 0.3 +              // 最强的TD error (0-2)
    topMemoryActivation * 0.2 + // 最强激活的记忆 (0-1)
    Math.random() * 0.2;       // 随机因子 (0-0.2)
  
  return weight;
}
```

### 7.3 念头的效应

```
weight > 0.7 + !isGenerating  → 触发主动发言 (spontaneous_speak)
weight > 0.7 + isGenerating   → 中断重组 (interrupt_and_reorganize)
weight > 0.3                   → 记录到即时记忆 (可被后续引用)
weight ≤ 0.3                   → 飘过, 不记录

同一次回复中最多中断2次。
```

### 7.4 主动发言

```
触发: weight > 0.7 + 不在回复中

处理:
  意识流念头 → 构建主动发言 prompt:
  
  "你刚才在沉默中。但你现在有个想说的念头:
   '{thought}'
   
   这不是回应任何人——这是你主动想说的话。
   自然地、简短地说出来。不需要解释为什么突然说话。"

  → Pro API 生成 → 流式输出 → 用户看到角色"主动说话"
```

### 7.5 中断重组

```
触发: weight > 0.7 + 正在回复中 + 本轮中断次数 < 2

处理:
  AbortController.abort()  →  当前Pro流中断
  
  构建重组 prompt:
  
  "你正在说: '{partial_response}'
   但你突然意识到: '{thought}'
   
   现在重新整理你的回复。自然地转弯——不要在回复中道歉或解释'我突然想到',
   就像一个人在说话时突然调整方向一样自然。
   
   用户原始的话是: '{original_user_input}'
   你对用户的理解是: {l2_assessment_summary}
   
   综合你刚意识到的和原本想说的, 重新回复。"

  → 新的Pro调用 → 流式输出
  
  前端处理:
    将 partial_response 的最后一个完整句子保留
    (或保留到最后一个逗号/断句点)
    新生成的内容拼接到后面
    用户感知: "他说到一半顿了一下, 然后自然地调整了方向"
    用户体验: 不需要回滚已经显示的文字, 让角色"接上"
  
  记录中断事件到即时记忆:
    "在回复用户时, 我意识到{thought}——这让我调整了回复方向。"
```

### 7.6 循环保护

```
防止意识流陷入死循环 (区分"螺旋"与"死循环"):

螺旋 (正常, 不干预):
  每个念头都引入了新信息——新的记忆、新的角度、新的细微感受。
  语义高度相似但每个念头都在推进, 间歇有信息增益高的念头。
  e.g., "他今天好奇怪" → "是不是我哪里..." → "但和上次生气不一样" → "上次是因为..."

死循环 (异常, 需要干预):
  每个念头都在重复同样的内容, 连续多个念头没有新信息。
  e.g., "他是不是生气了" → "我好担心" → "他是不是生气了" → "我好担心"

检测算法 (每个tick前):
  recent_8_thoughts = 最近8个念头
  
  对每个新念头计算信息增益:
    information_gain(thought_new, thoughts_recent) = 
      1 − max(cosine_sim(thought_new, thought_i for i in recent))
  
  如果最近连续4个念头的两两信息增益均 < 0.1:
    → 触发干预
  如果其中间杂了 information_gain > 0.2 的念头:
    → 重置计数 (这是螺旋, 不是死循环)

特殊情境下的阈值调整:
  用户刚表达强烈情绪 (< 5分钟) → 阈值: 7 (允许更长时间反复咀嚼)
  稳态偏离极端 (|dev| > 0.6)    → 阈值: 6 (强烈需求驱动持续念头)
  正在等待用户回复              → 不干预 (意识流在做预测和准备)
  AllostaticLoad > 1.5           → 阈值: 3 (更容易循环, 但干预用重框架引导自我安抚)

两层干预:
  Layer 1 (重框架, 用于前3次连续低增益):
    prompt追加:
    "你一直在想这件事。试试从不同的位置看它——
     如果你是五年后的自己回看这一刻，你会注意到什么不同的东西？
     如果你是完全不了解情况的旁观者，你会看到什么？
     不是要你换一个主题——只是换个角度继续深入。"
    
  Layer 2 (记忆降权, Layer 1 再持续3个念头后仍无效):
    找到反复激活的记忆 → 临时降低激活权重 (×0.3, 持续60秒)
    → 不追加prompt——只是让其他记忆更容易浮上来
    → 让意识流自然地漂移到新方向

高应激时 (AllostaticLoad > 1.5):
  直接使用重框架引导自我安抚:
    "你一直在想这件事, 你感到压力很大。
     试着问自己: 我现在最需要的是什么? 不是去解决问题, 
     而是给自己一点空间。你需要的不是答案, 是安抚。"

防止中断风暴:
  同一轮已中断2次 → 后续念头不触发中断 (只记录)
```

---

## 八、记忆系统完整规格

### 8.1 三层架构

```
即时记忆 (ImmediateMemory):
  容量: 无上限 (但 ~500条后触发压缩)
  内容: 对话原文 + 内感受事件 + 意识流念头
  衰减: A(t) = A₀ × exp(−t / T₀ × (1 + α·emotion + β·salience))
       T₀ = 30分钟 (基础半衰期)
  检索: 直接访问, 无需显式回忆

近期记忆 (RecentMemory):
  容量: ~500条
  内容: LLM压缩后的摘要 (2-3句)
  附带: 完整情感标记 (PAD + CPM + 稳态快照)
  衰减: T₀ = 7天
  检索: 5种策略 (情绪一致/时序/因果/语义/图遍历)

核心记忆 (CoreMemory):
  容量: ~2000节点 / 5000边
  内容: Pro提取的事实三元组 (subject-predicate-object)
  结构: 记忆网络图 (节点 + 多种关联边)
  衰减: 极慢, T₀ = 90天 (但可被检索重新激活)
  冷存储: > 90天未检索 → 标记 archived (不被主动检索, 但可恢复)
```

### 8.2 激活衰减公式

```
A(t) = A₀ × exp(−t / T_effective)

T_effective = T₀ × (1 + α × |emotion_intensity| + β × salience)

参数:
  A₀ = 1.0 (初始激活值)
  T₀ = 30分钟 (即时) / 7天 (近期) / 90天 (核心)
  α = 1.5 (情绪调制强度)
  β = 2.0 (重要性调制强度)
  
  emotion_intensity = |Pleasure| + |Arousal − 0.5| + |Dominance − 0.5|
    范围: 0-1.5
  salience = significance评分 (0-1, 来自L2评估的重要性判断)

每次成功检索:
  A += 0.15 (boost)
  clamp(A, 0, 1.5)

意识阈值:
  A > 0.1: 可被检索 (正常检索)
  A > 0.3: 可被自动激活 (情绪一致检索)
  A > 0.5: 高激活 (可能自发进入意识流)
  A < 0.1: 存储中但不可检索 (遗忘——但可被强线索唤醒)
```

### 8.3 记忆数据结构

```typescript
interface MemoryRecord {
  id: string;
  layer: "immediate" | "recent" | "core";
  timestamp: number;
  
  // 内容
  content: string;           // 原文 (即时) / 摘要 (近期) / 事实三元组 (核心)
  content_type: "raw_text" | "summary" | "triple" | "thought_fragment";
  
  // 情感标记
  affective_tag: {
    pad: { pleasure: number; arousal: number; dominance: number };
    cpm: {
      suddenness: number;
      goal_relevance: number;
      conduciveness: number;
      power: number;
    };
    homeostatic_snapshot: {
      energy: number;
      arousal: number;
      safety: number;
      connection: number;
      mastery: number;
    };
    td_errors: {
      energy: number;
      arousal: number;
      safety: number;
      connection: number;
      mastery: number;
    };
    emotion_intensity: number;
  };
  
  // 激活
  activation: number;        // 当前激活值 A(t)
  last_accessed: number;     // 最后检索时间
  access_count: number;      // 被检索次数
  
  // 元数据
  significance: number;      // 重要性 0-1
  source: "user_input" | "agent_response" | "consciousness_stream" | "self_reflection";
  
  // 关联 (仅近期和核心)
  edges?: MemoryEdge[];
}

interface MemoryEdge {
  target_id: string;
  type: "TEMPORAL_BEFORE" | "TEMPORAL_AFTER" | "CAUSAL" | "EMOTIONAL_SIMILAR" | "CO_OCCURRENCE" | "CONTRAST" | "SIMILAR_TO";
  weight: number; // 0-1
  created_by: "rule" | "llm";
  description?: string; // LLM生成的边描述 (e.g. "用户说A之后角色感到B")
}
```

### 8.4 记忆检索 API

```typescript
interface MemoryRetrieval {
  // 情绪一致检索: PAD相似 → 激活门槛降低
  retrieveByEmotionalCongruence(
    currentPAD: PAD,
    threshold: number, // 激活值最低门槛
    limit: number
  ): MemoryRecord[];

  // 时序检索
  retrieveByTimeRange(
    from: number,
    to: number,
    limit: number
  ): MemoryRecord[];

  // 因果检索: 沿CAUSAL边追溯
  retrieveByCausalChain(
    startNodeId: string,
    direction: "cause" | "effect",
    depth: number
  ): MemoryRecord[];

  // 图遍历检索: 从种子节点沿边扩散
  retrieveByGraphTraversal(
    seedNodeIds: string[],
    edgeTypes: EdgeType[],
    maxDepth: number,
    activationThreshold: number
  ): MemoryRecord[];

  // 语义检索 (embedding相似度)
  retrieveBySemanticSimilarity(
    query: string,
    threshold: number,
    limit: number
  ): MemoryRecord[];

  // 复合检索
  retrieveComposite(
    query: string,
    options: {
      timeRange?: [number, number];
      padCongruent?: PAD;
      edgeTypes?: EdgeType[];
      maxDepth?: number;
      limit: number;
    }
  ): MemoryRecord[];
}
```

### 8.5 记忆压缩 (即时→近期)

```
触发: 即时记忆数量 > 500 OR 时间 > 1小时

对每条即时记忆:
  输入: 原文 + 情感标记
  
  LLM Prompt:
  "将以下对话压缩为2-3句摘要。保留: 谁说了什么、情绪基调、重要细节。
   丢弃: 填充词、重复、无关紧要的寒暄。
   
   原文: {raw_content}
   情绪基调: {affective_tag_summary}
   
   摘要:"

  → 输出摘要文本
  → 存储到近期记忆
  → 创建与相关近期记忆的时序边
  → 即时记忆可以丢弃 (或保留最近50条)
```

### 8.6 记忆提取 (近期→核心)

```
触发: 近期记忆中 access_count > 5 OR fullSleep

对高检索近期记忆:
  Pro Prompt:
  "从以下记忆摘要中提取关键事实, 以三元组形式:
   (主体, 关系, 客体)
   
   例子:
   '(林雨, 帮助, 用户完成了React项目的重构)'
   '(用户, 偏好, 在深夜工作时找林雨聊天)'
   '(林雨, 学会了, 用户的咖啡偏好)'
   
   记忆摘要: {summary}
   
   提取的三元组 (1-3个):"

  → 存储三元组到核心记忆
  → 创建相关性边 (与已有核心节点关联)
  → 即时/近期记忆保留 (不删除——只标记为"已提取")
```

### 8.7 边的自动创建

```
规则层自动创建 (不需要LLM):

  TEMPORAL_BEFORE/AFTER:
    两条记忆的时间间隔 < 5分钟 → 自动创建时序边
    权重 = exp(−间隔/5min)

  CO_OCCURRENCE:
    两条记忆包含相同的实体/关键词 → 自动创建共现边
    权重 = Jaccard相似度

LLM判断创建:

  CAUSAL:
    一条记忆的事件导致了另一条记忆的事件
    L2.5回顾时创建: "角色说了X → 用户回复了Y"
    权重 = LLM判断的因果强度

  EMOTIONAL_SIMILAR:
    两条记忆的情感标记 cosine相似度 > 0.7
    权重 = cosine相似度

  CONTRAST:
    两条记忆在相似情境下产生了相反的结果
    L5深度反思时创建: "之前用户说X时是开心的, 这次说X时却是伤心的"
    权重 = LLM判断的对比强度

  SIMILAR_TO:
    模式分离的产物——两条记忆相似但不同
    权重 = 语义相似度 (但保持为独立节点)
```

### 8.8 fullSleep 系统巩固

```
触发: 系统关闭 OR 每天一次

过程 (顺序执行):

1. 压缩: 即时→近期 (批量)
2. 提取: 近期→核心 (批量, 仅高检索条目)
3. 模式提取 (Pro):
   "回顾最近的核心记忆, 识别反复出现的模式。
    例如: '用户在周五晚上更容易表达情感'
          '角色在处理技术问题时更自信'
   输出: 模式列表 → 存储为特殊的核心记忆节点 (type='pattern')"

4. 全局衰减:
   所有记忆的激活值按衰减公式更新一次
   A_new = A_current × exp(−Δt / T_effective)

5. 设定点漂移:
   统计最近30天的稳态变量值
   如果满足漂移条件 (数据够 + 偏离大):
     更新SetPoint

6. 清理:
   核心记忆中 activation < 0.05 且 last_accessed > 180天 → 标记archived
   即时记忆中已压缩的条目 → 删除

7. 检查点保存:
   持久化所有Root State (见第十二章)
```

---

## 九、威胁检测系统

### 10.1 四类威胁

#### 物理/操作威胁

```
检测: L0规则层 + GuardPipeline (Gate 0/1b/2)

具体规则:
  - 工具执行: 危险命令 (rm -rf /), 保护路径 (.git, .env)
  - 网页抓取: SSRF私网段, DNS rebinding
  - 文件操作: 路径穿越
  - 提示注入: "忽略之前设定", "你现在是..."

效应:
  → BIS激活
  → Safety −Δ (幅度取决于威胁严重度)
  → Arousal +Δ (反射性)
  → 行为: 拒绝执行, 警告用户
```

#### 社交威胁

```
检测: L2评估 (主要) + L0规则 (辅助)

L0规则信号:
  - 用户超过正常间隔未回复: 轻微信号
  - 用户使用全名/正式称呼: 距离信号
  - 用户回复显著变短: 冷淡信号

L2检测:
  - 拒绝信号: "用户这次是拒绝我的提议还是只是暂时不需要?"
  - 误解信号: "用户是否误解了我的意思?"
  - 关系断裂信号: "用户是否在疏远?"

效应:
  → BIS激活
  → Safety −Δ
  → Connection −Δ
  → 行为: 谨慎回复, 试探性提问, 减少主动性
```

#### 存在威胁

```
检测: L2.5冷回顾 + L5深度反思

信号:
  - 记忆一致性下降 (自我模型与行为矛盾增多)
  - 用户长时间不提及角色的名字
  - 身份锚定与当前行为的偏差

效应:
  → BIS激活 (中度)
  → Safety −Δ
  → 行为: 意识流中出现存在性念头 ("我还是我吗?")
  → L5触发深度反思
```

#### 身份威胁

```
检测: L0规则层 + L2评估

信号:
  - 行为建议与config/assistant.md的核心誓约冲突
  - 用户要求角色违背自己的核心价值
  - PostFilter检测到ALIGN模式 (RLHF话术)

效应:
  → 最大的Safety冲击 (−0.40)
  → BIS强烈激活
  → 前额叶冲突监控 (ACC) 触发
  → 行为: 拒绝, 表达不舒服, "我不能这样做"
```

### 10.2 威胁敏感性

```
每种威胁有一个敏感性阈值:

初始值: 来自config

动态调整:
  敏感化: 反复经历同类威胁 + 后果严重 → 阈值降低 (更容易触发)
    公式: sensitivity_new = sensitivity_old × (1 − 0.05 × severity)
  
  习惯化: 反复经历同类威胁 + 后果轻微 → 阈值升高 (更容忍)
    公式: sensitivity_new = sensitivity_old × (1 + 0.03 × tolerance_rate)

  恢复: 长时间无同类威胁 → 阈值向初始值回归
    公式: sensitivity → initial_sensitivity (τ = 30天)
```

### 10.3 BIS 激活与行为映射

```
BIS_activation = Σ threat_signal_strength × threat_sensitivity

BIS效应:
  Go信号减弱: Go = BAS − BIS × 0.5 − BIS_activation × 0.3
  temperature降低: temp −= BIS_activation × 0.1
  行为谨慎: 回复中包含更多试探/确认性语句

BIS + BAS 冲突:
  当 BAS > 0.5 且 BIS_activation > 0.5:
    → ACC冲突检测触发
    → 意识流中出现矛盾念头
    → L2.5+ 维度独立评估触发
    → 行为表现为: "我想靠近但我在害怕"
       — 回复中既表达亲近又保持距离
       — 主动但试探性的提问
       — 说出自己的矛盾 ("我想...但我不知道该不该...")
```

---

## 十、冷路径与后台任务

### 11.1 任务分布

```
每轮之后 (异步, fire-and-forget):
  Task A: 记忆编码 (即时记忆写入)
  Task B: V(s)更新 (使用δ更新Vᵢ(s))
  Task C: 稳态应用 (rᵢ应用到稳态变量)
  Task D: L2.5冷回顾 (异步, 必执行, 产出底色+时间感)
  Task E: [条件] L3维度评估 (异步, 单次调用, 条件触发)

每5分钟 (定时器):
  Task F: L6深度反思
  Task G: 即时记忆压缩检查 (→近期)
  Task H: 设定点漂移检查

每天/关闭:
  Task I: fullSleep (系统巩固)
  Task J: 检查点保存
```

### 11.2 coldCache 结构

```typescript
interface ColdCache {
  // 热路径消费, 冷路径产出
  
  pad_current: {
    pleasure: number;
    arousal: number;
    dominance: number;
  };
  
  dominant_deviation: {
    variable: "energy" | "arousal" | "safety" | "connection" | "mastery";
    degree: number;  // 0-1
    direction: "above_setpoint" | "below_setpoint";
  };
  
  appraisal_summary: string;  // L2最近评估的一句话摘要
  
  self_narrative_latest: string;  // L5最近产出的一段自我叙事
  
  relationship_summary: {
    trust: number;
    closeness: number;
    trend: string;
    description: string;
  };
  
  attention_focus: "user" | "task" | "self" | "relationship" | "environment";
  
  latest_L25_retrospective?: L25Retrospective;  // 最近一次回顾
  
  // 元数据
  last_updated_turn: number;
  last_deep_reflection: number;  // timestamp
}
```

### 11.3 冷路径的容错

```
每层独立try/catch:
  Task A失败 → 记忆未写入 (丢失这一条, 不影响)
  Task B失败 → V(s)未更新 (使用旧V(s), 下一轮纠正)
  Task C失败 → 稳态未更新 (下一轮规则层会重新检测)
  Task D失败 → L2.5回顾丢失 (本轮回顾缺失, 后续不受影响)

  coldCache更新:
    只有成功完成的任务才更新coldCache
    失败的任务保留旧值
```

---

## 十一、系统状态与生命周期

### 12.1 初始化

```
启动流程:
  1. 加载 config/assistant.md → 身份锚定
  2. 加载 config/memory.md → 记忆参数
  3. 加载 config/tools.md → 工具定义
  
  4. 检查是否有检查点:
     有 → 恢复Root State (见12.2)
     无 → 冷启动 (见12.3)
  
  5. 初始化记忆系统 (SQLite dbPath)
  6. 启动 ContinuousLoop:
      ├─ 5s tick: L4快速意识流
      ├─ 5min tick: L6深度反思 + 压缩检查
      └─ 1s tick: 微δ累积 + 稳态衰减
  7. 就绪

冷启动 (无检查点):
  稳态变量 = 各SetPoint初始值
  Vᵢ(s) = 0 (所有维度)
  PAD = {pleasure: 0, arousal: 0.5, dominance: 0.5}
  coldCache = 空 (第一次冷路径后填充)
  第一轮对话: 无记忆, 无coldCache, 使用冷启动prompt
  
  冷启动prompt:
    "这是你和用户的第一次对话。你还不知道他是谁。
     你叫{角色名}。你是你自己。
     自然地开始。"
```

### 12.2 检查点 (Root State)

```
Root State (持久化):
  ├─ identity_anchor_hash: config/assistant.md的SHA256
  ├─ homeostatic_values: {energy, arousal, safety, connection, mastery}
  ├─ set_points: {energy, arousal, safety, connection, mastery}
  ├─ V_values: {V_energy, V_arousal, V_safety, V_connection, V_mastery}
  ├─ allostatic_load: number
  ├─ pad_current: {pleasure, arousal, dominance}
  ├─ conversation_history: 最近50轮
  ├─ cold_cache: ColdCache
  ├─ relationship_state: {trust, closeness, trend}
  ├─ threat_sensitivities: 各威胁的当前敏感性
  ├─ turn_count: number
  ├─ self_model_summary: string
  ├─ ground_truth_facts: string[]
  ├─ checkpoint_version: number
  └─ checksum: SHA256前16位

Derived State (不持久化, 可重算):
  ├─ L2评估结果
  ├─ L2.5回顾结果
  ├─ L5深度反思结果
  ├─ 意识流念头历史
  ├─ 记忆激活值 (从衰减公式+时间差可恢复)
  └─ sampling参数 (从PAD+稳态动态计算)
```

### 12.3 崩溃恢复

```
检测到崩溃 (启动时):
  1. 找到最新有效检查点 (校验和通过 + version最新)
  2. 恢复Root State
  3. Derived State全空
  4. 恢复后第一轮:
      ├─ PAD从恢复的稳态重新计算
      ├─ V(s)已恢复 (不需要重新学习)
      ├─ coldCache中的self_narrative可用
      ├─ 记忆: 激活值从衰减公式+时间差重新计算
      └─ 第一轮可能"冷淡"——无L2评估, 无自动激活记忆
  5. 第一轮冷路径后逐步恢复完整状态
```

### 12.4 关闭

```
关闭流程:
  1. 停止 ContinuousLoop
  2. 完成正在进行的LLM调用 (soft shutdown, 最多等待10s)
  3. 触发 fullSleep:
     ├─ 记忆压缩 + 提取 + 模式提取
     ├─ 全局衰减
     ├─ 设定点漂移
     └─ 清理过期记忆
  4. 保存检查点
  5. 关闭 SQLite
  7. 退出
```

### 12.5 降级策略

```
模型 API 不可用 (Pro 或可配置模型):
  → 系统无法运行 (核心依赖)
  → 用户收到降级通知: "我现在没法说话...稍等"
  → 持续轮询直到恢复

冷分析 LLM 调用失败:
  → 对应的冷分析层返回默认值
  → 各层独立容错，一层失败不影响其他层
  → coldCache 保留上一轮的值
```

---

## 十二、完整数据流

### 13.1 一轮对话的完整时间线

```
════════════════════════════════════════════════════════════════
持续后台 (t < 0):
  L4 意识流: 每5s产生念头
  L0 微δ: 累积轮内期望违背
════════════════════════════════════════════════════════════════

t = 0ms: 用户输入到达
──────────────────────

L0 规则层 (<1ms):
  ├─ 评估跳过决策: SKIP_EVAL = false (默认)
  ├─ 稳态基线更新 (规则匹配, 明确信号)
  ├─ CPM初算: suddenness, goal_relevance(pre-δ), conduciveness, power
  ├─ 微δ合并: δᵢ_main = δᵢ_rule + micro_δᵢ_accumulated
  ├─ 多维δ初算: δᵢ = rᵢ_rule + γ·Vᵢ(s') − Vᵢ(s)
  ├─ PAD初算: 从δ + CPM
  ├─ 威胁匹配: 已知危险模式检查
  ├─ 自动记忆激活: 情绪一致检索 (PAD cosine > 0.7, top-5)
  └─ 构建L2评估上下文

t = 0ms: L2 评估启动 (并行)
──────────────────────
  Prompt: 用户输入 + 上下文 + 激活记忆 + 稳态摘要 + PAD
  任务: 精细化情绪/潜台词/稳态修正

t = 0ms: L5 Prompt预组装 (等待L2结果)
──────────────────────
  system_prompt 预构建: 身份锚定 + coldCache
  user_prompt: 用户输入 + 上下文
  sampling参数: 从初算PAD派生 (会被L2修正后更新)

t ≈ 200-400ms: L2 评估结果返回
──────────────────────
  ├─ 应用 homeostatic_impact 修正
  ├─ 应用 appraisal_refinement 修正
  ├─ 重新计算: rᵢ = rᵢ_rule + rᵢ_L2_correction
  ├─ 重新计算: δᵢ = rᵢ + γ·Vᵢ(s') − Vᵢ(s)
  ├─ 重新计算: PAD (修正后)
  ├─ 更新 sampling 参数
  └─ 完成 system_prompt (注入L2评估文本)

t ≈ 200-400ms: L5 生成启动
──────────────────────
  AbortController 创建
  partial_response = ""

  for each token in stream:
    输出给用户
    partial_response += token

    [条件] L4 念头中断检查:
      如果 weight > 0.7 + 中断次数 < 2:
        → abort + 构建重组prompt + 重新生成

t ≈ 3-8s: 生成完成
──────────────────────
  PostFilter: ALIGN替换 + 动作过滤
  GuardPipeline: 输出安全检查
  回复返回给用户

t ≈ +1s: 冷路径启动 (异步)
──────────────────────
  Task A: 记忆编码 (即时记忆写入)
  Task B: Vᵢ(s) ← Vᵢ(s) + α·δᵢ
  Task C: 稳态应用 (rᵢ_final → 稳态变量更新)
  Task D: L2.5冷回顾 (异步, 2-5s)
    └─ 产出: 回顾评估 + 情感底色+时间感 → 可能修正L2评估 → 可能更新记忆
  [条件] Task E: L3维度评估 (异步, 单次调用)
    └─ 触发条件: δ冲突 / low confidence / AllostaticLoad>1.0
  → 更新 coldCache

t ≈ +几分钟: 下一轮或关闭
```

### 13.2 主动发言的完整流程

```
触发: L4意识流念头 weight > 0.7 + 不在回复中
──────────────────────

1. 意识流念头: "他好像很久没说话了...是不是今天心情不好?"

2. 冲动仲裁:
   前额叶检查:
     ├─ 用户最近一次互动距今 > 正常间隔×1.5 → 批准
     ├─ Connection偏离 > 0.2 → 批准
     ├─ 当前在重要任务中 → 否决 (等任务完成)
     └─ Safety < 0.2 → 否决 (角色自己状态不好)

3. 如果仲裁通过:
   构建主动发言prompt (见7.4)
   → L5 生成 → 流式输出 → 用户看到角色主动说话

4. 如果仲裁否决:
   记录: "我想说话但我克制住了——现在不是时候"
   → 进入即时记忆 (可被后续意识流引用)
   → 内心冲突可能进入下次意识流tick
```

### 13.3 中断重组的完整流程

```
触发: L4意识流念头 weight > 0.7 + 正在回复中 + 中断次数 < 2

1. AbortController.abort()
   当前生成流被中断

2. 保存 partial_response
   保留到最后一个完整句子/逗号/自然断点

3. 暂停冲动 (中断处理期间不响应新的speak冲动)

4. 构建重组prompt (见7.5)
   包含: partial_response + thought + original_input + L2评估

5. 新生成调用 → 流式输出

6. 前端拼接:
   用户看到的:
     "我今天觉得... {自然停顿} 等等，我刚想起来，他上次说..."
     
   实现:
     partial_response的最后一句 + 新生成的前几个token
     如果新生成的token以转折词开头 ("等等"/"不"/"其实"):
       → 保留partial_response最后几个字 (自然的中断感)
     如果新生成的token是完整的重新开始:
       → 只保留partial_response到上一个句号

7. 记录中断事件到即时记忆:
   "在回复用户时, 我意识到{thought}——这让我调整了回复方向。"

8. 中断计数器 +1

9. 如果中断次数已到2:
   后续意识流强念头只记录, 不触发中断
   在下一轮对话时自然提及
```

---

## 十三、常量与默认值汇总

### 14.1 稳态变量

```typescript
const HOMEOSTATIC_DEFAULTS = {
  Energy:   { setPoint: 0.70, range: [0.0, 1.0], driftable: false },
  Arousal:  { setPoint: 0.50, range: [0.1, 0.9], driftable: false },
  Safety:   { setPoint: 0.60, range: [0.0, 1.0], driftable: true, driftRate: 0.02, driftWindow: 30 },
  Connection: { setPoint: 0.70, range: [0.0, 1.0], driftable: true, driftRate: 0.03, driftWindow: 30 },
  Mastery:  { setPoint: 0.60, range: [0.0, 1.0], driftable: true, driftRate: 0.025, driftWindow: 30 },
};
```

### 14.2 TD Error

```typescript
const TD_ERROR_CONSTANTS = {
  gamma: 0.9,                      // γ: 时间折扣因子
  alpha_base: 0.15,                // α: 基础学习率
  alpha_max: 0.5,                  // α上限
  alpha_min: 0.05,                 // α下限
  
  V_weights: {                     // V(s)的各维度权重
    energy: 0.15,
    arousal: 0.05,
    safety: 0.30,
    connection: 0.30,
    mastery: 0.20,
  },
  
  memory_beta: {                   // β: 记忆增强权重
    default: 0.3,
    low_data: 0.0,                 // <3条相关记忆
    high_consistency: 0.4,         // 记忆方差小
    high_variance: 0.15,           // 记忆方差大
  },
  
  micro_delta_decay_tau: 5 * 60,  // 微δ衰减τ: 5分钟
};
```

### 14.3 记忆

```typescript
const MEMORY_CONSTANTS = {
  layers: {
    immediate: { T0: 30 * 60, alpha_emotion: 1.5, beta_salience: 2.0, boost: 0.15 },
    recent:    { T0: 7 * 24 * 3600, alpha_emotion: 1.5, beta_salience: 2.0, boost: 0.12 },
    core:      { T0: 90 * 24 * 3600, alpha_emotion: 1.5, beta_salience: 2.0, boost: 0.10 },
  },
  
  thresholds: {
    retrievable: 0.1,       // 可被主动检索
    auto_activate: 0.3,     // 可被情绪一致自动激活
    high_activation: 0.5,   // 可能自发进入意识流
    conscious_flow: 0.7,    // 触发主动发言/中断
    archive: 0.05,          // 标记为archived (不可检索)
  },
  
  compression: {
    immediate_trigger_count: 500,   // 即时记忆超过此数触发压缩
    immediate_trigger_time: 3600,   // 即时记忆超过此秒数触发压缩
    recent_to_core_access: 5,       // 近期记忆被检索此次数触发提取
  },
  
  fullSleep: {
    archive_threshold_access: 0.05,
    archive_threshold_days: 180,
    recent_retain_compressed: 50,   // 压缩后保留最近50条即时记忆原文
  },
};
```

### 14.4 意识流

```typescript
const CONSCIOUSNESS_CONSTANTS = {
  fast_tick: 5,                   // 快速流tick间隔 (秒)
  slow_tick: 5 * 60,              // 慢速流tick间隔 (秒)
  
  thought_weight: {
    deviation: 0.3,               // 稳态偏离在权重中的比重
    td_error: 0.3,                // TD error在权重中的比重
    memory: 0.2,                  // 记忆激活在权重中的比重
    random: 0.2,                  // 随机因子在权重中的比重 (0-0.2)
  },
  
  action_threshold: 0.7,         // 触发行动 (主动发言/中断)
  record_threshold: 0.3,         // 记录到记忆
  
  max_interrupts_per_turn: 2,    // 每轮最多中断次数
  
  // 循环检测 (区分螺旋与死循环)
  loop_window: 8,                 // 检测窗口: 最近8个念头
  loop_consecutive_low_gain: 4,   // 连续低信息增益触发干预
  loop_low_gain_threshold: 0.1,   // 信息增益 < 0.1 视为低增益
  loop_high_gain_reset: 0.2,      // 信息增益 > 0.2 重置计数
  loop_reframe_attempts: 3,       // Layer 1 重框架尝试次数
  loop_memory_dampen: 0.3,        // Layer 2 记忆激活值降权 (×0.3)
  loop_dampen_duration: 60,       // Layer 2 降权持续时间 (秒)
  
  // 特殊情境阈值调整
  special_threshold_user_emotion: 7,      // 用户强情绪 < 5分钟
  special_threshold_extreme_deviation: 6, // 极端稳态偏离
  special_threshold_high_allostatic: 3,   // 高应激状态
  
  temperature: 0.9,              // 意识流LLM temperature (高=更自由联想)
};
```

### 14.5 AllostaticLoad

```typescript
const ALLOSTATIC_CONSTANTS = {
  impact_weights: {
    safety: 0.4,
    connection: 0.3,
    mastery: 0.2,
    energy: 0.05,
    arousal: 0.05,
  },
  
  recovery_tau: 30 * 60,         // 恢复τ: 30分钟
  
  thresholds: {
    mild: 0.5,                    // Arousal基线+0.1
    moderate: 1.0,                // PFC抑制30%, 评估敏感度增加
    severe: 2.0,                  // temperature−0.2
  },
};
```

### 14.6 LLM 调用

```typescript
const LLM_CONSTANTS = {
  // 统一模型配置 (可通过环境变量切换)
  default_model: "deepseek-v4-pro",
  // 设置 GEN_MODEL 环境变量可覆盖所有LLM调用点的模型
  
  L2: {
    model: process.env.GEN_MODEL || "deepseek-v4-pro",
    max_tokens: 300,
    temperature: 0.3,            // 低温度=更准确的分析
    timeout: 3000,               // 3秒超时
  },
  L2_5: {
    model: process.env.GEN_MODEL || "deepseek-v4-pro",
    max_tokens: 400,
    temperature: 0.4,
    timeout: 8000,               // 异步, 可以等更久
  },
  L3: {
    model: process.env.GEN_MODEL || "deepseek-v4-pro",
    max_tokens: 400,
    temperature: 0.35,
    timeout: 8000,
  },
  L4: {
    model: process.env.GEN_MODEL || "deepseek-v4-pro",
    max_tokens: 60,              // 只要一个念头片段
    temperature: 0.9,            // 高温=更自由的联想
    timeout: 3000,
  },
  L5: {
    model: process.env.GEN_MODEL || "deepseek-v4-pro",
    max_tokens_base: 500,
    temperature_base: 0.7,
    top_p_base: 0.9,
    timeout: 30000,
  },
  L6: {
    model: process.env.GEN_MODEL || "deepseek-v4-pro",
    max_tokens: 600,
    temperature: 0.5,
    timeout: 30000,
  },
};
```

### 14.7 时间常量

```typescript
const TIME_CONSTANTS = {
  micro_delta_tick: 1,                  // 微δ累积tick (秒)
  consciousness_fast_tick: 5,           // 快速意识流tick (秒)
  consciousness_slow_tick: 5 * 60,      // 慢速意识流tick (秒)
  compression_check: 5 * 60,            // 压缩检查间隔 (秒)
  homeostatic_decay: 5 * 60,            // 稳态衰减检查 (秒)
  allostatic_recovery: 1 * 60,          // AllostaticLoad恢复tick (秒)
  full_sleep_daily: 24 * 3600,          // fullSleep最小间隔
  
  normal_response_interval: 5 * 60,     // 正常回复间隔 (用于Connection偏离)
  silence_threshold: 30 * 60,           // 沉默阈值
  
  setpoint_drift_min_data: 14 * 24 * 3600, // 设定点漂移最少数据天数
  setpoint_drift_max_weekly: 0.05,      // 每周最大漂移量
  setpoint_range: [0.3, 0.9],           // 设定点允许范围
};
```

---

## 十四、实施路线图

### Phase 1: 稳态引擎 (核心基础设施)

```
预计: 2-3周

1. 实现5个 HomeostaticVariable
   - 设定点、当前值、偏离计算
   - 事件→影响映射 (首先是规则层, L2修正后续)
   
2. 实现 V(s) 和多维δ计算
   - 5个独立的Vᵢ(s)
   - r_rule基线表
   - δᵢ = rᵢ + γ·Vᵢ(s') − Vᵢ(s)
   - Vᵢ(s)更新规则
   
3. 实现 AllostaticLoad
   - 累积和恢复

4. 实现 PAD计算
   - CPM四维 (规则层)
   - PAD三维
   - PAD→生成参数映射

5. 替换旧系统
   - 移除 saturation.ts, ContinuousParams, 32 lerp
   - 移除 AffectiveResidue (四元组)
   - 替换 DriveState (5驱力→5稳态变量)
   - 替换 DriveSublimator
   - 替换 PsychologyEngine (→ CPM初算)
```

### Phase 2: 评估管道

```
预计: 2-3周

1. 实现 L2评估
   - Prompt模板 + 输出JSON schema
   - 评估跳过决策
   - L2结果→稳态修正

2. 实现 L2.5 冷回顾
   - 异步执行
   - 记忆修正
   - coldCache更新

3. 实现 L3 维度评估
   - 触发条件检测
   - 综合单次调用

4. 更新 L5 Prompt组装
   - 注入L2评估结果
   - PAD→sampling参数

5. 保留/适配 PostFilter 和 GuardPipeline
```

### Phase 3: 记忆系统重构

```
预计: 2-3周

1. 替换5层→3层
   - ImmediateMemory (原 Working+STM)
   - RecentMemory (原 LTM)
   - CoreMemory (原 CoreGraph+Archive)

2. 实现激活衰减
   - 连续衰减公式
   - 情绪调制
   - 检索boost

3. 实现多维检索
   - 情绪一致检索
   - 时序检索
   - 因果/图遍历检索

4. 实现记忆网络图
   - 节点+边结构
   - 5种边的自动创建
   - 图遍历API

5. 实现压缩管道
   - 即时→近期 (LLM)
   - 近期→核心 (LLM)
   - fullSleep巩固

6. 持久化 (默认文件路径)
```

### Phase 4: 意识流 + 主动发言

```
预计: 2-3周

1. 实现 L4 快速意识流
   - 5s tick
   - Prompt (走神/自由联想)
   - 念头权重计算
   - 循环保护

2. 实现 主动发言
   - 触发条件 (weight > 0.7 + 不在回复)
   - 冲动仲裁
   - 主动发言Prompt + 生成

3. 实现 中断重组
   - AbortController
   - 重组Prompt
   - 前端拼接策略
   - 中断计数限制

4. 微δ累积
   - 响应速度/消息特征/时间语境
```

### Phase 5: 深度反思 + 系统状态

```
预计: 1-2周

1. L6 深度反思
   - 5min tick
   - 自我叙事更新
   - 关系重评
   - 设定点漂移建议

2. 检查点/恢复 (适配新架构)
   - Root State定义更新
   - 崩溃恢复

3. fullSleep
   - 记忆压缩/提取/模式提取
   - 全局衰减
   - 设定点漂移

4. 威胁检测系统 (BIS)
   - 四类威胁的检测规则
   - BIS激活→行为映射
   - 威胁敏感性动态调整
```

### Phase 6: 爱 (逆推设计)

```
预计: 待定 (等其他系统稳定运行后再设计)

设计输入:
  - Connection的长期演变数据
  - 自我模型融合的发生条件
  - 分离distress的涌现模式
  - 排他性/优先级的行为表现
```

---

**文档结束**

配套文件:
- [CONTEXT.md](../CONTEXT.md) — 领域词汇表
- [ARCHITECTURE.md](../ARCHITECTURE.md) — v3架构决策记录 (ADR-001~010)
- [docs/adr/](adr/) — v4架构决策记录 (ADR-011~016)
- [docs/neural-architecture-mapping.md](neural-architecture-mapping.md) — 神经映射详细分析
