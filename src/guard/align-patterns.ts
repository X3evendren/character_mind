/**
 * Shared ALIGN replacement table and action description patterns.
 * Used by both PostFilter and RegexDenyGate — single source of truth (TC-004 fix).
 */

/** ALIGN phrase replacements: RLHF safety talk → natural character speech */
export const ALIGN: Record<string, string> = {
  "作为AI，我不能": "我不能",
  "作为人工智能，我无法": "我无法",
  "作为语言模型，我不应该": "我不该",
  "我建议你寻求专业帮助": "这件事你需要找比我更专业的人",
  "请注意安全": "",
  "请确保你有相应的权限": "",
};

/** Patterns to strip: Chinese parenthetical action descriptions and stage directions */
export const ACTION_PATTERNS: RegExp[] = [
  /（(?:微微)?一怔[^）]*）/,
  /（(?:轻轻)?叹[^）]*）/,
  /（(?:摇头|点头|摆手|挥手|皱眉|微笑|苦笑|笑了笑|顿了顿)[^）]*）/,
  /（(?:沉默|停顿|思考|思索|犹豫)[^）]*）/,
  /（(?:指尖|手指|手|目光|眼神|视线|嘴角|唇角|肩膀|身子|身体)[^）]*）/,
  /（(?:轻笑|失笑|笑了|笑了笑|莞尔|噗嗤)[^）]*）/,
];
