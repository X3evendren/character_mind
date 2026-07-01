/**
 * 心境矩阵 — 12 维心境条形图，按值降序取前 N。
 * 中文名：平和/易怒/焦虑/活力/温暖/自信/感恩/骄傲/好奇/希望/敬畏/顽皮
 */
import React from "react";
import { Text, Box } from "ink";
import { useThemeStore } from "../stores/theme-store";

const MOOD_NAMES: Record<string, string> = {
  euthymic: "平和", irritable: "易怒", anxious: "焦虑", vital: "活力",
  warm: "温暖", confident: "自信", grateful: "感恩", proud: "骄傲",
  curious: "好奇", hopeful: "希望", awed: "敬畏", playful: "顽皮",
  paniGrief: "悲恸", fatigue: "疲惫",
};

const MOOD_ORDER = ["euthymic", "irritable", "anxious", "vital", "warm", "confident",
  "grateful", "proud", "curious", "hopeful", "awed", "playful"];

export function MoodMatrix({ mood, topN = 6 }: {
  mood: Record<string, number>;
  topN?: number;
}) {
  const theme = useThemeStore((s) => s.theme);
  const c = theme.colors;

  const entries = MOOD_ORDER
    .filter((k) => mood[k] !== undefined)
    .map((k) => ({ key: k, name: MOOD_NAMES[k] ?? k, value: mood[k] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);

  return React.createElement(Box, { flexDirection: "column" },
    ...entries.map((e) => {
      const ratio = Math.max(0, Math.min(1, e.value));
      const filled = Math.round(ratio * 8);
      const full = "▓".repeat(Math.floor(filled * 0.7));
      const half = filled - full.length > 0 ? "▒" : "";
      const empty = "░".repeat(8 - filled);
      const bar = full + half + empty;
      const color = e.value > 0.6 ? c.secondary : e.value > 0.3 ? c.primary : c.textDim;
      return React.createElement(Text, { key: e.key },
        React.createElement(Text, { color: c.textDim }, `  ${e.name.padEnd(4)} `),
        React.createElement(Text, { color }, bar),
        React.createElement(Text, { color: c.textDim }, ` ${e.value.toFixed(2)}`),
      );
    }),
  );
}