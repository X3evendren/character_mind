import type { ThemeConfig } from "./types";

export const DEFAULT_THEME: ThemeConfig = {
  name: "default",
  colors: {
    primary: "#706CAA", secondary: "#F7DA94", accent: "#CC7EB1",
    background: "#1A1A2E", surface: "#242442",
    text: "#E8E8F0", textDim: "#8888A0",
    success: "#80C080", warning: "#F7DA94", error: "#E08080",
  },
  layout: { leftPanelWidth: 32, showDashboard: true, dashboardDefaultTab: 0 },
  typography: { roleNameBold: true, timestampFormat: "HH:mm" },
  animation: { streaming: true, progressBars: true, sparkline: true },
};

export const DARK_THEME: ThemeConfig = {
  ...DEFAULT_THEME, name: "dark",
  colors: { primary: "#AAAAAA", secondary: "#DDDDDD", accent: "#999999",
    background: "#000000", surface: "#111111", text: "#CCCCCC", textDim: "#666666",
    success: "#88AA88", warning: "#CCCC88", error: "#AA8888" },
};

export const WARM_THEME: ThemeConfig = {
  ...DEFAULT_THEME, name: "warm",
  colors: { primary: "#C4956A", secondary: "#E8C48A", accent: "#D4A574",
    background: "#2A2218", surface: "#3A3228", text: "#F0E0D0", textDim: "#807060",
    success: "#80A080", warning: "#E8C48A", error: "#C08060" },
};

export const FOREST_THEME: ThemeConfig = {
  ...DEFAULT_THEME, name: "forest",
  colors: { primary: "#6A9B6A", secondary: "#A0C080", accent: "#80A870",
    background: "#182218", surface: "#283228", text: "#D0E8D0", textDim: "#608060",
    success: "#80C080", warning: "#C0C060", error: "#C06060" },
};

export const PRESETS: Record<string, ThemeConfig> = {
  default: DEFAULT_THEME, dark: DARK_THEME, warm: WARM_THEME, forest: FOREST_THEME,
};
