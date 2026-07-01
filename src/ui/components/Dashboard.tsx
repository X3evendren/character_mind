/**
 * 仪表盘 — 双列分区，无 tab，固定分区，全中文。
 * 左列内心状态 | 右列人际关系，同步翻页。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { InnerColumn } from "./dashboard/InnerColumn";
import { OuterColumn } from "./dashboard/OuterColumn";

export function Dashboard() {
  const c = useThemeStore((s) => s.theme).colors;

  return React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
    React.createElement(Text, { color: c.primary, bold: true }, "  仪表盘"),
    React.createElement(Text, { color: c.textDim }, "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"),
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Box, { flexDirection: "column", width: 20 },
        React.createElement(InnerColumn, null),
      ),
      React.createElement(Text, { color: c.textDim }, "│"),
      React.createElement(Box, { flexDirection: "column", width: 20 },
        React.createElement(OuterColumn, null),
      ),
    ),
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  Ctrl+J/K 翻页"),
  );
}