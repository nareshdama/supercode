import test from "node:test";
import assert from "node:assert/strict";
import { formatCommand, resolveShellOption, runCommand } from "../lib/command-runner.mjs";

test("formatCommand joins command arguments for diagnostics", () => {
  assert.equal(formatCommand("npm.cmd", ["run", "build"]), "npm.cmd run build");
});

test("resolveShellOption honors explicit override and platform defaults", () => {
  assert.equal(resolveShellOption("npm.cmd", false), false);
  assert.equal(resolveShellOption("npm.cmd", true), true);
  assert.equal(resolveShellOption("npm.cmd"), process.platform === "win32");
  assert.equal(resolveShellOption("node"), false);
});

test("runCommand captures stdout and stderr through file-backed output", () => {
  const result = runCommand(
    process.execPath,
    ["-e", "console.log('captured stdout'); console.error('captured stderr');"],
    {
      cwd: process.cwd()
    }
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /captured stdout/);
  assert.match(result.stderr, /captured stderr/);
});

test("runCommand returns nonzero exit details when allowFailure is enabled", () => {
  const result = runCommand(
    process.execPath,
    ["-e", "console.error('expected failure'); process.exit(7);"],
    {
      cwd: process.cwd(),
      allowFailure: true
    }
  );

  assert.equal(result.exitCode, 7);
  assert.match(result.stderr, /expected failure/);
});

test("runCommand throws actionable diagnostics on command failure", () => {
  assert.throws(
    () =>
      runCommand(process.execPath, ["-e", "console.log('before fail'); console.error('failure path'); process.exit(3);"], {
        cwd: process.cwd()
      }),
    error => {
      assert.match(error.message, /Command failed:/);
      assert.match(error.message, /exitCode: 3/);
      assert.match(error.message, /before fail/);
      assert.match(error.message, /failure path/);
      return true;
    }
  );
});
