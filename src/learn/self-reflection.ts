/** Self Reflection — Dual-process fast/slow reflection.  */
export interface ReflectionEntry {
  timestamp: number; type: "fast" | "slow";
  whatWentWell: string; whatWentWrong: string; insight: string; actionItems: string[];
}

export class SelfReflection {
  fastInterval: number;
  slowInterval: number;

  private _entries: ReflectionEntry[] = [];
  private _turnBuf: Array<Record<string, string>> = [];
  private _lastSlow = 0;

  constructor(fi = 1, si = 20) { this.fastInterval = fi; this.slowInterval = si; }

  fastReflect(userInput: string, assistantResponse: string, psychologyResult?: any): ReflectionEntry {
    let ww = "", wr = "";
    if (assistantResponse.length < 10) wr = "回应太短";
    else if (assistantResponse.length > 500) wr = "回应太长";
    if (psychologyResult?.emotion?.intensity > 0.8) ww = `情感强度高(${psychologyResult.emotion.dominant})`;

    const e: ReflectionEntry = {
      timestamp: Date.now() / 1000, type: "fast",
      whatWentWell: ww || "正常", whatWentWrong: wr || "无明显问题",
      insight: "", actionItems: [],
    };
    this._entries.push(e);
    this._turnBuf.push({ user: userInput.slice(0, 200), assistant: assistantResponse.slice(0, 200), well: ww, wrong: wr });
    if (this._entries.length > 200) this._entries = this._entries.slice(-200);
    if (this._turnBuf.length > 50) this._turnBuf = this._turnBuf.slice(-50);
    return e;
  }

  shouldSlowReflect(turnCount: number): boolean { return turnCount % this.slowInterval === 0 && turnCount > 0; }
  shouldSessionReflect(): boolean { return this._turnBuf.length > 0; }

  getRecentInsights(n = 5): string[] {
    return this._entries.filter(e => e.type === "slow").slice(-n).map(e => e.insight.slice(0, 200)).filter(Boolean);
  }

  stats() {
    return {
      totalReflections: this._entries.length,
      fastCount: this._entries.filter(e => e.type === "fast").length,
      slowCount: this._entries.filter(e => e.type === "slow").length,
      recentInsights: this.getRecentInsights(3),
    };
  }
}
