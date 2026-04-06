import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = path.join(rootDir, "README.md");
const examplesDir = path.join(rootDir, "examples");
const cliEntrypoint = path.join(rootDir, "packages", "cli", "dist", "index.js");
let docsValidation;

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

function parseHelpCommands(lines) {
  return lines
    .map(line => line.trim())
    .filter(line => line.startsWith("supercode "));
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
    "npx @nareshdama/supercode init",
    "npm install @nareshdama/core",
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
  const invalid = docsValidation.findInvalidExampleCommands(exampleReadme, helpCommands);
  if (invalid.length > 0) {
    fail(`${label} contains CLI commands not covered by help output: ${invalid.join(", ")}`);
  }
}

async function main() {
  const readme = readText(readmePath);
  const helpLines = await getCliHelpLines();
  const helpCommands = parseHelpCommands(helpLines);
  const docsValidationEntrypoint = path.join(rootDir, "packages", "cli", "dist", "docs-validation.js");
  if (!existsSync(docsValidationEntrypoint)) {
    fail(`Missing docs validation build output at ${docsValidationEntrypoint}. Run "npm run build" first.`);
  }
  const importedDocsValidation = await import(pathToFileURL(docsValidationEntrypoint).href);
  docsValidation = importedDocsValidation;
  const readmeCommands = docsValidation.parseReadmeCommands(readme);

  verifyReadmeCommands(readmeCommands, helpCommands);
  verifyRequiredSnippets(readme);
  for (const exampleReadmePath of docsValidation.collectExampleReadmes(examplesDir, existsSync)) {
    verifyExampleCommands(readText(exampleReadmePath), helpCommands, path.relative(rootDir, exampleReadmePath));
  }

  console.log("[verify-docs] Documentation checks passed");
}

await main();
