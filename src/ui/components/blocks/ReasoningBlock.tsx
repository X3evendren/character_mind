/**
 * ReasoningBlock — 内心独白/冷分析，默认折叠，点击/按键展开。
 * 折叠时显示 [+] 内心独白，展开时显示内容。
 */
import React, { useState } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import type { Block } from "../../stores/chat-store";

export function ReasoningBlock({ block }: { block: Block }) {
  const c = useThemeStore((s) => s.theme).colors;
  const [expanded, setExpanded] = useState(!block.collapsed);

  return React.createElement(
    Box,
    { flexDirection: "column", paddingLeft: 2 },
    React.createElement(
      Text,
      {
        color: c.textDim,
        dimColor: true,
      },
      `${expanded ? "[-]" : "[+]"} 内心独白${block.summary ? ` · ${block.summary}` : ""}`,
    ),
    expanded && block.content
      ? React.createElement(Text, { color: c.textDim, dimColor: true }, `  ${block.content}`)
      : null,
  );
}
