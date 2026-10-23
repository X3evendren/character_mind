export { CharacterAgent } from "./agent";
export type { AgentHook, TurnContext } from "./agent";
export { ResponseGenerator } from "./response-generator";
export { OpenAICompatProvider } from "./provider";
export type { LLMResponse, ToolCall } from "./provider";
export { loadCharacterConfig } from "./config-loader";
export type { CharacterConfig } from "./config-loader";
export { PROVIDERS, detectProvider, resolveProvider } from "./provider-registry";
export type { ProviderSpec, ResolvedProvider } from "./provider-registry";
export { ContinuousLoop } from "./loop";

// v4 event protocol
export type { TurnEvent, RunOptions, RunResult, TurnPhase } from "./events";
