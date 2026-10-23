import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';

const segments = new Intl.Segmenter('zh', { granularity: 'grapheme' });
export const graphemes = (text: string) => [...segments.segment(text)].map(s => s.segment);
export const cellWidth = stringWidth;
/** Terminal controls from messages, tools and pasted text are data, never escape codes. */
export function safeText(text: string): string {
  return stripAnsi(String(text)).replace(/\r\n?/g, '\n').replace(/\t/g, '  ')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}
export function wrapText(text: string, width: number): string[] {
  width = Math.max(1, width);
  const result: string[] = [];
  for (const paragraph of safeText(text).split('\n')) {
    let line = '', used = 0;
    for (const segment of graphemes(paragraph)) {
      const size = stringWidth(segment);
      if (used + size > width && line) { result.push(line); line = ''; used = 0; }
      const part = size > width ? '?' : segment;
      line += part; used += stringWidth(part);
    }
    result.push(line);
  }
  return result;
}
export function fitText(text: string, width: number): string {
  const clean = safeText(text).replace(/\n/g, ' ');
  if (stringWidth(clean) <= width) return clean;
  return (wrapText(clean, Math.max(1, width - 1))[0] ?? '') + (width > 1 ? '…' : '');
}
export function sliceRows<T>(rows: T[], height: number, offset: number, fromEnd = true): T[] {
  const max = Math.max(0, rows.length - height);
  const bounded = Math.min(max, Math.max(0, offset));
  const start = fromEnd ? max - bounded : bounded;
  return rows.slice(start, start + height);
}
