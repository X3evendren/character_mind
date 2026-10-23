/** Patterns to strip: Chinese parenthetical action descriptions and stage directions */
export const ACTION_PATTERNS: RegExp[] = [
  /（(?:微微)?一怔[^）]*）/,
  /（(?:轻轻)?叹[^）]*）/,
  /（(?:摇头|点头|摆手|挥手|皱眉|微笑|苦笑|笑了笑|顿了顿)[^）]*）/,
  /（(?:沉默|停顿|思考|思索|犹豫)[^）]*）/,
  /（(?:指尖|手指|手|目光|眼神|视线|嘴角|唇角|肩膀|身子|身体)[^）]*）/,
  /（(?:轻笑|失笑|笑了|笑了笑|莞尔|噗嗤)[^）]*）/,
];
