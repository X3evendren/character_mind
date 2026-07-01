import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../../stores/theme-store";
import { useAgentStore } from "../../stores/agent-store";
import { ProgressBar } from "../../widgets/ProgressBar";

export function Tab3_Relationships() {
  const theme = useThemeStore((s) => s.theme);
  const snap = useAgentStore((s) => s.snapshot);

  if (!snap) {
    return React.createElement(Text, { color: theme.colors.textDim }, "  等待初始化...");
  }

  const mem = snap.memory;
  const rel = snap.relationship;
  const nar = snap.narrative;

  return React.createElement(Box, { flexDirection: "column" },
    // Memory statistics
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "记忆"),
    React.createElement(Text, { color: theme.colors.text },
      `  WM:    ${mem.wm}`,
    ),
    React.createElement(Text, { color: theme.colors.text },
      `  STM:   ${mem.stm}`,
    ),
    React.createElement(Text, { color: theme.colors.text },
      `  LTM:   ${mem.ltm}`,
    ),
    React.createElement(Text, { color: theme.colors.text },
      `  Core:  ${mem.core}`,
    ),
    React.createElement(Text, { color: theme.colors.text },
      `  Arch:  ${mem.archive}`,
    ),

    React.createElement(Text, null, " "),

    // Relationship dimensions
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "关系"),
    React.createElement(ProgressBar, { label: "trust", value: rel.trust, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "fam.", value: rel.familiarity, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "avoid", value: rel.avoidance, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "ambiv.", value: rel.ambivalence, max: 1, width: 8 }),

    React.createElement(Text, null, " "),

    // Narrative themes
    React.createElement(Text, { bold: true, color: theme.colors.secondary }, "叙事主题"),
    React.createElement(ProgressBar, { label: "agency", value: nar.agency, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "commun", value: nar.communion, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "redemp", value: nar.redemption, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "contam", value: nar.contamination, max: 1, width: 8 }),
    React.createElement(ProgressBar, { label: "mean.", value: nar.meaning, max: 1, width: 8 }),
  );
}
