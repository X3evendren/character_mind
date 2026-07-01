/**
 * Deep Reflection — event-driven LLM deep analysis.
 *
 * Triggered by specific events (not timer ticks):
 *   Rupture: Safety δ < −0.4 + negative interpersonal event
 *   Breakdown: emotion regulation breakdown
 *   RuminationEnd: rumination naturally subsides after ≥ 5 turns
 *   StageChange: relationship stage transition
 *   PreSleep: automatic during sleep batch processing
 *   AllostaticPeak: allostatic load > 0.7 sustained
 *   SetpointDrift: setpoint drift > threshold
 *   Reunion: after absence > 72h
 *
 * Each reflection type has a focused prompt and tailored output schema.
 * Results are written to memory, modify personality.json, and adjust setpoints.
 */

import { extractJSON } from "../utils";
import type { IProvider } from "../agent/provider";
import type { MoodSnapshot } from "../mind/mood";
import type { PAD } from "../mind/cpm-pad";
import type { NarrativeIdentitySystem } from "../mind/narrative-identity";
import type { PersonalityManager } from "../personality/personality";
import type { ForceField } from "../mind/force-field";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ReflectionTrigger =
  | "rupture"
  | "breakdown"
  | "rumination_end"
  | "stage_change"
  | "pre_sleep"
  | "allostatic_peak"
  | "setpoint_drift"
  | "reunion";

export interface ReflectionEvent {
  trigger: ReflectionTrigger;
  urgency: number;               // 0–1
  eventDescription: string;
  context: ReflectionContext;
}

export interface ReflectionContext {
  recentDialog: string;
  relatedMemories: string[];
  currentMood: MoodSnapshot;
  currentPAD: PAD;
  currentSelfView: string;
  bisActivation: number;
  basActivation: number;
  allostaticLoad: number;
}

export interface DeepReflectionOutput {
  triggerType: ReflectionTrigger;
  narrative: string;
  selfInsight: {
    discoveredTrait: string;
    evidenceChain: string;
    confidenceChange: number;
  };
  otherInsight: {
    dimension: string;
    delta: number;
    evidence: string;
  } | null;
  behavioralAdjustments: Array<{
    trigger: string;
    currentBehavior: string;
    intendedBehavior: string;
    commitment: number;
  }>;
  parameterModifications: Array<{
    parameter: string;
    currentValue: number;
    proposedValue: number;
    delta: number;
    rationale: string;
  }>;
  relationshipUpdate: {
    field: string;
    fromValue: number | string;
    toValue: number | string;
    reason: string;
  } | null;
  unresolved: Array<{
    question: string;
    importance: number;
    carryOver: boolean;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// Event detection
// ═══════════════════════════════════════════════════════════════

export function detectReflectionEvents(
  safetyDelta: number,
  bisActivation: number,
  breakdownState: { inBreakdown: boolean; urge: number },
  ruminationIntensity: number,
  ruminationWasActive: boolean,
  relationshipStageChanged: boolean,
  allostaticLoad: number,
  allostaticLoadSustainedTicks: number,
  maxSetpointDrift: number,
  gapHours: number,
  fatigueFF: ForceField,
): ReflectionEvent[] {
  const events: ReflectionEvent[] = [];
  const fatigue = fatigueFF.value;

  // Rupture: safety crash + social threat
  if (safetyDelta < -0.4 && bisActivation > 0.6) {
    const urgency = Math.abs(safetyDelta) * 0.8 + bisActivation * 0.2;
    if (urgency > fatigue + 0.3) {
      events.push({
        trigger: "rupture",
        urgency,
        eventDescription: "安全感知急剧下降",
        context: createEmptyContext(),
      });
    }
  }

  // Breakdown: regulation collapse
  if (breakdownState.inBreakdown && breakdownState.urge > 0.9) {
    const urgency = 0.9;
    if (urgency > fatigue + 0.2) {
      events.push({
        trigger: "breakdown",
        urgency: 0.9,
        eventDescription: "情绪调节崩溅",
        context: createEmptyContext(),
      });
    }
  }

  // Rumination end
  if (ruminationWasActive && ruminationIntensity < 0.15) {
    events.push({
      trigger: "rumination_end",
      urgency: 0.5,
      eventDescription: "反刍自然消退",
      context: createEmptyContext(),
    });
  }

  // Stage change
  if (relationshipStageChanged) {
    events.push({
      trigger: "stage_change",
      urgency: 0.7,
      eventDescription: "关系阶段改变",
      context: createEmptyContext(),
    });
  }

  // Allostatic peak
  if (allostaticLoad > 0.7 && allostaticLoadSustainedTicks >= 3) {
    events.push({
      trigger: "allostatic_peak",
      urgency: allostaticLoad * 0.8,
      eventDescription: "异稳态负荷持续高位",
      context: createEmptyContext(),
    });
  }

  // Setpoint drift
  if (maxSetpointDrift > 0.08) {
    events.push({
      trigger: "setpoint_drift",
      urgency: maxSetpointDrift * 2,
      eventDescription: "稳态设定点显著漂移",
      context: createEmptyContext(),
    });
  }

  // Reunion
  if (gapHours > 72) {
    events.push({
      trigger: "reunion",
      urgency: Math.min(1, gapHours / 720),
      eventDescription: `久别重逢 (${gapHours.toFixed(0)}小时)`,
      context: createEmptyContext(),
    });
  }

  return events;
}

// ═══════════════════════════════════════════════════════════════
// Core: execute reflection
// ═══════════════════════════════════════════════════════════════

export async function executeReflection(
  provider: IProvider,
  event: ReflectionEvent,
  narrativeIdentity: NarrativeIdentitySystem,
  personality: PersonalityManager,
): Promise<DeepReflectionOutput> {
  const prompt = buildReflectionPrompt(event);

  try {
    const resp = await provider.chat(
      [{ role: "user", content: prompt }],
      0.3, 2048,
    );
    const result = JSON.parse(extractJSON(resp.content));

    const output: DeepReflectionOutput = {
      triggerType: event.trigger,
      narrative: result.narrative ?? "",
      selfInsight: {
        discoveredTrait: result.selfInsight?.discoveredTrait ?? "",
        evidenceChain: result.selfInsight?.evidenceChain ?? "",
        confidenceChange: result.selfInsight?.confidenceChange ?? 0,
      },
      otherInsight: result.otherInsight?.dimension ? {
        dimension: result.otherInsight.dimension,
        delta: result.otherInsight.delta ?? 0,
        evidence: result.otherInsight.evidence ?? "",
      } : null,
      behavioralAdjustments: (result.behavioralAdjustments ?? []).map((ba: any) => ({
        trigger: ba.trigger ?? "",
        currentBehavior: ba.currentBehavior ?? "",
        intendedBehavior: ba.intendedBehavior ?? "",
        commitment: ba.commitment ?? 0.5,
      })),
      parameterModifications: (result.parameterModifications ?? []).map((pm: any) => ({
        parameter: pm.parameter ?? "",
        currentValue: pm.currentValue ?? 0.5,
        proposedValue: pm.proposedValue ?? 0.5,
        delta: (pm.proposedValue ?? 0.5) - (pm.currentValue ?? 0.5),
        rationale: pm.rationale ?? "",
      })),
      relationshipUpdate: result.relationshipUpdate?.field ? {
        field: result.relationshipUpdate.field,
        fromValue: result.relationshipUpdate.fromValue,
        toValue: result.relationshipUpdate.toValue,
        reason: result.relationshipUpdate.reason ?? "",
      } : null,
      unresolved: (result.unresolved ?? []).map((u: any) => ({
        question: u.question ?? "",
        importance: u.importance ?? 0.5,
        carryOver: u.carryOver ?? false,
      })),
    };

    // Apply parameter modifications through personality system
    if (output.parameterModifications.length > 0) {
      personality.applyReflectionModifications(
        output.parameterModifications.map(pm => ({
          parameter: pm.parameter,
          delta: pm.delta,
          rationale: pm.rationale,
        }))
      );
    }

    return output;
  } catch {
    return emptyReflectionOutput(event.trigger);
  }
}

// ═══════════════════════════════════════════════════════════════
// Reflection prompts
// ═══════════════════════════════════════════════════════════════

function buildReflectionPrompt(event: ReflectionEvent): string {
  const ctx = event.context;

  const base = `
## 当前状态
心境: ${JSON.stringify(ctx?.currentMood)}
情绪: PAD(${ctx?.currentPAD?.pleasure?.toFixed(2)}, ${ctx?.currentPAD?.arousal?.toFixed(2)}, ${ctx?.currentPAD?.dominance?.toFixed(2)})
BIS: ${ctx?.bisActivation?.toFixed(2)}, BAS: ${ctx?.basActivation?.toFixed(2)}
异稳态负荷: ${ctx?.allostaticLoad?.toFixed(2)}

## 最近对话
${ctx?.recentDialog ?? ""}

## 相关记忆
${(ctx?.relatedMemories ?? []).join("\n")}

## 你的自我认知
${ctx?.currentSelfView ?? ""}`;

  const triggers: Record<ReflectionTrigger, string> = {
    rupture: `${base}

## Rupture 反思
你刚经历了一次关系裂痕：${event.eventDescription}

请思考：
1. 用户的哪个行为触发了你？这和你过去的哪个模式产生了共鸣？
2. 这次裂痕让你更了解自己的什么？
3. 下次类似情境出现时，你具体想怎么做？（必须是具体行为，不是抽象愿望）
4. 这次裂痕是否改变了你对ta的看法？`,

    breakdown: `${base}

## 崩溅反思
你的情绪调节崩溅了。你崩溃了。

请思考：
1. 为什么你的调节策略全部失效了？
2. 如果重新来，在哪一步可以做出不同选择？
3. 你的异稳态负荷现在是 ${ctx?.allostaticLoad?.toFixed(2)}，你需要什么来恢复？`,

    rumination_end: `${base}

## 反刍后反思
你刚才陷入了一段反刍，现在它消退了。

请思考：
1. 反刍的核心主题是什么？
2. 这个主题说明了你的什么？
3. 有什么是反刍中没有解决但现在可以看清的？`,

    stage_change: `${base}

## 关系阶段变化
你们的关系发生了变化。

请思考：
1. 这个变化意味着什么？
2. 你对这段关系的理解发生了什么改变？
3. 接下来你想怎么相处？`,

    pre_sleep: `${base}

## 今日终思
这是今天的最后反思。

请思考：
1. 今天最重要的一个时刻是什么？
2. 有什么悬而未决的情绪或问题？
3. 明天你想做到什么不同的事？`,

    allostatic_peak: `${base}

## 负荷峰值
你的异稳态负荷持续高位。你一直在承受压力。

请思考：
1. 最主要的压力来源是什么？
2. 有什么你一直在忽略的自我照顾需求？
3. 当下最需要做什么来恢复？`,

    setpoint_drift: `${base}

## 设定点漂移
你的基本设定点在改变。你正在变成不同的人。

请思考：
1. 哪些设定点在漂移？方向是什么？
2. 这是适应性的变化还是失调？
3. 这个新版本的你是谁？`,

    reunion: `${base}

## 久别重逢
你们分开了 ${event.eventDescription}。

请思考：
1. 这段时间没有ta，你变成了什么样？
2. ta对你来说意味着什么？
3. 你想怎么重新开始？`,
  };

  return (triggers[event.trigger] ?? triggers.rupture) + `

## 输出 JSON
{
  "narrative": "反思的完整叙事（1-3句）",
  "selfInsight": {"discoveredTrait": "...", "evidenceChain": "...", "confidenceChange": -0.5到0.5},
  "otherInsight": {"dimension": "...", "delta": -1到1, "evidence": "..."} or null,
  "behavioralAdjustments": [{"trigger": "触发情境", "currentBehavior": "现在的反应", "intendedBehavior": "想要的新反应", "commitment": 0.5}],
  "parameterModifications": [{"parameter": "参数名", "currentValue": 0.5, "proposedValue": 0.55, "rationale": "原因"}],
  "relationshipUpdate": {"field": "stage/trust", "fromValue": "...", "toValue": "...", "reason": "..."} or null,
  "unresolved": [{"question": "未解决的问题", "importance": 0.5, "carryOver": true/false}]
}`;
}

function createEmptyContext(): ReflectionContext {
  return {
    recentDialog: "",
    relatedMemories: [],
    currentMood: {
      euthymic: 0.5, irritable: 0.3, anxious: 0.3, vital: 0.5,
      warm: 0.5, confident: 0.5, grateful: 0.5, proud: 0.4,
      curious: 0.5, hopeful: 0.5, awed: 0.4, playful: 0.5,
      paniGrief: 0.1, fatigue: 0,
    },
    currentPAD: { pleasure: 0, arousal: 0, dominance: 0 },
    currentSelfView: "",
    bisActivation: 0,
    basActivation: 0,
    allostaticLoad: 0,
  };
}

function emptyReflectionOutput(trigger: ReflectionTrigger): DeepReflectionOutput {
  return {
    triggerType: trigger,
    narrative: "",
    selfInsight: { discoveredTrait: "", evidenceChain: "", confidenceChange: 0 },
    otherInsight: null,
    behavioralAdjustments: [],
    parameterModifications: [],
    relationshipUpdate: null,
    unresolved: [],
  };
}
