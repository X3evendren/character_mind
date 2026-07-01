import type { LocalCommand, CommandContext } from "../types";
import { themeBridge } from "../../ui/theme/bridge";

export const themeCommand: LocalCommand = {
  type: "local",
  name: "theme",
  description: "Switch or configure the terminal theme",
  aliases: ["th"],
  call(args: string, _ctx: CommandContext): string {
    const trimmed = args.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);

    // No args: show current theme info
    if (parts.length === 0) {
      const t = themeBridge.theme;
      const lines: string[] = [];
      lines.push(`Theme: ${t.name}`);
      lines.push("─".repeat(30));
      for (const [key, value] of Object.entries(t.colors)) {
        lines.push(`  ${key.padEnd(12)} ${value}`);
      }
      return lines.join("\n");
    }

    // Subcommand: load preset
    if (parts[0] === "dark" || parts[0] === "warm" || parts[0] === "forest" || parts[0] === "default") {
      themeBridge.loadPreset(parts[0]);
      return `Theme switched to "${parts[0]}"`;
    }

    // Subcommand: color <key> <value>
    if (parts[0] === "color" && parts.length >= 3) {
      const key = parts[1] as keyof typeof themeBridge.theme.colors;
      const value = parts[2];
      const validKeys = Object.keys(themeBridge.theme.colors);
      if (!validKeys.includes(key)) {
        return `Unknown color key: "${key}". Valid: ${validKeys.join(", ")}`;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return `Invalid color value: "${value}". Must be #RRGGBB hex.`;
      }
      themeBridge.setColor(key, value);
      return `Color "${key}" set to ${value}`;
    }

    // Subcommand: save [name]
    if (parts[0] === "save") {
      const name = parts[1] ?? undefined;
      themeBridge.save(name);
      return name ? `Theme saved as "${name}"` : "Theme saved";
    }

    return "Usage: /theme [dark|warm|forest|default] | /theme color <key> <#RRGGBB> | /theme save [name] | /theme";
  },
};
