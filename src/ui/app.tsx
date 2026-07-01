/** Ink App — Span-based layout with Controller integration. */
import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { CharacterAgent } from "../agent/agent";
import { OpenAICompatProvider } from "../agent/provider";
import { AnthropicProvider } from "../agent/provider-anthropic";
import type { TurnEvent, RunResult } from "../agent/events";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { registerBuiltinCommands, router, isCommandInput } from "../commands/index";
import { HistoryStore } from "./history";
import { SpanState } from "./span-renderer";
import type { Span } from "../generation/types";
import { Tracer, JsonlExporter, ConsoleExporter, CompositeExporter } from "../telemetry";
import { CheckpointManager, RecoveryManager } from "../recovery";
import { ContinuousLoop } from "../agent/loop";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../../config");
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const API_BASE = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [agent, setAgent] = useState<CharacterAgent | null>(null);
  const [agentName, setAgentName] = useState("林雨");
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState("init...");
  const [genStatus, setGenStatus] = useState("idle");
  const history = useRef(new HistoryStore()).current;
  const savedInput = useRef("");
  const initRef = useRef(false);

  // Span-based rendering
  const spanState = useRef(new SpanState()).current;
  const [, forceRender] = useState(0);

  // Subscribe SpanState to React re-renders
  useEffect(() => {
    return spanState.subscribe(() => forceRender(n => n + 1));
  }, []);

  const rows = stdout?.rows ?? 24;
  const maxMsg = Math.max(3, rows - 3);

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
        const tracer = new Tracer(new CompositeExporter(
          new JsonlExporter(),
          new ConsoleExporter(),
        ));
        const ckpt = new CheckpointManager();
        const recovery = new RecoveryManager(ckpt);
        const decision = recovery.detect();
        const a = new CharacterAgent({
          configDir: CONFIG_DIR,
          genProvider: provider,
          psychProvider: provider,  // unified — single model
          genModel: model,
          psychModel: model,
          tracer,
          checkpointManager: ckpt,
        });
        await a.initialize();
        registerBuiltinCommands();

        // Resume from checkpoint if available
        if (decision.action === "resume" && decision.checkpoint) {
          await a.restoreFromCheckpoint(recovery.resume(decision.checkpoint));
        }

        setAgent(a);
        setAgentName(a.config.name);

        // Start background loop
        const loop = new ContinuousLoop(30_000);
        loop.start(a);

        setStatus("");
        setGenStatus("idle");
      } catch (e: any) { setStatus(`Error: ${e.message}`); }
    })();
  }, []);

  // ═══════════════════════════════════════
  // Submit handler
  // ═══════════════════════════════════════
  const submitText = async (text: string) => {
    if (!agent) return;

    if (text === "/quit") { agent.shutdown().then(() => exit()); return; }
    if (text === "/stats") {
      const statsSpan: Span = { id: `stats_${Date.now()}`, layer: "locked", text: `s=${agent.saturation.s.toFixed(3)}`, startPos: 0, endPos: 0, committedAt: Date.now() };
      spanState.apply({ type: "append", span: statsSpan });
      return;
    }
    if (isCommandInput(text)) {
      router.dispatch(text, { agent, args: "", raw: text }).then(r => {
        if (r.output) {
          const cmdSpan: Span = { id: `cmd_${Date.now()}`, layer: "locked", text: r.output!, startPos: 0, endPos: 0, committedAt: Date.now() };
          spanState.apply({ type: "append", span: cmdSpan });
        }
      });
      return;
    }

    // Add user input as locked span
    const userSpan: Span = { id: `usr_${Date.now()}`, layer: "locked", text: `❯ ${text}`, startPos: 0, endPos: 0, committedAt: Date.now() };
    spanState.apply({ type: "append", span: userSpan });
    spanState.markGenStart();

    setGenStatus("generating");
    const t0 = Date.now();

    try {
      // Use the new event-stream API
      const stream = agent.runStream(text);
      let lastPhase = "";
      for await (const event of stream) {
        switch (event.type) {
          case "phase_start":
            lastPhase = event.phase;
            setStatus(`${event.phase}...`);
            break;
          case "text_delta": {
            // Append as fluid span — spanState manages sentence-level locking
            const fluidSpan: Span = { id: `txt_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, layer: "fluid", text: event.text, startPos: 0, endPos: 0, committedAt: Date.now() };
            spanState.apply({ type: "append", span: fluidSpan });
            break;
          }
          case "tool_start":
            setStatus(`执行工具: ${event.tool}...`);
            break;
          case "tool_end":
            setStatus(`工具 ${event.tool} ${event.success ? "完成" : "失败"}`);
            break;
          case "cold_layer_start":
            setStatus(`冷分析: ${event.name}...`);
            break;
          case "error":
            setStatus(`错误: ${event.message}`);
            break;
          case "done": {
            // Lock all fluid spans
            for (const span of spanState.getFluidSpans()) {
              spanState.apply({ type: "lock", spanId: span.id });
            }
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            setGenStatus("idle");
            setStatus(`${agentName} · s=${agent.saturation.s.toFixed(2)} · ${elapsed}s · t${agent.turnCount}`);
            break;
          }
        }
      }
    } catch (err: any) {
      setStatus(`Error: ${err?.message ?? "unknown"}`);
      setGenStatus("idle");
    }
  };

  // ═══════════════════════════════════════
  // Input handling
  // ═══════════════════════════════════════
  useInput((val: string, key: any) => {
    if (key.return) {
      const text = input.trim();
      if (!text) return;
      setInput(""); setCursor(0);
      history.add(text); history.resetCursor();
      submitText(text);
    } else if (key.upArrow) {
      const beforeCursor = input.slice(0, cursor);
      if (!beforeCursor.includes("\n")) {
        if (history.atNewest) savedInput.current = input;
        const entry = history.up();
        if (entry !== null) { setInput(entry); setCursor(entry.length); }
      } else {
        const lines = beforeCursor.split("\n");
        const prevLen = lines[lines.length - 2]?.length ?? 0;
        const curLen = lines[lines.length - 1]?.length ?? 0;
        setCursor(c => c - curLen - 1 - Math.max(0, curLen - prevLen));
      }
    } else if (key.downArrow) {
      const afterCursor = input.slice(cursor);
      if (!afterCursor.includes("\n")) {
        const entry = history.down();
        if (entry !== null) { setInput(entry); setCursor(entry.length); }
        else if (savedInput.current) { setInput(savedInput.current); setCursor(savedInput.current.length); savedInput.current = ""; }
      } else {
        const curEnd = input.indexOf("\n", cursor);
        const curLen = (curEnd === -1 ? input.length : curEnd) - (input.lastIndexOf("\n", cursor - 1) + 1);
        const nextStart = (curEnd === -1 ? input.length : curEnd) + 1;
        const nextEnd = input.indexOf("\n", nextStart);
        const nextLen = (nextEnd === -1 ? input.length : nextEnd) - nextStart;
        setCursor(nextStart + Math.min(curLen, nextLen));
      }
    } else if (key.leftArrow) { setCursor(c => Math.max(0, c - 1)); }
    else if (key.rightArrow) { setCursor(c => Math.min(input.length, c + 1)); }
    else if (key.home || (val === "a" && key.ctrl)) { setCursor(0); }
    else if (key.end || (val === "e" && key.ctrl)) { setCursor(input.length); }
    else if (key.backspace && cursor > 0) {
      setInput(p => p.slice(0, cursor - 1) + p.slice(cursor));
      setCursor(c => c - 1);
    } else if (key.delete && cursor < input.length) {
      setInput(p => p.slice(0, cursor) + p.slice(cursor + 1));
    } else if (val && !key.ctrl && !key.meta && !key.tab && !key.escape) {
      setInput(p => p.slice(0, cursor) + val + p.slice(cursor));
      setCursor(c => c + val.length);
    }
  });

  const cursorChar = cursor >= input.length ? '█' : '▌';
  const inputDisplay = input.slice(0, cursor) + cursorChar + input.slice(cursor);

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════
  const allSpans = spanState.getAllSpans();
  const visibleSpans = allSpans.length <= maxMsg ? allSpans : allSpans.slice(-maxMsg);

  return React.createElement(Box, { flexDirection: "column", height: "100%" },
    // Header
    React.createElement(Text, { bold: true, color: "cyan" }, `  ${agentName}`),

    // Messages — padded from bottom so latest appear near input
    React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
      // Spacer pushes content to bottom
      React.createElement(Box, { key: "spacer", flexGrow: 1 }),
      ...visibleSpans.map(s =>
        React.createElement(Text, { key: s.id, dimColor: s.layer === "fluid" }, s.text || " ")
      ),
    ),

    // Fixed input area at bottom
    React.createElement(Box, { flexDirection: "column", flexShrink: 0 },
      React.createElement(Text, { dimColor: true }, `  ${status}`),
      React.createElement(Text, { dimColor: true }, `  ${"─".repeat((stdout?.columns ?? 80) - 4)}`),
      ...inputDisplay.split("\n").map((line, i) =>
        React.createElement(Text, {
          key: `in_${i}`,
          color: i === inputDisplay.split("\n").length - 1 ? "cyan" : "white",
        }, `  ${i === 0 ? "❯ " : "  "}${line || " "}`)
      ),
    ),
  );
}

