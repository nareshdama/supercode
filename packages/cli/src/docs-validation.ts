import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Extract a Markdown section body from a document.
 *
 * Args:
 *   markdown: Full Markdown document text.
 *   heading: Second-level heading text to locate.
 *
 * Returns:
 *   Section body text, or an empty string when the heading is absent.
 *
 * Raises:
 *   Never.
 */
export function getMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=^## |\\Z)`, "m"));
  return match?.[1] ?? "";
}
// DESIGN NOTE: The same section parser is shared by CLI audits and docs verification to prevent drift.

/**
 * Parse CLI command bullets from the README CLI section.
 *
 * Args:
 *   readme: Full README Markdown content.
 *
 * Returns:
 *   Ordered CLI command lines declared in the README.
 *
 * Raises:
 *   Never.
 */
export function parseReadmeCommands(readme: string): string[] {
  return getMarkdownSection(readme, "CLI Commands")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith("- `supercode "))
    .map(line => line.slice(3, -1));
}
// DESIGN NOTE: README command parsing stays exact so help/docs drift fails loudly.

/**
 * Normalize a documented help command into a prefix-comparable form.
 *
 * Args:
 *   command: Canonical help command line.
 *
 * Returns:
 *   Command prefix with optional and positional argument markers removed.
 *
 * Raises:
 *   Never.
 */
export function normalizeCommandPrefix(command: string): string {
  return command
    .replace(/\s+\[[^\]]+\]/g, "")
    .replace(/\s+<[^>]+>/g, "")
    .trim();
}
// DESIGN NOTE: Normalized prefixes allow examples to include concrete arguments without restating help syntax.

/**
 * Build supported help prefixes for validating example commands.
 *
 * Args:
 *   helpCommands: Canonical CLI help command lines.
 *
 * Returns:
 *   Prefixes for concrete commands, excluding placeholder-only command entries.
 *
 * Raises:
 *   Never.
 */
export function buildSupportedHelpPrefixes(helpCommands: string[]): string[] {
  return helpCommands
    .filter(command => !command.includes("<plugin-command>"))
    .map(normalizeCommandPrefix);
}
// DESIGN NOTE: Placeholder commands must be removed or they collapse to bare `supercode` and produce false positives.

/**
 * Extract shell commands from fenced bash blocks.
 *
 * Args:
 *   markdown: Markdown content to inspect.
 *
 * Returns:
 *   Flat list of shell commands from bash code fences.
 *
 * Raises:
 *   Never.
 */
export function extractShellCommands(markdown: string): string[] {
  const blocks = [...markdown.matchAll(/```bash\r?\n([\s\S]*?)```/g)];
  return blocks.flatMap(match =>
    match[1]
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !line.startsWith("#"))
  );
}
// DESIGN NOTE: Only bash fences are treated as executable documentation to keep validation intentionally narrow.

/**
 * Normalize an example shell line into a CLI command candidate.
 *
 * Args:
 *   line: Shell command extracted from an example README.
 *
 * Returns:
 *   The normalized `supercode ...` command, or undefined for non-CLI lines.
 *
 * Raises:
 *   Never.
 */
export function normalizeExampleCommand(line: string): string | undefined {
  if (line.startsWith("npx supercode ")) {
    return line.replace(/^npx\s+/, "");
  }
  if (line.startsWith("npx @nareshdama/supercode ")) {
    return line.replace(/^npx\s+@nareshdama\/supercode/, "supercode");
  }
  if (line.startsWith("supercode ")) {
    return line;
  }
  return undefined;
}
// DESIGN NOTE: Example normalization recognizes the supported invocation styles and ignores unrelated shell commands.

/**
 * Validate example README commands against supported CLI help prefixes.
 *
 * Args:
 *   exampleReadme: Example README content to inspect.
 *   helpCommands: Canonical CLI help command lines.
 *
 * Returns:
 *   Invalid example commands that are not covered by the help surface.
 *
 * Raises:
 *   Never.
 */
export function findInvalidExampleCommands(exampleReadme: string, helpCommands: string[]): string[] {
  const helpPrefixes = buildSupportedHelpPrefixes(helpCommands);
  return extractShellCommands(exampleReadme)
    .map(normalizeExampleCommand)
    .filter((command): command is string => command !== undefined)
    .filter(command => !helpPrefixes.some(prefix => command === prefix || command.startsWith(`${prefix} `)));
}
// DESIGN NOTE: Returning invalid commands instead of throwing keeps the helper reusable across scripts and runtime audits.

/**
 * Collect example README files under the repository examples directory.
 *
 * Args:
 *   examplesDir: Absolute examples directory path.
 *   fileExists: Predicate for checking file presence.
 *
 * Returns:
 *   Absolute paths to example README files, including the top-level examples index.
 *
 * Raises:
 *   Never.
 */
export function collectExampleReadmes(examplesDir: string, fileExists: (filePath: string) => boolean): string[] {
  if (!fileExists(examplesDir)) {
    return [];
  }

  const directReadme = path.join(examplesDir, "README.md");
  const nestedReadmes = readdirSync(examplesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(examplesDir, entry.name, "README.md"))
    .filter(filePath => fileExists(filePath));

  return [directReadme, ...nestedReadmes].filter(filePath => fileExists(filePath));
}
// DESIGN NOTE: File-existence injection keeps this helper easy to reuse without binding it to a specific filesystem policy.
