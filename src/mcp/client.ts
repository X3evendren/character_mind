/**
 * MCP Client — connect to external MCP servers via stdio or HTTP transport.
 *
 * Minimal MCP protocol implementation:
 *   - initialize → list tools → call tool
 *   - JSON-RPC 2.0 over stdin/stdout (stdio) or fetch (HTTP)
 */

import { spawn, type ChildProcess } from "child_process";
import type {
  McpServerConfig,
  McpServerInfo,
  McpServerState,
  McpConnectionState,
  McpToolSchema,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// Client
// ═══════════════════════════════════════════════════════════════

export class McpClient {
  private config: McpServerConfig;
  private state: McpConnectionState = "disconnected";

  // Stdio transport
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = "";

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  get connectionState(): McpConnectionState {
    return this.state;
  }

  // ═══════════════════════════════════════════════════════════
  // Connection lifecycle
  // ═══════════════════════════════════════════════════════════

  async connect(): Promise<McpServerInfo> {
    if (this.config.transport === "stdio") {
      return this.connectStdio();
    }
    return this.connectHttp();
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.state = "disconnected";
    this.pending.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // Tool operations
  // ═══════════════════════════════════════════════════════════

  async listTools(): Promise<McpToolSchema[]> {
    const result = await this.sendRequest("tools/list", {});
    return (result as { tools: McpToolSchema[] })?.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text?: string; data?: string }>;
    isError?: boolean;
  }> {
    const result = await this.sendRequest("tools/call", {
      name,
      arguments: args,
    });
    return result as any;
  }

  /** Get state snapshot for monitoring */
  getState(): McpServerState {
    return {
      config: this.config,
      state: this.state,
      toolCount: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Stdio transport
  // ═══════════════════════════════════════════════════════════

  private async connectStdio(): Promise<McpServerInfo> {
    this.state = "connecting";

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = [
        this.config.command ?? "npx",
        ...(this.config.args ?? []),
      ];

      this.process = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...this.config.env },
      });

      const timeout = setTimeout(() => {
        this.state = "error";
        reject(new Error(`MCP server ${this.config.name} connection timeout`));
      }, 30_000);

      // Read stdout for JSON-RPC responses
      this.process.stdout?.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      // Log stderr for debugging
      this.process.stderr?.on("data", (chunk: Buffer) => {
        // MCP servers often log to stderr — not an error
      });

      this.process.on("error", (err) => {
        this.state = "error";
        clearTimeout(timeout);
        reject(err);
      });

      this.process.on("exit", (code) => {
        if (this.state !== "disconnected" && code !== 0 && code !== null) {
          this.state = "error";
        }
      });

      // Send initialize
      this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        clientInfo: { name: "character-mind", version: "4.0.0" },
      })
        .then((initResult) => {
          clearTimeout(timeout);
          this.state = "connected";

          // Send initialized notification
          this.sendNotification("notifications/initialized", {});

          const result = initResult as Record<string, unknown>;
          resolve({
            name: (result?.serverInfo as any)?.name ?? this.config.name,
            version: (result?.serverInfo as any)?.version ?? "unknown",
            tools: [],
          });
        })
        .catch((err) => {
          clearTimeout(timeout);
          this.state = "error";
          reject(err);
        });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // HTTP transport (SSE)
  // ═══════════════════════════════════════════════════════════

  private async connectHttp(): Promise<McpServerInfo> {
    this.state = "connecting";
    const url = this.config.url ?? "http://localhost:3000/mcp";

    try {
      // Initialize
      const initResult = await this.httpRequest(url, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        clientInfo: { name: "character-mind", version: "4.0.0" },
      });

      this.state = "connected";

      const result = initResult as Record<string, unknown>;
      return {
        name: (result?.serverInfo as any)?.name ?? this.config.name,
        version: (result?.serverInfo as any)?.version ?? "unknown",
        tools: [],
      };
    } catch (err: any) {
      this.state = "error";
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // JSON-RPC messaging
  // ═══════════════════════════════════════════════════════════

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    if (this.config.transport === "http") {
      return this.httpRequest(this.config.url!, method, params);
    }

    // Stdio: write to process stdin
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const payload = JSON.stringify(request) + "\n";
      this.process?.stdin?.write(payload);

      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request ${method} timed out`));
        }
      }, 30_000);
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = { jsonrpc: "2.0" as const, method, params };
    const payload = JSON.stringify(notification) + "\n";
    this.process?.stdin?.write(payload);
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id !== undefined && this.pending.has(msg.id as number)) {
          const { resolve, reject } = this.pending.get(msg.id as number)!;
          this.pending.delete(msg.id as number);

          if (msg.error) {
            reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  private async httpRequest(
    url: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.requestId,
        method,
        params,
      }),
    });

    if (!resp.ok) {
      throw new Error(`MCP HTTP ${resp.status}: ${await resp.text().catch(() => "unknown")}`);
    }

    const data: any = await resp.json();
    if (data.error) {
      throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
    }

    return data.result;
  }
}
