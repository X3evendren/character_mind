/**
 * Spinner — braille 帧动画，固定 width=2 height=1 防移位。
 * 使用共享时钟(useAnimationFrame)，多个 Spinner 实例复用单一 setInterval。
 * 支持 stalled 检测:stalledIntensity > 0 时颜色平滑渐变到红色。
 */
import React, { useState, useEffect, useRef } from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";
import { useAnimationFrame } from "../hooks/use-animation-frame";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// 来回弹: [...frames, ...frames.reverse()] — claude-code 模式
const BOUNCE_FRAMES = [...FRAMES, ...[...FRAMES].reverse()];

// stalled 颜色(ERROR_RED)与 claude-code 一致
const ERROR_RED = { r: 171, g: 43, b: 63 };

/** RGB 颜色插值 */
function interpolateColor(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }, t: number): { r: number; g: number; b: number } {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

function toRGBColor(c: { r: number; g: number; b: number }): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function parseRGB(color: string): { r: number; g: number; b: number } | null {
  const m = color.match(/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export const Spinner = React.memo(function Spinner({
  active = true,
  color,
  /** stalled 强度 0-1，>0 时颜色渐变到红色 */
  stalledIntensity = 0,
}: {
  active?: boolean;
  color?: string;
  stalledIntensity?: number;
}) {
  const themeColor = useThemeStore((s) => s.theme).colors.warning;
  const baseColor = color ?? themeColor;

  // 共享时钟:active 时订阅 80ms，不活跃时退订(暂停)
  const time = useAnimationFrame(active ? 80 : null);
  const frame = Math.floor(time / 80) % BOUNCE_FRAMES.length;

  // 基础颜色解析(用于 stalled 插值)
  const baseRGB = parseRGB(baseColor);

  let displayColor = baseColor;

  // stalled 颜色渐变
  if (stalledIntensity > 0 && baseRGB) {
    const interpolated = interpolateColor(baseRGB, ERROR_RED, stalledIntensity);
    displayColor = toRGBColor(interpolated);
  } else if (stalledIntensity > 0.5) {
    // 非 RGB 主题色回退为 error
    displayColor = "red";
  }

  return React.createElement(
    Box,
    { width: 2, height: 1, flexShrink: 0 },
    React.createElement(Text, { color: displayColor }, active ? BOUNCE_FRAMES[frame] : "·"),
  );
});