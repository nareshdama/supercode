import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgressTracker } from "../dist/index.js";
import { InMemoryTaskManager } from "../../tasks/dist/index.js";

test("InMemoryProgressTracker records step and percent updates", () => {
  const tracker = new InMemoryProgressTracker();
  tracker.record({
    taskId: "task-1",
    type: "message",
    message: "Planning started."
  });
  tracker.record({
    taskId: "task-1",
    type: "step-updated",
    step: {
      stepId: "design",
      title: "Design runtime contracts",
      status: "in_progress"
    }
  });
  const snapshot = tracker.record({
    taskId: "task-1",
    type: "percent",
    percentComplete: 45
  });

  assert.equal(snapshot.taskId, "task-1");
  assert.equal(snapshot.summary, "Planning started.");
  assert.equal(snapshot.percentComplete, 45);
  assert.equal(snapshot.steps[0]?.status, "in_progress");
  assert.equal(snapshot.events.length, 3);
});

test("InMemoryProgressTracker maps task lifecycle events into progress snapshots", () => {
  const manager = new InMemoryTaskManager();
  const tracker = new InMemoryProgressTracker();

  manager.subscribe(event => {
    tracker.recordTaskEvent(event);
  });

  const task = manager.createTask({
    goal: "Implement progress tracker",
    maxAttempts: 2
  });
  manager.startTask(task.taskId);
  manager.failTask(task.taskId, {
    message: "Temporary failure",
    retryable: true
  });
  manager.retryTask(task.taskId);

  const snapshot = tracker.getTaskProgress(task.taskId);

  assert.equal(snapshot?.status, "queued");
  assert.equal(snapshot?.percentComplete, 0);
  assert.equal(snapshot?.summary, "Task moved back to the queue for another attempt.");
  assert.deepEqual(
    snapshot?.events.map(event => event.type),
    ["task-status", "task-status", "task-status", "task-status"]
  );
});
