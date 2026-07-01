/**
 * Plugin Types — layered plugin architecture.
 *
 * Base Plugin interface provides unified lifecycle (init/cleanup/health).
 * Each dimension extends Plugin with its own type constraints:
 *   ProviderPlugin, ToolPlugin, ChannelPlugin, GuardPlugin, CommandPlugin.
 */

// ═══════════════════════════════════════════════════════════════
// Base Plugin
// ═══════════════════════════════════════════════════════════════

export type PluginType = "provider" | "tool" | "channel" | "guard" | "command" | "mcp";

export interface PluginMeta {
  /** Unique plugin name (e.g., "openai", "telegram-channel") */
  name: string;
  /** Plugin type */
  type: PluginType;
  /** Human-readable label */
  label: string;
  /** Semantic version */
  version: string;
  /** Short description */
  description?: string;
  /** Dependencies: plugin names that must be loaded first */
  dependsOn?: string[];
}

export interface PluginHealth {
  /** "ok" | "degraded" | "error" */
  status: "ok" | "degraded" | "error";
  /** Optional diagnostic message */
  message?: string;
  /** Last health check timestamp */
  checkedAt?: number;
}

/**
 * Base Plugin interface.
 * Every plugin, regardless of type, implements this lifecycle.
 */
export interface Plugin {
  readonly meta: PluginMeta;

  /** Initialize the plugin (load config, connect, register). Called once on startup. */
  init(): Promise<void>;

  /** Cleanup (disconnect, save state). Called on shutdown. */
  cleanup(): Promise<void>;

  /** Health check. Returns ok/degraded/error. */
  health(): Promise<PluginHealth>;
}
