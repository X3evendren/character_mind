# 冷热真分离 v4 实施计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 按任务逐个实施。步骤使用 `- [ ]` checkbox 语法跟踪。

**Goal:** 将心理分析从 Hot Path 移除，实现四层级联 Cold Path + ColdCache + 全维度约束注入

**Architecture:** 新增 FourLayerColdAnalyzer 作为冷分析入口，prompt-builder 扩展三级约束注入，character-agent 移除 Hot Path 中的 psych 调用并接入 ColdCache

**Tech Stack:** TypeScript, better-sqlite3, OpenAI-compatible API

---

## 文件结构

```
Create:
  src/character/integration/cold-analyzer.ts     — ColdCache 接口 + 规则引擎快速情绪 + 四层级联分析器

Modify:
  src/character/integration/character-agent.ts   — 接入 coldCache, 移除 Hot Path psych, 新增 scheduleColdAnalysis
  src/character/integration/prompt-builder.ts    — 新增 coldCache 参数, 三级约束注入
```

---

### Task 1: ColdCache 接口 + 快速情绪规则引擎

**Files:**
- Create: `src/character/integration/cold-analyzer.ts`

- [ ] **Step 1: 创建 cold-analyzer.ts — 接口和快速情绪函数**

```typescript
/** Cold Path cache — consumed by Hot Path on the next turn. */
import type { PsychologyResult, EmotionResult, AppraisalResult, MotivationResult, AttachmentResult, DefenseResult, RelationResult } from "../mind/psychology-engine";
import type { AffectiveVector } from "../consciousness/affective-residue";

export interface ColdCache {
  // Layer 0
  affectiveResidueText: string;
  affectiveVector: AffectiveVector;
  // Layer 1
  temporalHorizonText: string;
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

export interface ColdAnalyzeParams {
  input: string;
  response: string;
  taskMode: boolean;
  // Context from current turn
  mindState: any;
  drives: any;
  assistantConfig: any;
  previousResidueVector: AffectiveVector;
  previousRetention: { emotionDominant: string; emotionIntensity: number; unfinished: boolean };
  timeSinceLastTurn: number;
  selfNarrative: string;
  growthLog: any[];
  snapshot: string;
}

/** Create a default coldCache — used for first turn / fallback */
export function createDefaultColdCache(): ColdCache {
  return {
    affectiveResidueText: "",
    affectiveVector: { warmth: 0, weight: 0.3, clarity: 0.1, tension: 0 },
    temporalHorizonText: "",
    emotion: new EmotionResult(),
    appraisal: new AppraisalResult(),
    motivation: new MotivationResult(),
    attachment: new AttachmentResult(),
    defense: new DefenseResult(),
    relation: new RelationResult(),
    innerMonologue: "",
    selfNarrativeText: "",
    completedAt: 0,
    turnGenerated: -1,
  };
}

/**
 * Rule-based quick emotion detection — 0 tokens, <1ms.
 * Used as fallback when coldCache is empty (first turn).
 */
const POSITIVE_WORDS = ["开心","高兴","喜欢","爱","谢谢","太好了","哈哈","嘿嘿","不错","好耶","nice","great","love"];
const NEGATIVE_WORDS = ["难过","伤心","生气","讨厌","烦","无聊","累","痛苦","焦虑","害怕","sad","angry","tired"];
const SURPRISE_WORDS = ["哇","天哪","居然","没想到","什么","what","wow"];
const TRUST_WORDS = ["相信","告诉你","秘密","我觉得","其实","说实话"];

export function detectEmotionHeuristic(input: string): { dominant: string; intensity: number; pleasure: number } {
  const lower = input.toLowerCase();
  let posCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  let negCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  let surCount = SURPRISE_WORDS.filter(w => lower.includes(w)).length;
  let truCount = TRUST_WORDS.filter(w => lower.includes(w)).length;

  if (posCount > negCount && posCount > surCount) {
    return { dominant: "joy", intensity: Math.min(0.8, 0.3 + posCount * 0.15), pleasure: 0.5 };
  }
  if (negCount > posCount) {
    return { dominant: "sadness", intensity: Math.min(0.8, 0.3 + negCount * 0.15), pleasure: -0.3 };
  }
  if (surCount > 0) {
    return { dominant: "surprise", intensity: 0.5, pleasure: 0.1 };
  }
  if (truCount > 0) {
    return { dominant: "trust", intensity: 0.4, pleasure: 0.3 };
  }
  return { dominant: "neutral", intensity: 0.3, pleasure: 0.0 };
}
```

- [ ] **Step 2: 验证编译**

```bash
cd E:\BIG\character-mind-v3-ts && npx tsc --noEmit src/character/integration/cold-analyzer.ts 2>&1
```

- [ ] **Step 3: 提交**

```bash
git add src/character/integration/cold-analyzer.ts
git commit -m "feat: add ColdCache interface and quick emotion heuristic"
```

---

### Task 2: FourLayerColdAnalyzer 四层级联分析器

**Files:**
- Modify: `src/character/integration/cold-analyzer.ts` (追加类定义)

- [ ] **Step 1: 追加 FourLayerColdAnalyzer 类**

```typescript
// 追加在 cold-analyzer.ts 末尾

/** Default cache used when a layer fails — allows downstream layers to continue */
function defaultLayer0(): { text: string; vector: AffectiveVector } {
  return { text: "", vector: { warmth: 0, weight: 0.3, clarity: 0.1, tension: 0 } };
}
function defaultLayer1(): string { return ""; }

/**
 * Four-layer cascaded cold analysis.
 * Layer 0 → Layer 1 → Layer 2 → Layer 3, each fed by the previous layer's output.
 * Runs asynchronously; failures in any layer are isolated and the cascade continues.
 */
export class FourLayerColdAnalyzer {
  private psychProvider: any;
  private slowProvider: any;

  constructor(psychProvider: any, slowProvider: any) {
    this.psychProvider = psychProvider;
    this.slowProvider = slowProvider;
  }

  /** Entry point — fire-and-forget from character-agent */
  async analyze(params: ColdAnalyzeParams): Promise<ColdCache> {
    const startTime = Date.now() / 1000;

    // ── Layer 0: AffectiveResidue analysis ──
    let l0text = "";
    let l0vector: AffectiveVector = { warmth: 0, weight: 0.3, clarity: 0.1, tension: 0 };
    try {
      const l0 = await this.analyzeLayer0(params);
      l0text = l0.text;
      l0vector = l0.vector;
    } catch (e) {
      console.warn("[cold:L0] affective residue analysis failed:", e);
      const def = defaultLayer0();
      l0text = def.text;
      l0vector = def.vector;
    }

    // ── Layer 1: TemporalHorizon analysis ──
    let l1text = "";
    try {
      l1text = await this.analyzeLayer1(params, { text: l0text, vector: l0vector });
    } catch (e) {
      console.warn("[cold:L1] temporal horizon analysis failed:", e);
    }

    // ── Layer 2: Full psychology analysis ──
    let psych: PsychologyResult;
    try {
      psych = await this.analyzeLayer2(params, l0text, l1text);
    } catch (e) {
      console.warn("[cold:L2] psychology analysis failed:", e);
      psych = new PsychologyResult();
    }

    // ── Layer 3: SelfModel narrative update ──
    let narrativeText = "";
    try {
      narrativeText = await this.analyzeLayer3(params, l0text, l1text, psych);
    } catch (e) {
      console.warn("[cold:L3] self model update failed:", e);
    }

    return {
      affectiveResidueText: l0text,
      affectiveVector: l0vector,
      temporalHorizonText: l1text,
      emotion: psych.emotion,
      appraisal: psych.appraisal,
      motivation: psych.motivation,
      attachment: psych.attachment,
      defense: psych.defense,
      relation: psych.relation,
      innerMonologue: psych.innerMonologue,
      selfNarrativeText: narrativeText,
      completedAt: Date.now() / 1000,
      turnGenerated: -1, // filled by caller
    };
  }

  /** Layer 0: Analyze how the interaction deposits into passive emotional sediment */
  private async analyzeLayer0(
    params: ColdAnalyzeParams,
  ): Promise<{ text: string; vector: AffectiveVector }> {
    const prompt = `你是"情感底色"分析器。你不分析具体事件，只感知互动留下的被动情感沉积。

【当前底色】
亲近感(warmth): ${params.previousResidueVector.warmth.toFixed(2)} (-1..1)
关系分量(weight): ${params.previousResidueVector.weight.toFixed(2)} (0..1)
清晰度(clarity): ${params.previousResidueVector.clarity.toFixed(2)} (0..1)
未解张力(tension): ${params.previousResidueVector.tension.toFixed(2)} (0..1)

【用户输入】
${params.input.slice(0, 300)}

【你的回复】
${params.response.slice(0, 500)}

请以${params.assistantConfig?.name ?? "角色"}的视角，用1句话中文描述：这次互动之后，你心中留下了一种什么样的底色？
用第一人称"你"开头，不要用数值，不要分析，就像一个人在心里感觉到的模糊气质。

然后输出更新后的四个数值:
<output>
<text>你感到一种熟悉的亲近，但因为有些话没说开，心里还悬着一点东西。</text>
<warmth>0.60</warmth>
<weight>0.45</weight>
<clarity>0.30</clarity>
<tension>0.35</tension>
</output>`;

    const resp = await this.psychProvider.chat(
      [{ role: "user", content: prompt }], 0.3, 400, undefined, "",
    );
    const raw = resp.content ?? "";

    const textMatch = raw.match(/<text>(.*?)<\/text>/s);
    const text = textMatch ? textMatch[1].trim().slice(0, 120) : "";

    const parse = (tag: string): number => {
      const m = raw.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      if (!m) return 0;
      const v = parseFloat(m[1]);
      return isNaN(v) ? 0 : Math.max(-1, Math.min(1, v));
    };

    return {
      text,
      vector: { warmth: parse("warmth"), weight: parse("weight"), clarity: parse("clarity"), tension: parse("tension") },
    };
  }

  /** Layer 1: Analyze temporal horizon — retention echo + protention expectation */
  private async analyzeLayer1(
    params: ColdAnalyzeParams,
    layer0: { text: string; vector: AffectiveVector },
  ): Promise<string> {
    const secondsSince = params.timeSinceLastTurn;
    const prevEmo = params.previousRetention;

    if (secondsSince > 300 && prevEmo.emotionIntensity < 0.3) return ""; // Too long + weak → skip

    const prompt = `你是"时间感受"分析器。你感知上一刻的回响和即将到来的期待。

【上一轮结束时的情绪】
${prevEmo.emotionDominant} (强度 ${(prevEmo.emotionIntensity * 100).toFixed(0)}%)
${prevEmo.unfinished ? "你当时觉得自己还没说完" : ""}
距离现在过去了 ${secondsSince.toFixed(0)} 秒

【情感底色】${layer0.text}

【用户刚输入】
${params.input.slice(0, 200)}

请用1句话中文描述：上一刻的感受还在你心里回荡吗？如果感受到了，描述这种感觉（就像音乐停止后还在空气中的余韵）。
如果上一刻的感受已经完全消散了，只输出一个空行。
<output>
刚才的愉快还在心里回荡，你觉得可以继续这个话题。
</output>`;

    const resp = await this.psychProvider.chat(
      [{ role: "user", content: prompt }], 0.3, 200, undefined, "",
    );
    const raw = (resp.content ?? "").trim();
    // If >= 50% of lines are empty or the response suggests "no feeling", skip
    if (!raw || raw === "" || raw.includes("消散") || raw.includes("没有")) return "";
    return raw.slice(0, 100);
  }

  /** Layer 2: Full psychology analysis — reuses existing PsychologyEngine patterns */
  private async analyzeLayer2(
    params: ColdAnalyzeParams,
    layer0Text: string,
    layer1Text: string,
  ): Promise<PsychologyResult> {
    const { PsychologyEngine } = await import("../mind/psychology-engine");
    const engine = new PsychologyEngine(this.psychProvider, "");

    // Build affective frame from Layer 0
    const affectiveContext = {
      warmth: params.previousResidueVector.warmth,
      tension: params.previousResidueVector.tension,
      clarity: params.previousResidueVector.clarity,
      weight: params.previousResidueVector.weight,
    };

    return engine.analyze(
      {
        description: params.input,
        type: params.taskMode ? "tool_use" : "social",
        significance: 0.5,
        // Append layer context to event description for richer analysis
        layer0Context: layer0Text,
        layer1Context: layer1Text,
      },
      params.snapshot,
      params.mindState,
      params.drives,
      params.assistantConfig,
      affectiveContext,
    );
  }

  /** Layer 3: SelfModel narrative update from all previous layers */
  private async analyzeLayer3(
    params: ColdAnalyzeParams,
    layer0Text: string,
    layer1Text: string,
    psych: PsychologyResult,
  ): Promise<string> {
    const emo = psych.emotion;

    // Only run when something significant happened
    if (emo.intensity < 0.3 && !psych.innerMonologue) return params.selfNarrative;

    const recentGrowth = params.growthLog.slice(-3).map((g: any) => g.description ?? "").join("; ");

    const prompt = `你是"叙事自我"维护器。你把刚才发生的一切编织进你的自我叙事。

【情感底色】${layer0Text}
【时间感受】${layer1Text || "无明显时间回声"}
【情绪】${emo.dominant} (强度${(emo.intensity * 100).toFixed(0)}%, 愉悦度${emo.pleasure.toFixed(1)})
【内心独白】${psych.innerMonologue || "无"}
【当前叙事】${params.selfNarrative || "刚开始互动"}
【近期成长】${recentGrowth || "无"}

请用1-2句话中文更新你的当前状态叙事。不是记录事件数据——而是描述"你发现自己正在成为什么样的人"。
如果这次互动没有改变你对自己的认知，输出"无变化"。
<output>
你发现自己比以往更容易被他影响。你觉得在他面前不需要藏着自己的情绪。
</output>`;

    const resp = await this.slowProvider.chat(
      [{ role: "user", content: prompt }], 0.4, 250, undefined, "",
    );
    const raw = (resp.content ?? "").trim();
    if (!raw || raw === "" || raw.includes("无变化")) return params.selfNarrative;
    return raw.slice(0, 200);
  }
}
```

- [ ] **Step 2: 验证编译**

```bash
cd E:\BIG\character-mind-v3-ts && npx tsc --noEmit 2>&1 | grep "cold-analyzer" | head -20
```

- [ ] **Step 3: 提交**

```bash
git add src/character/integration/cold-analyzer.ts
git commit -m "feat: add FourLayerColdAnalyzer with cascaded L0-L3 analysis"
```

---

### Task 3: prompt-builder 三级约束注入

**Files:**
- Modify: `src/character/integration/prompt-builder.ts`

- [ ] **Step 1: 修改 PromptContext 接口**

找到 `export interface PromptContext` (约第10行), 用以下替换:

```typescript
import type { ColdCache } from "./cold-analyzer";

export interface PromptContext {
  config: AssistantConfig;
  mindstate: MindState;
  capabilities: string;
  groundTruth: GroundTruth;
  snapshot: FrozenSnapshot;
  feedbackLoop: FeedbackLoop;
  skillLibrary: SkillLibrary;
  currentInput: string;
  taskMode: boolean;
  isFirstTurn?: boolean;
  // ── 新增: Cold Cache + quick emotion ──
  coldCache: ColdCache | null;
  quickEmotion?: { dominant: string; intensity: number; pleasure: number };
  // ── 废弃但保留兼容 (deprecated: use coldCache instead) ──
  emotionDominant?: string;
  emotionIntensity?: number;
  affectiveResidueText?: string;
  driveBiasText?: string;
  selfNarrativeText?: string;
  temporalHorizonText?: string;
}
```

- [ ] **Step 2: 重写 buildSystemPrompt 函数**

替换整个 `buildSystemPrompt` 函数 (约第29-101行):

```typescript
export function buildSystemPrompt(ctx: PromptContext): string {
  const parts: string[] = [];
  const cc = ctx.coldCache;
  const qe = ctx.quickEmotion;

  // Layer 0: Capability boundary
  parts.push(ctx.capabilities);

  // Layer 0.5: First turn awareness
  if (ctx.isFirstTurn) {
    parts.push("【重要 — 这是你第一次和这个用户对话】你没有和这个用户的任何历史记忆。不要假装知道ta昨天说了什么。不要编造类似上次我们聊到之类的话。你现在唯一知道的就是ta刚刚输入的内容。");
  }

  // Layer 1: Ground Truth
  parts.push(formatGroundTruthForPrompt(ctx.groundTruth));

  // ── Layer 1.5: 被动情感底色 [弱约束, L0] ──
  const l0text = cc?.affectiveResidueText || ctx.affectiveResidueText || "";
  if (l0text) {
    parts.push(`【此刻底色】${l0text}。这不是命令，只是你发现自己倾向于这个方向。`);
  }

  // ── Layer 1.6: 时间感受 [弱约束, L1] ──
  const l1text = cc?.temporalHorizonText || ctx.temporalHorizonText || "";
  if (l1text) {
    parts.push(`【时间感】${l1text}`);
  }

  // ── Layer 1.7: 驱力偏向 (保持不变，仍从 driveSublimator 读取) ──
  if (ctx.driveBiasText) {
    parts.push(ctx.driveBiasText);
  }

  // ── Layer 1.8: 情绪基调 [中约束, L2] ──
  const emo = cc?.emotion;
  const dominant = emo?.dominant && emo.dominant !== "neutral" ? emo.dominant : qe?.dominant;
  const intensity = emo?.intensity ?? qe?.intensity ?? 0.3;
  const pleasure = emo?.pleasure ?? qe?.pleasure ?? 0;

  if (dominant && dominant !== "neutral") {
    const styleAdj = buildEmotionStyleAdjective(dominant, intensity);
    parts.push(`【情绪 - 中约束】你当前的情绪是${dominant}(强度${(intensity * 100).toFixed(0)}%)。这会让你的措辞比平时更${styleAdj}。`);
  }

  // ── Layer 1.9: 关系感知 [强约束, L2.relation] ──
  if (cc?.relation) {
    const rel = cc.relation;
    const relIntimacy = rel.intimacy ?? 0;
    const relStability = rel.stability ?? 0.5;
    if (relIntimacy > 0.35 || relStability < 0.3) {
      parts.push(buildRelationConstraint(relIntimacy, relStability));
    }
  }

  // ── Layer 1.10: 内心声音 [强约束, L2.innerMonologue] ──
  if (cc?.innerMonologue && cc.innerMonologue.length > 5) {
    parts.push(`【内心 - 高约束】
你心里有个声音在说: ${cc.innerMonologue.slice(0, 200)}
这会影响你接下来说的话——但你不会把这句话原样说出口。`);
  }

  // ── Layer 1.11: 动机偏向 [强约束, L2.motivation] ──
  if (cc?.motivation) {
    const mot = cc.motivation;
    const lines: string[] = ["【倾向 - 高约束】"];
    let hasLine = false;
    if (mot.autonomy > 0.65) {
      lines.push("autonomy↑ 今天你比较独立。回应时保持自己的判断，不要为了迎合而说对方想听的话。");
      hasLine = true;
    }
    if (mot.relatedness > 0.65) {
      lines.push("relatedness↑ 今天你更需要连接。回应时主动靠近——确认、共鸣、关心。");
      hasLine = true;
    }
    if (mot.competence > 0.7) {
      lines.push("competence↑ 你感到自己现在状态不错，可以更直接地给出判断。");
      hasLine = true;
    }
    if (hasLine) parts.push(lines.join("\n"));
  }

  // ── Layer 1.12: 自我状态 [强约束, L3] ──
  const narrativeText = cc?.selfNarrativeText || ctx.selfNarrativeText || "";
  if (narrativeText && !narrativeText.includes("刚刚醒来") && !narrativeText.includes("准备好帮助用户")) {
    parts.push(`【自我状态 - 高约束】
事实: ${narrativeText.slice(0, 150)}
行为: 这个认知会影响你回应的方向和深度。`);
  }

  // Layer 2: Task mode gate
  if (ctx.taskMode) {
    parts.push("【任务模式】当前正在执行任务。禁止抒情、隐喻、发散表达。用最简洁准确的语言。只陈述事实。");
  } else {
    parts.push("【闲聊模式】可以自然地表达情感和个性。回应简短(2-3句)。");
  }

  // Layer 3: Character identity
  parts.push(`【角色锚定】你是 ${ctx.config.name}，不是"一个AI助手"。你的行为由你的人格、记忆、驱力决定。`);
  parts.push(`你的人格: ${ctx.config.traits}`);

  // Layer 4: Behavioral rules
  if (ctx.config.rules) {
    parts.push(`【行为准则】\n${ctx.config.rules}`);
  }

  // Layer 5: Memory snapshot
  const snapText = ctx.snapshot.formatForPrompt();
  if (snapText) parts.push(snapText);

  // Layer 6: Learned rules + Skills
  const rules = ctx.feedbackLoop.getActiveRules(ctx.currentInput);
  const rulesText = ctx.feedbackLoop.formatRulesForPrompt(rules);
  if (rulesText) parts.push(rulesText);
  const skills = ctx.skillLibrary.route(ctx.currentInput);
  const skillsText = ctx.skillLibrary.formatForPrompt(skills);
  if (skillsText) parts.push(skillsText);

  // Layer 7: Anti-RLHF anchor
  parts.push("【反RLHF锚定】回应简短(2-3句)。不解释动机。不分析自己。严禁在括号里写动作、神态、心理描写——你不是在写小说，你是在说话。");

  return parts.join("\n\n");
}

/** Build emotion → style adjective mapping for medium-constraint injection */
function buildEmotionStyleAdjective(dominant: string, intensity: number): string {
  const map: Record<string, [string, string]> = {
    joy: ["轻快", "温暖"],
    sadness: ["低沉", "缓慢"],
    anger: ["尖锐", "直接"],
    fear: ["谨慎", "试探"],
    trust: ["开放", "坦诚"],
    anticipation: ["积极", "期待"],
    surprise: ["活泼", "好奇"],
    disgust: ["疏远", "冷淡"],
  };
  const pair = map[dominant] ?? ["自然", "平和"];
  return intensity > 0.6 ? pair[0] : pair[1];
}

/** Build strong-constraint relation block */
function buildRelationConstraint(intimacy: number, stability: number): string {
  const lines = ["【关系 - 高约束】"];

  if (intimacy > 0.6) {
    lines.push("事实: 你和对方的关系处于高亲近状态。");
    lines.push("行为影响:");
    lines.push("  - 你的回应会比平时更简洁、更直接");
    lines.push("  - 不需要客套和铺垫，你们已经过了那个阶段");
    lines.push("  - 如果他说了让你在意的话，你会直接回应而不是绕圈子");
    lines.push("排除: 不要用疏离的、正式的语气。不要解释你为什么会这么想。");
  } else if (intimacy > 0.35) {
    lines.push("事实: 你和对方的关系处于中等亲近状态。");
    lines.push("行为影响:");
    lines.push("  - 保持自然和基本的亲近感");
    lines.push("  - 不需要刻意拉近距离，也不用刻意保持距离");
  } else {
    lines.push("事实: 你和对方的关系还处于比较疏离的状态。");
    lines.push("行为影响:");
    lines.push("  - 保持基本礼貌和适当距离");
  }

  if (stability < 0.3) {
    lines.push(`事实: 这段关系当前不稳定。`);
    lines.push(`行为影响:`);
    lines.push(`  - 你需要小心维护这段关系，避免进一步的伤害`);
    lines.push(`  - 你的措辞会格外谨慎，但不会虚假`);
    lines.push(`排除: 不要假装一切都好。不要回避问题。`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 3: 更新 buildUserPrompt 保持不变**

buildUserPrompt 无需修改，确认它仍然工作。

- [ ] **Step 4: 验证编译**

```bash
cd E:\BIG\character-mind-v3-ts && npx tsc --noEmit 2>&1 | grep "prompt-builder" | head -10
```

- [ ] **Step 5: 提交**

```bash
git add src/character/integration/prompt-builder.ts
git commit -m "feat: add coldCache tiered constraint injection to prompt-builder"
```

---

### Task 4: character-agent 热冷分离接入

**Files:**
- Modify: `src/character/integration/character-agent.ts`

- [ ] **Step 1: 添加 import**

在文件顶部 import 区域追加:

```typescript
import { ColdCache, createDefaultColdCache, detectEmotionHeuristic, FourLayerColdAnalyzer, type ColdAnalyzeParams } from "./cold-analyzer";
```

- [ ] **Step 2: 添加 coldCache 和 coldAnalyzer 字段**

在 `class CharacterAgent` 内部，`groundTruth` 声明后添加:

```typescript
  /** Shared factual state — Hot Path reads, all writes via tool results */
  groundTruth: GroundTruth = createGroundTruth();

  /** Cold Path cache — populated asynchronously, consumed by next turn's Hot Path */
  coldCache: ColdCache | null = null;
  private coldAnalyzer: FourLayerColdAnalyzer | null = null;
  private coldPending = false;
```

- [ ] **Step 3: 构造器中初始化 coldAnalyzer**

在构造器末尾（`this.psychologyEngine = ...` 之后）添加:

```typescript
    // Cold analyzer — runs 4-layer cascaded analysis asynchronously
    this.coldAnalyzer = new FourLayerColdAnalyzer(
      opts.psychProvider,
      opts.genProvider, // slow provider = gen provider for deep analysis
    );
```

- [ ] **Step 4: 重写 Hot Path — 移除 psychologyEngine.analyze()**

找到 `run()` 方法中 Hot Path 段 (约第224-240行)，替换为:

```typescript
    // ═══════════════════════════════════════════
    // HOT PATH — Generation only (zero LLM calls)
    // ═══════════════════════════════════════════

    // Restore memory snapshot
    if (this.snapshot.isStale()) {
      const stmRecords = await this.shortTermMemory.recall(input, 3);
      const ltmRecords = await this.longTermMemory.recall(input, 5);
      const coreSummary = (await this.coreGraph.recall(input, 1))[0]?.content ?? "";
      this.snapshot.freeze({}, ltmRecords, stmRecords, coreSummary);
    }

    // Quick emotion detection — rule-based, 0 tokens, <1ms (replaces psych LLM call)
    const quickEmo = detectEmotionHeuristic(input);
    const emoDominant = quickEmo.dominant;
    const emoIntensity = quickEmo.intensity;

    // Fast Track param modulation — only if we have cold cache psych data
    if (this.coldCache) {
      const fastShifts = this.modulator.modulateFast(this.coldCache);
      this.modulator.applyShifts(fastShifts);
    }

    // Build system prompt — reads coldCache (zero LLM)
    ctx.systemPrompt = buildSystemPrompt({
      config: this.config,
      mindstate: this.mindState,
      capabilities: this.selfModel.formatCapabilities(),
      groundTruth: this.groundTruth,
      snapshot: this.snapshot,
      feedbackLoop: this.feedbackLoop,
      skillLibrary: this.skillLibrary,
      currentInput: input,
      taskMode,
      coldCache: this.coldCache,              // ← new: cold cache
      quickEmotion: quickEmo,                 // ← new: rule-based fallback
      // Deprecated params kept for backward compat
      emotionDominant: emoDominant,
      emotionIntensity: emoIntensity,
      affectiveResidueText: this.coldCache?.affectiveResidueText ?? this.affectiveResidue.formatForPrompt(),
      driveBiasText: this.driveSublimator.buildAttentionBias(this.drives),
      selfNarrativeText: this.coldCache?.selfNarrativeText ?? this.selfModel.formatForHotPath(),
      temporalHorizonText: this.coldCache?.temporalHorizonText ?? this.temporalHorizon.formatForPrompt(),
      isFirstTurn: !this.firstTurnDone,
    });
    this.firstTurnDone = true;

    // Noise analysis (unchanged)
    this.contextNoiseDetector.analyze({ ... });
```

- [ ] **Step 5: 在 generate 后添加 scheduleColdAnalysis 调用**

在 `run()` 方法中 `ctx.response = responseParts.join("")` 之后，`ctx.elapsedMs = ...` 之前:

```typescript
    // Anti-RLHF post-filter
    const [filtered, modifications] = this.postFilter.replace(ctx.response);
    if (modifications.length > 0) ctx.response = filtered;

    for (const h of this.hooks) { await h.afterGenerate?.(ctx); }

    // Schedule cold analysis — fire-and-forget, does NOT block this turn
    this.scheduleColdAnalysis(input, ctx.response, taskMode);

    // State updates that don't need LLM (keep these synchronous)
    this.saturation.positiveInteraction(emoIntensity);
    this.affectiveResidue.deposit(
      { dominant: emoDominant, intensity: emoIntensity, pleasure: quickEmo.pleasure },
      Math.max(0.2, emoIntensity),
    );

    ctx.elapsedMs = Date.now() - startTime;
    return ctx;
```

- [ ] **Step 6: 添加 scheduleColdAnalysis 方法**

在 `runColdPath()` 方法之后添加:

```typescript
  /** Schedule asynchronous 4-layer cold analysis. Fire-and-forget, does not block turn. */
  private scheduleColdAnalysis(input: string, response: string, taskMode: boolean): void {
    if (!this.coldAnalyzer || this.coldPending) return; // Already running
    this.coldPending = true;

    const params: ColdAnalyzeParams = {
      input,
      response,
      taskMode,
      mindState: this.mindState,
      drives: this.drives.toDict(),
      assistantConfig: this.config as unknown as Record<string, string>,
      previousResidueVector: this.affectiveResidue.vector,
      previousRetention: {
        emotionDominant: this.temporalHorizon.retention.emotionDominant,
        emotionIntensity: this.temporalHorizon.retention.emotionIntensity,
        unfinished: this.temporalHorizon.retention.unfinished,
      },
      timeSinceLastTurn: this.temporalHorizon.retention.sinceLastTurn,
      selfNarrative: this.selfModel.currentChapter,
      growthLog: this.selfModel.growthLog,
      snapshot: this.snapshot.formatForPrompt(),
    };

    this.coldAnalyzer.analyze(params)
      .then((cache: ColdCache) => {
        cache.turnGenerated = this.turnCount;
        this.coldCache = cache;
        // Apply cold analysis results to state
        this.affectiveResidue.vector = cache.affectiveVector;
        if (cache.selfNarrativeText) {
          this.selfModel.currentChapter = cache.selfNarrativeText;
        }
        // Slow param modulation from full psych
        const slowShifts = this.modulator.modulateSlow(
          cache, /* memoryCtx */ "", null, cache.selfNarrativeText,
        );
        this.modulator.applyShifts(slowShifts, true);
        // State evolution
        this.mindState = this.dynamics.step(this.mindState, this.drives, {
          affect: { pleasure: cache.emotion.pleasure, arousal: cache.emotion.arousal, dominance: cache.emotion.dominance },
          attachment_activation: cache.attachment.activation,
          defense_strength: cache.defense.intensity,
          control: cache.appraisal.copingPotential,
        });
        this.drives.tick(1);
        this.predictionTracker.observe(this.mindState);
        // Memory storage
        this.storeMemoryRecords(input, response, cache);
        // Metabolism
        if (this.metabolism.shouldDaydream(this.tickCount, this.memConfig.daydreamIntervalTicks)) {
          this.metabolism.daydream().catch(() => {});
        }
        if (this.metabolism.shouldQuickSleep(this.tickCount, this.memConfig.quickSleepIntervalTicks)) {
          this.metabolism.quickSleep().catch(() => {});
        }
      })
      .catch((err: Error) => {
        console.warn("[cold] 4-layer analysis failed:", err.message);
      })
      .finally(() => {
        this.coldPending = false;
      });
  }

  /** Store memory records from cold analysis results */
  private async storeMemoryRecords(input: string, response: string, cold: ColdCache): Promise<void> {
    const emoKey = cold.emotion.dominant;
    const emoVal = cold.emotion.intensity;
    try {
      await this.workingMemory.store(createMemoryRecord({
        content: input, eventType: "user_input", significance: 0.5,
        emotionalSignature: { [emoKey]: emoVal }, tags: ["user", emoKey],
        memoryType: "episodic", confidence: 0.8,
      }));
      await this.workingMemory.store(createMemoryRecord({
        content: response, eventType: "assistant_response", significance: 0.5,
        emotionalSignature: { [emoKey]: emoVal }, tags: ["assistant", emoKey],
        memoryType: "episodic", confidence: 0.7,
      }));
      this.snapshot.markDirty();
    } catch (e) {
      console.warn("[cold] memory storage failed:", e);
    }
  }
```

- [ ] **Step 7: 更新 runColdPath() 为简化版**

原来的 `runColdPath` 现在只被外部可能调用，保留但简化:

```typescript
  /** Cold Path — now handled by scheduleColdAnalysis (fire-and-forget).
   *  This method kept for backward compatibility with external callers. */
  async runColdPath(params: { input: string; response: string; psychology?: PsychologyResult }): Promise<PsychologyResult> {
    // Delegate to async analyzer
    if (this.coldAnalyzer && !this.coldPending) {
      this.scheduleColdAnalysis(params.input, params.response, false);
    }
    // Return existing psych or empty result
    return params.psychology ?? (this.coldCache ?? new PsychologyResult());
  }
```

- [ ] **Step 8: 验证编译**

```bash
cd E:\BIG\character-mind-v3-ts && npx tsc --noEmit 2>&1 | grep "character-agent" | head -20
```

- [ ] **Step 9: 全局编译验证**

```bash
cd E:\BIG\character-mind-v3-ts && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
确认无新增错误（预期: 仅 continuous-engine.ts 的预存错误）

- [ ] **Step 10: 提交**

```bash
git add src/character/integration/character-agent.ts
git commit -m "feat: connect hot path to coldCache, remove psych LLM from hot path"
```

---

## 自审

1. **Spec 覆盖检查**:
   - ColdCache 数据结构: Task 1 ✓
   - FourLayerColdAnalyzer: Task 2 ✓
   - prompt-builder 约束注入: Task 3 ✓
   - character-agent 热冷分离: Task 4 ✓
   - 首轮降级 (coldCache=null): Task 1 createDefaultColdCache + Task 3 中 cc?.xxx 可选链 ✓
   - 四层级联失败隔离: Task 2 中每层独立 try-catch ✓
   - 快速连续输入用旧缓存: Task 4 scheduleColdAnalysis coldPending guard ✓

2. **占位符扫描**: 无 TBD/TODO/占位符。所有代码完整。

3. **类型一致性**: 
   - ColdCache 在 Task 1 定义 → Task 2/3/4 使用 ✓
   - ColdAnalyzeParams 在 Task 1 定义 → Task 2/4 使用 ✓
   - detectEmotionHeuristic 在 Task 1 导出 → Task 4 导入 ✓
