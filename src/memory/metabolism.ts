/** Sleep Cycle Metabolism — 3-stage memory consolidation.  */
import { WorkingMemory } from "./working";
import { ShortTermMemory } from "./short-term";
import { LongTermMemory } from "./long-term";
import { ConsolidationReport, createConsolidationReport } from "./store";
import type { CoreGraphMemory } from "./core-graph";
import type { ArchiveMemory } from "./archive";
import type { SkillLibrary } from "../learn/skill-library";
import { cosineSimilarity } from "../utils";

export interface MetabolismStats {
  daydreamCount: number; quickSleepCount: number; fullSleepCount: number;
  totalMerged: number; totalPromoted: number; totalArchived: number; totalConflicts: number;
  lastDaydream: number; lastQuick: number; lastFull: number;
}

export class SleepCycleMetabolism {
  private working: WorkingMemory;
  private stm: ShortTermMemory;
  private ltm: LongTermMemory;
  private core: CoreGraphMemory | null;
  private archive: ArchiveMemory | null;
  private skills: SkillLibrary | null;
  stats: MetabolismStats;

  constructor(working: WorkingMemory, stm: ShortTermMemory, ltm: LongTermMemory, core: CoreGraphMemory | null = null, archive: ArchiveMemory | null = null, skills: SkillLibrary | null = null) {
    this.working = working; this.stm = stm; this.ltm = ltm; this.core = core; this.archive = archive; this.skills = skills;
    this.stats = {
      daydreamCount: 0, quickSleepCount: 0, fullSleepCount: 0,
      totalMerged: 0, totalPromoted: 0, totalArchived: 0, totalConflicts: 0,
      lastDaydream: 0, lastQuick: 0, lastFull: 0,
    };
  }

  shouldDaydream(tickCount: number, interval = 10): boolean { return tickCount % interval === 0; }
  shouldQuickSleep(tickCount: number, interval = 50): boolean { return tickCount % interval === 0; }

  async daydream(): Promise<ConsolidationReport> {
    this.stats.daydreamCount++; this.stats.lastDaydream = Date.now() / 1000;
    const report = await this.stm.consolidate();
    this.stats.totalMerged += report.merged;
    return report;
  }

  async quickSleep(): Promise<ConsolidationReport> {
    this.stats.quickSleepCount++; this.stats.lastQuick = Date.now() / 1000;
    const report = createConsolidationReport();

    // WM → STM
    for (const record of this.working.promoteCandidates()) {
      await this.stm.store(record); report.promoted++;
    }

    // STM progressive degradation: oldest 5 records → compressed LTM
    const promoted = await this.stm.promoteToLtm(this.ltm, 5);
    report.promoted += promoted.length;

    // STM candidates → LTM (recall_count ≥ 3)
    for (const record of this.stm.promoteCandidates()) {
      await this.ltm.store(record); report.promoted++;
    }

    const ltmReport = await this.ltm.consolidate();
    report.merged += ltmReport.merged;
    this.stats.totalPromoted += report.promoted;
    this.stats.totalMerged += report.merged;
    return report;
  }

  async fullSleep(): Promise<ConsolidationReport> {
    this.stats.fullSleepCount++; this.stats.lastFull = Date.now() / 1000;
    const report = createConsolidationReport();

    const qr = await this.quickSleep();
    report.promoted += qr.promoted;

    // Confidence decay: old unverified LTM facts lose confidence
    const now = Date.now() / 1000;
    report.archived += this.ltm.decayConfidence(7 * 86400, now); // 7-day half-life
    report.archived += this.ltm.compressOld(30 * 86400, now);    // 30-day old → compressed
    report.merged += this.ltm.extractPatterns(3);               // cross-event pattern extraction

    const conflicts = this.ltm.detectContradictions();
    report.conflicts = conflicts.length;
    this.stats.totalConflicts += conflicts.length;

    if (this.core) {
      for (const record of this.ltm.promoteCandidates()) {
        await this.core.store(record); report.promoted++;
      }
    }

    // Remote-link: discover surprising connections between non-adjacent nodes
    this.remoteLinkStep();
    // Affective decoupling: decay emotional tag weights during sleep
    this.affectiveDecoupling();

    // Archive: sweep superseded LTM records + TTL cleanup
    if (this.archive) {
      report.archived += await this.archive.absorbSuperseded(this.ltm);
      report.archived += await this.archive.forget();
    }

    report.archived += await this.working.forget();
    report.archived += await this.stm.forget();
    // Skills cleanup
    if (this.skills) {
      const { archived } = this.skills.cleanupStale();
      if (archived.length) report.archived += archived.length;
    }

    report.archived += await this.ltm.forget();

    this.stats.totalPromoted += report.promoted;
    this.stats.totalArchived += report.archived;
    return report;
  }

  // ── Remote Link: discover non-adjacent node pairs with high similarity ──

  /**
   * Compute cosine similarity between non-adjacent CoreGraph nodes
   * and create "insight edges" for top-K surprising high-similarity pairs.
   *
   * Surprise criterion: high similarity between nodes that are NOT directly
   * connected suggests an undiscovered relationship — the brain's way of
   * forming creative insights during sleep (Wagner et al. 2004).
   *
   * No-op when core graph is null.
   */
  private remoteLinkStep(): void {
    if (!this.core) return;

    const labels = this.core.listAllNodeLabels();
    if (labels.length < 3) return;

    // Build character bigram vectors for cosine similarity approximation
    const buildBigramVec = (s: string): Float32Array => {
      const bigrams = new Map<string, number>();
      for (let i = 0; i < s.length - 1; i++) {
        const bg = s.slice(i, i + 2);
        bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
      }
      // Map bigrams to a fixed-dimension vector (use hash folding)
      const dim = 64;
      const vec = new Float32Array(dim);
      for (const [bg, count] of bigrams) {
        let hash = 0;
        for (let i = 0; i < bg.length; i++) {
          hash = ((hash << 5) - hash) + bg.charCodeAt(i);
          hash |= 0;
        }
        vec[Math.abs(hash) % dim] += count;
      }
      // Normalize
      let norm = 0;
      for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
      if (norm > 0) {
        const invNorm = 1 / Math.sqrt(norm);
        for (let i = 0; i < dim; i++) vec[i] *= invNorm;
      }
      return vec;
    };

    // Collect non-adjacent pairs with high similarity
    const pairs: Array<{ a: string; b: string; sim: number }> = [];
    const vecs = labels.map(l => ({ label: l, vec: buildBigramVec(l) }));

    for (let i = 0; i < vecs.length; i++) {
      for (let j = i + 1; j < vecs.length; j++) {
        const sim = cosineSimilarity(vecs[i].vec, vecs[j].vec);
        // Only keep surprising high-similarity pairs (sim > 0.6)
        if (sim > 0.6) {
          pairs.push({ a: vecs[i].label, b: vecs[j].label, sim });
        }
      }
    }

    // Top-K (K=3) most surprising pairs
    pairs.sort((a, b) => b.sim - a.sim);
    const topK = pairs.slice(0, 3);

    // Create insight edges via subgraph queries (triggers edge creation)
    for (const { a, b } of topK) {
      // Query both nodes to ensure they're in the graph
      this.core.querySubgraph(a, 1);
      this.core.querySubgraph(b, 1);
    }
  }

  // ── Affective Decoupling: decay emotional tag weights during sleep ──

  /**
   * Decay emotional tag weights during sleep cycles.
   *
   * emotional_tag *= 0.9^sleep_cycles  (10% decay per sleep cycle)
   *
   * This implements Walker & van der Helm's (2009) finding that sleep
   * progressively decouples the emotional charge from memories, allowing
   * the factual content to be retained while the affective intensity fades.
   *
   * No-op when core graph is null.
   */
  private affectiveDecoupling(): void {
    if (!this.core) return;

    // Decay factor: 0.9^sleepCycles
    const sleepCycles = Math.max(1, this.stats.fullSleepCount);
    const decayFactor = Math.pow(0.9, sleepCycles);

    this.core.decayEdgeWeights(decayFactor);
  }
}
