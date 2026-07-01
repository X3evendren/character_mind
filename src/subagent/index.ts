/**
 * Subagent System — barrel export.
 *
 * Background task delegation for character-mind agent.
 * Subagents are tool-only workers with no personality.
 */

export { SubagentManager } from "./manager";
export { SubagentMemory } from "./memory";
export { buildSubagentPrompt } from "./prompt";
export { createSubagentTool } from "./tool";
export { createIsolation } from "./isolation";

export type {
  SubagentTask,
  SubagentResult,
  SubagentState,
  SubagentStatus,
} from "./types";

export { DEFAULT_MAX_TURNS, DEFAULT_TIMEOUT_MS, nextTaskId } from "./types";
