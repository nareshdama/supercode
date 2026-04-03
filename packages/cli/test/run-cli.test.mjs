import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { runCli } from "../dist/index.js";

test("runCli init writes Supercode state for a new project", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    const code = await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(existsSync(path.join(cwd, ".supercode", "config.json")), true);
    assert.equal(existsSync(path.join(cwd, "package.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "packs.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "session.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "tasks")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "progress")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "extensions", "manifest.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "extensions", "local", "hooks.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "extensions", "local", "hooks.example.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "extensions", "plugins", "README.md")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "extensions", "plugins", "plugin.example.json")), true);
    assert.equal(existsSync(path.join(cwd, ".supercode", "WORKFLOW.md")), true);
    assert.equal(existsSync(path.join(cwd, "README.md")), true);

    const config = JSON.parse(readFileSync(path.join(cwd, ".supercode", "config.json"), "utf8"));
    const snapshot = JSON.parse(readFileSync(path.join(cwd, ".supercode", "profile.snapshot.json"), "utf8"));
    const packState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "packs.json"), "utf8"));
    const extensionState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "extensions", "manifest.json"), "utf8"));
    const hookManifest = JSON.parse(readFileSync(path.join(cwd, ".supercode", "extensions", "local", "hooks.json"), "utf8"));
    const hookExample = JSON.parse(readFileSync(path.join(cwd, ".supercode", "extensions", "local", "hooks.example.json"), "utf8"));
    const pluginExample = JSON.parse(readFileSync(path.join(cwd, ".supercode", "extensions", "plugins", "plugin.example.json"), "utf8"));
    const stateReadme = readFileSync(path.join(cwd, ".supercode", "README.md"), "utf8");
    const workflowGuide = readFileSync(path.join(cwd, ".supercode", "WORKFLOW.md"), "utf8");
    const projectReadme = readFileSync(path.join(cwd, "README.md"), "utf8");
    assert.ok(Array.isArray(config.selectedPackIds));
    assert.equal(config.version, 1);
    assert.equal(typeof config.createdAt, "string");
    assert.equal(config.memory.enabled, false);
    assert.equal(config.memory.provider, "local");
    assert.equal(config.artifacts.maxEntries, 50);
    assert.equal(config.artifacts.maxTotalBytes, 5000000);
    assert.equal(config.artifacts.maxArtifactBytes, 1000000);
    assert.equal(snapshot.version, 1);
    assert.deepEqual(config.selectedPackIds, ["core", "typescript"]);
    assert.deepEqual(snapshot.executionProfile.recommendedPackIds, ["core", "typescript"]);
    assert.deepEqual(packState.installedPackIds, ["core", "typescript"]);
    assert.deepEqual(
      extensionState.packs.map(pack => pack.packId),
      ["core", "typescript"]
    );
    assert.equal(extensionState.skills.length, 5);
    assert.equal(extensionState.rules.length, 5);
    assert.deepEqual(hookManifest, { version: 1, hooks: [] });
    assert.equal(hookExample.version, 1);
    assert.equal(pluginExample.version, 1);
    assert.equal(Array.isArray(pluginExample.commands), true);
    assert.equal(
      existsSync(path.join(cwd, ".supercode", "extensions", "generated", "skills", "typescript--ts-build-fix.md")),
      true
    );
    assert.match(stateReadme, /Primary language: typescript/i);
    assert.match(workflowGuide, /Local Workflow Guide/);
    assert.match(projectReadme, /editor-neutral starter template/i);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Initialized Supercode")));
    assert.ok(out.some(line => line.includes("Extensions: packs=2 skills=5 rules=5 plugins=0")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli doctor --json reports machine-readable state", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;

    const code = await runCli(["doctor", "--json"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.equal(out.length, 1);

    const report = JSON.parse(out[0]);
    assert.equal(report.version, 1);
    assert.ok(Array.isArray(report.availablePacks));
    assert.ok(Array.isArray(report.installedPacks.installedPackIds));
    assert.ok(report.workflowRecommendation.recommendedPackIds.includes("core"));
    assert.equal(report.mcp.configSource, "none");
    assert.equal(report.mcp.serverCount, 0);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli init --force refreshes Supercode-managed state without overwriting project files", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(path.join(cwd, ".supercode", "config.json"), '{"version":999}\n');
    writeFileSync(path.join(cwd, "src", "index.ts"), 'console.log("keep me");\n');
    writeFileSync(path.join(cwd, "README.md"), "# Keep me\n", "utf8");

    out.length = 0;
    err.length = 0;

    const code = await runCli(["init", "--force"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const config = JSON.parse(readFileSync(path.join(cwd, ".supercode", "config.json"), "utf8"));
    const sourceFile = readFileSync(path.join(cwd, "src", "index.ts"), "utf8");
    const projectReadme = readFileSync(path.join(cwd, "README.md"), "utf8");

    assert.equal(code, 0);
    assert.equal(config.version, 1);
    assert.deepEqual(config.selectedPackIds, ["core", "typescript"]);
    assert.equal(sourceFile, 'console.log("keep me");\n');
    assert.equal(projectReadme, "# Keep me\n");
    assert.equal(err.length, 0);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli pack uninstall removes optional packs and preserves core", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    await runCli(["pack", "install", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["pack", "uninstall", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);

    const packState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "packs.json"), "utf8"));
    const extensionState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "extensions", "manifest.json"), "utf8"));
    assert.deepEqual(packState.installedPackIds, ["core"]);
    assert.deepEqual(
      extensionState.packs.map(pack => pack.packId),
      ["core"]
    );
    assert.equal(
      existsSync(path.join(cwd, ".supercode", "extensions", "generated", "skills", "typescript--ts-build-fix.md")),
      false
    );
    assert.ok(out.some(line => line.includes("Uninstalled pack typescript")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli pack recommend --apply reinstalls recommended packs", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    await runCli(["pack", "uninstall", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["pack", "recommend", "--apply"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Applied recommended packs. Installed set: core, typescript")));

    const packState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "packs.json"), "utf8"));
    assert.deepEqual(packState.installedPackIds, ["core", "typescript"]);
    assert.equal(
      existsSync(path.join(cwd, ".supercode", "extensions", "generated", "skills", "typescript--ts-build-fix.md")),
      true
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli pack sync repairs drift between packs state and generated extensions", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(
      path.join(cwd, ".supercode", "packs.json"),
      `${JSON.stringify(
        {
          version: 1,
          installedPackIds: ["core", "unknown-pack"],
          updatedAt: new Date().toISOString()
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["pack", "sync"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Synced pack state. Installed set: core")));

    const packState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "packs.json"), "utf8"));
    const extensionState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "extensions", "manifest.json"), "utf8"));
    assert.deepEqual(packState.installedPackIds, ["core"]);
    assert.deepEqual(extensionState.packs.map(pack => pack.packId), ["core"]);
    assert.equal(
      existsSync(path.join(cwd, ".supercode", "extensions", "generated", "skills", "typescript--ts-build-fix.md")),
      false
    );
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli extension list reports generated workflow baseline", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["extension", "list"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Extensions: packs=2 skills=5 rules=5 plugins=0")));
    assert.ok(out.some(line => line.includes("core [core]: skills=3, rules=3")));
    assert.ok(out.some(line => line.includes("typescript [optional]: skills=2, rules=2")));
    assert.ok(out.some(line => line.includes("Plugins: 0")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli extension validate reports clean state for scaffolded project", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["extension", "validate"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Extension validation passed.")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli extension validate reports invalid plugin tool references", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "broken"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "broken", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "broken",
          title: "Broken Plugin",
          description: "Contains invalid references.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [
            {
              toolId: "bad-tool",
              title: "Bad Tool",
              description: "Bad target.",
              enabled: true,
              targetToolId: "unknown.runtime.tool"
            }
          ],
          hooks: [
            {
              hookId: "bad-hook",
              title: "Bad Hook",
              event: "run.before",
              toolId: "missing-hook-tool",
              enabled: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["extension", "validate"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 1);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Extension validation: errors=2 warnings=0")));
    assert.ok(out.some(line => line.includes("unknown runtime tool")));
    assert.ok(out.some(line => line.includes("references unknown tool")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli extension validate reports plugin tool cycles", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "cycle"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "cycle", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "cycle",
          title: "Cycle Plugin",
          description: "Contains plugin tool cycles.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [
            {
              toolId: "first",
              title: "First Tool",
              description: "Targets the second local plugin tool.",
              enabled: true,
              targetToolId: "second"
            },
            {
              toolId: "second",
              title: "Second Tool",
              description: "Targets the first local plugin tool.",
              enabled: true,
              targetToolId: "first"
            }
          ],
          hooks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["extension", "validate"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 1);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Extension validation: errors=1 warnings=0")));
    assert.ok(out.some(line => line.includes("Plugin tool cycle detected")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli plugin list reports discovered local plugins", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "audit"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "audit", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "audit",
          title: "Audit Plugin",
          description: "Adds audit hooks.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [],
          hooks: [
            {
              hookId: "plugin-audit-hook",
              title: "Audit hook",
              event: "run.before",
              toolId: "fs.write",
              enabled: true,
              input: {
                path: ".supercode/plugin-audit.txt",
                content: "plugin audit"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["plugin", "list"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("audit [enabled]: skills=0, rules=0, tools=0, runSteps=0, commands=0, hooks=1")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli run executes local workflow hooks through the tool registry", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "local", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: [
            {
              hookId: "write-run-before",
              title: "Write before-run marker",
              event: "run.before",
              toolId: "fs.write",
              enabled: true,
              input: {
                path: ".supercode/run-before.txt",
                content: "before {{event.task}} {{event.taskId}}"
              }
            },
            {
              hookId: "write-run-after",
              title: "Write after-run marker",
              event: "run.after",
              toolId: "fs.write",
              enabled: true,
              input: {
                path: ".supercode/run-after.txt",
                content: "after {{event.resultRef}} success={{event.success}}"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "capture", "hook", "execution"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Hooks run.before: completed=1 blocked=0 failed=0 halted=no")));
    assert.ok(out.some(line => line.includes("Hooks run.after: completed=1 blocked=0 failed=0 halted=no")));
    assert.ok(out.some(line => line.includes("hook write-run-before [completed] policy=continue source=local tool=fs.write")));
    assert.ok(out.some(line => line.includes("hook write-run-after [completed] policy=continue source=local tool=fs.write")));

    const beforeContent = readFileSync(path.join(cwd, ".supercode", "run-before.txt"), "utf8");
    const afterContent = readFileSync(path.join(cwd, ".supercode", "run-after.txt"), "utf8");
    assert.match(beforeContent, /before capture hook execution/);
    assert.match(afterContent, /after .+ success=true/);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli run aborts when a before hook fails with abort policy", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "local", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: [
            {
              hookId: "abort-missing-read",
              title: "Abort on missing file",
              event: "run.before",
              toolId: "fs.read",
              enabled: true,
              onFailure: "abort",
              input: {
                path: ".supercode/does-not-exist.txt"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "abort", "before", "hook"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 1);
    assert.ok(out.some(line => line.includes("Hooks run.before: completed=0 blocked=0 failed=1 halted=yes")));
    assert.ok(out.some(line => line.includes("hook abort-missing-read [failed] policy=abort source=local tool=fs.read")));
    assert.ok(err.some(line => line.includes("requested abort")));
    assert.equal(out.some(line => line.startsWith("Completed task ")), false);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli local hooks override plugin hooks with the same hookId", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "audit"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "audit", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "audit",
          title: "Audit Plugin",
          description: "Adds audit hooks.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [],
          hooks: [
            {
              hookId: "shared-hook",
              title: "Plugin shared hook",
              event: "run.before",
              toolId: "fs.write",
              enabled: true,
              input: {
                path: ".supercode/hook-precedence.txt",
                content: "plugin version"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "local", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: [
            {
              hookId: "shared-hook",
              title: "Local shared hook",
              event: "run.before",
              toolId: "fs.write",
              enabled: true,
              input: {
                path: ".supercode/hook-precedence.txt",
                content: "local version"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "check", "hook", "precedence"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    const content = readFileSync(path.join(cwd, ".supercode", "hook-precedence.txt"), "utf8");
    assert.equal(content, "local version");
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli plugin assets participate in workflow matching and search", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "release"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "release", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "release",
          title: "Release Plugin",
          description: "Adds release skills and rules.",
          enabled: true,
          skills: [
            {
              skillId: "release-checklist",
              title: "Release Checklist",
              summary: "Prepare a release checklist for package publishing.",
              tags: ["release", "publishing"],
              triggers: ["release prep"],
              instructions: ["Verify package metadata before release."],
              provenance: "plugin:release"
            }
          ],
          rules: [
            {
              ruleId: "require-release-notes",
              title: "Require Release Notes",
              summary: "Document release notes for package changes.",
              severity: "warning",
              appliesTo: ["release"],
              guidance: ["Write concise release notes before publish."],
              provenance: "plugin:release"
            }
          ],
          tools: [],
          hooks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const searchCode = await runCli(["skill", "search", "release", "checklist"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(searchCode, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("release-checklist:")));

    out.length = 0;
    err.length = 0;

    const runCode = await runCli(["run", "prepare", "release", "checklist", "for", "package", "publishing"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(runCode, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Release Checklist [")));
    assert.ok(out.some(line => line.includes("<plugin:release>")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli run executes matched plugin run steps inside the persisted plan", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "release"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "release", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "release",
          title: "Release Plugin",
          description: "Adds release run steps.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [
            {
              toolId: "write-release-marker",
              title: "Write Release Marker",
              description: "Write a marker for release planning.",
              enabled: true,
              targetToolId: "fs.write",
              input: {
                path: ".supercode/release-run-step.txt",
                content: "release run step executed"
              }
            }
          ],
          runSteps: [
            {
              stepId: "prepare-release-marker",
              title: "Prepare Release Marker",
              description: "Write the release marker before default steps.",
              toolId: "write-release-marker",
              enabled: true,
              placement: "before-defaults",
              whenTaskIncludes: ["release"]
            }
          ],
          hooks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "prepare", "release", "notes"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const startedTaskLine = out.find(line => line.startsWith("Started task "));
    const taskId = startedTaskLine?.replace("Started task ", "").trim();

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(taskId);
    assert.ok(out.some(line => line.includes("Plugin run steps: Prepare Release Marker <plugin:release> [before-defaults]")));
    assert.equal(readFileSync(path.join(cwd, ".supercode", "release-run-step.txt"), "utf8"), "release run step executed");

    const storedPlan = JSON.parse(readFileSync(path.join(cwd, ".supercode", "plans", `${taskId}.json`), "utf8"));
    assert.equal(storedPlan.plan.steps[0].title, "Prepare Release Marker");
    assert.equal(storedPlan.plan.steps[0].toolId, "plugin.release.write-release-marker");
    assert.equal(storedPlan.plan.metadata.pluginRunStepIds[0], "release:prepare-release-marker");
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli executes plugin top-level commands through the runtime tool registry", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "release"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "release", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "release",
          title: "Release Plugin",
          description: "Adds plugin commands.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [
            {
              toolId: "write-command-marker",
              title: "Write Command Marker",
              description: "Write a marker file for plugin commands.",
              enabled: true,
              targetToolId: "fs.write"
            }
          ],
          runSteps: [],
          commands: [
            {
              commandId: "release-notes",
              commandName: "release-notes",
              title: "Release Notes",
              description: "Create a release notes marker.",
              toolId: "write-command-marker",
              enabled: true,
              argsMode: "text",
              input: {
                path: ".supercode/release-command.txt"
              }
            }
          ],
          hooks: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["release-notes", "ship", "v1.2.3"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Plugin command: release-notes <plugin:release>")));
    assert.equal(readFileSync(path.join(cwd, ".supercode", "release-command.txt"), "utf8"), "ship v1.2.3");

    out.length = 0;
    err.length = 0;

    const listCode = await runCli(["plugin", "list"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(listCode, 0);
    assert.ok(out.some(line => line.includes("release [enabled]: skills=0, rules=0, tools=1, runSteps=0, commands=1, hooks=0")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli plugin hooks can invoke composed plugin-defined tools", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "audit"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "audit", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "audit",
          title: "Audit Plugin",
          description: "Adds plugin tools.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [
            {
              toolId: "write-audit-marker",
              title: "Write Audit Marker",
              description: "Write an audit marker file.",
              enabled: true,
              targetToolId: "fs.write",
              input: {
                path: ".supercode/plugin-tool-marker.txt",
                content: "plugin tool executed"
              }
            },
            {
              toolId: "write-audit-wrapper",
              title: "Write Audit Wrapper",
              description: "Compose the marker tool with a local plugin target.",
              enabled: true,
              targetToolId: "write-audit-marker"
            }
          ],
          hooks: [
            {
              hookId: "invoke-plugin-tool",
              title: "Invoke plugin tool",
              event: "run.before",
              toolId: "write-audit-wrapper",
              enabled: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "exercise", "plugin", "tool"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Hooks run.before: completed=1 blocked=0 failed=0 halted=no")));
    const marker = readFileSync(path.join(cwd, ".supercode", "plugin-tool-marker.txt"), "utf8");
    assert.equal(marker, "plugin tool executed");
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli plugin tool cycles fail safely during hook execution", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    mkdirSync(path.join(cwd, ".supercode", "extensions", "plugins", "cycle"), { recursive: true });
    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "plugins", "cycle", "plugin.json"),
      `${JSON.stringify(
        {
          version: 1,
          pluginId: "cycle",
          title: "Cycle Plugin",
          description: "Contains plugin tool cycles.",
          enabled: true,
          skills: [],
          rules: [],
          tools: [
            {
              toolId: "first",
              title: "First Tool",
              description: "Targets the second plugin tool.",
              enabled: true,
              targetToolId: "second"
            },
            {
              toolId: "second",
              title: "Second Tool",
              description: "Targets the first plugin tool.",
              enabled: true,
              targetToolId: "first"
            }
          ],
          hooks: [
            {
              hookId: "invoke-cycle",
              title: "Invoke Cycle",
              event: "run.before",
              toolId: "first",
              enabled: true
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "exercise", "cycle", "plugin", "tool"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Hooks run.before: completed=0 blocked=0 failed=1 halted=no")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli pack install executes local pack hooks", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    await runCli(["pack", "uninstall", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "local", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: [
            {
              hookId: "write-pack-install",
              title: "Write pack install marker",
              event: "pack.install.after",
              toolId: "fs.write",
              enabled: true,
              input: {
                path: ".supercode/pack-install.txt",
                content: "installed {{event.packId}} {{event.installedPackIds}}"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["pack", "install", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Hooks pack.install.after: completed=1 blocked=0 failed=0 halted=no")));
    const installContent = readFileSync(path.join(cwd, ".supercode", "pack-install.txt"), "utf8");
    assert.match(installContent, /installed typescript/);
    assert.match(installContent, /core/);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli pack install returns nonzero when an after hook fails with abort policy", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    await runCli(["pack", "uninstall", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(
      path.join(cwd, ".supercode", "extensions", "local", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: [
            {
              hookId: "abort-pack-install",
              title: "Abort after pack install",
              event: "pack.install.after",
              toolId: "fs.read",
              enabled: true,
              onFailure: "abort",
              input: {
                path: ".supercode/missing-after-install.txt"
              }
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    out.length = 0;
    err.length = 0;

    const code = await runCli(["pack", "install", "typescript"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 1);
    assert.ok(out.some(line => line.includes("Installed pack typescript.")));
    assert.ok(out.some(line => line.includes("Hooks pack.install.after: completed=0 blocked=0 failed=1 halted=yes")));
    assert.ok(err.some(line => line.includes("requested abort")));

    const packState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "packs.json"), "utf8"));
    assert.deepEqual(packState.installedPackIds, ["core", "typescript"]);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli task commands persist runtime tasks across invocations", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const startCode = await runCli(["task", "start", "Implement", "state", "runtime"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });
    const startedTaskLine = out.find(line => line.startsWith("Started task "));
    const taskId = startedTaskLine?.replace("Started task ", "").trim();

    assert.equal(startCode, 0);
    assert.ok(taskId);

    out.length = 0;
    err.length = 0;

    const listCode = await runCli(["task", "list"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(listCode, 0);
    assert.ok(out.some(line => line.includes(taskId)));

    out.length = 0;
    err.length = 0;

    const showCode = await runCli(["task", "show", taskId], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(showCode, 0);
    assert.ok(out.some(line => line.includes("Goal: Implement state runtime")));
    assert.ok(out.some(line => line.includes("Status: running")));

    out.length = 0;
    err.length = 0;

    const cancelCode = await runCli(["task", "cancel", taskId], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(cancelCode, 0);
    assert.ok(out.some(line => line.includes("Cancelled task")));

    out.length = 0;
    err.length = 0;

    const sessionCode = await runCli(["session", "show"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });
    const permissionCode = await runCli(["permission", "show"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(sessionCode, 0);
    assert.equal(permissionCode, 0);
    assert.ok(out.some(line => line.includes("Active tasks: (none)")));
    assert.ok(out.some(line => line.includes("Permissions:")));
    assert.equal(err.length, 0);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli run reports ranked workflow matches", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "fix", "TypeScript", "build", "errors", "and", "package", "exports"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const startedTaskLine = out.find(line => line.startsWith("Started task "));
    const completedTaskLine = out.find(line => line.startsWith("Completed task "));
    const resultLine = out.find(line => line.startsWith("Saved result "));
    const matchedSkillsLine = out.find(line => line.startsWith("Matched skills:"));
    const matchedRulesLine = out.find(line => line.startsWith("Matched rules:"));
    const mcpLine = out.find(line => line.startsWith("MCP:"));
    const taskId = startedTaskLine?.replace("Started task ", "").trim();
    const completedTaskId = completedTaskLine?.replace("Completed task ", "").trim();
    const resultRef = resultLine?.replace("Saved result ", "").trim();

    assert.equal(code, 0);
    assert.equal(err.length, 0);
    assert.ok(taskId);
    assert.equal(taskId, completedTaskId);
    assert.ok(resultRef);

    const persistedTask = JSON.parse(readFileSync(path.join(cwd, ".supercode", "tasks", `${taskId}.json`), "utf8"));
    const persistedResult = JSON.parse(readFileSync(path.join(cwd, ".supercode", "results", `${resultRef}.json`), "utf8"));

    assert.equal(persistedTask.task.status, "completed");
    assert.equal(persistedTask.task.result.outputRef, resultRef);
    assert.equal(persistedResult.toolId, "workflow.match");
    assert.match(mcpLine ?? "", /MCP: available=/);
    assert.match(matchedSkillsLine ?? "", /TypeScript Build Fix \[\d+\]/);
    assert.match(matchedRulesLine ?? "", /Ship Types and Exports \[\d+\]/);

    out.length = 0;

    const showCode = await runCli(["task", "show", taskId], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(showCode, 0);
    assert.ok(out.some(line => line.includes("Status: completed")));
    assert.ok(out.some(line => line.includes(`Output ref: ${resultRef}`)));
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli memory commands capture and reuse task memory when enabled", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const configPath = path.join(cwd, ".supercode", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.memory.enabled = true;
    config.memory.attachLimit = 5;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    out.length = 0;
    err.length = 0;

    const firstRun = await runCli(["run", "capture", "memory", "for", "runtime", "tasks"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(firstRun, 0);
    assert.ok(out.some(line => line.includes("Memory: enabled, attached=0")));

    const memoryFiles = readdirSync(path.join(cwd, ".supercode", "memory")).filter(name => name.endsWith(".json"));
    assert.ok(memoryFiles.length >= 3);

    out.length = 0;
    err.length = 0;

    const listCode = await runCli(["memory", "list", "runtime", "tasks"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(listCode, 0);
    assert.ok(out.length > 0);
    const firstMemoryRef = out[0].split(":")[0];
    assert.ok(firstMemoryRef);

    out.length = 0;
    err.length = 0;

    const secondRun = await runCli(["run", "capture", "memory", "for", "runtime", "tasks"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(secondRun, 0);
    assert.ok(out.some(line => /^Memory: enabled, attached=[1-9]/.test(line)));

    out.length = 0;
    err.length = 0;

    const showCode = await runCli(["memory", "show", firstMemoryRef], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(showCode, 0);
    assert.ok(out.some(line => line.startsWith("Summary: ")));
    assert.ok(out.some(line => line.startsWith("Content: ")));
  } finally {
    process.chdir(previousCwd);
  }
});

test("SimpleTaskExecutor is available in runtime context", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const state = (await import("../dist/runtime.js")).createPersistedRuntimeContext(
      cwd,
      (await import("@nareshdama/core")).createExecutionProfile({
        ... (await import("@nareshdama/detect")).detectRuntimeInputs(cwd, process.env),
        workflowRecommendation: (await import("@nareshdama/workflows")).recommendWorkflowPacks(
          (await import("@nareshdama/detect")).detectProjectProfile(cwd),
          (await import("@nareshdama/detect")).detectHostCapabilities(process.env),
          (await import("@nareshdama/detect")).detectModelCapabilities(process.env)
        )
      })
    );

    assert.ok(state.executor);
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli mcp commands list and invoke builtin runtime servers", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    writeFileSync(
      path.join(cwd, ".mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: {
              transport: "builtin",
              trust: "trusted",
              timeoutMs: 40,
              retryCount: 1
            }
          }
        },
        null,
        2
      )
    );

    out.length = 0;
    err.length = 0;

    const listCode = await runCli(["mcp", "list"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(listCode, 0);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("MCP: available=true configured=true")));
    assert.ok(out.some(line => line.includes("local [builtin]")));

    out.length = 0;
    err.length = 0;

    const invokeCode = await runCli(["mcp", "invoke", "local", "echo", '{"message":"hello"}'], {
      out: message => out.push(message),
      err: message => err.push(message)
    });
    const startedTaskLine = out.find(line => line.startsWith("Started task "));
    const completedTaskLine = out.find(line => line.startsWith("Completed task "));
    const resultLine = out.find(line => line.startsWith("Saved result "));
    const responseLine = out.find(line => line.startsWith("Response: "));
    const taskId = startedTaskLine?.replace("Started task ", "").trim();
    const completedTaskId = completedTaskLine?.replace("Completed task ", "").trim();
    const resultRef = resultLine?.replace("Saved result ", "").trim();

    assert.equal(invokeCode, 0);
    assert.equal(err.length, 0);
    assert.ok(taskId);
    assert.equal(taskId, completedTaskId);
    assert.ok(resultRef);
    assert.match(responseLine ?? "", /"message":"hello"/);

    const persistedTask = JSON.parse(readFileSync(path.join(cwd, ".supercode", "tasks", `${taskId}.json`), "utf8"));
    const persistedResult = JSON.parse(readFileSync(path.join(cwd, ".supercode", "results", `${resultRef}.json`), "utf8"));

    assert.equal(persistedTask.task.status, "completed");
    assert.equal(persistedTask.task.result.outputRef, resultRef);
    assert.equal(persistedResult.toolId, "mcp.invoke");
    assert.equal(persistedResult.data.ok, true);
  } finally {
    process.chdir(previousCwd);
  }
});

// --- M3: Plan persistence during run ---

test("runCli run persists an execution plan for retry/resume", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["run", "fix", "TypeScript", "build"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);

    const startedTaskLine = out.find(line => line.startsWith("Started task "));
    const taskId = startedTaskLine?.replace("Started task ", "").trim();
    assert.ok(taskId);

    // Plan should be persisted.
    const planPath = path.join(cwd, ".supercode", "plans", `${taskId}.json`);
    assert.equal(existsSync(planPath), true);

    const storedPlan = JSON.parse(readFileSync(planPath, "utf8"));
    assert.equal(storedPlan.taskId, taskId);
    assert.ok(storedPlan.plan.steps.length > 0);
    assert.ok(storedPlan.planRef);
  } finally {
    process.chdir(previousCwd);
  }
});

// --- M3: Result preview and artifact ---

test("runCli result list shows preview for results", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    await runCli(["run", "fix", "build"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    const code = await runCli(["result", "list"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.ok(out.length > 0);
    // Results should now include preview text (the dash separator).
    for (const line of out) {
      assert.ok(line.includes("["));
    }
  } finally {
    process.chdir(previousCwd);
  }
});

test("runCli result show displays preview field", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    await runCli(["run", "fix", "build"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const resultLine = out.find(line => line.startsWith("Saved result "));
    const resultRef = resultLine?.replace("Saved result ", "").trim();
    assert.ok(resultRef);

    out.length = 0;
    err.length = 0;

    const code = await runCli(["result", "show", resultRef], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(code, 0);
    assert.ok(out.some(line => line.startsWith("Preview: ") || line.startsWith("Data: ")));
    assert.ok(out.some(line => line.startsWith("Result: ")));
    assert.ok(out.some(line => line.startsWith("Kind: ")));
  } finally {
    process.chdir(previousCwd);
  }
});

// --- M3: Task retry CLI flow ---

test("runCli task retry re-executes a failed task using stored plan", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    // Run a task first to get a stored plan.
    await runCli(["run", "fix", "build"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const startedLine = out.find(line => line.startsWith("Started task "));
    const taskId = startedLine?.replace("Started task ", "").trim();
    assert.ok(taskId);

    // Manually mark the task as failed so we can retry it.
    const { FileRuntimeStateStore } = await import("@nareshdama/state");
    const store = new FileRuntimeStateStore(cwd);
    const persisted = store.loadTask(taskId);
    assert.ok(persisted);

    // Update task to failed state so retry can work.
    persisted.task.status = "failed";
    persisted.task.attempts = 1;
    persisted.task.maxAttempts = 3;
    persisted.task.error = { message: "Simulated failure", retryable: true, code: undefined, details: undefined };
    persisted.task.result = undefined;
    persisted.task.completedAt = undefined;
    store.saveTask(persisted.task, persisted.events);

    out.length = 0;
    err.length = 0;

    const retryCode = await runCli(["task", "retry", taskId], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(retryCode, 0, `Retry failed. err: ${err.join("; ")}`);
    assert.ok(out.some(line => line.includes("Retrying task")));
    assert.ok(out.some(line => line.includes("Completed retry")));
    assert.ok(out.some(line => line.startsWith("Saved result ")));
  } finally {
    process.chdir(previousCwd);
  }
});

// --- M3: Task resume CLI flow ---

test("runCli task resume continues from stored progress", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    // Run a task to get a stored plan.
    await runCli(["run", "fix", "build"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const startedLine = out.find(line => line.startsWith("Started task "));
    const taskId = startedLine?.replace("Started task ", "").trim();
    assert.ok(taskId);

    // Manually set the task to failed for resume.
    const { FileRuntimeStateStore } = await import("@nareshdama/state");
    const store = new FileRuntimeStateStore(cwd);
    const persisted = store.loadTask(taskId);
    assert.ok(persisted);

    persisted.task.status = "failed";
    persisted.task.attempts = 1;
    persisted.task.maxAttempts = 3;
    persisted.task.error = { message: "Partial failure", retryable: true, code: undefined, details: undefined };
    persisted.task.result = undefined;
    persisted.task.completedAt = undefined;
    store.saveTask(persisted.task, persisted.events);

    out.length = 0;
    err.length = 0;

    const resumeCode = await runCli(["task", "resume", taskId], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    assert.equal(resumeCode, 0, `Resume failed. err: ${err.join("; ")}`);
    assert.ok(out.some(line => line.includes("Resuming task")));
    assert.ok(out.some(line => line.includes("Skipping")));
    assert.ok(out.some(line => line.includes("Completed resume")));
  } finally {
    process.chdir(previousCwd);
  }
});

// --- M3: task retry with --force ---

test("runCli task retry --force retries non-retryable errors", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-cli-"));
  const previousCwd = process.cwd();
  const out = [];
  const err = [];

  process.chdir(cwd);
  try {
    await runCli(["init"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    out.length = 0;
    err.length = 0;

    await runCli(["run", "fix", "build"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const startedLine = out.find(line => line.startsWith("Started task "));
    const taskId = startedLine?.replace("Started task ", "").trim();
    assert.ok(taskId);

    // Mark as failed with retryable: false.
    const { FileRuntimeStateStore } = await import("@nareshdama/state");
    const store = new FileRuntimeStateStore(cwd);
    const persisted = store.loadTask(taskId);
    assert.ok(persisted);

    persisted.task.status = "failed";
    persisted.task.attempts = 1;
    persisted.task.maxAttempts = 3;
    persisted.task.error = { message: "Non-retryable error", retryable: false, code: undefined, details: undefined };
    persisted.task.result = undefined;
    persisted.task.completedAt = undefined;
    store.saveTask(persisted.task, persisted.events);

    out.length = 0;
    err.length = 0;

    // Without --force should fail.
    const noForceCode = await runCli(["task", "retry", taskId], {
      out: message => out.push(message),
      err: message => err.push(message)
    });
    assert.equal(noForceCode, 1);
    assert.ok(err.some(line => line.includes("non-retryable")));

    // Re-set to failed state (retry attempt consumed the queued state).
    const persisted2 = store.loadTask(taskId);
    assert.ok(persisted2);
    persisted2.task.status = "failed";
    persisted2.task.attempts = 1;
    persisted2.task.maxAttempts = 3;
    persisted2.task.error = { message: "Non-retryable error", retryable: false, code: undefined, details: undefined };
    persisted2.task.result = undefined;
    persisted2.task.completedAt = undefined;
    store.saveTask(persisted2.task, persisted2.events);

    out.length = 0;
    err.length = 0;

    // With --force should succeed.
    const forceCode = await runCli(["task", "retry", taskId, "--force"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });
    assert.equal(forceCode, 0, `Force retry failed. err: ${err.join("; ")}`);
    assert.ok(out.some(line => line.includes("Retrying task")));
    assert.ok(out.some(line => line.includes("Completed retry")));
  } finally {
    process.chdir(previousCwd);
  }
});
