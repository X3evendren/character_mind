/**
 * Memory Retriever — Activation-Spreading Retrieval Engine.
 *
 * Core principle: human memory retrieval is NOT grep/FTS/regex.
 * It is activation spreading through an associative network.
 *
 * Three layers:
 *   L1: Seed activation — semantic + emotional + temporal channels
 *   L2: Spreading activation — from seeds along edges, 1-2 hops
 *   L3: Convergence & ranking — weighted aggregation + budget truncation
 *
 * No regex. No keyword matching. All similarity via embeddings.
 */

import { cosineSimilarity } from "../utils";
import type { MemoryRecord, MemoryStore } from "./store";
import type { VectorIndex } from "./vector-index";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface SeedActivation {
  nodeId: string;
  activation: number;
  source: "semantic" | "emotional" | "temporal";
}

export interface MemoryEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  coOccurrenceCount: number;
}

export interface RankedMemory {
  record: MemoryRecord;
  finalScore: number;
  activation: number;
  source: string;
  fromDiffusion: boolean;
}

export interface RetrievalResult {
  tierBBlock: string;
  trace: RetrievalTrace;
}

export interface RetrievalTrace {
  totalSeeds: number;
  totalSpreads: number;
  totalHits: number;
  dedupedCount: number;
  injectedCount: number;
  semanticHits: number;
  emotionalHits: number;
  temporalHits: number;
  diffusionHits: number;
  dominantPath: string;
  usedCharBudget: number;
  totalCharBudget: number;
}

export interface RetrievalConfig {
  seedThreshold: number;
  maxHops: number;
  decayPerHop: number;
  edgeMinWeight: number;
  activationMin: number;
  tierBCharBudget: number;
}

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  seedThreshold: 0.25,
  maxHops: 2,
  decayPerHop: 0.4,
  edgeMinWeight: 0.3,
  activationMin: 0.05,
  tierBCharBudget: 8000,
};

// ═══════════════════════════════════════════════════════════════
// Main class
// ═══════════════════════════════════════════════════════════════

export class MemoryRetriever {
  private shortTerm: MemoryStore;
  private longTerm: MemoryStore;
  private vectorIndex: VectorIndex;
  private edges: MemoryEdge[] = [];
  private config: RetrievalConfig;

  constructor(
    shortTerm: MemoryStore,
    longTerm: MemoryStore,
    vectorIndex: VectorIndex,
    config: Partial<RetrievalConfig> = {},
  ) {
    this.shortTerm = shortTerm;
    this.longTerm = longTerm;
    this.vectorIndex = vectorIndex;
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
  }

  setEdges(edges: MemoryEdge[]): void {
    this.edges = edges;
  }

  // ── Main Retrieval ──

  async retrieve(
    queryEmbedding: Float32Array,
    currentPAD: { pleasure: number; arousal: number; dominance: number },
    currentContext: {
      season?: string;
      timeOfDay?: string;
      specialDates?: string[];
    },
    emotionVolatility: number,
    ruminationBias?: {
      emotionBoostMultiplier: number;
      negativityBias: number;
      graphDiffusionExtraHop: number;
      edgeThresholdReduction: number;
    },
  ): Promise<RetrievalResult> {
    // Load all memory nodes
    const stmMemories = await this.shortTerm.search(null, {}, 200);
    const ltmMemories = await this.longTerm.search(null, {}, 500);
    const allMemories = [...stmMemories, ...ltmMemories];

    if (allMemories.length === 0) {
      return {
        tierBBlock: "",
        trace: { totalSeeds: 0, totalSpreads: 0, totalHits: 0, dedupedCount: 0,
          injectedCount: 0, semanticHits: 0, emotionalHits: 0, temporalHits: 0,
          diffusionHits: 0, dominantPath: "none", usedCharBudget: 0, totalCharBudget: this.config.tierBCharBudget },
      };
    }

    // ── Layer 1: Seed Activation ──
    const seeds = await this.activateSeeds(
      queryEmbedding, currentPAD, currentContext,
      allMemories, emotionVolatility,
    );

    // ── Layer 2: Spreading Activation ──
    const edgeThreshold = ruminationBias
      ? Math.max(0.1, this.config.edgeMinWeight - ruminationBias.edgeThresholdReduction)
      : this.config.edgeMinWeight;
    const maxHops = ruminationBias?.graphDiffusionExtraHop
      ? this.config.maxHops + ruminationBias.graphDiffusionExtraHop
      : this.config.maxHops;

    const allActivations = this.spreadActivation(
      seeds, this.edges, maxHops, this.config.decayPerHop,
      edgeThreshold, this.config.activationMin,
    );

    // ── Layer 3: Ranking ──
    const seedIds = new Set(seeds.map(s => s.nodeId));
    const ranked = this.rankMemories(
      allActivations, allMemories, currentPAD,
      ruminationBias, emotionVolatility, seedIds,
    );

    // Budget truncation → Tier B block
    const injected = this.truncateToBudget(ranked, this.config.tierBCharBudget);

    // Trace
    const seedCounts = {
      semantic: seeds.filter(s => s.source === "semantic").length,
      emotional: seeds.filter(s => s.source === "emotional").length,
      temporal: seeds.filter(s => s.source === "temporal").length,
    };

    return {
      tierBBlock: this.assembleTierB(injected),
      trace: {
        totalSeeds: seeds.length,
        totalSpreads: allActivations.size - seeds.length,
        totalHits: allActivations.size,
        dedupedCount: ranked.length,
        injectedCount: injected.length,
        semanticHits: seedCounts.semantic,
        emotionalHits: seedCounts.emotional,
        temporalHits: seedCounts.temporal,
        diffusionHits: injected.filter(m => m.fromDiffusion).length,
        dominantPath: seedCounts.semantic > seedCounts.emotional ? "semantic" : "emotional",
        usedCharBudget: injected.reduce((s, m) => s + m.record.content.length, 0),
        totalCharBudget: this.config.tierBCharBudget,
      },
    };
  }

  // ── Layer 1 Implementation ──

  private async activateSeeds(
    queryEmb: Float32Array,
    pad: { pleasure: number; arousal: number; dominance: number },
    context: { season?: string; timeOfDay?: string; specialDates?: string[] },
    memories: MemoryRecord[],
    emotionVolatility: number,
  ): Promise<SeedActivation[]> {
    const seeds: SeedActivation[] = [];
    const alphaS = emotionVolatility > 0.4 ? 0.35 : 0.55;
    const alphaE = emotionVolatility > 0.4 ? 0.45 : 0.25;
    const alphaT = 0.20;

    for (const mem of memories) {
      // ① Semantic activation
      let semActivation = 0;
      try {
        const memEmb = mem.metadata?.embedding as Float32Array | undefined;
        if (memEmb) {
          const sim = cosineSimilarity(queryEmb, memEmb);
          if (sim >= this.config.seedThreshold) {
            semActivation = sim * alphaS;
          }
        }
      } catch { /* embedding not available */ }

      // ② Emotional activation
      let emoActivation = 0;
      if (emotionVolatility > 0.2) {
        const memEmo = mem.emotionalSignature;
        if (memEmo && typeof memEmo.valence === "number") {
          // Match current PAD valence direction
          const valenceMatch = (pad.pleasure > 0) === (memEmo.valence > 0);
          const intensityMatch = Math.abs(memEmo.valence);
          if (valenceMatch) {
            emoActivation = intensityMatch * alphaE;
          }
        }
      }

      // ③ Temporal activation
      let tempActivation = 0;
      const metaTemporal = mem.metadata?.temporal as any;
      if (metaTemporal && context) {
        if (context.season && metaTemporal.season === context.season) {
          tempActivation += 0.1 * alphaT;
        }
        if (context.timeOfDay && metaTemporal.timeOfDay === context.timeOfDay) {
          tempActivation += 0.08 * alphaT;
        }
        if (context.specialDates?.length && metaTemporal.specialDates?.length) {
          const overlap = context.specialDates.filter((d: string) =>
            metaTemporal.specialDates.includes(d)
          ).length;
          if (overlap > 0) tempActivation += overlap * 0.15 * alphaT;
        }
      }

      const totalActivation = semActivation + emoActivation + tempActivation;
      if (totalActivation > this.config.activationMin) {
        seeds.push({
          nodeId: mem.recordId,
          activation: Math.min(1, totalActivation),
          source: semActivation > emoActivation ? "semantic"
                : emoActivation > tempActivation ? "emotional"
                : "temporal",
        });
      }
    }

    return seeds;
  }

  // ── Layer 2 Implementation ──

  private spreadActivation(
    seeds: SeedActivation[],
    edges: MemoryEdge[],
    maxHops: number,
    decayPerHop: number,
    edgeMinWeight: number,
    activationMin: number,
  ): Map<string, number> {
    const activations = new Map<string, number>();
    let frontier = [...seeds];

    for (const seed of seeds) {
      activations.set(seed.nodeId, seed.activation);
    }

    for (let hop = 1; hop <= maxHops; hop++) {
      const nextFrontier: SeedActivation[] = [];

      for (const source of frontier) {
        const outgoing = edges.filter(
          e => e.from === source.nodeId && e.weight >= edgeMinWeight
        );

        for (const edge of outgoing) {
          const existing = activations.get(edge.to) ?? 0;

          const propagated = source.activation
            * edge.weight
            * Math.exp(-hop * decayPerHop);

          if (propagated < activationMin) continue;

          const bonus = existing > 0 ? Math.min(existing, propagated) * 0.15 : 0;
          const newActivation = Math.max(existing, propagated) + bonus;

          activations.set(edge.to, newActivation);

          if (newActivation > activationMin * 2) {
            nextFrontier.push({
              nodeId: edge.to,
              activation: newActivation,
              source: source.source,
            });
          }
        }
      }

      frontier = nextFrontier;
    }

    return activations;
  }

  // ── Layer 3 Implementation ──

  private rankMemories(
    activations: Map<string, number>,
    memories: MemoryRecord[],
    pad: { pleasure: number; arousal: number; dominance: number },
    ruminationBias: {
      emotionBoostMultiplier: number;
      negativityBias: number;
    } | undefined,
    emotionVolatility: number,
    seedIds: Set<string>,
  ): RankedMemory[] {
    const now = Date.now() / 1000;
    const ranked: RankedMemory[] = [];
    // Build lookup map for O(1) access
    const memoryMap = new Map(memories.map(m => [m.recordId, m]));

    for (const [nodeId, activation] of activations) {
      const mem = memoryMap.get(nodeId);
      if (!mem) continue;

      const daysSince = (now - mem.timestamp) / 86400;
      const decayLambda = (mem.metadata?.decayLambda as number) ?? 0.005;
      const timeDecay = Math.exp(-decayLambda * daysSince);

      // Recency boost
      const hoursSince = (now - mem.timestamp) / 3600;
      const recency = hoursSince < 4 ? 1.5
                     : hoursSince < 24 ? 1.2
                     : hoursSince < 72 ? 1.05
                     : 1.0;

      // Emotion congruence boost
      let emotionBoost = 1.0;
      if (emotionVolatility > 0.4) {
        const memValence = mem.emotionalSignature?.valence ?? 0;
        const currentPleasure = pad.pleasure;
        const valenceMatch = (memValence > 0) === (currentPleasure > 0);
        if (valenceMatch) {
          emotionBoost = 1 + Math.abs(currentPleasure) * 0.5;
          if (ruminationBias) {
            emotionBoost *= ruminationBias.emotionBoostMultiplier;
          }
        }
      }

      // Negativity bias (from rumination)
      const negativity = ruminationBias?.negativityBias ?? 1.0;
      const memValence = mem.emotionalSignature?.valence ?? 0;
      const negativityFactor = memValence < 0 ? negativity : 1 / negativity;

      const finalScore = activation
        * mem.significance
        * timeDecay
        * recency
        * emotionBoost
        * negativityFactor;

      ranked.push({
        record: mem,
        finalScore,
        activation,
        source: "",
        fromDiffusion: !seedIds.has(nodeId),
      });
    }

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    return ranked;
  }

  // ── Budget Truncation ──

  private truncateToBudget(
    ranked: RankedMemory[],
    budget: number,
  ): RankedMemory[] {
    const selected: RankedMemory[] = [];
    let used = 0;

    for (const r of ranked) {
      const chars = r.record.content.length + 30; // +30 for source marker
      if (used + chars > budget) break;
      selected.push(r);
      used += chars;
    }

    return selected;
  }

  private assembleTierB(injected: RankedMemory[]): string {
    if (injected.length === 0) return "";

    const lines = injected.map(m => {
      const suffix = m.fromDiffusion ? "  ↳ 关联" : "";
      return `- ${m.record.content}${suffix}`;
    });

    return lines.join("\n");
  }
}
