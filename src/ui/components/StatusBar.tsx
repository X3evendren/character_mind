import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useAgentStore } from "../stores/agent-store";
import { useChatStore } from "../stores/chat-store";

/**
 * StatusBar — Chinese emotion summary line:
 * `林雨 第42轮  愉快+0.42 唤醒+0.18 掌控-0.10  饱和0.31  ⠹生成中`
 *
 * PAD (Pleasure/Arousal/Dominance) shown with Chinese labels and forced +/- sign.
 * Braille spinner fragment indicates generation in progress.
 */
export function StatusBar({
  agentName,
  notificationCount: _notificationCount = 0,
}: {
  agentName: string;
  /** Reserved for MainLayout compat; unused in new layout. */
  notificationCount?: number;
}) {
  const c = useThemeStore((s) => s.theme).colors;
  const snap = useAgentStore((s) => s.snapshot);
  const isGenerating = useChatStore((s) => s.isGenerating);

  const pad = snap?.pad ?? null;
  const sign = (v: number) => (v >= 0 ? "+" : "");
  const padText = pad
    ? `愉快${sign(pad.pleasure)}${pad.pleasure.toFixed(2)} 唤醒${sign(pad.arousal)}${pad.arousal.toFixed(2)} 掌控${sign(pad.dominance)}${pad.dominance.toFixed(2)}`
    : "情绪--";
  const sat = snap ? `饱和${snap.saturation.toFixed(2)}` : "";
  const turn = snap ? `第${snap.turnCount}轮` : "";
  const status = isGenerating ? "⠹生成中" : "";

  return React.createElement(
    Box,
    { flexDirection: "row", flexShrink: 0 },
    React.createElement(Text, { color: c.primary, bold: true }, ` ${agentName} `),
    React.createElement(Text, { color: c.textDim }, ` ${turn}  `),
    React.createElement(Text, { color: c.accent }, ` ${padText}  `),
    React.createElement(Text, { color: c.textDim }, ` ${sat}  `),
    status ? React.createElement(Text, { color: c.warning }, ` ${status}`) : null,
  );
}