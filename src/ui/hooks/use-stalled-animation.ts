/**
 * useStalledAnimation — 检测生成是否卡住(3 秒无新 token)。
 * stalledIntensity 从 0 渐变到 1(2 秒线性)，用于 Spinner 颜色过渡。
 * 模仿 claude-code 的 useStalledAnimation。
 */
import { useState, useEffect, useRef } from "react";
import { useAnimationFrame } from "./use-animation-frame";

const STALL_THRESHOLD_MS = 3000; // 3 秒无 token 触发
const STALL_RAMP_MS = 2000; // 2 秒内渐变到 1

export function useStalledAnimation(isGenerating: boolean, lastTokenTime: number | null): number {
  const [stalledIntensity, setStalledIntensity] = useState(0);
  const smoothRef = useRef(0);

  // 只有生成中才需要 stalled 检测
  const time = useAnimationFrame(isGenerating ? 50 : null);

  useEffect(() => {
    if (!isGenerating) {
      smoothRef.current = 0;
      setStalledIntensity(0);
      return;
    }

    const sinceLastToken = lastTokenTime != null ? time - lastTokenTime : time;
    if (sinceLastToken < STALL_THRESHOLD_MS) {
      // 未卡顿 → 渐变回 0
      smoothRef.current = Math.max(0, smoothRef.current - 0.05);
      setStalledIntensity(smoothRef.current);
      return;
    }

    // 计算 target intensity
    const raw = Math.min((sinceLastToken - STALL_THRESHOLD_MS) / STALL_RAMP_MS, 1);
    // 平滑趋近(指数)
    smoothRef.current += (raw - smoothRef.current) * 0.1;
    setStalledIntensity(smoothRef.current);
  }, [time, isGenerating, lastTokenTime]);

  return stalledIntensity;
}