import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { parse, stringify } from "yaml";
import type { ThemeConfig } from "./types";
import { DEFAULT_THEME } from "./presets";

export function loadThemeFile(configDir: string): ThemeConfig | null {
  try {
    const path = join(configDir, "theme.yaml");
    if (!existsSync(path)) return null;
    const raw = parse(readFileSync(path, "utf-8"));
    if (!raw?.theme || typeof raw.theme !== 'object') return null;
    const colors = { ...DEFAULT_THEME.colors };
    for (const key of Object.keys(colors) as Array<keyof typeof colors>) {
      const value = raw.theme.colors?.[key];
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) colors[key] = value;
    }
    return { name: typeof raw.theme.name === 'string' ? raw.theme.name : DEFAULT_THEME.name, colors,
      layout: { showDashboard: typeof raw.theme.layout?.showDashboard === 'boolean' ? raw.theme.layout.showDashboard : true } };
  } catch { return null; }
}

export function saveThemeFile(configDir: string, theme: ThemeConfig): void {
  if (!configDir) throw new Error('主题配置目录未初始化');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(join(configDir, 'theme.yaml'), stringify({ theme }), 'utf8');
}
