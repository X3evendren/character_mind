/**
 * Personality System — bidirectional sync between prose and computed parameters.
 *
 *   assistant.md  ←→  assistant.personality.json
 *   (灵魂叙事)          (计算基元)
 *
 * On first run: L2 reads assistant.md, infers all numeric parameters,
 * writes assistant.personality.json.
 *
 * On subsequent runs: personality.json is the source of truth for
 * computation. assistant.md is the human-readable "soul description."
 *
 * When either changes → the other is regenerated.
 *
 * Deep Reflection can modify personality.json values.
 * When accumulated changes exceed threshold → "soul rewrite":
 * assistant.md is regenerated to reflect the evolved personality.
 */

import { extractJSON, clamp } from "../utils";
import type { IProvider } from "../agent/provider";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface PersonalityParameters {
  // Homeostatic setpoints
  energySetPoint: number;
  arousalSetPoint: number;
  safetySetPoint: number;
  connectionSetPoint: number;
  masterySetPoint: number;

  // Emotion regulation
  reappraisalAbility: number;
  suppressionTendency: number;
  situationModification: number;
  acceptanceTolerance: number;
  attentionalFlexibility: number;

  // Rumination
  ruminationVulnerability: number;
  abstractionBias: number;

  // Interoception
  interoceptivePrecisionBase: number;
  alexithymiaBaseline: number;

  // Threat sensitivity
  baselineThreatSensitivity: number;
  uncertaintyAversion: number;

  // Social behavior
  approachBias: number;
  avoidanceBias: number;

  // Expression
  expressiveness: number;
  verbosityBaseline: number;
  silenceBias: number;

  // Mood
  moodLability: number;
  positiveBias: number;

  // Attachment
  attachmentAnxiety: number;
  attachmentAvoidance: number;

  // Meta
  personalityVersion: number;
  lastSyncedAt: number;
  sourceFile: string; // "assistant.md"
}

export const DEFAULT_PERSONALITY: PersonalityParameters = {
  energySetPoint: 0.60,
  arousalSetPoint: 0.50,
  safetySetPoint: 0.60,
  connectionSetPoint: 0.65,
  masterySetPoint: 0.60,

  reappraisalAbility: 0.55,
  suppressionTendency: 0.35,
  situationModification: 0.50,
  acceptanceTolerance: 0.55,
  attentionalFlexibility: 0.50,

  ruminationVulnerability: 0.40,
  abstractionBias: 0.50,

  interoceptivePrecisionBase: 0.50,
  alexithymiaBaseline: 0.30,

  baselineThreatSensitivity: 0.40,
  uncertaintyAversion: 0.40,

  approachBias: 0.50,
  avoidanceBias: 0.40,

  expressiveness: 0.60,
  verbosityBaseline: 0.50,
  silenceBias: 0.30,

  moodLability: 0.40,
  positiveBias: 0.55,

  attachmentAnxiety: 0.35,
  attachmentAvoidance: 0.30,

  personalityVersion: 1,
  lastSyncedAt: 0,
  sourceFile: "assistant.md",
};

// ═══════════════════════════════════════════════════════════════
// Personality Manager
// ═══════════════════════════════════════════════════════════════

export class PersonalityManager {
  private _params: PersonalityParameters;
  private mdPath: string;
  private jsonPath: string;
  private provider: IProvider;

  constructor(configDir: string, provider: IProvider) {
    this.provider = provider;
    this.mdPath = resolve(configDir, "assistant.md");
    this.jsonPath = resolve(configDir, "assistant.personality.json");
    this._params = { ...DEFAULT_PERSONALITY };
  }

  /**
   * Initialize: load from JSON if exists, otherwise infer from Markdown.
   */
  async initialize(): Promise<PersonalityParameters> {
    if (existsSync(this.jsonPath)) {
      // Load computed parameters
      try {
        const raw = readFileSync(this.jsonPath, "utf-8");
        const loaded = JSON.parse(raw);
        this._params = { ...DEFAULT_PERSONALITY, ...loaded };
      } catch {
        // Corrupted → re-infer
        await this.inferFromMarkdown();
      }
    } else if (existsSync(this.mdPath)) {
      // First run: infer from prose
      await this.inferFromMarkdown();
    } else {
      // No files → save defaults
      this.saveJson();
    }

    return this._params;
  }

  /**
   * Infer personality parameters from assistant.md prose.
   * One-time LLM call.
   */
  async inferFromMarkdown(): Promise<void> {
    if (!existsSync(this.mdPath)) return;

    const prose = readFileSync(this.mdPath, "utf-8");
    if (!prose.trim()) return;

    const prompt = buildInferencePrompt(prose);

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.3, 2048,
      );
      const result = JSON.parse(extractJSON(resp.content));

      // Update params from LLM inference
      for (const key of Object.keys(DEFAULT_PERSONALITY) as Array<keyof PersonalityParameters>) {
        if (key === "personalityVersion" || key === "lastSyncedAt" || key === "sourceFile") continue;
        if (typeof result[key] === "number") {
          (this._params as any)[key] = clamp(result[key], 0, 1);
        }
      }

      this._params.personalityVersion = 1;
      this._params.lastSyncedAt = Date.now();
      this._params.sourceFile = "assistant.md";

      this.saveJson();
    } catch {
      // Inference failed → keep defaults
      this.saveJson();
    }
  }

  get paramsReadonly(): PersonalityParameters { return this._params; }

  /**
   * Apply parameter modifications from Deep Reflection.
   * Each modification is tiny (delta < 0.05).
   * Accumulated changes trigger soul rewrite.
   */
  applyReflectionModifications(
    modifications: Array<{ parameter: string; delta: number; rationale: string }>,
  ): Array<{ parameter: string; oldValue: number; newValue: number }> {
    const changes: Array<{ parameter: string; oldValue: number; newValue: number }> = [];

    for (const mod of modifications) {
      const key = mod.parameter as keyof PersonalityParameters;
      if (typeof (this._params as any)[key] !== "number") continue;

      const oldValue = (this._params as any)[key] as number;
      const clampedDelta = clamp(mod.delta, -0.05, 0.05); // small steps
      const newValue = clamp(oldValue + clampedDelta, 0, 1);

      (this._params as any)[key] = newValue;
      changes.push({ parameter: mod.parameter, oldValue, newValue });
    }

    if (changes.length > 0) {
      this._params.personalityVersion += 1;
      this._params.lastSyncedAt = Date.now();
      this.saveJson();
    }

    return changes;
  }

  /**
   * Trigger "soul rewrite" — regenerate assistant.md from current params.
   * Called when cumulative changes exceed threshold OR user manually triggers.
   */
  async rewriteSoul(): Promise<string> {
    const prose = existsSync(this.mdPath)
      ? readFileSync(this.mdPath, "utf-8")
      : "";

    const prompt = `
## 当前人格描述
${prose || "（无现有描述）"}

## 当前计算参数
${JSON.stringify(this._params, null, 2)}

## 任务
这个灵魂已经经历了一些成长和变化。
请更新 ta 的人格描述，反映这些变化。
保持原有风格，只在有变化的维度改写相关部分。
如果某些维度没有显著变化，保留原有描述。

在文档末尾追加一个 "## 成长印记" 部分，
用1-2句话描述ta的核心变化。`;

    try {
      const resp = await this.provider.chat(
        [{ role: "user", content: prompt }],
        0.4, 2048,
      );

      writeFileSync(this.mdPath, resp.content, "utf-8");
      this._params.lastSyncedAt = Date.now();
      this.saveJson();

      return resp.content;
    } catch {
      return prose;
    }
  }

  private saveJson(): void {
    const dir = dirname(this.jsonPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.jsonPath, JSON.stringify(this._params, null, 2), "utf-8");
  }

  snapshot(): PersonalityParameters {
    return { ...this._params };
  }

  restore(p: PersonalityParameters): void {
    this._params = { ...p };
  }
}

// ═══════════════════════════════════════════════════════════════
// Inference prompt
// ═══════════════════════════════════════════════════════════════

function buildInferencePrompt(prose: string): string {
  return `
## 人格描述
${prose}

## 任务
从以上人格描述中推理出以下计算参数（0–1之间的数值）：

1. energySetPoint: 活力基线 (高=精力充沛, 低=慵懒)
2. arousalSetPoint: 唤醒基线 (高=敏感警觉, 低=沉稳)
3. safetySetPoint: 安全感基线 (高=容易信任, 低=警觉防备)
4. connectionSetPoint: 社交基线 (高=亲密需求高, 低=独处型)
5. masterySetPoint: 效能感基线 (高=自信, 低=自疑)

6. reappraisalAbility: 认知重评能力
7. suppressionTendency: 表达抑制倾向
8. situationModification: 情境修正倾向
9. acceptanceTolerance: 接纳/容忍情绪的能力
10. attentionalFlexibility: 注意灵活性

11. ruminationVulnerability: 反刍易感性
12. abstractionBias: 抽象/具体加工偏差

13. interoceptivePrecisionBase: 内感受精度基线
14. alexithymiaBaseline: 述情障碍基线(对情绪不敏感)

15. baselineThreatSensitivity: 威胁敏感度基线
16. uncertaintyAversion: 不确定性厌恶

17. approachBias: 趋近偏置
18. avoidanceBias: 规避偏置

19. expressiveness: 表达强度
20. verbosityBaseline: 回复长度基线
21. silenceBias: 沉默偏置

22. moodLability: 心境波动性
23. positiveBias: 正面偏置

24. attachmentAnxiety: 依恋焦虑
25. attachmentAvoidance: 依恋回避

## 输出JSON
直接给JSON对象，包含以上所有参数。不需要注释。`;
}

// Helpers: extractJSON, clamp imported from ../utils
