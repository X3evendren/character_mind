/**
 * Gate 0: Regex Deny List — zero-latency pattern-based blocking.
 * Contains the ALIGN replacements and action pattern filtering
 * previously in PostFilter, now wrapped as a GuardGate.
 */
import type { GuardGate, GateResult } from "../pipeline";
import { ALIGN, ACTION_PATTERNS } from "../align-patterns";

export function createRegexDenyGate(): GuardGate {
  return {
    name: "regex-deny",

    onOutput(output: string): GateResult {
      let modified = output;

      // Apply ALIGN replacements
      let replaced = false;
      for (const [pattern, replacement] of Object.entries(ALIGN)) {
        if (modified.includes(pattern)) {
          modified = modified.replace(pattern, replacement);
          replaced = true;
        }
      }

      // Strip action descriptions
      let actionsStripped = 0;
      for (const pat of ACTION_PATTERNS) {
        while (pat.test(modified)) {
          modified = modified.replace(pat, "");
          actionsStripped++;
        }
      }

      if (actionsStripped > 0) {
        modified = modified.replace(/  +/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      }

      if (replaced || actionsStripped > 0) {
        return {
          passed: true,
          action: "replace",
          replacement: modified,
          reason: replaced ? "ALIGN patterns replaced" : `${actionsStripped} action descriptions stripped`,
        };
      }

      return { passed: true, action: "allow" };
    },
  };
}
