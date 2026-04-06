const CLI_HELP_COMMANDS = [
  "supercode init [path] [--force]",
  "supercode doctor [--json]",
  "supercode run [task]",
  "supercode task start <goal>",
  "supercode task list",
  "supercode task show <task-id>",
  "supercode task cancel <task-id>",
  "supercode task retry <task-id> [--force]",
  "supercode task resume <task-id>",
  "supercode session show",
  "supercode permission show",
  "supercode result list",
  "supercode result show <result-id>",
  "supercode memory list [query]",
  "supercode memory show <memory-id>",
  "supercode mcp list",
  "supercode mcp invoke <server-id> <tool-name> [json-args]",
  "supercode extension list",
  "supercode extension validate",
  "supercode plugin list",
  "supercode <plugin-command> [args]",
  "supercode pack list",
  "supercode pack recommend",
  "supercode pack recommend --apply",
  "supercode pack install <pack-id>",
  "supercode pack uninstall <pack-id>",
  "supercode pack sync",
  "supercode skill search <query>",
  "supercode rule search <query>",
  "supercode model list",
  "supercode model status",
  "supercode release check [--json] [--skip-gates]"
] as const;

/**
 * Return the canonical CLI help command list.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   A cloned list of user-facing command lines without indentation.
 *
 * Raises:
 *   Never.
 */
export function getCliHelpCommands(): string[] {
  return [...CLI_HELP_COMMANDS];
}
// DESIGN NOTE: A shared command list keeps help rendering and docs audits aligned.

/**
 * Render the CLI help text.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Formatted multiline help text for the CLI entrypoint.
 *
 * Raises:
 *   Never.
 */
export function renderHelp(): string {
  return [
    "Supercode MVP CLI",
    "",
    "Commands:",
    ...getCliHelpCommands().map(command => `  ${command}`)
  ].join("\n");
}
// DESIGN NOTE: The formatter stays deliberately small so command changes remain easy to review.
