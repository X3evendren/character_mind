/**
 * 关系列 — 角色↔用户外部关系（关系/叙事/心智理论/记忆）。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { useAgentStore } from "../../stores/agent-store";
import { RelationMap } from "../../widgets/RelationMap";
import { ProgressBar } from "../../widgets/ProgressBar";

function SectionTitle({ title }: { title: string }) {
  const c = useThemeStore((s) => s.theme).colors;
  return React.createElement(Text, { color: c.primary, bold: true }, `▎${title}`);
}

export function OuterColumn() {
  const snap = useAgentStore((s) => s.snapshot);
  const c = useThemeStore((s) => s.theme).colors;

  if (!snap) {
    return React.createElement(Text, { color: c.textDim }, "  加载中...");
  }

  return React.createElement(Box, { flexDirection: "column", width: 20 },
    React.createElement(SectionTitle, { title: "关系" }),
    React.createElement(RelationMap, { relationship: snap.relationship }),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "叙事" }),
    React.createElement(ProgressBar, { label: "代理感", value: snap.narrative.agency, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "共融感", value: snap.narrative.communion, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "救赎", value: snap.narrative.redemption, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "污染", value: snap.narrative.contamination, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "意义感", value: snap.narrative.meaning, max: 1, width: 8 }),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "心智理论" }),
    React.createElement(Text, { color: c.textDim }, "  用户信念/欲望/意图待接入"),
    React.createElement(Text, null),
    React.createElement(SectionTitle, { title: "记忆" }),
    React.createElement(Text, { color: c.text },
      `  工作${snap.memory.wm} 短期${snap.memory.stm}`),
    React.createElement(Text, { color: c.text },
      `  长期${snap.memory.ltm} 核心${snap.memory.core}`),
    React.createElement(Text, { color: c.textDim },
      `  归档${snap.memory.archive}`),
  );
}