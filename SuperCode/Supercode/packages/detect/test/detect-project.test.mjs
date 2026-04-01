import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectHostCapabilities, detectInvocationContext, detectModelCapabilities, detectProjectProfile } from "../dist/index.js";

test("detectProjectProfile identifies a TypeScript npm project", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-detect-"));
  mkdirSync(path.join(cwd, "src"), { recursive: true });

  writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify(
      {
        name: "sample",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "node --test"
        },
        dependencies: {
          react: "^19.0.0"
        }
      },
      null,
      2
    )
  );
  writeFileSync(path.join(cwd, "tsconfig.json"), "{}\n");
  writeFileSync(path.join(cwd, "package-lock.json"), "{}\n");

  const profile = detectProjectProfile(cwd);

  assert.equal(profile.primaryLanguage, "typescript");
  assert.equal(profile.packageManager, "npm");
  assert.equal(profile.frameworks.includes("react"), true);
  assert.equal(profile.projectRoot, cwd);
});

test("detectInvocationContext treats npm exec as npx", () => {
  const invocation = detectInvocationContext({
    npm_execpath: "/usr/local/lib/node_modules/npm/bin/npm-cli.js",
    npm_command: "exec",
    npm_config_user_agent: "npm/11.10.0 node/v22.15.0"
  });

  assert.equal(invocation.launcher, "npx");
  assert.equal(invocation.packageManager, "npm");
});

test("detectProjectProfile resolves project root from nested directories", () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "supercode-detect-"));
  const nestedDir = path.join(projectRoot, "packages", "app", "src");
  mkdirSync(nestedDir, { recursive: true });

  writeFileSync(
    path.join(projectRoot, "package.json"),
    JSON.stringify(
      {
        name: "workspace-app",
        packageManager: "pnpm@10.0.0",
        dependencies: {
          next: "^15.0.0"
        }
      },
      null,
      2
    )
  );
  writeFileSync(path.join(projectRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(path.join(projectRoot, "tsconfig.json"), "{}\n");

  const profile = detectProjectProfile(nestedDir);

  assert.equal(profile.cwd, nestedDir);
  assert.equal(profile.projectRoot, projectRoot);
  assert.equal(profile.packageManager, "pnpm");
  assert.equal(profile.frameworks.includes("next"), true);
});

test("detectHostCapabilities and detectModelCapabilities respect explicit overrides safely", () => {
  const host = detectHostCapabilities({
    SUPERCODE_HOST: "cursor",
    SUPERCODE_HOST_SUPPORTS_TOOLS: "true"
  });
  const model = detectModelCapabilities({
    SUPERCODE_MODEL: "gpt-5-mini",
    SUPERCODE_MODEL_SUPPORTS_TOOLS: "false",
    SUPERCODE_MODEL_CONTEXT_WINDOW: "small",
    SUPERCODE_MODEL_REASONING: "fast"
  });

  assert.equal(host.hostId, "unknown");
  assert.equal(host.supportsTools, true);
  assert.equal(model.supportsTools, false);
  assert.equal(model.contextWindow, "small");
  assert.equal(model.reasoning, "fast");
  assert.equal(model.source, "explicit");
});

test("detectProjectProfile keeps isolated directories local when no project signals exist", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-isolated-"));

  const profile = detectProjectProfile(cwd);

  assert.equal(profile.cwd, cwd);
  assert.equal(profile.projectRoot, cwd);
  assert.equal(profile.primaryLanguage, "unknown");
  assert.equal(profile.packageManager, "unknown");
});
