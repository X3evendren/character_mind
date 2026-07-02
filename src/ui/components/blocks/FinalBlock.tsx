/**
 * FinalBlock — 助手最终回复，markdown 渲染 + 流式光标动画。
 * 生成中时末尾显示闪烁 ▌ 光标(500ms 切换)，不增减行数(防移位)。
 */
import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { renderMarkdown } from "../../markdown";
import type { Block } from "../../stores/chat-store";

export function FinalBlock({ block, isStreaming }: { block: Block; isStreaming: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }
    const t = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, [isStreaming]);

  const nodes = renderMarkdown(block.content, theme);

  return React.createElement(
    Box,
    { flexDirection: "column", paddingLeft: 2 },
    ...nodes.map((node, i) => React.createElement(Box, { key: i }, node)),
    // 流式光标:追加在内容末尾，固定高度不增行
    isStreaming
      ? React.createElement(
          Text,
          { color: theme.colors.secondary },
          cursorVisible ? "▌" : " ",
        )
      : null,
  );
}
