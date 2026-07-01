import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { useAgentStore } from "../../stores/agent-store";
import { ProgressBar } from "../../widgets/ProgressBar";

export function Tab1_Overview() {
  const theme = useThemeStore((s) => s.theme);
  const snap = useAgentStore((s) => s.snapshot);

  if (!snap) {
    return React.createElement(Text, { color: theme.colors.textDim }, "  等待初始化...");
  }

  const homeo = snap.homeostatic;
  const pad = snap.pad;
  const mood = snap.mood;
  const allostaticLoad = homeo.allostaticLoad;
  const saturation = snap.saturation;
  const regulation = snap.regulation;

  // Map PAD values from [-1, 1] to [0, 1] for progress bar display
  const padToNorm = (v: number) => (v + 1) / 2;

  // Top moods (highest intensity)
  const moodEntries = Object.entries(mood)
    .filter(([k]) => k !== "paniGrief" && k !== "fatigue")
    .sort(([, a], [, b]) => b - a);

  return React.createElement(Box, { flexDirection: "column" },
    // Homeostatic section
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "稳态"),
    React.createElement(ProgressBar, { label: "energy", value: homeo.energy, max: homeo.setPoints.energy, width: 8 }),
    React.createElement(ProgressBar, { label: "arousal", value: homeo.arousal, max: homeo.setPoints.arousal, width: 8 }),
    React.createElement(ProgressBar, { label: "safety", value: homeo.safety, max: homeo.setPoints.safety, width: 8 }),
    React.createElement(ProgressBar, { label: "conn", value: homeo.connection, max: homeo.setPoints.connection, width: 8 }),
    React.createElement(ProgressBar, { label: "mastry", value: homeo.mastery, max: homeo.setPoints.mastery, width: 8 }),

    React.createElement(Text, null, " "),

    // PAD section
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "PAD"),
    pad
      ? React.createElement(Box, { flexDirection: "column" },
          React.createElement(ProgressBar, { label: "pleas.", value: padToNorm(pad.pleasure), max: 1, width: 8 }),
          React.createElement(ProgressBar, { label: "arouse", value: padToNorm(pad.arousal), max: 1, width: 8 }),
          React.createElement(ProgressBar, { label: "domin.", value: padToNorm(pad.dominance), max: 1, width: 8 }),
        )
      : React.createElement(Text, { color: theme.colors.textDim }, "  未计算"),

    React.createElement(Text, null, " "),

    // Allostatic load + Saturation
    React.createElement(ProgressBar, { label: "allost", value: allostaticLoad, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "satur.", value: saturation, max: 1, width: 8 }),

    React.createElement(Text, { color: theme.colors.textDim },
      `  reg: ${regulation.strategy}${regulation.breakdown ? "!" : ""}`,
    ),

    React.createElement(Text, null, " "),

    // Top moods
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "情绪"),
    ...moodEntries.slice(0, 4).map(([k, v]) =>
      React.createElement(Text, { key: k, color: theme.colors.text },
        `  ${k.padEnd(10)} ${v >= 0.5 ? ">>" : "  "} ${v.toFixed(2)}`,
      ),
    ),
  );
}
