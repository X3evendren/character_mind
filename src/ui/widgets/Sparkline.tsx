import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/context";

const SPARK_CHARS = ["▁","▂","▃","▄","▅","▆","▇","█"];

export function Sparkline({ data, width = 20, label }: { data: number[]; width?: number; label?: string }) {
  const theme = useTheme();
  if (data.length === 0) return React.createElement(Text, null);
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
  const sampled = data.length <= width ? data : data.slice(-width);
  const line = sampled.map(v => SPARK_CHARS[Math.min(7, Math.floor((v - min) / range * 7))]).join("");
  return React.createElement(Text, null,
    label ? React.createElement(Text, { color: theme.colors.textDim }, `${label} `) : null,
    React.createElement(Text, { color: theme.colors.primary }, line),
    React.createElement(Text, { color: theme.colors.textDim }, ` ${data[data.length-1].toFixed(2)}`),
  );
}
