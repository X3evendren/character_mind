import type { LocalCommand, CommandContext } from "../types";
import { PROVIDERS } from "../../agent/provider-registry";

export const modelCommand: LocalCommand = {
  type: "local",
  name: "model",
  description: "查看生成与情境评估模型",
  aliases: ["m"],
  call(args: string, ctx: CommandContext) {
    if (!args) {
      const models = ctx.agent.getModelInfo();
      return `生成模型：${models.generation}\n情境评估：${models.appraisal}\n修改 GEN_MODEL / PSYCH_MODEL 后重启生效。`;
    }
    return '请通过 GEN_MODEL / PSYCH_MODEL 配置模型，然后重启。';
  },
};
