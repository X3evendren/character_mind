/**
 * 关系坐标图 — 4 维关系 2×2 坐标。
 * 横轴=信任↔回避，纵轴=熟悉↔矛盾。
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const GRID_W = 11;
const GRID_H = 7;

export function RelationMap({ relationship }: {
  relationship: { trust: number; familiarity: number; avoidance: number; ambivalence: number };
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;
  const { trust, familiarity, avoidance, ambivalence } = relationship;

  const xPos = Math.round(((trust - avoidance + 1) / 2) * (GRID_W - 1));
  const yPos = Math.round(((1 - (familiarity - ambivalence + 1) / 2)) * (GRID_H - 1));

  const rows: React.ReactNode[] = [];
  for (let row = 0; row < GRID_H; row++) {
    const cells: string[] = [];
    for (let col = 0; col < GRID_W; col++) {
      if (row === yPos && col === xPos) {
        cells.push("◉");
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
    const isPoint = row === yPos;
    rows.push(
      React.createElement(Text, {
        key: row,
        color: isPoint ? c.accent : c.textDim,
      }, `  ${cells.join("")}`),
    );
  }

  return React.createElement(Box, { flexDirection: "column" },
    React.createElement(Text, { color: c.textDim, dimColor: true }, "  熟悉↑   矛盾↓  信任→  回避←"),
    ...rows,
    React.createElement(Text, { color: c.textDim, dimColor: true },
      `  信任${trust.toFixed(2)} 熟悉${familiarity.toFixed(2)} 回避${avoidance.toFixed(2)} 矛盾${ambivalence.toFixed(2)}`),
  );
}