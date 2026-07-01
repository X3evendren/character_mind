/**
 * Plugin System — layered plugin architecture.
 *
 * Unified lifecycle management for all plugin types:
 *   provider | tool | channel | guard | command | mcp
 */

export { PluginRegistry } from "./registry";
export type { Plugin, PluginMeta, PluginType, PluginHealth } from "./types";
