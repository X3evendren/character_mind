import React from "react";
import { Text, Box } from "ink";
import { useTheme } from "../theme/context";
import { useAgentSnapshot } from "../agent-state";

export function StatusBar({
  agentName,
  notificationCount,
}: {
  agentName: string;
  notificationCount: number;
}) {
  const theme = useTheme();
  const snap = useAgentSnapshot();

  const turnCount = snap?.turnCount ?? 0;
  const saturation = snap?.saturation ?? 0;
  const allostaticLoad = snap?.homeostatic?.allostaticLoad ?? 0;

  const bell = notificationCount > 0 ? "🔔" : " ";

  return React.createElement(
    Box,
    { flexDirection: "row", flexShrink: 0 },
    // Left: agent name + turn
    React.createElement(Text, { bold: true, color: theme.colors.primary }, ` ${agentName}`),
    React.createElement(Text, { color: theme.colors.textDim }, ` #${turnCount}`),

    // Spacer
    React.createElement(Text, null, " "),

    // Middle: saturation + allostatic load
    React.createElement(Text, { color: theme.colors.textDim },
      `sat:${saturation.toFixed(2)}`,
    ),
    React.createElement(Text, null, " "),
    React.createElement(Text, { color: allostaticLoad > 0.7 ? theme.colors.warning : theme.colors.textDim },
      `load:${allostaticLoad.toFixed(2)}`,
    ),

    // Spacer
    React.createElement(Box, { flexGrow: 1 }),

    // Right: notification bell
    React.createElement(Text, { color: notificationCount > 0 ? theme.colors.secondary : theme.colors.textDim },
      ` ${bell} `,
    ),

    // Separator line
    React.createElement(Text, { color: theme.colors.textDim }, "─".repeat(3)),
  );
}
