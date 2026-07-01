/**
 * MCP Types — Model Context Protocol client types.
 *
 * Minimal implementation of the MCP protocol for tool discovery and execution.
 * Supports stdio transport (npm exec, npx, python, etc.) and SSE/HTTP transport.
 */

// ═══════════════════════════════════════════════════════════════
// JSON-RPC 2.0 message types
// ═══════════════════════════════════════════════════════════════

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ═══════════════════════════════════════════════════════════════
// MCP Server config
// ═══════════════════════════════════════════════════════════════

export interface McpServerConfig {
  /** Unique name for this MCP server */
  name: string;
  /** Command to launch the server (stdio mode) or URL (HTTP mode) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables to pass to the server process */
  env?: Record<string, string>;
  /** HTTP/SSE URL (alternative to command) */
  url?: string;
  /** Transport type */
  transport: "stdio" | "http";
  /** Auto-start on agent initialization */
  autoStart?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// MCP Tool schema (as received from server)
// ═══════════════════════════════════════════════════════════════

export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

// ═══════════════════════════════════════════════════════════════
// MCP Server info
// ═══════════════════════════════════════════════════════════════

export interface McpServerInfo {
  name: string;
  version: string;
  tools: McpToolSchema[];
}

// ═══════════════════════════════════════════════════════════════
// MCP Connection state
// ═══════════════════════════════════════════════════════════════

export type McpConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface McpServerState {
  config: McpServerConfig;
  state: McpConnectionState;
  connectedAt?: number;
  error?: string;
  toolCount: number;
}
