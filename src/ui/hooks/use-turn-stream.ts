/**
 * useTurnStream — 消费 agent.runStream() 事件流，写入 chat-store。
 * done/phase_end(update_instant) 时触发 agent-store 即时刷新。
 */
import { useCallback } from "react";
import type { AgentPort } from "../agent-port";
import { useChatStore } from "../stores/chat-store";
import { useAgentStore } from "../stores/agent-store";
import { isCommandInput, router } from "../../commands/index";

export function useTurnStream(agent: AgentPort | null) {
  const dispatchEvent = useChatStore((s) => s.dispatchEvent);
  const submitUserMessage = useChatStore((s) => s.submitUserMessage);
  const addNotification = useChatStore((s) => s.addNotification);
  const refreshSnapshot = useAgentStore((s) => s.refreshNow);

  return useCallback(
    async (text: string) => {
      if (!agent) return;

      // 斜杠命令不走 agent
      if (isCommandInput(text)) {
        const result = await router.dispatch(text, { agent: agent as never, args: "", raw: text });
        if (result.output) {
          useChatStore.setState((s) => ({
            ...s,
            messages: [
              ...s.messages,
              { id: `msg_${Date.now()}_${s.nextMsgId}`, role: "system" as const, content: result.output, timestamp: Date.now() },
            ],
            nextMsgId: s.nextMsgId + 1,
          }));
        }
        return;
      }

      submitUserMessage(text);

      try {
        const stream = agent.runStream(text);
        for await (const event of stream) {
          dispatchEvent(event);
          // turn 结束或状态更新阶段完成时，即时拉快照
          if (event.type === "done" || (event.type === "phase_end" && event.phase === "update_instant")) {
            refreshSnapshot();
          }
        }
      } catch (err: any) {
        addNotification("error", err?.message ?? "生成错误");
        useChatStore.setState((s) => ({ ...s, isGenerating: false }));
      }
    },
    [agent, dispatchEvent, submitUserMessage, addNotification, refreshSnapshot],
  );
}