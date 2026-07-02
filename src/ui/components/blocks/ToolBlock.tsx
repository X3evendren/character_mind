/**
 * ToolBlock — 工具调用，inline 单行 + 可折叠输出。
 * 图标 + 工具名 + 参数摘要 + ✓/✗ + 耗时。
 * 完成且有 toolResult 时显示 [+] 可展开查看输出。
 */
import React, { useState } from "react";
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

/** 提取工具参数摘要(短文本) */
function getToolDetail(toolName: string | undefined, args: Record<string, unknown> | undefined): string {
  if (!toolName || !args) return "";
  if (toolName === "exec_command") return (args.command as string)?.slice(0, 60) ?? "";
  if (toolName === "read_file" || toolName === "write_file" || toolName === "edit_file")
    return (args.path as string)?.slice(0, 60) ?? "";
  if (toolName === "search_content") return (args.pattern as string)?.slice(0, 40) ?? "";
  if (toolName === "web_search") return (args.query as string)?.slice(0, 40) ?? "";
  if (toolName === "web_fetch") return (args.url as string)?.slice(0, 40) ?? "";
  return "";
}

export const ToolBlock = React.memo(function ToolBlock({ block }: { block: Block }) {
  const c = useThemeStore((s) => s.theme).colors;
  const icon = TOOL_ICONS[block.toolName ?? ""] ?? "⚙";
  const isRunning = block.status === "streaming";
  const hasResult = block.status === "done" && block.toolResult && block.toolResult.length > 0;
  const [expanded, setExpanded] = useState(false);

  const detail = getToolDetail(block.toolName, block.toolArgs);

  return React.createElement(
    Box,
    { flexDirection: "column", paddingLeft: 2 },
    // 主行:图标 + 工具名 + 摘要 + 状态
    React.createElement(
      Box,
      { flexDirection: "row" },
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
      // 有输出时显示折叠提示
      hasResult
        ? React.createElement(
            Text,
            { color: c.textDim, dimColor: true },
            ` ${expanded ? "[-]" : "[+]"}`,
          )
        : null,
    ),
    // 展开:工具输出(截断到 200 字符)
    hasResult && expanded
      ? React.createElement(
          Box,
          { paddingLeft: 4, marginTop: 0 },
          React.createElement(
            Text,
            { color: c.textDim, dimColor: true },
            `  ${block.toolResult!.slice(0, 200)}${block.toolResult!.length > 200 ? "…" : ""}`,
          ),
        )
      : null,
  );
});