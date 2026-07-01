/**
 * ProviderFactory — assembles provider + decorator chains.
 *
 * Ported from nanobot/providers/factory.py + fallback_provider.py.
 *
 * Takes a ResolvedProvider + optional config and produces a fully-wrapped
 * IProvider instance: BaseProvider → RetryDecorator → FallbackDecorator.
 *
 * Usage:
 *   const factory = new ProviderFactory(config);
 *   const provider = await factory.create("deepseek", "deepseek-chat");
 *   const response = await provider.chat(messages);
 */

import type { IProvider } from "./types";
import type { ProviderSpec } from "./types";
import type { ResolvedProvider } from "./registry";
import { resolveProvider, findByName } from "./registry";
import { RetryDecorator, type RetryConfig, type RetryMode } from "./retry-decorator";
import { FallbackDecorator, type FallbackConfig } from "./fallback-decorator";

// ═══════════════════════════════════════════════════════════════
// Config types
// ═══════════════════════════════════════════════════════════════

export interface ProviderConfig {
  /** API key for this provider (overrides env var) */
  apiKey?: string;
  /** API base URL (overrides provider default) */
  apiBase?: string;
  /** Extra HTTP headers */
  extraHeaders?: Record<string, string>;
  /** Extra body params to merge into every request */
  extraBody?: Record<string, unknown>;
  /** Extra query params to append to the URL */
  extraQuery?: Record<string, string>;
  /** Proxy URL */
  proxy?: string;
  /** Thinking style override */
  thinkingStyle?: string;
  /** Model-specific overrides (e.g., temperature floor) */
  modelOverrides?: Record<string, { temperature?: number; maxTokens?: number }>;
}

export interface ModelPresetConfig {
  model: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string;
  contextWindowTokens?: number;
}

export interface FactoryConfig {
  /** Provider configurations, keyed by provider name */
  providers?: Record<string, ProviderConfig>;
  /** Model presets (named presets for quick switching) */
  modelPresets?: Record<string, ModelPresetConfig>;
  /** Default retry mode for all providers */
  retryMode?: RetryMode;
  /** Default retry config */
  retry?: Partial<RetryConfig>;
  /** Fallback providers (model names), tried in order on primary failure */
  fallbackModels?: string[];
  /** On-retry-wait UI callback */
  onRetryWait?: (message: string) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export class ProviderFactory {
  private config: FactoryConfig;
  private providerCache = new Map<string, IProvider>();

  constructor(config: FactoryConfig = {}) {
    this.config = config;
  }

  /**
   * Create the full provider for a given model.
   *
   * Resolution order:
   *   1. Named preset in config.modelPresets
   *   2. Provider detection from model name + env
   *   3. Fallback to "deepseek" as default
   */
  async create(
    model: string,
    opts?: {
      providerName?: string;
      apiKey?: string;
      apiBase?: string;
      cache?: boolean;
    },
  ): Promise<IProvider> {
    const cacheKey = `${opts?.providerName ?? ""}:${model}:${opts?.apiBase ?? ""}`;
    if (opts?.cache !== false && this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }

    // Resolve the spec
    const providerName = opts?.providerName ?? this.detectProviderName(model);
    const resolved = resolveProvider(
      providerName,
      model,
      opts?.apiKey,
      opts?.apiBase,
    );

    if (!resolved) {
      throw new Error(
        `Cannot resolve provider for model "${model}". ` +
        `Set the ${providerName.toUpperCase()}_API_KEY env var or provide an apiKey.`
      );
    }

    const providerConfig = this.config.providers?.[resolved.spec.name];

    // Create the base provider
    let provider = this.createBaseProvider(resolved, providerConfig);

    // Wrap with retry decorator
    provider = new RetryDecorator(provider, {
      mode: this.config.retryMode ?? "standard",
      ...this.config.retry,
      onRetryWait: this.config.retry?.onRetryWait ?? this.config.onRetryWait,
    });

    // Wrap with fallback decorator if fallback models are configured
    const fallbackModels = this.config.fallbackModels;
    if (fallbackModels && fallbackModels.length > 0) {
      const fallbacks = await Promise.all(
        fallbackModels.map(async (fbModel) => {
          // Create fallback providers without their own fallback chain (no recursion)
          const fbResolved = resolveProvider(
            this.detectProviderName(fbModel),
            fbModel,
          );
          if (!fbResolved) {
            console.warn(`Cannot resolve fallback model "${fbModel}", skipping`);
            return null;
          }
          const fbProvider = this.createBaseProvider(
            fbResolved,
            this.config.providers?.[fbResolved.spec.name],
          );
          return new RetryDecorator(fbProvider, {
            mode: "standard",
            delays: [1, 2],
          });
        }),
      );

      const validFallbacks = fallbacks.filter(Boolean) as IProvider[];
      if (validFallbacks.length > 0) {
        provider = new FallbackDecorator(provider, {
          fallbacks: validFallbacks,
        });
      }
    }

    if (opts?.cache !== false) {
      this.providerCache.set(cacheKey, provider);
    }

    return provider;
  }

  /** Create the base (unwrapped) provider from a ResolvedProvider */
  private createBaseProvider(
    resolved: ResolvedProvider,
    config?: ProviderConfig,
  ): IProvider {
    const spec = resolved.spec;
    const apiKey = config?.apiKey ?? resolved.apiKey;
    const apiBase = config?.apiBase ?? resolved.baseUrl;
    const model = resolved.model;

    const extraHeaders = { ...spec.defaultExtraHeaders, ...config?.extraHeaders };

    switch (spec.backend) {
      case "anthropic":
        return this.createAnthropicProvider(model, apiKey, apiBase, extraHeaders, spec);

      case "azure_openai":
        return this.createAzureOpenAIProvider(model, apiKey, apiBase, spec);

      case "bedrock":
        return this.createBedrockProvider(model, apiKey, apiBase, spec);

      case "github_copilot":
        return this.createGitHubCopilotProvider(model);

      case "openai_codex":
        return this.createOpenAICodexProvider(model, config);

      case "openai_compat":
      default:
        return this.createOpenAICompatProvider(
          model, apiKey, apiBase, extraHeaders, spec, config,
        );
    }
  }

  /** Detect provider name from model string */
  private detectProviderName(model: string): string {
    // Check presets first
    if (this.config.modelPresets?.[model]?.provider) {
      return this.config.modelPresets[model].provider!;
    }

    // Check model name keywords
    const byModel = findByName(model) ?? findByName(model.replace(/[-/].*$/, ""));
    if (byModel) return byModel.name;

    // Fallback to deepseek for generic models
    return "deepseek";
  }

  // ── Provider constructors ──

  private createOpenAICompatProvider(
    model: string,
    apiKey: string,
    apiBase: string,
    extraHeaders: Record<string, string>,
    spec: ProviderSpec,
    config?: ProviderConfig,
  ): IProvider {
    // Dynamic import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OpenAICompatProvider } = require("./openai-compat");
    const provider = new OpenAICompatProvider(model, apiKey, apiBase);
    if (extraHeaders && Object.keys(extraHeaders).length > 0) {
      provider.setExtraHeaders(extraHeaders);
    }
    if (spec.thinkingStyle) {
      provider.setThinkingStyle(spec.thinkingStyle);
    }
    if (Object.keys(spec.reasoningEffortRemap).length > 0) {
      provider.setReasoningEffortRemap(spec.reasoningEffortRemap);
    }
    if (spec.implicitReasoningModels.length > 0) {
      provider.setImplicitReasoningModels(spec.implicitReasoningModels);
    }
    if (spec.extractThinkingBlocks) {
      provider.setExtractThinkingBlocks(true);
    }
    if (spec.stripHistoryReasoningContent) {
      provider.setStripHistoryReasoningContent(true);
    }
    if (spec.reasoningAsContent) {
      provider.setReasoningAsContent(true);
    }
    return provider;
  }

  private createAnthropicProvider(
    model: string,
    apiKey: string,
    apiBase: string,
    extraHeaders: Record<string, string>,
    _spec: ProviderSpec,
  ): IProvider {
    const { AnthropicProvider } = require("./anthropic");
    const provider = new AnthropicProvider(model, apiKey, apiBase);
    if (extraHeaders && Object.keys(extraHeaders).length > 0) {
      provider.setExtraHeaders(extraHeaders);
    }
    return provider;
  }

  private createAzureOpenAIProvider(
    model: string,
    apiKey: string,
    apiBase: string,
    _spec: ProviderSpec,
  ): IProvider {
    if (!apiBase) throw new Error("Azure OpenAI requires api_base in config.");
    const { OpenAICompatProvider } = require("./openai-compat");
    // Azure uses a different URL pattern; the OpenAICompatProvider handles it
    return new OpenAICompatProvider(model, apiKey, apiBase);
  }

  private createBedrockProvider(
    _model: string,
    _apiKey: string,
    _apiBase: string,
    _spec: ProviderSpec,
  ): IProvider {
    throw new Error("Bedrock provider not yet implemented. Use an OpenAI-compatible gateway instead.");
  }

  private createGitHubCopilotProvider(_model: string): IProvider {
    throw new Error("GitHub Copilot provider not yet implemented (OAuth flow required).");
  }

  private createOpenAICodexProvider(
    _model: string,
    _config?: ProviderConfig,
  ): IProvider {
    throw new Error("OpenAI Codex provider not yet implemented (OAuth flow required).");
  }

  /** Clear the provider cache (e.g., after config changes) */
  clearCache(): void {
    this.providerCache.clear();
  }
}
