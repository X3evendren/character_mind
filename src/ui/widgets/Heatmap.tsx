import React from "react";
import { Text } from "ink";
import { useThemeStore } from "../stores/theme-store";

export function Heatmap({ items, width = 10 }: {
  items: Array<{ label: string; value: number }>; width?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  return React.createElement(Text, null,
    ...items.map(({ label, value }) => {
      const filled = Math.round(Math.max(0, Math.min(1, value)) * width);
      const bar = "█".repeat(filled) + "░".repeat(width - filled);
      const color = value > 0.7 ? theme.colors.accent : value > 0.4 ? theme.colors.primary : theme.colors.textDim;
      return React.createElement(Text, { key: label },
        React.createElement(Text, { color: theme.colors.textDim }, `${label.padEnd(12)} `),
        React.createElement(Text, { color }, bar),
        React.createElement(Text, { color: theme.colors.textDim }, ` ${value.toFixed(2)}\n`),
      );
    }),
  );
}
