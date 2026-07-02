/** Ink App — 薄壳：调工厂 + 挂 useTurnStream + 从 store 订阅渲染。 */
import React, { useState, useEffect, useRef } from "react";
import { useApp, Text } from "ink";
import type { AgentPort } from "./agent-port";
import { createAgent, DEFAULT_CONFIG_DIR } from "./agent-factory";
import { registerBuiltinCommands } from "../commands/index";
import { useChatStore } from "./stores/chat-store";
import { useAgentStore } from "./stores/agent-store";
import { useThemeStore } from "./stores/theme-store";
import { useTurnStream } from "./hooks/use-turn-stream";
import { MainLayout } from "./components/MainLayout";

function AppInner() {
  const { exit } = useApp();
  const [agent, setAgent] = useState<AgentPort | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const initRef = useRef(false);

  // 初始化主题 store（命令侧 useThemeStore.getState() 依赖此 init 写入 configDir）
  const initTheme = useThemeStore((s) => s.init);
  const setAgentInStore = useAgentStore((s) => s.setAgent);

  useEffect(() => {
    initTheme(DEFAULT_CONFIG_DIR);
  }, [initTheme]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        // 命令需先注册，agent 创建后才能被 router 派发
        registerBuiltinCommands();
        const { agent: a } = await createAgent({});
        setAgent(a);
        setAgentInStore(a);
      } catch (e: any) {
        setBootError(e?.message ?? String(e));
        useChatStore.getState().addNotification("error", `初始化失败: ${e?.message ?? String(e)}`);
      }
    })();
  }, [setAgentInStore]);

  const handleSubmit = useTurnStream(agent);

  // /quit 与 /clear 在 hook 之外特殊处理（hook 内 router 不认识这两个）
  const wrappedSubmit = async (text: string) => {
    if (text === "/quit" && agent) {
      await agent.shutdown();
      useAgentStore.getState().stopPolling();
      exit();
      return;
    }
    if (text === "/clear") {
      useChatStore.getState().clearMessages();
      return;
    }
    handleSubmit(text);
  };

  // 从 store 订阅渲染所需状态(TurnList 自行订阅 turns,statusText 已并入 Turn header)
  const notifications = useChatStore((s) => s.notifications);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const agentName = useAgentStore((s) => s.snapshot?.agentName ?? "林雨");

  if (bootError) {
    return React.createElement(Text, { color: "red" }, `初始化失败: ${bootError}`);
  }

  return React.createElement(MainLayout, {
    notifications,
    onSubmit: wrappedSubmit,
    disabled: isGenerating,
    agentName,
  });
}

export function App() {
  return React.createElement(AppInner, null);
}