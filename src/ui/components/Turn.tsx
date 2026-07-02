/**
 * Turn — 单轮对话渲染。
 * 用户消息: ┃ 你 + 时间
 * assistant 执行: │ ▎第N轮 · 耗时 · token + blocks[] + stateBadge
 * 生成中: header 显示 spinner + "生成中..."
 */
import React, { useState } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useChatStore } from "../stores/chat-store";
import { Spinner } from "./Spinner";
import { FinalBlock } from "./blocks/FinalBlock";
import { ReasoningBlock } from "./blocks/ReasoningBlock";
import { ToolBlock } from "./blocks/ToolBlock";
import { ErrorBlock } from "./blocks/ErrorBlock";
import type { Turn as TurnType } from "../stores/chat-store";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function Turn({ turn, isLast }: { turn: TurnType; isLast: boolean }) {
  const c = useThemeStore((s) => s.theme).colors;
  const isGenerating = useChatStore((s) => s.isGenerating);
  const isStreaming = isGenerating && isLast && turn.status === "streaming";
  const [badgeExpanded, setBadgeExpanded] = useState(false);

  // 用户消息
  const userTime = formatTime(turn.userMessage.timestamp);

  // Turn header
  const turnHeader = isStreaming
    ? React.createElement(
        Box,
        { flexDirection: "row" },
        React.createElement(Spinner, { active: true }),
        React.createElement(Text, { color: c.textDim }, ` 第${turn.turnId + 1}轮 · 生成中...`),
      )
    : React.createElement(
        Box,
        { flexDirection: "row" },
        React.createElement(Text, { color: c.success }, "✓"),
        React.createElement(
          Text,
          { color: c.textDim },
          ` 第${turn.turnId + 1}轮${turn.elapsedMs ? ` · ${(turn.elapsedMs / 1000).toFixed(1)}秒` : ""}${turn.totalTokens ? ` · ${turn.totalTokens}词` : ""}`,
        ),
      );

  return React.createElement(
    Box,
    { flexDirection: "column", marginBottom: 1 },
    // 用户消息
    React.createElement(
      Box,
      { flexDirection: "row" },
      React.createElement(Text, { color: c.accent, bold: true }, "┃ 你 "),
      React.createElement(Text, { color: c.textDim, dimColor: true }, userTime),
    ),
    React.createElement(Text, { color: c.text }, `  ${turn.userMessage.content}`),

    // assistant 执行区
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      // Turn header
      React.createElement(Text, { color: c.primary, bold: true }, `  ▎`),
      React.createElement(
        Box,
        { flexDirection: "row", paddingLeft: 2 },
        turnHeader,
        React.createElement(Text, { color: c.textDim, dimColor: true }, `  ${formatTime(turn.timestamp)}`),
      ),

      // Blocks
      ...turn.blocks.map((block) => {
        switch (block.type) {
          case "final":
            return React.createElement(FinalBlock, {
              key: block.id,
              block,
              isStreaming: isStreaming && block.status === "streaming",
            });
          case "reasoning":
            return React.createElement(ReasoningBlock, { key: block.id, block });
          case "tool_call":
            return React.createElement(ToolBlock, { key: block.id, block });
          case "error":
            return React.createElement(ErrorBlock, { key: block.id, block });
          default:
            return null;
        }
      }),

      // State badge (折叠)
      turn.stateBadge?.pad
        ? React.createElement(
            Box,
            { paddingLeft: 2, marginTop: 0 },
            React.createElement(
              Text,
              {
                color: c.textDim,
                dimColor: true,
              },
              `  ${badgeExpanded ? "[-]" : "[+]"} 愉快${turn.stateBadge.pad.pleasure >= 0 ? "+" : ""}${turn.stateBadge.pad.pleasure.toFixed(2)} 唤醒${turn.stateBadge.pad.arousal >= 0 ? "+" : ""}${turn.stateBadge.pad.arousal.toFixed(2)}`,
            ),
          )
        : null,
    ),
  );
}
