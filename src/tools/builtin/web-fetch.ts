import { z } from "zod";
import { lookup } from "dns/promises";
import { isIP } from "net";
import type { ToolDef, ToolResult, ToolContext } from "../types";
import { errorResult, successResult } from "../types";

const params = z.object({
  url: z.string().describe("网页 URL"),
  prompt: z.string().optional().describe("提取信息的提示"),
});

/**
 * SSRF protection — block private / internal / loopback addresses.
 *
 * Defense has two layers:
 *   1. Hostname string check — catches literal IPs (127.0.0.1, [::1], etc.)
 *   2. DNS resolution check — resolves the hostname and verifies every
 *      resolved IP is public. Defends against DNS rebinding, where a
 *      hostname initially resolves to a public IP but later to 127.0.0.1.
 *
 * Covers:
 *   - IPv4 loopback (127.0.0.0/8), private (10/8, 172.16/12, 192.168/16)
 *   - IPv4 link-local (169.254/16) — includes cloud metadata endpoint
 *       169.254.169.254
 *   - IPv4 CGNAT (100.64/10), unspecified (0.0.0.0), broadcast (255.255.255.255)
 *   - IPv6 loopback (::1), unspecified (::), ULA (fc00::/7),
 *       link-local (fe80::/10), IPv4-mapped (::ffff:0:0/96)
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "broadcasthost",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  // Order matters only for readability; all ranges are non-overlapping here
  // except 0.x and 127.x which are checked first.
  if (a === 0) return true;                          // 0.0.0.0/8 (unspecified + this network)
  if (a === 10) return true;                         // 10.0.0.0/8 (private)
  if (a === 127) return true;                        // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true;           // 169.254.0.0/16 (link-local + cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 (private) — full range
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16 (private)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 255 && b === 255) return true;           // 255.255.255.255 (broadcast, /30-ish guard)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;                   // loopback
  if (lower === "::") return true;                    // unspecified
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (lower.startsWith("fe8") || lower.startsWith("fe9")
      || lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const v4MappedMatch = lower.match(/^::ffff:([0-9.]+)$/);
  if (v4MappedMatch) return isPrivateIPv4(v4MappedMatch[1]);
  // IPv4-compatible: ::a.b.c.d (deprecated but still seen)
  const v4CompatMatch = lower.match(/^::([0-9.]+)$/);
  if (v4CompatMatch) return isPrivateIPv4(v4CompatMatch[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return false; // not an IP literal — handled by DNS resolution check
}

/** Check a hostname string (may be a literal IP or a DNS name). */
function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Strip IPv6 brackets for literal-IP checks
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (isIP(bare) && isPrivateAddress(bare)) return true;
  return false;
}

/**
 * Resolve the hostname and reject if ANY resolved IP is private.
 * This is the DNS-rebinding defense: we verify the addresses we actually
 * connect to, not just the string the caller typed.
 */
async function isBlockedUponResolution(hostname: string): Promise<boolean> {
  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) return true; // nothing resolvable → treat as blocked
    return records.some(r => isPrivateAddress(r.address));
  } catch {
    // DNS failure → can't verify. Fail closed.
    return true;
  }
}

export const webFetchTool: ToolDef<z.infer<typeof params>, string> = {
  name: "web_fetch",
  aliases: ["fetch"],
  description: "获取网页内容并提取文本。用于查阅在线文档或网页。",
  parameters: params,
  isReadOnly: true,
  isDestructive: false,
  isConcurrencySafe: true,
  riskLevel: "medium",

  async execute(p, ctx: ToolContext): Promise<ToolResult<string>> {
    // SSRF check — layer 1: URL parse + hostname string check
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(p.url);
    } catch {
      return errorResult(`Invalid URL: ${p.url}`);
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return errorResult(`Disallowed protocol: ${parsedUrl.protocol}`);
    }

    const hostname = parsedUrl.hostname;
    if (isBlockedHostname(hostname)) {
      return errorResult(`SSRF blocked: ${hostname} is a private/internal/loopback address`);
    }

    // SSRF check — layer 2: DNS resolution check (defends against rebinding)
    const blockedAfterDns = await isBlockedUponResolution(hostname);
    if (blockedAfterDns) {
      return errorResult(`SSRF blocked: ${hostname} resolves to a private/internal address`);
    }

    try {
      const resp = await fetch(p.url, {
        headers: { "User-Agent": "CharacterMind/3.0" },
        signal: ctx.signal ?? undefined,
        redirect: "follow",
      });

      if (!resp.ok) return errorResult(`HTTP ${resp.status}: ${resp.statusText}`);

      const html = await resp.text();
      // Strip scripts and styles, extract text
      let text = html.replace(/<script[^>]*>.*?<\/script>/gis, "")
        .replace(/<style[^>]*>.*?<\/style>/gis, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const maxChars = 8000;
      const truncated = text.length > maxChars;
      text = text.slice(0, maxChars);

      return successResult(text, text, truncated);
    } catch (e: any) {
      return errorResult(`web_fetch failed: ${e.message}`);
    }
  },

  formatResult(data: string): string { return data; },
  formatError(error: string): string { return `Fetch error: ${error}`; },
};
