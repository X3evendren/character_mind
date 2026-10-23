/**
 * Gate 0: Regex Deny List — zero-latency pattern-based blocking.
 * Removes stage directions; identity and safety statements are left intact.
 */
import type { GuardGate, GateResult } from "../pipeline";
import { ACTION_PATTERNS } from "../action-patterns";

export function createRegexDenyGate(): GuardGate {
  return {
    name: "regex-deny",

    onOutput(output: string): GateResult {
      let modified = output;

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

      if (actionsStripped > 0) {
        return {
          passed: true,
          action: "replace",
          replacement: modified,
          reason: `${actionsStripped} action descriptions stripped`,
        };
      }

      return { passed: true, action: "allow" };
    },
  };
}
