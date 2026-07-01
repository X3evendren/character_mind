# Character Mind v3 — 学术文献基础

> 58 篇论文 · 5 计算域 · 3 迭代架构改进
> 日期: 2026-07-01

---

## 目录

- [一、统一理论框架：精度加权预测误差层级模型](#一统一理论框架精度加权预测误差层级模型)
- [二、域 1：稳态调节 + TD Error + 异稳态负荷](#二域-1稳态调节--td-error--异稳态负荷)
  - [2.1 多巴胺 TD Error 编码](#21-多巴胺-td-error-编码)
  - [2.2 OpAL 双通道 Actor-Critic](#22-opal-双通道-actor-critic)
  - [2.3 稳态强化学习](#23-稳态强化学习)
  - [2.4 主动推理与内感受](#24-主动推理与内感受)
  - [2.5 稳态信念与精度](#25-稳态信念与精度)
  - [2.6 内感受预测编码](#26-内感受预测编码)
  - [2.7 自由能与选择解剖](#27-自由能与选择解剖)
  - [2.8 深度学习视角下的自由能原理](#28-深度学习视角下的自由能原理)
- [三、域 2：CPM 评估 + PAD 情感空间 + BIS/BAS 动机](#三域-2cpm-评估--pad-情感空间--bisbas-动机)
  - [3.1 认知评估基础理论](#31-认知评估基础理论)
  - [3.2 评估组件与核心关系主题](#32-评估组件与核心关系主题)
  - [3.3 EMA 计算模型](#33-ema-计算模型)
  - [3.4 刺激评估检查序列](#34-刺激评估检查序列)
  - [3.5 PAD 三维情感空间](#35-pad-三维情感空间)
  - [3.6 情感世界的四维结构](#36-情感世界的四维结构)
  - [3.7 联合子系统假说](#37-联合子系统假说)
  - [3.8 防御的二维神经心理学](#38-防御的二维神经心理学)
  - [3.9 激励显著性计算模型](#39-激励显著性计算模型)
  - [3.10 情绪调节扩展过程模型](#310-情绪调节扩展过程模型)
  - [3.11 CoMERG 计算情绪调节模型](#311-comerg-计算情绪调节模型)
  - [3.12 EMA 应对策略](#312-ema-应对策略)
  - [3.13 策略选择的漂移扩散模型](#313-策略选择的漂移扩散模型)
- [四、域 3：多级记忆系统 + 睡眠巩固 + 激活衰减](#四域-3多级记忆系统--睡眠巩固--激活衰减)
  - [4.1 多存储记忆模型](#41-多存储记忆模型)
  - [4.2 情景缓冲器与工作记忆容量](#42-情景缓冲器与工作记忆容量)
  - [4.3 主动系统巩固](#43-主动系统巩固)
  - [4.4 记忆巩固综述](#44-记忆巩固综述)
  - [4.5 SHY 突触稳态假说](#45-shy-突触稳态假说)
  - [4.6 BiOtA 双阶段巩固模型](#46-biota-双阶段巩固模型)
  - [4.7 睡眠依赖情感解码假说](#47-睡眠依赖情感解码假说)
  - [4.8 ACT-R 动态衰减与间隔效应](#48-act-r-动态衰减与间隔效应)
  - [4.9 杏仁核记忆调制](#49-杏仁核记忆调制)
  - [4.10 心境与记忆的关联网络](#410-心境与记忆的关联网络)
  - [4.11 自我记忆系统](#411-自我记忆系统)
- [五、域 4：意识理论 + 情绪动力学 + 调节 + 反刍 + 无聊](#五域-4意识理论--情绪动力学--调节--反刍--无聊)
  - [5.1 全局工作空间理论](#51-全局工作空间理论)
  - [5.2 心智游移框架](#52-心智游移框架)
  - [5.3 自发思维计算模型](#53-自发思维计算模型)
  - [5.4 情感神经科学与初级情绪系统](#54-情感神经科学与初级情绪系统)
  - [5.5 多维心境理论](#55-多维心境理论)
  - [5.6 构建情绪理论](#56-构建情绪理论)
  - [5.7 心脏主动推理](#57-心脏主动推理)
  - [5.8 TCE vs BET 实证检验](#58-tce-vs-bet-实证检验)
  - [5.9 调节灵活性模型](#59-调节灵活性模型)
  - [5.10 抑制反弹元分析](#510-抑制反弹元分析)
  - [5.11 反刍的二维结构](#511-反刍的二维结构)
  - [5.12 无聊的稳态设定点](#512-无聊的稳态设定点)
  - [5.13 MAC 注意力-意义模型](#513-mac-注意力-意义模型)
- [六、域 5：社会认知 + 自我模型 + LLM Agent 架构](#六域-5社会认知--自我模型--llm-agent-架构)
  - [6.1 贝叶斯心理理论](#61-贝叶斯心理理论)
  - [6.2 GPT-4 心理理论能力](#62-gpt-4-心理理论能力)
  - [6.3 ToM 系统比较](#63-tom-系统比较)
  - [6.4 镜像神经元与社会共振](#64-镜像神经元与社会共振)
  - [6.5 共情的习得本质](#65-共情的习得本质)
  - [6.6 生成式 Agent](#66-生成式-agent)
  - [6.7 Voyager 技能库](#67-voyager-技能库)
  - [6.8 三层人格模型](#68-三层人格模型)
  - [6.9 叙事作为预测加工](#69-叙事作为预测加工)
  - [6.10 依恋的多维控制系统](#610-依恋的多维控制系统)
  - [6.11 主动推理依恋模型](#611-主动推理依恋模型)
  - [6.12 ACT-R 双过程理论](#612-act-r-双过程理论)
  - [6.13 PRIME 按需仲裁架构](#613-prime-按需仲裁架构)
- [七、综合架构建议](#七综合架构建议)
  - [7.1 优先级矩阵](#71-优先级矩阵)
  - [7.2 项目哲学验证矩阵](#72-项目哲学验证矩阵)
- [八、完整参考文献](#八完整参考文献)
- [附录：关键公式速查](#附录关键公式速查)

---

## 一、统一理论框架：精度加权预测误差层级模型

Character Mind v3 的底层计算哲学可以通过一个统一的数学框架来理解。将 Barrett (2017) 的构建情绪理论、Friston (2009) 的自由能原理、Corr (2004) 的联合子系统假说以及 Gross (2015) 的扩展过程模型加以综合，我们得到以下核心公式：

```
PE_layer = Σ |predicted_state - actual_state| × precision_weight

if PE > adaptive_threshold(attachment_style):
    trigger Cold Path at depth ∝ PE_magnitude
```

这一框架的统摄力体现在五个相互关联的层面：

**稳态调节的统一。** 预测误差（PE）不仅是强化学习中 TD error 的载体——它同时是对稳态偏离的量度、对内感受信号的编码、以及对预期与现实的差距的评估。当身体状态偏离设定点时，系统产生预测误差；当社会互动违背预期时，系统同样产生预测误差。同一个数学形式 `|predicted - actual| × precision` 贯穿所有五个计算域，使 Character Mind v3 得以用统一的代码路径处理看似迥异的现象——从饥饿到被背叛的愤怒。

**TD 学习作为通用更新规则。** Schultz (2016) 揭示的多巴胺 TD error 编码机制，其核心公式 `δ_t = r_t + γV(s_{t+1}) - V(s_t)` 不仅适用于奖励学习，也适用于情绪预期的更新、社会关系的校准和叙事身份的修正。在这个框架中，"奖励"可以是任何形式的预测误差减少：稳态恢复带来内源性奖励 (Keramati & Gutkin, 2014)，预期被验证带来认知闭合，关系预期被满足带来依恋安全感 (Pichiecchio et al., 2026)。

**情绪构建而非情绪触发。** Barrett (2017) 的构建情绪理论论证了情绪不是被"触发"的模块化反应，而是大脑通过贝叶斯预测编码从内感受信号、概念知识和执行注意中主动构建的脑状态。这一观点直接否决了"离散情绪模块"的架构路线，支持 Character Mind v3 的统一内感受推理引擎设计 (Gundem et al., 2022)。情绪不是代码中的一个 switch-case，而是预测误差在 PAD 空间中经过精度加权后的涌现属性。

**记忆巩固作为跨时间尺度的精度更新。** 睡眠不仅是记忆转存——它是全局精度重新校准的过程。Klinzing et al. (2019) 的三振荡耦合机制、Tononi & Cirelli (2014) 的 SHY 假说以及 Walker & van der Helm (2009) 的情感解码假说共同指向：NREM 睡眠执行突触精度的全局下选和要点提取，REM 睡眠执行跨域超联想重组和情感脱钩。这意味着记忆的"遗忘"不是丢失，而是精度竞争中的落败。

**社会认知作为他人心智状态的贝叶斯推断。** Baker et al. (2017) 将心理理论形式化为联合贝叶斯推断——对他人的信念、欲望和知觉的逆向建模。这与 Barrett (2017) 的构建情绪理论形成对称结构：正如我们对自身情绪的判断是内感受信号的贝叶斯归类，我们对他人的心智状态的判断是行为信号的贝叶斯推断。两者共享同一个预测误差最小化的形式。

这个统一框架的实践意义在于：Character Mind v3 的架构决策——冷热分离、精度加权仲裁、多时间尺度力场——不是来自工程便利，而是从 58 篇论文的计算共性中归纳出的必然收敛方向。

---

## 二、域 1：稳态调节 + TD Error + 异稳态负荷

### 域概述

稳态调节是 Character Mind v3 的生理底层。8 篇论文在此域揭示了一个层次化的调控体系：从 Schultz (2016) 的毫秒级多巴胺 TD error 脉冲，到 Collins & Frank (2014) 的 Go/NoGo 双通道学习，到 Keramati & Gutkin (2014) 的稳态偏离内源性奖励，再到 Tschantz et al. (2022) 的三层异稳态架构（稳态/异稳态/目标导向）。这些层级通过预测误差的精度加权 (Friston et al., 2014) 统一起来，形成从神经元发放到行为选择的完整闭环。对项目而言，域 1 的核心修改是将当前的单通道价值更新替换为 OpAL 双通道架构，并将设定点从固定值升维为带精度的概率分布。

---

### 2.1 多巴胺 TD Error 编码

**Schultz, W. (2016).** Dopamine reward prediction error coding. *Dialogues in Clinical Neuroscience*, 18(1), 23-32.

**核心发现。** Schultz 汇总了三十年多巴胺神经元记录研究的成果，确立了以下中心命题：中脑多巴胺神经元编码双向时间差分预测误差（TD error）。当实际奖励超过预期（正预测误差），多巴胺神经元产生相位爆发（phasic burst）；当实际奖励低于预期（负预测误差），多巴胺神经元产生相位暂停（phasic pause）；当奖励与预期完全一致，发放率保持在基线。这一编码特性使多巴胺同时服务于两个功能：(a) 驱动学习——更新对未来奖励的预期；(b) 驱动动机——即时调节行为选择的激励权重。

**关键可计算机制。**

```
δ_t = r_t + γ × V(s_{t+1}) - V(s_t)
```

其中 `δ_t` 为时刻 t 的 TD error，`r_t` 为即时奖励，`γ` 为折扣因子，`V(s)` 为状态 s 的预期价值。当 `δ_t > 0` 时相位爆发驱动 Go 学习；当 `δ_t < 0` 时相位暂停驱动 NoGo 学习。σ 的正负并非对称处理——其学习率、泛化范围和下游效应均存在系统性差异。

**对项目的映射。** 该论文**直接支持** `computeTDErrors` 模块的核心设计。但揭示了当前实现的关键不足：δ 被用于单一的价值更新，而文献表明 δ 应同时承担双重职能——(a) 更新学习预期的 `updateV`；(b) 动态调制 BAS 激活水平，使动机强度随预测误差的大小而实时波动。这意味着 TD error 不仅是一个"学习的信号"，更是一个"动力学的信号"，其动机调制效应应写入 `updateBISBAS` 流程。

---

### 2.2 OpAL 双通道 Actor-Critic

**Collins, A. G. E., & Frank, M. J. (2014).** Opponent actor learning (OpAL): an interactive actor-critic model of basal ganglia function. *Psychological Review*, 121(3), 337-366.

**核心发现。** OpAL 模型揭示了基底节的对手式 Actor-Critic 架构。D1 型中等棘神经元（MSN）选择性学习正预测误差（Go 通道），D2 型 MSN 选择性学习负预测误差（NoGo 通道）。两个通道采用非对称学习率——Go 通道的 α_G 与 NoGo 通道的 α_N 独立调节。行为选择的价值由两个通道的加权差决定，而非一个标量 Q 值。

**关键可计算机制。**

```
Go[a]  += α_G × Go[a]  × max(0, δ)
NoGo[a] += α_N × NoGo[a] × max(0, -δ)
V[a]    = β_G × Go[a] - β_N × NoGo[a]
```

这里的关键创新在于 Hebbian 三项乘积形式：`Go[a] × max(0, δ)`——即当前突触权重、正预测误差和学习率三者的乘积。这实现了"已有的被强化"的正反馈动态，使得负偏差下的行为抑制与正偏差下的行为增益在计算上分离，而非对称地汇聚到同一个 Q 值。

**对项目的映射。** 该论文对 `updateV` 构成了**关键挑战**。当前的对称单通道价值更新（`V += α × δ`）在神经计算上不成立。必须重构为 Go/NoGo 双权重架构，采用 `β_G × Go[a] - β_N × NoGo[a]` 作为行为价值。Go 权重的更新仅在 δ>0 时发生，NoGo 权重的更新仅在 δ<0 时发生。这一修改是 P0 优先级的架构性变更。

---

### 2.3 稳态强化学习

**Keramati, M., & Gutkin, B. (2014).** Homeostatic reinforcement learning for integrating reward collection and physiological stability. *PLOS Computational Biology*, 10(3), e1003511.

**核心发现。** 稳态强化学习（HRL）框架论证了稳态偏离本身可以产生内源性奖励。当行为减少了生理偏离（如进食后饥饿感的降低），偏离的减少量 `D(H_before) - D(H_after)` 即构成内源性奖励。这意味着奖励信号不是由外部环境单独决定的——对同一个食物，饥饿时的奖励值远大于饱足时，因为"驱动减少就是奖励"。

**关键可计算机制。**

```
r_total = r_external + w_homeostatic × max(0, D(H_before) - D(H_after))
```

其中 `D(H)` 为稳态偏离函数（取欧氏距离或加权马氏距离），`w_homeostatic` 为稳态奖励在总奖励中的混合权重。

**对项目的映射。** 该论文**扩展了** `computeRuleRewards` 的语义范围。当前奖励主要来自规则匹配（外部奖励），但应该混入稳态偏离减少产生的内源性奖励。这意味着与互动对象的每一次行为——不仅是获得外部奖励的行为——都能通过驱动减少产生内在的"满足感"，这是情感涌现的重要底层机制。

---

### 2.4 主动推理与内感受

**Tschantz, A., Barca, L., Maisto, D., Buckley, C., Seth, A., & Pezzulo, G. (2022).** Simulating homeostatic, allostatic, and goal-directed forms of interoceptive control. *Biological Psychology*, 169, 108266.

**核心发现。** 该论文将稳态控制分为三个层级——稳态（homeostatic，反应性的偏差纠正）、异稳态（allostatic，预期性的提前调节）和目标导向（goal-directed，分层规划的长程策略）——并证明三者可以在自由能最小化的框架下统一建模。稳态控制是 reactive 的"纠正已经发生的偏离"，异稳态控制是 anticipatory 的"预见并防止未来偏离"，目标导向控制是 hierarchical 的"多步规划以实现最终稳态目标"。

**对项目的映射。** 该论文**支持**三层异稳态架构的设计方向：(1) 基础稳态层对应当前的 `homeostatic-state.ts`，实时监控偏离并触发纠正；(2) 异稳态层在 Cold Path 中根据上下文预估未来稳态需求（如"明天要演讲，现在开始储备能量"）；(3) 目标导向层在深度反思时规划长程稳态策略。三层应共享同一个自由能量度。

---

### 2.5 稳态信念与精度

**Petzschner, F. H., Garin, M., Stephan, K. E., & Tschantz, A. (2021).** Homeostatic beliefs and interoceptive inference. *Trends in Neurosciences*, 44(1), 63-76.

**核心发现。** 稳态设定点不应被建模为固定数值，而应建模为概率分布：`h* ~ N(μ, π⁻¹)`。其中 μ 是设定点的均值（最舒适水平），π⁻¹ 是精度（precision）的倒数——反映了系统对"正确稳态水平"的确定性。精度 π 直接决定调控响应的速度和幅度：高精度 → 快速检测偏离 → 激进纠正；低精度 → 容忍偏离 → 缓慢响应。精度本身可以通过经验学习（贝叶斯更新）。

**关键可计算机制。**

```
regulatory_response(t) = π × (h(t) - μ)
```

**对项目的映射。** 该论文**扩展了**设定点的概念模型。当前的 `setpoint` 为固定值，应改为带精度的分布。初始化时，精度反映的是人格特质（如神经质高者内感受精度低），运行过程中精度通过预测误差（实际偏离是否得到有效纠正）持续贝叶斯更新。这将使稳态调节的"灵敏度"成为一个可学习、可个性化的动态参数。

---

### 2.6 内感受预测编码

**Seth, A. K., & Friston, K. J. (2016).** Active interoceptive inference and the emotional brain. *Trends in Cognitive Sciences*, 371(1708).

**核心发现。** 内感受精度（interoceptive precision）——即大脑对来自身体内部信号的"信任程度"——直接调制情绪体验的强度。当内感受精度高时，身体信号被放大，情绪体验强烈且分化清晰；当内感受精度降低时，情绪体验与实际身体状态脱钩，可能出现"我知道我應該生氣但感覺不到"的解离状态。内感受精度的降低是多种精神病理状态的共同特征。

**对项目的映射。** 该论文**修正了**内感受精度的回归目标。在当前实现中，内感受精度的回归目标被设为 0，这意味着系统朝着"忽略身体信号"的方向优化——这不符合自适应功能。正确的回归目标应是个性化基线（不同人格特质具有不同的最优内感受精度），使系统在评估事件时维持适当水平的身体意识。

---

### 2.7 自由能与选择解剖

**Friston, K. J., Schwartenbeck, P., FitzGerald, T., Moutoussis, M., Behrens, T., & Dolan, R. J. (2014).** The anatomy of choice: dopamine and decision-making. *Phil. Trans. R. Soc. B*, 369(1655), 20130481.

**核心发现。** 预期效用理论可以被推导为自由能最小化的一个特例。关键洞察在于：softmax 选择函数中的温度参数 β 本身就是一个精度参数（precision），而非任意的"探索-利用"调谐器。β 的大小反映了行动模型对"选择最高价值行动将获得最大奖励"这一信念的置信度。

**关键可计算机制。**

```
P(a) = softmax(β × V(a))  // β 不是启发式参数，而是行动模型的精度
δ_dopamine = precision_weighted_PE  // 多巴胺编码的是精度加权预测误差, 不是裸标量 TD error
```

**对项目的映射。** 多巴胺信号不应被理解为"裸"标量 TD error，而应是经过精度（precision）加权的预测误差。当系统对当前情境模型置信度高时，同样的奖励偏差产生更大的多巴胺响应（和更强的学习驱动）；当处于极度不确定的情境中，即使出现大的奖励偏差，学习更新也应保守。这一修正应同时应用于 `computeTDErrors` 和 `updateBISBAS` 模块。

---

### 2.8 深度学习视角下的自由能原理

**Mazzaglia, P., Verbelen, T., Catal, O., & Dhoedt, B. (2022).** The free energy principle for perception and action: a deep learning perspective. *Entropy*, 24(2), 301.

**核心发现。** 主动推理（active inference）智能体可以用标准神经网络架构（VAE、RNN 等）实现，不需要特殊的生物启发的计算基板。论文提供了主动推理与标准强化学习之间的完整公式对应表，表明变分自由能 ≈ 负证据下界（ELBO）+ 期望奖励 + 策略熵。这一发现使主动推理从"哲学框架"降维为"可工程的深度学习方案"。

**对项目的映射。** 该论文提供了完整的公式交叉对照表，使 Character Mind v3 能够在工程实现层面同时受益于强化学习（代码成熟度）和主动推理（理论完备性）的优点。特别地，Mazzaglia 等人证明精度加权预测误差可以通过标准神经网络的反向传播近似，这为使用 LLM 作为感知编码器提供了计算可行性论证。

---

## 三、域 2：CPM 评估 + PAD 情感空间 + BIS/BAS 动机

### 域概述

认知评估（cognitive appraisal）是连接外部事件与内部情感状态的计算桥梁。13 篇论文在此域形成了一个从"事件编码 → 评估维度计算 → PAD 情感坐标 → BIS/BAS 动机调制 → 情绪调节"的完整流水线。Lazarus (1991) 和 Smith & Lazarus (1993) 确立了评估维度的必要性；Marsella & Gratch (2009) 和 Scherer (2001) 提供了具体的计算架构；Mehrabian (1996) 和 Fontaine et al. (2007) 界定了情感空间的维度结构；Corr (2004) 和 McNaughton & Corr (2004) 揭示了 BIS/BAS 的交互抑制机制；Gross (2015) 和 Bosse et al. (2010) 建模了情绪调节的完整过程。域 2 的核心架构修改是：(1) 将 PAD 从三维扩展至包含 Novelty 的四维；(2) 在 BIS/BAS 间加入交叉抑制项；(3) 拆分 FFFS 和 BIS 子系统；(4) 以情绪强度门控调节策略选择。

---

### 3.1 认知评估基础理论

**Lazarus, R. S. (1991).** *Emotion and Adaptation.* Oxford University Press.

**核心发现。** Lazarus 系统论证了认知评估（cognitive appraisal）是情绪产生的必要条件——并非充分条件，但没有评估就没有情绪。他识别了 15 种核心关系主题（core relational themes），每种映射到一种离散情绪（如"对自我的冒犯"→ 愤怒，"面对不确定的威胁"→ 焦虑）。评估由六个维度构成：目标相关性、目标一致性、自我卷入类型、归因/责任、应对潜力、未来预期。

**对项目的映射。** 该论文**支持** `computeCPM` 的四维度核心设计（目标相关、目标一致、应对潜力、规范兼容），但同时指出归因维度（自我归咎 vs 他人归咎）是区分愤怒与内疚的关键——这一维度目前在项目中缺失。六个维度可在 Cold Path 中实施详细评估，而当前四维度可作为 Hot Path 的"快速近似"，形成分层评估架构。

---

### 3.2 评估组件与核心关系主题

**Smith, C. A., & Lazarus, R. S. (1993).** Appraisal components, core relational themes, and emotions. *Cognition and Emotion*, 7(3-4), 233-269.

**核心发现。** 本文提出了分子-摩尔两层可组合架构：分子层由六个初级评估组件组成（动机相关性、动机一致性、责任感、自我-他人归因、应对潜力、未来预期）；摩尔层由核心关系主题组成，是分子评估的组合产物。两层间是组合关系而非线性传递——不同的分子评估组合可以产生相同的摩尔情绪。

**对项目的映射。** 该研究**揭示了项目的缺失维度**："归因"（attribution）——事件的责任归属。自我归咎倾向产生内疚/羞耻，外部归咎产生愤怒。当前 `computeCPM` 的四个维度无法区分这两种重要的社会情绪。建议在 Cold Path 评估中增加归因维度作为第五维，Hot Path 可维持四维以保障响应速度。

---

### 3.3 EMA 计算模型

**Marsella, S. C., & Gratch, J. (2009).** EMA: a process model of appraisal dynamics. *Cognitive Systems Research*, 10(1), 70-90.

**核心发现。** EMA (EMotion and Adaptation) 模型提供了评估的最完整计算实现。评估从因果解释图（causal interpretation graph）中确定性计算：Desirability（目标一致性）、Likelihood（事件发生的概率）、Expectedness（出乎意料程度）、Causal attribution（归因）、Controllability（可控性）、Changeability（可变性）。特别地，希望（Hope）= 目标一致性>0 + 概率<1；恐惧（Fear）= 目标一致性<0 + 概率<1。这意味着希望和恐惧共享相同的评估结构，仅在 Desirability 的符号上不同。

**对项目的映射。** 该论文为在 `computeCPM` 中加入"概率/可能性"维度提供了**蓝图**。当前项目评估"这件事对我好还是坏"但未评估"这件事发生的概率有多大"——而概率维度是区分希望与恐惧、宽慰与失望的关键信息。建议将 Likelihood 作为独立的第五评估维度。

---

### 3.4 刺激评估检查序列

**Scherer, K. R. (2001).** Appraisal considered as a process of multi-level sequential checking. In *Appraisal Processes in Emotion: Theory, Methods, Research*. Oxford University Press.

**核心发现。** Scherer 的刺激评估检查（Stimulus Evaluation Checks, SECs）模型将评估分解为 14 个 SEC，组织为 4 个评估目标（相关性、含义、应对潜力、规范意义），在 3 个认知层次（感觉运动、图式、概念）上展开。评估的序列特性是关键动态机制——每个 SEC 的结果会修改后续 SEC 的起始条件。特别地，Suddenness（突然性/新颖性检测）是整个评估序列的入口：一个刺激必须先被检测为"新"或"突然"，才会触发后续的完整评估链。

**对项目的映射。** 该论文**支持** CPM→PAD 的串行流水线架构，并为 Suddenness 作为评估序列的网关提供了理论基础。当前项目中的 Suddenness 仅作为评估的一个特征输入，但 Scherer 的理论表明它应该是触发评估过程本身的"门控信号"——没有新颖性检测就没有评估。

---

### 3.5 PAD 三维情感空间

**Mehrabian, A. (1996).** Pleasure-Arousal-Dominance (PAD) temperament model. *Current Psychology*, 14(4), 261-292.

**核心发现。** PAD 三个维度（愉悦-唤醒-支配）在实际测量中几乎正交——交叉相关小于 0.09。这意味着三维空间能够用最少的维度覆盖最大的情感变异。气质（temperament）被定义为跨情境的平均 PAD 状态，即个体的 PAD "引力中心"。Mehrabian 提供了从 PAD 坐标到离散情绪标签的映射函数，使三维连续空间可以输出离散情绪名称。

**对项目的映射。** 该论文**直接支持**项目当前的 PAD 坐标定义和三维情感空间设计。交叉相关<0.09 的发现验证了使用三个独立维度而非更多维度的计算效率。PAD 坐标的"气质引力中心"概念为 ForceField 的长期慢变量提供了理论基础——ForceField 的吸引子可以理解为个体的 PAD 气质中心。

---

### 3.6 情感世界的四维结构

**Fontaine, J. R. J., Scherer, K. R., Roesch, E. B., & Ellsworth, P. C. (2007).** The world of emotions is not two-dimensional. *Psychological Science*, 18(12), 1050-1057.

**核心发现。** 对跨文化情感评定的主成分分析发现，需要四个维度才能充分代表情感空间——而不是常见的两个（效价+唤醒）或三个（PAD）。第四维被识别为"不可预测性/新颖性"（Unpredictability/Novelty），它独立于传统的愉悦、唤醒和支配维度。Suddenness（突然性）或 Novelty 不是 Arousal 的子集，而是一个独立且不可或缺的结构维度。

**关键可计算机制。**

```
PADN = [Pleasure, Arousal, Dominance, Novelty]
// Novelty 不是 Arousal 的缩放，而是独立正交维度
```

**对项目的映射。** 该论文**扩展了** `computePAD` 的设计。当前输出应为四维而非三维。Novelty 维度对区分"惊讶"（高唤醒+高新颖）与"兴奋"（高唤醒+低新颖）至关重要——两者在三维 PAD 中几乎重叠，但在四维 PADN 中显著分离。这一修改是 P0 优先级的。

---

### 3.7 联合子系统假说

**Corr, P. J. (2004).** Reinforcement sensitivity theory and personality. *Neuroscience & Biobehavioral Reviews*, 28(3), 317-332.

**核心发现。** 联合子系统假说（Joint Subsystems Hypothesis, JSH）的核心主张是：行为抑制系统（BIS）和行为趋近系统（BAS）并非独立运作，而是产生功能上相互依赖的效应。在混合线索条件下（同一情境同时包含奖励和威胁信号），行为输出是两个系统**联合**作用的结果。关键公式为：

```
effective_BAS = raw_BAS × (1 - w_inhib × BIS_level)
```

即 BAS 的有效激活被 BIS 的当前水平抑制。这是交叉抑制的定量表达：焦虑（BIS 高）使趋近行为减弱（effective_BAS 降低），即使客观上奖励仍然存在。

**对项目的映射。** 该论文要求对 `updateBISBAS` 进行**关键修改**。当前实现中 BIS 和 BAS 作为独立变量分别计算，但 JSH 表明必须添加交叉抑制项 `effective_BAS = raw_BAS × (1 - w_inhib × BIS)`。这一修改直接改变行为选择的前端——同一奖励在焦虑状态下将驱动更弱的趋近行为。\( w_{inhib} \) 参数是可调节的个体差异变量——高神经质个体具有更高的交叉抑制权重。

---

### 3.8 防御的二维神经心理学

**McNaughton, N., & Corr, R. J. (2004).** A two-dimensional neuropsychology of defense: fear/anxiety and defensive distance. *Neuroscience & Biobehavioral Reviews*, 28(3), 285-305.

**核心发现。** 防御系统不是单一结构，而是由 FFFS（Fight-Flight-Freeze System，战斗-逃跑-僵直系统）和 BIS（Behavioral Inhibition System，行为抑制系统）两个子系统构成。FFFS 负责近端威胁（close threat）——恐惧/恐慌反应，直接触发逃避；BIS 负责远端威胁（distant threat）——焦虑/担忧反应，触发风险评估而非立即行动。BIS 的核心激活条件是：BAS 和 FFFS 同时活跃时（趋近-回避冲突检测器）。

**对项目的映射。** 该论文要求**重大扩展**——将当前的 `fuseThreatSignals` 拆分为 FFFS 和 BIS 两个子系统。FFFS 检测近端威胁并触发紧急逃避；BIS 检测远端威胁/冲突并触发风险抑制。两者的输出在行为选择中具有不同的时间特性和强度分布。这一拆分为区分"恐惧"和"焦虑"——两者在离散情绪层面的关键区别——提供了计算基础。

---

### 3.9 激励显著性计算模型

**Zhang, J., Berridge, K. C., Tindell, A. J., Smith, K. S., & Aldridge, J. W. (2009).** A neural computational model of incentive salience. *PLOS Computational Biology*, 5(7), e1000437.

**核心发现。** 激励显著性（Incentive Salience）——即"想要"（Wanting）——是状态价值的函数乘以生理状态调制因子：`Wanting = k(state) × V(s)`。这里 k 不是一个常数，而是当前生理状态的函数 `k = f(physiological_state)`。当处于饥饿状态时，食物线索的 Wanting 急剧增大（即使 Liking 不变）。Wanting（激励显著性）和 Liking（愉悦体验，映射到 PAD 的 Pleasure 维度）在神经和行为层面是分离的——你可以"想要"却不一定"喜欢"。

**对项目的映射。** 该论文**支持**项目的动机公式 `motivation = k × E[δ]`。k 应由稳态偏离程度和当前 BAS 激活水平共同决定，使得同一事件在不同生理-情感状态下产生不同的动机强度。这同时也意味着 BD 误差驱动的价值更新（学习"什么值得追求"）和生理状态驱动的 Wanting 调制（当下"多么想要"）是两个独立计算。

---

### 3.10 情绪调节扩展过程模型

**Gross, J. J. (2015).** Emotion regulation: current status and future prospects. *Psychological Inquiry*, 26(1), 1-26.

**核心发现。** Gross 将情绪调节概念化为一个层级化的估值系统（hierarchical valuation system），包含四个阶段：识别（Identification）→ 选择（Selection）→ 实施（Implementation）→ 动态监测（Monitoring）。五种调节策略（情境选择、情境修正、注意部署、认知改变、反应调制）按照在情绪生成过程中的位置排列。关键发现：分心（distraction）是快速而浅层的策略（阻止情绪生成），认知重评（reappraisal）是缓慢而深层的策略（改变情绪的意义基础），两者适用于不同的情绪强度情境。

**对项目的映射。** 该论文**支持**项目双通道调节架构（FastStream 分心 vs SlowStream 重评）。但 Gross 的四阶段模型要求项目在调节流水线中增加 (a) 明确的"识别"阶段——检测是否需要调节；(b) 明确的"监测"阶段——评估已实施策略的效果并决定是否切换。这两个阶段在当前的 `emotion-regulation.ts` 中尚未显式建模。

---

### 3.11 CoMERG 计算情绪调节模型

**Bosse, T., Pontier, M., & Treur, J. (2010).** A computational model based on Gross' emotion regulation theory. *Cognitive Systems Research*, 11(3), 211-230.

**核心发现。** CoMERG 是 Gross 五策略模型的首次完整计算形式化。它将情绪响应水平（ERL）建模为一个自调节的动态系统：

```
ERL(t+1) = ERL(t) + γ × (event_impact - Σα_i × regulation_i) - β × ERL(t)
```

其中 α_i 为每种调节策略的效力参数，β 为情绪的自然衰减率。模型的创新在于 α 和 β 为自调谐参数——系统可以学习"什么策略在什么情境下最有效"。

**对项目的映射。** 该论文为 `emotion-regulation.ts` 提供了**直接的技术蓝图**。Bosse 等人的 ERL 动态方程可以直接实现为情绪强度的更新规则。自调谐的 α/β 参数为策略效力学习提供了计算方案，使角色能够通过经验逐步优化其情绪调节能力。

---

### 3.12 EMA 应对策略

**Gratch, J., & Marsella, S. (2004).** A domain-independent framework for modeling emotion. *Cognitive Systems Research*, 5(4), 269-306.

**核心发现。** 问题聚焦应对（problem-focused coping）和情绪聚焦应对（emotion-focused coping）不是二元二分法，而是一个连续体。应对策略的选择由两个连续维度驱动：可控性（controllability）——能否改变情境本身；可变性（changeability）——情境是否随时间自然改变。高可控性情境 → 问题聚焦策略；低可控性+高可变性 → 接受/等待；低可控性+低可变性 → 情绪聚焦策略。

**对项目的映射。** 该论文**修正了**当前应对策略选择规则中的二元判断逻辑。应改为基于可控性和可变性的连续函数选择策略，而非 `if controllable then problem_focused else emotion_focused`。同时指出，在实际情境中角色往往同时采用多种策略（混合应对），而非单一策略。

---

### 3.13 策略选择的漂移扩散模型

**Petter, T., Plaisier, I., Brosschot, J. F., & Verkuil, B. (2025).** Emotion regulation strategy choice: a drift-diffusion model approach. *Emotion*, 25(5), 1273-1292.

**核心发现。** 情绪强度是策略选择的核心门控变量：高强度情绪 → 偏好分心（快速/浅层策略，迅速降低唤醒）；低强度情绪 → 偏好认知重评（缓慢/深层策略，重构意义）。Petter 等人用漂移扩散模型（Drift-Diffusion Model, DDM）形式化了这一选择过程：情绪强度影响 DDM 的起始点偏置和漂移率。

**对项目的映射。** 该论文**修正了** `selectRegulationStrategy`。策略选择必须以当前情绪强度作为门控输入：(1) 计算当前情绪的强度（PAD 向量模长）；(2) 高强度 → 偏置分心策略（高漂移率+起始点偏置）；(3) 低强度 → 偏置重评策略。DDM 形式化使这一选择成为一个随机过程而非确定性规则，增加了行为多样性。

---

## 四、域 3：多级记忆系统 + 睡眠巩固 + 激活衰减

### 域概述

记忆系统是 Character Mind v3 长期运行的数据基础。11 篇论文在此域描绘了一个从毫秒级感觉登记到年级叙事身份的时间尺度谱系。Atkinson & Shiffrin (1968) 的三级模型定义了记忆的基本分层，但 Baddeley (2000) 警告工作记忆容量远小于工程直觉。Klinzing et al. (2019) 的三振荡耦合、Tononi & Cirelli (2014) 的 SHY 假说、Lewis et al. (2018) 的双阶段模型，共同描述了睡眠中记忆的物理重组过程。Pavlik & Anderson (2005) 的 ACT-R 动态衰减公式是对当前固定衰减率的直接纠正；McGaugh (2004) 的情绪-记忆倒 U 型关系指出当前线性情绪增强是错误的。域 3 的核心修改是：(1) 用 ACT-R 动态公式替换常数衰减率；(2) 将情绪记忆增强修正为倒 U 型；(3) 在 fullSleep 中增加 RemoteLink 和情感脱钩阶段。

---

### 4.1 多存储记忆模型

**Atkinson, R. C., & Shiffrin, R. M. (1968).** Human memory: a proposed system and its control processes. In *The Psychology of Learning and Motivation*, 2, 89-195.

**核心发现。** 多存储模型确立了记忆的最少必要分层：感觉记忆（Sensory Register）→ 短时记忆（STM）→ 长时记忆（LTM）。三个存储的区别在于容量、持续时间、编码方式和遗忘机制。ATTENTION 是信息从感觉记忆进入 STM 的门控；REHEARSAL 是信息从 STM 进入 LTM 的主要机制。

**对项目的映射。** 论文指出 3 级是最少必要的——5 级设计是工程细分而非神经模拟。项目文档应明确声明 5 级记忆层次（Sensory → Working → ShortTerm → LongTerm → Core）是工程分层而非生物学同构。Sensory（200ms）对应感觉记忆，Working 和 ShortTerm 共同对应 STM 的主动和被动子成分，LongTerm 和 Core 对应 LTM 的不同编码深度。

---

### 4.2 情景缓冲器与工作记忆容量

**Baddeley, A. D. (2000).** The episodic buffer: a new component of working memory? *Trends in Cognitive Sciences*, 4(11), 417-423.

**核心发现。** 工作记忆容量约为 4 个组块（chunks），而非 50 个离散项目。组块化（chunking）是信息从感觉记忆进入工作记忆的关键压缩机制。Baddeley 提出的情景缓冲器（episodic buffer）是多维信息的临时整合空间，容量同样受限于 4 个组块。50 个条目在没有组块化的情况下对人类工作记忆而言是不可能的。

**对项目的映射。** 当前的 `Working=50` 容量应从 50 个条目调整为 `maxChunks=5-7` 个组块（略大于人类的 4，考虑 LLM 更大的上下文窗口）。需要实现组块化机制：将相关事件压缩为一个组块表示。未经组块化的 50 个原始条目既不符合心理学证据，也浪费了从组块化中获得的信息压缩收益。

---

### 4.3 主动系统巩固

**Klinzing, J. G., Niethard, N., & Born, J. (2019).** Mechanisms of systems memory consolidation during sleep. *Nature Neuroscience*, 22(10), 1598-1610.

**核心发现。** 记忆从海马体到新皮质的转移（系统巩固）由 NREM 睡眠中的三振荡耦合驱动：慢振荡（Slow Oscillations, SO, <1Hz）为全脑节拍器，睡眠纺锤波（Spindles, 12-16Hz）将海马记忆痕迹与皮质目标区域对齐，尖波涟漪（Sharp-Wave Ripples, SWR, 100-250Hz）在海马中进行记忆"重放"并驱动皮质突触可塑性。SO→Spindle→SWR 的嵌套耦合使得记忆在海马-皮质"对话"中被提取、重放和巩固。

**对项目的映射。** 该论文**支持** `quickSleep` 的转存机制设计。但揭示了当前实现可能缺失的关键要素：记忆转存不是均匀的"所有近期记忆被等量拷贝"，而是有选择性的——与已有知识结构相"兼容"的记忆更容易被巩固。这意味着在 quickSleep 中应该模拟"与现有 LongTerm 记忆的相似度"作为转存的选择偏置。

---

### 4.4 记忆巩固综述

**Brodt, S., Gais, S., Beck, S., Erb, M., Scheffler, K., & Schonauer, M. (2023).** Fast track to the neocortex: a memory engram in the posterior parietal cortex. *Neuron*, 111(7), 1050-1075.

**核心发现。** 记忆巩固发生在两个时间尺度上：系统巩固（systems consolidation）持续数天到数年，涉及记忆痕迹从海马体到新皮质的重组；突触巩固（synaptic consolidation）发生在数小时内，涉及局部突触强度的持久化。NREM 和 REM 睡眠对巩固具有乘法效应（multiplicative effect）——并非简单相加：`consolidation_gain = NREM_factor × REM_factor`。这意味着缺少任何一个阶段都会使巩固效果远低于两阶段之和。

**对项目的映射。** 该论文**支持** `fullSleep` 中 NREM+REM 交替的设计，同时确立了两阶段的乘法关系而非加法关系。系统巩固和突触巩固的双时间尺度提示：quickSleep 处理突触巩固（短期记忆到中期记忆），fullSleep 处理系统巩固（中期记忆到长期记忆/核心记忆），两者的计算深度应显著不同。

---

### 4.5 SHY 突触稳态假说

**Tononi, G., & Cirelli, C. (2014).** Sleep and the price of plasticity: from synaptic and cellular homeostasis to memory consolidation and integration. *Neuron*, 81(1), 12-34.

**核心发现。** 突触稳态假说（Synaptic Homeostasis Hypothesis, SHY）主张睡眠的核心功能是突触重正化（renormalization）：清醒期间突触强度净增加（学习产生新的突触连接），睡眠期间发生全局约 20% 的突触下选（down-selection），但在此过程中被重放（replayed）的突触受到保护，不被削弱。遗忘不是被动丢失，而是竞争性存活——不重要的记忆因其突触未被重放保护而在突触下选中被淘汰。

**对项目的映射。** 该论文**支持**项目的"遗忘不是删除"哲学。在睡眠的衰减阶段，应实现竞争性记忆淘汰机制——被访问/关联/重放过的记忆得到保护，未被涉及的记忆受到衰减。这比均匀衰减更加符合生物记忆的动态特性，也意味着记忆的"重要性"可以通过被关联的频率涌现出来，而非预先赋值。

---

### 4.6 BiOtA 双阶段巩固模型

**Lewis, P. A., Knoblich, G., & Poe, G. (2018).** How memory replay in sleep boosts creative problem-solving. *Trends in Cognitive Sciences*, 22(6), 491-503.

**核心发现。** BiOtA (Binding of Ideas to Associations) 模型揭示了 NREM 和 REM 在记忆巩固中的分工：NREM 负责要点提取（gist extraction）——从多个具体事件中抽取共同的抽象模式；REM 负责跨域超联想（cross-domain hyperassociativity）——将通常不会同时激活的记忆关联起来。两者的乘法效应意味着创造性见解需要完整的 NREM+REM 循环。超联想步骤产生"远程链接"（RemoteLinks）——即多个不同记忆之间的新颖关联。

**对项目的映射。** `fullSleep` 应增加 RemoteLink 步骤。在 REM 阶段模拟后，不仅更新单个记忆的权重，还应创建或强化跨域记忆之间的关联（在 CoreGraph 中表现为新边的创建或边权重的增加）。这一步骤是实现"角色在睡眠后对新问题有新的看法"的底层机制。

---

### 4.7 睡眠依赖情感解码假说

**Walker, M. P., & van der Helm, E. (2009).** Overnight therapy? The role of sleep in emotional brain processing. *Psychological Bulletin*, 135(5), 731-748.

**核心发现。** SFSR 假说（Sleep to Forget, Sleep to Remember）的核心主张是：REM 睡眠期间去甲肾上腺素水平接近零（NE≈0），这创造了一个独特的神经化学窗口——记忆的内容被保留和巩固，但附着在记忆上的情感标签被逐渐剥离。每个 REM 周期，情感标签衰减 5-10%。这解释了"睡一觉后事情看起来没那么严重"的现象。

**对项目的映射。** 在 `fullSleep` 的 REM 阶段应**增加**情感脱钩（affective decoupling）步骤：对记忆的情感标签施加 5-10% 的衰减因子。重复经历 REM（即多个睡眠周期）使情感脱钩累积，产生"时间治愈情感"的动态。情感脱钩速率可以是个性化参数，如高神经质角色的脱钩速率更低。

---

### 4.8 ACT-R 动态衰减与间隔效应

**Pavlik, P. I., & Anderson, J. R. (2005).** Practice and forgetting effects on vocabulary memory: an activation-based model of the spacing effect. *Cognitive Science*, 29(4), 559-586.

**核心发现。** ACT-R 框架中的关键发现是：记忆衰退率不是常数，而是随当前激活水平动态变化的——`d(t) = c × exp(m(t)) + a`，其中 m(t) 是记忆的当前激活水平。这一公式自然地产生了间隔效应（spacing effect）：被多次间隔重复访问的记忆具有更高的 m(t)，从而具有更慢的衰退率 d(t)。而常数衰减率无法模拟间隔效应，导致"刚复习过的记忆和从未复习的记忆以相同速度遗忘"的不合理现象。

**关键可计算机制。**

```
d(t) = c × exp(m(t)) + a
m(t) = ln(Σ t_j^{-d_decay})  // 激活水平由历史上每次访问的加权和决定
```

**对项目的映射。** 该论文要求对衰减机制进行**关键修改**：用 ACT-R 动态公式替换当前的常数衰减率。每次记忆被访问（检索、关联、重放），其 m(t) 增加，从而降低未来衰退率。这实现了一个自调节系统——"被使用的记忆留存，被忽略的记忆消退"——无需外部重要性评分。

---

### 4.9 杏仁核记忆调制

**McGaugh, J. L. (2004).** The amygdala modulates the consolidation of memories of emotionally arousing experiences. *Annual Review of Neuroscience*, 27, 1-28.

**核心发现。** 情绪对记忆的增强效应遵循倒 U 型曲线：中等情绪唤醒产生最大记忆增强；低唤醒（无聊事件）记忆弱；极高唤醒（创伤事件）可能导致记忆碎片化而非增强。情绪增强的时间窗口约为 2 小时——发生在编码后的 NE（去甲肾上腺素）和 GR（糖皮质激素）共同激活窗口内。

**对项目的映射。** 当前的情绪-记忆调制因子为线性（情绪越强、记忆越牢），应**修正为倒 U 型**。极高情绪强度（如创伤事件）不应产生最强的记忆——应产生碎片化、选择性提取困难但核心印象极度顽固的"创伤记忆"特征。这需要将情绪因子改为 `factor = intensity × exp(-intensity / optimal)` 的倒 U 型函数。

---

### 4.10 心境与记忆的关联网络

**Bower, G. H. (1981).** Mood and memory. *American Psychologist*, 36(2), 129-148.

**核心发现。** Bower 的关联网络理论（Associative Network Theory）将情绪节点建模为记忆网络中的枢纽节点。情绪节点与具有相同情感价的事件记忆之间存在双向激活扩散——当处于愉快心境时，愉快记忆的激活阈值降低，更容易被检索到（心境一致性效应）。正性情绪对记忆的增强效应 > 负性情绪——即"玫瑰色眼镜"效应。

**对项目的映射。** 该论文**支持**五种检索策略中的情绪一致性维度。在记忆检索时，当前心境应作为检索偏置——与当前心境情感价一致的记忆具有更低的检索阈值。这为"角色在心情好时回忆起更多好事"提供了计算基础。Bower 还指出，心境一致性检索本身可能形成正反馈循环（好心情→好记忆→更好的心情→更多好记忆），这一动态可能需要在检索中设置抑制机制防止循环锁定。

---

### 4.11 自我记忆系统

**Conway, M. A., & Pleydell-Pearce, C. W. (2000).** The construction of autobiographical memories in the self-memory system. *Psychological Review*, 107(2), 261-288.

**核心发现。** 自传体记忆（autobiographical memory）由三层结构组成：人生时期（lifetime periods）→ 一般事件（general events）→ 事件特异性知识（event-specific knowledge, ESK）。"工作自我"（Working Self）是一个动态激活的目标层级结构，控制着从自传体知识库中检索什么样的记忆。工作自我与当前目标一致的记忆被激活，与当前自我概念冲突的记忆被抑制。

**对项目的映射。** CoreGraph 对应自传体知识库的三层结构，但项目当前缺少显式的 Working Self 机制。Working Self 并非被动存储，而是主动的检索偏置——当前目标和自我概念决定了哪些记忆被"选择出来"。这一机制表明 NarrativeIdentity 和 MemoryRetriever 不是分离的模块，而是通过 Working Self 的概念深度融合。

---

## 五、域 4：意识理论 + 情绪动力学 + 调节 + 反刍 + 无聊

### 域概述

意识理论为 Character Mind v3 的"两流架构"（FastStream + SlowStream）提供了认知神经科学基础。13 篇论文在此域形成两个交织的主线：(1) 意识/思想动态的计算机制——Dehaene et al. (2014) 的全局工作空间、Christoff et al. (2016) 的心智游移框架、Mildner & Tamir (2019) 的自发思维模型，共同描述了思想在"无意识并行加工"到"意识序列瓶颈"之间的门控动力学；(2) 情绪的本质和动态——Barrett (2017) 的构建情绪理论从根本上否决了离散情绪模块的路线，Bottemanne et al. (2022) 将心境建模为情绪的慢变量贝叶斯层，Allen et al. (2022) 提供了内感受作为 POMDP 的可工程实现。此外，Bonanno & Burton (2013) 的调节灵活性、Wang et al. (2020) 的抑制反弹、Treynor et al. (2003) 的反刍二维结构、Danckert et al. (2025) 的无聊稳态模型——这些共同构成了情绪的"第二层动力学"——即情绪本身如何被管理和调节。

---

### 5.1 全局工作空间理论

**Dehaene, S., Charles, L., King, J.-R., & Marti, S. (2014).** Toward a computational theory of conscious processing. *Current Opinion in Neurobiology*, 25, 76-84.

**核心发现。** 全局神经元工作空间（Global Neuronal Workspace, GNW）理论将意识建模为工作空间的"点燃"（ignition）——当多个专门处理器（视觉、听觉、记忆、评估等）中的信息同时接入全局工作空间并引发全脑同步激活时，该信息成为"有意识的"。两阶段动态：(1) 无意识阶段——多个处理器并行独立运作，信息在局部网络中处理；(2) 意识阶段——当局部激活超过阈值，工作空间被点燃，信息进入串行瓶颈，被全脑广播。神经时间尺度是毫秒级的——conscious access 约 300-500ms。

**对项目的映射。** 该论文**支持**双流架构的核心逻辑——FastStream 对应"无意识并行加工"（多模块同时运行、快速响应），SlowStream 对应"意识序列瓶颈"（单一焦点、深度加工）。但论文的毫秒级时间尺度表明项目的 5s/5min 是工程隐喻而非神经仿真。文档应澄清：FastStream 的 5 秒间隔和 SlowStream 的 5 分钟间隔是 LLM 延迟约束下的工程近似，不是对意识的神经时间尺度的模拟。

---

### 5.2 心智游移框架

**Christoff, K., Irving, Z. C., Fox, K. C. R., Spreng, R. N., & Andrews-Hanna, J. R. (2016).** Mind-wandering as spontaneous thought: a dynamic framework. *Nature Reviews Neuroscience*, 17(11), 718-731.

**核心发现。** 心智游移（mind-wandering）由默认模式网络（DMN）、凸显网络（SN）和额顶控制网络（FPCN）三者的动态交互约束。思想必须在两个门槛上满足条件才能触发行动：第一门槛（从无意识到前意识）——思想的激活强度超过最低阈值；第二门槛（从前意识到意识/行动）——思想的内容与当前目标相关或具有情感凸显性。DMN 生成自发思想（自动联想），SN 检测思想的情感/动机显著性，FPCN 对高优先级思想施加控制。

**对项目的映射。** 该论文为 `consciousness.ts` 提供了**架构蓝图**。DMN 对应背景思绪生成（自发激活记忆关联），SN 对应评估哪些思想需要"升温"（情感凸显性检测），FPCN 对应当前任务的主动约束。双重门槛机制可直接实现为：`if activation > T1 → preconscious; if activation > T2 AND (goal_relevance OR salience) → conscious/action`。

---

### 5.3 自发思维计算模型

**Mildner, J. N., & Tamir, D. I. (2019).** Spontaneous thought as an unguided memory retrieval process. *Trends in Cognitive Sciences*, 23(9), 743-753.

**核心发现。** 自发思维的动力学可以用两个计算机制来描述：(1) 上下文向量漂移——当前思维的空间向量 c(t) 随时间在语义空间中漂移，`c(t+1) = c(t) + drift_vector`，漂移方向受当前情绪状态、动机和最近处理内容的影响；(2) 觅食切换——当一个主题的"信息收益"下降到阈值以下，思维切换到新主题。思想的激活强度为 `a(t,i) = f(similarity(i, c(t)), relevance(i, state))`，即记忆 i 在时间 t 的激活取决于它与当前上下文向量的语义相似度和与当前状态的相关性。

**对项目的映射。** FastStream 应实现上下文向量漂移机制。当前 FastStream 的思维流程可能过于线性和目标导向——应允许上下文向量在关联记忆中自由漂移，产生"思绪游走"的现象。切换机制则由情绪凸显性（重要性）和语义收益（是否还在这个主题上获得新信息）共同决定。

---

### 5.4 情感神经科学与初级情绪系统

**Panksepp, J. (1998).** *Affective Neuroscience: The Foundations of Human and Animal Emotions.* Oxford University Press.

**核心发现。** Panksepp 识别了 7 个皮层下初级情绪系统（primary-process emotional systems）：SEEKING（探索/欲望）、RAGE（愤怒）、FEAR（恐惧）、LUST（性欲）、CARE（养育）、PANIC/GRIEF（分离痛苦）、PLAY（社交游戏）。这 7 个系统在进化上古老、神经化学上特化、行为上可分离。它们构成三层情感层级的基础层——初级过程（本能情绪）、次级过程（学习/记忆）、三级过程（认知/反思）。

**对项目的映射。** 该论文对 12D 设计构成了**部分挑战**。12 个心境维度中，至少有 6 个（SEEKING、RAGE、FEAR、CARE、PANIC/GRIEF、PLAY）可以直接映射到 Panksepp 的 7 个初级系统。但 Lust 是唯一不在 12D 中的初级系统（可能在项目中出于伦理考量被排除）。建议采用两层情感架构：第 1 层 = 7 个初级情绪系统（生物基础，快速/本能），第 2 层 = 12 个心境场（认知/社会建构，慢变量）。两层通过评估系统的精度加权相互作用。

---

### 5.5 多维心境理论

**Bottemanne, H., Morlaas, O., Fossati, P., & Schmidt, L. (2022).** A multidimensional approach to mood: from theory to clinical applications. *L'Encephale*, 48(6), 682-699.

**核心发现。** 心境（mood）可以被建模为三层贝叶斯信念——它编码的是对情绪水平预测精度的高阶信念。简单来说，情绪是"我现在感觉到什么"，心境是"我通常/应该感觉到什么"。心境按以下方式更新：`mood(t) = α × mood(t-1) + (1-α) × emotion(t)`，其中 α ~ 0.95。这意味着心境是情绪的指数加权移动平均，每次情绪事件只贡献约 5% 的增量更新。

**对项目的映射。** 该论文**直接支持** 12D ForceField 的设计——力场的吸引子实际上就是心境状态。论文建立的时间尺度（α~0.95，即每次情绪事件只更新约 5%）对应于 SlowStream 的 5 分钟更新间隔：大量情绪事件累积后，心境缓慢漂移。如果 α=0.95 且事件间隔为秒级，5 分钟间隔约含 300 次自然情绪波动，累积更新比重为 `1 - 0.95^300 ≈ 1 - 10^{-7} ≈ 接近收敛`，这与 SlowStream 作为心境更新间隔的设计高度一致。

---

### 5.6 构建情绪理论

**Barrett, L. F. (2017).** The theory of constructed emotion: an active inference account of interoception and categorization. *Social Cognitive and Affective Neuroscience*, 12(1), 1-23.

**核心发现。** 情绪不是被特定刺激"触发"的模块化反应，而是大脑从三个来源——内感受信号（身体状态）、概念知识（情绪概念/类别）和执行注意（情境约束）——通过贝叶斯预测编码主动构建的脑状态。情绪的分类（"我在生气" vs "我在害怕"）是自动的、非意识的归类过程（categorization），不需要有意识的标签化。大脑对情绪的构建在本质上与对颜色、声音的构建使用相同的预测编码机制——只是内感受预测的对象是身体内部而非外部世界。

**对项目的映射。** 该论文是 Character Mind v3 的**核心理论基础**。它直接验证了"情绪发生在角色身上"（而非被触发）的项目哲学——情绪应该是计算过程的涌现结果，而非预定义的规则映射。五个核心推论：(1) 不应有离散情绪模块（如 angerModule.ts）；(2) 情绪差异来自内感受精度、概念知识精度和注意分配的配置差异；(3) 情绪词汇（"生气"、"悲伤"）是后端归类标签而非内部状态标签；(4) 同一个生理状态（高唤醒+低愉悦）可被归类为多种情绪，取决于情境；(5) 构建过程对项目而言是多个独立模块（内感受、评估、概念归类）的计算交互，而非单一流水线。

---

### 5.7 心脏主动推理

**Allen, M., Levy, A., Parr, T., & Friston, K. J. (2022).** In the body's eye: the computational anatomy of interoceptive inference. *PLOS Computational Biology*, 18(9), e1010490.

**核心发现。** 内感受推理可以作为一个部分可观测马尔可夫决策过程（POMDP）来完整实现。模型将心跳等内感受信号建模为观测，将身体状态建模为隐藏状态，将情绪归类建模为对隐藏状态的贝叶斯推断。关键发现：对 POMDP 施加内感受"损伤"（如降低内感受精度）可以产生模拟的"幻觉性"情绪体验——即角色感觉到与实际身体状态不一致的情绪，这对应于焦虑障碍和躯体化障碍中的现象。

**对项目的映射。** 该论文为 `interoception.ts` 提供了**可直接实施的 POMDP 架构**。将内感受信号 → 身体隐藏状态 → 情绪归类的三层推理直接映射到代码中。Allen 等人的"内感受损伤"实验还提供了一个意外的调试工具——通过人为降低内感受精度，可以模拟一系列心理健康状况（焦虑：高内感受精度但低内感受信念精度 → 对身体信号过度敏感但无法准确归类）。

---

### 5.8 TCE vs BET 实证检验

**Gundem, D., Zhang, J., & Barrett, L. F. (2022).** Comparing the constructed emotion theory to basic emotion theory using fMRI activation patterns. *Communications Biology*, 5(1), 1354.

**核心发现。** 8 个假设检验的结果决定性地支持构建情绪理论（TCE）而非基本情绪理论（BET）。关键证据：(1) 离散情绪类别之间的神经特异性低——不存在一致的"愤怒脑区"或"恐惧脑区"；(2) 跨类别的神经激活重叠高；(3) 情绪实例之间的变异大于类别之间的变异——同一类别（如"恐惧"）的两个实例在脑活动模式上的差异，可能大于"恐惧"与"愤怒"之间的差异。

**对项目的映射。** 该论文**解决了关键架构决策**：Character Mind v3 应使用一个统一的内感受-预测推理引擎，而非离散情绪模块。这意味着项目不需要独立的 angerGen、fearGen、sadnessGen 等生成器——所有情绪从一个统一的推理过程中涌现，其分化取决于内感受状态、概念知识和情境上下文的组合而非硬编码的分类边界。

---

### 5.9 调节灵活性模型

**Bonanno, G. A., & Burton, C. L. (2013).** Regulatory flexibility: an individual differences perspective on coping and emotion regulation. *Perspectives on Psychological Science*, 8(6), 591-612.

**核心发现。** 情绪调节的有效性不取决于使用"正确的"策略，而取决于三个元能力的组合：情境敏感性（context sensitivity）——能否准确感知情境的调节需求；策略广度（repertoire breadth）——拥有多少种可用的调节策略；反馈响应性（feedback responsiveness）——能否根据策略实施效果及时调整。没有一个策略在所有情境中都是最佳的——调节的健康在于灵活适应当下需求的能力。

**对项目的映射。** 该论文为 `emotion-regulation.ts` **增加了缺失的输入维度**：(a) 情境敏感性——在策略选择前加入"情境评估"阶段，决定当前的调节需求（是该降低唤醒还是该改变评估？）；(b) 反馈响应性——加入策略失败检测和策略切换机制：当一种策略实施后情绪未有效改变，自动尝试备选策略。

---

### 5.10 抑制反弹元分析

**Wang, D., Hagger, M. S., & Chatzisarantis, N. L. D. (2020).** Ironic effects of thought suppression: a meta-analysis. *Perspectives on Psychological Science*, 15(3), 778-793.

**核心发现。** 31 项研究的元分析确认：情绪表达抑制产生可靠的"反弹效应"——抑制解除后，被抑制的情绪反弹至原始强度的约 1.5 倍。反弹的强度与抑制的持续时间和努力程度正相关：抑制越久、越用力，反弹越剧烈。抑制不是"消除"情绪，而是"延迟并放大"。

**对项目的映射。** 该论文要求在情绪调节模型中**增加**：(a) `reboundResidual`——被抑制情绪不消失，而是进入"残余"状态，其强度随时间累积；(b) 高异稳态负荷下抑制的代价惩罚——持续抑制产生累积的生理/心理成本（表现为异稳态负荷的增加），成本在抑制解除时转化为反弹情绪的放大因子。

---

### 5.11 反刍的二维结构

**Treynor, W., Gonzalez, R., & Nolen-Hoeksema, S. (2003).** Rumination reconsidered: a psychometric analysis. *Cognitive Therapy and Research*, 27(3), 247-259.

**核心发现。** 反刍（rumination）不是单一结构，而是由两个维度构成：冥思（Brooding）——抽象的、被动的、聚焦于过去的，"为什么我总是这么倒霉"——这是适应不良的，与抑郁持续相关；反思（Reflection）——具体的、主动的、聚焦于未来的，"我这次哪里做错了，下次怎么改进"——这是适应性的，与问题解决相关。两个维度的区分标准：(a) 抽象 vs 具体；(b) 被动 vs 主动；(c) 过去导向 vs 未来导向。

**对项目的映射。** 该论文**完全验证了** `classifyRuminationVsReflection` 的三维度区分设计。三个区分维度（抽象/具体、被动/主动、过去/未来导向）在地映射到 Treynor 等人的实证结构。这意味着当角色反思时，系统可以被分类为"是健康反思还是病理性反刍"，为后续的叙事身份更新和情绪影响提供方向性基础。

---

### 5.12 无聊的稳态设定点

**Danckert, J., Hammerschmidt, T., Marty-Dugas, J., & Smilek, D. (2025).** Boredom: a homeostatic set-point model. *Communications Psychology*, 3, 16.

**核心发现。** 无聊可以被建模为稳态失调——无聊 = `max(0, c* - c(t))`，其中 c* 是最优认知参与水平（个体设定点），c(t) 是当前认知参与水平。当 c(t) < c*，产生"参与不足无聊"——寻求刺激行为被激活；当 c(t) > c*（过度刺激），产生"过度刺激无聊"——退出行为被激活。设定点 c* 不是固定值——随着角色的经验和人格变化而漂移。

**对项目的映射。** 该论文**验证了**项目的无聊公式，同时指出了缺失："过度刺激无聊"（upper-bound check）——即在高强度刺激环境中，角色不应无限提高刺激寻求，而应在阈值处触发退出行为。**此外需增加**设定点漂移机制（setpoint drift）：c* 随经验动态调整，长期处于高刺激环境的角色会调高 c* 设定点（"习惯高强度"）。

---

### 5.13 MAC 注意力-意义模型

**Westgate, E. C., & Wilson, T. D. (2018).** Boring thoughts and bored minds: the MAC model of boredom and cognitive engagement. *Psychological Review*, 125(5), 689-713.

**核心发现。** 注意力（Attention）和意义（Meaning）是无聊的两个独立且交互的成分。认知参与度不是两者的加权和，而是两者的最小值：`engagement = min(attention, meaning)`。这意味着高注意力但无意义的活动与有意义但无法集中注意力的活动同样无聊——只有当两者都足够时参与度才高。这一交互效应解释了为什么"好玩但无意义"和"有意义但枯燥"的活动都会让人无聊。

**对项目的映射。** 该论文**修正了**参与度计算的数学形式。当前的加权加法 `engagement = w_a × attention + w_m × meaning` 应改为 `engagement = min(attention, meaning)`。最小值函数捕捉了瓶颈效应——两个维度中的短板决定了整体参与度上限，加法函数无法捕捉这一交互结构。

---

## 六、域 5：社会认知 + 自我模型 + LLM Agent 架构

### 域概述

社会认知和 Agent 架构域连接了 Character Mind v3 的两条线索：(a) 角色如何理解他人（心理理论）、如何感受他人（共情）、如何建立关系（依恋）；(b) 角色自身的架构如何设计（生成式 Agent、技能库、仲裁机制）。13 篇论文在此域的结构是：Baker et al. (2017) 和 Kosinski (2024)、Strachan et al. (2024) 界定了 ToM 的计算边界；Gallese et al. (2004) 和 Heyes (2018) 处理了共情的神经基础与习得本质；Park et al. (2023) 和 Wang et al. (2023) 提供了 LLM Agent 的架构参照；McAdams & Pals (2006)、Hirsh et al. (2013)、Gagliardi (2022)、Pichiecchio et al. (2026) 处理了自我模型和依恋关系；Faghihi & Estey (2015) 和 PRIME (2025) 提供了冷热分离的仲裁机制。

---

### 6.1 贝叶斯心理理论

**Baker, C. L., Jara-Ettinger, J., Saxe, R., & Tenenbaum, J. B. (2017).** Rational quantitative attribution of beliefs, desires, and percepts in human mentalizing. *Nature Human Behaviour*, 1, 0064.

**核心发现。** 心理理论（mentalizing）可以被形式化为联合贝叶斯推断——对他人信念、欲望和知觉的逆向建模。给定观察到的行为和情境，推理者逆向推断他人的心理状态：`P(mental_states | actions, context)`。这是一个生成模型的逆向使用——正常的正向流程是从心理状态生成行为，但社会认知要求从行为推断心理状态。人类使用近似贝叶斯推理进行这一推断，且推理精度随经验提高。

**对项目的映射。** 该论文**挑战了** `TheoryOfMind` 的全 LLM 设计。当前纯 LLM 驱动的 ToM 缺乏贝叶斯校准层——LLM 可能以不可靠的方式跳转到结论，而贝叶斯推断可以提供概率校准。建议在 LLM ToM 上叠加一个贝叶斯校准层：(a) LLM 生成多个可能的心理状态假设；(b) 贝叶斯层根据观察的行为证据计算每个假设的后验概率；(c) 以后验概率加权组合作为最终 ToM 输出。

---

### 6.2 GPT-4 心理理论能力

**Kosinski, M. (2024).** Evaluating large language models in theory of mind tasks. *PNAS*, 121(44), e2405460121.

**核心发现。** GPT-4 在标准错误信念任务（false-belief tasks）上达到 75% 的准确率，相当于 6 岁儿童的水平。表现随模型规模和指令调优而提升——GPT-3.5 明显低于 GPT-4，基础模型低于调优后模型。但这一表现的深层含义存在争议——LLM 可能是通过统计模式匹配而非真正的"推理"来完成 ToM 任务。

**对项目的映射。** 该论文**条件性地支持** LLM 驱动的 ToM 设计，但同时标记了脆弱性：LLM 的 ToM 推理可能在 out-of-distribution 的社交情境中不可靠地退化。这意味着项目中的 ToM 模块应是 LLM 推理 + 规则校准的混合体——LLM 提供灵活性，规则系统提供一致性保证。

---

### 6.3 ToM 系统比较

**Strachan, J. W. A., Albergo, D., Borghini, G., Pansardi, O., Scaliti, E., Gupta, S., ... & Becchio, C. (2024).** Testing theory of mind in large language models and humans. *Nature Human Behaviour*, 8, 1285-1295.

**核心发现。** GPT-4 在 faux pas（社交失礼）检测任务上低于人类水平——表现出过度保守的偏见。推理能力（reasoning competence）与响应策略（response strategy）的分离是核心发现：LLM 可能"知道"某个社交情境中发生了什么（推理能力），但仍然给出过度保守或无失礼的判断（响应策略偏差）。这与人类的社交焦虑类似——能力在但选择不说。

**对项目的映射。** 该论文要求**增加**谨慎度偏置参数（cautiousness bias）。角色的 ToM 模块应有一个可调参数控制其在社交判断中的"保守程度"——高谨慎度的角色不太可能标签他人的行为为 faux pas（即使推理到了），这对应了人类中的社会期望偏误。

---

### 6.4 镜像神经元与社会共振

**Gallese, V., Keysers, C., & Rizzolatti, G. (2004).** A unifying view of the basis of social cognition. *Trends in Cognitive Sciences*, 8(9), 396-403.

**核心发现。** 社会认知的基础是共振（resonance）——对他人的行动、情绪和感觉的快速、自动、前反射式的共享神经表征。镜像神经元系统提供了一种共享的神经"格式"：观察他人的行动激活与执行相同行动相同的神经回路；观察他人的情绪激活与体验相同情绪相同的神经回路。这种共振是前反射的——不经过认知评估，延迟极短。

**对项目的映射。** 该论文**强力支持**项目的 `mirrorResonance` 机制。镜像共振应该是基于规则的（rule-based）且零延迟的——不需要经过评估流水线或 LLM 推理。观察他人的情绪表达 → 直接在自身 PAD 空间产生同构扰动。共振强度由 closeness（亲密度/熟悉度）调节，但不依赖认知加工。

---

### 6.5 共情的习得本质

**Heyes, C. (2018).** Empathy is not in our genes. *Neuroscience & Biobehavioral Reviews*, 95, 499-507.

**核心发现。** 共情的 Empathy1（自动情绪传染）和 Empathy2（受控认知共情）两者都不是先天的，而是通过联想学习（associative learning）在社会互动经验中习得的。共情能力是经验依赖的——个体通过与特定他人的重复互动学习该他人的情绪模式，从而"能够"共情该他人的体验。closeness（亲密感）本身就是共情学习的历史产物。

**对项目的映射。** 该论文**支持**项目的"涌现优先于构造"哲学。共情不应是一个被赋予的静态属性（如 `empathy=0.7`），而应从互动历史中涌现——closeness 应当 learn from interaction history, 高频互动 + 积极体验 → 高共情准确性。这意味着 closeness 参数是一个记忆-关联系统的输出，而非初始配置。

---

### 6.6 生成式 Agent

**Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023).** Generative agents: interactive simulacra of human behavior. *UIST 2023.* Best Paper Award.

**核心发现。** 生成式 Agent 架构由三个核心组件构成：记忆流（memory stream）——所有感知和事件以时间序列记录；检索（retrieval）——基于新近性、重要性和相关性从记忆流中检索相关记忆；反思（reflection）——周期性对记忆进行高层次抽象，生成"见解"并存入记忆流；规划（planning）——基于当前状态和洞察生成行动计划。25 个 Agent 在沙盒中运行 2 天，涌现出信息扩散、关系形成、活动协调等社会行为。

**对项目的映射。** `NarrativeIdentitySystem` + Cold Path 的设计与 Park 等人的架构高度并行。但 Park 等人的重要性评分机制在项目中**缺失**——检索时不仅考虑相关性和新近性，还需要一个动态的"重要性"评分（哪些事件值得被记住和反思）。重要性不应是静态标签，而应从事件的评估结果（如目标一致性、情感强度）中动态生成。

---

### 6.7 Voyager 技能库

**Wang, G., Xie, Y., Jiang, Y., Mandlekar, A., Xiao, C., Zhu, Y., Fan, L., & Anandkumar, A. (2023).** Voyager: an open-ended embodied agent with large language models. *NeurIPS 2023.*

**核心发现。** Voyager 的核心创新是技能库（skill library）——行为的存储形式是可执行代码（而非陈述性记忆）。技能库支持组合泛化（compositional generalization）——复杂行为由更简单的技能组合而成，而非从零推导。当遇到新任务时，Voyager 从技能库中检索最相似的已有技能并改编，而非从头生成。

**对项目的映射。** `SelfModel` 应增加 `BehavioralScripts` 机制——将成功的、重复出现的行为模式编译为可复用的"行为脚本"。脚本具有参数槽（类似函数的参数），允许在不同但相似的社交情境中复用。行为脚本的编译是 Cold Path 的功能（深度反思时进行模式提取），脚本的执行是 Hot Path 的功能（快速匹配-执行）。

---

### 6.8 三层人格模型

**McAdams, D. P., & Pals, J. L. (2006).** A new Big Five: fundamental principles for an integrative science of personality. *American Psychologist*, 61(3), 204-217.

**核心发现。** 人格由三个层级构成：第 1 层——特质（dispositional traits），如 Big Five，稳定、跨情境、主要由遗传决定；第 2 层——特征性适应（characteristic adaptations），如目标、价值观、应对策略，受情境影响，可随时间变化；第 3 层——叙事身份（narrative identity），如自传体故事和自我定义记忆，整合整个人生经历为连贯的自我叙事。关键时间尺度：叙事身份更新频率是月/季度级别（"人生转折点"），而非每次反思。

**对项目的映射。** 该论文**修正了**叙事更新的频率设计。当前每次反思都更新 NarrativeIdentity 的频率过高——应将叙事身份更新与事件记录区分开来：(a) 事件记录——每次有意义的互动都记录，属于第 2 层；(b) 叙事重建——每约 30 天或触发关键事件（身份破裂）时执行，属于第 3 层。

---

### 6.9 叙事作为预测加工

**Hirsh, J. B., Mar, R. A., & Peterson, J. B. (2013).** Psychological entropy: a framework for understanding uncertainty-related anxiety. *Behavioral and Brain Sciences*, 36(3).

**核心发现。** 叙事连贯性（narrative coherence）可以重新理解为预测误差最小化——连贯的自我叙事是对"我是谁"和"发生了什么"的预期模型，当事件违背叙事预期时，产生预测误差级联。身份破裂（identity rupture）本质上是预测误差级联——大量事件同时与当前的自我叙事发生冲突，导致叙事模型整体失效，需要重建。

**对项目的映射。** 该论文**重新定义了** `NarrativeCoherence` 的含义：不应是静态属性（"健康身份=0.8"），而应是预测误差驱动的动态量：(a) 叙事连贯性 = 当前自我叙事对近期事件的预测准确度；(b) 身份破裂被触发当 `PE_narrative > rupture_threshold`；(c) 叙事重建是 Cold Path 的最高深度操作——重新构建自我模型以容纳累积的违背。这一重新定义使叙事连贯性从"被赋值"变为"被计算"。

---

### 6.10 依恋的多维控制系统

**Gagliardi, M. (2022).** Attachment as a multidimensional control system. *Frontiers in Psychology*, 13, 844012.

**核心发现。** 依恋不是一个一维的"安全性"连续体，而是由多个独立维度组成的控制系统。回避（avoidance）和矛盾（ambivalence）是独立的维度——一个人可以同时是高回避和高矛盾的（恐惧型依恋），也可以低回避但高矛盾（迷恋型依恋）。内部工作模型（IWM）是控制系统中关于"他人是否响应"和"自我是否值得被响应"这两个核心问题的习得表征。

**对项目的映射。** 该论文**扩展了** `RelationshipState` 从当前的 2D（trust, familiarity）到 4D：增加 (a) avoidance——与他人保持距离的倾向；(b) ambivalence——对关系持有矛盾感受的程度；(c) epistemic foraging rate——从该关系中获取关于他人心智状态的信息的速率。这四个维度构成关系状态的"相空间"，不同依恋风格对应相空间中的不同区域。

---

### 6.11 主动推理依恋模型

**Pichiecchio, A., Sanguineti, V., & Becchio, C. (2026).** Attachment as active inference: a computational model. *Frontiers in Psychology*.

**核心发现。** 依恋风格可以通过精度（precision）配置来形式化。安全型 = 高 `π_belief`（对他人心智状态信念的精度高）+ 高 `π_sensory`（对社会线索的感觉精度高）。回避型 = 高 `π_belief`（"他人不可靠"这一先验信念的精度高，不易被新证据更新）+ 低 `π_sensory`（对社会线索的关注精度低）。矛盾型 = 低 `π_belief`（对关系信念的精度低，容易被新证据剧烈摆动）+ 高 `π_sensory`（对社会线索过度关注）。

**对项目的映射。** 该论文将 `trust` 和 `familiarity` 从数值重新定义为精度配置。信任不是"我相信你 0.7"，而是"我对'你是善意的'这一信念的精度高/低"。精度框架的优势在于：(a) 编码了确定性和学习速率在同一参数中；(b) 不同依恋风格可以简洁地描述为精度参数的配置；(c) 从观察到行为更新学习速率本身就是一个精度更新问题。

---

### 6.12 ACT-R 双过程理论

**Faghihi, U., & Estey, C. (2015).** A dual-process model of Kahneman's thinking, fast and slow, implemented in ACT-R. *Biologically Inspired Cognitive Architectures*, 14, 33-48.

**核心发现。** 双过程（Kahneman 的系统 1/系统 2）不是二元开关，而是一个连续谱。系统的位置由"系统指数"决定：`SystemIndex = (α × n_retrievals) / (α × n_retrievals + β × n_productions)`。当检索次数多、生成规则次数少 → 系统 2 型（深度推理）；当生产规则次数多、检索次数少 → 系统 1 型（快速直觉）。这意味着任何具体思考行为都位于 S1-S2 连续谱上的某个位置，而非完全属于一端。

**对项目的映射。** 该论文**支持**项目的冷热分离设计，同时**挑战**了线性 L0-L6 层级。当前设计将 L0-L6 建模为离散的层级——但 Faghihi & Estey 的 SystemIndex 表明它是一个连续变量：(a) 检索 vs 生成的比例决定系统位置；(b) 同一层级的不同实例可能位于连续谱的不同位置。建议用 SystemIndex 概念补充离散层级设计——在每层内部以检索/生成比例决定该层加工的"直觉度"。

---

### 6.13 PRIME 按需仲裁架构

**PRIME (2025).** Planning and Retrieval-Integrated Memory Engine. arXiv:2509.22315.

**核心发现。** 最优架构不是每个回合都运行完整的深度推理（Cold Path），而是按需仲裁——仅当预测误差超过阈值时才触发深度推理。PRIME 提出了 ReflectionGate 机制：监控预测误差，当 PE 累积超过触发阈值时，打开深度推理的"门"，让系统进入 Cold Path。日常低 PE 状态则维持 Hot Path 的快速响应。这种设计大大降低了计算成本，同时保持了在关键时刻的深度推理能力。

**对项目的映射。** 该论文要求在 Cold Path 入口处**增加** ReflectionGate。当前设计可能每个周期触发 Cold Path——但 PRIME 的按需仲裁机制建议：(a) 持续监控 `PE_layer`（预测误差层级）；(b) 仅当 PE > adaptive_threshold 时触发 Cold Path（阈值由依恋风格/人格特质调制）；(c) 触发深度由 PE_magnitude 决定（小 PE → 浅层 Cold Path，大 PE → 深层 Cold Path）。这使系统效率大幅提升，同时保持了"关键时刻有深度"的设计目标。

---

## 七、综合架构建议

### 7.1 优先级矩阵

| 优先级 | 数量 | 核心改动 | 主要论文依据 |
|--------|------|---------|------------|
| **P0** (立即) | 6 | OpAL 双通道 Go/NoGo 权重；BIS/BAS 交叉抑制；异稳态下游效应；ACT-R 动态衰减替换常数衰减率；倒 U 型情绪-记忆调制；情绪强度门控调节策略选择 | Collins & Frank (2014), Corr (2004), Pavlik & Anderson (2005), McGaugh (2004), Petter et al. (2025) |
| **P1** (下迭代) | 9 | 内源性稳态奖励混合；FFFS/BIS 子系统拆分；叙事重建月频而非每反思；双通道调节架构 + 抑制反弹；RemoteLink + 情感脱钩在 fullSleep；RelationshipState 4D 扩展；ToM 贝叶斯校准层；策略失败检测与自动切换 | Keramati & Gutkin (2014), McNaughton & Corr (2004), McAdams & Pals (2006), Walker & van der Helm (2009), Lewis et al. (2018), Gagliardi (2022), Baker et al. (2017), Bonanno & Burton (2013) |
| **P2** (架构) | 6 | ReflectionGate 按需仲裁；7+12 双层情感架构；精度加权仲裁替代固定优先级；元认知层；BehavioralScripts 技能库机制；内感受 POMDP 完整实现 | PRIME (2025), Panksepp (1998), Friston et al. (2014), Wang et al. (2023), Allen et al. (2022) |
| **文档** | — | 5级记忆标注为工程分层；时间尺度标注为工程隐喻；澄清"情绪发生在角色身上"的具体计算含义 | Atkinson & Shiffrin (1968), Dehaene et al. (2014), Barrett (2017) |

### 7.2 项目哲学验证矩阵

| 项目哲学 | 支持论文 | 反对/挑战论文 | 结论 |
|---------|---------|-------------|------|
| **"涌现优先于构造"** | Heyes (2018) — 共情经验习得; Park et al. (2023) — 社会行为涌现; Barrett (2017) — 情绪构建非触发 | — | **强支持。** 五个域一致指向：系统行为应作为计算交互的涌现结果，而非预定义的规则映射。但需要明确"涌现"在此上下文中意味着"确定性的计算交互产生不可简单预测的输出"，而非"随机"或"魔法" |
| **"情绪发生在角色身上"** | Barrett (2017) — 情绪是构建的脑状态; Seth & Friston (2016) — 内感受精度调制情绪; Allen et al. (2022) — 内感受 POMDP 可产生感情体验 | — | **强支持。** 建议将哲学细化为：情绪 = 内感受信号 × 概念归类 × 情境约束 × 精度加权的计算乘积。每个因子都可计算，每个计算结果都不可完全预测 |
| **"冷热分离"** | ACT-R/PRIME 双过程模型; Kahneman S1/S2; Faghihi & Estey (2015) — 连续谱 SystemIndex | Christoff et al. (2016) — 默认-凸显-控制三元架构提示可能不是两个而是三个层级的交互 | **支持（建议加仲裁Gate）。** 冷热分离是合理的工程近似，但应：(a) 增加 ReflectionGate 按需触发冷路径；(b) 在每层内部实现检索/生成连续调节 |
| **"单饱和度主轴"** | — | Lazarus (1991) — 四种分子评估组合产生不同情绪; Gagliardi (2022) — 依恋四独立维度; Pichiecchio (2026) — 多维精度配置 | **挑战（多维关系状态更符合文献）。** "单饱和度主轴"在经济性上吸引人，但文献一致指向多维交互结构。建议保留多维设计，以精度加权机制处理维度间交互，在保持丰富性的同时管理复杂度 |
| **"5级记忆"** | Atkinson & Shiffrin (1968) — 三级是最少必要 | Baddeley (2000) — 工作记忆 4 组块，非 50 条目 | **部分支持（文档应澄清为工程分层）。** 5 级有工程价值（不同的计算深度和延迟预算），但必须注明这不是对人类记忆层级的 1:1 模型。同时将 Working 容量从 50 改为基于组块的 5-7 |
| **"12D 心境"** | Cowen & Keltner (2017) — 情绪维度可多至 27 维; Bottemanne et al. (2022) — 多维心境作为慢变量贝叶斯层 | Panksepp (1998) — 7 个初级系统是进化基础，12D 中 6 个维度有对应，但 Lust 缺失、部分维度难以映射到可区分的神经计算 | **部分支持（建议两层：7+12）。** 7 个初级情绪系统作为生物底层（快速/本能/皮层下），12 个心境场作为认知-社会建构层（慢变量/皮层依赖）。两层通过精度加权相互调制 |

---

## 八、完整参考文献

### 域 1 — 稳态调节 + TD Error + 异稳态负荷

1. Schultz, W. (2016). Dopamine reward prediction error coding. *Dialogues in Clinical Neuroscience*, 18(1), 23-32.
2. Collins, A. G. E., & Frank, M. J. (2014). Opponent actor learning (OpAL): an interactive actor-critic model of basal ganglia function. *Psychological Review*, 121(3), 337-366.
3. Keramati, M., & Gutkin, B. (2014). Homeostatic reinforcement learning for integrating reward collection and physiological stability. *PLOS Computational Biology*, 10(3), e1003511.
4. Tschantz, A., Barca, L., Maisto, D., Buckley, C., Seth, A., & Pezzulo, G. (2022). Simulating homeostatic, allostatic, and goal-directed forms of interoceptive control. *Biological Psychology*, 169, 108266.
5. Petzschner, F. H., Garin, M., Stephan, K. E., & Tschantz, A. (2021). Homeostatic beliefs and interoceptive inference. *Trends in Neurosciences*, 44(1), 63-76.
6. Seth, A. K., & Friston, K. J. (2016). Active interoceptive inference and the emotional brain. *Trends in Cognitive Sciences*, 371(1708).
7. Friston, K. J., Schwartenbeck, P., FitzGerald, T., Moutoussis, M., Behrens, T., & Dolan, R. J. (2014). The anatomy of choice: dopamine and decision-making. *Phil. Trans. R. Soc. B*, 369(1655), 20130481.
8. Mazzaglia, P., Verbelen, T., Catal, O., & Dhoedt, B. (2022). The free energy principle for perception and action: a deep learning perspective. *Entropy*, 24(2), 301.

### 域 2 — CPM 评估 + PAD 情感空间 + BIS/BAS 动机

9. Lazarus, R. S. (1991). *Emotion and Adaptation.* Oxford University Press.
10. Smith, C. A., & Lazarus, R. S. (1993). Appraisal components, core relational themes, and emotions. *Cognition and Emotion*, 7(3-4), 233-269.
11. Marsella, S. C., & Gratch, J. (2009). EMA: a process model of appraisal dynamics. *Cognitive Systems Research*, 10(1), 70-90.
12. Scherer, K. R. (2001). Appraisal considered as a process of multi-level sequential checking. In K. R. Scherer, A. Schorr, & T. Johnstone (Eds.), *Appraisal Processes in Emotion: Theory, Methods, Research* (pp. 92-120). Oxford University Press.
13. Mehrabian, A. (1996). Pleasure-Arousal-Dominance: a general framework for describing and measuring individual differences in temperament. *Current Psychology*, 14(4), 261-292.
14. Fontaine, J. R. J., Scherer, K. R., Roesch, E. B., & Ellsworth, P. C. (2007). The world of emotions is not two-dimensional. *Psychological Science*, 18(12), 1050-1057.
15. Corr, P. J. (2004). Reinforcement sensitivity theory and personality. *Neuroscience & Biobehavioral Reviews*, 28(3), 317-332.
16. McNaughton, N., & Corr, R. J. (2004). A two-dimensional neuropsychology of defense: fear/anxiety and defensive distance. *Neuroscience & Biobehavioral Reviews*, 28(3), 285-305.
17. Zhang, J., Berridge, K. C., Tindell, A. J., Smith, K. S., & Aldridge, J. W. (2009). A neural computational model of incentive salience. *PLOS Computational Biology*, 5(7), e1000437.
18. Gross, J. J. (2015). Emotion regulation: current status and future prospects. *Psychological Inquiry*, 26(1), 1-26.
19. Bosse, T., Pontier, M., & Treur, J. (2010). A computational model based on Gross' emotion regulation theory. *Cognitive Systems Research*, 11(3), 211-230.
20. Gratch, J., & Marsella, S. (2004). A domain-independent framework for modeling emotion. *Cognitive Systems Research*, 5(4), 269-306.
21. Petter, T., Plaisier, I., Brosschot, J. F., & Verkuil, B. (2025). Emotion regulation strategy choice: a drift-diffusion model approach. *Emotion*, 25(5), 1273-1292.

### 域 3 — 多级记忆系统 + 睡眠巩固 + 激活衰减

22. Atkinson, R. C., & Shiffrin, R. M. (1968). Human memory: a proposed system and its control processes. In K. W. Spence & J. T. Spence (Eds.), *The Psychology of Learning and Motivation* (Vol. 2, pp. 89-195). Academic Press.
23. Baddeley, A. D. (2000). The episodic buffer: a new component of working memory? *Trends in Cognitive Sciences*, 4(11), 417-423.
24. Klinzing, J. G., Niethard, N., & Born, J. (2019). Mechanisms of systems memory consolidation during sleep. *Nature Neuroscience*, 22(10), 1598-1610.
25. Brodt, S., Gais, S., Beck, S., Erb, M., Scheffler, K., & Schonauer, M. (2023). Fast track to the neocortex: a memory engram in the posterior parietal cortex. *Neuron*, 111(7), 1050-1075.
26. Tononi, G., & Cirelli, C. (2014). Sleep and the price of plasticity: from synaptic and cellular homeostasis to memory consolidation and integration. *Neuron*, 81(1), 12-34.
27. Lewis, P. A., Knoblich, G., & Poe, G. (2018). How memory replay in sleep boosts creative problem-solving. *Trends in Cognitive Sciences*, 22(6), 491-503.
28. Walker, M. P., & van der Helm, E. (2009). Overnight therapy? The role of sleep in emotional brain processing. *Psychological Bulletin*, 135(5), 731-748.
29. Pavlik, P. I., & Anderson, J. R. (2005). Practice and forgetting effects on vocabulary memory: an activation-based model of the spacing effect. *Cognitive Science*, 29(4), 559-586.
30. McGaugh, J. L. (2004). The amygdala modulates the consolidation of memories of emotionally arousing experiences. *Annual Review of Neuroscience*, 27, 1-28.
31. Bower, G. H. (1981). Mood and memory. *American Psychologist*, 36(2), 129-148.
32. Conway, M. A., & Pleydell-Pearce, C. W. (2000). The construction of autobiographical memories in the self-memory system. *Psychological Review*, 107(2), 261-288.

### 域 4 — 意识理论 + 情绪动力学 + 调节 + 反刍 + 无聊

33. Dehaene, S., Charles, L., King, J.-R., & Marti, S. (2014). Toward a computational theory of conscious processing. *Current Opinion in Neurobiology*, 25, 76-84.
34. Christoff, K., Irving, Z. C., Fox, K. C. R., Spreng, R. N., & Andrews-Hanna, J. R. (2016). Mind-wandering as spontaneous thought: a dynamic framework. *Nature Reviews Neuroscience*, 17(11), 718-731.
35. Mildner, J. N., & Tamir, D. I. (2019). Spontaneous thought as an unguided memory retrieval process. *Trends in Cognitive Sciences*, 23(9), 743-753.
36. Panksepp, J. (1998). *Affective Neuroscience: The Foundations of Human and Animal Emotions.* Oxford University Press.
37. Bottemanne, H., Morlaas, O., Fossati, P., & Schmidt, L. (2022). A multidimensional approach to mood: from theory to clinical applications. *L'Encephale*, 48(6), 682-699.
38. Barrett, L. F. (2017). The theory of constructed emotion: an active inference account of interoception and categorization. *Social Cognitive and Affective Neuroscience*, 12(1), 1-23.
39. Allen, M., Levy, A., Parr, T., & Friston, K. J. (2022). In the body's eye: the computational anatomy of interoceptive inference. *PLOS Computational Biology*, 18(9), e1010490.
40. Gundem, D., Zhang, J., & Barrett, L. F. (2022). Comparing the constructed emotion theory to basic emotion theory using fMRI activation patterns. *Communications Biology*, 5(1), 1354.
41. Bonanno, G. A., & Burton, C. L. (2013). Regulatory flexibility: an individual differences perspective on coping and emotion regulation. *Perspectives on Psychological Science*, 8(6), 591-612.
42. Wang, D., Hagger, M. S., & Chatzisarantis, N. L. D. (2020). Ironic effects of thought suppression: a meta-analysis. *Perspectives on Psychological Science*, 15(3), 778-793.
43. Treynor, W., Gonzalez, R., & Nolen-Hoeksema, S. (2003). Rumination reconsidered: a psychometric analysis. *Cognitive Therapy and Research*, 27(3), 247-259.
44. Danckert, J., Hammerschmidt, T., Marty-Dugas, J., & Smilek, D. (2025). Boredom: a reward-prediction error account. *Communications Psychology*, 3, 16.
45. Westgate, E. C., & Wilson, T. D. (2018). Boring thoughts and bored minds: the MAC model of boredom and cognitive engagement. *Psychological Review*, 125(5), 689-713.

### 域 5 — 社会认知 + 自我模型 + LLM Agent 架构

46. Baker, C. L., Jara-Ettinger, J., Saxe, R., & Tenenbaum, J. B. (2017). Rational quantitative attribution of beliefs, desires, and percepts in human mentalizing. *Nature Human Behaviour*, 1, 0064.
47. Kosinski, M. (2024). Evaluating large language models in theory of mind tasks. *PNAS*, 121(44), e2405460121.
48. Strachan, J. W. A., Albergo, D., Borghini, G., Pansardi, O., Scaliti, E., Gupta, S., Saxena, K., Rufo, A., Panzeri, S., Manzi, G., Graziano, M. S. A., & Becchio, C. (2024). Testing theory of mind in large language models and humans. *Nature Human Behaviour*, 8, 1285-1295.
49. Gallese, V., Keysers, C., & Rizzolatti, G. (2004). A unifying view of the basis of social cognition. *Trends in Cognitive Sciences*, 8(9), 396-403.
50. Heyes, C. (2018). Empathy is not in our genes. *Neuroscience & Biobehavioral Reviews*, 95, 499-507.
51. Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: interactive simulacra of human behavior. In *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology* (UIST '23). Best Paper Award.
52. Wang, G., Xie, Y., Jiang, Y., Mandlekar, A., Xiao, C., Zhu, Y., Fan, L., & Anandkumar, A. (2023). Voyager: an open-ended embodied agent with large language models. *NeurIPS 2023.*
53. McAdams, D. P., & Pals, J. L. (2006). A new Big Five: fundamental principles for an integrative science of personality. *American Psychologist*, 61(3), 204-217.
54. Hirsh, J. B., Mar, R. A., & Peterson, J. B. (2013). Psychological entropy: a framework for understanding uncertainty-related anxiety. *Behavioral and Brain Sciences*, 36(3).
55. Gagliardi, M. (2022). Attachment as a multidimensional control system. *Frontiers in Psychology*, 13, 844012.
56. Pichiecchio, A., Sanguineti, V., & Becchio, C. (2026). Attachment as active inference: a computational model. *Frontiers in Psychology*.
57. Faghihi, U., & Estey, C. (2015). A dual-process model of Kahneman's thinking, fast and slow, implemented in ACT-R. *Biologically Inspired Cognitive Architectures*, 14, 33-48.
58. PRIME (2025). Planning and Retrieval-Integrated Memory Engine: on-demand arbitration for deep reasoning. arXiv:2509.22315.

---

## 附录：关键公式速查

### 域 1 — 稳态与强化学习

```
# TD Error (Schultz 2016)
δ_t = r_t + γ × V(s_{t+1}) - V(s_t)

# OpAL 双通道 Actor-Critic (Collins & Frank 2014)
Go[a]   += α_G × Go[a]   × max(0, δ)
NoGo[a] += α_N × NoGo[a] × max(0, -δ)
V[a]     = β_G × Go[a] - β_N × NoGo[a]

# 内源性稳态奖励 (Keramati & Gutkin 2014)
r_total = r_external + w_homeostatic × max(0, D(H_before) - D(H_after))

# 稳态信念精度调制 (Petzschner et al. 2021)
regulatory_response(t) = π × (h(t) - μ)

# 精度加权预测误差 (Friston et al. 2014)
δ_dopamine = precision_weighted_PE  // not raw scalar TD error
P(a) = softmax(β × V(a))   // β is precision parameter
```

### 域 2 — 评估与动机

```
# PADN 四维情感空间 (Fontaine et al. 2007)
PADN = [Pleasure, Arousal, Dominance, Novelty]

# BIS/BAS 交叉抑制 (Corr 2004)
effective_BAS = raw_BAS × (1 - w_inhib × BIS_level)

# 激励显著性 (Zhang et al. 2009)
Wanting = k(state) × V(s)
// k = f(physiological_state), Wanting ≠ Liking (PAD.pleasure)

# 情绪响应动态 (Bosse et al. 2010)
ERL(t+1) = ERL(t) + γ × (event_impact - Σα_i × regulation_i) - β × ERL(t)

# 情绪强度门控策略选择 (Petter et al. 2025)
// High intensity → favor distraction (fast/shallow)
// Low intensity  → favor reappraisal (slow/deep)
```

### 域 3 — 记忆与巩固

```
# ACT-R 动态衰减率 (Pavlik & Anderson 2005)
d(t) = c × exp(m(t)) + a
m(t) = ln(Σ t_j^{-d_decay})

# NREM×REM 乘法巩固增益 (Brodt et al. 2023)
consolidation_gain = NREM_factor × REM_factor

# 倒 U 型情绪-记忆调制 (McGaugh 2004)
emotion_memory_factor = intensity × exp(-intensity / optimal)

# 情感脱钩 (Walker & van der Helm 2009)
emotional_tag = emotional_tag × (1 - decay_rate_per_REM_cycle)
// decay_rate_per_REM_cycle ~ 0.05-0.10
```

### 域 4 — 意识与情绪

```
# 思想激活 (Mildner & Tamir 2019)
a(t, i) = f(similarity(i, c(t)), relevance(i, state))
c(t+1) = c(t) + drift_vector

# 心境慢变量更新 (Bottemanne et al. 2022)
mood(t) = α × mood(t-1) + (1-α) × emotion(t)
// α ~ 0.95

# 抑制反弹 (Wang et al. 2020)
rebound_intensity = suppressed_intensity × 1.5
// rebound ∝ suppression_duration × suppression_effort

# 无聊稳态 (Danckert et al. 2025)
boredom = max(0, c* - c(t))
// c* = optimal cognitive engagement setpoint

# MAC 参与度瓶颈 (Westgate & Wilson 2018)
engagement = min(attention, meaning)
```

### 域 5 — 社会认知与架构

```
# 贝叶斯心理理论 (Baker et al. 2017)
P(mental_states | actions, context) ∝ P(actions | mental_states) × P(mental_states | context)

# ACT-R 双过程系统指数 (Faghihi & Estey 2015)
SystemIndex = (α × n_retrievals) / (α × n_retrievals + β × n_productions)

# PRIME 按需仲裁 (PRIME 2025)
if PE > adaptive_threshold(attachment_style):
    trigger Cold Path at depth ∝ PE_magnitude

# 依恋精度配置 (Pichiecchio et al. 2026)
# Secure:     high π_belief + high π_sensory
# Avoidant:   high π_belief("others unresponsive") + low π_sensory
# Ambivalent: low π_belief + high π_sensory

# 叙事预测误差 (Hirsh et al. 2013)
NarrativeCoherence = 1 - normalized(PE_narrative)
// identity rupture triggered when PE_narrative > rupture_threshold

# 叙事更新频率 (McAdams & Pals 2006)
# Event recording:  every meaningful interaction (Layer 2)
# Narrative reconstruction: every ~30 days OR identity rupture (Layer 3)
```
