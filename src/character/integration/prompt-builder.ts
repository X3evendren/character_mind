/** Prompt Builder — Hot Path only. Capabilities + GroundTruth first. No psychology narrative. */
import type { AssistantConfig } from "./config-loader";
import type { MindState } from "../mind/mind-state";
import type { FrozenSnapshot } from "../memory/snapshot";
import type { FeedbackLoop } from "../learning/feedback-loop";
import type { SkillLibrary } from "../learning/skill-library";
import type { GroundTruth } from "../state/ground-truth";
import type { ColdCache } from "./cold-analyzer";
import { formatGroundTruthForPrompt } from "../state/ground-truth";

export interface PromptContext {
  config: AssistantConfig;
  mindstate: MindState;
  capabilities: string;          // SelfModel.formatCapabilities()
  groundTruth: GroundTruth;      // Shared factual state
  snapshot: FrozenSnapshot;
  feedbackLoop: FeedbackLoop;
  skillLibrary: SkillLibrary;
  currentInput: string;
  taskMode: boolean;             // true = executing task, disable poetic mode
  emotionDominant?: string;      // Lightweight emotion label only
  emotionIntensity?: number;
  affectiveResidueText?: string; // Layer 0: passive emotional sediment from AffectiveResidue
  driveBiasText?: string;        // Layer 1: drive sublimation — attention bias
  selfNarrativeText?: string;    // Layer 1: SelfModel narrative — current self-state
  temporalHorizonText?: string;  // Layer 1: Temporal horizon — retention echo
  isFirstTurn?: boolean;         // First turn of session — agent should NOT pretend to remember past
  // ── 新增: Cold Cache + quick emotion ──
  coldCache: ColdCache | null;
  quickEmotion?: { dominant: string; intensity: number; pleasure: number };
}

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

export function buildUserPrompt(input: string, taskMode: boolean): string {
  if (taskMode) {
    return `【用户输入 — 任务模式，请简洁准确】\n${input}`;
  }
  return `【用户输入】\n${input}`;
}
