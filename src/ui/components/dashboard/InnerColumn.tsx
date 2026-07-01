/**
 * 内心列 — 角色内部状态（情绪/稳态/心境/无聊/饱和/调节）。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { useAgentStore } from "../../stores/agent-store";
import { EmotionWheel } from "../../widgets/EmotionWheel";
import { MoodMatrix } from "../../widgets/MoodMatrix";
import { ProgressBar } from "../../widgets/ProgressBar";

function SectionTitle({ title }: { title: string }) {
  const c = useThemeStore((s) => s.theme).colors;
  return React.createElement(Text, { color: c.primary, bold: true }, `▎${title}`);
}

export function InnerColumn() {
  const snap = useAgentStore((s) => s.snapshot);
  const c = useThemeStore((s) => s.theme).colors;

  if (!snap) {
    return React.createElement(Text, { color: c.textDim }, "  加载中...");
  }

  return React.createElement(Box, { flexDirection: "column", width: 20 },
    React.createElement(SectionTitle, { title: "情绪" }),
    React.createElement(EmotionWheel, { pad: snap.pad }),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "稳态" }),
    React.createElement(ProgressBar, { label: "能量", value: snap.homeostatic.energy, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "唤醒", value: snap.homeostatic.arousal, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "安全", value: snap.homeostatic.safety, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "连接", value: snap.homeostatic.connection, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "掌控", value: snap.homeostatic.mastery, max: 1, width: 8 }),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "心境" }),
    React.createElement(MoodMatrix, { mood: snap.mood, topN: 6 }),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "无聊" }),
    React.createElement(Text, { color: c.textDim }, "  参与度数据待接入"),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "饱和度" }),
    React.createElement(ProgressBar, { label: "饱和", value: snap.saturation, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "异稳态", value: snap.homeostatic.allostaticLoad, max: 1, width: 8 }),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "调节" }),
    React.createElement(Text, { color: c.text },
      `  策略: ${snap.regulation.strategy === "breakdown" ? "崩溃" : "重评"}${snap.regulation.breakdown ? " ⚠" : ""}`),
  );
}