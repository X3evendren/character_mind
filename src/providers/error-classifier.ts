/**
 * ErrorClassifier — ported from nanobot/providers/base.py retry logic.
 *
 * Classifies LLM errors into:
 *  - RETRYABLE: transient errors (429 rate limit, 5xx, timeout, connection)
 *     worth retrying
 *  - NON_RETRYABLE: billing/quota errors that won't clear on retry
 *  - UNKNOWN: can't classify (defaults to retryable for safety)
 *
 * Extracts retry-after delay from headers, body text, and structured error data.
 */

import type { LLMResponse } from "./types";

// ═══════════════════════════════════════════════════════════════
// Constants (ported from nanobot)
// ═══════════════════════════════════════════════════════════════

export enum ErrorCategory {
  RETRYABLE = "retryable",
  NON_RETRYABLE = "non_retryable",
  UNKNOWN = "unknown",
}

/** HTTP status codes that are always retryable */
const RETRYABLE_STATUS_CODES = new Set([408, 409, 429]);

/** Transient error kinds */
const TRANSIENT_ERROR_KINDS = new Set(["timeout", "connection"]);

/** Markers in error text that indicate a transient (retryable) error */
const TRANSIENT_ERROR_MARKERS = [
  "429", "rate limit", "500", "502", "503", "504",
  "overloaded", "timeout", "timed out", "connection",
  "server error", "temporarily unavailable",
  "速率限制", "访问量过大",
];

/** Non-retryable 429 semantic tokens (billing/quota errors) */
const NON_RETRYABLE_429_TOKENS = new Set([
  "insufficient_quota", "quota_exceeded", "quota_exhausted",
  "billing_hard_limit_reached", "insufficient_balance",
  "credit_balance_too_low", "billing_not_active", "payment_required",
]);

/** Retryable 429 semantic tokens */
const RETRYABLE_429_TOKENS = new Set([
  "rate_limit_exceeded", "rate_limit_error", "too_many_requests",
  "request_limit_exceeded", "requests_limit_exceeded", "overloaded_error",
]);

/** Non-retryable 429 text markers (billing/quota) */
const NON_RETRYABLE_429_TEXT_MARKERS = [
  "insufficient_quota", "insufficient quota", "quota exceeded",
  "quota exhausted", "billing hard limit", "billing_hard_limit_reached",
  "billing not active", "insufficient balance", "insufficient_balance",
  "credit balance too low", "payment required", "out of credits",
  "out of quota", "exceeded your current quota",
];

/** Retryable 429 text markers */
const RETRYABLE_429_TEXT_MARKERS = [
  "rate limit", "rate_limit", "too many requests",
  "retry after", "try again in", "temporarily unavailable",
  "overloaded", "concurrency limit", "速率限制",
];

// ═══════════════════════════════════════════════════════════════
// Error classification
// ═══════════════════════════════════════════════════════════════

export function classifyResponse(response: LLMResponse): ErrorCategory {
  // If structured should_retry is set, use it
  if (response.errorShouldRetry !== null) {
    return response.errorShouldRetry ? ErrorCategory.RETRYABLE : ErrorCategory.NON_RETRYABLE;
  }

  // Check status code
  if (response.errorStatusCode !== null) {
    const status = response.errorStatusCode;
    if (status === 429) {
      return classify429(response);
    }
    if (RETRYABLE_STATUS_CODES.has(status) || status >= 500) {
      return ErrorCategory.RETRYABLE;
    }
  }

  // Check error kind
  const kind = (response.errorKind ?? "").trim().toLowerCase();
  if (TRANSIENT_ERROR_KINDS.has(kind)) {
    return ErrorCategory.RETRYABLE;
  }

  // Fall back to text markers
  return isTransientTextError(response.content)
    ? ErrorCategory.RETRYABLE
    : ErrorCategory.UNKNOWN;
}

function isTransientTextError(content: string | null): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return TRANSIENT_ERROR_MARKERS.some(m => lower.includes(m));
}

// ═══════════════════════════════════════════════════════════════
// 429 classification (distinguishes rate_limit from billing errors)
// ═══════════════════════════════════════════════════════════════

function classify429(response: LLMResponse): ErrorCategory {
  const typeToken = normalizeErrorToken(response.errorType);
  const codeToken = normalizeErrorToken(response.errorCode);

  // Check semantic tokens first
  const semanticTokens = new Set([typeToken, codeToken].filter(Boolean) as string[]);

  if ([...semanticTokens].some(t => NON_RETRYABLE_429_TOKENS.has(t))) {
    return ErrorCategory.NON_RETRYABLE;
  }

  // Check text markers
  const content = (response.content ?? "").toLowerCase();
  if (NON_RETRYABLE_429_TEXT_MARKERS.some(m => content.includes(m))) {
    return ErrorCategory.NON_RETRYABLE;
  }

  if ([...semanticTokens].some(t => RETRYABLE_429_TOKENS.has(t))) {
    return ErrorCategory.RETRYABLE;
  }
  if (RETRYABLE_429_TEXT_MARKERS.some(m => content.includes(m))) {
    return ErrorCategory.RETRYABLE;
  }

  // Unknown 429 → default to WAIT+retry (safe)
  return ErrorCategory.RETRYABLE;
}

function normalizeErrorToken(value: unknown): string | null {
  if (value == null) return null;
  const token = String(value).trim().toLowerCase();
  return token || null;
}

// ═══════════════════════════════════════════════════════════════
// Arrearage detection (billing/quota errors that won't clear)
// ═══════════════════════════════════════════════════════════════

export function isArrearageResponse(response: LLMResponse): boolean {
  // HTTP 402 is payment required
  if (response.errorStatusCode === 402) return true;

  const typeToken = normalizeErrorToken(response.errorType);
  const codeToken = normalizeErrorToken(response.errorCode);

  if ([typeToken, codeToken].some(t => t && NON_RETRYABLE_429_TOKENS.has(t))) {
    return true;
  }

  const content = (response.content ?? "").toLowerCase();
  return NON_RETRYABLE_429_TEXT_MARKERS.some(m => content.includes(m));
}

// ═══════════════════════════════════════════════════════════════
// Retry-after extraction
// ═══════════════════════════════════════════════════════════════

/**
 * Extract retry-after delay from response body text.
 * Handles patterns:
 *   "retry after 5s"
 *   "try again in 500ms"
 *   "wait 2 minutes before retry"
 */
export function extractRetryAfterFromText(content: string | null): number | null {
  if (!content) return null;
  const lower = content.toLowerCase();

  const patterns: Array<RegExp> = [
    /retry\s+after\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds|s|sec|secs|seconds|m|min|minutes)?/,
    /try\s+again\s+in\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds|s|sec|secs|seconds|m|min|minutes)/,
    /wait\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds|s|sec|secs|seconds|m|min|minutes)\s+before\s+retry/,
    /retry[_-]?after["'\s:=]+(\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] ?? "s";
      return toRetrySeconds(value, unit);
    }
  }

  return null;
}

/**
 * Extract retry-after from HTTP headers object.
 * Supports: Retry-After (seconds or HTTP-date), Retry-After-Ms (milliseconds)
 */
export function extractRetryAfterFromHeaders(
  headers: Record<string, string> | Headers | undefined | null,
): number | null {
  if (!headers) return null;

  // Try Retry-After-Ms first (milliseconds)
  const retryMs = getHeaderValue(headers, "retry-after-ms");
  if (retryMs) {
    const value = parseFloat(retryMs) / 1000;
    if (value > 0) return value;
  }

  // Try Retry-After
  const retryAfter = getHeaderValue(headers, "retry-after");
  if (!retryAfter?.trim()) return null;

  const text = retryAfter.trim();

  // Integer/float → seconds
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return toRetrySeconds(parseFloat(text), "s");
  }

  // HTTP-date → compute remaining seconds
  const date = new Date(text);
  if (!isNaN(date.getTime())) {
    return Math.max(0.1, (date.getTime() - Date.now()) / 1000);
  }

  return null;
}

function getHeaderValue(
  headers: Record<string, string> | Headers,
  name: string,
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  // Case-insensitive lookup for plain objects
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

/**
 * Unified retry-after extraction from LLMResponse (structured fields first,
 * then content text fallback).
 */
export function extractRetryAfterFromResponse(response: LLMResponse): number | null {
  if (response.errorRetryAfterS !== null && response.errorRetryAfterS > 0) {
    return response.errorRetryAfterS;
  }
  if (response.retryAfter !== null && response.retryAfter > 0) {
    return response.retryAfter;
  }
  return extractRetryAfterFromText(response.content);
}

// ═══════════════════════════════════════════════════════════════
// Unit conversion
// ═══════════════════════════════════════════════════════════════

function toRetrySeconds(value: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === "ms" || normalized === "milliseconds") {
    return Math.max(0.1, value / 1000);
  }
  if (normalized === "m" || normalized === "min" || normalized === "minutes") {
    return Math.max(0.1, value * 60);
  }
  return Math.max(0.1, value);
}

// ═══════════════════════════════════════════════════════════════
// Error type/code extraction from structured error payloads
// ═══════════════════════════════════════════════════════════════

export function extractErrorTypeCode(
  payload: unknown,
): [string | null, string | null] {
  let data: Record<string, unknown> | null = null;

  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    data = payload as Record<string, unknown>;
  } else if (typeof payload === "string" && payload.trim()) {
    try {
      const parsed = JSON.parse(payload.trim());
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        data = parsed;
      }
    } catch { /* not JSON */ }
  }

  if (!data) return [null, null];

  const errorObj = data.error as Record<string, unknown> | undefined;
  const typeValue = (errorObj?.type ?? data.type) as string | undefined;
  const codeValue = (errorObj?.code ?? data.code) as string | undefined;

  return [normalizeErrorToken(typeValue), normalizeErrorToken(codeValue)];
}
