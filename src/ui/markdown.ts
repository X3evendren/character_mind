const CSI = "\x1b[";
const C = {
  bold: `${CSI}1m`, italic: `${CSI}3m`, dim: `${CSI}2m`, reset: `${CSI}0m`,
  codeBg: `${CSI}48;5;236m`, blockBorder: `${CSI}38;5;240m`,
};

export interface AnsiSpan {
  text: string;
  ansi: string;
}

export function renderMarkdown(md: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const lines = md.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) {
      spans.push({ text: line, ansi: `${C.dim}${C.codeBg} ${line} ${C.reset}` });
      continue;
    }
    if (line.startsWith("# ")) {
      spans.push({ text: line.slice(2), ansi: `${C.bold}${line.slice(2)}${C.reset}` });
      continue;
    }
    if (line.startsWith("> ")) {
      spans.push({ text: line.slice(2), ansi: `${C.dim}│ ${line.slice(2)}${C.reset}` });
      continue;
    }
    if (/^[\-\*] /.test(line)) {
      spans.push({ text: line, ansi: `  • ${renderInline(line.slice(2))}` });
      continue;
    }
    spans.push({ text: line, ansi: renderInline(line) });
  }
  return spans;
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, `${C.bold}$1${C.reset}`)
    .replace(/\*(.+?)\*/g, `${C.italic}$1${C.reset}`)
    .replace(/`(.+?)`/g, `${C.dim}${C.codeBg}$1${C.reset}`);
}
