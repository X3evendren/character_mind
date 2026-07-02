/**
 * TurnList — 对话区，显示 Turn 列表，自动锁定到底部(最新)。
 * 替代旧 ChatArea。
 */
import React from "react";
import { Box, Text, useStdout } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useChatStore } from "../stores/chat-store";
import { Turn } from "./Turn";

export function TurnList() {
  const theme = useThemeStore((s) => s.theme);
  const turns = useChatStore((s) => s.turns);
  const { stdout } = useStdout();
  const rows = stdout?.rows ?? 24;

  if (turns.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", flexGrow: 1, paddingLeft: 1, justifyContent: "flex-end" },
      React.createElement(Text, { color: theme.colors.textDim, dimColor: true }, "  开始对话..."),
    );
  }

  // 底部增长:显示所有 turns(后续可加窗口滚动)
  // 留出空间给 header + input + footer
  const lastIndex = turns.length - 1;

  return React.createElement(
    Box,
    { flexDirection: "column", flexGrow: 1, paddingLeft: 1 },
    ...turns.map((turn, i) =>
      React.createElement(Turn, {
        key: turn.id,
        turn,
        isLast: i === lastIndex,
      }),
    ),
  );
}
