/** Short-Term Memory — SQLite + FTS5. better-sqlite3 for Node.js */
import Database from "better-sqlite3";
import { MemoryStore, MemoryRecord, createMemoryRecord, ConsolidationReport, createConsolidationReport, safeJsonParse, type MemoryType } from "./store";

export class ShortTermMemory extends MemoryStore {
  private dbPath: string;
  private maxItems: number;
  private trustDecay: number;
  private _db: SqliteAdapter | null = null;
  private _embeddingFn: ((text: string) => number[]) | null = null;

  constructor(dbPath = ":memory:", maxItems = 200) {
    super();
    this.dbPath = dbPath; this.maxItems = maxItems; this.trustDecay = 0.95;
  }

  get length(): number {
    if (!this._db) return 0;
    return (this._db.get("SELECT COUNT(*) as c FROM stm") as any).c;
  }

  async initialize(): Promise<void> {
    this._db = await SqliteAdapter.open(this.dbPath);
    this._db.exec(`CREATE TABLE IF NOT EXISTS stm (
      record_id TEXT PRIMARY KEY, content TEXT NOT NULL, emotion TEXT DEFAULT '{}',
      significance REAL DEFAULT 0.5, event_type TEXT DEFAULT 'unknown', tags TEXT DEFAULT '[]',
      timestamp REAL, trust REAL DEFAULT 1.0, recall_count INTEGER DEFAULT 0,
      memory_type TEXT DEFAULT 'episodic', confidence REAL DEFAULT 0.7,
      superseded INTEGER DEFAULT 0, superseded_by TEXT, embedding BLOB
    )`);
    this._db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS stm_fts USING fts5(
      content, event_type, tags, content=stm, content_rowid=rowid,
      tokenize='trigram'  -- trigram works for CJK + Latin languages
    )`);
  }

  setEmbeddingFn(fn: (text: string) => number[]): void { this._embeddingFn = fn; }

  async store(record: MemoryRecord): Promise<string> {
    const rid = record.recordId || `stm_${Date.now()}_${this.length}`;
    record.recordId = rid;
    let embBlob: Buffer | null = null;
    if (this._embeddingFn) {
      try { const buf = new Float32Array(this._embeddingFn(record.content)); embBlob = Buffer.from(buf.buffer); } catch { /* */ }
    }
    this._db!.run("INSERT OR REPLACE INTO stm VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      rid, record.content, JSON.stringify(record.emotionalSignature), record.significance,
      record.eventType, JSON.stringify(record.tags), record.timestamp, record.trust,
      record.recallCount, record.memoryType, record.confidence, record.superseded ? 1 : 0,
      record.supersededBy, embBlob,
    );
    this._trim();
    this._db!.save();
    return rid;
  }

  async recall(query: string, n = 5): Promise<MemoryRecord[]> {
    const sanitized = query.replace(/[.:*"^]/g, " ").trim();
    const words = sanitized.split(/\s+/).filter(w => w.length > 0);
    let rows: any[];
    if (words.length > 0) {
      const likeClauses = words.map(() => "content LIKE ?").join(" AND ");
      const likeParams = words.map(w => `%${w}%`);
      rows = this._db!.all(
        `SELECT * FROM stm WHERE ${likeClauses} LIMIT ?`,
        ...likeParams, n * 3,
      );
    } else {
      rows = this._db!.all("SELECT * FROM stm ORDER BY timestamp DESC LIMIT ?", n * 3);
    }
    if (!rows.length) rows = this._db!.all("SELECT * FROM stm ORDER BY timestamp DESC LIMIT ?", n);
    const results = rows.map((r: any) => this._rowToRecord(r)).filter(Boolean);
    results.sort((a, b) => (b.trust * b.significance) - (a.trust * a.significance));
    return results.slice(0, n);
  }

  async search(_e?: number[] | null, filters?: Record<string, unknown> | null, n = 5): Promise<MemoryRecord[]> {
    return filters?.query ? this.recall(filters.query as string, n) : this.recall("", n);
  }

  async consolidate(): Promise<ConsolidationReport> {
    this._db!.run("UPDATE stm SET trust = trust * ?", this.trustDecay);
    this._db!.save();
    return createConsolidationReport();
  }

  async forget(): Promise<number> {
    const result = this._db!.run("DELETE FROM stm WHERE trust < 0.1");
    this._db!.save();
    return result.changes;
  }

  recordFeedback(recordId: string, helpful: boolean): void {
    const delta = helpful ? 0.05 : -0.10;
    this._db!.run("UPDATE stm SET trust = MAX(0.0, MIN(1.0, trust + ?)) WHERE record_id = ?", delta, recordId);
    this._db!.run("UPDATE stm SET recall_count = recall_count + 1 WHERE record_id = ?", recordId);
    this._db!.save();
  }

  /** Progressive degradation: compress N oldest records to summary, reduce significance. */
  degradeOldest(count: number, summaryPrompt?: string): MemoryRecord[] {
    const rows = this._db!.all(
      "SELECT * FROM stm WHERE superseded=0 ORDER BY timestamp ASC LIMIT ?", count,
    ) as any[];
    if (!rows.length) return [];

    const records = rows.map((r: any) => this._rowToRecord(r));
    // Reduce significance by 0.3 → fades over multiple degradation passes
    for (const r of records) {
      const newSig = Math.max(0.1, r.significance - 0.3);
      this._db!.run(
        "UPDATE stm SET significance=?, content=? WHERE record_id=?",
        newSig, r.content, r.recordId,
      );
      r.significance = newSig;
    }
    this._db!.save();
    return records;
  }

  /** Move records from STM to LTM, keeping only emotional signature + summary. */
  async promoteToLtm(ltmStore: MemoryStore, count: number): Promise<MemoryRecord[]> {
    const records = this.degradeOldest(count);
    const promoted: MemoryRecord[] = [];
    for (const r of records) {
      // Compress: keep emotional sig + first 150 chars as summary
      const summary = r.content.slice(0, 150);
      const upgraded = createMemoryRecord({
        recordId: r.recordId.replace("stm_", "ltm_"),
        content: summary,
        emotionalSignature: r.emotionalSignature,
        significance: Math.max(0.2, r.significance - 0.2),
        eventType: r.eventType,
        tags: r.tags,
        timestamp: r.timestamp,
        trust: r.trust,
        recallCount: r.recallCount,
        memoryType: "episodic",
        confidence: r.trust * r.significance,
      });
      await ltmStore.store(upgraded);
      promoted.push(upgraded);
      // Mark original as superseded to prevent double-promotion by promoteCandidates()
      this._db!.prepare("UPDATE stm SET superseded=1 WHERE record_id=?").run(r.recordId);
    }
    return promoted;
  }

  promoteCandidates(): MemoryRecord[] {
    return (this._db!.prepare("SELECT * FROM stm WHERE recall_count >= 3 AND superseded=0").all() as any[]).map((r: any) => this._rowToRecord(r));
  }

  private _trim(): void {
    const count = (this._db!.get("SELECT COUNT(*) as c FROM stm") as any).c;
    if (count > this.maxItems) {
      this._db!.run(
        "DELETE FROM stm WHERE rowid IN (SELECT rowid FROM stm ORDER BY trust ASC, timestamp ASC LIMIT ?)",
        count - this.maxItems,
      );
    }
  }

  private _rowToRecord(row: any): MemoryRecord {
    return createMemoryRecord({
      recordId: row.record_id, content: row.content,
      emotionalSignature: safeJsonParse(row.emotion, {}),
      significance: row.significance, eventType: row.event_type,
      tags: safeJsonParse(row.tags, []), timestamp: row.timestamp,
      trust: row.trust, recallCount: row.recall_count,
      memoryType: (row.memory_type as MemoryType) ?? "episodic",
      confidence: row.confidence ?? 0.7,
      superseded: !!row.superseded,
      supersededBy: row.superseded_by ?? null,
      metadata: row.embedding ? { embedding: row.embedding } : {},
    });
  }
}
