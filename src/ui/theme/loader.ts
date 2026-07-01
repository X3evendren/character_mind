import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parse, stringify } from "yaml";
import type { ThemeConfig } from "./types";
import { DEFAULT_THEME } from "./presets";

export function loadThemeFile(configDir: string): ThemeConfig | null {
  try {
    const path = join(configDir, "theme.yaml");
    if (!existsSync(path)) return null;
    const raw = parse(readFileSync(path, "utf-8"));
    return (raw?.theme as ThemeConfig) ?? null;
  } catch { return null; }
}

export function saveThemeFile(configDir: string, theme: ThemeConfig): void {
  try {
    const path = join(configDir, "theme.yaml");
    writeFileSync(path, stringify({ theme }), "utf-8");
  } catch { /* ignore */ }
}
