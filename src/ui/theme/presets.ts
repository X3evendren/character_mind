import type { ThemeConfig } from "./types";

export const DEFAULT_THEME: ThemeConfig = {
  name: "暮色",
  colors: {
    primary: "#706CAA",      // 紫蓝 — 边框/标题/角色名/助手前缀
    secondary: "#F7DA94",    // 暖米黄 — 高亮/活跃值/强调
    accent: "#CC7EB1",       // 玫粉 — 用户消息边框/情绪标记
    background: "#2a1f1d",   // 深褐 — 背景
    surface: "#332624",      // 深褐亮 — 面板/色块背景/代码块
    text: "#d4c4c0",         // 暖白 — 主文本
    textDim: "#6b5755",      // 暗灰褐 — 次要文本/时间戳
    success: "#8a9a5b",      // 苔绿 — 成功/✓
    warning: "#e6c229",       // 金 — 警告/⚠/加载动画
    error: "#c14646",        // 砖红 — 错误/✗
  },
  layout: { leftPanelWidth: 42, showDashboard: true, dashboardDefaultTab: 0 },
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
