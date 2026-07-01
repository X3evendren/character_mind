import React, { useRef, useEffect } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useAgentSnapshot } from "../agent-state";
import { Sparkline } from "../widgets/Sparkline";

const HISTORY_MAX = 20;

export function DashboardHeader() {
  const theme = useThemeStore((s) => s.theme);
  const snapshot = useAgentSnapshot();
  const historyRef = useRef<number[]>([]);

  // Accumulate saturation history whenever snapshot updates
  useEffect(() => {
    if (snapshot) {
      const vals = historyRef.current;
      vals.push(snapshot.saturation);
      if (vals.length > HISTORY_MAX) vals.splice(0, vals.length - HISTORY_MAX);
    }
  }, [snapshot]);

  const name = snapshot?.agentName ?? "林雨";
  const turnCount = snapshot?.turnCount ?? 0;
  const satHistory = historyRef.current;

  return React.createElement(Box, { flexDirection: "column" },
    React.createElement(Box, { flexDirection: "row" },
      React.createElement(Text, { bold: true, color: theme.colors.primary }, name),
      React.createElement(Text, { color: theme.colors.textDim }, `  t${turnCount}`),
    ),
    satHistory.length >= 2
      ? React.createElement(Sparkline, { data: satHistory, width: 18, label: "sat" })
      : React.createElement(Text, { color: theme.colors.textDim }, "sat ..."),
  );
}
