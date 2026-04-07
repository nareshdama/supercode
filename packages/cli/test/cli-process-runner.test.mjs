// ═══════════════════════════════════════════════════
// Fixed by: Fixer Agent | Cycle: 3
// Bugs fixed: aligned with cli-process-runner.mjs (BUG-3-m5)
// Performance improvements: 0
// Proactive improvements: 1 (blank-line coverage)
// Code health: Good → Excellent
// Safe to build on: YES
// ═══════════════════════════════════════════════════

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runSupercodeCliSync, splitCliOutputLines } from "./cli-process-runner.mjs";

test("splitCliOutputLines handles empty and mixed newlines", () => {
  assert.deepEqual(splitCliOutputLines(""), []);
  assert.deepEqual(splitCliOutputLines("a\nb"), ["a", "b"]);
  assert.deepEqual(splitCliOutputLines("a\r\nb\r"), ["a", "b"]);
  assert.deepEqual(splitCliOutputLines("  x  \n"), ["  x"]);
  assert.deepEqual(splitCliOutputLines("a\n   \nb"), ["a", "b"]);
});

test("runSupercodeCliSync rejects invalid arguments", () => {
  assert.throws(() => runSupercodeCliSync("", ["help"]), /cwd/);
  assert.throws(() => runSupercodeCliSync("/tmp", "not-array"), /argv/);
  assert.throws(() => runSupercodeCliSync("/tmp", [], []), /envOverrides/);
});

test("runSupercodeCliSync runs help with zero status in temp cwd", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-proc-"));
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ name: "p", version: "1.0.0" }), "utf8");
  const r = runSupercodeCliSync(cwd, ["help"]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.length > 0);
});
