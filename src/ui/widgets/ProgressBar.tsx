import React, { useState, useEffect, useRef } from "react";
import { Text } from "ink";
import { useThemeStore } from "../stores/theme-store";

export function ProgressBar({ label, value, max, width = 10 }: {
  label: string; value: number; max: number; width?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const filled = Math.round(ratio * width);

  // Flow animation: when value changes, the ▒ character position flows
  // within the filled region. The total bar width is constant (width),
  // so the animation only moves the ▒ marker — it never changes length
  // and therefore never causes layout shift.
  const [flowPos, setFlowPos] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    // Only animate when value actually changes
    if (prevValue.current === value) return;
    prevValue.current = value;
    let pos = 0;
    setFlowPos(0);
    const flowLen = Math.max(1, filled);
    const t = setInterval(() => {
      pos = (pos + 1) % flowLen;
      setFlowPos(pos);
    }, 200);
    // Stop after 2 seconds
    const stop = setTimeout(() => clearInterval(t), 2000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [value, filled]);

  // Build the filled region: ▓ everywhere except a single ▒ at flowPos.
  // When not animating, flowPos is 0 and the trailing ▒ (if any) sits at
  // the end of the filled region, matching the original ▓▒░ texture.
  const fullCount = Math.max(0, filled - 1);
  const halfChar = filled > 0 ? "▒" : "";
  const emptyChars = "░".repeat(Math.max(0, width - filled));

  let bar: string;
  if (filled <= 1) {
    // No room to move the marker — static bar
    bar = "▓".repeat(fullCount) + halfChar + emptyChars;
  } else {
    // Place ▒ at flowPos within the filled region; rest is ▓.
    const filledChars = "▓".repeat(flowPos) + "▒" + "▓".repeat(Math.max(0, fullCount - flowPos));
    bar = filledChars + emptyChars;
  }
  // Ensure the bar never exceeds the fixed width (no layout shift).
  if (bar.length > width) bar = bar.slice(0, width);
  if (bar.length < width) bar = bar + "░".repeat(width - bar.length);

  return React.createElement(Text, null,
    React.createElement(Text, { color: theme.colors.textDim }, `${label.padEnd(6)} `),
    React.createElement(Text, { color: ratio > 0.7 ? theme.colors.success : ratio > 0.3 ? theme.colors.secondary : theme.colors.error }, bar),
    React.createElement(Text, { color: theme.colors.textDim }, ` ${value.toFixed(2)}/${max.toFixed(2)}`),
  );
}
