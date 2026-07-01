/**
 * Integration tests for MCP, Channels, Plugin, and Cron modules.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── MCP ──
import { mcpToolToDef, loadMcpTools, unloadMcpTools } from "./mcp/tool-loader";
import type { McpToolSchema } from "./mcp/types";
import type { McpServerConfig } from "./mcp/types";

// ── Channels ──
import { ChannelRegistry } from "./channels/registry";
import { WebSocketChannel } from "./channels/websocket";
import type { ChannelMessage } from "./channels/types";

// ── Plugin ──
import { PluginRegistry } from "./plugin/registry";
import type { Plugin, PluginMeta, PluginHealth } from "./plugin/types";

// ── Cron ──
import { CronService } from "./cron/service";
import { CronJobStore } from "./cron/store";
import { registerCognitiveTriggers, DEFAULT_COGNITIVE_SCHEDULE } from "./cron/cognitive-trigger";
import type { CronSchedule, CronJob } from "./cron/types";
import { nextJobId } from "./cron/types";

// ═══════════════════════════════════════════════════════════════
// MCP — Tool Loader
// ═══════════════════════════════════════════════════════════════

describe("MCP Tool Loader", () => {
  const mockSchema: McpToolSchema = {
    name: "read_file",
    description: "Read a file from disk",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        maxLines: { type: "integer", description: "Max lines to read", default: 100 },
        encoding: { type: "string", enum: ["utf-8", "ascii"] },
        enableHighlight: { type: "boolean" },
        filters: { type: "array" },
        metadata: { type: "object" },
      },
      required: ["path"],
    },
  };

  it("converts MCP schema to ToolDef with proper prefix", () => {
    const client = {} as any;
    const tool = mcpToolToDef(client, "filesystem", mockSchema);
    expect(tool.name).toBe("mcp_filesystem__read_file");
    expect(tool.description).toContain("Read a file");
    expect(tool.isReadOnly).toBe(false);
    expect(tool.riskLevel).toBe("medium");
  });

  it("handles empty inputSchema", () => {
    const client = {} as any;
    const schema: McpToolSchema = {
      name: "simple",
      description: "Simple tool",
      inputSchema: { type: "object" },
    };
    const tool = mcpToolToDef(client, "test", schema);
    expect(tool.name).toBe("mcp_test__simple");
  });

  it("MCP tool formatResult returns plain output", () => {
    const client = {} as any;
    const tool = mcpToolToDef(client, "test", mockSchema);
    expect(tool.formatResult("plain output")).toBe("plain output");
  });

  it("MCP tool formatError wraps error", () => {
    const client = {} as any;
    const tool = mcpToolToDef(client, "test", mockSchema);
    expect(tool.formatError("something broke")).toContain("something broke");
  });
});

// ═══════════════════════════════════════════════════════════════
// Channels — Registry
// ═══════════════════════════════════════════════════════════════

describe("ChannelRegistry", () => {
  let registry: ChannelRegistry;

  class MockChannel {
    config = { name: "mock", autoConnect: false, reconnectMs: 0, maxMessageLength: 1000 };
    state = "disconnected" as const;
    connect = async () => { this.state = "connected" as const; };
    disconnect = async () => { this.state = "disconnected" as const; };
    sendText = async (_chatId: string, text: string) => ({ success: true, messageId: "1" });
    onMessageHandlers: Array<(msg: ChannelMessage) => Promise<void>> = [];
    onMessage(h: any) { this.onMessageHandlers.push(h); }
    offMessage(h: any) { this.onMessageHandlers = this.onMessageHandlers.filter(x => x !== h); }
  }

  beforeEach(() => {
    registry = new ChannelRegistry();
  });

  it("registers channels", () => {
    const ch = new MockChannel() as any;
    registry.register(ch);
    expect(registry.get("mock")).toBe(ch);
  });

  it("throws on duplicate registration", () => {
    registry.register(new MockChannel() as any);
    expect(() => registry.register(new MockChannel() as any)).toThrow("already registered");
  });

  it("gets state for all channels", () => {
    registry.register(new MockChannel() as any);
    const states = registry.getStates();
    expect(states.length).toBe(1);
    expect(states[0].name).toBe("mock");
    expect(states[0].status).toBe("disconnected");
  });

  it("sends to specific channel", async () => {
    registry.register(new MockChannel() as any);
    const ok = await registry.sendTo("mock", "chat1", "hello");
    expect(ok).toBe(true);
  });

  it("returns false for unknown channel", async () => {
    const ok = await registry.sendTo("nonexistent", "chat1", "hello");
    expect(ok).toBe(false);
  });

  it("routes incoming messages to agent handler", async () => {
    const ch = new MockChannel() as any;
    registry.register(ch);

    let received: ChannelMessage | null = null;
    registry.setAgentHandler(async (msg) => {
      received = msg;
      return "reply";
    });

    // Simulate incoming message
    const testMsg: ChannelMessage = { id: "1", text: "hi", senderId: "u1", chatId: "c1", timestamp: Date.now() };
    ch.onMessageHandlers[0](testMsg);

    // Wait for async handler
    await new Promise(r => setTimeout(r, 10));
    expect(received!.text).toBe("hi");
  });
});

// ═══════════════════════════════════════════════════════════════
// Channels — WebSocket
// ═══════════════════════════════════════════════════════════════

describe("WebSocketChannel", () => {
  it("creates with default config", () => {
    const ch = new WebSocketChannel({ url: "ws://localhost:9000" });
    expect(ch.config.name).toBe("websocket");
    expect(ch.config.autoConnect).toBe(true);
    expect(ch.state).toBe("disconnected");
  });

  it("creates with custom config", () => {
    const ch = new WebSocketChannel(
      { url: "ws://localhost:9001", backoffMultiplier: 2, maxReconnectInterval: 5000 },
      { name: "custom-ws", autoConnect: false, reconnectMs: 0, maxMessageLength: 500 },
    );
    expect(ch.config.name).toBe("custom-ws");
    expect(ch.config.autoConnect).toBe(false);
    expect(ch.config.maxMessageLength).toBe(500);
  });

  it("sendText fails when not connected", async () => {
    const ch = new WebSocketChannel({ url: "ws://localhost:9999" });
    const result = await ch.sendText("chat1", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not connected");
  });

  it("registers and removes message handlers", () => {
    const ch = new WebSocketChannel({ url: "ws://localhost:9999" });
    const h = async () => {};
    ch.onMessage(h);
    ch.offMessage(h);
    // No crash = success
  });
});

// ═══════════════════════════════════════════════════════════════
// Plugin — Registry
// ═══════════════════════════════════════════════════════════════

describe("PluginRegistry", () => {
  function makePlugin(name: string, type: PluginMeta["type"], deps: string[] = []): Plugin {
    let initialized = false;
    let cleaned = false;
    return {
      meta: { name, type, label: name, version: "1.0.0", dependsOn: deps },
      init: async () => { initialized = true; },
      cleanup: async () => { cleaned = true; },
      health: async (): Promise<PluginHealth> => ({ status: "ok" }),
    };
  }

  it("registers and retrieves plugins", () => {
    const reg = new PluginRegistry();
    const p = makePlugin("test", "provider");
    reg.register(p);
    expect(reg.get("test")).toBe(p);
  });

  it("throws on duplicate registration", () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin("dup", "tool"));
    expect(() => reg.register(makePlugin("dup", "tool"))).toThrow("already registered");
  });

  it("lists plugins by type", () => {
    const reg = new PluginRegistry();
    reg.register(makePlugin("p1", "provider"));
    reg.register(makePlugin("t1", "tool"));
    reg.register(makePlugin("p2", "provider"));
    expect(reg.listByType("provider").length).toBe(2);
    expect(reg.listByType("tool").length).toBe(1);
    expect(reg.listByType("channel").length).toBe(0);
  });

  it("initializes all plugins in dependency order", async () => {
    const reg = new PluginRegistry();
    let initOrder: string[] = [];
    reg.register({
      meta: { name: "base", type: "provider", label: "Base", version: "1.0" },
      init: async () => { initOrder.push("base"); },
      cleanup: async () => {},
      health: async () => ({ status: "ok" }),
    });
    reg.register({
      meta: { name: "child", type: "provider", label: "Child", version: "1.0", dependsOn: ["base"] },
      init: async () => { initOrder.push("child"); },
      cleanup: async () => {},
      health: async () => ({ status: "ok" }),
    });
    await reg.initAll();
    expect(initOrder[0]).toBe("base");
    expect(initOrder[1]).toBe("child");
  });

  it("cleanupAll runs in reverse init order", async () => {
    const reg = new PluginRegistry();
    let cleanupOrder: string[] = [];
    reg.register({
      meta: { name: "a", type: "tool", label: "A", version: "1.0" },
      init: async () => {},
      cleanup: async () => { cleanupOrder.push("a"); },
      health: async () => ({ status: "ok" }),
    });
    reg.register({
      meta: { name: "b", type: "tool", label: "B", version: "1.0", dependsOn: ["a"] },
      init: async () => {},
      cleanup: async () => { cleanupOrder.push("b"); },
      health: async () => ({ status: "ok" }),
    });
    await reg.initAll();
    await reg.cleanupAll();
    expect(cleanupOrder[0]).toBe("b"); // child first
    expect(cleanupOrder[1]).toBe("a"); // parent last
  });

  it("continues init even if one plugin fails", async () => {
    const reg = new PluginRegistry();
    let secondInit = false;
    reg.register({
      meta: { name: "failer", type: "tool", label: "Fail", version: "1.0" },
      init: async () => { throw new Error("boom"); },
      cleanup: async () => {},
      health: async () => ({ status: "ok" }),
    });
    reg.register({
      meta: { name: "survivor", type: "tool", label: "Survive", version: "1.0" },
      init: async () => { secondInit = true; },
      cleanup: async () => {},
      health: async () => ({ status: "ok" }),
    });
    await reg.initAll();
    expect(secondInit).toBe(true);
  });

  it("handles circular dependencies gracefully", async () => {
    const reg = new PluginRegistry();
    reg.register({
      meta: { name: "x", type: "tool", label: "X", version: "1.0", dependsOn: ["y"] },
      init: async () => {},
      cleanup: async () => {},
      health: async () => ({ status: "ok" }),
    });
    reg.register({
      meta: { name: "y", type: "tool", label: "Y", version: "1.0", dependsOn: ["x"] },
      init: async () => {},
      cleanup: async () => {},
      health: async () => ({ status: "ok" }),
    });
    // Should not hang or throw
    await reg.initAll();
  });
});

// ═══════════════════════════════════════════════════════════════
// Cron — Store
// ═══════════════════════════════════════════════════════════════

describe("CronJobStore", () => {
  it("returns empty store for missing file", () => {
    const store = new CronJobStore("/tmp/nonexistent-cron-test-dir");
    const data = store.load();
    expect(data.version).toBe(1);
    expect(data.jobs).toEqual([]);
  });

  it("round-trips jobs through save/load", () => {
    const store = new CronJobStore("/tmp/cron-test-dir");
    const job: CronJob = {
      id: nextJobId(),
      name: "test-job",
      enabled: true,
      schedule: { kind: "every", everyMs: 60000 },
      payload: { kind: "agent_turn", message: "ping" },
      state: { nextRunAtMs: null, lastRunAtMs: null, lastStatus: null, lastError: null, runHistory: [] },
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      deleteAfterRun: false,
    };
    store.save({ version: 1, jobs: [job] });
    const loaded = store.load();
    expect(loaded.jobs.length).toBe(1);
    expect(loaded.jobs[0].name).toBe("test-job");
    expect(loaded.jobs[0].schedule.kind).toBe("every");
    expect(loaded.jobs[0].schedule.everyMs).toBe(60000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cron — Service
// ═══════════════════════════════════════════════════════════════

describe("CronService", () => {
  it("starts and stops without errors", async () => {
    const svc = new CronService("/tmp/cron-test-svc");
    svc.start();
    await svc.stop();
  });

  it("adds and retrieves jobs", () => {
    const svc = new CronService("/tmp/cron-test-svc");
    const job = svc.addJob({
      name: "test",
      schedule: { kind: "every", everyMs: 3600_000 },
      payload: { kind: "cognitive_event", cognitiveEvent: { module: "drive_check" } },
    });
    expect(job.id).toBeDefined();
    expect(svc.list().length).toBe(1);
    expect(svc.get(job.id)!.name).toBe("test");
  });

  it("enables and disables jobs", () => {
    const svc = new CronService("/tmp/cron-test-svc");
    const job = svc.addJob({
      name: "toggle",
      schedule: { kind: "every", everyMs: 1000 },
      payload: { kind: "agent_turn" },
    });
    expect(svc.setEnabled(job.id, false)).toBe(true);
    expect(svc.get(job.id)!.enabled).toBe(false);
    expect(svc.setEnabled(job.id, true)).toBe(true);
    expect(svc.get(job.id)!.enabled).toBe(true);
  });

  it("removes jobs", () => {
    const svc = new CronService("/tmp/cron-test-svc");
    const job = svc.addJob({
      name: "remove-me",
      schedule: { kind: "every", everyMs: 1000 },
      payload: { kind: "agent_turn" },
    });
    expect(svc.list().length).toBe(1);
    expect(svc.removeJob(job.id)).toBe(true);
    expect(svc.list().length).toBe(0);
    expect(svc.removeJob("nonexistent")).toBe(false);
  });

  it("fires callbacks when job executes", async () => {
    const svc = new CronService("/tmp/cron-test-svc");
    let fired = false;

    const job = svc.addJob({
      name: "fire-test",
      schedule: { kind: "at", atMs: Date.now() + 50 },
      payload: { kind: "cognitive_event", cognitiveEvent: { module: "boredom_check" } },
      deleteAfterRun: true,
    });

    svc.on(job.id, async (_j) => { fired = true; });
    svc.start();

    // Wait for the at-timer to fire
    await new Promise(r => setTimeout(r, 200));
    expect(fired).toBe(true);

    await svc.stop();
  });

  it("global callback fires for all jobs", async () => {
    const svc = new CronService("/tmp/cron-test-svc");
    let globalFired = 0;

    svc.addJob({
      name: "j1",
      schedule: { kind: "at", atMs: Date.now() + 50 },
      payload: { kind: "agent_turn" },
      deleteAfterRun: true,
    });
    svc.addJob({
      name: "j2",
      schedule: { kind: "at", atMs: Date.now() + 50 },
      payload: { kind: "agent_turn" },
      deleteAfterRun: true,
    });

    svc.onAll(async () => { globalFired++; });
    svc.start();

    await new Promise(r => setTimeout(r, 200));
    expect(globalFired).toBe(2);

    await svc.stop();
  });

  it("computeNextRun handles 'at' schedule", () => {
    const svc = new CronService("/tmp/cron-test-at");
    const future = Date.now() + 10000;
    const job = svc.addJob({
      name: "at-test",
      schedule: { kind: "at", atMs: future },
      payload: { kind: "agent_turn" },
    });
    expect(job.state.nextRunAtMs).toBe(future);
  });

  it("computeNextRun handles 'every' schedule", () => {
    const svc = new CronService("/tmp/cron-test-every");
    const job = svc.addJob({
      name: "every-test",
      schedule: { kind: "every", everyMs: 60000 },
      payload: { kind: "agent_turn" },
    });
    expect(job.state.nextRunAtMs).toBeGreaterThan(Date.now());
    expect(job.state.nextRunAtMs!).toBeLessThanOrEqual(Date.now() + 60100);
  });

  it("computeNextRun handles cron expression '0 9 * * *'", () => {
    const svc = new CronService("/tmp/cron-test-cron");
    const job = svc.addJob({
      name: "cron-test",
      schedule: { kind: "cron", expr: "0 9 * * *" },
      payload: { kind: "agent_turn" },
    });
    const nextDate = new Date(job.state.nextRunAtMs!);
    expect(nextDate.getMinutes()).toBe(0);
    // Next run should be in the future
    expect(job.state.nextRunAtMs!).toBeGreaterThan(Date.now());
  });

  it("computeNextRun handles '*/15 * * * *' interval", () => {
    const svc = new CronService("/tmp/cron-test-interval");
    const job = svc.addJob({
      name: "interval-test",
      schedule: { kind: "cron", expr: "*/15 * * * *" },
      payload: { kind: "agent_turn" },
    });
    expect(job.state.nextRunAtMs).toBeGreaterThan(Date.now());
  });

  it("returns null for past 'at' schedule", () => {
    const svc = new CronService("/tmp/cron-test-past");
    const job = svc.addJob({
      name: "past-test",
      schedule: { kind: "at", atMs: Date.now() - 10000 },
      payload: { kind: "agent_turn" },
    });
    // After scheduling, past atMs should set nextRunAtMs to null
    expect(job.state.nextRunAtMs).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Cron — Cognitive Triggers
// ═══════════════════════════════════════════════════════════════

describe("CognitiveTriggers", () => {
  it("registers all 6 default cognitive jobs", () => {
    const svc = new CronService("/tmp/cron-cognitive-test");
    let count = 0;
    registerCognitiveTriggers(svc, async () => { count++; });
    const jobs = svc.list();
    expect(jobs.length).toBe(6);
    const names = jobs.map(j => j.name);
    expect(names).toContain("cognitive:drive_check");
    expect(names).toContain("cognitive:deep_reflection");
    expect(names).toContain("cognitive:boredom_check");
    expect(names).toContain("cognitive:horizon_review");
    expect(names).toContain("cognitive:memory_consolidation");
    expect(names).toContain("cognitive:mood_update");
  });

  it("all cognitive jobs have cognitive_event payload", () => {
    const svc = new CronService("/tmp/cron-cognitive-payload");
    registerCognitiveTriggers(svc, async () => {});
    for (const job of svc.list()) {
      expect(job.payload.kind).toBe("cognitive_event");
      expect(job.payload.cognitiveEvent).toBeDefined();
      expect(job.payload.message).toBeUndefined();
    }
  });

  it("drive_check runs every 30 min by default", () => {
    const svc = new CronService("/tmp/cron-cognitive-drive");
    registerCognitiveTriggers(svc, async () => {});
    const job = svc.list().find(j => j.name === "cognitive:drive_check")!;
    expect(job.schedule.everyMs).toBe(1_800_000);
  });

  it("supports custom intervals", () => {
    const svc = new CronService("/tmp/cron-cognitive-custom");
    registerCognitiveTriggers(svc, async () => {}, {
      driveCheckMs: 60_000,  // 1 min instead of 30
      boredomCheckMs: 10_000, // 10s instead of 5 min
    });
    const driveJob = svc.list().find(j => j.name === "cognitive:drive_check")!;
    expect(driveJob.schedule.everyMs).toBe(60_000);
  });
});
