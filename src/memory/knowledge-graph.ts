import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export type NodeKind = 'entity' | 'relation' | 'event' | 'appraisal' | 'state' | 'phenomenon' | 'emotion' | 'decision' | 'summary' | 'learning' | 'control';
export interface GraphNode {
  id: string;
  kind: NodeKind;
  at: number;
  text: string;
  data: Record<string, unknown>;
}
export interface GraphEdge { from: string; to: string; relation: 'interprets' | 'updates' | 'manifests' | 'grounded_in' | 'evokes' | 'reactivates' | 'motivates' | 'responds_to' | 'summarizes' | 'subject' | 'object' | 'asserts' | 'authored_by' | 'continues' | 'implements' | 'produces'; }
interface GraphData { version: 1; nodes: GraphNode[]; edges: GraphEdge[]; }

/** One evidence graph. Compression changes a view, never the source events. */
export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private edgeKeys = new Set<string>();
  private outgoing = new Map<string, GraphEdge[]>();
  private counts = new Map<NodeKind, number>();
  private latest = new Map<NodeKind, string>();
  constructor(private readonly file?: string) {
    if (file && existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf8')) as GraphData;
      if (data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('Unsupported memory graph');
      for (const node of data.nodes) {
        if (!node.id || this.nodes.has(node.id)) throw new Error('Invalid graph node');
        this.nodes.set(node.id, node);
        this.counts.set(node.kind, (this.counts.get(node.kind) ?? 0) + 1); this.latest.set(node.kind, node.id);
      }
      for (const edge of data.edges) this.link(edge.from, edge.to, edge.relation);
    }
  }
  add(kind: NodeKind, text: string, data: Record<string, unknown> = {}, at = Date.now()): GraphNode {
    const node = { id: randomUUID(), kind, text, data: structuredClone(data), at };
    this.nodes.set(node.id, node);
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1); this.latest.set(kind, node.id);
    return structuredClone(node);
  }
  get(id: string): GraphNode | undefined { const n = this.nodes.get(id); return n && structuredClone(n); }
  count(kind?: NodeKind): number { return kind ? this.counts.get(kind) ?? 0 : this.nodes.size; }
  last(kind: NodeKind): GraphNode | undefined { const id = this.latest.get(kind); return id ? this.get(id) : undefined; }
  entity(name: string): GraphNode {
    const existing = [...this.nodes.values()].find(n => n.kind === 'entity' && n.text === name);
    return existing ? structuredClone(existing) : this.add('entity', name, { resolution: 'exact_label_only' });
  }
  all(kind?: NodeKind): GraphNode[] { return [...this.nodes.values()].filter(n => !kind || n.kind === kind).map(n => structuredClone(n)); }
  link(from: string, to: string, relation: GraphEdge['relation']): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) throw new Error('Missing graph endpoint');
    const key = JSON.stringify([from, to, relation]);
    if (this.edgeKeys.has(key)) return;
    const edge = { from, to, relation };
    this.edgeKeys.add(key); this.edges.push(edge);
    const outgoing = this.outgoing.get(from) ?? [];
    outgoing.push(edge); this.outgoing.set(from, outgoing);
  }
  related(id: string, relation?: GraphEdge['relation']): GraphNode[] {
    return (this.outgoing.get(id) ?? []).filter(e => !relation || e.relation === relation).map(e => this.get(e.to)!);
  }
  /** Keep interpretation, relationships, process and manifestations together in graph views. */
  interpretationContext(id: string): GraphNode[] {
    const states = this.related(id, 'updates');
    const eventId = this.get(id)?.data.eventId;
    const decisions = this.all('decision').filter(n => n.data.eventId === eventId);
    const learning = this.all('learning').filter(n => n.data.sourceEventId === eventId);
    return [...this.related(id, 'asserts'), ...this.related(id, 'evokes'), ...states, ...states.flatMap(n => this.related(n.id, 'manifests')), ...decisions, ...learning];
  }
  /** Source IDs remain available, including nested summary lineage. */
  expand(id: string): GraphNode[] {
    const seen = new Set<string>();
    const visit = (key: string): GraphNode[] => {
      if (seen.has(key)) return [];
      seen.add(key);
      const node = this.get(key);
      if (!node) throw new Error('Unknown memory reference');
      return node.kind === 'summary' ? this.related(key, 'summarizes').flatMap(n => visit(n.id)) : [node];
    };
    return visit(id);
  }
  compress(ids: string[], summary: string, protectedIds: string[] = []): GraphNode {
    if (!summary.trim() || ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('Compression requires unique sources and nonempty summary');
    const sources = ids.flatMap(id => this.expand(id));
    if (sources.some(n => protectedIds.includes(n.id))) throw new Error('Cannot compress protected context');
    if (sources.some(n => n.kind !== 'event')) throw new Error('Compress event views, not psychological evidence');
    const node = this.add('summary', summary, { lossy: true, sourceIds: sources.map(n => n.id) });
    for (const id of ids) this.link(node.id, id, 'summarizes');
    this.save();
    return node;
  }
  /** A character budget, explicitly not a token estimate. Oversize current input is handled by the caller. */
  context(query: string, budget = 12000): string {
    if (!Number.isInteger(budget) || budget < 2) throw new Error('Context budget must be at least two characters');
    const events = this.all('event');
    const recent = events.filter(n => n.data.role !== 'legacy').slice(-8);
    const recentIds = new Set(recent.map(n => n.id));
    const words = query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
    const cjk = [...query.matchAll(/[\p{Script=Han}]+/gu)].flatMap(([word]) => Array.from({ length: Math.max(0, word.length-1) }, (_,i) => word.slice(i,i+2)));
    const terms = [...new Set([...words, ...cjk])];
    const older = events.filter(n => !recentIds.has(n.id)).map(n => ({ n, score: terms.reduce((s, t) => s + Number(n.text.toLowerCase().includes(t)), 0) })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).map(x => x.n);
    const nested = new Set(this.edges.filter(e => e.relation === 'summarizes').map(e => e.to));
    const summaries = this.all('summary').filter(n => !nested.has(n.id));
    const summarized = new Set(summaries.flatMap(n => this.expand(n.id).map(x => x.id)));
    // Query hits explicitly expand relevant sources; the default view uses summaries.
    const candidates = [...recent.reverse(), ...older, ...summaries.reverse(), ...events.filter(n => !recentIds.has(n.id) && !summarized.has(n.id)).reverse()];
    const selected: GraphNode[] = [];
    const selectedIds = new Set<string>();
    let size = 2;
    for (const n of candidates) {
      if (selectedIds.has(n.id)) continue;
      const length = JSON.stringify(n).length + 1;
      if (size + length > budget) continue;
      size += length; selected.push(n); selectedIds.add(n.id);
    }
    const associations = this.all('appraisal').filter(n => selectedIds.has(String(n.data.eventId)));
    for (const appraisal of associations) {
      const context = [appraisal, ...this.interpretationContext(appraisal.id)];
      for (const node of context) {
        const length = JSON.stringify(node).length + 1;
        if (!selectedIds.has(node.id) && size + length <= budget) {
          selected.push(node); selectedIds.add(node.id); size += length;
        }
      }
    }
    return JSON.stringify(selected.sort((a,b) => a.at - b.at));
  }
  save(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify({ version: 1, nodes: [...this.nodes.values()], edges: this.edges } satisfies GraphData), 'utf8');
    renameSync(temporary, this.file);
  }
}
