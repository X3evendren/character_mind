import React from "react";
import { Text } from "ink";
import { useThemeStore } from "../stores/theme-store";

const TOOL_ICONS: Record<string, string> = {
  read_file: "📄", exec_command: "$", search_files: "🔍", search_content: "🔎",
  write_file: "✎", edit_file: "✐", web_fetch: "🌐", web_search: "🔎",
};

export function ToolCallCard({ tool, args, success, outputPreview, durationMs }: {
  tool: string; args: Record<string, unknown>; success: boolean; outputPreview: string; durationMs: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const icon = TOOL_ICONS[tool] ?? "↳";
  const detail = tool === "exec_command" ? (args.command as string)?.slice(0, 60)
    : tool === "read_file" ? (args.path as string)?.slice(0, 60)
    : tool === "write_file" ? (args.path as string)?.slice(0, 60)
    : "";
  return React.createElement(Text, { color: theme.colors.textDim },
    React.createElement(Text, { color: theme.colors.secondary }, `  ${icon} ${tool} `),
    React.createElement(Text, null, detail),
    React.createElement(Text, { color: success ? theme.colors.success : theme.colors.error }, ` ${success ? "✓" : "✗"}`),
    React.createElement(Text, null, ` ${outputPreview.slice(0, 40)} · ${durationMs}ms`),
  );
}
