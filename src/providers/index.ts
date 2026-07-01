/**
 * Providers — barrel export.
 *
 * New canonical location for all LLM provider code.
 * Old exports in src/agent/ are kept as re-exports for backward compatibility.
 */

// Types
export type {
  IProvider,
  LLMResponse,
  ToolCall,
  GenerationSettings,
  StreamCallbacks,
  ProviderSpec,
} from "./types";
export { errorResponse, DEFAULT_GENERATION } from "./types";

// Base
export {
  BaseProvider,
  sanitizeEmptyContent,
  enforceRoleAlternation,
  stripImageContent,
  stripImageContentInPlace,
  parseToolArguments,
  toolArgumentsForReplay,
  resolveStreamIdleTimeoutS,
} from "./base";

// Providers
export { OpenAICompatProvider } from "./openai-compat";
export { AnthropicProvider } from "./anthropic";

// Decorators
export { RetryDecorator, type RetryConfig, type RetryMode } from "./retry-decorator";
export { FallbackDecorator, type FallbackConfig } from "./fallback-decorator";

// Error classification
export {
  ErrorCategory,
  classifyResponse,
  isArrearageResponse,
  extractRetryAfterFromResponse,
  extractRetryAfterFromText,
  extractRetryAfterFromHeaders,
  extractErrorTypeCode,
} from "./error-classifier";

// Registry
export {
  PROVIDERS,
  findByName,
  detectProvider,
  getByModel,
  resolveProvider,
  createDynamicSpec,
} from "./registry";
export type { ResolvedProvider } from "./registry";

// Factory
export {
  ProviderFactory,
  type FactoryConfig,
  type ProviderConfig,
  type ModelPresetConfig,
} from "./factory";
