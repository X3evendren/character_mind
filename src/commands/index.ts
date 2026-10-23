/**
 * Command system — register builtins + export public API.
 */
import { registerCommand, findCommand } from "./registry";
import { router } from "./router";
import { helpCommand } from "./builtin/help";
import { quitCommand } from "./builtin/quit";
import { statsCommand } from "./builtin/stats";
import { modelCommand } from "./builtin/model";
import { compressCommand, expandCommand } from "./builtin/memory";
import { thinkCommand } from "./builtin/think";
import { themeCommand } from "./builtin/theme";
import { debugCommand } from "./builtin/debug";

export function registerBuiltinCommands(): void {
  if (findCommand('help')) return;
  // Priority commands (execute outside turn lock)
  router.setPriority("quit");
  router.setPriority("exit");
  router.setPriority("q");

  // Register all commands
  registerCommand(quitCommand);
  registerCommand(helpCommand);
  registerCommand(statsCommand);
  registerCommand(modelCommand);
  registerCommand(compressCommand);
  registerCommand(expandCommand);
  registerCommand(thinkCommand);
  registerCommand(themeCommand);
  registerCommand(debugCommand);
}

// Public API
export { getCommands, findCommand, getCommandNames } from "./registry";
export { CommandRouter, router } from "./router";
export { parseSlashCommand, isCommandInput } from "./parser";
export type { Command, CommandContext, LocalCommand, PromptCommand } from "./types";
