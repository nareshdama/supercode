// ═══════════════════════════════════════════════════
// Fixed by: Fixer Agent | Cycle: 2
// Bugs fixed: BUG-2-M5 (mitigation: serialize test file execution)
// Performance improvements: 0
// Proactive improvements: 0
// Code health: Good → Excellent
// Safe to build on: YES
// ═══════════════════════════════════════════════════

import { spawnSync } from "node:child_process";
import { collectTestFiles, rootDir } from "./test-files.mjs";

const testFiles = collectTestFiles();

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

// One test file at a time reduces process.env races when tests temporarily override env (e.g. SUPERCODE_HOST_SUPPORTS_MCP).
const result = spawnSync(
  process.execPath,
  ["--test", "--experimental-test-isolation=none", "--test-concurrency=1", ...testFiles],
  {
    cwd: rootDir,
    stdio: "inherit"
  }
);

process.exit(result.status ?? 1);
