import type { LocalCommand, CommandContext } from "../types";
import { useChatStore } from "../../ui/stores/chat-store";

export const debugCommand: LocalCommand = {
  type: "local",
  name: "debug",
  description: "显示或隐藏每轮对话的情绪数值",
  call(_args: string, _ctx: CommandContext): string {
    useChatStore.getState().toggleDebugMode();
    const mode = useChatStore.getState().debugMode ? "调试" : "精简";
    return `回合情绪标记: ${mode}模式`;
  },
};

export default debugCommand;
