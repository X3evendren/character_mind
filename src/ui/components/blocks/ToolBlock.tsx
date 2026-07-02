/**
 * ToolBlock — 工具调用，inline 单行显示。
 * 图标 + 工具名 + 参数摘要 + ✓/✗ + 耗时。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import type { Block } from "../../stores/chat-store";

const TOOL_ICONS: Record<string, string> = {
  read_file: "📄",
  exec_command: "$",
  search_files: "🔍",
  search_content: "🔎",
  write_file: "✎",
  edit_file: "✐",
  web_fetch: "🌐",
  web_search: "🔎",
};

export const ToolBlock = React.memo(function ToolBlock({ block }: { block: Block }) {
  const c = useThemeStore((s) => s.theme).colors;
  const icon = TOOL_ICONS[block.toolName ?? ""] ?? "⚙";
  const isRunning = block.status === "streaming";

  const detail =
    block.toolName === "exec_command"
      ? (block.toolArgs?.command as string)?.slice(0, 60)
      : block.toolName === "read_file"
        ? (block.toolArgs?.path as string)?.slice(0, 60)
        : block.toolName === "write_file"
          ? (block.toolArgs?.path as string)?.slice(0, 60)
          : "";

  return React.createElement(
    Box,
    { flexDirection: "row", paddingLeft: 2 },
    React.createElement(Text, { color: c.secondary }, `  ${icon} ${block.toolName ?? "tool"} `),
    React.createElement(Text, { color: c.textDim }, detail),
    isRunning
      ? React.createElement(Text, { color: c.warning }, " ⠹")
      : React.createElement(
          Text,
          { color: block.toolSuccess ? c.success : c.error },
          ` ${block.toolSuccess ? "✓" : "✗"}`,
        ),
    block.durationMs
      ? React.createElement(Text, { color: c.textDim }, ` ${(block.durationMs / 1000).toFixed(1)}秒`)
      : null,
  );
});
