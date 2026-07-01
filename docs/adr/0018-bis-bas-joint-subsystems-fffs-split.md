# ADR-018 BIS/BAS 联合子系统 + FFFS 拆分

**状态**: 提议 · **日期**: 2026-07-01

## 背景

当前 `updateBISBAS`（`src/mind/bis-bas.ts:364`）独立计算 BIS 和 BAS 激活值：

```typescript
const basActivation = Math.min(1, positiveTD * 2 + 0.3 + mood.playful * 0.1);
const bisActivation = Math.min(1, negativeTD * 2 + threatStrength * 0.5 + mood.anxious * 0.15);
```

两者之间唯一的交互是最终的 `goSignal` 计算中 BIS 对 BAS 的抑制：

```typescript
const goSignal = basActivation - bisActivation * 0.5 + (positiveTD - negativeTD) * 0.3;
```

这个实现有三个问题：

1. **BIS 和 BAS 独立激活**：它们各自对正/负 TD error 做出反应，没有考虑 Corr (2004) 的核心主张——BIS 不是简单的"惩罚检测器"，而是**冲突检测器**。BIS 在 BAS 和 FFFS 同时激活时才启动，而非只要有威胁就启动。

2. **缺少 FFFS（Fight-Flight-Freeze System）**：Gray & McNaughton (2000) 修订版 RST 将原始的 BIS 拆分为 FFFS（应对直接威胁，产生恐惧/恐慌）和 BIS（应对目标冲突，产生焦虑/犹豫）。当前实现把两者的功能混在 BIS 中。

3. **无交叉抑制**：BAS 升高不会抑制 BIS，BIS 升高也不会抑制 BAS——这违反了"快乐时对威胁不敏感，恐惧时对奖励无兴趣"的基本心理学观察。

## 决策

实施三项变更：

### 1. 添加交叉抑制

```
effective_BAS = raw_BAS × max(0.2, 1 − w_BAS × BIS_level)
effective_BIS = raw_BIS × max(0.1, 1 − w_BIS × BAS_level)
```

其中 `w_BAS = 0.6`，`w_BIS = 0.4`（BAS 受 BIS 抑制的程度更大，与临床观察一致——焦虑比快乐更具"渗透性"）。

### 2. FFFS 从 BIS 中拆分

FFFS 处理**可回避的直接威胁**（产生恐惧/愤怒），BIS 处理**目标冲突**（同时激活 BAS + FFFS 时产生焦虑/犹豫）：

```
FFFS = threatStrength × exp(−safety_deviation) × interoceptive_sensitivity
BIS_raw = FFFS × BAS × gain_bis  // 只有当 FFFS 和 BAS 同时激活时 BIS 才激活
BIS = BIS_raw × max(0.1, 1 − 0.4 × BAS_level)  // 交叉抑制
```

FFFS 的输出直接驱动恐惧/愤怒情绪，BIS 的输出驱动焦虑/犹豫/反刍。

### 3. BAS 细分：BAS-Drive / BAS-Reward-Responsiveness / BAS-Fun-Seeking

根据 Carver & White (1994) 的 BAS 三因子模型：

- **BAS-Drive**：目标追求，由 mastery deviation 驱动
- **BAS-Reward-Responsiveness**：对预期奖励的响应，由 positive TD 驱动
- **BAS-Fun-Seeking**：对新奇刺激的自发趋近，由 arousal 驱动

三者加权求和得到总 BAS 激活值，但保留各自独立信号——不同人格特质的人可以有相同的总 BAS 但完全不同的行为表现（如：高 Drive 低 Fun-Seeking 的人 vs 高 Fun-Seeking 低 Drive 的人）。

## 理由

### 1. 冲突检测是 BIS 的核心功能

Corr (2004) 的联合子系统假说（Joint Subsystems Hypothesis, JSH）的核心论点是：BIS 不是一个独立的"惩罚系统"，而是一个**冲突解决系统**。当 FFFS（回避）和 BAS（趋近）的信号强度接近时，BIS 被激活以解决冲突。这意味着：

- 纯粹的危险（只有 FFFS，没有 BAS）：产生恐惧，不产生焦虑
- 纯粹的奖励（只有 BAS，没有 FFFS）：产生快乐，不产生焦虑
- 危险 + 奖励同时存在（FFFS + BAS 都激活）：产生焦虑——这正是 BIS 的领域

当前实现中，`bisActivation` 对威胁信号直接响应，这实际上是 FFFS 的功能。修正后的 BIS 只在 BAS 和 FFFS 同时激活时才真正启动。

### 2. 临床焦虑的分离机制

McNaughton & Corr (2004) 的综述区分了两种焦虑：

- **恐慌/恐惧**（panic/fear）：由 FFFS 驱动，是对即时威胁的反应，与杏仁核中央核相关
- **焦虑/担忧**（anxiety/worry）：由 BIS 驱动，是对潜在冲突的反应，与海马-隔核系统相关

在对话角色中，这种区分至关重要：
- 用户威胁要离开 → FFFS 激活（"ta 要走了！"） → 恐慌 → 角色可能道歉、挽留
- 用户同时表达了关心和失望 → FFFS + BAS 同时激活 → BIS 激活 → 焦虑/反刍 → 角色犹豫、自我怀疑

不加区分地把所有威胁都导向 BIS，会导致角色行为模式单一——总是焦虑型应对，而缺少愤怒/恐惧/回避等其他威胁反应。

### 3. 交叉抑制的神经基础

PFC（前额叶皮层）对边缘系统的自上而下抑制是双向的（Ochsner & Gross, 2005）。但更重要的是基底神经节层面的直接交互：纹状体的 D1（Go）和 D2（NoGo）中等多棘神经元之间存在侧抑制（lateral inhibition），这是交叉抑制的直接神经基底。

## 后果

- **正面**：
  - BIS 只在存在真实目标冲突时激活，消除"永久焦虑"问题
  - FFFS 独立后，角色可以表达恐惧/愤怒（FFFS）而不一定伴随焦虑（BIS）
  - BAS 三因子允许更精细的人格建模（不同的 BAS 剖面产生不同的对话策略）
  - 交叉抑制使情绪状态更稳定——不会被小的扰动来回切换

- **负面**：
  - 从 2 个变量（BIS, BAS）扩展到 5 个（FFFS, BIS, BAS-Drive, BAS-RR, BAS-FS），调试复杂度增加
  - 冲突检测（BIS = FFFS × BAS × gain）是一个非线性乘积，对参数敏感——gain 设置不当会导致 BIS 要么永远不激活，要么总是激活
  - BAS 三因子需要三个人格特质参数，增加了配置负担

- **缓解**：
  - FFFS 的输出默认可以等同于当前 BIS 的非冲突部分（即只由威胁驱动的那部分），确保向后兼容
  - BAS 三因子默认相等权重（1/3 各），仅在使用精细人格配置时调整
  - 交叉抑制用 `max(0.1/0.2, ...)` 做软下限，保证极端状态下两个系统不会完全关闭

## 备选方案

1. **保持独立 BIS/BAS，仅添加交互项**：在现有公式上加 `basActivation × (1 - 0.3 × bisActivation)` 和 `bisActivation × (1 - 0.2 × basActivation)`。最简单，但仍然是两个独立轴在交叉抑制，缺少理论根基——BIS 仍然对所有威胁信号响应，没有变成真正的冲突检测器。

2. **BIS/BAS 不做拆分，改为连续动力系统**：用 Lotka-Volterra 竞争方程建模 BAS-BIS 的生态竞争。数学上更优雅，但参数无心理学解释，且没有解决"BIS 对纯粹威胁不响应"的核心问题。

3. **完全放弃 BIS/BAS 框架，改用 PAD 三维度**：用 Pleasure-Arousal-Dominance 替代 BIS/BAS。PAD 描述的是情绪状态的空间，BIS/BAS 描述的是动机系统的动力学——两者是互补的，不是替代的。实际上当前系统已经同时有 CPM-PAD 和 BIS/BAS。

## 已知代价

- `updateBISBAS` 需要重构为 5 个独立通道的计算，方法签名变化会影响所有调用者
- FFFS 的输出需要新的消费者：情绪模块需要区分"恐惧"（FFFS 驱动）和"焦虑"（BIS 驱动）
- 冲突检测的乘积公式 `BIS = FFFS × BAS × gain` 需要仔细校准 `gain` 值——建议初始值为 `gain = 3.0`，使中等 FFFS(0.5) × 中等 BAS(0.5) 产生有意义的 BIS(0.75)
- BAS 三因子的权重需要新的人格配置字段，可能影响现有角色定义的迁移
