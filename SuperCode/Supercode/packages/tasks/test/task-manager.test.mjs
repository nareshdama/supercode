import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTaskManager } from "../dist/index.js";

test("InMemoryTaskManager creates parent and child tasks with events", () => {
  const manager = new InMemoryTaskManager();
  const parent = manager.createTask({
    goal: "Implement runtime kernel"
  });
  const child = manager.createTask({
    goal: "Implement task manager",
    parentTaskId: parent.taskId
  });

  const parentRecord = manager.getTask(parent.taskId);
  const childEvents = manager.getTaskEvents(child.taskId);

  assert.deepEqual(parentRecord?.childTaskIds, [child.taskId]);
  assert.equal(childEvents[0]?.type, "created");
  assert.equal(childEvents[0]?.status, "queued");
});

test("InMemoryTaskManager supports retryable failure and retry flow", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Run verification",
    maxAttempts: 2
  });

  manager.startTask(task.taskId);
  const failed = manager.failTask(task.taskId, {
    message: "Transient command failure",
    retryable: true
  });
  const retried = manager.retryTask(task.taskId);
  manager.startTask(task.taskId);
  const completed = manager.completeTask(task.taskId, {
    summary: "Verification passed."
  });

  assert.equal(failed.status, "failed");
  assert.equal(retried.status, "queued");
  assert.equal(completed.status, "completed");
  assert.equal(completed.attempts, 2);
  assert.deepEqual(
    manager.getTaskEvents(task.taskId).map(event => event.type),
    ["created", "started", "failed", "retried", "started", "completed"]
  );
});

test("InMemoryTaskManager enforces lifecycle transitions", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Cancel queued task"
  });

  manager.cancelTask(task.taskId, {
    reason: "User requested stop."
  });

  assert.throws(() => manager.startTask(task.taskId), /cannot start/i);
  assert.throws(() => manager.retryTask(task.taskId), /cannot retry/i);
});

// --- M3: Forced retry ---

test("InMemoryTaskManager retryTask with force bypasses retryable check", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Force retry test",
    maxAttempts: 3
  });

  manager.startTask(task.taskId);
  manager.failTask(task.taskId, {
    message: "Non-retryable error",
    retryable: false
  });

  // Without force, should throw.
  assert.throws(() => manager.retryTask(task.taskId), /non-retryable/i);

  // With force, should succeed.
  const retried = manager.retryTask(task.taskId, true);
  assert.equal(retried.status, "queued");
});

test("InMemoryTaskManager retryTask respects maxAttempts even with force", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Max attempts test",
    maxAttempts: 1
  });

  manager.startTask(task.taskId);
  manager.failTask(task.taskId, {
    message: "Failed once",
    retryable: false
  });

  assert.throws(() => manager.retryTask(task.taskId, true), /exhausted/i);
});

// --- M3: Resume lifecycle ---

test("InMemoryTaskManager resumeTask moves failed task to running", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Resume test",
    maxAttempts: 3
  });

  manager.startTask(task.taskId);
  manager.failTask(task.taskId, {
    message: "Step 2 failed",
    retryable: true
  });

  const resumed = manager.resumeTask(task.taskId);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.attempts, 2);
  assert.equal(resumed.error, undefined);
  assert.equal(resumed.result, undefined);
  assert.equal(resumed.completedAt, undefined);
});

test("InMemoryTaskManager resumeTask rejects non-failed tasks", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({ goal: "Not failed" });

  assert.throws(() => manager.resumeTask(task.taskId), /cannot resume/i);
});

test("InMemoryTaskManager resumeTask respects maxAttempts", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Max attempts resume",
    maxAttempts: 1
  });

  manager.startTask(task.taskId);
  manager.failTask(task.taskId, {
    message: "Failed",
    retryable: true
  });

  assert.throws(() => manager.resumeTask(task.taskId), /exhausted/i);
});

// --- M3: planRef tracking ---

test("InMemoryTaskManager tracks planRef on task records", () => {
  const manager = new InMemoryTaskManager();
  const task = manager.createTask({
    goal: "Plan ref test",
    metadata: { planRef: "plan-123" }
  });

  assert.equal(task.metadata.planRef, "plan-123");

  // planRef can also be set directly on the record via metadata.
  const loaded = manager.getTask(task.taskId);
  assert.equal(loaded?.metadata.planRef, "plan-123");
});
