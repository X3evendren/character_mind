/**
 * Subagent Tool — registers "delegate_subagent" in the main ToolRegistry.
 *
 * When the main agent calls this tool, a subagent is spawned in the background,
 * executes the task, and returns a concise result. This is how the main
 * consciousness delegates work without losing its personality.
 */

import { z } from "zod";
import type { ToolDef, ToolContext, ToolResult } from "../tools/types";
import { successResult, errorResult } from "../tools/types";
import { SubagentManager } from "./manager";

/** Parameters the main agent passes when spawning a subagent */
const SubagentParams = z.object({
  instruction: z.string().describe("What the subagent should do (natural language instruction)"),
  context: z.string().optional().describe("Additional context (file contents, memory, etc.)"),
  tool_policy: z.enum(["all", "readonly"]).optional().default("readonly")
    .describe("Which tools the subagent can use: 'readonly' (safer) or 'all'"),
  max_turns: z.number().min(1).max(20).optional().default(5)
    .describe("Maximum conversation turns before forced termination"),
});

type SubagentParams = z.infer<typeof SubagentParams>;

/**
 * Create the "delegate_subagent" tool definition.
 *
 * The tool wraps SubagentManager.run() and formats the result for
 * consumption by the main agent's context.
 */
export function createSubagentTool(manager: SubagentManager): ToolDef<SubagentParams, any> {
  return {
    name: "delegate_subagent",
    aliases: ["subagent", "spawn_worker"],
    description:
      "Spawn a background worker to execute a task independently. " +
      "The worker has no personality and returns a concise result. " +
      "Use this for tasks that require multiple tool calls (search + read + analyze) " +
      "or tasks you want to run in parallel. The worker shares your filesystem. " +
      "Example: 'Search for all TypeScript files that import from deprecated modules' " +
      "or 'Read the last 50 lines of every log file and summarize patterns'.",
    parameters: SubagentParams,
    isReadOnly: false, // subagent may use write tools if tool_policy="all"
    isDestructive: false,
    isConcurrencySafe: true,
    riskLevel: "medium",

    async execute(params: SubagentParams, ctx: ToolContext): Promise<ToolResult> {
      // Check for cancellation
      if (ctx.signal?.aborted) {
        return errorResult("Subagent cancelled before start");
      }

      ctx.onProgress?.(`Spawning subagent: ${params.instruction.slice(0, 80)}...`);

      const result = await manager.run({
        instruction: params.instruction,
        context: params.context,
        toolPolicy: params.tool_policy ?? "readonly",
        maxTurns: params.max_turns ?? 5,
      });

      // Format result for main agent consumption
      const formatted = formatSubagentResult(result);
      return successResult(formatted, result);
    },

    formatResult(result: any): string {
      return formatSubagentResult(result);
    },

    formatError(error: string): string {
      return `Subagent failed: ${error}`;
    },
  };
}

function formatSubagentResult(r: any): string {
  const statusIcon = r.status === "done" ? "✓" : r.status === "timeout" ? "⏱" : "✗";
  let out = `${statusIcon} Subagent ${r.taskId}: ${r.status}\n`;
  out += `Turns: ${r.turns} | Time: ${(r.elapsedMs / 1000).toFixed(1)}s\n`;

  if (r.toolCalls && r.toolCalls.length > 0) {
    out += `\nTool calls (${r.toolCalls.length}):\n`;
    for (const tc of r.toolCalls) {
      const icon = tc.success ? "✓" : "✗";
      out += `  ${icon} ${tc.tool} → ${tc.output.slice(0, 150)}${tc.output.length > 150 ? "..." : ""}\n`;
    }
  }

  if (r.output) {
    out += `\nResult:\n${r.output}\n`;
  }

  if (r.error) {
    out += `\nError: ${r.error}\n`;
  }

  return out;
}
