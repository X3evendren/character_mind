// Character Mind v3 — Ink TUI only.
// Readline fallback has been removed. Non-TTY environments get a clear error.
if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
  import("./ink-main");
} else {
  console.error("Character Mind v3 requires a real terminal (TTY).");
  console.error("Use PowerShell, Windows Terminal, or any terminal emulator.");
  process.exit(1);
}
