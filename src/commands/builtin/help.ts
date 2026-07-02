import type { LocalCommand, CommandContext } from "../types";
import { getCommands } from "../registry";
import { useChatStore } from "../../ui/stores/chat-store";

export const helpCommand: LocalCommand = {
  type: "local",
  name: "help",
  description: "显示帮助和可用命令",
  aliases: ["h", "?"],
  call(_args: string, ctx: CommandContext) {
    const cmds = getCommands(ctx);
    const debugMode = useChatStore.getState().debugMode;
    const lines: string[] = [];

    lines.push("══ 命令列表 ══");
    for (const cmd of cmds) {
      if (cmd.isHidden) continue;
      const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(", ")})` : "";
      lines.push(`  /${cmd.name}${aliases}  —  ${cmd.description}`);
    }

    lines.push("");
    lines.push("══ 快捷键 ══");
    lines.push("  Enter        发送消息");
    lines.push("  Alt+Enter    换行");
    lines.push("  ↑/↓          浏览输入历史（单行空输入时）");
    lines.push("  Ctrl+↑/↓     滚动对话历史/回到底部");
    lines.push("  Ctrl+A/E     行首/行尾");
    lines.push("  Tab          补全命令");
    lines.push("  /debug       切换仪表盘调试模式");

    lines.push("");
    lines.push("══ 仪表盘 ══");
    lines.push(`  模式: ${debugMode ? "调试(全部展开)" : "精简(3 指标 + 关系图)"}`);
    lines.push("  /debug 命令 或  Ctrl+G 切换模式");

    lines.push("");
    lines.push(`══ 角色: ${ctx.agent.config.name} ══`);
    lines.push("  输入文字即可对话");

    return lines.join("\n");
  },
};
