import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
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

    const config = JSON.parse(readFileSync(path.join(cwd, ".supercode", "config.json"), "utf8"));
    const snapshot = JSON.parse(readFileSync(path.join(cwd, ".supercode", "profile.snapshot.json"), "utf8"));
    const packState = JSON.parse(readFileSync(path.join(cwd, ".supercode", "packs.json"), "utf8"));
    const stateReadme = readFileSync(path.join(cwd, ".supercode", "README.md"), "utf8");
    assert.ok(Array.isArray(config.selectedPackIds));
    assert.equal(config.version, 1);
    assert.equal(typeof config.createdAt, "string");
    assert.equal(snapshot.version, 1);
    assert.deepEqual(config.selectedPackIds, ["core", "typescript"]);
    assert.deepEqual(snapshot.executionProfile.recommendedPackIds, ["core", "typescript"]);
    assert.deepEqual(packState.installedPackIds, ["core", "typescript"]);
    assert.match(stateReadme, /Primary language: typescript/i);
    assert.equal(err.length, 0);
    assert.ok(out.some(line => line.includes("Initialized Supercode")));
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

    out.length = 0;
    err.length = 0;

    const code = await runCli(["init", "--force"], {
      out: message => out.push(message),
      err: message => err.push(message)
    });

    const config = JSON.parse(readFileSync(path.join(cwd, ".supercode", "config.json"), "utf8"));
    const sourceFile = readFileSync(path.join(cwd, "src", "index.ts"), "utf8");

    assert.equal(code, 0);
    assert.equal(config.version, 1);
    assert.deepEqual(config.selectedPackIds, ["core", "typescript"]);
    assert.equal(sourceFile, 'console.log("keep me");\n');
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
    assert.deepEqual(packState.installedPackIds, ["core"]);
    assert.ok(out.some(line => line.includes("Uninstalled pack typescript")));
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
      (await import("@supercode/core")).createExecutionProfile({
        ... (await import("@supercode/detect")).detectRuntimeInputs(cwd, process.env),
        workflowRecommendation: (await import("@supercode/workflows")).recommendWorkflowPacks(
          (await import("@supercode/detect")).detectProjectProfile(cwd),
          (await import("@supercode/detect")).detectHostCapabilities(process.env),
          (await import("@supercode/detect")).detectModelCapabilities(process.env)
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
    const { FileRuntimeStateStore } = await import("@supercode/state");
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
    const { FileRuntimeStateStore } = await import("@supercode/state");
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
    const { FileRuntimeStateStore } = await import("@supercode/state");
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
