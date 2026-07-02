/**
 * Spinner — braille 帧动画，固定 width=2 height=1 防移位。
 * 参考 claude-code SpinnerGlyph 模式，用标准 Ink 实现。
 */
import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// 来回弹: [...frames, ...frames.reverse()] — claude-code 模式
const BOUNCE_FRAMES = [...FRAMES, ...[...FRAMES].reverse()];

export function Spinner({ active = true, color }: { active?: boolean; color?: string }) {
  const themeColor = useThemeStore((s) => s.theme).colors.warning;
  const c = color ?? themeColor;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) {
      setFrame(0);
      return;
    }
    const t = setInterval(() => setFrame((f) => (f + 1) % BOUNCE_FRAMES.length), 80);
    return () => clearInterval(t);
  }, [active]);

  // 固定 width=2 height=1 防止动画导致组件移位
  return React.createElement(
    Box,
    { width: 2, height: 1, flexShrink: 0 },
    React.createElement(Text, { color: c }, BOUNCE_FRAMES[frame]),
  );
}
