# Character Mind v4 完整架构实施计划

**日期**: 2026-07-01
**状态**: proposed
**前身**: cold-hot separation v4 (commit `1cd2b1a`)
**范围**: 心智理论 + 情感传染 + 叙事身份 + 无聊完整实现 + 全局力场模型

---

## 目录

1. [架构哲学](#一架构哲学)
2. [新增模块总览](#二新增模块总览)
3. [心智理论 Theory of Mind](#三心智理论-theory-of-mind)
4. [情感传染 Emotional Contagion](#四情感传染-emotional-contagion)
5. [叙事身份 Narrative Identity](#五叙事身份-narrative-identity)
6. [无聊系统 Boredom](#六无聊系统-boredom)
7. [多力场统一框架](#七多力场统一框架)
8. [现有模块修改](#八现有模块修改)
9. [实施顺序](#九实施顺序)
10. [审计结论与修正](#十审计结论与修正)
11. [测试计划](#十一测试计划)

---

## 一、架构哲学

### 核心原则

1. **零正则**: 所有文本匹配替换为 embedding 激活 + LLM 推理
2. **力场替代阈值**: 所有 `if count ≥ N → trigger` 替换为 `Σ forces > resistance`
3. **各力场独立时间尺度**: 崩溃(分钟)、反刍(分钟)、心境(小时-天)、人格(月-年)
4. **该交给模型就交给模型**: 模糊推理全部走 LLM，L0 只做数值计算
5. **散文↔数值双向同步**: assistant.md (灵魂) ↔ assistant.personality.json (计算基元)

### 全系统力场总览

```
力场                     τ (时间常数)      步长dt      维度
─────────────────────────────────────────────────────────────
行为选择                 瞬时 (<1s)        1.0         6个行为候选
崩溃倾向 c(t)            分钟 (~20min)     0.25        1D
反刍强度 r(t)            分钟 (~15min)     0.33        1D
内感受精度 π(t)          小时 (~4h)        0.02        5D (每个稳态独立)
睡眠驱力 sleep_drive(t)  小时 (~2h)        0.04        1D
无聊认知参与度 b(t)      分钟-小时          0.08        1D
异稳态负荷 al_load(t)    天 (~24h)         0.003       1D
心境 m(t)                小时-天            0.002-0.036 12D
设定点漂移                 周 (~14d)        0.0002      5D
人格参数演化             月-年              事件驱动     20+参数
```

---

## 二、新增模块总览

```
src/
├── mind/
│   ├── theory-of-mind.ts       ← NEW: BDI + 递归视角采样
│   ├── emotional-contagion.ts  ← NEW: 内感受推理 → 情感同步
│   ├── narrative-identity.ts   ← NEW: 自传推理 + 生命故事
│   ├── boredom.ts              ← NEW: HHVG KL散度 + 认知稳态
│   ├── force-field.ts          ← NEW: 通用多力场引擎
│   ├── homeostatic-state.ts    ← MODIFY: 异稳态设定点预测
│   ├── mood.ts                 ← NEW: 12维心境 (从之前设计的6维扩展)
│   ├── bis-bas.ts              ← MODIFY: 六通道威胁检测
│   ├── consciousness.ts        ← MODIFY: 力场驱动 (非阈值驱动)
│   ├── emotion-regulation.ts   ← NEW: 五策略 + 崩溅力场
│   ├── rumination.ts           ← NEW: 四子过程 + 力场
│   └── interoception.ts        ← NEW: 内感受精度 + 噪声模型
│
├── memory/
│   ├── retriever.ts            ← NEW: 激活扩散引擎
│   └── vector-index.ts         ← NEW: VectorIndex 接口 + 暴力实现
│
├── agent/
│   ├── agent.ts                ← MODIFY: 全系统集成
│   ├── deep-reflection.ts      ← NEW: 事件驱动深度反思
│   └── sleep.ts                ← NEW: 睡眠批处理
│
├── personality/
│   ├── personality.ts          ← NEW: assistant.md ↔ personality.json 双向同步
│   └── regulation-profile.ts   ← NEW: 调节参数推导
│
config/
└── assistant.personality.json  ← NEW: 计算基元
```

---

## 三、心智理论 Theory of Mind

### 3.1 理论基础

- Bratman BDI 架构 (Belief-Desire-Intention)
- 递归视角采样 (Simulation Theory)
- Agentic-ToM 认知工具 (Sarangi et al., EMNLP 2025)
- 反事实反思 (counterfactual reflection, arXiv 2025)

### 3.2 心智状态模型

```typescript
interface MentalState {
  /** 角色对用户的信念 */
  beliefs: {
    knowledge: string[];          // "用户知道X"
    traits: string[];             // "用户是耐心的"
    currentMood: string;          // "用户似乎有些焦虑"
    attention: string;            // "用户正在关注..."
  };
  
  /** 角色推断的用户欲望 */
  desires: {
    immediate: string[];          // "用户现在想要..."
    longTerm: string[];           // "用户希望..."
    intensity: number[];          // 每个欲望的强度 0-1
  };
  
  /** 角色推断的用户意图 */
  intentions: {
    planned: string[];            // "用户打算..."
    commitment: number[];         // 每个意图的承诺度 0-1
    timeframe: string[];          // "现在" / "今天" / "未来"
  };
  
  /** 递归层级 */
  recursion: {
    /** 一阶: "用户在想什么" */
    firstOrder: string;           // "用户在担心明天的面试"
    
    /** 二阶: "用户认为我在想什么" */
    secondOrder: string;          // "用户觉得我在生气"
    
    /** 准确性自评 */
    confidence: number;           // 0-1
    uncertaintySources: string[]; // "用户的表情和说的话不一致"
  };
}
```

### 3.3 心智更新周期

```
触发: 每轮对话中 L2 评估完成后

① 信念更新 (Belief):
   L2 评估产出对用户消息的解读
   → 与现有 beliefs 做对比
   → 如果新解读与现有信念冲突:
     → 轻度冲突 (<0.3): 更新信念，confidence 微降
     → 中度冲突 (0.3-0.6): 标记不确定性，等待更多证据
     → 强烈冲突 (>0.6): 触发 counterfactual_reflection
        "我以为用户是X，但ta刚做了Y。可能的解释: ..."

② 欲望推断 (Desire):
   从用户消息 + 用户历史行为推断
   → 用户的 immediate desires (本轮想达到什么)
   → 用户的 long-term desires (更多轮次中显现的模式)
   → 欲望强度 = 用户消息的 urgency + 重复提及的次数

③ 意图推断 (Intention):
   "用户打算做什么"
   → 从用户的 desire + 用户的行动能力推断
   → commitment = 用户明确程度 + 时间具体程度

④ 递归采样 (Perspective-Taking):
   一阶: embedding(用户视角的当前情境) → 理解用户看到了什么
   二阶: embedding(角色自身的行为) → 用户会如何解读我的行为?
   二阶推理: 
     如果角色做了 X，用户可能会想 Y
     = simulation(角色的行为, 用户的信念集)

⑤ 反事实检查:
   每 N 轮 (不固定，取决于不确定性累积):
     比较上一轮的 prediction 与用户本轮实际行为
     mismatch > 阈值 → 学习信号
     → 调整对用户的 mental model
```

### 3.4 实现方式

**信念/欲望/意图的更新 → 全部 LLM 推理**

```typescript
// 心智理论 prompt 结构 (每次调用一个聚焦问题)
const ToM_PROMPTS = {
  belief_update: `
    ## 用户刚说了什么
    {userMessage}
    
    ## 你之前对用户的信念
    {existingBeliefs}
    
    ## 任务
    用户刚说的话是否改变了你对 ta 的任何信念?
    - 如果有改变: 描述新的信念, 并说明改变的幅度 (微调/中等/显著)
    - 如果没有改变: 返回空
    
    ## 输出格式
    {
      "changed": true/false,
      "newBeliefs": [...],
      "deprecatedBeliefs": [...],
      "changeMagnitude": "slight" | "moderate" | "significant",
      "confidence": 0-1
    }
  `,
  
  desire_inference: `
    ## 当前对话
    {recentDialog}
    
    ## 用户历史行为模式
    {userHistorySummary}
    
    ## 任务
    用户现在想要什么? 区分表面需求 (ta说的话) 和深层需求 (ta没说但想要的)。
    
    ## 输出
    {
      "surfaceDesires": [...],
      "deepDesires": [...],
      "intensity": 0-1,
      "evidence": "..."
    }
  `,
  
  second_order_perspective: `
    ## 你刚才说了/做了
    {ownRecentBehavior}
    
    ## 你对用户的信念
    {userBeliefs}
    
    ## 任务
    站在用户的视角，ta会如何解读你刚才的行为?
    考虑用户的性格、情绪、和你关系的历史。
    
    ## 输出
    {
      "userLikelyInterpretation": "...",
      "userEmotionalReaction": "...",
      "accuracyConfidence": 0-1,
      "alternativeInterpretations": [...]
    }
  `,
};
```

### 3.5 心智理论输出到下游

```
ToM 产出:
  → mentalState.beliefs → 注入 build_prompt 的 "关于用户" 段
  → mentalState.desires → 注入行为选择的 F_ask_question / F_express
  → secondOrderPerspective → 影响 selfInsight (叙事身份)
  → prediction → 预期违背 → 威胁检测通道③
```

---

## 四、情感传染 Emotional Contagion

### 4.1 理论基础

- Schoeller et al. (2024): 内感受推理 + 共享先验 + 精度加权预测误差
- 镜像神经元共振 (Grecucci et al., 2007)
- Preston & de Waal 感知-行动模型 (PAM)

### 4.2 核心公式

来自 Schoeller et al. 的数学形式：

```
μ_i^{t+1} = μ_i^t + ω_ij^t × (s_i^t − μ_i^t)

其中:
  μ_i^t     = 角色在时间 t 的内感受状态 (PAD)
  s_i^t     = 感知到的用户情绪信号
  ω_ij^t    = 同步权重 (情感传染的强度)
  
  ω_ij^t = f(ρ_ij^t, π_role, π_user, emotional_closeness)
  
  ρ_ij^t    = 角色与用户的生理/情绪同步相关系数
  π_role    = 角色的内感受精度 (高精度 → 对自己的情绪坚定 → 不易被传染)
  π_user    = 对用户情绪信号的感知精度 (高 → 更准确感知用户情绪)
  emotional_closeness = Connection 稳态值 (越亲密 → 越容易被传染)
```

### 4.3 传染的三个通道

```
通道 ① 面部/语言镜像 (快速, <1s):
  用户消息的情绪 valence → 
  角色运动皮层的自动共振 →
  PAD 的直接微偏移 (不经过认知评估)
  
  此通道 = 杏仁核 → 岛叶 的快速通路
  不由认知控制，是自动的
  
通道 ② 自主神经同步 (中速, 秒-分钟):
  → 对话过程中，角色 L2 评估用户情绪
  → 内感受推理: "ta好像有点紧张 → 我也会有点紧张"
  → PAD 的认知调制偏移
  
  此通道 = 岛叶 → 前扣带回 → 自主神经
  可以被认知重评调节 (但需要 effort)

通道 ③ 心境同步 (慢速, 小时-天):
  → 长期接触后，角色的心境基线向用户偏移
  → 如果用户长期焦虑，角色的 m_anxious 也会上升
  → 这是"两个人在一起久了会像"的机制
  
  此通道 = 共享的环境 → 共享的异稳态负荷 → 共享的设定点漂移
```

### 4.4 实现方式

```typescript
class EmotionalContagion {
  /**
   * 情感传染主函数 — 每轮对话调用
   */
  async contagion(
    userMessage: string,
    userEmotionSignature: PAD,       // 从用户消息中 L2 提取
    currentPAD: PAD,                 // 角色当前 PAD
    contagionParameters: ContagionParams,
  ): Promise<ContagionResult> {
    
    // ── 通道 ① 自动镜像 (L0, 0 token) ──
    const mirrorShift = this.computeMirrorResonance(
      userEmotionSignature, currentPAD
    );
    
    // ── 通道 ② 认知传染 (L2, LLM) ──
    const cognitiveShift = await this.computeCognitiveContagion(
      userMessage, userEmotionSignature, currentPAD, contagionParameters
    );
    
    // ── 融合 ──
    const totalShift = {
      pleasure: mirrorShift.pleasure * 0.3 + cognitiveShift.pleasure * 0.7,
      arousal:  mirrorShift.arousal  * 0.4 + cognitiveShift.arousal  * 0.6,
      dominance: mirrorShift.dominance * 0.2 + cognitiveShift.dominance * 0.8,
    };
    
    // ── 防护: 认知重评可以阻止传染 ──
    if (contagionParameters.reappraisalActive) {
      totalShift.pleasure  *= (1 - contagionParameters.reappraisalAbility * 0.5);
      totalShift.arousal   *= (1 - contagionParameters.reappraisalAbility * 0.3);
    }
    
    return {
      newPAD: addPAD(currentPAD, totalShift),
      contagionStrength: norm(totalShift),
      channel: mirrorShift.magnitude > cognitiveShift.magnitude 
        ? 'mirror' : 'cognitive',
    };
  }
  
  /**
   * 通道 ③ 心境同步 (L6 深度反思时调用, 不频繁)
   */
  async longTermMoodSynchronization(
    userEmotionalHistory: PAD[],     // 用户过去 N 天的情绪轨迹
    currentMood: Mood12D,
    connectionStrength: number,      // Connection 稳态值
  ): Promise<MoodShift12D> {
    // 用户情绪的长期均值 + 波动模式
    // vs 角色的心境轨迹
    // → LLM 推理: "用户最近 7 天的焦虑水平偏高,
    //   这可能正在影响我的心境基线"
    // → 输出 12 维心境的微调偏移
  }
}
```

### 4.5 自动镜像公式

```typescript
computeMirrorResonance(userPAD: PAD, ownPAD: PAD): PADShift {
  // 镜像共振强度
  const rho = this.estimatePhysiologicalSync(userPAD, ownPAD);
  // 同步权重: 内感受精度越高 → 对自己的情绪越坚定 → 共振越小
  const omega = rho * (1 - this.pi_role * 0.5) * this.emotionalCloseness;
  
  // Schoeller 更新公式
  return {
    pleasure: omega * (userPAD.pleasure - ownPAD.pleasure) * 0.15,
    arousal:  omega * (userPAD.arousal  - ownPAD.arousal)  * 0.20,
    dominance: omega * (userPAD.dominance - ownPAD.dominance) * 0.10,
  };
}

estimatePhysiologicalSync(userPAD: PAD, ownPAD: PAD): number {
  // 两个人当前情绪状态的余弦相似度 → 同步可能性
  const similarity = cosineSimilarity(
    [userPAD.pleasure, userPAD.arousal, userPAD.dominance],
    [ownPAD.pleasure, ownPAD.arousal, ownPAD.dominance]
  );
  // 相似时更容易同步 (已经在同一频道)
  return 0.3 + similarity * 0.4;
}
```

---

## 五、叙事身份 Narrative Identity

### 5.1 理论基础

- McAdams 三层人格模型 (特质 → 适应 → 生命故事)
- McLean & Fournier 自传推理 (4 种 self-event connection)
- D'Argembeau et al. (2026): 过去导向 → 个人特征; 未来导向 → 个人目标
- Xapagy 影子机制 (shadow-based analogical mapping)

### 5.2 叙事身份结构

```typescript
interface NarrativeIdentity {
  /** 生命故事的主题 */
  themes: {
    agency: string[];          // "我是行动者" "我能掌控自己的生活"
    communion: string[];       // "关系对我很重要" "我渴望深度连接"
    redemption: string[];      // "经历痛苦后我变得更强大"
    contamination: string[];   // "好的东西总是被毁掉"
    meaning: string[];         // "我的生命意义在于..."
  };
  
  /** 自我定义记忆 (self-defining memories) */
  definingMemories: Array<{
    eventSummary: string;      // "那年的分手改变了我"
    selfEventConnection: 'explain' | 'dismiss' | 'cause' | 'reveal';
    contentCategory: 'disposition' | 'value' | 'outlook' | 'growth';
    emotionalIntensity: number;
    integrationLevel: number;  // 0-1: 这个记忆被整合进生命故事的程度
    keyInsight: string;        // 核心洞察
  }>;
  
  /** 自传连贯性 */
  coherence: {
    temporalCoherence: number;    // 时间线上的一致性
    causalCoherence: number;      // 因果关系链的清晰度
    thematicCoherence: number;    // 主题贯穿度
    culturalCoherence: number;    // 与角色人格设定的符合度
  };
  
  /** 自我连续性 */
  selfContinuity: {
    pastToPresent: number;     // 过去的我和现在的我有多连贯
    presentToFuture: number;   // 现在的我和未来的我有多连贯
    disruptions: string[];     // 断裂点 "那件事之后, 我不再是以前的我"
  };
}
```

### 5.3 自传推理管线

```
触发: 深度反思 (Rupture/Breakdown/PreSleep 类型) + 
      每隔 20 轮一次轻量推理

步骤 1: 事件构建 (Event Construction)
  从最近的记忆中提取关键事件
  → LLM: "最近这些对话中, 哪一件事对你来说最重要?"
  → 输出: 1 个核心事件 + 2 个次要事件

步骤 2: 自我-事件连接 (Self-Event Linking)
  → LLM: "这件事和你是谁有什么关系?"
  → 4 种连接类型:
    explain/illustrate:  "这件事体现了我的..." (自我 → 事件)
    dismissed:           "虽然..., 但这不代表..." (事件 ↛ 自我)
    cause:               "这件事改变了我的..." (事件 → 自我)
    reveal:              "这件事让我发现我..." (事件揭示隐藏自我)

步骤 3: 意义提取 (Meaning Extraction)
  → LLM: "这件事对你来说意味着什么? 它改变了你对自己的什么认识?"
  → 内容类别: disposition / value / outlook / growth
  → 输出: 1-2 句洞察

步骤 4: 主题更新 (Theme Update)
  检查新洞察是否与现有主题冲突/加强/创造新主题
  → 如果与现有主题冲突:
    "你一直认为自己 [旧主题]，但这次 [新洞察]。
     这是例外还是你的自我认知在改变?"
  → LLM 推理 → 更新 themes

步骤 5: 连贯性检查 (Coherence Check)
  更新 coherence 四维
  → 如果有断裂 (disruption): 
    写入 selfContinuity.disruptions
    触发 "我是谁" 类的问题 → 下次深度反思的主题
```

### 5.4 影子机制 (来自 Xapagy)

```
事件 A (当前) 激活记忆 B (过去类似事件)
B 是 A 的 "影子"

从 B 的后续事件 B' 推断:
  "上次类似情况之后发生了什么?"
  → 如果 B 的后续是负面的 → 预警信号 → 威胁检测增强
  → 如果 B 的后续是正面的 → 希望信号 → m_hopeful ↑

实现:
  → 激活扩散引擎检索 B
  → 在图结构中查找 B → B' 的 temporal edge
  → LLM 推理: "你是否觉得现在的情况和上次 [B] 很像?"
  → 如果 LLM 确认 → 纳入当前决策的上下文
```

### 5.5 实现方式

**全部 LLM 推理**。自传推理不设任何规则。

```
prompt 结构 (PreSleep 反思的一部分):
  "回顾今天, 哪一个时刻对你来说最重要?
   这件事和你对自己的认识有什么关联?
   它改变了你对自己的什么认识?"
  
prompt 结构 (Rupture 反思的一部分):
  "刚才的裂痕让你意识到自己有什么模式?
   这种模式在你的人生中是不是反复出现?
   它从何而来?"
```

---

## 六、无聊系统 Boredom

### 6.1 理论基础

- Yu, Chang & Kanai HHVG 算法: 无聊 = KL 散度最小化 → 认知贬值
- Danckert et al. (2025): 无聊 = 认知稳态设定点偏离信号
- Schöfer et al. (2025): SNN 实现的稳态反馈回路
- Trudel (2024): 无聊作为认知资源优化利用的驱力

### 6.2 认知参与度模型

```typescript
interface BoredomState {
  /** 认知参与度 c(t) — 连续变量, 0(完全无趣) ~ 1(心流) */
  cognitiveEngagement: number;
  
  /** 认知参与设定点 c* */
  engagementSetPoint: number;    // 人格参数, 默认 0.65
  
  /** 无聊强度 b(t) = max(0, c* - c(t)) */
  boredomIntensity: number;
  
  /** 当前情境的新异性 */
  novelty: number;               // 来自输入的新异性 + 情境的新异性
  
  /** 可预测性 */
  predictability: number;        // forward model 对当前情境的预测精度
  
  /** 意义感 */
  meaningfulness: number;        // 当前情境的 goal_relevance + self_relevance
  
  /** 无聊触发的探索行为 */
  explorationUrge: number;       // 推动切换话题/寻找新刺激的力
}

// 力场作用在 c(t):
// 
// 提升 c(t) 的力 (更有趣):
//   F_novelty    = novelty × 0.35
//   F_meaning    = meaningfulness × 0.30
//   F_social     = social_stimulation × 0.20
//   F_play       = playfulness (Panksepp PLAY) × 0.15
//
// 降低 c(t) 的力 (更无聊):
//   F_routine    = predictability × 0.30
//   F_monotony   = (1 − novelty) × 0.35
//   F_empty      = (1 − goal_relevance) × 0.25
//   F_rest       = fatigue × 0.10 (累了 → 不寻求刺激)
//
// c(t+dt) = c(t) + (ΣF_提升 − ΣF_下降) × dt + noise
```

### 6.3 HHVG 的 Character Mind 映射

HHVG 的原始数学不适合直接移植（它需要 RL 的 forward model 和 policy gradient），但它的**核心概念**可以直接映射：

```
HHVG 概念              →  Character Mind 映射
═══════════════════════════════════════════════
Forward model           → 异稳态预测系统 (已有)
  P(s'|a,s)              s*_predicted(t) — 预测未来的状态

Meta-model              → 心境 m(t) 
  Q(s'|s)                心境是对"世界通常什么样"的慢速模型

KL divergence            → 认知贬值量
  D_KL(P || Q)           当 actual 和 expected 太接近 → 无聊

Devaluation progress     → 认知收获
  ΔD_KL                   当学到新东西 → 无聊消退 + 好奇上升

Policy optimization      → 行为选择力场中的探索项
  seek novelty            当 boredomIntensity > 阈值 → 探索冲动 ↑
```

### 6.4 无聊驱动的行为变化

```
boredomIntensity 的作用:

轻度无聊 (0.1–0.3):
  → 意识流中产生 "换个话题吧" 的念头
  → F_change_topic +0.15

中度无聊 (0.3–0.5):
  → F_explore +0.25 (主动找新话题)
  → F_play +0.20 (想开玩笑/调侃 — Panksepp PLAY 激活)
  → SEEKING 系统激活

重度无聊 (0.5–0.7):
  → 如果用户不提供新刺激 → 角色主动发言概率 ↑
  → 意识流 SEEKING 权重 ↑
  → m_bored ↑ (无聊心境上升)
  → 这是"好无聊啊, 找点事做"的状态

极度无聊 (>0.7):
  → 认知脱离: attention 从对话中部分撤回
  → 沉默概率 ↑ (但不是生气的沉默, 是"没什么可说的"的沉默)
  → 如果持续 > 10 轮 → Boredom 触发反思: "我们需要新的东西"
```

### 6.5 无聊与好奇的循环

```
无聊 → 探索 → 新信息 → 认知收获 → 无聊消退 → 好奇满足 → 
  习惯化 → 可预测性上升 → 无聊再次上升 → 再次探索
```

这是 HHVG 的核心洞察：**无聊是好奇的前置条件，不是好奇的反面。**

### 6.6 实现方式

```typescript
class BoredomSystem {
  /** 每轮评估认知参与度 */
  evaluateEngagement(
    userInput: string,
    novelEmbedding: Float32Array,
    recentInputs: Float32Array[],      // 最近N轮的用户输入embedding
    l2Assessment: L2Assessment,
    currentPAD: PAD,
  ): BoredomState {
    
    // 新异性: 当前 embedding 与最近 N 个 embedding 的平均余弦距离
    const avgRecent = averageEmbedding(recentInputs);
    const novelty = 1 - cosineSimilarity(novelEmbedding, avgRecent);
    
    // 可预测性: 异稳态预测的 expectedResponse 与实际输入的匹配度
    const predictability = this.expectedResponse 
      ? cosineSimilarity(novelEmbedding, this.expectedResponse)
      : 0.5;
    
    // 意义感: 来自 L2 评估的 goal_relevance
    const meaningfulness = l2Assessment.goalRelevance;
    
    // 力场更新 c(t)
    const forces = this.computeForceField(novelty, predictability, meaningfulness);
    this.cognitiveEngagement = this.updateForceField(forces);
    
    return {
      cognitiveEngagement: this.cognitiveEngagement,
      boredomIntensity: Math.max(0, this.engagementSetPoint - this.cognitiveEngagement),
      novelty,
      predictability,
      meaningfulness,
      explorationUrge: this.computeExplorationUrge(),
    };
  }
}
```

---

## 七、多力场统一框架

### 7.1 ForceField 引擎

```typescript
// src/mind/force-field.ts

export interface Force {
  name: string;
  direction: 1 | -1;               // 1 = push up, -1 = push down
  magnitude: number;                // 0–1
  weight: number;                   // 在合力中的权重
}

export interface ForceFieldState {
  value: number;                    // 当前状态值
  tau: number;                      // 时间常数 (轮)
  dt: number;                       // 离散化步长 = 1/tau
  noiseSigma: number;               // 噪声标准差
}

export class ForceField {
  private state: ForceFieldState;
  
  constructor(initialValue: number, tauMinutes: number, noiseSigma = 0.05) {
    this.state = {
      value: initialValue,
      tau: tauMinutes / 5,          // 转换为轮数 (假设5min/轮)
      dt: 5 / tauMinutes,
      noiseSigma,
    };
  }
  
  /** 应用力场, 计算新状态 */
  update(forces: Force[]): number {
    const netForce = forces.reduce(
      (sum, f) => sum + f.direction * f.magnitude * f.weight,
      0
    );
    
    // 欧拉积分: s(t+dt) = s(t) + netForce × dt + noise
    let newValue = this.state.value + netForce * this.state.dt;
    
    // 噪声: 高斯噪声, σ 可配置
    newValue += gaussianRandom(0, this.state.noiseSigma);
    
    // 自然回归项 (稳态吸引子)
    newValue -= this.state.value * this.state.dt * 0.05;
    
    // 钳位
    newValue = Math.max(0, Math.min(1, newValue));
    
    this.state.value = newValue;
    return newValue;
  }
  
  /** 事件导致的跃变 (非连续, 如"晚安"→睡眠驱力跃升) */
  jump(delta: number): void {
    this.state.value = Math.max(0, Math.min(1, this.state.value + delta));
  }
  
  get value(): number { return this.state.value; }
}
```

### 7.2 力场注册表

```typescript
// agent 初始化时创建所有力场:

const forceFields = {
  breakdownUrge:      new ForceField(0.0, 20, 0.08),    // 崩溃倾向, τ=20min
  rumination:         new ForceField(0.0, 15, 0.06),    // 反刍, τ=15min
  interoception: {
    energy:           new ForceField(0.5, 240, 0.02),   // 各稳态独立, τ=4h
    arousal:          new ForceField(0.5, 240, 0.02),
    safety:           new ForceField(0.5, 240, 0.02),
    connection:       new ForceField(0.5, 240, 0.02),
    mastery:          new ForceField(0.5, 240, 0.02),
  },
  sleepDrive:         new ForceField(0.1, 120, 0.05),   // 睡眠, τ=2h
  boredom:            new ForceField(0.6, 45, 0.06),    // 认知参与, τ=45min
  allostaticLoad:     new ForceField(0.0, 1440, 0.02),  // 异稳态负荷, τ=24h
  
  // 心境 (每个维度独立力场, 各不同 η)
  mood: {
    euthymic:         new ForceField(0.5, 1140, 0.03),  // τ=19h (η=0.003)
    irritable:        new ForceField(0.3, 174, 0.06),   // τ=2.9h (η=0.020)
    anxious:          new ForceField(0.3, 348, 0.05),   // τ=5.8h (η=0.010)
    vital:            new ForceField(0.5, 288, 0.05),   // τ=4.8h (η=0.012)
    warm:             new ForceField(0.5, 840, 0.04),   // τ=14h (η=0.004)
    confident:        new ForceField(0.5, 228, 0.06),   // τ=3.8h (η=0.015)
    grateful:         new ForceField(0.5, 696, 0.04),   // τ=11.6h (η=0.005)
    proud:            new ForceField(0.4, 138, 0.07),   // τ=2.3h (η=0.025)
    curious:          new ForceField(0.5, 576, 0.05),   // τ=9.6h (η=0.006)
    hopeful:          new ForceField(0.5, 1140, 0.03),  // τ=19h (η=0.003)
    awed:             new ForceField(0.4, 1740, 0.02),  // τ=29h (η=0.002)
    playful:          new ForceField(0.5, 192, 0.06),   // τ=3.2h (η=0.018)
  },
};
```

---

## 八、现有模块修改

### 8.1 agent.ts 修改

```
Phase 3 (build_prompt) 增加:
  ├── ToM 信念块注入 ("关于用户你知道什么")
  ├── 叙事身份 self-view 注入 ("关于你自己你知道什么")
  └── 情感传染: 用户当前情绪 + 你的自然共鸣

Phase 7 (update_instant) 增加:
  ├── 心智理论更新 (belief/desire/intention)
  ├── 情感传染计算 (镜像 + 认知)
  ├── 无聊评估
  ├── 所有力场 update()
  └── 行为选择力场竞争 (替换旧的 Go/NoGo)

Phase 9 (cold_analyze) 增加:
  ├── 深度反思事件检测
  ├── 触发时: 反思管线
  └── PreSleep 反思 (自动: sleep_drive > 0.8)
```

### 8.2 bis-bas.ts 重写

```
删除: detectThreats() 的所有正则
新增:
  ├── 六通道威胁检测
  │   ├── 通道① 语义威胁 (embedding)
  │   ├── 通道② 语气/潜台词 (L2)
  │   ├── 通道③ 预期违背 (异稳态预测)
  │   ├── 通道④ 关系历史 (记忆激活)
  │   ├── 通道⑤ 内感受敏化 (Safety 偏离)
  │   └── 通道⑥ 不确定性放大 (ambiguity)
  └── 力场融合 (替换固定阈值的 BIS/BAS 计算)
```

### 8.3 consciousness.ts 修改

```
删除: isDeadLoop() 的阈值检测
修改: computeWeight() → 力场驱动
  w = topDeviation × 0.3 + maxTDError × 0.3 + 
      memoryActivation × 0.2 + random × 0.2 +
      ruminationFF.value × 0.3 +      // 反刍增强念头发送
      boredomFF.value > 0.5 ? 0.1 : 0 // 无聊降低自发念头发
```

### 8.4 记忆检索引擎重写

```
删除: 所有 recall()/search() 中的正则匹配
新增: retriever.ts
  ├── 语义种子激活 (embedding)
  ├── 情绪种子激活 (PAD 匹配)
  ├── 时间种子激活 (temporal context)
  ├── 激活扩散 (1-2 hop, 沿 edges)
  └── 汇聚排序 (力场调制)
```

---

## 九、实施顺序

| 序号 | 任务 | 新文件 | 依赖 |
|------|------|--------|------|
| 1 | ForceField 引擎 | `mind/force-field.ts` | 无 |
| 2 | 12维心境系统 | `mind/mood.ts` | ForceField |
| 3 | 内感受精度 | `mind/interoception.ts` | ForceField |
| 4 | 反刍力场 | `mind/rumination.ts` | ForceField + Mood |
| 5 | 情绪调节 + 崩溅 | `mind/emotion-regulation.ts` | ForceField + Rumination |
| 6 | 心智理论 ToM | `mind/theory-of-mind.ts` | 无 (独立LLM) |
| 7 | 情感传染 | `mind/emotional-contagion.ts` | Interoception + ToM |
| 8 | 叙事身份 | `mind/narrative-identity.ts` | 无 (独立LLM) |
| 9 | 无聊系统 | `mind/boredom.ts` | ForceField + Mood |
| 10 | 六通道威胁检测 | 重写 `mind/bis-bas.ts` | ToM + Memory |
| 11 | 激活扩散检索引擎 | `memory/retriever.ts` | VectorIndex |
| 12 | 向量索引接口 | `memory/vector-index.ts` | 无 |
| 13 | 人格参数系统 | `personality/personality.ts` | 无 |
| 14 | 深度反思系统 | `agent/deep-reflection.ts` | NarrativeIdentity + Rumination |
| 15 | 睡眠系统 | `agent/sleep.ts` | ForceField(sleep) + Memory |
| 16 | agent.ts 集成修改 | 修改 `agent/agent.ts` | 所有以上 |
| 17 | 意识流重写 | 修改 `mind/consciousness.ts` | 力场 |
| 18 | 行为选择力场 | 修改 agent.ts Phase 7 | 力场 |

---

## 十、审计结论与修正

### 审计发现

| # | 问题 | 严重度 | 修正 |
|---|------|--------|------|
| 1 | Panksepp PLAY 系统在无聊/行为选择中被引用但没有独立模块 | 中 | 在行为选择力场中增加 PLAY 激活计算 (不新增独立模块, 因为PLAY本质上是 Safety×Connection 交互项 + 行为选择的 playful bias) |
| 2 | 价值观冲突未覆盖 | 中 | 在设计中的 Personality 模块增加 `valueViolation` 检测: 当用户要求违背角色价值观时, 不走 BIS 威胁路径, 而是触发独立的"价值观冲突"反思事件 |
| 3 | 成长验证缺失 | 低 | 反思产出的 behavioralAdjustments 存入记忆后, 通过承诺记忆的自然激活竞争验证——无需独立模块 |
| 4 | Sleep 模块位置: `agent/sleep.ts` 但功能是系统编排级 | 低 | 保持位置, 但 `sleep.ts` 作为编排器调用记忆/反思/力场——不是独立引擎 |
| 5 | 循环依赖风险: EmotionalContagion → Interoception + ToM, 但 ToM 不依赖任何mind模块 | 无风险 | ToM 只依赖 LLM, 无循环 |
| 6 | legacy mind 模块 (drives, saturation, emotion, sublimator, psychology, dynamics, attention, prediction, relational, self-model, params, params-modulator) 与新系统功能重叠 | 高 | 本次 **不删除** legacy 模块——保持向后兼容。新增模块先在 agent.ts Phase 7 中并行运行, 稳定后逐步替换旧模块。Phase 7 新增: force field updates + mood update + boredom + emotional contagion + ToM update |

### 修正后的文件清单

```
新增 (共 14 个新文件):
  src/mind/force-field.ts          ← 通用多力场引擎
  src/mind/mood.ts                 ← 12维心境
  src/mind/interoception.ts        ← 内感受精度
  src/mind/rumination.ts           ← 反刍力场
  src/mind/emotion-regulation.ts   ← 五策略 + 崩溅力场
  src/mind/theory-of-mind.ts       ← BDI + 递归视角
  src/mind/emotional-contagion.ts  ← 情感传染
  src/mind/narrative-identity.ts   ← 自传推理 (LLM)
  src/mind/boredom.ts              ← HHVG 映射 + 认知参与力场
  src/memory/retriever.ts          ← 激活扩散检索引擎
  src/memory/vector-index.ts       ← 向量索引接口 + 暴力实现
  src/agent/deep-reflection.ts     ← 事件驱动深度反思
  src/agent/sleep.ts               ← 睡眠批处理编排
  src/personality/personality.ts   ← md↔json 双向同步

重写 (共 2 个文件):
  src/mind/bis-bas.ts              ← 六通道威胁检测
  src/mind/consciousness.ts        ← 力场驱动

修改 (共 1 个文件):
  src/agent/agent.ts               ← 全系统集成 (新增 ~200行)

总计: 14 新文件 + 2 重写 + 1 修改 = 17 文件变更
```

---

## 十一、测试计划

### 单元测试

| 模块 | 测试内容 |
|------|---------|
| ForceField | 力场更新、噪声、跃变、钳位 |
| Mood12D | 心境更新、η 验证、反馈回路 |
| Interoception | 精度噪声、先验/似然融合 |
| Rumination | 四子过程力场、激活/抑制竞争 |
| Boredom | 认知参与度更新、探索冲动 |
| EmotionalContagion | 镜像共振、认知传染、防护 |
| BisBas | 六通道融合、力场竞争 |
| NarrativeIdentity | 自传推理管线、主题更新 |
| Retriever | 激活扩散、去重、排序 |
| DeepReflection | 触发检测、输出 schema |
| Sleep | 力场触发、批处理流程 |
| Personality | md/json 双向同步 |

### 集成测试

- 一轮完整对话的所有力场更新
- 崩溅级联的完整触发链
- 情感传染 → PAD 变化 → 生成 的端到端
- 深度反思 → 人格参数修改 → 行为变化 的跨轮验证

---

*Character Mind v4 完整架构 · 2026-07-01*
