import { existsSync, mkdtempSync, openSync, readFileSync, rmSync, closeSync, readSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { getCliHelpCommands } from "./help.js";
import {
  collectExampleReadmes,
  findInvalidExampleCommands,
  parseReadmeCommands
} from "./docs-validation.js";

export type ReleaseStatus = "passed" | "failed" | "skipped";

export interface ReleaseAuditResult {
  auditId: string;
  title: string;
  status: ReleaseStatus;
  detail: string;
}

export interface ReleaseGateResult {
  gateId: string;
  title: string;
  status: ReleaseStatus;
  command: string;
  durationMs: number;
  detail: string;
  exitCode?: number;
}

export interface ReleaseReadinessReport {
  version: 1;
  generatedAt: string;
  rootDir: string;
  status: "passed" | "failed";
  audits: ReleaseAuditResult[];
  gates: ReleaseGateResult[];
  summary: {
    audits: Record<ReleaseStatus, number>;
    gates: Record<ReleaseStatus, number>;
  };
}

export interface ReleaseReadinessOptions {
  runGates?: boolean;
  runCommand?: (rootDir: string, gate: ReleaseGateSpec) => ReleaseGateResult;
}

export interface ReleaseGateSpec {
  gateId: string;
  title: string;
  executable: string;
  args: string[];
}

const REQUIRED_TOP_LEVEL_FILES = [
  "README.md",
  "STATUS.md",
  "ROADMAP.md",
  "PROJECT-SCOPE.md",
  "CONTRIBUTING.md",
  "DEVELOPING.md",
  "RELEASE-CHECKLIST.md",
  "SECURITY-REVIEW.md",
  "PERFORMANCE-BASELINE.md",
  "examples/README.md"
] as const;
const GATE_OUTPUT_PREVIEW_BYTES = 4096;

/**
 * Resolve the canonical release root by walking upward from the current working directory.
 *
 * Args:
 *   startCwd: Directory where the lookup starts.
 *
 * Returns:
 *   The absolute repository root that contains the release checklist and README.
 *
 * Raises:
 *   Error: If no release root can be found from the provided start directory.
 */
export function resolveReleaseRoot(startCwd: string): string {
  let currentDir = path.resolve(startCwd);
  while (true) {
    const hasReleaseMarkers =
      existsSync(path.join(currentDir, "package.json")) &&
      existsSync(path.join(currentDir, "README.md")) &&
      existsSync(path.join(currentDir, "RELEASE-CHECKLIST.md"));
    if (hasReleaseMarkers) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate a Supercode release root from ${startCwd}. Expected package.json, README.md, and RELEASE-CHECKLIST.md.`);
    }
    currentDir = parentDir;
  }
}
// DESIGN NOTE: Walking up the directory tree lets the command run from nested package folders without extra flags.

/**
 * Execute release readiness audits and optional gate commands.
 *
 * Args:
 *   startCwd: Directory where release-root discovery begins.
 *   options: Gate execution controls and an optional command runner override.
 *
 * Returns:
 *   A structured readiness report suitable for CLI rendering or JSON output.
 *
 * Raises:
 *   Error: If the release root cannot be resolved.
 */
export function runReleaseReadiness(startCwd: string, options: ReleaseReadinessOptions = {}): ReleaseReadinessReport {
  const rootDir = resolveReleaseRoot(startCwd);
  const audits = runReleaseAudits(rootDir);
  const gates = runReleaseGates(rootDir, options);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    rootDir,
    status: [...audits, ...gates].every(result => result.status !== "failed") ? "passed" : "failed",
    audits,
    gates,
    summary: {
      audits: summarizeStatuses(audits),
      gates: summarizeStatuses(gates)
    }
  };
}
// DESIGN NOTE: The report shape is normalized so the CLI and automation can consume the same data without branching.

/**
 * Render a human-readable release readiness report.
 *
 * Args:
 *   report: Structured release-readiness output.
 *
 * Returns:
 *   Ordered CLI lines describing audit and gate outcomes.
 *
 * Raises:
 *   Never.
 */
export function renderReleaseReadinessReport(report: ReleaseReadinessReport): string[] {
  const lines = [
    "Release Readiness",
    `Root: ${report.rootDir}`,
    `Status: ${report.status}`,
    `Static audits: passed=${report.summary.audits.passed} failed=${report.summary.audits.failed} skipped=${report.summary.audits.skipped}`,
    `Gate commands: passed=${report.summary.gates.passed} failed=${report.summary.gates.failed} skipped=${report.summary.gates.skipped}`,
    ""
  ];

  for (const audit of report.audits) {
    lines.push(`Audit ${audit.title} [${audit.status}]: ${audit.detail}`);
  }

  if (report.gates.length > 0) {
    lines.push("");
    for (const gate of report.gates) {
      const durationLabel = gate.status === "skipped" ? "skipped" : `${gate.durationMs}ms`;
      lines.push(`Gate ${gate.title} [${gate.status}] ${durationLabel}: ${gate.command}`);
      lines.push(`  ${gate.detail}`);
    }
  }

  return lines;
}
// DESIGN NOTE: Human output favors short summaries first, with per-gate detail only when it adds actionability.

/**
 * Parse command-line flags for `supercode release check`.
 *
 * Args:
 *   args: Raw CLI tokens after `release check`.
 *
 * Returns:
 *   Parsed release-readiness options.
 *
 * Raises:
 *   Error: If the caller provides an unknown argument.
 */
export function parseReleaseCheckArgs(args: string[]): { json: boolean; runGates: boolean } {
  let json = false;
  let runGates = true;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--skip-gates") {
      runGates = false;
      continue;
    }
    throw new Error(`Unknown release check argument: ${arg}`);
  }

  return { json, runGates };
}
// DESIGN NOTE: Fail-fast argument parsing avoids silently skipping expensive or safety-sensitive release work.

/**
 * Execute all static release audits.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *
 * Returns:
 *   Static audit results in a stable order.
 *
 * Raises:
 *   Never. Individual audit failures are captured in the returned results.
 */
function runReleaseAudits(rootDir: string): ReleaseAuditResult[] {
  return [
    executeAudit("required-files", "Required Files", () => auditRequiredFiles(rootDir)),
    executeAudit("readme-cli-sync", "README CLI Sync", () => auditReadmeCommands(rootDir)),
    executeAudit("example-cli-sync", "Example CLI Sync", () => auditExampleCommands(rootDir)),
    executeAudit("package-manifests", "Package Manifests", () => auditPackageManifests(rootDir))
  ];
}

/**
 * Execute release gate commands, optionally short-circuiting when one fails.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *   options: Gate execution controls and runner override.
 *
 * Returns:
 *   Gate execution results in checklist order.
 *
 * Raises:
 *   Never. Gate failures are captured as result records.
 */
function runReleaseGates(rootDir: string, options: ReleaseReadinessOptions): ReleaseGateResult[] {
  const gates = listReleaseGateSpecs();
  if (options.runGates === false) {
    return gates.map(gate => ({
      gateId: gate.gateId,
      title: gate.title,
      status: "skipped",
      command: formatCommand(gate.executable, gate.args),
      durationMs: 0,
      detail: "Skipped by --skip-gates."
    }));
  }

  const runCommand = options.runCommand ?? defaultRunCommand;
  const results: ReleaseGateResult[] = [];
  let stopAfterFailure = false;

  for (const gate of gates) {
    if (stopAfterFailure) {
      results.push({
        gateId: gate.gateId,
        title: gate.title,
        status: "skipped",
        command: formatCommand(gate.executable, gate.args),
        durationMs: 0,
        detail: "Skipped after an earlier release gate failed."
      });
      continue;
    }

    const result = runCommand(rootDir, gate);
    results.push(result);
    if (result.status === "failed") {
      stopAfterFailure = true;
    }
  }

  return results;
}
// DESIGN NOTE: The runner stops after the first failed gate to keep the first actionable regression visible and avoid redundant long-running work.

/**
 * Wrap an audit callback so failures become structured audit results.
 *
 * Args:
 *   auditId: Stable machine-readable audit identifier.
 *   title: User-facing audit title.
 *   audit: Callback that returns a success detail or throws on failure.
 *
 * Returns:
 *   Structured success or failure output for the audit.
 *
 * Raises:
 *   Never. Any thrown error is converted into a failed audit result.
 */
function executeAudit(auditId: string, title: string, audit: () => string): ReleaseAuditResult {
  try {
    return {
      auditId,
      title,
      status: "passed",
      detail: audit()
    };
  } catch (error) {
    return {
      auditId,
      title,
      status: "failed",
      detail: toErrorMessage(error)
    };
  }
}

/**
 * Verify required top-level release files exist.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *
 * Returns:
 *   Success detail describing the number of verified files.
 *
 * Raises:
 *   Error: If any required release file is missing.
 */
function auditRequiredFiles(rootDir: string): string {
  const missing = REQUIRED_TOP_LEVEL_FILES.filter(relativePath => !existsSync(path.join(rootDir, relativePath)));
  assertReleaseCondition(missing.length === 0, `Missing required release files: ${missing.join(", ")}`);
  return `Verified ${REQUIRED_TOP_LEVEL_FILES.length} required release files.`;
}

/**
 * Verify the README CLI section matches the supported help commands.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *
 * Returns:
 *   Success detail describing the synchronized command count.
 *
 * Raises:
 *   Error: If README commands drift from the canonical CLI help list.
 */
function auditReadmeCommands(rootDir: string): string {
  const readme = readRequiredText(rootDir, "README.md");
  const readmeCommands = parseReadmeCommands(readme);
  const helpCommands = getCliHelpCommands();
  const missing = helpCommands.filter(command => !readmeCommands.includes(command));
  const extra = readmeCommands.filter(command => !helpCommands.includes(command));

  assertReleaseCondition(readmeCommands.length > 0, "README.md is missing the CLI Commands section.");
  assertReleaseCondition(
    missing.length === 0 && extra.length === 0,
    buildDriftMessage("README CLI commands drifted from help output", missing, extra)
  );

  return `README CLI Commands matches ${helpCommands.length} supported commands.`;
}

/**
 * Verify example READMEs only reference supported CLI commands.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *
 * Returns:
 *   Success detail describing the number of example files scanned.
 *
 * Raises:
 *   Error: If an example README contains an unsupported CLI command.
 */
function auditExampleCommands(rootDir: string): string {
  const readmePaths = collectExampleReadmes(path.join(rootDir, "examples"), existsSync);
  const helpCommands = getCliHelpCommands();
  const invalid: string[] = [];

  for (const readmePath of readmePaths) {
    const commands = findInvalidExampleCommands(readRequiredText(rootDir, path.relative(rootDir, readmePath)), helpCommands);
    for (const command of commands) {
      invalid.push(`${path.relative(rootDir, readmePath)} -> ${command}`);
    }
  }

  assertReleaseCondition(invalid.length === 0, `Unsupported example CLI commands: ${invalid.join(", ")}`);
  return `Validated ${readmePaths.length} example README file(s).`;
}

/**
 * Verify package manifests remain aligned for publishing.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *
 * Returns:
 *   Success detail describing the number of package manifests checked.
 *
 * Raises:
 *   Error: If package versions, scope, or publish-file declarations drift.
 */
function auditPackageManifests(rootDir: string): string {
  const rootManifest = readJsonFile<{ version?: string }>(rootDir, "package.json");
  assertReleaseCondition(typeof rootManifest.version === "string" && rootManifest.version.length > 0, "Root package.json is missing a version.");

  const packageManifests = collectPackageManifests(rootDir);
  assertReleaseCondition(packageManifests.length > 0, "No package manifests were found under packages/.");

  const issues: string[] = [];
  for (const manifestPath of packageManifests) {
    const relativePath = path.relative(rootDir, manifestPath);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      version?: string;
      files?: unknown;
      main?: string;
      types?: string;
    };

    if (!manifest.name?.startsWith("@nareshdama/")) {
      issues.push(`${relativePath} has unscoped or invalid package name.`);
    }
    if (manifest.version !== rootManifest.version) {
      issues.push(`${relativePath} version ${manifest.version ?? "(missing)"} does not match root version ${rootManifest.version}.`);
    }
    if (!Array.isArray(manifest.files) || !manifest.files.includes("dist")) {
      issues.push(`${relativePath} must publish dist via the files field.`);
    }
    if (typeof manifest.main !== "string" || typeof manifest.types !== "string") {
      issues.push(`${relativePath} must define both main and types entrypoints.`);
    }
  }

  assertReleaseCondition(issues.length === 0, issues.join(" "));
  return `Validated ${packageManifests.length} package manifest(s) against release metadata rules.`;
}

/**
 * Execute a single release gate command.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *   gate: Gate command specification.
 *
 * Returns:
 *   Structured execution details including timing and failure context.
 *
 * Raises:
 *   Never. Spawn errors are folded into the returned result.
 */
function defaultRunCommand(rootDir: string, gate: ReleaseGateSpec): ReleaseGateResult {
  const tempDir = mkdtempSync(path.join(tmpdir(), "supercode-release-gate-"));
  const stdoutPath = path.join(tempDir, "stdout.log");
  const stderrPath = path.join(tempDir, "stderr.log");
  let stdoutFd: number | undefined;
  let stderrFd: number | undefined;
  const startedAt = Date.now();
  try {
    stdoutFd = openSync(stdoutPath, "w");
    stderrFd = openSync(stderrPath, "w");
    const result = spawnSync(gate.executable, gate.args, {
      cwd: rootDir,
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["ignore", stdoutFd, stderrFd]
    });
    const durationMs = Date.now() - startedAt;
    const detail = buildGateDetail(stdoutPath, stderrPath, result.error, result.status ?? undefined);
    const status: ReleaseStatus = result.error || (result.status ?? 1) !== 0 ? "failed" : "passed";

    return {
      gateId: gate.gateId,
      title: gate.title,
      status,
      command: formatCommand(gate.executable, gate.args),
      durationMs,
      detail,
      exitCode: result.status ?? undefined
    };
  } finally {
    if (stdoutFd !== undefined) {
      closeSync(stdoutFd);
    }
    if (stderrFd !== undefined) {
      closeSync(stderrFd);
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}
// DESIGN NOTE: `spawnSync` preserves gate ordering and makes failures deterministic for release workflows.

/**
 * Build the canonical ordered release gate command list.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   Ordered release gate command specifications mapped to the release checklist.
 *
 * Raises:
 *   Never.
 */
function listReleaseGateSpecs(): ReleaseGateSpec[] {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  return [
    { gateId: "clean", title: "Clean", executable: npmExecutable, args: ["run", "clean"] },
    { gateId: "build", title: "Build", executable: npmExecutable, args: ["run", "build"] },
    { gateId: "test", title: "Test", executable: npmExecutable, args: ["test"] },
    { gateId: "coverage-gate", title: "Coverage Gate", executable: npmExecutable, args: ["run", "coverage:gate"] },
    { gateId: "profile-baseline", title: "Profile Baseline", executable: npmExecutable, args: ["run", "profile:baseline"] },
    { gateId: "smoke-phase7", title: "Phase 7 Smoke", executable: npmExecutable, args: ["run", "smoke:phase7"] },
    { gateId: "verify-docs", title: "Verify Docs", executable: npmExecutable, args: ["run", "verify:docs"] }
  ];
}

/**
 * Count release result statuses.
 *
 * Args:
 *   results: Audit or gate results to summarize.
 *
 * Returns:
 *   Status counts keyed by release status.
 *
 * Raises:
 *   Never.
 */
function summarizeStatuses(results: Array<{ status: ReleaseStatus }>): Record<ReleaseStatus, number> {
  return results.reduce<Record<ReleaseStatus, number>>(
    (summary, result) => {
      summary[result.status] += 1;
      return summary;
    },
    { passed: 0, failed: 0, skipped: 0 }
  );
}

/**
 * Read a required text file relative to the release root.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *   relativePath: File path relative to the root directory.
 *
 * Returns:
 *   UTF-8 file contents.
 *
 * Raises:
 *   Error: If the target file is missing.
 */
function readRequiredText(rootDir: string, relativePath: string): string {
  const filePath = path.join(rootDir, relativePath);
  assertReleaseCondition(existsSync(filePath), `Missing required file: ${relativePath}`);
  return readFileSync(filePath, "utf8");
}

/**
 * Read and parse a required JSON file.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *   relativePath: File path relative to the root directory.
 *
 * Returns:
 *   Parsed JSON data.
 *
 * Raises:
 *   Error: If the file is missing or contains invalid JSON.
 */
function readJsonFile<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(readRequiredText(rootDir, relativePath)) as T;
}

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
/**
 * Collect package manifest paths from the monorepo packages directory.
 *
 * Args:
 *   rootDir: Canonical repository root.
 *
 * Returns:
 *   Absolute manifest paths for each package directory.
 *
 * Raises:
 *   Never.
 */
function collectPackageManifests(rootDir: string): string[] {
  const packagesDir = path.join(rootDir, "packages");
  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry): entry is import("node:fs").Dirent => entry.isDirectory())
    .map(entry => path.join(packagesDir, entry.name, "package.json"))
    .filter(filePath => existsSync(filePath));
}

/**
 * Build a drift message showing missing and extra command entries.
 *
 * Args:
 *   prefix: Introductory message describing the drift.
 *   missing: Expected entries that were not found.
 *   extra: Unexpected entries that were found.
 *
 * Returns:
 *   A single actionable error message.
 *
 * Raises:
 *   Never.
 */
function buildDriftMessage(prefix: string, missing: string[], extra: string[]): string {
  const parts = [prefix];
  if (missing.length > 0) {
    parts.push(`missing=${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    parts.push(`extra=${extra.join(", ")}`);
  }
  return parts.join("; ");
}

/**
 * Convert gate process output into a short diagnostic detail string.
 *
 * Args:
 *   stdout: Captured standard output.
 *   stderr: Captured standard error.
 *   error: Spawn error if one occurred.
 *
 * Returns:
 *   Compact diagnostic detail for human and machine review.
 *
 * Raises:
 *   Never.
 */
function buildGateDetail(
  stdoutPath: string,
  stderrPath: string,
  error: Error | undefined,
  exitCode: number | undefined
): string {
  if (error) {
    return error.message;
  }

  const preview = `${readOutputPreview(stdoutPath)}\n${readOutputPreview(stderrPath)}`.trim().replace(/\s+/g, " ");
  if (preview.length > 0) {
    return `${preview.slice(0, 240)}${preview.length > 240 ? "..." : ""}`;
  }

  return exitCode === 0 ? "Command completed without output." : `Command failed with exit code ${exitCode ?? "unknown"}.`;
}

/**
 * Format an executable and argument list as a shell-like command string.
 *
 * Args:
 *   executable: Command binary.
 *   args: Command arguments.
 *
 * Returns:
 *   Human-readable command line.
 *
 * Raises:
 *   Never.
 */
function formatCommand(executable: string, args: string[]): string {
  return [executable, ...args].join(" ");
}

/**
 * Read a bounded preview from a gate output file.
 *
 * Args:
 *   filePath: Output file to read.
 *
 * Returns:
 *   UTF-8 preview text up to the configured preview limit.
 *
 * Raises:
 *   Never.
 */
function readOutputPreview(filePath: string): string {
  if (!existsSync(filePath)) {
    return "";
  }

  const fd = openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(GATE_OUTPUT_PREVIEW_BYTES);
    const bytesRead = readSync(fd, buffer, 0, GATE_OUTPUT_PREVIEW_BYTES, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

/**
 * Convert arbitrary thrown values into a message string.
 *
 * Args:
 *   error: Unknown thrown value.
 *
 * Returns:
 *   Error message text.
 *
 * Raises:
 *   Never.
 */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Assert a release condition and throw a descriptive error when it fails.
 *
 * Args:
 *   condition: Predicate that must be true.
 *   message: Error message to throw when the predicate is false.
 *
 * Returns:
 *   Never returns a value.
 *
 * Raises:
 *   Error: If the condition is false.
 */
function assertReleaseCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
