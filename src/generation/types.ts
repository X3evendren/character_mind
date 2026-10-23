/** Generation types — Span lifecycle, RepackContext, SpanOp, GenStatus */

export type SpanLayer = "fluid" | "stable" | "locked";

export interface Span {
  id: string;
  layer: SpanLayer;
  text: string;
  startPos: number;
  endPos: number;
  committedAt?: number;
}

/** SpanRenderer operations */
export type SpanOp =
  | { type: "append"; span: Span }
  | { type: "patch"; spanId: string; newText: string }
  | { type: "lock"; spanId: string }
  | { type: "invalidate"; fromSpanId: string };

