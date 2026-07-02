import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useAgentStore } from "../stores/agent-store";

/**
 * StatusBar — simplified Chinese emotion summary line:
 * ` 第N轮   愉快+0.42 唤醒+0.18 掌控-0.10   饱和0.31  `
 *
 * The spinner / "生成中" status now lives in the per-turn Turn header
 * within the chat area, so this bar keeps only the round count, PAD
 * summary, and saturation.
 */
export const StatusBar = React.memo(function StatusBar({ agentName: _agentName = "", notificationCount: _notificationCount = 0 }: {
  agentName?: string;
  notificationCount?: number;
}) {
  const c = useThemeStore((s) => s.theme).colors;
  const snap = useAgentStore((s) => s.snapshot);

  const pad = snap?.pad ?? null;
  const sign = (v: number) => (v >= 0 ? "+" : "");
  const padText = pad
    ? `愉快${sign(pad.pleasure)}${pad.pleasure.toFixed(2)} 唤醒${sign(pad.arousal)}${pad.arousal.toFixed(2)} 掌控${sign(pad.dominance)}${pad.dominance.toFixed(2)}`
    : "情绪--";
  const sat = snap ? `饱和${snap.saturation.toFixed(2)}` : "";
  const turn = snap ? `第${snap.turnCount}轮` : "";

  return React.createElement(Box, { flexDirection: "row", flexShrink: 0 },
    React.createElement(Text, { color: c.textDim }, ` ${turn}  `),
    React.createElement(Text, { color: c.accent }, ` ${padText}  `),
    React.createElement(Text, { color: c.textDim }, ` ${sat}  `),
  );
});
