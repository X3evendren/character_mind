import type { LocalCommand, CommandContext } from "../types";
import { useChatStore } from "../../ui/stores/chat-store";

export const debugCommand: LocalCommand = {
  type: "local",
  name: "debug",
  description: "切换调试模式(展开/折叠仪表盘)",
  call(_args: string, _ctx: CommandContext): string {
    useChatStore.getState().toggleDebugMode();
    const mode = useChatStore.getState().debugMode ? "调试" : "精简";
    return `仪表盘: ${mode}模式`;
  },
};

export default debugCommand;
