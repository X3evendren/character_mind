import type { LocalCommand, CommandContext } from "../types";

export const quitCommand: LocalCommand = {
  type: "local",
  name: "quit",
  description: "结束请求、保存记忆并退出",
  aliases: ["exit", "q"],
  immediate: true,
  async call(_args: string, ctx: CommandContext) {
    return '请使用 Ctrl+C 结束请求、保存记忆并退出。';
  },
};
