/**
 * Theme Store — 主题真相源，模块级单例。
 * React 外命令直接调 useThemeStore.getState().loadPreset(...)
 * 替代 context.tsx + bridge.ts。
 */
import { create } from "zustand";
import type { ThemeConfig } from "../theme/types";
import { DEFAULT_THEME, PRESETS } from "../theme/presets";
import { loadThemeFile, saveThemeFile } from "../theme/loader";

interface ThemeStoreState {
  theme: ThemeConfig;
  configDir: string;
  init: (configDir: string) => void;
  setTheme: (t: ThemeConfig) => void;
  loadPreset: (name: string) => void;
  setColor: (key: keyof ThemeConfig["colors"], value: string) => void;
  save: (name?: string) => void;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: DEFAULT_THEME,
  configDir: "",
  init: (configDir) => {
    const loaded = loadThemeFile(configDir) ?? DEFAULT_THEME;
    set({ theme: loaded, configDir });
  },
  setTheme: (t) => set({ theme: t }),
  loadPreset: (name) => {
    const preset = PRESETS[name];
    if (preset) set({ theme: { ...preset, name } });
  },
  setColor: (key, value) =>
    set((s) => ({ theme: { ...s.theme, colors: { ...s.theme.colors, [key]: value } } })),
  save: (name) => {
    const { theme, configDir } = get();
    saveThemeFile(configDir, name ? { ...theme, name } : theme);
  },
}));