/**
 * Character Agent — Main orchestrator ties all character subsystems together.
 * This is the master entry point that ties all character subsystems together.
 */
// v4 mind — homeostatic emergent architecture
import { HomeostaticState, type HomeostaticSnapshot } from "../mind/homeostatic-state";
import { computeRuleRewards, computeHomeostaticReward, computeV, computeTDErrors, updateV, updateV_opAL, totalV, initGoWeights, initNoGoWeights } from "../mind/td-error";
import type { TDErrorResult, VariableName, GoNoGoWeights } from "../mind/td-error";
import { computeCPM, computePAD, padToGenParams, padToPromptHint } from "../mind/cpm-pad";
import type { CPMAppraisal, PAD } from "../mind/cpm-pad";
import { updateBISBAS, fuseThreatSignals } from "../mind/bis-bas";
import type { BISBASState, ThreatSignal } from "../mind/bis-bas";
import { applySetpointDrift, updateRecentEMA } from "../mind/setpoint-drift";
import { ConsciousnessStream } from "../mind/consciousness";
import type { IProvider } from "./provider";

// v4 new modules
import { ForceField, createForceFieldRegistry } from "../mind/force-field";
import type { ForceFieldRegistry } from "../mind/force-field";
import { updateMoods, computeMoodSignals, computeMoodFeedbacks } from "../mind/mood";
import type { MoodSnapshot } from "../mind/mood";
import { inferInteroceptiveState, updateInteroceptivePrecision } from "../mind/interoception";
import type { InteroceptiveState } from "../mind/interoception";
import { computeRuminationForces, updateRumination, classifyRuminationVsReflection, ruminationMemoryBias } from "../mind/rumination";
import { selectRegulationStrategy, computeBreakdownForces, updateBreakdown, assessBreakdown, attemptSuppression } from "../mind/emotion-regulation";
import type { RegulationProfile, BreakdownState } from "../mind/emotion-regulation";
import { TheoryOfMind } from "../mind/theory-of-mind";
import { computeMirrorResonance, computeCognitiveContagion } from "../mind/emotional-contagion";
import type { ContagionResult } from "../mind/emotional-contagion";
import { NarrativeIdentitySystem } from "../mind/narrative-identity";
import { computeBoredomForces, updateBoredom, assessBoredom } from "../mind/boredom";
import type { BoredomState } from "../mind/boredom";
import { detectReflectionEvents, executeReflection } from "./deep-reflection";
import { updateSleepDrive, computeCircadianPressure } from "./sleep";
import { PersonalityManager } from "../personality/personality";
import type { PersonalityParameters } from "../personality/personality";
// Legacy (kept for backward compat during migration)
import { MindState } from "../mind/state";
import { PsychologyEngine, PsychologyResult } from "../mind/psychology";
import { UnifiedParams } from "../mind/params";
import { ParamsModulator } from "../mind/params-modulator";
import { DriveState } from "../mind/drives";
import { DriveDynamics } from "../mind/dynamics";
import { DriveSublimator } from "../mind/sublimator";
import { SaturationState, ContinuousParams } from "../mind/saturation";
import { SaturationDetector } from "../mind/relational";
import { SelfModel } from "../mind/self-model";
import { AffectiveResidue } from "../mind/emotion";
import { TemporalHorizon } from "../mind/horizon";
import { PredictionTracker } from "../mind/prediction";
import { PostFilter } from "../guard/post-filter";
import { WorkingMemory } from "../memory/working";
import { ShortTermMemory } from "../memory/short-term";
import { LongTermMemory } from "../memory/long-term";
import { CoreGraphMemory } from "../memory/core-graph";
import { ArchiveMemory } from "../memory/archive";
import { SleepCycleMetabolism } from "../memory/metabolism";
import { FrozenSnapshot } from "../memory/snapshot";
import { FeedbackLoop } from "../learn/feedback-loop";
import { SelfReflection } from "../learn/self-reflection";
import { SkillLibrary } from "../learn/skill-library";
import { loadAssistantConfig, loadMemoryConfig, ensureSkillsDir } from "./config-loader";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { ColdCache, detectEmotionHeuristic, FourLayerColdAnalyzer, type ColdAnalyzeParams } from "./cold-analyzer";
import { SpanBasedGenerator } from "./dual-track";
import { createGroundTruth, type GroundTruth } from "../mind/ground-truth";
import { ToolRegistry } from "../tools/registry";
import { registerAllTools } from "../tools/register-all";
import type { Tracer, Span } from "../telemetry";
import { GuardPipeline, createRegexDenyGate, createSafetyCheckGate, createToolArgsValidatorGate } from "../guard";
import { CheckpointManager, type RootState, type DerivedState } from "../recovery";
import type { TurnEvent, RunOptions, RunResult, TurnPhase } from "./events";
import { COLD_LAYER_NAMES } from "./events";
import { mkdirSync } from "fs";
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

/**
 * ReflectionGate — on-demand arbitration for cold-path analysis.
 *
 * Cold analysis is expensive (4 LLM passes). The gate prevents
 * unnecessary cold-path execution when the agent's state is stable.
 *
 * Returns true when cold analysis is warranted:
 *   - TD error magnitude exceeds threshold (surprise / prediction failure)
 *   - Allostatic load exceeds threshold (chronic stress demands reflection)
 *   - PAD indicates strong negative affect (emotional dysregulation)
 */
function shouldTriggerColdPath(
  _input: string,
  _response: string,
  td: TDErrorResult,
  allostaticLoad: number,
  currentPAD: PAD | null,
): boolean {
  // TD error: significant prediction error demands deeper analysis
  if (Math.abs(td.total) > 0.3) return true;

  // Allostatic load: chronic stress accumulation requires reflection
  if (allostaticLoad > 0.5) return true;

  // PAD: strong negative affect — the agent is emotionally dysregulated
  if (currentPAD) {
    if (currentPAD.pleasure < -0.3) return true;
    if (currentPAD.arousal > 0.7) return true;
    if (currentPAD.dominance < -0.3) return true;
  }

  return false;
}

export class CharacterAgent {
  // ── v4 emergent systems ──
  homeostatic: HomeostaticState;
  vValues: Record<VariableName, number> = { energy: 0, arousal: 0, safety: 0, connection: 0, mastery: 0 };
  /** OpAL Go weights (D1 — positive δ) */
  goWeights: GoNoGoWeights;
  /** OpAL NoGo weights (D2 — negative δ) */
  noGoWeights: GoNoGoWeights;
  consciousness: ConsciousnessStream;
  currentPAD: PAD | null = null;
  currentBISBAS: BISBASState | null = null;

  // ── v4 new: force fields, moods, interoception, regulation ──
  forceFields: ForceFieldRegistry;
  currentMood: MoodSnapshot = {
    euthymic: 0.5, irritable: 0.3, anxious: 0.3, vital: 0.5,
    warm: 0.5, confident: 0.5, grateful: 0.5, proud: 0.4,
    curious: 0.5, hopeful: 0.5, awed: 0.4, playful: 0.5,
    paniGrief: 0.1, fatigue: 0,
  };
  interoState: InteroceptiveState | null = null;
  regulationProfile: RegulationProfile = {
    reappraisalAbility: 0.55, suppressionTendency: 0.35,
    situationModification: 0.5, acceptanceTolerance: 0.55,
    attentionalFlexibility: 0.5, ruminationVulnerability: 0.4,
  };
  breakdownState: BreakdownState = { urge: 0, inBreakdown: false, breakdownFrames: 0, attemptedStrategies: [] };
  boredomState: BoredomState = { cognitiveEngagement: 0.55, engagementSetPoint: 0.65, boredomIntensity: 0, novelty: 0.5, predictability: 0.5, meaningfulness: 0.5, explorationUrge: 0, disengaged: false };
  contagionResult: ContagionResult | null = null;
  suppressionCumulative = 0;

  // ── v4: ToM, narrative identity, personality, sleep ──
  theoryOfMind: TheoryOfMind | null = null;
  narrativeIdentity: NarrativeIdentitySystem | null = null;
  personality: PersonalityManager | null = null;
  prevRuminationActive = false;

  // ── Legacy subsystems (kept during migration) ──
  mindState: MindState;
  params: UnifiedParams;
  modulator: ParamsModulator;
  drives: DriveState;
  dynamics: DriveDynamics;
  driveSublimator: DriveSublimator;
  saturation: SaturationState;
  continuousParams: ContinuousParams;
  saturationDetector: SaturationDetector;
  selfModel: SelfModel;
  affectiveResidue: AffectiveResidue;
  temporalHorizon: TemporalHorizon;
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
  fastProvider: IProvider;
  slowProvider: IProvider;
  psychologyEngine: PsychologyEngine;

  // Observability
  tracer?: Tracer;

  // Guardrails
  guardPipeline: GuardPipeline;

  // Recovery
  checkpointManager?: CheckpointManager;

  // Eval
  evalMode = false;

  // Hooks
  hooks: AgentHook[] = [];

  // Config
  config: ReturnType<typeof loadAssistantConfig>;
  memConfig: ReturnType<typeof loadMemoryConfig>;
  configDir: string;

  // State
  tickCount = 0;
  turnCount = 0;
  initialized = false;
  private firstTurnDone = false;
  private dataDays = 0; // for setpoint drift

  /** Shared factual state — Hot Path reads, all writes via tool results */
  groundTruth: GroundTruth = createGroundTruth();

  /** Cold Path cache — populated asynchronously, consumed by next turn's Hot Path */
  coldCache: ColdCache | null = null;
  private coldAnalyzer: FourLayerColdAnalyzer | null = null;
  private coldPending = false;

  constructor(opts: {
    configDir: string;
    genProvider: IProvider;
    psychProvider: IProvider;
    genModel?: string;
    psychModel?: string;
    fastProvider?: IProvider;
    tracer?: Tracer;
    guardPipeline?: GuardPipeline;
    checkpointManager?: CheckpointManager;
    evalMode?: boolean;
  }) {
    // Config
    this.configDir = opts.configDir;
    this.config = loadAssistantConfig(opts.configDir);
    this.memConfig = loadMemoryConfig(opts.configDir);

    // ── v4 emergent systems ──
    this.homeostatic = new HomeostaticState({
      connectionSetPoint: 0.70,
    });
    this.consciousness = new ConsciousnessStream();
    this.forceFields = createForceFieldRegistry();
    // OpAL dual-channel weights (Collins & Frank 2014)
    this.goWeights = initGoWeights();
    this.noGoWeights = initNoGoWeights();

    // ── Legacy mind systems ──
    this.mindState = new MindState();

    // Params
    this.params = new UnifiedParams();
    this.modulator = new ParamsModulator(this.params);

    // Drive
    this.drives = new DriveState();
    this.dynamics = new DriveDynamics();
    this.driveSublimator = new DriveSublimator();

    // Saturation
    this.saturation = new SaturationState();
    this.continuousParams = new ContinuousParams(this.saturation);
    this.saturationDetector = new SaturationDetector();

    // Consciousness
    this.selfModel = new SelfModel();
    this.selfModel.initFromConfig(this.config as unknown as Record<string, string>);
    this.affectiveResidue = new AffectiveResidue();
    this.temporalHorizon = new TemporalHorizon();
    this.toolRegistry = new ToolRegistry();
    registerAllTools(this.toolRegistry);
    this.predictionTracker = new PredictionTracker();

    // Anti-RLHF
    this.postFilter = new PostFilter();

    // Memory
    this.workingMemory = new WorkingMemory(this.memConfig.workingMemorySize);
    const dbDir = process.env.MEMORY_DB_DIR || "./data";
    try { mkdirSync(dbDir, { recursive: true }); } catch {}
    this.shortTermMemory = new ShortTermMemory(`${dbDir}/stm.db`, this.memConfig.shortTermMemorySize);
    this.longTermMemory = new LongTermMemory(`${dbDir}/ltm.db`, this.memConfig.longTermMemorySize);
    this.coreGraph = new CoreGraphMemory(`${dbDir}/core.db`, this.memConfig.coreGraphMaxNodes, this.memConfig.coreGraphMaxEdges);
    this.archiveMemory = new ArchiveMemory(`${dbDir}/archive.db`);

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

    // Cold analyzer — 4-layer cascaded analysis, runs asynchronously
    this.coldAnalyzer = new FourLayerColdAnalyzer(opts.psychProvider, opts.genProvider);

    // Observability
    this.tracer = opts.tracer;

    // Guardrails — use provided pipeline or create default
    this.guardPipeline = opts.guardPipeline ?? new GuardPipeline([
      createRegexDenyGate(),
      createSafetyCheckGate(),
      createToolArgsValidatorGate(),
    ]);
    this.toolRegistry.guardPipeline = this.guardPipeline;

    // Recovery
    this.checkpointManager = opts.checkpointManager;

    // Eval
    this.evalMode = opts.evalMode ?? false;
  }

  async initialize(): Promise<void> {
    this.skillLibrary.loadFromDisk();
    await this.workingMemory.initialize();
    await this.shortTermMemory.initialize();
    await this.longTermMemory.initialize();
    await this.coreGraph.initialize();
    await this.archiveMemory.initialize();

    // Initialize v4 new modules
    this.personality = new PersonalityManager(this.configDir, this.slowProvider);
    const personalityParams = await this.personality.initialize();
    this.applyPersonalityParams(personalityParams);

    this.theoryOfMind = new TheoryOfMind(this.slowProvider);
    this.narrativeIdentity = new NarrativeIdentitySystem(this.slowProvider);

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
    const turnSpan = this.tracer?.startTurn(input);

    this.tickCount++;
    this.turnCount++;

    // Guardrail: check input before processing
    const inputCheck = await this.guardPipeline.checkInput(input);
    if (!inputCheck.allowed) {
      ctx.response = "(输入被安全护栏拦截)";
      ctx.elapsedMs = Date.now() - startTime;
      if (turnSpan) { turnSpan.setStatus("error"); this.tracer?.endSpan(turnSpan); }
      return ctx;
    }

    // Temporal horizon — retention from last turn enters awareness
    this.temporalHorizon.onTurnStart();

    // ═══════════════════════════════════════════
    // HOT PATH — Generation only
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

    // Fast Track param modulation — from coldCache if available
    if (this.coldCache) {
      const fastShifts = this.modulator.modulateFast(this.coldCache);
      this.modulator.applyShifts(fastShifts);
    }

    // Build system prompt (Hot Path — capabilities + groundTruth + taskMode)
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

    const userPrompt = buildUserPrompt(input, taskMode);

    // Phase 4: Draft (Fast) + Refine (Slow) + Commit — shared GroundTruth
    for (const h of this.hooks) { await h.beforeBuild?.(ctx); }

    const dualTrack = new SpanBasedGenerator(this.fastProvider, this.slowProvider, this.toolRegistry, this.tracer);
    const responseParts: string[] = [];
    const abortController = new AbortController();

    try {
    // Dynamic generation params: saturation + drive style hints
    const hints = this.driveSublimator.buildStyleHints(this.drives);
    const genTemp = Math.max(0.1, Math.min(1.5,
      this.continuousParams.responseTemperature + hints.temperatureShift));
    const genMaxTokens = Math.round(
      this.continuousParams.verbosity * 500 + hints.maxTokensShift);
    for await (const op of dualTrack.generate(ctx.systemPrompt, userPrompt, abortController.signal, this.toolRegistry.getDefinitions(), genTemp, genMaxTokens)) {
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

    // Guardrail: check output through pipeline (includes ALIGN + action filtering via regexDenyGate)
    const outputCheck = await this.guardPipeline.checkOutput(ctx.response);
    ctx.response = outputCheck.content;

    for (const h of this.hooks) { await h.afterGenerate?.(ctx); }

    // Schedule cold analysis — only when ReflectionGate permits
    const shouldCold = shouldTriggerColdPath(
      input, ctx.response,
      { total: 0, energy: 0, arousal: 0, safety: 0, connection: 0, mastery: 0, dominant: "safety" as const },
      this.homeostatic.allostaticLoad,
      this.currentPAD,
    );
    if (shouldCold) {
      this.scheduleColdAnalysis(input, ctx.response, taskMode);
    }

    // State updates that don't need LLM (keep these synchronous)
    this.saturation.positiveInteraction(emoIntensity);
    this.affectiveResidue.deposit(
      { dominant: emoDominant, intensity: emoIntensity, pleasure: quickEmo.pleasure },
      Math.max(0.2, emoIntensity),
    );
    } catch (err: any) {
      // Generation failed (API error, abort, etc.) — surface an error response
      // instead of crashing the turn loop. Turn span is ended in finally.
      ctx.response = ctx.response || `(生成失败: ${err?.message ?? "unknown error"})`;
      if (turnSpan) turnSpan.setStatus("error");
    } finally {
      // Always end the turn span + reset cold-pending guard so a failed turn
      // doesn't leak an open span or deadlock the next cold analysis.
      ctx.elapsedMs = Date.now() - startTime;
      if (turnSpan) this.tracer?.endTurn(turnSpan, ctx.totalTokens, this.turnCount);
    }

    // Checkpoint: save state at turn boundary
    if (this.checkpointManager) {
      this.checkpointManager.recordUserMessage(input);
      this.checkpointManager.recordAssistantMessage(ctx.response.slice(0, 500));
      this.saveCheckpoint(ctx.systemPrompt);
    }

    return ctx;
  }

  /**
   * New event-stream API — yields structured TurnEvents for UI consumption.
   * Replaces the black-box "agent.run(input, onDelta)" with full transparency.
   */
  async *runStream(input: string, opts?: RunOptions): AsyncGenerator<TurnEvent, RunResult, void> {
    if (!this.initialized) await this.initialize();

    const startTs = Date.now();
    let totalTokens = 0;
    let responseText = "";

    const emit = (e: TurnEvent) => { /* events are yielded, not emitted */ };

    // Phase 1: guard_input
    let phaseStart = Date.now();
    yield { type: "phase_start", phase: "guard_input", ts: phaseStart };
    const inputCheck = await this.guardPipeline.checkInput(input);
    if (!inputCheck.allowed) {
      yield { type: "error", phase: "guard_input", message: "输入被安全护栏拦截", recoverable: false };
      const elapsed = Date.now() - startTs;
      yield { type: "done", turnId: this.turnCount, elapsedMs: elapsed, totalTokens: 0 };
      return { turnId: this.turnCount, response: "(输入被安全护栏拦截)", totalTokens: 0, elapsedMs: elapsed };
    }
    yield { type: "phase_end", phase: "guard_input", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 2: restore_memory
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "restore_memory", ts: phaseStart };
    if (this.snapshot.isStale()) {
      const stmRecords = await this.shortTermMemory.recall(input, 3);
      const ltmRecords = await this.longTermMemory.recall(input, 5);
      const coreSummary = (await this.coreGraph.recall(input, 1))[0]?.content ?? "";
      this.snapshot.freeze({}, ltmRecords, stmRecords, coreSummary);
    }
    this.temporalHorizon.onTurnStart();
    yield { type: "phase_end", phase: "restore_memory", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 3: read_state (no update, just read)
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "read_state", ts: phaseStart };
    const quickEmo = detectEmotionHeuristic(input);
    if (this.coldCache) {
      const fastShifts = this.modulator.modulateFast(this.coldCache);
      this.modulator.applyShifts(fastShifts);
    }
    yield { type: "phase_end", phase: "read_state", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 4: build_prompt
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "build_prompt", ts: phaseStart };
    const taskMode = detectTaskMode(input);
    const sysPrompt = buildSystemPrompt({
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
      emotionDominant: quickEmo.dominant,
      emotionIntensity: quickEmo.intensity,
      affectiveResidueText: this.coldCache?.affectiveResidueText ?? this.affectiveResidue.formatForPrompt(),
      driveBiasText: this.driveSublimator.buildAttentionBias(this.drives),
      selfNarrativeText: this.coldCache?.selfNarrativeText ?? this.selfModel.formatForHotPath(),
      temporalHorizonText: this.coldCache?.temporalHorizonText ?? this.temporalHorizon.formatForPrompt(),
      isFirstTurn: !this.firstTurnDone,
    });
    this.firstTurnDone = true;
    // Append v4 PAD emotional tone hint (weak constraint)
    const padHint = this.currentPAD ? `\n\n## 情绪底色\n${padToPromptHint(this.currentPAD)}` : "";
    const fullSysPrompt = sysPrompt + padHint;
    const userPrompt = buildUserPrompt(input, taskMode);
    yield { type: "phase_end", phase: "build_prompt", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 5: generate (streaming + tool loop)
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "generate", ts: phaseStart };
    const dualTrack = new SpanBasedGenerator(this.fastProvider, this.slowProvider, this.toolRegistry, this.tracer);
    const responseParts: string[] = [];
    const abortController = new AbortController();
    const signal = opts?.signal ?? abortController.signal;

    try {
      const hints = this.driveSublimator.buildStyleHints(this.drives);
      const genTemp = Math.max(0.1, Math.min(1.5,
        this.continuousParams.responseTemperature + hints.temperatureShift));
      const genMaxTokens = Math.round(
        this.continuousParams.verbosity * 500 + hints.maxTokensShift);
      for await (const op of dualTrack.generate(fullSysPrompt, userPrompt, signal, this.toolRegistry.getDefinitions(), genTemp, genMaxTokens)) {
        if (op.type === "invalidate") {
          responseParts.length = 0;
          continue;
        }
        const text = op.type === "append" ? op.span.text
          : op.type === "patch" ? op.newText
          : "";
        if (text) {
          responseParts.push(text);
          yield { type: "text_delta", text };
        }
        // Tool calls are intercepted by SpanBasedGenerator internally;
        // tool_start/tool_end events are injected via the onToolCall hook below
      }
      responseText = responseParts.join("");

      // Guard output (includes ALIGN + action filtering via regexDenyGate)
      const outputCheck = await this.guardPipeline.checkOutput(responseText);
      responseText = outputCheck.content;
    } catch (err: any) {
      responseText = responseText || `(生成失败: ${err?.message ?? "unknown error"})`;
      yield { type: "error", phase: "generate", message: err?.message ?? "unknown", recoverable: true };
    }
    yield { type: "phase_end", phase: "generate", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 6: guard_output (already done inline above, but emit phase marker)
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "guard_output", ts: phaseStart };
    yield { type: "phase_end", phase: "guard_output", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 7: update_instant — v4 emergent computation
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "update_instant", ts: phaseStart };
    this.tickCount++;
    this.turnCount++;

    // ── v4 emergent pipeline ──
    // 1. Snapshot homeostatic state before reward application
    const hBefore = this.homeostatic.snapshot();

    // 2. Compute rule-based rewards from user input
    const ruleRewards = computeRuleRewards(input);

    // 3. Apply rule rewards to homeostatic state (kept for step numbering reference)
    for (const name of ["energy", "arousal", "safety", "connection", "mastery"] as const) {
      this.homeostatic.apply(name, ruleRewards[name]);
    }

    // 4. Snapshot homeostatic state after reward application
    const hAfter = this.homeostatic.snapshot();

    // 5. Compute endogenous homeostatic reward (deviation reduction)
    const rHomeo = computeHomeostaticReward(hBefore, hAfter);

    // 6. Mix rule rewards + homeostatic reward (weighted blend)
    const rewards: Record<VariableName, number> = { energy: 0, arousal: 0, safety: 0, connection: 0, mastery: 0 };
    for (const name of ["energy", "arousal", "safety", "connection", "mastery"] as const) {
      // Blend: 70% rule-based + 30% homeostatic (endogenous signal)
      rewards[name] = ruleRewards[name] * 0.7 + rHomeo[name] * 0.3;
    }

    // 7. Compute V(s) and TD errors
    const vCurrent = computeV(this.homeostatic);
    const vNext: Record<VariableName, number> = { ...vCurrent };
    const td = computeTDErrors(rewards, vCurrent, vNext);

    // 8. Update V(s) with OpAL dual-channel learning (Collins & Frank 2014)
    // Neuromodulatory effects modulate learning rate (McEwen 1998)
    const neuro = this.homeostatic.getNeuromodulatoryEffects();
    const effectiveAlphaG = 0.12 * (1 - neuro.learningRateImpairment);
    const effectiveAlphaN = 0.08 * (1 - neuro.learningRateImpairment);
    updateV_opAL(this.vValues, this.goWeights, this.noGoWeights, td, effectiveAlphaG, effectiveAlphaN);
    // Apply arousal shift from allostatic load
    if (neuro.arousalShift > 0) {
      this.homeostatic.arousal.value += neuro.arousalShift * 0.02;
      this.homeostatic.arousal.value = Math.min(0.9, this.homeostatic.arousal.value);
    }
    // Apply safety decay from allostatic load
    if (neuro.safetyDecay > 0) {
      this.homeostatic.safety.value -= neuro.safetyDecay * 0.01;
      this.homeostatic.safety.value = Math.max(0, this.homeostatic.safety.value);
    }

    // 9. CPM → PAD → gen params
    const cpm = computeCPM(td, this.homeostatic.allostaticLoad, this.toolRegistry.getDefinitions().length, 1.0);
    this.currentPAD = computePAD(cpm, td, this.homeostatic.allostaticLoad, 0.7);

    // 10. Mood update — 12D force field integration
    const moodSignals = computeMoodSignals(
      this.currentPAD, td, this.currentBISBAS?.bisActivation ?? 0,
      (this.currentBISBAS?.threatSignals?.length ?? 0) > 0,
      0.3, 0.1, // novelty, timeDepth (stubs — wired later with boredom)
      this.homeostatic.safety.value, this.homeostatic.connection.value,
      this.homeostatic.energy.value, this.homeostatic.mastery.value, this.homeostatic.arousal.value,
    );
    const moodFields: Record<string, ForceField> = {
      moodEuthymic: this.forceFields.moodEuthymic,
      moodIrritable: this.forceFields.moodIrritable,
      moodAnxious: this.forceFields.moodAnxious,
      moodVital: this.forceFields.moodVital,
      moodWarm: this.forceFields.moodWarm,
      moodConfident: this.forceFields.moodConfident,
      moodGrateful: this.forceFields.moodGrateful,
      moodProud: this.forceFields.moodProud,
      moodCurious: this.forceFields.moodCurious,
      moodHopeful: this.forceFields.moodHopeful,
      moodAwed: this.forceFields.moodAwed,
      moodPlayful: this.forceFields.moodPlayful,
    };
    this.currentMood = updateMoods(moodFields, moodSignals);

    // 11. BIS/BAS — use actual mood (not placeholder)
    this.currentBISBAS = updateBISBAS(td, [], this.homeostatic.allostaticLoad, this.currentMood);

    // 12. Rumination forces
    const rumForces = computeRuminationForces(
      this.forceFields.rumination, this.currentMood,
      { vulnerability: this.regulationProfile.ruminationVulnerability, abstractionBias: 0.5 },
      0.3, 0.3, 0.5, 0.3, // selfRef, abstraction, closure, novelty (stubs)
      this.currentPAD.pleasure > 0.2 ? 0.2 : 0, // userPositiveAffect
      this.regulationProfile.reappraisalAbility,
    );
    updateRumination(this.forceFields.rumination, rumForces);
    const ruminationActive = this.forceFields.rumination.value > 0.2;

    // 13. Emotion regulation — assess breakdown
    const regForces = computeBreakdownForces(
      this.suppressionCumulative,
      Math.abs(this.currentPAD.pleasure) * 0.5 + Math.abs(this.currentPAD.arousal) * 0.3,
      this.homeostatic.allostaticLoad, this.homeostatic.energy.value,
      this.currentPAD, this.homeostatic.safety.value - this.homeostatic.safety.setPoint,
      this.regulationProfile,
    );
    updateBreakdown(this.forceFields.breakdownUrge, regForces);
    const breakdown = assessBreakdown(this.forceFields.breakdownUrge, this.breakdownState.breakdownFrames, this.suppressionCumulative);
    this.breakdownState = breakdown.state;
    this.suppressionCumulative = breakdown.suppressionReset;

    // 14. Boredom
    const boredomForces = computeBoredomForces(0.3, 0.5, 0.5, 0.4, 1 - this.homeostatic.energy.value, this.currentMood.playful);
    updateBoredom(this.forceFields.boredom, boredomForces);
    this.boredomState = assessBoredom(this.forceFields.boredom, 0.65, 0.3, 0.5, 0.5);

    // 15. Interoceptive inference
    updateInteroceptivePrecision(
      { interoEnergy: this.forceFields.interoEnergy, interoArousal: this.forceFields.interoArousal, interoSafety: this.forceFields.interoSafety, interoConnection: this.forceFields.interoConnection, interoMastery: this.forceFields.interoMastery },
      this.homeostatic, this.homeostatic.allostaticLoad, this.suppressionCumulative,
      "internal", 0.3,
    );
    // (full interoceptive state inference deferred until we have s*_predicted — wire after allostasis)

    // 16. Emotional contagion — mirror resonance (fast, no LLM)
    if (this.currentPAD) {
      this.contagionResult = {
        padShift: computeMirrorResonance(
          this.currentPAD, this.currentPAD, // user PAD stub — wire after L2 extracts user emotion
          this.homeostatic.connection.value,
          this.forceFields.interoEnergy.value,
        ).shift,
        strength: 0,
        dominantChannel: "mirror",
        mirrorMagnitude: 0,
        cognitiveMagnitude: 0,
      };
    }

    // 17. Sleep drive
    const now = new Date();
    const circadian = computeCircadianPressure(now.getHours());
    updateSleepDrive(this.forceFields.sleepDrive, circadian.pressure, 0, this.homeostatic.energy.value, this.homeostatic.allostaticLoad, false);

    // 18. Deep reflection event detection
    const reflectionEvents = detectReflectionEvents(
      this.homeostatic.safety.value - this.homeostatic.safety.setPoint,
      this.currentBISBAS?.bisActivation ?? 0,
      { inBreakdown: this.breakdownState.inBreakdown, urge: this.breakdownState.urge },
      this.forceFields.rumination.value,
      this.prevRuminationActive,
      false, // stageChanged
      this.homeostatic.allostaticLoad,
      0, // allostaticSustainedTicks
      0, // maxSetpointDrift
      0, // gapHours
      this.forceFields.reflectionFatigue,
    );
    this.prevRuminationActive = ruminationActive;

    // 19. Trigger deep reflection if events detected (fire-and-forget)
    if (reflectionEvents.length > 0 && this.theoryOfMind && this.narrativeIdentity && this.personality) {
      for (const evt of reflectionEvents) {
        // Fill context before execution
        evt.context = {
          recentDialog: input.slice(0, 500),
          relatedMemories: [],
          currentMood: this.currentMood,
          currentPAD: this.currentPAD!,
          currentSelfView: this.narrativeIdentity.buildSelfView(),
          bisActivation: this.currentBISBAS?.bisActivation ?? 0,
          basActivation: this.currentBISBAS?.basActivation ?? 0,
          allostaticLoad: this.homeostatic.allostaticLoad,
        };
        executeReflection(this.slowProvider, evt, this.narrativeIdentity, this.personality)
          .catch(() => { /* fire-and-forget */ });
        this.forceFields.reflectionFatigue.jump(0.25);
      }
    }

    // 20. Update allostatic load
    this.homeostatic.updateAllostaticLoad(0.5);

    // 21. Update EMA for setpoint drift
    updateRecentEMA(this.homeostatic);
    this.dataDays += (1 / 1440);

    // 22. Apply setpoint drift (every ~100 turns)
    if (this.turnCount % 100 === 0) {
      applySetpointDrift(this.homeostatic, Math.min(30, this.dataDays));
    }

    // ── Legacy updates (kept during migration) ──
    this.saturation.positiveInteraction(quickEmo.intensity);
    this.affectiveResidue.deposit(
      { dominant: quickEmo.dominant, intensity: quickEmo.intensity, pleasure: quickEmo.pleasure },
      Math.max(0.2, quickEmo.intensity),
    );
    yield { type: "phase_end", phase: "update_instant", ts: phaseStart, durationMs: Date.now() - phaseStart };

    // Phase 8: cold_analyze (fire-and-forget — 3-layer fusion, gated)
    const shouldCold2 = shouldTriggerColdPath(
      input, responseText, td,
      this.homeostatic.allostaticLoad,
      this.currentPAD,
    );
    if (shouldCold2) {
      this.scheduleColdAnalysis(input, responseText, taskMode);
    }
    yield { type: "phase_end", phase: "cold_analyze", ts: phaseStart, durationMs: 0 };

    // Phase 9: checkpoint
    phaseStart = Date.now();
    yield { type: "phase_start", phase: "checkpoint", ts: phaseStart };
    if (this.checkpointManager) {
      this.checkpointManager.recordUserMessage(input);
      this.checkpointManager.recordAssistantMessage(responseText.slice(0, 500));
      this.saveCheckpoint(sysPrompt);
    }
    yield { type: "phase_end", phase: "checkpoint", ts: phaseStart, durationMs: Date.now() - phaseStart };

    const elapsed = Date.now() - startTs;
    yield { type: "done", turnId: this.turnCount, elapsedMs: elapsed, totalTokens: totalTokens };
    return { turnId: this.turnCount, response: responseText, totalTokens: totalTokens, elapsedMs: elapsed };
  }

  /** Cold Path — post-generation cognition is handled entirely by scheduleColdAnalysis (fire-and-forget). */
  private scheduleColdAnalysis(input: string, response: string, taskMode: boolean): void {
    if (!this.coldAnalyzer || this.coldPending) return;
    this.coldPending = true;

    const params: ColdAnalyzeParams = {
      input, response, taskMode,
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
      selfNarrative: this.selfModel.formatForHotPath(),
      growthLog: this.selfModel.growthLog,
      snapshot: this.snapshot.formatForPrompt(),
    };

    this.coldAnalyzer.analyze(params)
      .then((cache: ColdCache) => {
        cache.turnGenerated = this.turnCount;
        this.coldCache = cache;
        this.affectiveResidue.vector = cache.affectiveVector;
        if (cache.selfNarrativeText) {
          // SelfModel v2 stores narrative via recordGrowth
          this.selfModel.recordGrowth("cold_narrative", cache.selfNarrativeText, 0.7);
        }
        const slowShifts = this.modulator.modulateSlow(cache, "", null, cache.selfNarrativeText);
        this.modulator.applyShifts(slowShifts, true);
        this.mindState = this.dynamics.step(this.mindState, this.drives, {
          affect: { pleasure: cache.emotion.pleasure, arousal: cache.emotion.arousal, dominance: cache.emotion.dominance },
          attachment_activation: cache.attachment.activation,
          defense_strength: cache.defense.intensity,
          control: cache.appraisal.copingPotential,
        });
        this.drives.tick(1);
        this.predictionTracker.observe(this.mindState);
        this.storeMemoryRecords(input, response, cache);
        if (this.metabolism.shouldDaydream(this.tickCount, this.memConfig.daydreamIntervalTicks))
          this.metabolism.daydream().catch(() => {});
        if (this.metabolism.shouldQuickSleep(this.tickCount, this.memConfig.quickSleepIntervalTicks))
          this.metabolism.quickSleep().catch(() => {});
      })
      .catch((err: Error) => { console.warn("[cold] 4-layer analysis failed:", err.message); })
      .finally(() => { this.coldPending = false; });
  }

  private async storeMemoryRecords(input: string, response: string, cold: ColdCache): Promise<void> {
    const emoKey = cold.emotion.dominant;
    const emoVal = cold.emotion.intensity;
    try {
      const { createMemoryRecord } = await import("../memory/store");
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
    } catch (e) { console.warn("[cold] memory storage failed:", e); }
  }

  /** Consume stale Slow results from aborted turns — feed to memory and self-reflection. */
  consumeStaleSlow(results: any[]): void {
    for (const r of results) {
      if (r?.content) {
        this.selfReflection.fastReflect("(stale slow)", r.content.slice(0, 200), undefined);
      }
    }
  }

  /** Build a RootState snapshot from current agent state. */
  buildRootState(lastSystemPrompt: string): RootState {
    return {
      systemPrompt: lastSystemPrompt,
      memorySnapshot: this.snapshot.formatForPrompt(),
      groundTruthFacts: [...this.groundTruth.facts],
      conversationHistory: [], // populated by checkpoint manager
    };
  }

  /** Build DerivedState from current agent state. */
  buildDerivedState(): DerivedState {
    return {
      affectiveResidue: { ...this.affectiveResidue.vector },
      selfNarrative: `${this.selfModel.relationship.trust.toFixed(2)}`,
      lastEmotion: "neutral",
      saturation: this.saturation.s,
      turnCount: this.turnCount,
    };
  }

  /** Save a checkpoint after a completed turn. */
  saveCheckpoint(systemPrompt: string): void {
    if (!this.checkpointManager) return;
    this.checkpointManager.recordUserMessage(systemPrompt.slice(-500)); // last user context
    this.checkpointManager.save(
      this.buildRootState(systemPrompt),
      this.buildDerivedState(),
    );
  }

  /** Restore agent state from checkpoint data. */
  async restoreFromCheckpoint(data: { root: { memorySnapshot: string; groundTruthFacts: string[]; conversationHistory: Array<{role:string;content:string}> }; derived: { affectiveResidue: {warmth:number;weight:number;clarity:number;tension:number}; selfNarrative: string; saturation: number; turnCount: number } }): Promise<void> {
    // Restore ground truth facts
    this.groundTruth.facts = [...data.root.groundTruthFacts];

    // Restore affective residue
    this.affectiveResidue.vector = { ...data.derived.affectiveResidue };

    // Restore relationship trust
    if (data.derived.selfNarrative) {
      const trust = parseFloat(data.derived.selfNarrative);
      if (!isNaN(trust)) this.selfModel.relationship.trust = trust;
    }

    // Restore saturation
    this.saturation.s = data.derived.saturation;

    // Restore turn count
    this.turnCount = data.derived.turnCount;
    this.firstTurnDone = data.derived.turnCount > 0;

    // Feed conversation history into working memory for context
    for (const msg of data.root.conversationHistory.slice(-10)) {
      await this.workingMemory.store({
        recordId: `rec_${Date.now()}_${Math.random()}`,
        content: msg.content.slice(0, 200),
        emotionalSignature: {},
        significance: 0.5,
        eventType: msg.role === "user" ? "user_input" : "assistant_response",
        tags: [msg.role],
        timestamp: Date.now() / 1000 - 1,
        trust: 0.7,
        recallCount: 0,
        memoryType: "episodic",
        confidence: 0.6,
        superseded: false,
        supersededBy: null,
        metadata: {},
      });
    }
  }

  /** Apply personality parameters to regulation profile and homeostatic setpoints */
  applyPersonalityParams(p: PersonalityParameters): void {
    this.regulationProfile = {
      reappraisalAbility: p.reappraisalAbility,
      suppressionTendency: p.suppressionTendency,
      situationModification: p.situationModification,
      acceptanceTolerance: p.acceptanceTolerance,
      attentionalFlexibility: p.attentionalFlexibility,
      ruminationVulnerability: p.ruminationVulnerability,
    };
    this.homeostatic.energy.setPoint = p.energySetPoint;
    this.homeostatic.arousal.setPoint = p.arousalSetPoint;
    this.homeostatic.safety.setPoint = p.safetySetPoint;
    this.homeostatic.connection.setPoint = p.connectionSetPoint;
    this.homeostatic.mastery.setPoint = p.masterySetPoint;
    this.boredomState.engagementSetPoint = 0.55 + p.approachBias * 0.2;
  }

  /** Lightweight state snapshot for UI rendering (no allocations, just reads). */
  getStateSnapshot(): {
    agentName: string; turnCount: number; saturation: number;
    homeostatic: HomeostaticSnapshot;
    pad: PAD | null; bisbas: BISBASState | null;
    mood: MoodSnapshot; drives: Record<string, number>;
    regulation: { strategy: string; suppressionCumulative: number; breakdown: boolean };
    memory: { wm: number; stm: number; ltm: number; core: number; archive: number };
    relationship: { trust: number; familiarity: number; avoidance: number; ambivalence: number };
    narrative: { agency: number; communion: number; redemption: number; contamination: number; meaning: number };
    metabolism: { lastDaydream: number; lastQuick: number; lastFull: number };
  } {
    // Compute narrative theme strengths from the themes array
    const niSnapshot = this.narrativeIdentity?.snapshot();
    const getThemeStrength = (type: string): number => {
      const matching = niSnapshot?.themes?.filter(t => t.type === type) ?? [];
      if (matching.length === 0) return 0.5;
      return matching.reduce((sum, t) => sum + t.strength, 0) / matching.length;
    };

    return {
      agentName: this.config.name ?? "林雨",
      turnCount: this.turnCount,
      saturation: this.saturation.s,
      homeostatic: this.homeostatic.snapshot(),
      pad: this.currentPAD,
      bisbas: this.currentBISBAS,
      mood: this.currentMood,
      drives: this.drives.getDriveVector(),
      regulation: {
        strategy: this.breakdownState.inBreakdown ? "breakdown" : "reappraisal",
        suppressionCumulative: this.suppressionCumulative,
        breakdown: this.breakdownState.inBreakdown,
      },
      memory: {
        wm: this.workingMemory.length,
        stm: this.shortTermMemory.length,
        ltm: this.longTermMemory.length,
        core: this.coreGraph.length,
        archive: this.archiveMemory.length,
      },
      relationship: {
        trust: 0.5,
        familiarity: 0.5,
        avoidance: this.saturationDetector.avoidance ?? 0.1,
        ambivalence: this.saturationDetector.ambivalence ?? 0.1,
      },
      narrative: {
        agency: getThemeStrength("agency"),
        communion: getThemeStrength("communion"),
        redemption: getThemeStrength("redemption"),
        contamination: getThemeStrength("contamination"),
        meaning: getThemeStrength("meaning"),
      },
      metabolism: {
        lastDaydream: this.metabolism?.stats?.lastDaydream ?? 0,
        lastQuick: this.metabolism?.stats?.lastQuick ?? 0,
        lastFull: this.metabolism?.stats?.lastFull ?? 0,
      },
    };
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
