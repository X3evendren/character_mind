/**
 * MCP Tool Loader — convert MCP server tools to ToolDef and register them.
 *
 * Bridges the MCP protocol to character-mind's ToolRegistry. Each MCP server's
 * tools get the prefix "mcp_{serverName}__" to avoid name collisions and
 * to identify them as external tools.
 */

import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "../tools/types";
import { successResult, errorResult } from "../tools/types";
import type { ToolRegistry } from "../tools/registry";
import type { McpClient } from "./client";
import type { McpToolSchema } from "./types";

/**
 * Convert an MCP tool schema to a character-mind ToolDef.
 *
 * MCP inputSchema → Zod schema (loose — we validate minimally)
 * Tool name is prefixed with "mcp_{serverName}__"
 */
export function mcpToolToDef(
  client: McpClient,
  serverName: string,
  schema: McpToolSchema,
): ToolDef {
  const fullName = `mcp_${serverName}__${schema.name}`;

  // Build a loose Zod schema from MCP inputSchema
  const zodSchema = mcpSchemaToZod(schema.inputSchema);

  return {
    name: fullName,
    description: schema.description ?? `MCP tool: ${schema.name} (from ${serverName})`,
    parameters: zodSchema,
    isReadOnly: false, // MCP tools can be anything — we don't know statically
    isDestructive: false,
    isConcurrencySafe: true,
    riskLevel: "medium",

    async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      if (ctx.signal?.aborted) {
        return errorResult("Tool execution cancelled");
      }

      ctx.onProgress?.(`[mcp:${serverName}] Calling ${schema.name}...`);

      try {
        const result = await client.callTool(schema.name, params);

        if (result.isError) {
          const errorText = result.content
            .map(c => c.text ?? "")
            .join("\n");
          return errorResult(errorText || "MCP tool returned an error");
        }

        const output = result.content
          .map(c => c.text ?? c.data ?? "")
          .join("\n");

        return successResult(output);
      } catch (err: any) {
        return errorResult(`MCP tool error: ${err?.message ?? "unknown"}`);
      }
    },

    formatResult(output: string): string {
      return output;
    },

    formatError(error: string): string {
      return `MCP tool failed: ${error}`;
    },
  };
}

/**
 * Load all tools from an MCP server and register them in the ToolRegistry.
 *
 * Returns the list of tool names registered (for cleanup on disconnect).
 */
export async function loadMcpTools(
  client: McpClient,
  serverName: string,
  registry: ToolRegistry,
): Promise<string[]> {
  const schemas = await client.listTools();
  const names: string[] = [];

  for (const schema of schemas) {
    const tool = mcpToolToDef(client, serverName, schema);
    registry.register(tool);
    names.push(tool.name);
  }

  return names;
}

/**
 * Unregister all tools from a specific MCP server.
 */
export function unloadMcpTools(
  names: string[],
  registry: ToolRegistry,
): void {
  for (const name of names) {
    registry.unregister(name);
  }
}

// ═══════════════════════════════════════════════════════════════
// Internal: convert MCP JSON Schema to Zod
// ═══════════════════════════════════════════════════════════════

function mcpSchemaToZod(schema: McpToolSchema["inputSchema"]): z.ZodTypeAny {
  if (!schema || schema.type !== "object" || !schema.properties) {
    return z.object({}).passthrough();
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case "string":
        zodType = z.string();
        if (prop.enum && prop.enum.length > 0) {
          zodType = z.enum(prop.enum as [string, ...string[]]);
        }
        break;
      case "number":
      case "integer":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        zodType = z.array(z.any());
        break;
      case "object":
        zodType = z.record(z.string(), z.any());
        break;
      default:
        zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (prop.default !== undefined) {
      zodType = zodType.default(prop.default);
    }

    // Make non-required fields optional
    if (!schema.required?.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape).passthrough();
}
