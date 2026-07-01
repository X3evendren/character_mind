/**
 * 情绪轮盘 — PAD 三维 2D 散点图。
 * 横轴=愉快(P) [-1,1]，纵轴=唤醒(A) [-1,1]，点大小=掌控(D) [-1,1]。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const GRID_W = 11;
const GRID_H = 7;

export function EmotionWheel({ pad }: {
  pad: { pleasure: number; arousal: number; dominance: number } | null;
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;

  if (!pad) {
    return React.createElement(Text, { color: c.textDim }, "  情绪数据未就绪");
  }

  const x = Math.round(((pad.pleasure + 1) / 2) * (GRID_W - 1));
  const y = Math.round(((1 - (pad.arousal + 1) / 2)) * (GRID_H - 1));
  const dChar = pad.dominance > 0.3 ? "◉" : pad.dominance > -0.3 ? "●" : "○";

  const rows: React.ReactNode[] = [];
  for (let row = 0; row < GRID_H; row++) {
    const cells: string[] = [];
    for (let col = 0; col < GRID_W; col++) {
      if (row === y && col === x) {
        cells.push(dChar);
      } else if (row === Math.floor(GRID_H / 2) && col === Math.floor(GRID_W / 2)) {
        cells.push("┼");
      } else if (row === Math.floor(GRID_H / 2)) {
        cells.push("─");
      } else if (col === Math.floor(GRID_W / 2)) {
        cells.push("│");
      } else {
        cells.push(" ");
      }
    }
    const line = cells.join("");
    const isPoint = row === y;
    rows.push(
      React.createElement(Text, {
        key: row,
        color: isPoint ? c.secondary : c.textDim,
      }, `  ${line}`),
    );
  }

  return React.createElement(Box, { flexDirection: "column" },
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  愉快→"),
    ...rows,
    React.createElement(Text, { color: c.textDim, dimColor: true },
      `  P${pad.pleasure.toFixed(2)} A${pad.arousal.toFixed(2)} D${pad.dominance.toFixed(2)}`),
  );
}