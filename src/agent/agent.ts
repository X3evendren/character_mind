import { join } from 'node:path';
import type { IProvider } from './provider';
import { loadAssistantConfig } from './config-loader';
import { ResponseGenerator } from './response-generator';
import type { TurnEvent, RunOptions, RunResult } from './events';
import { KnowledgeGraph } from '../memory/knowledge-graph.ts';
import { importLegacyMemory } from '../memory/import-legacy.ts';
import { CognitiveCore, type PolicyScore } from '../mind/cognitive-core.ts';
import { LanguageAppraisalProvider, type AppraisalProvider } from '../mind/appraisal-provider.ts';
import { ToolRegistry } from '../tools/registry';
import { GuardPipeline, createRegexDenyGate, createSafetyCheckGate, createToolArgsValidatorGate } from '../guard';
import type { Tracer } from '../telemetry';

export interface TurnContext {
  input: string; systemPrompt: string; response: string;
  behaviorModes: Record<string, number>; toolResults: any[]; totalTokens: number; elapsedMs: number;
}
export interface AgentHook {
  beforeBuild?(ctx: TurnContext): Promise<void>;
  onStream?(ctx: TurnContext, delta: string): Promise<void>;
  afterGenerate?(ctx: TurnContext): Promise<void>;
}

/** Serialized observe → appraise → decide → respond → record pipeline. */
export class CharacterAgent {
  readonly config: ReturnType<typeof loadAssistantConfig>;
  readonly graph: KnowledgeGraph;
  readonly cognition: CognitiveCore;
  readonly toolRegistry: ToolRegistry;
  readonly guardPipeline: GuardPipeline;
  readonly appraisalProvider: AppraisalProvider;
  readonly configDir: string;
  readonly fastProvider: IProvider;
  readonly slowProvider: IProvider;
  readonly tracer?: Tracer;
  readonly evalMode: boolean;
  hooks: AgentHook[] = [];
  turnCount = 0;
  tickCount = 0;
  initialized = false;
  lastDecision: PolicyScore[] = [];
  private busy = false;
  private idleWaiters: Array<() => void> = [];
  private readonly dataDir: string;
  private currentPrompt = '';
  private readonly registerDefaults: boolean;
  private lastToolResults: any[] = [];
  private readonly genModel: string;
  private readonly psychModel: string;

  constructor(opts: {
    configDir: string; genProvider: IProvider; psychProvider: IProvider;
    genModel?: string; psychModel?: string; fastProvider?: IProvider;
    tracer?: Tracer; guardPipeline?: GuardPipeline;
    evalMode?: boolean; appraisalProvider?: AppraisalProvider; dataDir?: string; toolRegistry?: ToolRegistry;
  }) {
    this.configDir = opts.configDir;
    this.genModel = opts.genModel ?? '';
    this.psychModel = opts.psychModel ?? opts.psychProvider.model;
    this.toolRegistry = opts.toolRegistry ?? new ToolRegistry();
    this.registerDefaults = !opts.toolRegistry;
    this.config = loadAssistantConfig(opts.configDir);
    this.dataDir = opts.dataDir ?? process.env.MEMORY_DB_DIR ?? './data';
    this.graph = new KnowledgeGraph(join(this.dataDir, 'knowledge-graph.json'));
    this.cognition = new CognitiveCore(this.graph);
    this.fastProvider = opts.fastProvider ?? opts.genProvider;
    this.slowProvider = opts.genProvider;
    this.appraisalProvider = opts.appraisalProvider ?? new LanguageAppraisalProvider(opts.psychProvider, opts.psychModel);
    this.tracer = opts.tracer;
    this.evalMode = opts.evalMode ?? false;
    this.guardPipeline = opts.guardPipeline ?? new GuardPipeline([createRegexDenyGate(), createSafetyCheckGate(), createToolArgsValidatorGate()]);
    this.toolRegistry.guardPipeline = this.guardPipeline;
  }
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.registerDefaults) {
      const { registerAllTools } = await import('../tools/register-all');
      registerAllTools(this.toolRegistry);
    }
    await importLegacyMemory(this.graph, this.dataDir);
    this.turnCount = this.graph.all('event').filter(n => n.data.role === 'assistant').length;
    this.initialized = true;
  }
  async run(input: string, onDelta?: (delta: string) => Promise<void>): Promise<TurnContext> {
    const stream = this.runStream(input);
    let result: RunResult;
    try {
      for (;;) {
        const next = await stream.next();
        if (next.done === true) { result = next.value; break; }
        if (next.value.type === 'text_delta') await onDelta?.(next.value.text);
      }
    } finally { await stream.return(undefined); }
    return { input, systemPrompt: this.currentPrompt, response: result.response, behaviorModes: {}, toolResults: this.lastToolResults, totalTokens: result.totalTokens, elapsedMs: result.elapsedMs };
  }
  async *runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent, RunResult, void> {
    if (this.busy) throw new Error('A turn is already in progress');
    this.busy = true;
    this.lastToolResults = [];
    const start = Date.now();
    let response = '';
    try {
      await this.initialize();
      opts?.signal?.throwIfAborted();
      yield { type: 'phase_start', phase: 'guard_input', ts: start };
      const checked = await this.guardPipeline.checkInput(input);
      yield { type: 'phase_end', phase: 'guard_input', ts: start, durationMs: Date.now()-start };
      if (!checked.allowed) {
        response = '(输入被安全护栏拦截)';
        yield { type: 'text_delta', text: response };
      } else {
        input = checked.content;
        const observation = this.cognition.observe(input);
        this.turnCount++; this.tickCount++;
        const appraisalStart = Date.now();
        yield { type: 'phase_start', phase: 'appraise', ts: appraisalStart };
        try {
          const assessment = await this.appraisalProvider.assess(input, this.graph.context(input), opts?.signal);
          opts?.signal?.throwIfAborted();
          this.cognition.appraise(observation.id, assessment);
        } catch (error) {
          opts?.signal?.throwIfAborted();
          yield { type: 'error', phase: 'appraise', message: `情境评估不可用，保留既有信念：${(error as Error).message}`, recoverable: true };
          this.cognition.advance();
        }
        yield { type: 'phase_end', phase: 'appraise', ts: appraisalStart, durationMs: Date.now()-appraisalStart };
        const decisionStart = Date.now();
        yield { type: 'phase_start', phase: 'decide', ts: decisionStart };
        this.lastDecision = this.cognition.decide(observation.id);
        yield { type: 'phase_end', phase: 'decide', ts: decisionStart, durationMs: Date.now()-decisionStart };
        this.currentPrompt = [
          `你是角色 ${this.config.name}。人格：${this.config.traits}。核心驱动：${this.config.essence}。`,
          this.config.rules,
          '根据当下的主观感受自然回应。外部事实以原始事件为依据；不把心理推断说成对方真实动机。不编造记忆或工具执行结果。',
          this.cognition.prompt(input),
          `【可调整的回应策略】${JSON.stringify(this.lastDecision[0])}`,
        ].join('\n\n');
        const ctx: TurnContext = { input, systemPrompt: this.currentPrompt, response: '', behaviorModes: {}, toolResults: [], totalTokens: 0, elapsedMs: 0 };
        for (const hook of this.hooks) await hook.beforeBuild?.(ctx);
        const generator = new ResponseGenerator(this.fastProvider, this.toolRegistry, this.tracer, this.genModel);
        generator.onToolResult = (call, result) => {
          const node = this.graph.add('event', result.output, { role: 'tool', call, success: result.success, error: result.error });
          this.graph.link(node.id, observation.id, 'responds_to');
          this.graph.save();
          ctx.toolResults.push({ name: call.name, ...result });
          this.lastToolResults = ctx.toolResults;
        };
        const signal = opts?.signal ?? new AbortController().signal;
        const generationStart = Date.now();
        yield { type: 'phase_start', phase: 'generate', ts: generationStart };
        for await (const op of generator.generate(ctx.systemPrompt, input, signal, this.toolRegistry.getDefinitions(), .6, 1200)) {
          if (op.type === 'append') response += op.span.text;
          else if (op.type === 'invalidate') response = '';
          else if (op.type === 'tool_start' || op.type === 'tool_end') yield op;
        }
        signal.throwIfAborted();
        yield { type: 'phase_end', phase: 'generate', ts: generationStart, durationMs: Date.now()-generationStart };
        const guardStart = Date.now();
        yield { type: 'phase_start', phase: 'guard_output', ts: guardStart };
        const output = await this.guardPipeline.checkOutput(response);
        signal.throwIfAborted();
        response = output.allowed ? output.content : '(回应被安全护栏拦截)';
        yield { type: 'phase_end', phase: 'guard_output', ts: guardStart, durationMs: Date.now()-guardStart };
        const commitStart = Date.now();
        yield { type: 'phase_start', phase: 'commit_memory', ts: commitStart };
        const answer = this.cognition.observe(response, 'assistant');
        this.graph.link(answer.id, observation.id, 'responds_to');
        this.graph.save();
        yield { type: 'phase_end', phase: 'commit_memory', ts: commitStart, durationMs: Date.now()-commitStart };
        ctx.response = response;
        for (const hook of this.hooks) await hook.afterGenerate?.(ctx);
        yield { type: 'text_delta', text: response };
        for (const hook of this.hooks) await hook.onStream?.(ctx, response);
      }
      const result = { turnId: this.turnCount, response, totalTokens: 0, elapsedMs: Date.now()-start };
      yield { type: 'done', turnId: result.turnId, elapsedMs: result.elapsedMs, totalTokens: result.totalTokens };
      return result;
    } finally { this.release(); }
  }
  private release(): void {
    this.busy = false;
    for (const notify of this.idleWaiters.splice(0)) notify();
  }
  async compressMemory(): Promise<string> {
    // Requests are accepted at any time and committed at a stable turn boundary.
    while (this.busy) await new Promise<void>(resolve => this.idleWaiters.push(resolve));
    this.busy = true;
    try {
      await this.initialize();
      const events = this.graph.all('event');
      const covered = new Set(this.graph.all('summary').flatMap(n => this.graph.expand(n.id).map(x => x.id)));
      // Only complete user/answer units can be folded. Incomplete turns and tools stay explicit.
      const older = events.slice(0, -8).filter(n => !covered.has(n.id));
      const olderIds = new Set(older.map(n => n.id));
      const eligible: typeof events = [];
      for (const answer of older.filter(n => n.data.role === 'assistant')) {
        const input = this.graph.related(answer.id, 'responds_to').find(n => n.data.role === 'user' && olderIds.has(n.id));
        if (input && eligible.length < 30) eligible.push(input, answer);
      }
      if (eligible.length < 2) return '暂无可压缩的旧事件；最近 8 条事件保持原文。';
      const result = await this.slowProvider.chat([
        { role: 'system', content: '压缩这些历史记录。保留人物视角、事件顺序、否定、未履行承诺、关系冲突与修复、情绪和触发结构、来源与不确定性。不得将主观理解改写为事实。只返回摘要。' },
        { role: 'user', content: JSON.stringify({ events: eligible, interpretations: this.graph.all('appraisal').filter(n => eligible.some(e => e.id === n.data.eventId)).map(n => ({ ...n, associations: this.graph.interpretationContext(n.id) })) }) },
      ], 0, 1600, undefined, this.genModel, AbortSignal.timeout(20000));
      if (result.finishReason === 'length' || result.finishReason === 'max_tokens') throw new Error('摘要被截断，未更新压缩视图；请重试。');
      const summary = this.graph.compress(eligible.map(n => n.id), result.content, events.slice(-8).map(n => n.id));
      return `已压缩 ${eligible.length} 条事件。摘要引用：${summary.id}；原始记录可展开。`;
    } finally { this.release(); }
  }
  getStateSnapshot() {
    const mind = structuredClone({ state: this.cognition.state, phenomena: this.cognition.phenomena });
    return {
      agentName: this.config.name, turnCount: this.turnCount, mind,
      decision: this.lastDecision[0]?.policy ?? this.graph.all('decision').at(-1)?.text ?? 'clarify',
      memory: { events: this.graph.all('event').length, appraisals: this.graph.all('appraisal').length, states: this.graph.all('state').length, phenomena: this.graph.all('phenomenon').length, summaries: this.graph.all('summary').length, nodes: this.graph.all().length },
    };
  }
  getModelInfo() { return { generation: this.genModel || this.fastProvider.model, appraisal: this.psychModel }; }
  async shutdown(): Promise<void> { this.cognition.checkpoint(); }
}
