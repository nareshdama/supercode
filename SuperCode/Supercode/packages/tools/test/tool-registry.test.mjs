import test from "node:test";
import assert from "node:assert/strict";
import { ExecutableToolRegistry } from "../dist/index.js";

function createDecision(decision) {
  return {
    requestId: "request-1",
    decision,
    mode: "default",
    decidedAt: "2026-01-01T00:00:00.000Z",
    reason: `Decision: ${decision}`
  };
}

test("ExecutableToolRegistry invokes registered tools and preserves execute handlers", async () => {
  const registry = new ExecutableToolRegistry({
    authorize: () => createDecision("allow")
  });

  registry.registerTool({
    toolId: "workflow.match",
    title: "Workflow Match",
    description: "Match workflow guidance for a task.",
    category: "workflow",
    requiresPermission: ["tool"],
    execute: (input, context) => ({
      task: input.task,
      taskId: context.taskId
    })
  });

  const registeredTool = registry.getTool("workflow.match");
  const result = await registry.invoke(
    "workflow.match",
    {
      task: "fix build errors"
    },
    {
      taskId: "task-1",
      sessionId: "session-1"
    }
  );

  assert.equal(typeof registeredTool?.execute, "function");
  assert.equal(result.ok, true);
  assert.deepEqual(result.output, {
    task: "fix build errors",
    taskId: "task-1"
  });
});

test("ExecutableToolRegistry blocks invocation when permission is denied", async () => {
  const registry = new ExecutableToolRegistry({
    authorize: () => createDecision("deny")
  });

  registry.registerTool({
    toolId: "mcp.inspect",
    title: "MCP Inspect",
    description: "Inspect MCP state.",
    category: "mcp",
    requiresPermission: ["tool"],
    execute: () => ({
      available: true
    })
  });

  const result = await registry.invoke("mcp.inspect", undefined, {
    taskId: "task-1"
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /blocked by permission decision deny/i);
});

test("ExecutableToolRegistry rejects duplicate tool ids", () => {
  const registry = new ExecutableToolRegistry();
  const tool = {
    toolId: "workflow.match",
    title: "Workflow Match",
    description: "Match workflow guidance for a task.",
    category: "workflow"
  };

  registry.registerTool(tool);

  assert.throws(() => registry.registerTool(tool), /already registered/i);
});
