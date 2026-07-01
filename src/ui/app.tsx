/** Ink App — ThemeProvider > AgentStateProvider > MainLayout with event-stream wiring. */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "ink";
import { CharacterAgent } from "../agent/agent";
import { OpenAICompatProvider } from "../agent/provider";
import { AnthropicProvider } from "../agent/provider-anthropic";
// TurnEvent type inferred from agent.runStream() return type
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { registerBuiltinCommands, router, isCommandInput } from "../commands/index";
import { HistoryStore } from "./history";
import { Tracer, JsonlExporter, ConsoleExporter, CompositeExporter } from "../telemetry";
import { CheckpointManager, RecoveryManager } from "../recovery";
import { ContinuousLoop } from "../agent/loop";
import { ThemeProvider } from "./theme/context";
import { AgentStateProvider } from "./agent-state";
import { MainLayout } from "./components/MainLayout";
import type { ChatMessage } from "./components/Message";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../../config");
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const API_BASE = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";

/** Counter for unique message IDs */
let msgIdCounter = 0;
function nextMsgId(): string {
  return `msg_${Date.now()}_${++msgIdCounter}`;
}

/** Inner component: bootstraps agent, then renders AgentStateProvider + MainLayout */
function AppInner() {
  const { exit } = useApp();

  const [agent, setAgent] = useState<CharacterAgent | null>(null);
  const [agentName, setAgentName] = useState("林雨");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusText, setStatusText] = useState("init...");
  const [genDisabled, setGenDisabled] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; message: string; type: "info" | "success" | "warning" | "error" }>
  >([]);

  const history = useRef(new HistoryStore()).current;
  const initRef = useRef(false);

  // ── Notification helper (defined before useEffect that calls it) ──
  const addNotification = useCallback(
    (type: "info" | "success" | "warning" | "error", message: string) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setNotifications(prev => [...prev.slice(-4), { id, message, type }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 4000);
    },
    [],
  );

  // ── Initialization ──
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        const model = process.env.GEN_MODEL || "LongCat-2.0";
        const isAnthropic = API_BASE.includes("anthropic") || API_BASE.includes("longcat");
        const provider = isAnthropic
          ? new AnthropicProvider(model, API_KEY, API_BASE)
          : new OpenAICompatProvider(model, API_KEY, API_BASE);
        const tracer = new Tracer(
          new CompositeExporter(new JsonlExporter(), new ConsoleExporter()),
        );
        const ckpt = new CheckpointManager();
        const recovery = new RecoveryManager(ckpt);
        const decision = recovery.detect();
        const a = new CharacterAgent({
          configDir: CONFIG_DIR,
          genProvider: provider,
          psychProvider: provider,
          genModel: model,
          psychModel: model,
          tracer,
          checkpointManager: ckpt,
        });
        await a.initialize();
        registerBuiltinCommands();

        if (decision.action === "resume" && decision.checkpoint) {
          await a.restoreFromCheckpoint(recovery.resume(decision.checkpoint));
        }

        setAgent(a);
        setAgentName(a.config.name);
        setStatusText("");

        const loop = new ContinuousLoop(30_000);
        loop.start(a);
      } catch (e: any) {
        setStatusText(`Error: ${e.message}`);
        addNotification("error", `初始化失败: ${e.message}`);
      }
    })();
  }, [addNotification]);

  // ── Submit handler ──
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!agent) return;

      // Handle built-in slash commands
      if (text === "/quit") {
        agent.shutdown().then(() => exit());
        return;
      }
      if (text === "/stats") {
        const snap = agent.getStateSnapshot();
        const msg: ChatMessage = {
          id: nextMsgId(),
          role: "system",
          content: `sat=${snap.saturation.toFixed(3)} t=${snap.turnCount} load=${snap.homeostatic.allostaticLoad.toFixed(2)} drives=${Object.keys(snap.drives).length}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, msg]);
        return;
      }
      if (isCommandInput(text)) {
        const result = await router.dispatch(text, { agent, args: "", raw: text });
        if (result.output) {
          const msg: ChatMessage = {
            id: nextMsgId(),
            role: "system",
            content: result.output,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, msg]);
        }
        return;
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: nextMsgId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      history.add(text);

      // Start generation
      setGenDisabled(true);
      setStatusText("generating...");
      const t0 = Date.now();

      // Track tool calls by callId for pairing start/end
      const pendingToolCalls = new Map<string, string>(); // callId -> msgId

      try {
        const stream = agent.runStream(text);
        for await (const event of stream) {
          switch (event.type) {
            case "phase_start": {
              setStatusText(`${event.phase}...`);
              break;
            }
            case "text_delta": {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + event.text,
                  };
                  return updated;
                } else {
                  const newMsg: ChatMessage = {
                    id: nextMsgId(),
                    role: "assistant",
                    content: event.text,
                    timestamp: Date.now(),
                  };
                  return [...prev, newMsg];
                }
              });
              break;
            }
            case "tool_start": {
              const toolMsgId = nextMsgId();
              pendingToolCalls.set(event.callId, toolMsgId);
              const toolMsg: ChatMessage = {
                id: toolMsgId,
                role: "tool",
                content: "",
                timestamp: Date.now(),
                toolCall: {
                  tool: event.tool,
                  args: event.args,
                  success: false,
                  outputPreview: "...",
                  durationMs: 0,
                },
              };
              setMessages(prev => [...prev, toolMsg]);
              setStatusText(`tool: ${event.tool}...`);
              break;
            }
            case "tool_end": {
              const toolMsgId = pendingToolCalls.get(event.callId);
              if (toolMsgId) {
                setMessages(prev =>
                  prev.map(m => {
                    if (m.id === toolMsgId && m.toolCall) {
                      return {
                        ...m,
                        content: event.outputPreview.slice(0, 200),
                        toolCall: {
                          ...m.toolCall,
                          success: event.success,
                          outputPreview: event.outputPreview,
                          durationMs: event.durationMs,
                        },
                      };
                    }
                    return m;
                  }),
                );
              }
              setStatusText(`tool ${event.tool} ${event.success ? "ok" : "fail"}`);
              break;
            }
            case "cold_layer_start": {
              addNotification("info", `cold: ${event.name}`);
              break;
            }
            case "error": {
              const errMsg: ChatMessage = {
                id: nextMsgId(),
                role: "system",
                content: `Error [${event.phase}]: ${event.message}`,
                timestamp: Date.now(),
              };
              setMessages(prev => [...prev, errMsg]);
              addNotification("error", event.message);
              break;
            }
            case "done": {
              const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
              setGenDisabled(false);
              setStatusText(
                `${agentName} t${event.turnId} ${elapsed}s ${event.totalTokens}tok`,
              );
              break;
            }
          }
        }
      } catch (err: any) {
        const errMsg: ChatMessage = {
          id: nextMsgId(),
          role: "system",
          content: `Error: ${err?.message ?? "unknown"}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
        addNotification("error", err?.message ?? "generation error");
        setGenDisabled(false);
        setStatusText("");
      }
    },
    [agent, agentName, exit, history, addNotification],
  );

  return React.createElement(
    AgentStateProvider,
    { agent },
    React.createElement(MainLayout, {
      messages,
      notifications,
      onSubmit: handleSubmit,
      disabled: genDisabled,
      agentName,
      statusText,
    }),
  );
}

/** Root component: ThemeProvider wraps everything. */
export function App() {
  return React.createElement(
    ThemeProvider,
    { configDir: CONFIG_DIR },
    React.createElement(AppInner, null),
  );
}
