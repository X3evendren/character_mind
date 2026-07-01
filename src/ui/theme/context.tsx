import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ThemeConfig } from "./types";
import { DEFAULT_THEME, PRESETS } from "./presets";
import { loadThemeFile, saveThemeFile } from "./loader";
import { syncThemeBridge } from "./bridge";

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
  loadPreset: (name: string) => void;
  setColor: (key: keyof ThemeConfig["colors"], value: string) => void;
  save: (name?: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>(null!);

export function ThemeProvider({ children, configDir }: { children: React.ReactNode; configDir: string }) {
  const [theme, setThemeState] = useState<ThemeConfig>(() => loadThemeFile(configDir) ?? DEFAULT_THEME);

  const setTheme = useCallback((t: ThemeConfig) => setThemeState(t), []);
  const loadPreset = useCallback((name: string) => {
    const preset = PRESETS[name];
    if (preset) setThemeState({ ...preset, name });
  }, []);
  const setColor = useCallback((key: keyof ThemeConfig["colors"], value: string) => {
    setThemeState(t => ({ ...t, colors: { ...t.colors, [key]: value } }));
  }, []);
  const save = useCallback((name?: string) => {
    saveThemeFile(configDir, name ? { ...theme, name } : theme);
  }, [theme, configDir]);

  // Keep global bridge in sync so /theme command can access theme state
  useEffect(() => {
    syncThemeBridge(theme, loadPreset, setColor, (n?: string) => saveThemeFile(configDir, n ? { ...theme, name: n } : theme));
  }, [theme, loadPreset, setColor, configDir]);

  return React.createElement(ThemeContext.Provider, { value: { theme, setTheme, loadPreset, setColor, save } }, children);
}

export function useTheme(): ThemeConfig { return useContext(ThemeContext).theme; }
export function useThemeActions(): Omit<ThemeContextValue, "theme"> {
  const { theme: _, ...actions } = useContext(ThemeContext);
  return actions;
}
