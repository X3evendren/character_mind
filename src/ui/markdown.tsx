/**
 * renderMarkdown — markdown → React 节点（Ink 原生 Text props 着色）。
 * 使用 marked.lexer 解析为 token 流,渲染为 Ink 元素。
 * LRU 缓存:按 md+theme name 做 key,避免每次 delta 全量重解析。
 */
import React from "react";
import { Text, Box } from "ink";
import { marked } from "marked";
import type { Tokens } from "marked";
import type { ThemeConfig } from "./theme/types";

type Token = Tokens.Generic;

const MD_CACHE_MAX = 64;
const mdCache = new Map<string, React.ReactNode[]>();

export function renderMarkdown(md: string, theme: ThemeConfig): React.ReactNode[] {
  const cacheKey = `${theme.name}::${md}`;
  const cached = mdCache.get(cacheKey);
  if (cached) {
    // LRU: 移到末尾(最近使用)
    mdCache.delete(cacheKey);
    mdCache.set(cacheKey, cached);
    return cached;
  }
  const result = renderMarkdownImpl(md, theme);
  if (mdCache.size >= MD_CACHE_MAX) {
    const firstKey = mdCache.keys().next().value;
    if (firstKey) mdCache.delete(firstKey);
  }
  mdCache.set(cacheKey, result);
  return result;
}

function renderMarkdownImpl(md: string, theme: ThemeConfig): React.ReactNode[] {
  const c = theme.colors;
  try {
    const tokens = marked.lexer(md);
    return tokens.map((token, i) => renderToken(token, i, c));
  } catch {
    // 解析失败时回退为纯文本
    return [React.createElement(Text, { key: "fallback", color: c.text }, md)];
  }
}

function renderToken(token: Token, i: number, c: ThemeConfig["colors"]): React.ReactNode {
  switch (token.type) {
    case "heading": {
      const t = token as Tokens.Heading;
      return React.createElement(Text, { key: `h-${i}`, bold: true, color: c.secondary }, t.text);
    }
    case "paragraph": {
      const t = token as Tokens.Paragraph;
      return React.createElement(Text, { key: `p-${i}`, color: c.text }, ...renderInlineTokens(t.tokens ?? [], c));
    }
    case "blockquote": {
      const t = token as Tokens.Blockquote;
      const children = t.tokens?.map((child, j) => {
        const text = (child as Tokens.Paragraph).text ?? "";
        return React.createElement(Text, { key: `bq-${j}`, color: c.textDim, dimColor: true }, `│ ${text}`);
      }) ?? [];
      return React.createElement(Box, { key: `quote-${i}`, flexDirection: "column" }, ...children);
    }
    case "code": {
      const t = token as Tokens.Code;
      return React.createElement(Text, {
        key: `code-${i}`,
        dimColor: true,
        backgroundColor: c.surface,
      }, ` ${t.lang ? `${t.lang}: ` : ""}${t.text.split("\n").join(" ")} `);
    }
    case "list": {
      const t = token as Tokens.List;
      const items = t.items.map((item, j) => {
        const text = (item as Tokens.ListItem).text ?? "";
        return React.createElement(Text, { key: `li-${j}`, color: c.text },
          React.createElement(Text, { color: c.accent }, "  • "),
          React.createElement(Text, { color: c.text }, text),
        );
      });
      return React.createElement(Box, { key: `list-${i}`, flexDirection: "column" }, ...items);
    }
    case "hr": {
      return React.createElement(Text, { key: `hr-${i}`, color: c.textDim, dimColor: true }, "┄".repeat(20));
    }
    case "space": {
      return React.createElement(Text, { key: `sp-${i}` }, "");
    }
    case "table": {
      const t = token as Tokens.Table;
      const rows = [t.header, ...t.rows].map((row, ri) => {
        const cells = row.map((cell, ci) =>
          ci === 0
            ? React.createElement(Text, { key: `c-${ci}`, color: c.textDim }, cell.text.padEnd(12))
            : React.createElement(Text, { key: `c-${ci}`, color: c.text }, cell.text.padEnd(12)),
        );
        return React.createElement(Text, { key: `tr-${ri}` }, ...cells);
      });
      return React.createElement(
        Box, { key: `table-${i}`, flexDirection: "column" },
        React.createElement(Text, { color: c.textDim, dimColor: true }, `┌${"─".repeat(30)}┐`),
        ...rows,
        React.createElement(Text, { color: c.textDim, dimColor: true }, `└${"─".repeat(30)}┘`),
      );
    }
    default: {
      // 未知 token 类型 → 尝试提取 text
      const raw = (token as any).raw ?? "";
      if (raw) {
        return React.createElement(Text, { key: `raw-${i}`, color: c.text }, raw);
      }
      return React.createElement(Text, { key: `empty-${i}` }, "");
    }
  }
}

/** 渲染内联 token 数组（加粗/斜体/代码/链接/text） */
function renderInlineTokens(tokens: Token[], c: ThemeConfig["colors"]): React.ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case "strong": {
        const t = token as Tokens.Strong;
        return React.createElement(Text, { key: `s-${i}`, bold: true, color: c.secondary }, t.text);
      }
      case "em": {
        const t = token as Tokens.Em;
        return React.createElement(Text, { key: `e-${i}`, italic: true }, t.text);
      }
      case "codespan": {
        const t = token as Tokens.Codespan;
        return React.createElement(Text, {
          key: `cs-${i}`,
          dimColor: true,
          backgroundColor: c.surface,
        }, t.text);
      }
      case "link": {
        const t = token as Tokens.Link;
        const label = t.tokens?.length ? t.tokens.map(tok => (tok as Tokens.Text).text ?? "").join("") : t.text;
        return React.createElement(Text, { key: `lk-${i}`, color: c.primary }, label);
      }
      case "text": {
        const t = token as Tokens.Text;
        return React.createElement(Text, { key: `t-${i}`, color: c.text }, t.text);
      }
      case "del": {
        const t = token as Tokens.Del;
        return React.createElement(Text, { key: `d-${i}`, dimColor: true }, t.text);
      }
      case "br": {
        return React.createElement(Text, { key: `br-${i}` }, "\n");
      }
      default: {
        const raw = (token as any).raw ?? "";
        return React.createElement(Text, { key: `ux-${i}`, color: c.text }, raw);
      }
    }
  });
}