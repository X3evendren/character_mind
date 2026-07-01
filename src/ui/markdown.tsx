/**
 * renderMarkdown — markdown → React 节点（Ink 原生 Text props 着色）。
 * 替代旧 markdown.ts 的 ANSI 转义字符串方案（Ink 不解析内嵌 ANSI）。
 * 着色走 theme，不硬编码终端色。
 */
import React from "react";
import { Text } from "ink";
import type { ThemeConfig } from "./theme/types";

export function renderMarkdown(md: string, theme: ThemeConfig): React.ReactNode[] {
  const c = theme.colors;
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      nodes.push(
        React.createElement(
          Text,
          {
            key: `code-${i}`,
            dimColor: true,
            backgroundColor: c.surface,
          },
          ` ${line} `,
        ),
      );
      continue;
    }
    if (line.startsWith("# ")) {
      nodes.push(
        React.createElement(
          Text,
          { key: `h-${i}`, bold: true, color: c.secondary },
          line.slice(2),
        ),
      );
      continue;
    }
    if (line.startsWith("> ")) {
      nodes.push(
        React.createElement(
          Text,
          { key: `quote-${i}`, dimColor: true, color: c.textDim },
          `│ `,
          ...renderInline(line.slice(2), c),
        ),
      );
      continue;
    }
    if (/^[\-\*] /.test(line)) {
      nodes.push(
        React.createElement(
          Text,
          { key: `li-${i}`, color: c.text },
          React.createElement(Text, { color: c.accent }, "  • "),
          renderInline(line.slice(2), c),
        ),
      );
      continue;
    }
    if (line.trim() === "") {
      nodes.push(React.createElement(Text, { key: `empty-${i}` }, ""));
      continue;
    }
    nodes.push(
      React.createElement(
        Text,
        { key: `p-${i}`, color: c.text },
        renderInline(line, c),
      ),
    );
  }
  return nodes;
}

/** 内联格式：**加粗** / *斜体* / `代码` */
function renderInline(
  text: string,
  c: ThemeConfig["colors"],
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // **加粗**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // *斜体*
    const italicMatch = remaining.match(/\*(.+?)\*/);
    // `代码`
    const codeMatch = remaining.match(/`(.+?)`/);

    // 找最早出现的匹配
    const matches = [
      { match: boldMatch, type: "bold" as const },
      { match: italicMatch, type: "italic" as const },
      { match: codeMatch, type: "code" as const },
    ].filter((m) => m.match && m.match.index !== undefined);

    if (matches.length === 0) {
      nodes.push(React.createElement(Text, { key: `t-${key++}` }, remaining));
      break;
    }

    matches.sort((a, b) => a.match!.index! - b.match!.index!);
    const first = matches[0];

    // 前面的普通文本
    if (first.match!.index! > 0) {
      nodes.push(
        React.createElement(
          Text,
          { key: `t-${key++}` },
          remaining.slice(0, first.match!.index!),
        ),
      );
    }

    const content = first.match![1];
    if (first.type === "bold") {
      nodes.push(
        React.createElement(
          Text,
          { key: `b-${key++}`, bold: true, color: c.secondary },
          content,
        ),
      );
    } else if (first.type === "italic") {
      nodes.push(
        React.createElement(
          Text,
          { key: `i-${key++}`, italic: true },
          content,
        ),
      );
    } else {
      nodes.push(
        React.createElement(
          Text,
          { key: `c-${key++}`, dimColor: true, backgroundColor: c.surface },
          content,
        ),
      );
    }

    remaining = remaining.slice(first.match!.index! + first.match![0].length);
  }

  return nodes;
}