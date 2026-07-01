/**
 * Subagent Isolation — optional git worktree isolation.
 *
 * When isolation mode is "worktree", the subagent runs in a temporary
 * git worktree so file mutations don't affect the main workspace.
 * Default mode is "shared" — subagent works in the same filesystem.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

export interface IsolationContext {
  /** Working directory for the subagent */
  workDir: string;
  /** Cleanup function to call after subagent completes */
  cleanup: () => void;
}

/**
 * Create an isolation context for a subagent task.
 *
 * "shared" mode: returns the current working directory (no cleanup needed).
 * "worktree" mode: creates a temporary git worktree, returns its path.
 */
export function createIsolation(
  mode: "shared" | "worktree",
): IsolationContext {
  if (mode === "shared") {
    return {
      workDir: process.cwd(),
      cleanup: () => {}, // no-op
    };
  }

  // Worktree mode: create a temp git worktree
  const repoRoot = findGitRoot(process.cwd());
  if (!repoRoot) {
    // Not a git repo — fall back to shared
    console.warn("[subagent] Not a git repository, using shared isolation");
    return { workDir: process.cwd(), cleanup: () => {} };
  }

  const id = randomUUID().slice(0, 8);
  const worktreePath = join(repoRoot, ".claude", "worktrees", `subagent-${id}`);

  try {
    execSync(`git worktree add "${worktreePath}" HEAD`, {
      cwd: repoRoot,
      stdio: "pipe",
      timeout: 10_000,
    });

    return {
      workDir: worktreePath,
      cleanup: () => {
        try {
          execSync(`git worktree remove "${worktreePath}" --force`, {
            cwd: repoRoot,
            stdio: "pipe",
            timeout: 10_000,
          });
        } catch (err: any) {
          console.warn(`[subagent] Failed to clean up worktree: ${err.message}`);
        }
      },
    };
  } catch (err: any) {
    console.warn(`[subagent] Failed to create worktree: ${err.message}, falling back to shared`);
    return { workDir: process.cwd(), cleanup: () => {} };
  }
}

/** Find the root of a git repository */
function findGitRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
