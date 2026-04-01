import test from "node:test";
import assert from "node:assert/strict";
import { BudgetPolicy } from "../dist/index.js";

test("BudgetPolicy starts with zero usage", () => {
  const budget = new BudgetPolicy({ sessionId: "test-session" });
  const snap = budget.snapshot();

  assert.equal(snap.sessionId, "test-session");
  assert.equal(snap.totalInputTokens, 0);
  assert.equal(snap.totalOutputTokens, 0);
  assert.equal(snap.totalCostEstimate, 0);
  assert.equal(snap.invocationCount, 0);
});

test("BudgetPolicy records usage and updates snapshot", () => {
  const budget = new BudgetPolicy();

  budget.record({
    modelId: "gpt-4.1-mini",
    providerId: "openai",
    inputTokens: 500,
    outputTokens: 200,
    cost: 0.0005,
    latencyMs: 400,
    completedAt: new Date().toISOString()
  });

  const snap = budget.snapshot();
  assert.equal(snap.totalInputTokens, 500);
  assert.equal(snap.totalOutputTokens, 200);
  assert.equal(snap.totalCostEstimate, 0.0005);
  assert.equal(snap.invocationCount, 1);
});

test("BudgetPolicy accumulates usage across multiple records", () => {
  const budget = new BudgetPolicy();

  for (let i = 0; i < 3; i++) {
    budget.record({
      modelId: "gpt-4.1-mini",
      providerId: "openai",
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      latencyMs: 200,
      completedAt: new Date().toISOString()
    });
  }

  const snap = budget.snapshot();
  assert.equal(snap.totalInputTokens, 300);
  assert.equal(snap.totalOutputTokens, 150);
  assert.equal(snap.invocationCount, 3);
});

test("BudgetPolicy isWithinBudget returns true when no limit set", () => {
  const budget = new BudgetPolicy();
  assert.equal(budget.isWithinBudget(), true);
  assert.equal(budget.isExhausted(), false);
});

test("BudgetPolicy detects budget exhaustion", () => {
  const budget = new BudgetPolicy({ maxBudget: 0.01 });

  budget.record({
    modelId: "gpt-5",
    providerId: "openai",
    inputTokens: 10000,
    outputTokens: 5000,
    cost: 0.02,
    latencyMs: 1000,
    completedAt: new Date().toISOString()
  });

  assert.equal(budget.isWithinBudget(), false);
  assert.equal(budget.isExhausted(), true);

  const snap = budget.snapshot();
  assert.equal(snap.maxBudget, 0.01);
  assert.equal(snap.remainingBudget, 0);
});

test("BudgetPolicy getWarning returns null when no limit", () => {
  const budget = new BudgetPolicy();
  assert.equal(budget.getWarning(), undefined);
});

test("BudgetPolicy getWarning returns exhaustion warning", () => {
  const budget = new BudgetPolicy({ maxBudget: 0.01 });
  budget.record({
    modelId: "m",
    providerId: "p",
    inputTokens: 1000,
    outputTokens: 500,
    cost: 0.02,
    latencyMs: 100,
    completedAt: new Date().toISOString()
  });

  const warning = budget.getWarning();
  assert.ok(warning);
  assert.ok(warning.includes("exhausted"));
});

test("BudgetPolicy getWarning returns low-budget warning", () => {
  const budget = new BudgetPolicy({ maxBudget: 1.0 });
  budget.record({
    modelId: "m",
    providerId: "p",
    inputTokens: 1000,
    outputTokens: 500,
    cost: 0.95,
    latencyMs: 100,
    completedAt: new Date().toISOString()
  });

  const warning = budget.getWarning();
  assert.ok(warning);
  assert.ok(warning.includes("remaining"));
});

test("BudgetPolicy reserve creates a reservation", () => {
  const budget = new BudgetPolicy();
  const model = {
    modelId: "gpt-4.1-mini",
    providerId: "openai",
    family: "gpt-4.1",
    contextWindow: 1_000_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.0004, outputPer1kTokens: 0.0016 },
    latencyTier: "fast"
  };

  const reservation = budget.reserve(model, 1000);
  assert.ok(reservation.reservationId);
  assert.equal(reservation.estimatedTokens, 1000);
  assert.ok(reservation.estimatedCost > 0);
  assert.ok(reservation.reservedAt);
});

test("BudgetPolicy computeCost calculates correctly", () => {
  const budget = new BudgetPolicy();
  const model = {
    modelId: "test",
    providerId: "test",
    family: "test",
    contextWindow: 100_000,
    supportsTools: true,
    supportsStreaming: true,
    trustTier: "first_party",
    cost: { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
    latencyTier: "balanced"
  };

  const cost = budget.computeCost(model, 2000, 1000);
  // 2000/1000 * 0.01 + 1000/1000 * 0.03 = 0.02 + 0.03 = 0.05
  assert.equal(cost, 0.05);
});

test("BudgetPolicy remainingBudget updates correctly", () => {
  const budget = new BudgetPolicy({ maxBudget: 1.0 });

  budget.record({
    modelId: "m",
    providerId: "p",
    inputTokens: 1000,
    outputTokens: 500,
    cost: 0.3,
    latencyMs: 100,
    completedAt: new Date().toISOString()
  });

  const snap = budget.snapshot();
  assert.ok(snap.remainingBudget !== undefined);
  assert.ok(Math.abs(snap.remainingBudget - 0.7) < 0.001);
});
