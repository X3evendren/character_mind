import React, { useState, useCallback } from "react";
import { Text, Box, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";

/**
 * Cursor characters: block at end, vertical bar within text.
 * When `blinkOn` is false, the cursor is replaced with a space of identical
 * width so the line length never changes (no layout shift).
 */
function renderLineWithCursor(line: string, cursorCol: number, isActiveLine: boolean): string {
  if (!isActiveLine) return line || " ";
  const cursorChar = cursorCol >= line.length ? "█" : "▌";
  if (cursorCol >= line.length) return line + cursorChar; // full block (or space) at end
  return line.slice(0, cursorCol) + cursorChar + line.slice(cursorCol); // half-block within
}

/**
 * Parse a line and apply syntax highlighting spans.
 * Returns an array of { text, color } segments for Ink Text elements.
 */
function tokenizeLine(
  text: string,
  colors: { secondary: string; primary: string; text: string; textDim: string },
  cursorCol: number,
  isActiveLine: boolean,
): Array<{ text: string; color?: string; dimColor?: boolean }> {
  const result: Array<{ text: string; color?: string; dimColor?: boolean }> = [];

  // Patterns: /cmd, @mention, `code`
  const pattern = /(\/[a-zA-Z_]\w*|@[a-zA-Z_]\w*|`[^`]*`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Plain text before match
    if (match.index > lastIdx) {
      result.push({ text: text.slice(lastIdx, match.index), color: colors.text });
    }
    const token = match[0];
    if (token.startsWith("/")) {
      result.push({ text: token, color: colors.secondary });
    } else if (token.startsWith("@")) {
      result.push({ text: token, color: colors.primary });
    } else if (token.startsWith("`")) {
      result.push({ text: token, dimColor: true });
    } else {
      result.push({ text: token, color: colors.text });
    }
    lastIdx = pattern.lastIndex;
  }

  // Remaining plain text
  if (lastIdx < text.length) {
    result.push({ text: text.slice(lastIdx), color: colors.text });
  }

  return result;
}

export function MultilineEditor({
  onSubmit,
  onTextChange,
  maxLines = 6,
  placeholder = "输入消息...",
  disabled = false,
}: {
  onSubmit: (text: string) => void;
  onTextChange?: (text: string) => void;
  maxLines?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const [lines, setLines] = useState<string[]>([""]);
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);

  // 光标闪烁已移至 BlinkCursor 独立组件，避免 600ms setInterval 触发整个编辑器重渲染。

  const notifyTextChange = useCallback((newLines: string[]) => {
    if (onTextChange) {
      onTextChange(newLines.join("\n"));
    }
  }, [onTextChange]);

  const insertChar = useCallback((char: string) => {
    setLines(prev => {
      const next = [...prev];
      const line = next[cursorLine] ?? "";
      next[cursorLine] = line.slice(0, cursorCol) + char + line.slice(cursorCol);
      notifyTextChange(next);
      return next;
    });
    setCursorCol(c => c + char.length);
  }, [cursorCol, cursorLine, notifyTextChange]);

  const handleBackspace = useCallback(() => {
    setLines(prev => {
      const next = [...prev];
      if (cursorCol > 0) {
        const line = next[cursorLine] ?? "";
        next[cursorLine] = line.slice(0, cursorCol - 1) + line.slice(cursorCol);
        notifyTextChange(next);
        setCursorCol(c => c - 1);
      } else if (cursorLine > 0) {
        // Merge with previous line
        const prevLen = (next[cursorLine - 1] ?? "").length;
        next[cursorLine - 1] = (next[cursorLine - 1] ?? "") + (next[cursorLine] ?? "");
        next.splice(cursorLine, 1);
        notifyTextChange(next);
        setCursorLine(l => l - 1);
        setCursorCol(prevLen);
      }
      return next;
    });
  }, [cursorCol, cursorLine, notifyTextChange]);

  const handleDelete = useCallback(() => {
    setLines(prev => {
      const next = [...prev];
      const line = next[cursorLine] ?? "";
      if (cursorCol < line.length) {
        next[cursorLine] = line.slice(0, cursorCol) + line.slice(cursorCol + 1);
        notifyTextChange(next);
      } else if (cursorLine < next.length - 1) {
        // Merge with next line
        next[cursorLine] = line + (next[cursorLine + 1] ?? "");
        next.splice(cursorLine + 1, 1);
        notifyTextChange(next);
      }
      return next;
    });
  }, [cursorCol, cursorLine, notifyTextChange]);

  const handleNewline = useCallback(() => {
    setLines(prev => {
      const next = [...prev];
      const line = next[cursorLine] ?? "";
      const before = line.slice(0, cursorCol);
      const after = line.slice(cursorCol);
      next[cursorLine] = before;
      next.splice(cursorLine + 1, 0, after);
      notifyTextChange(next);
      return next;
    });
    setCursorLine(l => l + 1);
    setCursorCol(0);
  }, [cursorCol, cursorLine, notifyTextChange]);

  const submit = useCallback(() => {
    const text = lines.join("\n").trim();
    if (text) {
      onSubmit(text);
      setLines([""]);
      setCursorLine(0);
      setCursorCol(0);
      if (onTextChange) onTextChange("");
    }
  }, [lines, onSubmit, onTextChange]);

  useInput((input: string, key: any) => {
    if (disabled) return;

    if (key.return) {
      // Alt+Enter → newline; plain Enter → submit
      if (key.meta || key.alt) {
        if (lines.length < maxLines) {
          handleNewline();
        }
      } else {
        submit();
      }
      return;
    }

    if (key.backspace || (key.ctrl && input === "h")) {
      handleBackspace();
      return;
    }
    if (key.delete || (key.ctrl && input === "d")) {
      handleDelete();
      return;
    }

    if (key.leftArrow) {
      setCursorCol(c => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      const curLine = lines[cursorLine] ?? "";
      setCursorCol(c => Math.min(curLine.length, c + 1));
      return;
    }
    if (key.upArrow) {
      if (cursorLine > 0) {
        const newLine = cursorLine - 1;
        const targetLen = (lines[newLine] ?? "").length;
        setCursorLine(newLine);
        setCursorCol(Math.min(cursorCol, targetLen));
      }
      return;
    }
    if (key.downArrow) {
      if (cursorLine < lines.length - 1) {
        const newLine = cursorLine + 1;
        const targetLen = (lines[newLine] ?? "").length;
        setCursorLine(newLine);
        setCursorCol(Math.min(cursorCol, targetLen));
      }
      return;
    }
    if (key.home || (key.ctrl && input === "a")) {
      setCursorCol(0);
      return;
    }
    if (key.end || (key.ctrl && input === "e")) {
      setCursorCol((lines[cursorLine] ?? "").length);
      return;
    }

    // Printable characters
    if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
      insertChar(input);
    }
  });

  const displayLines = lines.length === 1 && lines[0] === ""
    ? [placeholder]
    : lines;

  // Render syntax-highlighted lines
  const isEmpty = lines.length === 1 && lines[0] === "";
  const tokenColors = {
    secondary: theme.colors.secondary,
    primary: theme.colors.primary,
    text: theme.colors.text,
    textDim: theme.colors.textDim,
  };

  return React.createElement(Box, { flexDirection: "column" },
    ...displayLines.map((line, i) => {
      const isActive = i === cursorLine;
      if (isEmpty) {
        return React.createElement(Text, {
          key: `line_${i}`,
          dimColor: true,
        }, `  ${renderLineWithCursor(line, cursorCol, isActive)}`);
      }
      const tokens = tokenizeLine(line, tokenColors, cursorCol, isActive);
      // Apply cursor to the token that contains the cursor position
      const rendered = applyCursorToTokens(tokens, cursorCol, isActive);
      return React.createElement(Text, { key: `line_${i}` },
        React.createElement(Text, { dimColor: true }, `> `),
        ...rendered.map((seg, j) =>
          React.createElement(Text, {
            key: j,
            color: seg.color,
            dimColor: seg.dimColor,
          }, seg.text),
        ),
      );
    }),
  );
}

/** Insert cursor character into tokenized line segments.
 *  When `blinkOn` is false the cursor char is a single space, preserving
 *  the line width (no layout shift). */
function applyCursorToTokens(
  tokens: Array<{ text: string; color?: string; dimColor?: boolean }>,
  cursorCol: number,
  isActiveLine: boolean,
): Array<{ text: string; color?: string; dimColor?: boolean }> {
  if (!isActiveLine) return tokens;

  let col = 0;
  const result: Array<{ text: string; color?: string; dimColor?: boolean }> = [];
  let inserted = false;

  for (const token of tokens) {
    if (inserted) {
      result.push(token);
      continue;
    }
    if (cursorCol >= col && cursorCol <= col + token.text.length) {
      const offset = cursorCol - col;
      const before = token.text.slice(0, offset);
      const after = token.text.slice(offset);
      const cursorChar = cursorCol >= col + token.text.length ? "█" : "▌";
      if (before) {
        result.push({ text: before, color: token.color, dimColor: token.dimColor });
      }
      result.push({ text: cursorChar + after, color: token.color, dimColor: token.dimColor });
      inserted = true;
    } else {
      result.push(token);
    }
    col += token.text.length;
  }

  // Cursor at end of all text
  if (!inserted && isActiveLine) {
    result.push({ text: "█", dimColor: false });
  }

  return result;
}
