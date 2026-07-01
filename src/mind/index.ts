// Legacy modules (gradually phase out)
export { MindState } from "./state";
export { PsychologyEngine, PsychologyResult, EmotionResult } from "./psychology";
export type { AttachmentResult, DefenseResult, AppraisalResult, MotivationResult, RelationResult } from "./psychology";
export { extractJSON, extractXML, extractXMLAttr } from "./json-parser";
export { AffectiveResidue } from "./emotion";
export type { AffectiveVector, DepositOptions } from "./emotion";
export { SelfModel } from "./self-model";
export type { GrowthEvent, UserPreferences, RelationshipState, UserPatterns, KnownFact } from "./self-model";
export { TemporalHorizon } from "./horizon";
export { PredictionTracker } from "./prediction";
export { scoreSalience, updateWorkspace } from "./attention";
export type { ConsciousContent } from "./attention";
export { DriveState, createDesire } from "./drives";
export { DriveDynamics, ForceVector } from "./dynamics";
export { DriveSublimator } from "./sublimator";
export type { StyleHints } from "./sublimator";
export { SaturationState, ContinuousParams } from "./saturation";
export { UnifiedParams, Param, ChangeSpeed } from "./params";
export { ParamsModulator } from "./params-modulator";
export type { ModulationRecord } from "./params-modulator";
export { createGroundTruth, gtFileLoaded, gtFileFailed, gtRecordTool, gtSetTask, gtAddFact, formatGroundTruthForPrompt } from "./ground-truth";
export type { GroundTruth, FileState, TaskState, ToolResultEntry } from "./ground-truth";
export { SaturationDetector, RelationMode } from "./relational";

// v4 modules (active)
export { HomeostaticState } from "./homeostatic-state";
export { computeTDErrors, updateV, updateV_opAL, computeV, totalV, computeRuleRewards, computeHomeostaticReward, initGoWeights, initNoGoWeights } from "./td-error";
export type { TDErrorResult, VariableName, GoNoGoWeights } from "./td-error";
export { computeCPM, computePAD, padToGenParams } from "./cpm-pad";
export type { CPMAppraisal, PAD, GenParams } from "./cpm-pad";
export { ConsciousnessStream, estimateThoughtSimilarity } from "./consciousness";
export type { ThoughtFragment, ThoughtAction } from "./consciousness";
export { applySetpointDrift } from "./setpoint-drift";

// v4 new modules
export { ForceField, createForceFieldRegistry, gaussianRandom } from "./force-field";
export type { Force, ForceFieldConfig, ForceFieldRegistry } from "./force-field";
export { updateMoods, computeMoodSignals, computeMoodFeedbacks, snapshotMoods } from "./mood";
export type { MoodSnapshot, MoodDimension, MoodForces } from "./mood";
export { inferInteroceptiveState, updateInteroceptivePrecision } from "./interoception";
export type { InteroceptiveState, InteroceptionConfig } from "./interoception";
export { computeRuminationForces, updateRumination, updateSubprocesses, classifyRuminationVsReflection, ruminationMemoryBias } from "./rumination";
export type { RuminationState, RuminationConfig, RuminationForces } from "./rumination";
export { selectRegulationStrategy, computeBreakdownForces, updateBreakdown, assessBreakdown, attemptReappraisal, attemptSuppression, attemptAcceptance, ruminationRegulationModulation, strategyLatency } from "./emotion-regulation";
export type { RegulationProfile, RegulationStrategy, RegulationAttempt, BreakdownState, BreakdownForces } from "./emotion-regulation";
export { TheoryOfMind, calibrateBelief } from "./theory-of-mind";
export type { MentalState, UserBelief, UserDesire, UserIntention, ToMPrediction } from "./theory-of-mind";
export { computeMirrorResonance, computeCognitiveContagion, computeMoodSynchronization } from "./emotional-contagion";
export type { ContagionParams, ContagionResult } from "./emotional-contagion";
export { NarrativeIdentitySystem, narrativePredictionError } from "./narrative-identity";
export type { NarrativeIdentity, SelfDefiningMemory, NarrativeTheme, NarrativeCoherence, SelfContinuity, ShadowResult } from "./narrative-identity";
export { computeBoredomForces, updateBoredom, assessBoredom, estimateNovelty, estimatePredictability, computeBoredomBehavior } from "./boredom";
export type { BoredomState, BoredomForces, BoredomBehaviorEffects } from "./boredom";
export { detectSemanticThreats, detectToneThreats, detectExpectationViolation, detectRelationalThreats, computeInteroceptiveSensitivity, computeUncertaintyFactor, fuseThreatSignals, updateBISBAS, computeFFFS } from "./bis-bas";
export type { ThreatSignal, ThreatChannelOutput, ThreatDetectionContext, ThreatConceptVectors, BISBASState, FFFSState } from "./bis-bas";
export { THREAT_CONCEPT_TEXTS } from "./bis-bas";
