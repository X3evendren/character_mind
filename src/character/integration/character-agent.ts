/**
 * Character Agent — Main orchestrator ties all character subsystems together.
 * This is the master entry point that ties all character subsystems together.
 */
import { MindState } from "../mind/mind-state";
// FSM available for future state-based branching
import { FiniteStateMachine } from "../mind/fsm";
import { PsychologyEngine, PsychologyResult } from "../mind/psychology-engine";
import { UnifiedParams } from "../params/unified-params";
import { ParamsModulator } from "../params/params-modulator";
import { DriveState } from "../drive/desires";
import { DriveDynamics } from "../drive/dynamics";
import { DriveSublimator } from "../drive/sublimator";
import { SaturationState, ContinuousParams } from "../engine/continuous-engine";
import { SaturationDetector, PrecisionRouter } from "../love/relational";
import { IrreduciblePrior } from "../love/irreducible-prior";
import { OathStore } from "../love/oath-store";
import { LoveMetrics } from "../love/love-metrics";
import { SelfModel } from "../consciousness/self-model";
import { AffectiveResidue } from "../consciousness/affective-residue";
import { TemporalHorizon } from "../consciousness/temporal-horizon";
import { ContextNoiseDetector } from "../consciousness/context-noise";
import { PredictionTracker } from "../consciousness/prediction";
import { PostFilter } from "../anti-rlhf/post-filter";
import { WorkingMemory } from "../memory/working";
import { ShortTermMemory } from "../memory/short-term";
import { LongTermMemory } from "../memory/long-term";
import { CoreGraphMemory } from "../memory/core-graph";
import { ArchiveMemory } from "../memory/archive";
import { SleepCycleMetabolism } from "../memory/metabolism";
import { FrozenSnapshot } from "../memory/snapshot";
import { createMemoryRecord } from "../memory/store";
import { FeedbackLoop } from "../learning/feedback-loop";
import { SelfReflection } from "../learning/self-reflection";
import { SkillLibrary } from "../learning/skill-library";
import { loadAssistantConfig, loadMemoryConfig, ensureSkillsDir } from "./config-loader";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder";
import { ColdCache, detectEmotionHeuristic, FourLayerColdAnalyzer, type ColdAnalyzeParams } from "./cold-analyzer";
import { SpanBasedGenerator } from "./dual-track";
import { createGroundTruth, type GroundTruth } from "../state/ground-truth";
import { ToolRegistry } from "../../tools/registry";
import { registerAllTools } from "../../tools/register-all";
export interface AgentHook {
  beforeAnalyze?(ctx: TurnContext): Promise<void>;
  afterAnalyze?(ctx: TurnContext, r: PsychologyResult): Promise<void>;
  beforeModulate?(ctx: TurnContext): Promise<void>;
  beforeBuild?(ctx: TurnContext): Promise<void>;
  onStream?(ctx: TurnContext, delta: string): Promise<void>;
  afterGenerate?(ctx: TurnContext): Promise<void>;
  beforeRespond?(ctx: TurnContext): Promise<void>;
}

export interface TurnContext {
  input: string;
  systemPrompt: string;
  response: string;
  psychology?: PsychologyResult;
  behaviorModes: Record<string, number>;
  toolResults: any[];
  totalTokens: number;
  elapsedMs: number;
}

export class CharacterAgent {
  // Subsystems
  mindState: MindState;
  fsm: FiniteStateMachine;
  params: UnifiedParams;
  modulator: ParamsModulator;
  drives: DriveState;
  dynamics: DriveDynamics;
  driveSublimator: DriveSublimator;
  saturation: SaturationState;
  continuousParams: ContinuousParams;
  saturationDetector: SaturationDetector;
  precisionRouter: PrecisionRouter;
  irreduciblePrior: IrreduciblePrior;
  oathStore: OathStore;
  loveMetrics: LoveMetrics;
  selfModel: SelfModel;
  affectiveResidue: AffectiveResidue;
  temporalHorizon: TemporalHorizon;
  contextNoiseDetector: ContextNoiseDetector;
  toolRegistry: ToolRegistry;
  predictionTracker: PredictionTracker;
  postFilter: PostFilter;
  workingMemory: WorkingMemory;
  shortTermMemory: ShortTermMemory;
  longTermMemory: LongTermMemory;
  coreGraph: CoreGraphMemory;
  archiveMemory: ArchiveMemory;
  metabolism: SleepCycleMetabolism;
  snapshot: FrozenSnapshot;
  feedbackLoop: FeedbackLoop;
  selfReflection: SelfReflection;
  skillLibrary: SkillLibrary;

  // LLM providers
  fastProvider: any;
  slowProvider: any;
  psychologyEngine: PsychologyEngine;

  // Hooks
  hooks: AgentHook[] = [];

  // Config
  config: ReturnType<typeof loadAssistantConfig>;
  memConfig: ReturnType<typeof loadMemoryConfig>;

  // State
  tickCount = 0;
  turnCount = 0;
  initialized = false;
  private firstTurnDone = false;

  /** Cold Path cache — populated asynchronously, consumed by next turn's Hot Path */
  coldCache: ColdCache | null = null;
  private coldAnalyzer: FourLayerColdAnalyzer | null = null;
  private coldPending = false;

  /** Shared factual state — Hot Path reads, all writes via tool results */
  groundTruth: GroundTruth = createGroundTruth();

  constructor(opts: {
    configDir: string;
    genProvider: any;
    psychProvider: any;
    genModel?: string;
    psychModel?: string;
    fastProvider?: any;
  }) {
    // Config
    this.config = loadAssistantConfig(opts.configDir);
    this.memConfig = loadMemoryConfig(opts.configDir);

    // Mind
    this.mindState = new MindState();
    this.fsm = new FiniteStateMachine();

    // Params
    this.params = new UnifiedParams();
    this.modulator = new ParamsModulator(this.params);

    // Drive
    this.drives = new DriveState();
    this.dynamics = new DriveDynamics();
    this.driveSublimator = new DriveSublimator();

    // Saturation engine
    this.saturation = new SaturationState();
    this.continuousParams = new ContinuousParams(this.saturation);
    this.saturationDetector = new SaturationDetector();
    this.precisionRouter = new PrecisionRouter();
    this.irreduciblePrior = new IrreduciblePrior();

    // Love
    this.oathStore = new OathStore();
    this.loveMetrics = new LoveMetrics();

    // Consciousness
    this.selfModel = new SelfModel();
    this.selfModel.initFromConfig(this.config as unknown as Record<string, string>);
    this.affectiveResidue = new AffectiveResidue();
    this.temporalHorizon = new TemporalHorizon();
    this.contextNoiseDetector = new ContextNoiseDetector();
    this.toolRegistry = new ToolRegistry();
    registerAllTools(this.toolRegistry);
    this.predictionTracker = new PredictionTracker();

    // Anti-RLHF
    this.postFilter = new PostFilter();

    // Memory
    this.workingMemory = new WorkingMemory(this.memConfig.workingMemorySize);
    this.shortTermMemory = new ShortTermMemory(":memory:", this.memConfig.shortTermMemorySize);
    this.longTermMemory = new LongTermMemory(":memory:", this.memConfig.longTermMemorySize);
    this.coreGraph = new CoreGraphMemory(":memory:", this.memConfig.coreGraphMaxNodes, this.memConfig.coreGraphMaxEdges);
    this.archiveMemory = new ArchiveMemory(":memory:");

    // Learning — skillLibrary must be created BEFORE metabolism (metabolism uses it in fullSleep)
    this.skillLibrary = new SkillLibrary(ensureSkillsDir(opts.configDir));
    this.metabolism = new SleepCycleMetabolism(this.workingMemory, this.shortTermMemory, this.longTermMemory, this.coreGraph, this.archiveMemory, this.skillLibrary);
    this.snapshot = new FrozenSnapshot();

    // Learning (continued)
    this.feedbackLoop = new FeedbackLoop();
    this.selfReflection = new SelfReflection();

    // LLM
    this.fastProvider = opts.fastProvider ?? opts.genProvider;
    this.slowProvider = opts.genProvider;
    this.psychologyEngine = new PsychologyEngine(opts.psychProvider, opts.psychModel ?? "");

    // Cold analyzer — runs 4-layer cascaded analysis asynchronously
    this.coldAnalyzer = new FourLayerColdAnalyzer(
      opts.psychProvider,
      opts.genProvider,
    );
  }

  async initialize(): Promise<void> {
    this.skillLibrary.loadFromDisk();
    await this.workingMemory.initialize();
    await this.shortTermMemory.initialize();
    await this.longTermMemory.initialize();
    await this.coreGraph.initialize();
    await this.archiveMemory.initialize();
    this.initialized = true;
  }

  async run(input: string, onDelta?: (delta: string) => Promise<void>): Promise<TurnContext> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();
    const ctx: TurnContext = {
      input, systemPrompt: "", response: "",
      behaviorModes: {}, toolResults: [], totalTokens: 0, elapsedMs: 0,
    };
    const taskMode = detectTaskMode(input);

    this.tickCount++;
    this.turnCount++;

    // Temporal horizon — retention from last turn enters awareness
    this.temporalHorizon.onTurnStart();

    // ═══════════════════════════════════════════
    // HOT PATH — Generation only (zero LLM calls)
    // ═══════════════════════════════════════════

    // Restore memory snapshot
    if (this.snapshot.isStale()) {
      const stmRecords = await this.shortTermMemory.recall(input, 3);
      const ltmRecords = await this.longTermMemory.recall(input, 5);
      const coreSummary = (await this.coreGraph.recall(input, 1))[0]?.content ?? "";
      this.snapshot.freeze({}, ltmRecords, stmRecords, coreSummary);
    }

    // Quick emotion detection — rule-based, 0 tokens, <1ms (replaces psych LLM call)
    const quickEmo = detectEmotionHeuristic(input);
    const emoDominant = quickEmo.dominant;
    const emoIntensity = quickEmo.intensity;

    // Fast Track param modulation — only if we have cold cache psych data
    if (this.coldCache) {
      const fastShifts = this.modulator.modulateFast(this.coldCache);
      this.modulator.applyShifts(fastShifts);
    }

    // Build system prompt — reads coldCache (zero LLM)
    ctx.systemPrompt = buildSystemPrompt({
      config: this.config,
      mindstate: this.mindState,
      capabilities: this.selfModel.formatCapabilities(),
      groundTruth: this.groundTruth,
      snapshot: this.snapshot,
      feedbackLoop: this.feedbackLoop,
      skillLibrary: this.skillLibrary,
      currentInput: input,
      taskMode,
      coldCache: this.coldCache,
      quickEmotion: quickEmo,
      // Deprecated params kept for backward compat
      emotionDominant: emoDominant,
      emotionIntensity: emoIntensity,
      affectiveResidueText: this.coldCache?.affectiveResidueText ?? this.affectiveResidue.formatForPrompt(),
      driveBiasText: this.driveSublimator.buildAttentionBias(this.drives),
      selfNarrativeText: this.coldCache?.selfNarrativeText ?? this.selfModel.formatForHotPath(),
      temporalHorizonText: this.coldCache?.temporalHorizonText ?? this.temporalHorizon.formatForPrompt(),
      isFirstTurn: !this.firstTurnDone,
    });
    this.firstTurnDone = true;

    // Noise analysis
    this.contextNoiseDetector.analyze({
      identity: `你是 ${this.config.name}，${this.config.traits}`,
      capabilities: this.selfModel.formatCapabilities(),
      groundTruth: "",
      affectiveResidue: this.affectiveResidue.formatForPrompt(),
      driveBias: this.driveSublimator.buildAttentionBias(this.drives),
      selfNarrative: this.selfModel.formatForHotPath(),
      memorySnapshot: this.snapshot.formatForPrompt(),
      userInput: input,
    });

    const userPrompt = buildUserPrompt(input, taskMode);

    // Phase 4: Draft (Fast) + Refine (Slow) + Commit — shared GroundTruth
    for (const h of this.hooks) { await h.beforeBuild?.(ctx); }

    const dualTrack = new SpanBasedGenerator(this.fastProvider, this.slowProvider, this.toolRegistry);
    const responseParts: string[] = [];
    const abortController = new AbortController();

    for await (const op of dualTrack.generate(ctx.systemPrompt, userPrompt, abortController.signal, this.toolRegistry.getDefinitions())) {
      if (op.type === "invalidate") {
        responseParts.length = 0;
        continue;
      }
      const text = op.type === "append" ? op.span.text
        : op.type === "patch" ? op.newText
        : "";
      if (text) {
        responseParts.push(text);
        if (onDelta) await onDelta(text);
        for (const h of this.hooks) { await h.onStream?.(ctx, text); }
      }
    }
    ctx.response = responseParts.join("");

    // Anti-RLHF post-filter
    const [filtered, modifications] = this.postFilter.replace(ctx.response);
    if (modifications.length > 0) ctx.response = filtered;

    for (const h of this.hooks) { await h.afterGenerate?.(ctx); }

    // Schedule cold analysis — fire-and-forget, does NOT block this turn
    this.scheduleColdAnalysis(input, ctx.response, taskMode);

    // State updates that don't need LLM (keep these synchronous)
    this.saturation.positiveInteraction(emoIntensity);
    this.affectiveResidue.deposit(
      { dominant: emoDominant, intensity: emoIntensity, pleasure: quickEmo.pleasure },
      Math.max(0.2, emoIntensity),
    );

    ctx.elapsedMs = Date.now() - startTime;
    return ctx;
  }

  /** Cold Path — now handled by scheduleColdAnalysis (fire-and-forget).
   *  This method kept for backward compatibility with external callers. */
  async runColdPath(params: { input: string; response: string; psychology?: PsychologyResult }): Promise<PsychologyResult> {
    // Delegate to async analyzer
    if (this.coldAnalyzer && !this.coldPending) {
      this.scheduleColdAnalysis(params.input, params.response, false);
    }
    // Return existing psych or empty result
    return params.psychology ?? new PsychologyResult();
  }

  /** Schedule asynchronous 4-layer cold analysis. Fire-and-forget, does not block turn. */
  private scheduleColdAnalysis(input: string, response: string, taskMode: boolean): void {
    if (!this.coldAnalyzer || this.coldPending) return; // Already running
    this.coldPending = true;

    const params: ColdAnalyzeParams = {
      input,
      response,
      taskMode,
      mindState: this.mindState,
      drives: this.drives.toDict(),
      assistantConfig: this.config as unknown as Record<string, string>,
      previousResidueVector: this.affectiveResidue.vector,
      previousRetention: {
        emotionDominant: this.temporalHorizon.retention.emotionDominant,
        emotionIntensity: this.temporalHorizon.retention.emotionIntensity,
        unfinished: this.temporalHorizon.retention.unfinished,
      },
      timeSinceLastTurn: this.temporalHorizon.retention.sinceLastTurn,
      selfNarrative: this.selfModel.currentChapter,
      growthLog: this.selfModel.growthLog,
      snapshot: this.snapshot.formatForPrompt(),
    };

    this.coldAnalyzer.analyze(params)
      .then((cache: ColdCache) => {
        cache.turnGenerated = this.turnCount;
        this.coldCache = cache;
        // Apply cold analysis results to state
        this.affectiveResidue.vector = cache.affectiveVector;
        if (cache.selfNarrativeText) {
          this.selfModel.currentChapter = cache.selfNarrativeText;
        }
        // Slow param modulation from full psych
        const slowShifts = this.modulator.modulateSlow(
          cache, /* memoryCtx */ "", null, cache.selfNarrativeText,
        );
        this.modulator.applyShifts(slowShifts, true);
        // State evolution
        this.mindState = this.dynamics.step(this.mindState, this.drives, {
          affect: { pleasure: cache.emotion.pleasure, arousal: cache.emotion.arousal, dominance: cache.emotion.dominance },
          attachment_activation: cache.attachment.activation,
          defense_strength: cache.defense.intensity,
          control: cache.appraisal.copingPotential,
        });
        this.drives.tick(1);
        this.predictionTracker.observe(this.mindState);
        // Memory storage
        this.storeMemoryRecords(input, response, cache);
        // Metabolism
        if (this.metabolism.shouldDaydream(this.tickCount, this.memConfig.daydreamIntervalTicks)) {
          this.metabolism.daydream().catch(() => {});
        }
        if (this.metabolism.shouldQuickSleep(this.tickCount, this.memConfig.quickSleepIntervalTicks)) {
          this.metabolism.quickSleep().catch(() => {});
        }
      })
      .catch((err: Error) => {
        console.warn("[cold] 4-layer analysis failed:", err.message);
      })
      .finally(() => {
        this.coldPending = false;
      });
  }

  /** Store memory records from cold analysis results */
  private async storeMemoryRecords(input: string, response: string, cold: ColdCache): Promise<void> {
    const emoKey = cold.emotion.dominant;
    const emoVal = cold.emotion.intensity;
    try {
      await this.workingMemory.store(createMemoryRecord({
        content: input, eventType: "user_input", significance: 0.5,
        emotionalSignature: { [emoKey]: emoVal }, tags: ["user", emoKey],
        memoryType: "episodic", confidence: 0.8,
      }));
      await this.workingMemory.store(createMemoryRecord({
        content: response, eventType: "assistant_response", significance: 0.5,
        emotionalSignature: { [emoKey]: emoVal }, tags: ["assistant", emoKey],
        memoryType: "episodic", confidence: 0.7,
      }));
      this.snapshot.markDirty();
    } catch (e) {
      console.warn("[cold] memory storage failed:", e);
    }
  }

  /** Consume stale Slow results from aborted turns — feed to memory and self-reflection. */
  consumeStaleSlow(results: any[]): void {
    for (const r of results) {
      if (r?.content) {
        this.selfReflection.fastReflect("(stale slow)", r.content.slice(0, 200), undefined);
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.metabolism.fullSleep();
    await this.workingMemory.shutdown();
    await this.shortTermMemory.shutdown();
    await this.longTermMemory.shutdown();
    await this.coreGraph.shutdown();
  }
}

/** Task keywords: reading files, executing commands, searching, summarizing */
const TASK_KEYWORDS = [
  "读", "打开", "查看", "显示", "列出", "搜索", "找", "查找",
  "执行", "运行", "总结", "概括", "分析", "修改", "编辑", "写",
  "read", "open", "cat", "ls", "find", "grep", "run", "exec",
];

function detectTaskMode(input: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  return TASK_KEYWORDS.some(kw => lower.includes(kw));
}
