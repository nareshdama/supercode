import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTaskManager, SimpleTaskExecutor } from "../dist/index.js";
import { InMemoryProgressTracker } from "../../progress/dist/index.js";
import { ExecutableToolRegistry } from "../../tools/dist/index.js";

test("SimpleTaskExecutor runs steps and records progress", async () => {
  const tasks = new InMemoryTaskManager();
  const progress = new InMemoryProgressTracker();
  const tools = new ExecutableToolRegistry();

  tools.registerTool({
    toolId: "echo",
    title: "Echo",
    description: "Return the input payload.",
    category: "workflow",
    requiresPermission: ["tool"],
    execute: input => ({ echoed: input })
  });

  const task = tasks.createTask({ goal: "Run executor test" });
  tasks.startTask(task.taskId);

  const executor = new SimpleTaskExecutor(tasks, progress, tools);
  const plan = {
    taskId: task.taskId,
    createdAt: new Date().toISOString(),
    steps: [
      {
        stepId: "step-1",
        toolId: "echo",
        input: { message: "hello" }
      }
    ]
  };

  const outcome = await executor.run(plan);
  const snapshot = progress.getTaskProgress(task.taskId);

  assert.equal(outcome.success, true);
  assert.ok(snapshot);
  assert.equal(snapshot?.steps.length, 1);
  assert.equal(snapshot?.steps[0].status, "completed");
});

// --- M3: Per-step timing capture ---

test("SimpleTaskExecutor captures per-step timing in stepOutcomes", async () => {
  const tasks = new InMemoryTaskManager();
  const progress = new InMemoryProgressTracker();
  const tools = new ExecutableToolRegistry();

  tools.registerTool({
    toolId: "slow-echo",
    title: "Slow Echo",
    description: "Return input after a short delay.",
    category: "workflow",
    execute: async input => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { echoed: input };
    }
  });

  const task = tasks.createTask({ goal: "Timing test" });
  tasks.startTask(task.taskId);

  const executor = new SimpleTaskExecutor(tasks, progress, tools);
  const outcome = await executor.run({
    taskId: task.taskId,
    createdAt: new Date().toISOString(),
    steps: [
      { stepId: "s1", toolId: "slow-echo", input: { msg: "a" } },
      { stepId: "s2", toolId: "slow-echo", input: { msg: "b" } }
    ]
  });

  assert.equal(outcome.success, true);
  assert.ok(outcome.stepOutcomes);
  assert.equal(outcome.stepOutcomes.length, 2);

  for (const step of outcome.stepOutcomes) {
    assert.equal(step.ok, true);
    assert.ok(step.startedAt);
    assert.ok(step.completedAt);
    assert.equal(typeof step.durationMs, "number");
    assert.ok(step.durationMs >= 0);
  }

  // Overall timing should also be present.
  assert.ok(outcome.startedAt);
  assert.ok(outcome.durationMs !== undefined);
  assert.ok(outcome.durationMs >= 0);
});

// --- M3: Resume skips completed steps ---

test("SimpleTaskExecutor resume skips completed steps", async () => {
  const tasks = new InMemoryTaskManager();
  const progress = new InMemoryProgressTracker();
  const tools = new ExecutableToolRegistry();

  let callCount = 0;
  tools.registerTool({
    toolId: "counter",
    title: "Counter",
    description: "Counts invocations.",
    category: "workflow",
    execute: () => {
      callCount++;
      return { count: callCount };
    }
  });

  const task = tasks.createTask({ goal: "Resume test", maxAttempts: 3 });
  tasks.startTask(task.taskId);

  const executor = new SimpleTaskExecutor(tasks, progress, tools);
  const plan = {
    taskId: task.taskId,
    createdAt: new Date().toISOString(),
    steps: [
      { stepId: "s1", toolId: "counter" },
      { stepId: "s2", toolId: "counter" },
      { stepId: "s3", toolId: "counter" }
    ]
  };

  // Resume, skipping step s1 and s2.
  const outcome = await executor.resume(plan, ["s1", "s2"]);

  assert.equal(outcome.success, true);
  assert.equal(callCount, 1); // Only s3 was executed.
  assert.ok(outcome.summary.includes("Executed 1 step(s)"));
  assert.ok(outcome.summary.includes("Skipped 2 completed step(s)"));
  assert.equal(outcome.stepOutcomes?.length, 1);
  assert.equal(outcome.stepOutcomes?.[0].stepId, "s3");
});

// --- M3: Failure returns partial step outcomes ---

test("SimpleTaskExecutor returns partial stepOutcomes on failure", async () => {
  const tasks = new InMemoryTaskManager();
  const progress = new InMemoryProgressTracker();
  const tools = new ExecutableToolRegistry();

  tools.registerTool({
    toolId: "ok-step",
    title: "OK Step",
    description: "Always succeeds.",
    category: "workflow",
    execute: () => ({ status: "ok" })
  });

  tools.registerTool({
    toolId: "fail-step",
    title: "Fail Step",
    description: "Always fails.",
    category: "workflow",
    execute: () => { throw new Error("Intentional failure"); }
  });

  const task = tasks.createTask({ goal: "Partial failure test" });
  tasks.startTask(task.taskId);

  const executor = new SimpleTaskExecutor(tasks, progress, tools);
  const outcome = await executor.run({
    taskId: task.taskId,
    createdAt: new Date().toISOString(),
    steps: [
      { stepId: "s1", toolId: "ok-step" },
      { stepId: "s2", toolId: "fail-step" },
      { stepId: "s3", toolId: "ok-step" }
    ]
  });

  assert.equal(outcome.success, false);
  assert.ok(outcome.stepOutcomes);
  assert.equal(outcome.stepOutcomes.length, 2); // s1 succeeded, s2 failed, s3 not reached.
  assert.equal(outcome.stepOutcomes[0].ok, true);
  assert.equal(outcome.stepOutcomes[1].ok, false);
  assert.ok(outcome.stepOutcomes[1].error?.includes("Intentional failure"));
});

// --- M3: Shell field extraction ---

test("SimpleTaskExecutor extracts stdout/stderr/exitCode from shell-like tool outputs", async () => {
  const tasks = new InMemoryTaskManager();
  const progress = new InMemoryProgressTracker();
  const tools = new ExecutableToolRegistry();

  tools.registerTool({
    toolId: "mock-shell",
    title: "Mock Shell",
    description: "Returns shell-like output.",
    category: "shell",
    execute: () => ({
      ok: true,
      code: 0,
      stdout: "hello world\n",
      stderr: "",
      timedOut: false
    })
  });

  const task = tasks.createTask({ goal: "Shell extraction test" });
  tasks.startTask(task.taskId);

  const executor = new SimpleTaskExecutor(tasks, progress, tools);
  const outcome = await executor.run({
    taskId: task.taskId,
    createdAt: new Date().toISOString(),
    steps: [{ stepId: "s1", toolId: "mock-shell" }]
  });

  assert.equal(outcome.success, true);
  const step = outcome.stepOutcomes?.[0];
  assert.ok(step);
  assert.equal(step.exitCode, 0);
  assert.equal(step.stdout, "hello world\n");
  assert.equal(step.stderr, "");
  assert.equal(step.timedOut, false);
});
