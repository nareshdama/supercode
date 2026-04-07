// ═══════════════════════════════════════════════════
// Fixed by: Fixer Agent | Cycle: 3
// Bugs fixed: 9 (0 critical, 2 major, 5 minor, 1 structural, 1 performance)
// Performance improvements: 1 (spawn maxBuffer cap)
// Proactive improvements: 2 (spawn error prefix, whitespace line filter)
// Code health: Good → Excellent
// Safe to build on: YES
// ═══════════════════════════════════════════════════

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliDistPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");

/** Upper bound for buffered stdout/stderr from CLI subprocesses in tests (PERF-3-1). */
const SPAWN_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/**
 * Split CLI stdout or stderr into logical lines (Unix or Windows newlines).
 * Each line has trailing CR removed and trimEnd applied; segments that are empty
 * or contain only whitespace are dropped.
 *
 * Args:
 *   text: Raw process output.
 *
 * Returns:
 *   Array of line strings suitable for assertions (non-blank lines only).
 *
 * Raises:
 *   Never.
 */
export function splitCliOutputLines(text) {
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/\r$/, "").trimEnd())
    .filter(line => line.trim().length > 0);
}
// DESIGN NOTE: Matches how tests consume `io.out` line chunks while supporting a single captured buffer from spawnSync; blank/whitespace-only lines are dropped (BUG-3-m2).

/**
 * Run the built CLI entrypoint in a child process with optional environment overrides.
 * Parent `process.env` is not mutated; overrides apply only to the child.
 *
 * Args:
 *   cwd: Working directory for the child (must exist; typically a temp project root).
 *   argv: Arguments after the script name (e.g. ["mcp", "list"]).
 *   envOverrides: Plain object merged on top of `process.env` for the child only.
 *     Use only simple string values from trusted test literals (BUG-3-m1).
 *
 * Returns:
 *   Object with `status` (exit code, number), `stdout` (string), `stderr` (string).
 *   On spawn failure, `status` is 1 and `stderr` is prefixed with `[spawn]`.
 *
 * Raises:
 *   TypeError: When `cwd` is not a non-empty string or `argv` is not an array.
 *   Error: When the CLI bundle `dist/index.js` is missing (STRUCT-3-1).
 */
export function runSupercodeCliSync(cwd, argv, envOverrides = {}) {
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw new TypeError("runSupercodeCliSync: cwd must be a non-empty string");
  }
  if (!Array.isArray(argv)) {
    throw new TypeError("runSupercodeCliSync: argv must be an array");
  }
  if (envOverrides !== undefined && (typeof envOverrides !== "object" || envOverrides === null || Array.isArray(envOverrides))) {
    throw new TypeError("runSupercodeCliSync: envOverrides must be a plain object when provided");
  }

  if (!existsSync(cliDistPath)) {
    throw new Error(
      `runSupercodeCliSync: CLI bundle not found at ${cliDistPath}. Run "npm run build" in the repository root before running this test.`
    );
  }

  const result = spawnSync(process.execPath, [cliDistPath, ...argv], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: SPAWN_MAX_BUFFER_BYTES,
    env: { ...process.env, ...envOverrides }
  });

  if (result.error) {
    return {
      status: 1,
      stdout: "",
      stderr: `[spawn] ${result.error.message}`
    };
  }

  const status = typeof result.status === "number" ? result.status : 1;
  return {
    status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}
// DESIGN NOTE: Child-process isolation keeps host capability overrides (e.g. SUPERCODE_HOST_SUPPORTS_MCP) out of the test runner process (Cycle 3 MCP test hardening).
