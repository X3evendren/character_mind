# ADR-020 异稳态负荷下游神经调节效应

**状态**: 提议 · **日期**: 2026-07-01

## 背景

当前 `HomeostaticState`（`src/mind/homeostatic-state.ts`）正确计算了异稳态负荷（allostatic load）：

```typescript
updateAllostaticLoad(durationMinutes: number): void {
  let load = 0;
  for (const name of ["energy", "arousal", "safety", "connection", "mastery"]) {
    const v = this[name] as HomeostaticVar;
    load += Math.abs(v.value - v.setPoint) * durationMinutes * v.allostaticWeight;
  }
  this.allostaticLoad += load;
  this.allostaticLoad = Math.max(0, this.allostaticLoad);
}
```

`allostaticLevel()` 方法提供了分类（normal/mild/moderate/severe），`formatForPrompt()` 将水平注入 prompt。然而，`allostaticLoad` 的**唯一下游消费者**是：

1. `bis-bas.ts:278` 中 `interoceptiveSensitivity` 的放大因子
2. `bis-bas.ts:383` 中 PFC 抑制的衰减

除此之外，`allostaticLoad` 是一个**孤儿累加器**——它记录了系统偏离稳态的程度，但不产生任何神经调节效应。这与 McEwen (1998) 和 Sterling (1988) 的核心主张矛盾：异稳态负荷不仅仅是"健康指标"，它是**全身生理状态的重编程信号**。

Stephan et al. (2016) 的变构-内感受预测编码模型进一步指出：异稳态负荷通过内感受回路改变**计算本身的参数**——包括学习率、探索/利用平衡、安全信号敏感性——而不仅仅是"角色觉得更累了"。

## 决策

在 `HomeostaticState` 类中新增 `getNeuromodulatoryEffects()` 方法，从 `allostaticLoad` 派生四个下游神经调节效应，供其他模块消费：

```typescript
getNeuromodulatoryEffects(): Neuromodulation {
  const al = this.allostaticLoad;

  return {
    // 觉醒偏移：allostatic load 推高基线 arousal
    arousalShift: clamp(al * 0.3, 0, 0.5),

    // 安全信号衰减：在高 stress 下，安全信号的学习率下降
    safetyDecay: clamp(al * 0.15, 0, 1),

    // 学习率损伤：当 al > 0.6 时，整体学习效率下降
    learningRateImpairment: clamp(Math.max(0, al - 0.6) * 0.5, 0, 0.5),

    // 认知窄化：高 stress 下注意力集中在威胁相关刺激上
    cognitiveNarrowing: clamp(al * 0.4, 0, 1),

    // 负荷水平分类（已有，保持不变）
    level: this.allostaticLevel(),
  };
}
```

### 各效应的消费方

| 效应 | 消费模块 | 作用 |
|------|----------|------|
| `arousalShift` | `cpm-pad.ts` | 推高 PAD 的 A 维度基线，使角色更易被激怒/兴奋 |
| `safetyDecay` | `td-error.ts` + `bis-bas.ts` | 降低安全信号的学习效率——好事不再让人安心 |
| `learningRateImpairment` | `td-error.ts` 的 `updateV` / `updateOpalWeights` | 全局学习率乘以 `(1 - learningRateImpairment)` |
| `cognitiveNarrowing` | `bis-bas.ts` + `retriever.ts` | 提高威胁检测灵敏度，降低非威胁记忆的检索权重 |

### 安全信号衰减的具体机制

安全信号学习（safety learning）——即"这个环境是安全的"的信号——在异稳态负荷下受损，这与临床上 PTSD 患者的安全信号学习缺陷一致（Jovanovic et al., 2012）。在代码中体现为：

```
effective_safety_learning_rate = base_safety_alpha × (1 - safetyDecay)
effective_safety_V_update = effective_safety_learning_rate × TD_error_safety
```

好处是：安全变量在高压下更难提升——即使对方说了安抚的话，角色的"安全感"也不会轻易恢复。这对应"听过所有安慰，但已经不信了"的状态。

### 认知窄化的检索效应

当 `cognitiveNarrowing > 0.3` 时，记忆检索的相似度阈值对威胁相关记忆降低（更容易检索到受伤记忆），对非威胁记忆提高（更难检索到愉快记忆）。这产生"心情不好时想不起好事"的计算基础。

## 理由

### 1. 异稳态负荷是计算状态变量，不是健康指标

McEwen (1998) 的原始定义中，allostatic load 是"适应负荷的累积代价"——它不仅是结果（"身体磨损"），也是原因（"进一步适应的能力下降"）。在计算系统中，这意味着 allostaticLoad 必须反馈到学习、决策、感知的参数中。当前实现只把它当作输出指标，这是对概念的误解。

### 2. 内感受预测编码

Stephan et al. (2016) 的模型将内感受（interoception）定义为"大脑对身体状态的贝叶斯推断"。当 allostatic load 高时，内感受预测偏向"身体处于危险中"——这不是偏差，而是贝叶斯先验的合理更新（之前经历了很多稳态偏离，所以现在预期更多偏离）。

四个下游效应在计算上对应这个先验更新：
- `arousalShift`：预期需要行动 → 自主神经唤醒
- `safetyDecay`：安全证据的似然权重下降 → "可能是假的"
- `learningRateImpairment`：高 arousal 下学习资源分配效率下降 → 认知资源向生存任务倾斜
- `cognitiveNarrowing`：注意力的贝叶斯精度提高（威胁通道精度上升，非威胁通道精度下降）

### 3. 变构调节的计算模型

Sterling (1988) 的变构（allostasis）概念强调：身体不是维持固定的设定值（homeostasis），而是根据预期需求**重新设定**设定值。`arousalShift` 直接体现了这一点——它改变了 arousal 的有效设定值，不是通过改变 setPoint，而是通过下游增益。这比直接修改 setPoint 更精确，因为 setPoint 代表长期人格特质，而 arousalShift 代表情境性生理状态。

## 后果

- **正面**：
  - allostaticLoad 从"只读指标"变为"全系统调制器"——闭环完整
  - 四个下游效应互为正交，覆盖学习、情感、注意、决策四个维度
  - 与现有 BIS/BAS 和 TD Error 模块的接口清晰，不改变其内部逻辑
  - "安全信号衰减"解释了"高压下安慰无效"的临床现象

- **负面**：
  - 四个调制参数需要校准——`0.3`, `0.15`, `0.5`, `0.4` 的关系需要经验验证
  - 多个模块共享同一个 allostaticLoad，可能导致反馈循环：allostaticLoad 升高 → 学习率下降 → TD 学习变差 → 稳态更难恢复 → allostaticLoad 更高
  - 在长对话场景中，如果 allostaticLoad 持续累积，四个效应可能导致角色"崩溃"（类似心理学上的 learned helplessness）

- **缓解**：
  - 反馈循环被 tick 中的 `allostaticLoad *= exp(-dt/1800)` 自然限制——即便学习率下降，稳态偏离也会随时间恢复
  - 引入"适应性"（resilience）人格特质作为调制器的增益系数：高 resilience 角色在相同 allostaticLoad 下的效应更弱
  - 在 severe 级别（al > 2.0）引入"关机保护"——进一步的效应不再线性增长，而是饱和

## 备选方案

1. **保留孤儿状态，只在 prompt 中使用**：在 prompt 中注入"你感觉很累/压力很大"让 LLM 自行发挥。这是当前做法。代价是：LLM 的表演不稳定——有时角色确实表现得很累，有时完全忽略。且 LLM 无法改变底层的计算参数（如学习率）。

2. **allostaticLoad 只影响 arousal，不影响其他**：最简单——只做 `arousal += al * 0.3`。但这浪费了 allostaticLoad 的信息容量——它包含了五个维度的累积偏差，只映射到一维是信息压缩。

3. **每个稳态变量独立追踪累积负荷**：每个变量有自己的 `load_energy`, `load_safety` 等，各自产生下游效应。虽然更精确，但参数空间爆炸（5 个变量 × 4 个效应 = 20 个参数），且心理学文献不支持这种程度的分化。

## 已知代价

- 所有消费 `allostaticLoad` 的模块需要改为消费 `getNeuromodulatoryEffects()` 返回的 `Neuromodulation` 对象
- `learningRateImpairment` 在 ADR-017（OpAL 双通道）中需要分别调制 Go 和 NoGo 通道的学习率——Go 通道可能比 NoGo 通道更早受损（正面学习比负面学习更依赖认知资源）
- `cognitiveNarrowing` 需要 `retriever.ts` 支持差异化的检索阈值——当前检索器不分"威胁记忆"和"非威胁记忆"
- 反馈循环的风险需要在集成测试中专门验证——确保在极端场景下角色不会数学上"崩溃"
