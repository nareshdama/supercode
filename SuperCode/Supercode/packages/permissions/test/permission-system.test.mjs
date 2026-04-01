import test from "node:test";
import assert from "node:assert/strict";
import { DefaultPermissionSystem } from "../dist/index.js";

test("DefaultPermissionSystem prompts for shell in default mode", () => {
  const system = new DefaultPermissionSystem({
    mode: "default"
  });

  const decision = system.evaluate({
    category: "shell",
    resource: "npm test",
    reason: "Run verification"
  });

  assert.equal(decision.decision, "prompt");
  assert.equal(system.getDecisionLog().length, 1);
});

test("DefaultPermissionSystem allows session actions and bypasses all in bypass mode", () => {
  const defaultSystem = new DefaultPermissionSystem({
    mode: "default"
  });
  const bypassSystem = new DefaultPermissionSystem({
    mode: "bypass"
  });

  const sessionDecision = defaultSystem.evaluate({
    category: "session",
    resource: "task.start",
    reason: "Create runtime task"
  });
  const networkDecision = bypassSystem.evaluate({
    category: "network",
    resource: "https://example.com",
    reason: "Fetch remote resource"
  });

  assert.equal(sessionDecision.decision, "allow");
  assert.equal(networkDecision.decision, "allow");
});

test("DefaultPermissionSystem respects explicit allow and deny overrides", () => {
  const system = new DefaultPermissionSystem({
    mode: "auto",
    allowCategories: ["mcp"],
    denyCategories: ["shell"]
  });

  const allowDecision = system.evaluate({
    category: "mcp",
    resource: "filesystem.read",
    reason: "Inspect project"
  });
  const denyDecision = system.evaluate({
    category: "shell",
    resource: "rm -rf .",
    reason: "Destructive command"
  });

  assert.equal(allowDecision.decision, "allow");
  assert.equal(denyDecision.decision, "deny");
});
