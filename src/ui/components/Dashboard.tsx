/**
 * 仪表盘 — 精简/调试双模式。
 * 默认精简:3 核心指标(情绪 PAD + 饱和 + 调节) + 1 关系图。
 * 调试模式(Ctrl+G 或 /debug):展开内心/关系双列全量分区。
 */
import React from "react";
import { Text, Box, useInput } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useChatStore } from "../stores/chat-store";
import { useAgentStore } from "../stores/agent-store";
import { InnerColumn } from "./dashboard/InnerColumn";
import { OuterColumn } from "./dashboard/OuterColumn";
import { RelationMap } from "../widgets/RelationMap";
import { ProgressBar } from "../widgets/ProgressBar";

function SectionTitle({ title }: { title: string }) {
  const c = useThemeStore((s) => s.theme).colors;
  return React.createElement(Text, { color: c.primary, bold: true }, `▎${title}`);
}

export function Dashboard() {
  const c = useThemeStore((s) => s.theme).colors;
  const debugMode = useChatStore((s) => s.debugMode);
  const snap = useAgentStore((s) => s.snapshot);

  // Ctrl+G 切换调试/精简模式
  useInput((input, key) => {
    if (input === "g" && key.ctrl) {
      useChatStore.getState().toggleDebugMode();
    }
  });

  if (debugMode) {
    // 全量双列模式(现有布局)
    return React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
      React.createElement(Text, { color: c.primary, bold: true }, "  仪表盘 · 调试"),
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
    );
  }

  // 精简模式:3 核心指标 + 1 关系图
  if (!snap) {
    return React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
      React.createElement(Text, { color: c.textDim }, "  加载中..."),
    );
  }

  const pad = snap.pad;
  const sign = (v: number) => (v >= 0 ? "+" : "");
  const padText = pad
    ? `愉快${sign(pad.pleasure)}${pad.pleasure.toFixed(2)} 唤醒${sign(pad.arousal)}${pad.arousal.toFixed(2)} 掌控${sign(pad.dominance)}${pad.dominance.toFixed(2)}`
    : "情绪--";

  return React.createElement(Box, { flexDirection: "column", width: 42, flexShrink: 0 },
    React.createElement(Text, { color: c.primary, bold: true }, "  仪表盘"),
    React.createElement(Text, { color: c.textDim }, "  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"),
    // ▎状态(3 核心指标)
    React.createElement(SectionTitle, { title: "状态" }),
    React.createElement(Text, { color: c.accent }, `  ${padText}`),
    React.createElement(ProgressBar, { label: "饱和", value: snap.saturation, max: 1, width: 8 }),
    React.createElement(Text, { color: c.textDim }, `  ${snap.regulation.breakdown ? "崩溃 ⚠" : "重评"}`),
    React.createElement(Text, null),
    // ▎关系(1 关系图)
    React.createElement(SectionTitle, { title: "关系" }),
    React.createElement(RelationMap, { relationship: snap.relationship }),
  );
}
