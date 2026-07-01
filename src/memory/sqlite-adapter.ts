/**
 * SQL.js adapter — better-sqlite3 compatible API over pure-WASM sql.js.
 * No native compilation needed. Works on all Node.js versions.
 */
import initSqlJs, { type Database as SqlJsDb, type Statement as SqlJsStmt, type SqlJsStatic } from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

let SQL: SqlJsStatic | null = null;

async function getSQL(): Promise<SqlJsStatic> {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

export interface RunResult { changes: number; lastInsertRowid: number | bigint; }

/** A sql.js wrapper with a better-sqlite3-like API surface. */
export class SqliteAdapter {
  private db: SqlJsDb;
  private filePath: string | null;

  private constructor(db: SqlJsDb, filePath: string | null) {
    this.db = db;
    this.filePath = filePath;
  }

  /** Create from file path. Loads existing data if file exists. */
  static async open(filePath: string): Promise<SqliteAdapter> {
    const sql = await getSQL();
    if (filePath === ":memory:") {
      return new SqliteAdapter(new sql.Database(), null);
    }
    let db: SqlJsDb;
    if (existsSync(filePath)) {
      const buffer = readFileSync(filePath);
      db = new sql.Database(buffer);
    } else {
      db = new sql.Database();
    }
    return new SqliteAdapter(db, filePath);
  }

  /** Execute raw SQL (no params). For CREATE TABLE, CREATE INDEX, etc. */
  exec(sql: string): void {
    this.db.run(sql);
  }

  /** Prepare + run with params. Returns changes count estimate. */
  run(sql: string, ...params: any[]): RunResult {
    // sql.js run() doesn't return changes. We use exec for counting,
    // then run for the actual operation.
    this.db.run(sql, params);
    // Get changes via a separate query
    const changesResult = this.db.exec("SELECT changes()");
    const changes = changesResult.length > 0 ? (changesResult[0].values[0][0] as number) : 0;
    return { changes, lastInsertRowid: 0 };
  }

  /** Query that returns a single row object, or undefined. */
  get(sql: string, ...params: any[]): Record<string, any> | undefined {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length) stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /** Query that returns an array of row objects. */
  all(sql: string, ...params: any[]): Record<string, any>[] {
    const results: Record<string, any>[] = [];
    const stmt = this.db.prepare(sql);
    try {
      if (params.length) stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  /** Persist to disk (no-op for :memory: databases). */
  save(): void {
    if (!this.filePath || this.filePath === ":memory:") return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.filePath, buffer);
  }

  /** Close the database, persisting to disk first. */
  close(): void {
    this.save();
    this.db.close();
  }

  /** Get underlying sql.js database (for direct access if needed). */
  raw(): SqlJsDb { return this.db; }
}
