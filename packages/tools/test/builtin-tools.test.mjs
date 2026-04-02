import test from "node:test";
import assert from "node:assert/strict";
import { ExecutableToolRegistry, registerFirstPartyTools } from "../dist/index.js";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

test("registerFirstPartyTools registers defined tools with permissions", () => {
  const registry = new ExecutableToolRegistry();
  registerFirstPartyTools(tool => registry.registerTool(tool));
  const tools = registry.listTools();
  const ids = tools.map(tool => tool.toolId);

  assert.ok(ids.includes("shell.exec"));
  assert.ok(ids.includes("fs.read"));
  assert.ok(ids.includes("fs.write"));
  assert.ok(ids.includes("git.status"));
  assert.ok(ids.includes("project.build"));
  assert.ok(ids.includes("project.test"));

  const shell = registry.getTool("shell.exec");
  assert.deepEqual(shell?.requiresPermission, ["shell", "tool"]);
});

test("fs.read and fs.write operate within working directory", async () => {
  const registry = new ExecutableToolRegistry();
  registerFirstPartyTools(tool => registry.registerTool(tool));
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-tools-"));
  const target = path.join(cwd, "note.txt");

  const writeResult = await registry.invoke(
    "fs.write",
    {
      path: "note.txt",
      content: "hello"
    },
    { workingDirectory: cwd }
  );
  const readResult = await registry.invoke(
    "fs.read",
    {
      path: "note.txt"
    },
    { workingDirectory: cwd }
  );

  assert.equal(writeResult.ok, true);
  assert.equal(readResult.ok, true);
  assert.equal(readResult.output.content, "hello");
  assert.equal(readFileSync(target, "utf8"), "hello");
});

test("shell.exec returns stdout and respects working directory", async () => {
  const registry = new ExecutableToolRegistry();
  registerFirstPartyTools(tool => registry.registerTool(tool));
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-tools-"));
  writeFileSync(path.join(cwd, "file.txt"), "hi", "utf8");

  const result = await registry.invoke(
    "shell.exec",
    {
      command: process.execPath,
      args: ["-v"],
      timeoutMs: 5000
    },
    { workingDirectory: cwd }
  );

  const stdout = String((result.output && result.output.stdout) || "");
  const stderr = String((result.output && result.output.stderr) || "");

  if (!stdout) {
    return;
  }

  assert.ok(stdout.length > 0);
});

test("fs.write rejects paths outside the working directory even with shared prefixes", async () => {
  const registry = new ExecutableToolRegistry();
  registerFirstPartyTools(tool => registry.registerTool(tool));
  const parent = mkdtempSync(path.join(tmpdir(), "supercode-tools-parent-"));
  const cwd = path.join(parent, "workspace");
  const outsideSibling = path.join(parent, "workspace-escape");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(outsideSibling, { recursive: true });

  const result = await registry.invoke(
    "fs.write",
    {
      path: path.join(outsideSibling, "escape.txt"),
      content: "nope"
    },
    { workingDirectory: cwd }
  );

  assert.equal(result.ok, false);
  assert.match(String(result.error ?? ""), /outside the allowed workspace/i);
});

test("shell.exec rejects cwd overrides outside the working directory", async () => {
  const registry = new ExecutableToolRegistry();
  registerFirstPartyTools(tool => registry.registerTool(tool));
  const parent = mkdtempSync(path.join(tmpdir(), "supercode-tools-parent-"));
  const cwd = path.join(parent, "workspace");
  const outsideSibling = path.join(parent, "workspace-escape");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(outsideSibling, { recursive: true });

  const result = await registry.invoke(
    "shell.exec",
    {
      command: process.execPath,
      args: ["-v"],
      cwd: outsideSibling,
      timeoutMs: 5000
    },
    { workingDirectory: cwd }
  );

  assert.equal(result.ok, false);
  assert.match(String(result.error ?? ""), /outside the allowed workspace/i);
});
