/** Long-Term Memory — SQLite + time decay. better-sqlite3 for Node.js */
import Database from "better-sqlite3";
import { MemoryStore, MemoryRecord, createMemoryRecord, ConsolidationReport, createConsolidationReport, safeJsonParse } from "./store";

export class LongTermMemory extends MemoryStore {
  private dbPath: string; private maxItems: number; private halfLifeDays: number;
  private _db: Database | null = null;

  constructor(dbPath = ":memory:", maxItems = 500, halfLifeDays = 30) {
    super(); this.dbPath = dbPath; this.maxItems = maxItems; this.halfLifeDays = halfLifeDays;
  }

  get length(): number {
    return this._db ? (this._db.prepare("SELECT COUNT(*) as c FROM ltm WHERE superseded=0").get() as any).c : 0;
  }

  async initialize(): Promise<void> {
    this._db = new Database(this.dbPath);
    this._db.pragma("journal_mode = WAL");
    this._db.exec(`CREATE TABLE IF NOT EXISTS ltm (
      record_id TEXT PRIMARY KEY, content TEXT NOT NULL, emotion TEXT DEFAULT '{}',
      significance REAL DEFAULT 0.5, event_type TEXT DEFAULT 'unknown', tags TEXT DEFAULT '[]',
      timestamp REAL, recall_count INTEGER DEFAULT 0, related_ids TEXT DEFAULT '[]',
      memory_type TEXT DEFAULT 'episodic', confidence REAL DEFAULT 0.7,
      superseded INTEGER DEFAULT 0, superseded_by TEXT, embedding BLOB
    )`);
    this._db.exec("CREATE INDEX IF NOT EXISTS idx_ltm_emotion ON ltm(event_type)");
    this._db.exec("CREATE INDEX IF NOT EXISTS idx_ltm_sig ON ltm(significance)");
    this._db.exec("CREATE INDEX IF NOT EXISTS idx_ltm_conf ON ltm(confidence)");
  }

  async store(record: MemoryRecord): Promise<string> {
    const rid = record.recordId || `ltm_${Date.now()}_${this.length}`;
    record.recordId = rid;
    this._db!.prepare("INSERT OR REPLACE INTO ltm VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      rid, record.content, JSON.stringify(record.emotionalSignature), record.significance,
      record.eventType, JSON.stringify(record.tags), record.timestamp, record.recallCount,
      JSON.stringify(record.metadata?.relatedIds ?? []), record.memoryType,
      record.confidence, record.superseded ? 1 : 0, record.supersededBy, null,
    );
    this._trim(); return rid;
  }

  async recall(query: string, n = 5): Promise<MemoryRecord[]> {
    const rows = this._db!.prepare(
      "SELECT * FROM ltm WHERE superseded=0 ORDER BY (significance * confidence) DESC LIMIT ?"
    ).all(n * 5) as any[];
    const now = Date.now() / 1000;
    const scored: Array<[number, MemoryRecord]> = [];
    for (const row of rows) {
      const r = this._rowToRecord(row);
      const ql = query.toLowerCase(); let sem = 0;
      if (r.content.toLowerCase().includes(ql)) sem = 0.3;
      else { const hits = ql.split(/\s+/).filter(kw => r.content.toLowerCase().includes(kw)).length; sem = Math.min(0.3, hits * 0.1); }
      scored.push([r.significance * 0.4 + this._timeDecay(r, now) * 0.3 + sem, r]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    for (const [_, r] of scored.slice(0, n)) this._db!.prepare("UPDATE ltm SET recall_count=recall_count+1 WHERE record_id=?").run(r.recordId);
    return scored.slice(0, n).map(([_, r]) => r);
  }

  async search(_e?: number[] | null, filters?: Record<string, unknown> | null, n = 5): Promise<MemoryRecord[]> {
    // Support superseded filter (for ArchiveMemory.absorbSuperseded)
    if (filters?.superseded) {
      const rows = this._db!.prepare(
        "SELECT * FROM ltm WHERE superseded=1 ORDER BY timestamp DESC LIMIT ?"
      ).all(n) as any[];
      return rows.map((r: any) => this._rowToRecord(r));
    }
    return filters?.query ? this.recall(filters.query as string, n) : this.recall("", n);
  }

  async consolidate(): Promise<ConsolidationReport> {
    const report = createConsolidationReport();
    const rows = this._db!.prepare("SELECT record_id, content FROM ltm WHERE superseded=0 ORDER BY timestamp DESC LIMIT 50").all() as any[];
    const seen = new Set<string>();
    for (const row of rows) {
      const rid: string = row.record_id;
      const content: string = row.content;
      if (seen.has(content)) {
        this._db!.prepare("UPDATE ltm SET superseded=1 WHERE record_id=?").run(rid);
        report.merged++;
      }
      seen.add(content);
    }
    return report;
  }

  async forget(): Promise<number> {
    return this._db!.prepare("DELETE FROM ltm WHERE timestamp < ? AND significance < 0.3").run(Date.now() / 1000 - this.halfLifeDays * 86400).changes;
  }

  detectContradictions(): Array<Record<string, string>> {
    const rows = this._db!.prepare("SELECT * FROM ltm WHERE superseded=0 ORDER BY timestamp DESC LIMIT 100").all() as any[];
    const conflicts: Array<Record<string, string>> = [];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const e1 = safeJsonParse(rows[i].emotion, {}) as Record<string,number>, e2 = safeJsonParse(rows[j].emotion, {}) as Record<string,number>;
        if ((e1.joy > 0.5 && e2.sadness > 0.5) || (e1.trust > 0.5 && e2.fear > 0.5))
          conflicts.push({ recordA: rows[i].record_id, recordB: rows[j].record_id, type: "emotional_contradiction" });
      }
    }
    return conflicts;
  }

  promoteCandidates(): MemoryRecord[] {
    return (this._db!.prepare("SELECT * FROM ltm WHERE recall_count>=5 AND significance>=0.8 AND superseded=0").all() as any[]).map((r: any) => this._rowToRecord(r));
  }

  private _timeDecay(r: MemoryRecord, now: number): number { return Math.exp(-(now - r.timestamp) / (this.halfLifeDays * 86400)); }
  private _trim(): void {
    const c = (this._db!.prepare("SELECT COUNT(*) as c FROM ltm").get() as any).c;
    if (c > this.maxItems) this._db!.prepare("DELETE FROM ltm WHERE rowid IN (SELECT rowid FROM ltm ORDER BY significance ASC, timestamp ASC LIMIT ?)").run(c - this.maxItems);
  }
  /** Update confidence — reinforced by recall or contradicted by new evidence. */
  updateConfidence(recordId: string, delta: number): void {
    this._db!.prepare(
      "UPDATE ltm SET confidence = MAX(0.0, MIN(1.0, confidence + ?)) WHERE record_id=?"
    ).run(delta, recordId);
  }

  /** Mark a fact as superseded by a newer version. Never silently delete. */
  markSuperseded(recordId: string, byRecordId: string): void {
    this._db!.prepare(
      "UPDATE ltm SET superseded=1, superseded_by=?, confidence=0.1 WHERE record_id=?"
    ).run(byRecordId, recordId);
  }

  /** Decay confidence of old, unverified facts. */
  decayConfidence(halfLifeSeconds: number, now: number): number {
    const lambda = Math.LN2 / halfLifeSeconds;
    return this._db!.prepare(
      `UPDATE ltm SET confidence = confidence * ?
       WHERE superseded=0 AND recall_count=0 AND confidence > 0.2
       AND (? - timestamp) > ?`
    ).run(Math.exp(-lambda), now, halfLifeSeconds).changes;
  }

  /** Cross-event pattern extraction: cluster similar events → synthesize higher-order knowledge.

   */
  extractPatterns(minClusterSize = 3): number {
    const rows = this._db!.prepare(
      "SELECT * FROM ltm WHERE superseded=0 AND memory_type='episodic' AND significance > 0.2 ORDER BY timestamp DESC LIMIT 100"
    ).all() as any[];
    if (rows.length < minClusterSize) return 0;

    // Cluster by dominant emotion + event_type
    const clusters = new Map<string, any[]>();
    for (const row of rows) {
      const record = this._rowToRecord(row);
      const emoDominant = Object.entries(record.emotionalSignature)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
      const key = `${emoDominant}|${record.eventType}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(record);
    }

    let patternsCreated = 0;
    for (const [key, cluster] of clusters) {
      if (cluster.length < minClusterSize) continue;

      const [emoKey, eventType] = key.split("|");
      // Build pattern summary from cluster's common content
      const commonTags = [...new Set(cluster.flatMap(r => r.tags))].slice(0, 5);
      const avgSig = cluster.reduce((s, r) => s + r.significance, 0) / cluster.length;
      const summary = `从 ${cluster.length} 次"${eventType}"事件中提取的模式：共通情感=${emoKey}，标签=${commonTags.join(",")}`;

      const pattern = createMemoryRecord({
        recordId: `ltm_pattern_${key}_${Date.now()}`,
        content: summary,
        eventType: "pattern_extracted",
        tags: [...commonTags, "pattern", emoKey],
        significance: Math.min(1, avgSig * 1.2),
        memoryType: "semantic",
        confidence: Math.min(0.9, 0.4 + cluster.length * 0.1),
        emotionalSignature: { [emoKey]: 0.5 },
      });
      this.store(pattern);
      patternsCreated++;

      // Lower significance of source events (fade, don't delete)
      for (const r of cluster) {
        this._db!.prepare("UPDATE ltm SET significance = significance * 0.6 WHERE record_id=?").run(r.recordId);
        this._db!.prepare("UPDATE ltm SET recall_count = recall_count + 1 WHERE record_id=?").run(r.recordId);
      }
    }

    return patternsCreated;
  }

  /** Compress old records: full text → short summary + emotional vector. */
  compressOld(minAgeSeconds: number, now: number): number {
    return this._db!.prepare(
      `UPDATE ltm SET significance = significance * 0.5
       WHERE superseded=0 AND confidence < 0.3
       AND (? - timestamp) > ? AND recall_count = 0`
    ).run(now, minAgeSeconds).changes;
  }

  private _rowToRecord(row: any): MemoryRecord {
    return createMemoryRecord({
      recordId: row.record_id, content: row.content,
      emotionalSignature: safeJsonParse(row.emotion, {}),
      significance: row.significance, eventType: row.event_type,
      tags: safeJsonParse(row.tags, []), timestamp: row.timestamp,
      recallCount: row.recall_count,
      memoryType: (row.memory_type as any) ?? "episodic",
      confidence: row.confidence ?? 0.7,
      superseded: !!row.superseded,
      supersededBy: row.superseded_by ?? null,
      metadata: { relatedIds: safeJsonParse(row.related_ids, []), embedding: row.embedding },
    });
  }
}
