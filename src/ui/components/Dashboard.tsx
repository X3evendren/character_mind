/**
 * 仪表盘 — 双列分区，无 tab，固定分区，全中文。
 * 左列内心状态 | 右列人际关系，同步翻页。
 */
import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { InnerColumn } from "./dashboard/InnerColumn";
import { OuterColumn } from "./dashboard/OuterColumn";

export function Dashboard() {
  const c = useThemeStore((s) => s.theme).colors;
  // Ctrl+J/K 键盘滚动偏移量（Ink 7 无鼠标 API，键盘为唯一翻页途径）。
  const [scrollY, setScrollY] = useState(0);

  // Ctrl+J 向下滚动 / Ctrl+K 向上滚动，下限钳制为 0。
  useInput((input, key) => {
    if (input === "j" && key.ctrl) setScrollY((y) => y + 1);
    if (input === "k" && key.ctrl) setScrollY((y) => Math.max(0, y - 1));
  });

  return React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
    React.createElement(Text, { color: c.primary, bold: true }, "  仪表盘"),
    React.createElement(Text, { color: c.textDim }, "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"),
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Box, { flexDirection: "column", width: 20 },
        React.createElement(InnerColumn, { scrollY }),
      ),
      React.createElement(Text, { color: c.textDim }, "│"),
      React.createElement(Box, { flexDirection: "column", width: 20 },
        React.createElement(OuterColumn, { scrollY }),
      ),
    ),
    React.createElement(Text, { color: c.textDim, dimColor: true },
      `  Ctrl+J/K 翻页${scrollY > 0 ? ` (第${scrollY}页)` : ""}`),
  );
}