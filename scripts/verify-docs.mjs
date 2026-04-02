import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = path.join(rootDir, "README.md");
const examplesDir = path.join(rootDir, "examples");
const cliEntrypoint = path.join(rootDir, "packages", "cli", "dist", "index.js");

function fail(message) {
  throw new Error(message);
}

function readText(filePath) {
  if (!existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }

  return readFileSync(filePath, "utf8");
}

async function getCliHelpLines() {
  if (!existsSync(cliEntrypoint)) {
    fail(`Missing CLI build output at ${cliEntrypoint}. Run "npm run build" first.`);
  }

  const { runCli } = await import(pathToFileURL(cliEntrypoint).href);
  const lines = [];
  const errors = [];
  const exitCode = await runCli(["help"], {
    out: message => lines.push(message),
    err: message => errors.push(message)
  });

  if (exitCode !== 0) {
    fail(`CLI help exited with status ${exitCode}.\n${errors.join("\n")}`.trim());
  }

  return lines.flatMap(line => line.split(/\r?\n/));
}

function getSection(text, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=^## |\\Z)`, "m"));
  return match?.[1] ?? "";
}

function parseReadmeCommands(text) {
  return getSection(text, "CLI Commands")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith("- `supercode "))
    .map(line => line.slice(3, -1));
}

function parseHelpCommands(lines) {
  return lines
    .map(line => line.trim())
    .filter(line => line.startsWith("supercode "));
}

function normalizeCommandPrefix(command) {
  return command
    .replace(/\s+\[[^\]]+\]/g, "")
    .replace(/\s+<[^>]+>/g, "")
    .trim();
}

function extractShellCommands(text) {
  const blocks = [...text.matchAll(/```bash\r?\n([\s\S]*?)```/g)];
  return blocks.flatMap(match =>
    match[1]
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !line.startsWith("#"))
  );
}

function verifyReadmeCommands(readmeCommands, helpCommands) {
  const helpSet = new Set(helpCommands);
  const missing = readmeCommands.filter(command => !helpSet.has(command));
  if (missing.length > 0) {
    fail(`README CLI Commands contains commands not present in CLI help: ${missing.join(", ")}`);
  }
}

function verifyRequiredSnippets(readme) {
  const requiredSnippets = [
    "npx supercode init",
    "npm install @supercode/core",
    "npm run smoke:phase7",
    "npm run verify:docs",
    "Phase 8: Hardening and Launch"
  ];

  const missing = requiredSnippets.filter(snippet => !readme.includes(snippet));
  if (missing.length > 0) {
    fail(`README is missing required Phase 8 snippets: ${missing.join(", ")}`);
  }
}

function verifyExampleCommands(exampleReadme, helpCommands, label) {
  const helpPrefixes = helpCommands
    .filter(command => !command.includes("<plugin-command>"))
    .map(normalizeCommandPrefix);
  const commands = extractShellCommands(exampleReadme)
    .map(line => line.startsWith("npx supercode ") ? line.replace(/^npx\s+/, "") : line)
    .filter(line => line.startsWith("supercode "));

  const invalid = commands.filter(command => !helpPrefixes.some(prefix => command === prefix || command.startsWith(`${prefix} `)));
  if (invalid.length > 0) {
    fail(`${label} contains CLI commands not covered by help output: ${invalid.join(", ")}`);
  }
}

function collectExampleReadmes() {
  if (!existsSync(examplesDir)) {
    return [];
  }

  const directReadme = path.join(examplesDir, "README.md");
  const nestedReadmes = readdirSync(examplesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(examplesDir, entry.name, "README.md"))
    .filter(filePath => existsSync(filePath));

  return [directReadme, ...nestedReadmes].filter(filePath => existsSync(filePath));
}

async function main() {
  const readme = readText(readmePath);
  const helpLines = await getCliHelpLines();
  const helpCommands = parseHelpCommands(helpLines);
  const readmeCommands = parseReadmeCommands(readme);

  verifyReadmeCommands(readmeCommands, helpCommands);
  verifyRequiredSnippets(readme);
  for (const exampleReadmePath of collectExampleReadmes()) {
    verifyExampleCommands(readText(exampleReadmePath), helpCommands, path.relative(rootDir, exampleReadmePath));
  }

  console.log("[verify-docs] Documentation checks passed");
}

await main();
