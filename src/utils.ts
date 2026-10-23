/** Parse provider tool arguments; malformed JSON is validated by the tool registry. */
export function tryParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
