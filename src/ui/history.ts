/**
 * History Store — 文件持久化输入历史 + ↑/↓ 导航。
 */
import { readFileSync, writeFile, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export class HistoryStore {
  private entries: string[] = [];
  private filePath: string;
  private maxEntries: number;
  private cursor: number = -1; // -1 = 在底部(最新), >=0 = 历史位置
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(filePath?: string, maxEntries = 500) {
    this.filePath = filePath ?? join(homedir(), ".character_mind_history");
    this.maxEntries = maxEntries;
    this._load();
  }

  private _load(): void {
    try {
      if (existsSync(this.filePath)) {
        const text = readFileSync(this.filePath, "utf-8");
        this.entries = text.split("\n").filter(Boolean).slice(-this.maxEntries);
      }
    } catch { /* ignore */ }
  }

  private _scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this._flush(), 5000);
  }

  private _flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.saveTimer = null;
    try {
      const dir = this.filePath.replace(/[\\/][^\\/]+$/, "");
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFile(this.filePath, this.entries.join("\n") + "\n", "utf-8", () => {});
    } catch { /* ignore */ }
  }

  /** Add entry. Skips duplicates of the most recent entry. */
  add(entry: string): void {
    const trimmed = entry.trim();
    if (!trimmed) return;
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) return;
    this.entries.push(trimmed);
    if (this.entries.length > this.maxEntries) this.entries = this.entries.slice(-this.maxEntries);
    this.cursor = -1;
    this._scheduleSave();
  }

  /** 向上浏览(更早的历史)。返回历史文本或 null(已到顶)。add/resetCursor 后首次调用返回最新。 */
  up(): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor === -1) {
      // 从底部开始,先看最新一条
      this.cursor = this.entries.length - 1;
    } else if (this.cursor > 0) {
      this.cursor--;
    } else {
      return null; // 已到顶
    }
    return this.entries[this.cursor];
  }

  /** 向下浏览(更新的历史)。返回历史文本或 null(已到底)。 */
  down(): string | null {
    if (this.entries.length === 0 || this.cursor === -1) return null;
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor];
    }
    // 到底部
    this.cursor = -1;
    return null; // 返回 null 表示清空输入
  }

  /** 重置游标到底部(新输入或提交后调用) */
  resetCursor(): void {
    this.cursor = -1;
  }

  get length(): number { return this.entries.length; }
}
