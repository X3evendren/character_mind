/**
 * Narrative Identity — autobiographical reasoning + life story construction.
 *
 * Based on McAdams' 3-level personality model (traits → adaptations → life story).
 *
 * The agent maintains an evolving narrative identity through:
 *   1. Self-defining memories (events that shaped who the agent is)
 *   2. Self-event connections (explain/dismiss/cause/reveal — McLean & Fournier 2008)
 *   3. Thematic coherence (agency, communion, redemption, contamination, meaning)
 *   4. Self-continuity (past→present→future bridge)
 *
 * ALL reasoning is LLM-driven. No regex, no rule-based extraction.
 *
 * Shadow mechanism (Xapagy-inspired):
 *   Current event → search similar past events →
 *   "Last time something like this happened, what followed?" →
 *   Predictive signal for threat detection / hope
 *
 * McAdams (2006) temporal distinction:
 *   - Event recording: every deep reflection (rupture/breakdown/pre_sleep)
 *   - Narrative reconstruction: every ~30 days or after rupture events
 *   - These are two distinct processes — event recording captures what happened;
 *     narrative reconstruction weaves events into a coherent life story.
 *     The narrativePredictionError function bridges them: when an event's
 *     implied thematic strength diverges from current self-view, it signals
 *     that narrative reconstruction is needed sooner than the 30-day cycle.
 */

import { extractJSON, clamp } from "../utils";
import type { IProvider } from "../agent/provider";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SelfEventConnection = "explain" | "dismiss" | "cause" | "reveal";
export type ContentCategory = "disposition" | "value" | "outlook" | "growth";

export interface SelfDefiningMemory {
  eventSummary: string;
  selfEventConnection: SelfEventConnection;
  contentCategory: ContentCategory;
  emotionalIntensity: number;
  integrationLevel: number;   // 0–1: how integrated into life story
  keyInsight: string;
  createdAt: number;
}

export interface NarrativeTheme {
  type: "agency" | "communion" | "redemption" | "contamination" | "meaning";
  content: string;
  strength: number;           // 0–1
  exemplarEvents: string[];   // event summaries that support this theme
}

export interface NarrativeCoherence {
  temporalCoherence: number;
  causalCoherence: number;
  thematicCoherence: number;
  culturalCoherence: number;
}

export interface SelfContinuity {
  pastToPresent: number;
  presentToFuture: number;
  disruptions: Array<{
    event: string;
    description: string;
    resolved: boolean;
  }>;
}

export interface NarrativeIdentity {
  themes: NarrativeTheme[];
  definingMemories: SelfDefiningMemory[];
  coherence: NarrativeCoherence;
  selfContinuity: SelfContinuity;
  lastReasonedAt: number;
}

export interface ShadowResult {
  /** The similar past event found */
  pastEvent: string;
  /** What followed that event */
  consequence: string;
  /** Similarity to current situation */
  similarity: number;
  /** Implication for current situation */
  implication: string;
}

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════

/**
 * Compute narrative prediction error — the gap between current theme strength
 * and the thematic strength implied by a new event.
 *
 * |current_theme_strength − event_implied_strength|
 *
 * High error → narrative reconstruction is needed sooner than the ~30-day
 * default cycle (McAdams 2006). Acts as a signal that the current life story
 * is out of sync with recent experiences.
 *
 * Used by deep reflection to decide whether a rupture/breakdown event
 * should trigger immediate narrative reconstruction.
 */
export function narrativePredictionError(
  currentThemeStrength: number,
  eventImpliedStrength: number,
): number {
  return Math.abs(currentThemeStrength - eventImpliedStrength);
}

// ═══════════════════════════════════════════════════════════════
// Main class
// ═══════════════════════════════════════════════════════════════

export class NarrativeIdentitySystem {
  private identity: NarrativeIdentity;
  private provider: IProvider;

  constructor(provider: IProvider) {
    this.provider = provider;
    this.identity = {
      themes: [],
      definingMemories: [],
      coherence: {
        temporalCoherence: 0.7,
        causalCoherence: 0.6,
        thematicCoherence: 0.5,
        culturalCoherence: 0.8,
      },
      selfContinuity: {
        pastToPresent: 0.7,
        presentToFuture: 0.6,
        disruptions: [],
      },
      lastReasonedAt: 0,
    };
  }

  get state(): NarrativeIdentity {
    return this.identity;
  }

  // ── Core: Autobiographical Reasoning ──

  /**
   * Full autobiographical reasoning pipeline.
   * Called during Deep Reflection (Rupture/Breakdown/PreSleep).
   *
   * Steps:
   *   1. Event construction — pick the most important recent event
   *   2. Self-event linking — how does this event connect to self?
   *   3. Meaning extraction — what does this reveal?
   *   4. Theme update — does this change any themes?
   *   5. Coherence check — does this affect self-continuity?
   */
  async reason(
    recentEvents: string[],
    currentSelfView: string,
    reflectionType: "rupture" | "breakdown" | "pre_sleep" | "periodic",
  ): Promise<{
    newMemory: SelfDefiningMemory | null;
    themeChanges: NarrativeTheme[];
    coherenceDelta: Partial<NarrativeCoherence>;
    narrativeText: string;
  }> {
    const prompt = `
## 你最近经历的事情
${recentEvents.map((e, i) => `${i + 1}. ${e}`).join("\n")}

## 你目前对自己的认识
${currentSelfView}

## 反思类型
${reflectionType}

## 任务
从最近的事情中，选一件对你来说最重要的。
然后告诉我：这件事和你是谁有什么关联？

四种关联方式：
- explain: 这件事体现了你已有的特质
- dismiss: 虽然发生了，但这不代表真正的你
- cause: 这件事改变了你
- reveal: 这件事让你发现了你不知道的自己的一面

## 输出 JSON
{
  "selectedEvent": "简短描述最重要的事件",
  "connection": "explain|dismiss|cause|reveal",
  "category": "disposition|value|outlook|growth",
  "keyInsight": "这件事让你学到了什么关于自己的",
  "emotionalIntensity": 0.5,
  "importanceLevel": 0.5,
  "themeChanges": [{"type": "agency|communion|redemption|contamination|meaning", "content": "...", "strengthChange": 0.1}],
  "coherenceImpact": {"temporal": 0, "causal": 0, "thematic": 0, "cultural": 0},
  "narrativeText": "用1-2句话描述这次反思的核心发现"
}`;

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.4, 1024,
      );
      const result = JSON.parse(extractJSON(resp.content));

      const newMemory: SelfDefiningMemory | null = result.selectedEvent ? {
        eventSummary: result.selectedEvent,
        selfEventConnection: result.connection ?? "reveal",
        contentCategory: result.category ?? "growth",
        emotionalIntensity: result.emotionalIntensity ?? 0.5,
        integrationLevel: result.importanceLevel ?? 0.5,
        keyInsight: result.keyInsight ?? "",
        createdAt: Date.now(),
      } : null;

      // Store
      if (newMemory) {
        this.identity.definingMemories.push(newMemory);
        if (this.identity.definingMemories.length > 50) {
          this.identity.definingMemories = this.identity.definingMemories.slice(-30);
        }
      }

      // Update themes (capped at 20 to prevent unbounded growth)
      const themeChanges: NarrativeTheme[] = (result.themeChanges ?? []).map((tc: any) => {
        const existing = this.identity.themes.find(t => t.type === tc.type && t.content === tc.content);
        if (existing) {
          existing.strength = clamp(existing.strength + (tc.strengthChange ?? 0), 0, 1);
          return existing;
        }
        const newTheme: NarrativeTheme = {
          type: tc.type,
          content: tc.content,
          strength: clamp(Math.abs(tc.strengthChange ?? 0.1), 0, 1),
          exemplarEvents: newMemory ? [newMemory.eventSummary] : [],
        };
        this.identity.themes.push(newTheme);
        return newTheme;
      });
      // Prune weakest themes if over limit
      if (this.identity.themes.length > 20) {
        this.identity.themes.sort((a, b) => b.strength - a.strength);
        this.identity.themes = this.identity.themes.slice(0, 20);
      }

      // Update coherence
      const cd = result.coherenceImpact ?? {};
      this.identity.coherence.temporalCoherence  = clamp(this.identity.coherence.temporalCoherence  + (cd.temporal  ?? 0), 0, 1);
      this.identity.coherence.causalCoherence    = clamp(this.identity.coherence.causalCoherence    + (cd.causal    ?? 0), 0, 1);
      this.identity.coherence.thematicCoherence  = clamp(this.identity.coherence.thematicCoherence  + (cd.thematic  ?? 0), 0, 1);
      this.identity.coherence.culturalCoherence  = clamp(this.identity.coherence.culturalCoherence  + (cd.cultural  ?? 0), 0, 1);

      this.identity.lastReasonedAt = Date.now();

      return {
        newMemory,
        themeChanges,
        coherenceDelta: cd,
        narrativeText: result.narrativeText ?? "",
      };
    } catch {
      return { newMemory: null, themeChanges: [], coherenceDelta: {}, narrativeText: "" };
    }
  }

  // ── Shadow Mechanism ──

  /**
   * Find similar past events and their consequences.
   * "Last time something like this happened, what followed?"
   */
  async findShadow(
    currentEvent: string,
    pastEvents: string[],
  ): Promise<ShadowResult | null> {
    const prompt = `
## 当前发生的事
${currentEvent}

## 过去的经历
${pastEvents.map((e, i) => `${i + 1}. ${e}`).join("\n")}

## 任务
你的过去经历中，有没有和当前事件最相似的？
如果有，那次事件之后发生了什么？
这对现在有什么启示？

## 输出 JSON
{
  "found": true或false,
  "pastEvent": "最相似的过去事件",
  "consequence": "那次事件之后发生了什么",
  "similarity": 0.5,
  "implication": "对现在的启示"
}`;

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.3, 512,
      );
      const result = JSON.parse(extractJSON(resp.content));
      if (!result.found) return null;

      return {
        pastEvent: result.pastEvent,
        consequence: result.consequence,
        similarity: result.similarity ?? 0.5,
        implication: result.implication,
      };
    } catch {
      return null;
    }
  }

  // ── Self-View Assembly ──

  /**
   * Build a natural-language description of the current self-view.
   * This is injected into the system prompt as "关于你自己你知道什么".
   */
  buildSelfView(): string {
    const parts: string[] = [];

    // Strongest themes
    const strongThemes = this.identity.themes
      .filter(t => t.strength > 0.4)
      .sort((a, b) => b.strength - a.strength);

    if (strongThemes.length > 0) {
      parts.push("关于你自己，你知道:");
      for (const t of strongThemes.slice(0, 5)) {
        const label = {
          agency: "你是行动者",
          communion: "关系对你很重要",
          redemption: "你相信困难会让你成长",
          contamination: "你有时觉得好的东西会被毁掉",
          meaning: "你的意义感",
        }[t.type];
        parts.push(`- ${label}: ${t.content}`);
      }
    }

    // Key defining memories
    const keyMemories = this.identity.definingMemories
      .filter(m => m.integrationLevel > 0.5)
      .slice(-3);

    if (keyMemories.length > 0) {
      parts.push("\n塑造你的关键经历:");
      for (const m of keyMemories) {
        parts.push(`- ${m.eventSummary} → ${m.keyInsight}`);
      }
    }

    // Coherence snapshot
    const c = this.identity.coherence;
    const avgCoherence = (c.temporalCoherence + c.causalCoherence + c.thematicCoherence + c.culturalCoherence) / 4;
    if (avgCoherence < 0.4) {
      parts.push('\n你目前对"我是谁"感到有些模糊。');
    }

    return parts.join("\n") || "你还在了解自己。";
  }

  // ── Snapshot / Restore ──

  snapshot(): NarrativeIdentity {
    return structuredClone(this.identity);
  }

  restore(state: NarrativeIdentity): void {
    this.identity = structuredClone(state);
  }
}

// Helpers: extractJSON, clamp imported from ../utils
