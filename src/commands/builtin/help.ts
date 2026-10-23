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
    lines.push("  PgUp/PgDn    按页滚动当前视图");
    lines.push("  Ctrl+↑/↓     逐行滚动");
    lines.push("  Ctrl+A/E     行首/行尾");
    lines.push("  Tab          切换视图；输入 /命令 时补全");
    lines.push("  Esc          取消对话或关闭记忆详情");
    lines.push("  Ctrl+K       请求压缩");
    lines.push("  Ctrl+C       保存并退出");

    lines.push("");
    lines.push("══ 工作台 ══");
    lines.push(`  回合情绪标记: ${debugMode ? "显示" : "隐藏"}，/debug 切换`);
    lines.push("  Ctrl+G 查看心智；Ctrl+F 搜索图谱");

    lines.push("");
    lines.push(`══ 角色: ${ctx.agent.config.name} ══`);
    lines.push("  输入文字即可对话");

    return lines.join("\n");
  },
};
