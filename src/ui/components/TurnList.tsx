/**
 * TurnList — 对话区，显示 Turn 列表，窗口滚动锁定到底部(最新)。
 * 只渲染最后能放入 maxRows 行的 turns，防止内容溢出导致输入框抖动。
 * scrollOffset > 0 时向上查看历史(Ctrl+↑/↓ 控制)。
 */
import React, { useMemo, useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useChatStore } from "../stores/chat-store";
import { Turn } from "./Turn";
import type { Turn as TurnType } from "../stores/chat-store";

/** 估算单个 Turn 占用的行数(粗略:用户消息2行 + header2行 + blocks行数 + 间距) */
function estimateTurnRows(turn: TurnType): number {
  let rows = 4; // 用户消息行(1) + 内容行(1) + 间距(1) + header(1)
  for (const block of turn.blocks) {
    if (block.type === "final") {
      const lineCount = block.content.split("\n").length;
      rows += Math.max(1, lineCount) + 1; // 内容行 + 流式光标行
    } else if (block.type === "reasoning") {
      rows += block.collapsed ? 1 : Math.max(1, block.content.split("\n").length) + 1;
    } else if (block.type === "tool_call") {
      rows += 1;
    } else if (block.type === "error") {
      rows += 1;
    }
  }
  if (turn.stateBadge?.pad) rows += 1; // badge 行
  return rows;
}

export function TurnList({ maxRows = 20, scrollOffset = 0 }: {
  maxRows?: number;
  scrollOffset?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const turns = useChatStore((s) => s.turns);

  // 从最新 turn 向前累计行数，只保留能放入 maxRows 的 turns。
  // scrollOffset > 0 时，从更早的位置开始截取(向上看历史)。
  const visibleTurns = useMemo(() => {
    if (turns.length === 0) return [];
    const result: TurnType[] = [];
    let usedRows = 0;
    // 从最新 turn 开始，跳过 scrollOffset 个 turn
    const startIndex = turns.length - 1 - scrollOffset;
    for (let i = startIndex; i >= 0; i--) {
      const turnRows = estimateTurnRows(turns[i]);
      if (usedRows + turnRows > maxRows && result.length > 0) break;
      result.unshift(turns[i]);
      usedRows += turnRows;
    }
    return result;
  }, [turns, maxRows, scrollOffset]);

  if (turns.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", height: maxRows, paddingLeft: 1, justifyContent: "flex-end" },
      React.createElement(Text, { color: theme.colors.textDim, dimColor: true }, "  开始对话..."),
    );
  }

  const lastIndex = visibleTurns.length - 1;

  return React.createElement(
    Box,
    { flexDirection: "column", height: maxRows, paddingLeft: 1, justifyContent: "flex-end", overflow: "hidden" },
    ...visibleTurns.map((turn, i) =>
      React.createElement(Turn, {
        key: turn.id,
        turn,
        isLast: i === lastIndex && scrollOffset === 0,
      }),
    ),
  );
}
