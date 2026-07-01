/**
 * SubagentManager — spawn, run, and reap background subagents.
 *
 * A subagent is a mini agent loop: it receives a task instruction,
 * optionally calls tools, and returns a concise result.
 *
 * The SubagentManager exposes a single method: run(task) → SubagentResult.
 * It can be registered as a tool in the main ToolRegistry so the main
 * agent can delegate to it via normal tool-calling.
 */

import type { IProvider } from "../providers/types";
import type { ToolRegistry } from "../tools/registry";
import type { ToolDef } from "../tools/types";
import type {
  SubagentTask,
  SubagentResult,
  SubagentState,
  SubagentStatus,
} from "./types";
import { DEFAULT_MAX_TURNS, DEFAULT_TIMEOUT_MS, nextTaskId } from "./types";
import { SubagentMemory } from "./memory";
import { buildSubagentPrompt } from "./prompt";
import { createIsolation } from "./isolation";

// ═══════════════════════════════════════════════════════════════
// SubagentManager
// ═══════════════════════════════════════════════════════════════

export class SubagentManager {
  private provider: IProvider;
  private toolRegistry: ToolRegistry;

  /** Active subagent states (for monitoring / cancellation) */
  private activeStates = new Map<string, SubagentState>();
  private abortControllers = new Map<string, AbortController>();

  constructor(provider: IProvider, toolRegistry: ToolRegistry) {
    this.provider = provider;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Run a subagent task to completion.
   *
   * This is the main entry point. It:
   *   1. Resolves which tools the subagent can use
   *   2. Sets up isolation (shared or worktree)
   *   3. Runs the agent loop: LLM → tool calls → execute → repeat
   *   4. Returns a structured result
   */
  async run(task: Partial<SubagentTask> & { instruction: string }): Promise<SubagentResult> {
    const fullTask: SubagentTask = {
      id: task.id ?? nextTaskId(),
      instruction: task.instruction,
      context: task.context,
      toolPolicy: task.toolPolicy ?? "readonly",
      maxTurns: task.maxTurns ?? DEFAULT_MAX_TURNS,
      timeoutMs: task.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      isolation: task.isolation ?? "shared",
    };

    const startTime = Date.now();
    const memory = new SubagentMemory();
    const abort = new AbortController();
    this.abortControllers.set(fullTask.id, abort);

    const state: SubagentState = {
      task: fullTask,
      status: "running",
      startedAt: startTime,
      turns: 0,
    };
    this.activeStates.set(fullTask.id, state);

    // Set up timeout
    const timeoutTimer = setTimeout(() => {
      abort.abort();
      state.status = "timeout";
    }, fullTask.timeoutMs);

    // Set up isolation
    const isolation = createIsolation(fullTask.isolation);

    try {
      // Resolve tools
      const tools = this.resolveTools(fullTask.toolPolicy);

      // Build system prompt
      const systemPrompt = buildSubagentPrompt(fullTask, tools);
      memory.push({ role: "system", content: systemPrompt });
      memory.push({ role: "user", content: fullTask.instruction });

      // Agent loop
      let conclusion = "";

      for (let turn = 0; turn < fullTask.maxTurns && !abort.signal.aborted; turn++) {
        state.turns = turn + 1;

        // Call LLM
        const messages = memory.getMessages();
        const llmMessages = messages.map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
          ...(m.toolCalls ? {
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          } : {}),
        }));

        const resp = await this.provider.chat(
          llmMessages,
          tools.length > 0 ? tools.map(t => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: (t.parameters as any)?._def ?? {},
            },
          })) : null,
          null,
          2048,
          0.3,
          null,
          undefined,
          abort.signal,
        );

        if (abort.signal.aborted) break;

        // No tool calls → this is the conclusion
        if (!resp.toolCalls || resp.toolCalls.length === 0) {
          conclusion = resp.content ?? "";
          memory.conclusion = conclusion;
          memory.push({ role: "assistant", content: conclusion });
          break;
        }

        // Record assistant message with tool calls
        const assistantContent = resp.content ?? "";
        memory.push({
          role: "assistant",
          content: assistantContent,
          toolCalls: resp.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          })),
        });

        // Execute tools
        for (const tc of resp.toolCalls) {
          if (abort.signal.aborted) break;
          state.lastActivity = `executing ${tc.name}`;

          try {
            const result = await this.toolRegistry.execute(tc.name, tc.arguments, {
              workingDir: isolation.workDir,
              sessionId: `subagent:${fullTask.id}`,
              signal: abort.signal,
            });

            const output = result.success
              ? result.output
              : `Error: ${result.error ?? "unknown error"}`;

            memory.push({
              role: "tool",
              content: output,
              toolCallId: tc.id,
            });
          } catch (err: any) {
            memory.push({
              role: "tool",
              content: `Error: ${err?.message ?? "execution failed"}`,
              toolCallId: tc.id,
            });
          }
        }

        // If last turn, force conclusion from whatever we have
        if (turn === fullTask.maxTurns - 1) {
          conclusion = resp.content ?? "(max turns reached, no conclusion)";
          memory.conclusion = conclusion;
        }
      }

      // If no conclusion reached (all turns consumed), ask LLM for final summary
      if (!conclusion && !abort.signal.aborted) {
        memory.push({
          role: "user",
          content: "You've reached the turn limit. Provide a concise summary of what you accomplished.",
        });

        const finalResp = await this.provider.chat(
          memory.getMessages().map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          null, null, 512, 0.3,
          null, undefined, abort.signal,
        );

        conclusion = finalResp.content ?? "(no conclusion)";
        memory.conclusion = conclusion;
      }

      const status: SubagentStatus = abort.signal.aborted
        ? (state.status === "timeout" ? "timeout" : "cancelled")
        : "done";

      state.status = status;
      state.completedAt = Date.now();

      return {
        taskId: fullTask.id,
        status: state.status as SubagentStatus,
        output: conclusion || "(no output)",
        toolCalls: memory.getToolCallHistory(),
        turns: state.turns,
        elapsedMs: (state.completedAt ?? Date.now()) - startTime,
        error: undefined,
      };
    } catch (err: any) {
      state.status = "error";
      state.completedAt = Date.now();

      if (err?.name === "AbortError") {
        return {
          taskId: fullTask.id,
          status: "cancelled",
          output: "(cancelled)",
          toolCalls: memory.getToolCallHistory(),
          turns: state.turns,
          elapsedMs: Date.now() - startTime,
        };
      }

      return {
        taskId: fullTask.id,
        status: "error",
        output: "",
        toolCalls: memory.getToolCallHistory(),
        turns: state.turns,
        elapsedMs: Date.now() - startTime,
        error: err?.message ?? "unknown error",
      };
    } finally {
      clearTimeout(timeoutTimer);
      isolation.cleanup();
      this.activeStates.delete(fullTask.id);
      this.abortControllers.delete(fullTask.id);
    }
  }

  /** Cancel a running subagent by task ID */
  cancel(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /** Get the state of a subagent (for monitoring) */
  getState(taskId: string): SubagentState | undefined {
    return this.activeStates.get(taskId);
  }

  /** List all active subagent states */
  listActive(): SubagentState[] {
    return [...this.activeStates.values()];
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: resolve tool subset based on policy
  // ═══════════════════════════════════════════════════════════

  private resolveTools(policy: SubagentTask["toolPolicy"]): ToolDef[] {
    const allTools = this.toolRegistry.list();

    if (policy === "all") {
      return allTools;
    }

    if (policy === "readonly") {
      return allTools.filter(t => t.isReadOnly);
    }

    // Specific tool name list
    const nameSet = new Set(policy);
    return allTools.filter(t => nameSet.has(t.name));
  }
}
