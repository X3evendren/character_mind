/**
 * Theme bridge — global mutable refs so /theme command can access
 * ThemeProvider state from outside React's component tree.
 */
import type { ThemeConfig } from "./types";
import { DEFAULT_THEME, PRESETS } from "./presets";
import { saveThemeFile } from "./loader";

interface ThemeBridgeState {
  theme: ThemeConfig;
  loadPreset: (name: string) => void;
  setColor: (key: keyof ThemeConfig["colors"], value: string) => void;
  save: (name?: string) => void;
}

export const themeBridge: ThemeBridgeState = {
  theme: DEFAULT_THEME,
  loadPreset(name: string) {
    const preset = PRESETS[name];
    if (preset) {
      this.theme = { ...preset, name };
    }
  },
  setColor(key: keyof ThemeConfig["colors"], value: string) {
    this.theme = {
      ...this.theme,
      colors: { ...this.theme.colors, [key]: value },
    };
  },
  save(name?: string) {
    // saveThemeFile needs configDir — handled by caller (ThemeProvider syncs this)
    // This default is a no-op unless ThemeProvider syncs configDir
  },
};

/** Call from ThemeProvider on every render to keep bridge in sync. */
export function syncThemeBridge(
  theme: ThemeConfig,
  loadPreset: (name: string) => void,
  setColor: (key: keyof ThemeConfig["colors"], value: string) => void,
  save: (name?: string) => void,
) {
  themeBridge.theme = theme;
  themeBridge.loadPreset = loadPreset;
  themeBridge.setColor = setColor;
  themeBridge.save = save;
}
