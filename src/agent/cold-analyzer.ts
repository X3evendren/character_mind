/** Cold Path cache — consumed by Hot Path on the next turn. */
import { PsychologyResult, EmotionResult, AppraisalResult, MotivationResult, AttachmentResult, DefenseResult, RelationResult } from "../mind/psychology-engine";
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
    const prompt = `你是情感底色感知器。基于以下信息，输出1句话中文+4个数值。

当前底色: warmth=${params.previousResidueVector.warmth.toFixed(2)} weight=${params.previousResidueVector.weight.toFixed(2)} clarity=${params.previousResidueVector.clarity.toFixed(2)} tension=${params.previousResidueVector.tension.toFixed(2)}
用户说: ${params.input.slice(0, 200)}
你回复: ${params.response.slice(0, 300)}

请严格按以下格式输出(只输出下面4行,不要其他内容):
<text>这里写1句话中文，描述这次互动后心中的底色，用第一人称"你"开头</text>
<warmth>0.60</warmth>
<weight>0.45</weight>
<clarity>0.30</clarity>
<tension>0.35</tension>`;

    const resp = await this.psychProvider.chat(
      [{ role: "user", content: prompt }], 0.3, 1500, undefined, "",
    );
    const raw = resp.content ?? "";

    const textMatch = raw.match(/<text>(.*?)<\/text>/s);
    const text = textMatch ? textMatch[1].trim().slice(0, 120) : "";

    const parse = (tag: string): number => {
      const m = raw.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
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

    if (secondsSince > 300 && prevEmo.emotionIntensity < 0.3) return "";

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
      [{ role: "user", content: prompt }], 0.3, 600, undefined, "",
    );
    const raw = (resp.content ?? "").trim();
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
      [{ role: "user", content: prompt }], 0.4, 800, undefined, "",
    );
    const raw = (resp.content ?? "").trim();
    if (!raw || raw === "" || raw.includes("无变化")) return params.selfNarrative;
    return raw.slice(0, 200);
  }
}
