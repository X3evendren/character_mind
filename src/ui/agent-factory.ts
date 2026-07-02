/**
 * Agent Factory — 装配 CharacterAgent 的纯函数工厂。
 * 用 provider-registry 的声明式匹配替代 API_BASE.includes() 嗅探。
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CharacterAgent } from "../agent/agent";
import { OpenAICompatProvider } from "../agent/provider";
import { AnthropicProvider } from "../agent/provider-anthropic";
import { detectProvider, type ProviderSpec } from "../agent/provider-registry";
import { Tracer, JsonlExporter, ConsoleExporter, CompositeExporter } from "../telemetry";
import { CheckpointManager, RecoveryManager } from "../recovery";
import { ContinuousLoop } from "../agent/loop";
import type { AgentPort } from "./agent-port";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_DIR = resolve(__dirname, "../../config");

export interface CreateAgentEnv {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  configDir?: string;
}

/**
 * 选择 provider spec — 纯函数，可单测。
 * 优先级：API key 前缀 > base URL 关键词 > model 名关键词。
 */
export function selectProviderSpec(env: CreateAgentEnv): ProviderSpec | undefined {
  return detectProvider(env.apiKey, env.baseUrl, env.model);
}

export interface CreatedAgent {
  agent: AgentPort;
  agentName: string;
  loop: ContinuousLoop;
  checkpointManager: CheckpointManager;
}

/**
 * 装配完整 agent — 从环境变量读配置，创建 provider/tracer/ckpt/recovery/loop。
 */
export async function createAgent(env: CreateAgentEnv): Promise<CreatedAgent> {
  const configDir = env.configDir ?? DEFAULT_CONFIG_DIR;
  const apiKey = env.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = env.baseUrl ?? process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com";
  const model = env.model ?? process.env.GEN_MODEL ?? "LongCat-2.0";

  const spec = selectProviderSpec({ apiKey, baseUrl, model });
  // Auto-detect Anthropic backend: URL contains /anthropic path
  const isAnthropic = spec?.backend === "anthropic"
    || baseUrl.includes("/anthropic");

  const provider = isAnthropic
    ? new AnthropicProvider(model, apiKey, baseUrl)
    : new OpenAICompatProvider(model, apiKey, baseUrl);

  const tracer = new Tracer(
    new CompositeExporter(new JsonlExporter(), new ConsoleExporter()),
  );
  const checkpointManager = new CheckpointManager();
  const recovery = new RecoveryManager(checkpointManager);

  const agent = new CharacterAgent({
    configDir,
    genProvider: provider,
    psychProvider: provider,
    genModel: model,
    psychModel: model,
    tracer,
    checkpointManager,
  });
  await agent.initialize();

  // Recovery check
  const decision = recovery.detect();
  if (decision.action === "resume" && decision.checkpoint) {
    await agent.restoreFromCheckpoint(recovery.resume(decision.checkpoint));
  }

  const loop = new ContinuousLoop(30_000);
  loop.start(agent);

  return { agent, agentName: agent.config.name, loop, checkpointManager };
}

export { DEFAULT_CONFIG_DIR };