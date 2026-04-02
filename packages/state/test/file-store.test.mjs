import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileRuntimeStateStore } from "../dist/index.js";

test("FileRuntimeStateStore creates and reloads session state", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  const session = store.loadOrCreateSession();
  const reloaded = store.loadSession();

  assert.equal(session.sessionId, reloaded?.sessionId);
  assert.deepEqual(session.activeTaskIds, []);
});

test("FileRuntimeStateStore persists tasks, progress, and permission logs", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  store.saveTask(
    {
      taskId: "task-1",
      goal: "Implement state store",
      status: "running",
      priority: "normal",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:01:00.000Z",
      startedAt: "2026-01-01T00:00:10.000Z",
      childTaskIds: [],
      attempts: 1,
      maxAttempts: 1,
      metadata: {}
    },
    [
      {
        eventId: "event-1",
        taskId: "task-1",
        type: "started",
        status: "running",
        timestamp: "2026-01-01T00:00:10.000Z",
        message: "Task started."
      }
    ]
  );
  store.saveProgress({
    taskId: "task-1",
    status: "running",
    summary: "Working on persistence.",
    percentComplete: 20,
    steps: [],
    events: [],
    updatedAt: "2026-01-01T00:02:00.000Z"
  });
  store.appendPermissionLog({
    request: {
      requestId: "request-1",
      category: "session",
      resource: "task.start",
      reason: "Start task",
      requestedAt: "2026-01-01T00:00:00.000Z"
    },
    decision: {
      requestId: "request-1",
      decision: "allow",
      mode: "default",
      decidedAt: "2026-01-01T00:00:00.000Z"
    }
  });

  assert.equal(store.listTasks().length, 1);
  assert.equal(store.listTaskEvents().length, 1);
  assert.equal(store.loadProgress("task-1")?.summary, "Working on persistence.");
  assert.equal(store.loadPermissionLog().length, 1);
});

test("FileRuntimeStateStore persists result records and updates the session index", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  const result = store.saveResult({
    kind: "tool-result",
    taskId: "task-1",
    toolId: "workflow.match",
    summary: "Matched workflow packs for the task.",
    data: {
      skills: ["TypeScript Build Fix"]
    }
  });
  const session = store.loadOrCreateSession();

  assert.equal(store.loadResult(result.resultRef)?.summary, "Matched workflow packs for the task.");
  assert.ok(store.listResults().some(entry => entry.resultRef === result.resultRef));
  assert.ok(session.resultRefs.includes(result.resultRef));
});

// --- M3: Plan persistence ---

test("FileRuntimeStateStore saves and loads execution plans", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  const plan = {
    planRef: "plan-001",
    taskId: "task-plan-1",
    steps: [
      { stepId: "step-a", toolId: "git.status", title: "Git Status" },
      { stepId: "step-b", toolId: "project.build", title: "Build" }
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    metadata: { command: "run" }
  };

  const stored = store.savePlan(plan);
  assert.equal(stored.planRef, "plan-001");
  assert.equal(stored.taskId, "task-plan-1");
  assert.equal(stored.plan.steps.length, 2);

  const loaded = store.loadPlan("task-plan-1");
  assert.ok(loaded);
  assert.equal(loaded.planRef, "plan-001");
  assert.deepEqual(loaded.plan.steps.map(s => s.stepId), ["step-a", "step-b"]);
});

test("FileRuntimeStateStore lists all stored plans", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  store.savePlan({
    planRef: "p1",
    taskId: "t1",
    steps: [{ stepId: "s1", toolId: "echo" }],
    createdAt: "2026-01-01T00:00:00.000Z"
  });
  store.savePlan({
    planRef: "p2",
    taskId: "t2",
    steps: [{ stepId: "s2", toolId: "echo" }],
    createdAt: "2026-01-01T00:01:00.000Z"
  });

  const plans = store.listPlans();
  assert.equal(plans.length, 2);
});

test("FileRuntimeStateStore loadPlan returns undefined for unknown task", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  assert.equal(store.loadPlan("nonexistent"), undefined);
});

// --- M3: Artifact persistence ---

test("FileRuntimeStateStore saves and loads artifacts", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  const artifactPath = store.saveArtifact("art-1", "full output content here\nline 2\nline 3");
  assert.ok(artifactPath.endsWith("art-1.txt"));

  const content = store.loadArtifact("art-1");
  assert.equal(content, "full output content here\nline 2\nline 3");
});

test("FileRuntimeStateStore loadArtifact returns undefined for missing artifacts", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);
  store.ensureLayout();

  assert.equal(store.loadArtifact("no-such-ref"), undefined);
});

// --- M3: Result preview truncation ---

test("FileRuntimeStateStore truncates large result data into preview and stores artifact", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  // Create data larger than 2000 chars.
  const largeData = { output: "x".repeat(3000) };
  const result = store.saveResult({
    kind: "task-output",
    taskId: "task-trunc-1",
    summary: "Large output task",
    data: largeData
  });

  assert.ok(result.preview);
  assert.ok(result.preview.length <= 2020); // 2000 + "[truncated]" + newline
  assert.ok(result.preview.endsWith("[truncated]"));
  assert.ok(result.artifactRef);

  // Artifact should contain the full data.
  const artifact = store.loadArtifact(result.artifactRef);
  assert.ok(artifact);
  assert.ok(artifact.length > 2000);
});

test("FileRuntimeStateStore does not truncate small result data", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  const result = store.saveResult({
    kind: "tool-result",
    taskId: "task-small-1",
    summary: "Small output",
    data: { ok: true }
  });

  assert.ok(result.preview);
  assert.equal(result.preview, JSON.stringify({ ok: true }));
  assert.equal(result.artifactRef, undefined);
});

test("FileRuntimeStateStore saves and queries memory records", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-state-"));
  const store = new FileRuntimeStateStore(cwd);

  const memory = store.saveMemory({
    content: "The repo uses file-backed runtime state under .supercode.",
    summary: "Runtime state is persisted on disk.",
    tags: ["state", "runtime"],
    importance: 0.8,
    provenance: {
      sessionId: "session-1",
      taskId: "task-1",
      sourceKind: "task",
      sourceLabel: "task completion"
    },
    retention: {
      strategy: "count-bound",
      maxEntries: 100
    }
  });

  assert.equal(store.loadMemory(memory.memoryRef)?.summary, "Runtime state is persisted on disk.");

  const matches = store.listMemory({
    text: "file-backed",
    tags: ["state"],
    sessionId: "session-1"
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].memoryRef, memory.memoryRef);
});
