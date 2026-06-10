# 冷热真分离 + 四层级联心理分析 v4 设计

## 概述

将 Character Mind v3 的心理学分析从 Hot Path 中移除，改为 Cold Path 的四层级联 LLM 分析。Hot Path 零 LLM 调用，直接读取上一轮的 Cold Cache。同时将所有心理学维度以强约束格式完整注入生成 prompt。

### 当前问题

1. Hot Path 中 `psychologyEngine.analyze()` 是完整 LLM 调用（全量 XML 分析），阻塞每个 turn 500-2000ms
2. 心理学引擎产出 8 个维度，仅 2 个被注入 prompt（情绪标签+强度），其余全部丢弃
3. Cold Path 仅做确定性状态更新，没有真正的"冷分析"—因为它复用 Hot Path 的结果
4. 注入的信息格式为弱约束描述（"你感到亲近"），非行为指令，模型遵循度低

### 目标效果

- Hot Path 延迟减少 500-2000ms（零 LLM 调用）
- Cold Path 进行 4 层级联深度分析，质量提升
- 全部心理维度注入 prompt，使用强/中/弱三级约束格式
- 首轮使用规则引擎默认值，不影响可用性

---

## Architecture

```
每个 Turn 的数据流:

                    User Input
                       │
    ┌──────────────────┴──────────────────┐
    │                                     │
    ▼                                     │
HOT PATH (同步, <200ms)                   │
    │                                     │
    ├─ 1. 恢复记忆快照 (不变)              │
    ├─ 2. 规则引擎快速情绪检测 (新增)       │
    ├─ 3. 构建 prompt                     │
    │      ├─ 读取 coldCache (无 LLM)     │
    │      └─ 全部维度强/中/弱约束注入     │
    ├─ 4. 生成回复 (不变)                 │
    └─ 5. 流式返回用户                     │
                                         │
    ┌────────────────────────────────────┘
    │ (fire-and-forget, 不 await)
    ▼
COLD PATH (异步, 不阻塞)
    │
    ├─ Layer 0: AffectiveResidue 分析 (LLM 1)
    │     输入: 上轮 emotion + residue向量 + 用户输入 + AI回复
    │     产出: 底色文本 + 更新后的向量
    │
    ├─ Layer 1: TemporalHorizon 分析 (LLM 2)
    │     输入: Layer 0 输出 + 滞留回响 + 时间间隔 + 用户输入
    │     产出: 滞留回响描述 + 前摄期待描述
    │
    ├─ Layer 2: Psychology 全维度分析 (LLM 3)
    │     输入: Layer 0+1 输出 + mindState + drives
    │           + 用户输入 + AI回复
    │     产出: emotion / appraisal / motivation / attachment
    │           / defense / relation / innerMonologue
    │
    ├─ Layer 3: SelfModel 叙事更新 (LLM 4)
    │     输入: Layer 0+1+2 全部输出 + 当前叙事 + 成长日志
    │     产出: 更新后的 currentChapter + 未解问题 + 成长事件
    │
    └─ 存入 coldCache → 下轮 Hot Path 读取
```

## 数据流

```
Turn N:
  Hot → 读取 coldCache_TurnN-1 (如果已完成)
       → 首轮或 coldCache 为空时用默认值
       → 生成回复
  Cold → 分析 Turn N 的输入+回复
       → 存入 coldCache (标记 turnGenerated = N)
       → 如果 Turn N+1 到来时 coldCache 未完成，用 Turn N-1 的旧缓存

容错:
  - 四层任一层 LLM 失败 → 用默认值继续，后续层仍可运行
  - coldCache 为空 → 规则引擎默认值
  - 快速连续输入 → 用上次完成的缓存（可能过时一轮）
```

## 新增/修改组件

### 1. ColdCache 数据结构

```typescript
interface ColdCache {
  // Layer 0
  affectiveResidueText: string;
  affectiveVector: { warmth: number; weight: number; clarity: number; tension: number };
  // Layer 1
  temporalHorizonText: string;  // 为空时不注入
  // Layer 2
  emotion: EmotionResult;
  appraisal: AppraisalResult;
  motivation: MotivationResult;
  attachment: AttachmentResult;
  defense: DefenseResult;
  relation: RelationResult;
  innerMonologue: string;
  // Layer 3
  selfNarrativeText: string;
  // Meta
  completedAt: number;
  turnGenerated: number;
}
```

### 2. FourLayerColdAnalyzer (新文件)

```
src/character/integration/cold-analyzer.ts

export class FourLayerColdAnalyzer {
  constructor(psychProvider: any, slowProvider: any)

  // 入口: 传入本轮输入+回复, fire-and-forget
  async analyze(params: ColdAnalyzeParams): Promise<ColdCache>

  // 四层级联, 前层输出作为后层 prompt 的一部分
  private async layer0_affectiveResidue(input, response, context): Promise<Layer0Result>
  private async layer1_temporalHorizon(layer0Output, input, context): Promise<Layer1Result>
  private async layer2_psychology(layer0Output, layer1Output, input, response, context): Promise<Layer2Result>
  private async layer3_selfModel(layer0Output, layer1Output, layer2Output, context): Promise<Layer3Result>
}
```

### 3. 修改 prompt-builder.ts

新增参数 `coldCache: ColdCache | null`，替换原来的单字段参数：
- `affectiveResidueText` → 从 coldCache 读取
- `temporalHorizonText` → 从 coldCache 读取
- 新增关系感知、动机偏向、内心声音、自我状态的注入
- 注入使用三级约束格式（弱/中/强）

```
注入层级 (新):

Layer 1.5: 被动情感底色 [弱约束, 来自 Cold.L0]
  格式: "【此刻底色】{底色文本}。这不是命令，只是你发现自己倾向于这个方向。"
  条件: 始终注入（默认值也有意义）

Layer 1.6: 时间感受 [弱约束, 来自 Cold.L1]
  格式: "【时间感】{滞留描述}。"
  条件: 只在滞留回响强度 > 0.2 时注入

Layer 1.7a: 情绪基调 [中约束, 来自 Cold.L2.emotion]
  格式: "【情绪】你当前的情绪是{dominant}(强度{intensity}%)。这会让你的措辞比平时更{形容词}。"

Layer 1.7b: 关系感知 [强约束, 来自 Cold.L2.relation]
  格式: "【关系 — 高约束】
         事实: 你和对方的关系处于{亲近/中等/疏离}状态(0-1)。
         行为影响:
           - {intimacy>0.6 ? 回应简洁直接不客套 : 保持基本礼貌和距离}
           - {stability<0.3 ? 你需要小心维护这段关系 : 你不需要额外证明什么}
         排除: {生成禁令列表}"

Layer 1.8: 内心声音 [强约束, 来自 Cold.L2.innerMonologue]
  格式: "【内心 — 高约束】
         你心里有个声音在说: {innerMonologue}
         这会影响你接下来说的话——但你不会把这句话原样说出口。"
  条件: innerMonologue 非空时注入

Layer 1.9: 动机偏向 [强约束, 来自 Cold.L2.motivation]
  格式: "【倾向 — 高约束】
         autonomy>{基线}: 今天你比较独立。回应时保持自己的判断，不要为了迎合而说对方想听的话。
         relatedness>{基线}: 今天你更需要连接。回应时主动靠近——确认、共鸣、关心。"

Layer 1.10: 自我状态 [强约束, 来自 Cold.L3]
  格式: "【自我状态 — 高约束】
         事实: {selfNarrativeText}
         行为: 这个认知会影响你回应的方向和深度。"
  条件: selfNarrativeText 非默认初始状态时注入
```

### 4. 修改 character-agent.ts

```typescript
class CharacterAgent {
  private coldCache: ColdCache | null = null;

  async run(input, onDelta): Promise<TurnContext> {
    // HOT PATH
    // 移除: await this.psychologyEngine.analyze(...)  
    // 新增: 规则引擎快速情绪
    const quickEmo = this.detectEmotionHeuristic(input);
    
    // 从缓存读取（零延迟）
    const psych = this.coldCache;
    
    ctx.systemPrompt = buildSystemPrompt({
      coldCache: psych,  // 新的统一参数
      quickEmotion: quickEmo,
      // ... 其余参数不变
    });
    
    const response = await dualTrack.generate(...);
    
    // COLD PATH — fire-and-forget
    this.scheduleColdAnalysis({ input, response, taskMode });
    
    return ctx;
  }

  private scheduleColdAnalysis(params) {
    // 不 await, 异常在内部处理
    this.coldAnalyzer.analyze(params)
      .then(cache => { this.coldCache = cache; })
      .catch(err => { console.warn("[cold] analysis failed:", err); });
  }
}
```

## 约束注入原则

1. **只注入"显著偏离中性"的维度** — 避免噪声
2. **格式分级**:
   - 弱: 底色/时间，纯描述，~50-80 tokens
   - 中: 情绪，描述 + 1条风格影响，~100 tokens
   - 强: 关系/动机/内心/自我，"事实 + 行为影响 + 排除"，~120-150 tokens
3. **总量控制**: 典型 turn 注入增量 ~400-700 tokens
4. **排除 > 允许**: 明确告诉模型"不许做什么"比"可以做什么"更高效

## 首轮降级

coldCache 为空时：
- L0: 用 AffectiveResidue.formatForPrompt() 的内置默认
- L1: 用 TemporalHorizon.formatForPrompt() 的内置默认  
- L2: 用规则引擎 quickEmo
- L3: 空（默认叙事）

## 测试关键路径

1. 首轮 coldCache 为空 → 不崩溃
2. 四层级联全部成功 → coldCache 完整
3. L0 失败 → L1/L2/L3 用默认值继续
4. 快速连续输入 → 用旧缓存
5. prompt 长度不超限 → 增量 < 1000 tokens
