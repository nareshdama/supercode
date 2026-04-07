// ═══════════════════════════════════════════════════
// Fixed by: Fixer Agent | Cycle: 2
// Bugs fixed: 8 (0 critical, 5 major, 3 minor)
// Performance improvements: 0 (PERF-2-1 documented inline)
// Proactive improvements: 2 (manifest validation, redacted logging)
// Code health: Good → Excellent
// Safe to build on: YES
// ═══════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runCommand } from "./lib/command-runner.mjs";
import {
  isPublishedVersionFromViewResult,
  publishArgsFor,
  viewArgsFor
} from "./lib/npm-publish-args.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDirs = [
  "packages/core",
  "packages/models",
  "packages/detect",
  "packages/permissions",
  "packages/progress",
  "packages/state",
  "packages/tasks",
  "packages/tools",
  "packages/workflows",
  "packages/mcp",
  "packages/memory",
  "packages/cli",
  "packages/create-supercode"
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const configuredOtp = process.env.NPM_PUBLISH_OTP?.trim();
const tag = process.env.NPM_PUBLISH_TAG?.trim() || "latest";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

/**
 * Validate required package.json fields for publishing and return trimmed strings.
 *
 * Args:
 *   manifest: Parsed package.json object.
 *   packageDir: Workspace-relative directory (for error messages).
 *
 * Returns:
 *   Object with `name` and `version` strings.
 *
 * Raises:
 *   Error: When name or version is missing, empty, or not a string.
 */
function validatedPublishIdentity(manifest, packageDir) {
  const name = manifest?.name;
  const version = manifest?.version;
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(`[publish-release] Invalid or missing string "name" in ${packageDir}/package.json`);
  }
  if (typeof version !== "string" || version.trim() === "") {
    throw new Error(`[publish-release] Invalid or missing string "version" in ${packageDir}/package.json`);
  }
  return { name: name.trim(), version: version.trim() };
}
// DESIGN NOTE: Fail fast before any npm view/publish so malformed manifests never reach argv construction (BUG-2-M2).

/**
 * Format argv for logs without revealing OTP values (BUG-2-M3).
 *
 * Args:
 *   commandArgs: Full argument list including optional "--otp" and value.
 *
 * Returns:
 *   Human-readable command line with OTP value replaced by "[REDACTED]".
 *
 * Raises:
 *   Never.
 */
function formatNpmArgsForLog(commandArgs) {
  const out = [];
  for (let i = 0; i < commandArgs.length; i += 1) {
    if (commandArgs[i] === "--otp" && i + 1 < commandArgs.length) {
      out.push("--otp", "[REDACTED]");
      i += 1;
    } else {
      out.push(commandArgs[i]);
    }
  }
  return out.join(" ");
}
// DESIGN NOTE: Real argv passed to run() stays unchanged; only console copy is redacted.

/**
 * Read a package manifest from a workspace package directory.
 *
 * Args:
 *   packageDir: Workspace-relative package directory.
 *
 * Returns:
 *   Parsed package manifest object.
 *
 * Raises:
 *   Error: If the manifest cannot be read or parsed.
 */
function readPackageManifest(packageDir) {
  const manifestPath = path.join(rootDir, packageDir, "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}
// DESIGN NOTE: Publish order is driven by package manifests, so manifest reads stay as the first validation boundary.

/**
 * Execute an npm command and terminate on non-zero exit.
 *
 * Args:
 *   command: Executable name or path.
 *   commandArgs: Ordered argument list passed to the command.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If the command cannot be launched.
 */
function run(command, commandArgs) {
  const result = runCommand(command, commandArgs, {
    cwd: rootDir
  });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
  if (result.stdout.trim()) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.trim()) {
    process.stderr.write(result.stderr);
  }
}
// DESIGN NOTE: The shared runner keeps publish operations aligned with smoke checks and Windows sandbox behavior.

/**
 * Determine whether a package version is already published on npm.
 *
 * Args:
 *   packageName: npm package name.
 *   version: Version to check.
 *
 * Returns:
 *   `true` when the exact version is already published, otherwise `false`.
 *
 * Raises:
 *   Error: If the npm view command cannot be launched.
 *   TypeError: If viewArgsFor rejects inputs (should not occur after manifest validation).
 */
function isAlreadyPublished(packageName, version) {
  const result = runCommand(npmCommand, viewArgsFor(packageName, version), {
    cwd: rootDir,
    allowFailure: true
  });
  return isPublishedVersionFromViewResult(result, version);
}
// DESIGN NOTE: Allowing failure here lets npm signal “not published” without collapsing the whole publish workflow.

/**
 * Prompt interactively for an npm OTP when needed.
 *
 * Args:
 *   packageName: Package currently being published.
 *
 * Returns:
 *   Trimmed OTP string or `undefined` when the user submits an empty response.
 *
 * Raises:
 *   Never.
 */
async function promptForOtp(packageName) {
  const rl = readline.createInterface({ input, output });
  try {
    const entered = await rl.question(`[publish-release] Enter current npm OTP for ${packageName} (or press Enter to try without OTP): `);
    return entered.trim() || undefined;
  } finally {
    rl.close();
  }
}
// DESIGN NOTE: The prompt stays package-specific so repeated publish attempts remain easy to correlate in terminal history.

/**
 * Execute the publish workflow across workspace packages.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If package metadata is invalid or an npm command cannot be launched.
 */
async function main() {
  console.log(`[publish-release] tag=${tag}${dryRun ? " (dry-run)" : ""}`);
  console.log(configuredOtp ? "[publish-release] using OTP from NPM_PUBLISH_OTP" : "[publish-release] no fixed OTP provided");

  // Sequential npm view per package avoids registry rate limits and keeps order deterministic (PERF-2-1: parallel checks deferred).
  for (const packageDir of packageDirs) {
    const manifest = readPackageManifest(packageDir);
    const { name, version } = validatedPublishIdentity(manifest, packageDir);
    if (isAlreadyPublished(name, version)) {
      console.log(`[publish-release] ${name}@${version} already published, skipping`);
      continue;
    }
    const otp = configuredOtp ?? (dryRun ? undefined : await promptForOtp(name));
    const publishArgs = publishArgsFor({
      packageDir,
      packageName: name,
      tag,
      otp
    });
    console.log(`[publish-release] ${name}@${version}`);
    console.log(`  ${npmCommand} ${formatNpmArgsForLog(publishArgs)}`);
    if (!dryRun) {
      run(npmCommand, publishArgs);
    }
  }
}
// DESIGN NOTE: The workflow remains strictly sequential so publish order stays deterministic and dependency-safe.

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[publish-release] ${message}`);
  console.error("[publish-release] If publish requires npm 2FA, enter a fresh OTP when prompted or use a granular npm token with bypass-2FA enabled.");
  process.exit(1);
}
