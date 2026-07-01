/**
 * PluginRegistry — unified lifecycle management for all plugin types.
 *
 * Handles:
 *   - Registration and discovery by type
 *   - Dependency-aware initialization (topological sort)
 *   - Health monitoring
 *   - Graceful cleanup (reverse init order)
 */

import type { Plugin, PluginType, PluginMeta, PluginHealth } from "./types";

// ═══════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private states = new Map<string, "registered" | "initialized" | "error" | "cleaned">();
  private initOrder: string[] = [];

  // ═══════════════════════════════════════════════════════════
  // Registration
  // ═══════════════════════════════════════════════════════════

  register(plugin: Plugin): void {
    const name = plugin.meta.name;
    if (this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is already registered`);
    }
    this.plugins.set(name, plugin);
    this.states.set(name, "registered");
  }

  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    this.plugins.delete(name);
    this.states.delete(name);
    this.initOrder = this.initOrder.filter(n => n !== name);
    return true;
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  // ═══════════════════════════════════════════════════════════
  // Query by type
  // ═══════════════════════════════════════════════════════════

  listByType(type: PluginType): Plugin[] {
    return [...this.plugins.values()].filter(p => p.meta.type === type);
  }

  listAll(): Plugin[] {
    return [...this.plugins.values()];
  }

  /** List all plugins with their state */
  listStates(): Array<{ meta: PluginMeta; state: string; health?: PluginHealth }> {
    return [...this.plugins.values()].map(p => ({
      meta: p.meta,
      state: this.states.get(p.meta.name) ?? "unknown",
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize all registered plugins in dependency order.
   *
   * Plugins with dependencies are initialized after their dependencies.
   * If any plugin fails to initialize, the error is recorded, but
   * initialization continues for remaining plugins (best-effort).
   */
  async initAll(): Promise<void> {
    const sorted = this.topoSort();
    this.initOrder = [];

    for (const name of sorted) {
      const plugin = this.plugins.get(name);
      if (!plugin) continue;

      try {
        await plugin.init();
        this.states.set(name, "initialized");
        this.initOrder.push(name);
      } catch (err: any) {
        console.error(`[plugin] Failed to initialize "${name}": ${err.message}`);
        this.states.set(name, "error");
        // Continue initializing remaining plugins (best-effort)
      }
    }
  }

  /**
   * Initialize a single plugin (and its dependencies).
   */
  async initOne(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) throw new Error(`Plugin "${name}" not found`);

    // Init dependencies first
    for (const dep of plugin.meta.dependsOn ?? []) {
      if (this.states.get(dep) !== "initialized") {
        await this.initOne(dep);
      }
    }

    await plugin.init();
    this.states.set(name, "initialized");
    if (!this.initOrder.includes(name)) {
      this.initOrder.push(name);
    }
  }

  /**
   * Cleanup all plugins in reverse initialization order.
   */
  async cleanupAll(): Promise<void> {
    // Reverse init order: last-initialized cleans up first
    for (const name of [...this.initOrder].reverse()) {
      const plugin = this.plugins.get(name);
      if (!plugin) continue;

      try {
        await plugin.cleanup();
        this.states.set(name, "cleaned");
      } catch (err: any) {
        console.error(`[plugin] Failed to cleanup "${name}": ${err.message}`);
      }
    }
    this.initOrder = [];
  }

  /**
   * Run health checks on all initialized plugins.
   */
  async healthAll(): Promise<Map<string, PluginHealth>> {
    const results = new Map<string, PluginHealth>();
    for (const name of this.initOrder) {
      const plugin = this.plugins.get(name);
      if (!plugin) continue;
      try {
        results.set(name, await plugin.health());
      } catch (err: any) {
        results.set(name, {
          status: "error",
          message: err.message,
          checkedAt: Date.now(),
        });
      }
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // Dependency resolution (topological sort)
  // ═══════════════════════════════════════════════════════════

  private topoSort(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    function visit(name: string) {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        console.warn(`[plugin] Circular dependency detected involving "${name}", skipping`);
        return;
      }

      visiting.add(name);
      const plugin = registry.plugins.get(name);
      if (plugin) {
        for (const dep of plugin.meta.dependsOn ?? []) {
          if (registry.plugins.has(dep)) {
            visit(dep);
          } else {
            console.warn(`[plugin] "${name}" depends on unknown plugin "${dep}"`);
          }
        }
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    }

    // Use the outer `this` reference
    const registry = this;
    for (const name of this.plugins.keys()) {
      visit(name);
    }

    return order;
  }
}
