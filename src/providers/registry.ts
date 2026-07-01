/**
 * Provider Registry — single source of truth for LLM provider metadata.
 *
 * Ported from nanobot/providers/registry.py. 40+ providers with their quirks
 * (thinking styles, model overrides, reasoning remaps, etc.).
 *
 * Design: Static table with user-overridable fields (Strategy B).
 * Order matters — it controls match priority and fallback. Gateways first.
 *
 * Adding a new provider:
 *   1. Add a ProviderSpec to PROVIDERS below.
 *   2. Copy an existing entry as template.
 *   Done. Detection, env vars, config matching all derive from here.
 */

import type { ProviderSpec } from "./types";

// ═══════════════════════════════════════════════════════════════
// The registry — order = priority
// ═══════════════════════════════════════════════════════════════

export const PROVIDERS: ProviderSpec[] = [
  // ── Custom (direct OpenAI-compatible endpoint) ──────────────
  {
    name: "custom",
    keywords: [],
    envKey: "",
    displayName: "Custom",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: true,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // ── Azure OpenAI ────────────────────────────────────────────
  {
    name: "azure_openai",
    keywords: ["azure", "azure-openai"],
    envKey: "",
    displayName: "Azure OpenAI",
    backend: "azure_openai",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: true,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // ── AWS Bedrock (native Converse API) ───────────────────────
  {
    name: "bedrock",
    keywords: [
      "bedrock", "anthropic.claude", "amazon.nova",
      "meta.", "mistral.", "cohere.", "qwen.",
      "deepseek.", "openai.gpt-oss", "ai21.",
      "moonshot.", "writer.", "zai.",
    ],
    envKey: "AWS_BEARER_TOKEN_BEDROCK",
    displayName: "AWS Bedrock",
    backend: "bedrock",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: true,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // ── Gateways (detected by api_key / api_base, not model name) ──

  // OpenRouter: global gateway, keys start with "sk-or-"
  {
    name: "openrouter",
    keywords: ["openrouter"],
    envKey: "OPENROUTER_API_KEY",
    displayName: "OpenRouter",
    backend: "openai_compat",
    isGateway: true, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "sk-or-", detectByBaseKeyword: "openrouter",
    defaultApiBase: "https://openrouter.ai/api/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: true,
    thinkingStyle: "", gatewayReasoningStyle: "reasoning_effort",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Skywork / APIFree
  {
    name: "skywork",
    keywords: ["skywork", "skyclaw", "apifree"],
    envKey: "SKYWORK_API_KEY",
    displayName: "Skywork",
    backend: "openai_compat",
    isGateway: true, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "apifree.ai",
    defaultApiBase: "https://api.apifree.ai/agent/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [["APIFREE_API_KEY", "{api_key}"]], defaultExtraHeaders: {},
  },

  // AiHubMix: global gateway
  {
    name: "aihubmix",
    keywords: ["aihubmix"],
    envKey: "OPENAI_API_KEY",
    displayName: "AiHubMix",
    backend: "openai_compat",
    isGateway: true, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "aihubmix",
    defaultApiBase: "https://aihubmix.com/v1",
    stripModelPrefix: true, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // SiliconFlow (硅基流动)
  {
    name: "siliconflow",
    keywords: ["siliconflow"],
    envKey: "OPENAI_API_KEY",
    displayName: "SiliconFlow",
    backend: "openai_compat",
    isGateway: true, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "siliconflow",
    defaultApiBase: "https://api.siliconflow.cn/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // VolcEngine (火山引擎)
  {
    name: "volcengine",
    keywords: ["volcengine", "volces", "ark"],
    envKey: "OPENAI_API_KEY",
    displayName: "VolcEngine",
    backend: "openai_compat",
    isGateway: true, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "volces",
    defaultApiBase: "https://ark.cn-beijing.volces.com/api/v3",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "thinking_type", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Novita AI
  {
    name: "novita",
    keywords: ["novita"],
    envKey: "NOVITA_API_KEY",
    displayName: "Novita AI",
    backend: "openai_compat",
    isGateway: true, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "novita",
    defaultApiBase: "https://api.novita.ai/openai",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // ── Standard providers (matched by model-name keywords) ─────

  // Anthropic: native Anthropic SDK
  {
    name: "anthropic",
    keywords: ["anthropic", "claude"],
    envKey: "ANTHROPIC_API_KEY",
    displayName: "Anthropic",
    backend: "anthropic",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.anthropic.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: true,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // OpenAI
  {
    name: "openai",
    keywords: ["openai", "gpt", "o1", "o3", "o4"],
    envKey: "OPENAI_API_KEY",
    displayName: "OpenAI",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.openai.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // GitHub Copilot: OAuth-based
  {
    name: "github_copilot",
    keywords: ["github_copilot", "copilot"],
    envKey: "",
    displayName: "GitHub Copilot",
    backend: "github_copilot",
    isGateway: false, isLocal: false, isOAuth: true, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.githubcopilot.com",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // DeepSeek
  {
    name: "deepseek",
    keywords: ["deepseek", "v4", "r1"],
    envKey: "DEEPSEEK_API_KEY",
    displayName: "DeepSeek",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.deepseek.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "thinking_type", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Gemini
  {
    name: "gemini",
    keywords: ["gemini", "gemma"],
    envKey: "GEMINI_API_KEY",
    displayName: "Gemini",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://generativelanguage.googleapis.com/v1beta/openai/",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Zhipu (智谱)
  {
    name: "zhipu",
    keywords: ["zhipu", "glm", "zai"],
    envKey: "ZAI_API_KEY",
    displayName: "Zhipu AI",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://open.bigmodel.cn/api/paas/v4",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [["ZHIPUAI_API_KEY", "{api_key}"]], defaultExtraHeaders: {},
  },

  // DashScope (通义) — Qwen models
  {
    name: "dashscope",
    keywords: ["qwen", "dashscope"],
    envKey: "DASHSCOPE_API_KEY",
    displayName: "DashScope",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "enable_thinking", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Moonshot (月之暗面) — Kimi
  {
    name: "moonshot",
    keywords: ["moonshot", "kimi"],
    envKey: "MOONSHOT_API_KEY",
    displayName: "Moonshot",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.moonshot.ai/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {
      "kimi-k2.5": { temperature: 1.0 },
      "kimi-k2.6": { temperature: 1.0 },
      "kimi-k2.7": { temperature: 1.0 },
      "kimi-k2.7-code": { temperature: 1.0 },
      "kimi-k2.7-code-highspeed": { temperature: 1.0 },
    },
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Kimi Coding Plan — Anthropic Messages API
  {
    name: "kimi_coding",
    keywords: ["kimi-coding", "kimi_coding", "kimi-for-coding"],
    envKey: "KIMI_CODING_API_KEY",
    displayName: "Kimi Coding",
    backend: "anthropic",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.kimi.com/coding/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: { "User-Agent": "claude-code/0.1.0" },
  },

  // MiniMax
  {
    name: "minimax",
    keywords: ["minimax"],
    envKey: "MINIMAX_API_KEY",
    displayName: "MiniMax",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.minimax.io/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "reasoning_split", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // MiniMax Anthropic-compatible endpoint
  {
    name: "minimax_anthropic",
    keywords: ["minimax_anthropic"],
    envKey: "MINIMAX_API_KEY",
    displayName: "MiniMax (Anthropic)",
    backend: "anthropic",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.minimax.io/anthropic",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Mistral AI — complex reasoning quirks
  {
    name: "mistral",
    keywords: ["mistral", "magistral", "ministral", "codestral", "devstral"],
    envKey: "MISTRAL_API_KEY",
    displayName: "Mistral",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.mistral.ai/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {
      "minimal": "none",
      "low": "none",
      "medium": "high",
      "high": "high",
      "none": "none",
    },
    implicitReasoningModels: ["magistral"],
    extractThinkingBlocks: true,
    stripHistoryReasoningContent: true,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Step Fun (阶跃星辰)
  {
    name: "stepfun",
    keywords: ["stepfun", "step"],
    envKey: "STEPFUN_API_KEY",
    displayName: "Step Fun",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.stepfun.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: true, // StepFun returns answer in reasoning field
    envExtras: [], defaultExtraHeaders: {},
  },

  // Xiaomi MIMO (小米)
  {
    name: "xiaomi_mimo",
    keywords: ["xiaomi_mimo", "mimo"],
    envKey: "XIAOMIMIMO_API_KEY",
    displayName: "Xiaomi MIMO",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.xiaomimimo.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "thinking_type", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // LongCat
  {
    name: "longcat",
    keywords: ["longcat"],
    envKey: "LONGCAT_API_KEY",
    displayName: "LongCat",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.longcat.chat/openai/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Ant Ling
  {
    name: "ant_ling",
    keywords: ["ant_ling", "ant-ling", "ling-", "ring-"],
    envKey: "ANT_LING_API_KEY",
    displayName: "Ant Ling",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "ant-ling.com",
    defaultApiBase: "https://api.ant-ling.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // NVIDIA NIM
  {
    name: "nvidia",
    keywords: ["nvidia", "nemotron", "nvapi"],
    envKey: "NVIDIA_NIM_API_KEY",
    displayName: "NVIDIA NIM",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "nvapi-", detectByBaseKeyword: "nvidia.com",
    defaultApiBase: "https://integrate.api.nvidia.com/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Groq
  {
    name: "groq",
    keywords: ["groq"],
    envKey: "GROQ_API_KEY",
    displayName: "Groq",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://api.groq.com/openai/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Qianfan (百度千帆)
  {
    name: "qianfan",
    keywords: ["qianfan", "ernie"],
    envKey: "QIANFAN_API_KEY",
    displayName: "Qianfan",
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "https://qianfan.baidubce.com/v2",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // ── Local deployment (matched by config key, NOT api_base) ───

  // vLLM
  {
    name: "vllm",
    keywords: ["vllm"],
    envKey: "HOSTED_VLLM_API_KEY",
    displayName: "vLLM",
    backend: "openai_compat",
    isGateway: false, isLocal: true, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "http://localhost:8000/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // Ollama
  {
    name: "ollama",
    keywords: ["ollama", "nemotron"],
    envKey: "OLLAMA_API_KEY",
    displayName: "Ollama",
    backend: "openai_compat",
    isGateway: false, isLocal: true, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "11434",
    defaultApiBase: "http://localhost:11434/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },

  // LM Studio
  {
    name: "lm_studio",
    keywords: ["lm-studio", "lmstudio", "lm_studio"],
    envKey: "LM_STUDIO_API_KEY",
    displayName: "LM Studio",
    backend: "openai_compat",
    isGateway: false, isLocal: true, isOAuth: false, isDirect: false,
    detectByKeyPrefix: "", detectByBaseKeyword: "1234",
    defaultApiBase: "http://localhost:1234/v1",
    stripModelPrefix: false, stripModelPrefixes: [],
    supportsPromptCaching: false,
    thinkingStyle: "", gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// Lookup helpers
// ═══════════════════════════════════════════════════════════════

/** Find a provider spec by config field name, e.g. "dashscope" */
export function findByName(name: string): ProviderSpec | undefined {
  const normalized = name.replace(/[-_]/g, "_").toLowerCase();
  return PROVIDERS.find(p => p.name === normalized);
}

/** Match provider by API key prefix, base URL keywords, or model name keywords */
export function detectProvider(
  apiKey?: string,
  baseUrl?: string,
  model?: string,
): ProviderSpec | undefined {
  // Level 1: API key prefix matching
  if (apiKey) {
    // Anthropic keys
    if (apiKey.startsWith("sk-ant-")) return findByName("anthropic");
    // OpenRouter keys
    if (apiKey.startsWith("sk-or-")) return findByName("openrouter");
    // NVIDIA keys
    if (apiKey.startsWith("nvapi-")) return findByName("nvidia");
    // HuggingFace keys
    if (apiKey.startsWith("hf_")) return findByName("huggingface");
    // Generic OpenAI-compat
    if (apiKey.startsWith("sk-")) return findByName("deepseek"); // default
  }

  // Level 2: Base URL keyword matching
  if (baseUrl) {
    const lower = baseUrl.toLowerCase();
    for (const p of PROVIDERS) {
      if (p.detectByBaseKeyword && lower.includes(p.detectByBaseKeyword)) return p;
    }
    // Heuristic: common URL patterns
    if (lower.includes("11434")) return findByName("ollama");
    if (lower.includes("1234")) return findByName("lm_studio");
    if (lower.includes("8000") && !lower.includes("baidubce")) return findByName("vllm");
    if (lower.includes("deepseek")) return findByName("deepseek");
    if (lower.includes("openai")) return findByName("openai");
    if (lower.includes("anthropic")) return findByName("anthropic");
    if (lower.includes("moonshot")) return findByName("moonshot");
    if (lower.includes("mistral")) return findByName("mistral");
    if (lower.includes("dashscope")) return findByName("dashscope");
    if (lower.includes("bigmodel")) return findByName("zhipu");
    if (lower.includes("generativelanguage")) return findByName("gemini");
  }

  // Level 3: Model name keyword matching
  if (model) {
    const lower = model.toLowerCase();
    for (const p of PROVIDERS) {
      if (p.keywords.some(kw => lower.includes(kw))) return p;
    }
  }

  return undefined;
}

/** Find by model name keywords only */
export function getByModel(model: string): ProviderSpec | undefined {
  const lower = model.toLowerCase();
  return PROVIDERS.find(p => p.keywords.some(kw => lower.includes(kw)));
}

// ═══════════════════════════════════════════════════════════════
// Provider resolution (env + config → resolved provider params)
// ═══════════════════════════════════════════════════════════════

export interface ResolvedProvider {
  spec: ProviderSpec;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function resolveProvider(
  providerName: string,
  model: string,
  apiKey?: string,
  baseUrl?: string,
): ResolvedProvider | undefined {
  const spec = findByName(providerName) ?? detectProvider(apiKey, baseUrl, model);
  if (!spec) return undefined;

  const key = apiKey || process.env[spec.envKey] || "";
  const url = baseUrl || spec.defaultApiBase;

  return { spec, apiKey: key, baseUrl: url, model };
}

// ═══════════════════════════════════════════════════════════════
// Dynamic spec creation (for user-defined custom providers)
// ═══════════════════════════════════════════════════════════════

export function createDynamicSpec(
  name: string,
  thinkingStyle: "" | "thinking_type" | "enable_thinking" | "reasoning_split" = "",
): ProviderSpec {
  const normalized = name.replace(/[-_]/g, "_").toLowerCase();
  const prefixes = [...new Set([name, normalized])];
  return {
    name: normalized,
    keywords: [],
    envKey: "",
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    backend: "openai_compat",
    isGateway: false, isLocal: false, isOAuth: false, isDirect: true,
    detectByKeyPrefix: "", detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: true, stripModelPrefixes: prefixes,
    supportsPromptCaching: false,
    thinkingStyle, gatewayReasoningStyle: "",
    modelOverrides: {},
    reasoningEffortRemap: {}, implicitReasoningModels: [],
    extractThinkingBlocks: false, stripHistoryReasoningContent: false,
    reasoningAsContent: false,
    envExtras: [], defaultExtraHeaders: {},
  };
}
