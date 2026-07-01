/** Core Graph Memory — Entity-relation network + BFS. sql.js adapter. */
import { SqliteAdapter } from "./sqlite-adapter";
import { MemoryStore, MemoryRecord, createMemoryRecord, ConsolidationReport, createConsolidationReport } from "./store";

export class CoreGraphMemory extends MemoryStore {
  private dbPath: string; private maxNodes: number; private maxEdges: number;
  private halfLifeDays: number; private _db: SqliteAdapter | null = null;
  private _indexCache: Map<string, any> = new Map();

  constructor(dbPath = ":memory:", maxNodes = 500, maxEdges = 2000, halfLifeDays = 30) {
    super();
    this.dbPath = dbPath; this.maxNodes = maxNodes; this.maxEdges = maxEdges; this.halfLifeDays = halfLifeDays;
  }

  get length(): number {
    return this._db ? (this._db.get("SELECT COUNT(*) as c FROM nodes WHERE superseded=0") as any).c : 0;
  }

  async initialize(): Promise<void> {
    this._db = await SqliteAdapter.open(this.dbPath);
    this._db.exec(`CREATE TABLE IF NOT EXISTS nodes (
      node_id TEXT PRIMARY KEY, node_type TEXT DEFAULT 'concept', label TEXT NOT NULL,
      properties TEXT DEFAULT '{}', created_at REAL, updated_at REAL, superseded INTEGER DEFAULT 0
    )`);
    this._db.exec(`CREATE TABLE IF NOT EXISTS edges (
      edge_id INTEGER PRIMARY KEY AUTOINCREMENT, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
      relation TEXT NOT NULL, weight REAL DEFAULT 1.0, timestamp REAL,
      source_event TEXT DEFAULT '', superseded INTEGER DEFAULT 0
    )`);
    this._db.exec("CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id)");
    this._db.exec("CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id)");
    this._db.exec("CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label)");
  }

  async store(record: MemoryRecord): Promise<string> {
    const rid = record.recordId || `core_${Date.now()}`;
    const triples = this._extractTriples(record.content);
    const now = Date.now() / 1000;
    for (const [subj, rel, obj] of triples) {
      const sid = this._upsertNode(subj, this._inferType(subj), now);
      const oid = this._upsertNode(obj, this._inferType(obj), now);
      this._addEdge(sid, oid, rel, now, record.content.slice(0, 100));
    }
    this._trim();
    this._db!.save();
    return rid;
  }

  querySubgraph(entity: string, depth = 2): any {
    const ck = `${entity}_d${depth}`; if (this._indexCache.has(ck)) return this._indexCache.get(ck)!;
    const nodeRows = this._db!.all(
      "SELECT node_id, label, node_type FROM nodes WHERE label LIKE ? AND superseded=0",
      `%${entity}%`,
    ) as any[];
    if (!nodeRows.length) return { nodes: [], edges: [], summary: `未找到'${entity}'的相关信息` };
    const nodeIds = nodeRows.map((r: any) => r.node_id); const visited = new Set(nodeIds); const relevantEdges: any[] = [];
    let frontier = [...nodeIds];
    for (let d = 0; d < depth && frontier.length; d++) {
      const ph = frontier.map(() => "?").join(",");
      const edgeRows = this._db!.all(
        `SELECT * FROM edges WHERE (from_id IN (${ph}) OR to_id IN (${ph})) AND superseded=0`,
        ...frontier, ...frontier,
      ) as any[];
      const nf: string[] = [];
      for (const er of edgeRows) { relevantEdges.push(er); if (!visited.has(er.from_id)) { visited.add(er.from_id); nf.push(er.from_id); } if (!visited.has(er.to_id)) { visited.add(er.to_id); nf.push(er.to_id); } }
      frontier = nf;
    }
    const now = Date.now() / 1000;
    const decayedEdges = relevantEdges.map(er => ({ from: er.from_id, to: er.to_id, relation: er.relation, weight: Math.max(0.1, er.weight * Math.exp(-(now - er.timestamp) / (this.halfLifeDays * 86400))), source: er.source_event }));
    const nodeData = [...visited].map(nid => { const nr = this._db!.get("SELECT node_id, label, node_type FROM nodes WHERE node_id=?", nid) as any; return nr ? { id: nr.node_id, label: nr.label, type: nr.node_type } : null; }).filter(Boolean) as any[];
    const summary = decayedEdges.slice(0, 10).map(e => `${nodeData.find(n => n.id === e.from)?.label ?? e.from}与${nodeData.find(n => n.id === e.to)?.label ?? e.to}: ${e.relation}`).join("; ") || "无显著关系";
    const result = { nodes: nodeData, edges: decayedEdges, summary };
    this._indexCache.set(ck, result);
    if (this._indexCache.size > 100) { for (const k of [...this._indexCache.keys()].slice(0, 20)) this._indexCache.delete(k); }
    return result;
  }

  private _extractTriples(text: string): Array<[string, string, string]> {
    const triples: Array<[string, string, string]> = [];
    for (const m of text.matchAll(/([一-鿿]{1,4})(?:对|向|给|和|跟)([一-鿿]{1,4})/g)) triples.push([m[1], /没|不|拒绝/.test(text) ? "negative_interaction" : "interaction", m[2]]);
    for (const m of text.matchAll(/(?:感到|觉得|很|非常|有点)(开心|难过|悲伤|愤怒|恐惧|焦虑|幸福|失落)/g)) triples.push(["角色", "feels", m[1]]);
    return triples;
  }

  private _upsertNode(label: string, nt: string, now: number): string {
    const nid = `${nt}_${label}`;
    if (this._db!.get("SELECT node_id FROM nodes WHERE node_id=?", nid))
      this._db!.run("UPDATE nodes SET updated_at=? WHERE node_id=?", now, nid);
    else
      this._db!.run("INSERT INTO nodes VALUES (?,?,?,?,?,?,?)", nid, nt, label, "{}", now, now, 0);
    return nid;
  }

  private _addEdge(fid: string, tid: string, rel: string, now: number, src: string): void {
    const ex = this._db!.get("SELECT edge_id, weight FROM edges WHERE from_id=? AND to_id=? AND relation=? AND superseded=0", fid, tid, rel) as any;
    if (ex) this._db!.run("UPDATE edges SET weight=MIN(1.0,?), timestamp=? WHERE edge_id=?", ex.weight + 0.2, now, ex.edge_id);
    else this._db!.run("INSERT INTO edges (from_id,to_id,relation,weight,timestamp,source_event) VALUES (?,?,?,?,?,?)", fid, tid, rel, 0.5, now, src);
  }

  private _inferType(label: string): string {
    if (["开心","难过","悲伤","愤怒","恐惧","焦虑","幸福","失落","孤独","紧张","失望"].includes(label)) return "emotion";
    return label.length <= 4 && /^[一-鿿]+$/.test(label) ? "person" : "concept";
  }

  private _trim(): void {
    let nc = (this._db!.get("SELECT COUNT(*) as c FROM nodes WHERE superseded=0") as any).c;
    if (nc > this.maxNodes) this._db!.run(
      "UPDATE nodes SET superseded=1 WHERE node_id IN (SELECT node_id FROM nodes WHERE superseded=0 ORDER BY updated_at ASC LIMIT ?)",
      nc - this.maxNodes,
    );
    let ec = (this._db!.get("SELECT COUNT(*) as c FROM edges WHERE superseded=0") as any).c;
    if (ec > this.maxEdges) this._db!.run(
      "UPDATE edges SET superseded=1 WHERE edge_id IN (SELECT edge_id FROM edges WHERE superseded=0 ORDER BY weight ASC LIMIT ?)",
      ec - this.maxEdges,
    );
  }

  async recall(query: string, _n = 5): Promise<MemoryRecord[]> {
    const sg = this.querySubgraph(query, 1);
    return sg.summary ? [createMemoryRecord({ recordId: `core_${Date.now()}`, content: sg.summary, eventType: "graph_query", significance: 0.5 })] : [];
  }

  async search(_e?: number[] | null, filters?: Record<string, unknown> | null, n = 5): Promise<MemoryRecord[]> {
    return this.recall((filters?.query as string) ?? "", n);
  }

  /** Return all active node labels for remote-link / insight computation. */
  listAllNodeLabels(): string[] {
    if (!this._db) return [];
    const rows = this._db.all(
      "SELECT label FROM nodes WHERE superseded=0 ORDER BY updated_at DESC",
    ) as Array<{ label: string }>;
    return rows.map(r => r.label);
  }

  /** Decay all active edge weights by a multiplicative factor (0 < factor <= 1). */
  decayEdgeWeights(factor: number): number {
    if (!this._db) return 0;
    return this._db.run(
      "UPDATE edges SET weight = MAX(0.01, weight * ?) WHERE superseded=0",
      factor,
    ).changes;
  }

  async consolidate(): Promise<ConsolidationReport> { return createConsolidationReport(); }

  async forget(): Promise<number> {
    const result = this._db!.run(
      "UPDATE edges SET superseded=1 WHERE timestamp < ? AND weight < 0.2",
      Date.now() / 1000 - this.halfLifeDays * 86400,
    );
    this._db!.save();
    return result.changes;
  }
}
