/**
 * MCP (Model Context Protocol) — external tool integration.
 *
 * Connects to external MCP servers (e.g., filesystem, github, postgres)
 * and registers their tools in the main ToolRegistry.
 */

export { McpClient } from "./client";
export { loadMcpTools, unloadMcpTools, mcpToolToDef } from "./tool-loader";

export type {
  McpServerConfig,
  McpServerInfo,
  McpServerState,
  McpToolSchema,
  McpConnectionState,
} from "./types";
