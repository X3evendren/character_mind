/**
 * ErrorBlock — 错误消息显示。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import type { Block } from "../../stores/chat-store";

export function ErrorBlock({ block }: { block: Block }) {
  const c = useThemeStore((s) => s.theme).colors;
  return React.createElement(
    Box,
    { paddingLeft: 2 },
    React.createElement(Text, { color: c.error }, `  ✗ ${block.content}`),
  );
}
