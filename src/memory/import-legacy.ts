import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { KnowledgeGraph } from './knowledge-graph.ts';

/** Read-only import. Preserve complete legacy rows; never reinterpret them as verified facts. */
export async function importLegacyMemory(graph: KnowledgeGraph, directory: string): Promise<number> {
  const sources = [['stm.db', 'stm'], ['ltm.db', 'ltm'], ['archive.db', 'archive'], ['core.db', 'nodes'], ['core.db', 'edges']];
  const imported = new Set(graph.all('event').map(n => n.data.legacyKey).filter(Boolean));
  let count = 0;
  for (const [file, table] of sources) {
    const path = join(directory, file);
    if (!existsSync(path)) continue;
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const rows = db.prepare(`SELECT rowid AS legacy_rowid, * FROM ${table}`).all();
      for (const row of rows) {
        const legacyKey = `${file}:${table}:${row.legacy_rowid}`;
        if (imported.has(legacyKey)) continue;
        const timestamp = Number(row.timestamp);
        graph.add('event', String(row.content ?? JSON.stringify(row)), { role: 'legacy', legacyKey, legacy: row, epistemicStatus: 'historical_record_unverified' }, Number.isFinite(timestamp) && timestamp > 0 ? timestamp * 1000 : Date.now());
        imported.add(legacyKey); count++;
      }
    } finally { db.close(); }
  }
  if (count) graph.save();
  return count;
}
