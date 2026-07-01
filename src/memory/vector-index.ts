/**
 * Vector Index — abstraction over nearest-neighbor search.
 *
 * BruteForceIndex for small datasets (< 1000 vectors).
 * Interface designed to be swapped for ANN when node count grows
 * (HNSW, FAISS WASM, custom PQ).
 */

import { cosineSimilarity } from "../utils";

export interface VectorIndexEntry {
  id: string;
  similarity: number;
}

export interface VectorIndex {
  add(id: string, vector: Float32Array): Promise<void>;
  addBatch(entries: Array<{ id: string; vector: Float32Array }>): Promise<void>;
  remove(id: string): Promise<void>;
  search(query: Float32Array, k: number): Promise<VectorIndexEntry[]>;
  searchRange(
    query: Float32Array,
    threshold: number,
    maxResults?: number,
  ): Promise<VectorIndexEntry[]>;
  readonly size: number;
  rebuild?(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// BruteForce — no dependencies, O(n) per query
// ═══════════════════════════════════════════════════════════════

export class BruteForceIndex implements VectorIndex {
  private vectors = new Map<string, Float32Array>();

  get size(): number {
    return this.vectors.size;
  }

  async add(id: string, vector: Float32Array): Promise<void> {
    this.vectors.set(id, vector);
  }

  async addBatch(
    entries: Array<{ id: string; vector: Float32Array }>,
  ): Promise<void> {
    for (const e of entries) {
      this.vectors.set(e.id, e.vector);
    }
  }

  async remove(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async search(
    query: Float32Array,
    k: number,
  ): Promise<VectorIndexEntry[]> {
    const results: VectorIndexEntry[] = [];
    for (const [id, vec] of this.vectors) {
      results.push({ id, similarity: cosineSimilarity(query, vec) });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, k);
  }

  async searchRange(
    query: Float32Array,
    threshold: number,
    maxResults = 100,
  ): Promise<VectorIndexEntry[]> {
    const results: VectorIndexEntry[] = [];
    for (const [id, vec] of this.vectors) {
      const sim = cosineSimilarity(query, vec);
      if (sim >= threshold) {
        results.push({ id, similarity: sim });
      }
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, maxResults);
  }
}

// Helpers: cosineSimilarity and averageEmbedding imported from ../utils
