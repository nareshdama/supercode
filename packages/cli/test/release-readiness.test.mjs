import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../dist/index.js";
import { getCliHelpCommands } from "../dist/help.js";
import { runReleaseReadiness } from "../dist/release-readiness.js";

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function createReleaseFixture() {
  const rootDir = mkdtempSync(path.join(tmpdir(), "supercode-release-"));
  const helpCommands = getCliHelpCommands();
  const readme = [
    "# Fixture",
    "",
    "## CLI Commands",
    ...helpCommands.map(command => `- \`${command}\``),
    "",
    "## Usage",
    "```bash",
    "npx @nareshdama/supercode init",
    "supercode doctor",
    "```",
    ""
  ].join("\n");

  writeJson(path.join(rootDir, "package.json"), {
    name: "fixture-root",
    version: "0.1.0",
    private: true
  });
  writeText(path.join(rootDir, "README.md"), readme);
  writeText(path.join(rootDir, "STATUS.md"), "# Status\n");
  writeText(path.join(rootDir, "ROADMAP.md"), "# Roadmap\n");
  writeText(path.join(rootDir, "PROJECT-SCOPE.md"), "# Scope\n");
  writeText(path.join(rootDir, "CONTRIBUTING.md"), "# Contributing\n");
  writeText(path.join(rootDir, "DEVELOPING.md"), "# Developing\n");
  writeText(path.join(rootDir, "RELEASE-CHECKLIST.md"), "# Release Checklist\n");
  writeText(path.join(rootDir, "SECURITY-REVIEW.md"), "# Security Review\n");
  writeText(path.join(rootDir, "PERFORMANCE-BASELINE.md"), "# Performance Baseline\n");
  writeText(path.join(rootDir, "examples", "README.md"), "# Examples\n\n```bash\nsupercode run fix build\n```\n");
  writeText(path.join(rootDir, "examples", "minimal-runtime", "README.md"), "# Minimal\n\n```bash\nsupercode model status\n```\n");
  writeJson(path.join(rootDir, "packages", "core", "package.json"), {
    name: "@nareshdama/core",
    version: "0.1.0",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    files: ["dist"]
  });
  writeJson(path.join(rootDir, "packages", "cli", "package.json"), {
    name: "@nareshdama/supercode",
    version: "0.1.0",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    files: ["dist"]
  });

  return rootDir;
}

test("runCli release check --json --skip-gates reports a passing static audit", async () => {
  const rootDir = createReleaseFixture();
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(rootDir);
  try {
    const code = await runCli(["release", "check", "--json", "--skip-gates"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.equal(out.length, 1);

    const report = JSON.parse(out[0]);
    assert.equal(report.status, "passed");
    assert.equal(report.summary.audits.passed, 4);
    assert.equal(report.summary.gates.skipped, 7);
    assert.equal(report.rootDir, rootDir);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runReleaseReadiness resolves the repo root and skips later gates after a failure", () => {
  const rootDir = createReleaseFixture();
  const nestedDir = path.join(rootDir, "packages", "core", "src");
  mkdirSync(nestedDir, { recursive: true });
  const calls = [];

  const report = runReleaseReadiness(nestedDir, {
    runCommand: (_resolvedRootDir, gate) => {
      calls.push(gate.gateId);
      if (gate.gateId === "build") {
        return {
          gateId: gate.gateId,
          title: gate.title,
          status: "failed",
          command: `${gate.executable} ${gate.args.join(" ")}`,
          durationMs: 15,
          detail: "build failed",
          exitCode: 1
        };
      }

      return {
        gateId: gate.gateId,
        title: gate.title,
        status: "passed",
        command: `${gate.executable} ${gate.args.join(" ")}`,
        durationMs: 10,
        detail: "ok",
        exitCode: 0
      };
    }
  });

  assert.equal(report.rootDir, rootDir);
  assert.deepEqual(calls, ["clean", "build"]);
  assert.equal(report.status, "failed");
  assert.equal(report.summary.gates.passed, 1);
  assert.equal(report.summary.gates.failed, 1);
  assert.equal(report.summary.gates.skipped, 5);
  assert.equal(report.gates.find(gate => gate.gateId === "test")?.status, "skipped");
});

test("runReleaseReadiness fails when an example README contains an unsupported supercode command", () => {
  const rootDir = createReleaseFixture();
  writeText(
    path.join(rootDir, "examples", "README.md"),
    "# Examples\n\n```bash\nsupercode definitely-not-a-command\n```\n"
  );

  const report = runReleaseReadiness(rootDir, {
    runGates: false
  });

  assert.equal(report.status, "failed");
  const exampleAudit = report.audits.find(audit => audit.auditId === "example-cli-sync");
  assert.ok(exampleAudit);
  assert.equal(exampleAudit.status, "failed");
  assert.match(exampleAudit.detail, /definitely-not-a-command/);
});
