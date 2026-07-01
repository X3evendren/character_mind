import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/context";

export function ProgressBar({ label, value, max, width = 10 }: {
  label: string; value: number; max: number; width?: number;
}) {
  const theme = useTheme();
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const filled = Math.round(ratio * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return React.createElement(Text, null,
    React.createElement(Text, { color: theme.colors.textDim }, `${label.padEnd(6)} `),
    React.createElement(Text, { color: ratio > 0.7 ? theme.colors.success : ratio > 0.3 ? theme.colors.secondary : theme.colors.error }, bar),
    React.createElement(Text, { color: theme.colors.textDim }, ` ${value.toFixed(2)}/${max.toFixed(2)}`),
  );
}
