import React from "react";
import { Text, Box } from "ink";
import { useTheme } from "../../theme/context";
import { useAgentSnapshot } from "../../agent-state";
import { ProgressBar } from "../../widgets/ProgressBar";
import { Heatmap } from "../../widgets/Heatmap";

export function Tab2_Details() {
  const theme = useTheme();
  const snap = useAgentSnapshot();

  if (!snap) {
    return React.createElement(Text, { color: theme.colors.textDim }, "  等待初始化...");
  }

  const mood = snap.mood;
  const drives = snap.drives;
  const bisbas = snap.bisbas;

  // 14D mood as heatmap items
  const moodItems: Array<{ label: string; value: number }> = [
    { label: "euthymic", value: mood.euthymic },
    { label: "irritable", value: mood.irritable },
    { label: "anxious", value: mood.anxious },
    { label: "vital", value: mood.vital },
    { label: "warm", value: mood.warm },
    { label: "confident", value: mood.confident },
    { label: "grateful", value: mood.grateful },
    { label: "proud", value: mood.proud },
    { label: "curious", value: mood.curious },
    { label: "hopeful", value: mood.hopeful },
    { label: "awed", value: mood.awed },
    { label: "playful", value: mood.playful },
    { label: "paniGrief", value: mood.paniGrief },
    { label: "fatigue", value: mood.fatigue },
  ];

  // Drives as progress bars (top 5 by magnitude)
  const driveEntries = Object.entries(drives)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return React.createElement(Box, { flexDirection: "column" },
    // 14D Mood Heatmap
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "心境 (14D)"),
    React.createElement(Heatmap, { items: moodItems, width: 6 }),

    React.createElement(Text, null, " "),

    // Drives
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "驱力"),
    ...driveEntries.map(([k, v]) =>
      React.createElement(ProgressBar, {
        key: k,
        label: k.slice(0, 6),
        value: v,
        max: 1,
        width: 8,
      }),
    ),

    React.createElement(Text, null, " "),

    // BIS/BAS dual bars
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "BIS/BAS"),
    bisbas
      ? React.createElement(Box, { flexDirection: "column" },
          React.createElement(ProgressBar, { label: "BIS", value: bisbas.bisActivation, max: 1, width: 8 }),
          React.createElement(ProgressBar, { label: "BAS", value: bisbas.basActivation, max: 1, width: 8 }),
          React.createElement(ProgressBar, { label: "Go", value: bisbas.goSignal, max: 1, width: 8 }),
          React.createElement(ProgressBar, { label: "NoGo", value: bisbas.noGoSignal, max: 1, width: 8 }),
          bisbas.threatSignals.length > 0
            ? React.createElement(Text, { color: theme.colors.warning },
                `  threats: ${bisbas.threatSignals.length}`,
              )
            : null,
        )
      : React.createElement(Text, { color: theme.colors.textDim }, "  未计算"),
  );
}
