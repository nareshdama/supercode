import test from "node:test";
import assert from "node:assert/strict";
import { ModelCatalog, ModelRouter, OpenAIProvider, AnthropicProvider } from "../dist/index.js";

// --- Catalog Tests ---

test("ModelCatalog registers and lists providers", () => {
  const catalog = new ModelCatalog();
  const openai = new OpenAIProvider({ apiKey: "test-key" });
  catalog.registerProvider(openai);

  assert.equal(catalog.listProviders().length, 1);
  assert.equal(catalog.getProvider("openai")?.providerId, "openai");
});

test("ModelCatalog lists models from all registered providers", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));
  catalog.registerProvider(new AnthropicProvider({ apiKey: "test" }));

  const models = catalog.listModels();
  assert.ok(models.length > 10);

  const providers = new Set(models.map(m => m.providerId));
  assert.ok(providers.has("openai"));
  assert.ok(providers.has("anthropic"));
});

test("ModelCatalog.getModel finds a specific model", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const model = catalog.getModel("gpt-4.1-mini");
  assert.ok(model);
  assert.equal(model.modelId, "gpt-4.1-mini");
  assert.equal(model.providerId, "openai");
  assert.equal(model.family, "gpt-4.1");
});

test("ModelCatalog.findByFamily returns all models in a family", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const gpt41 = catalog.findByFamily("gpt-4.1");
  assert.ok(gpt41.length >= 3);
  for (const m of gpt41) {
    assert.equal(m.family, "gpt-4.1");
  }
});

test("ModelCatalog.autoDiscover detects providers from env", () => {
  const catalog = ModelCatalog.autoDiscover({
    env: { OPENAI_API_KEY: "sk-test", ANTHROPIC_API_KEY: "sk-ant-test" }
  });

  assert.equal(catalog.listProviders().length, 2);
  assert.ok(catalog.getProvider("openai"));
  assert.ok(catalog.getProvider("anthropic"));
});

test("ModelCatalog.autoDiscover skips unconfigured providers", () => {
  const catalog = ModelCatalog.autoDiscover({ env: {} });
  assert.equal(catalog.listProviders().length, 0);
});

test("ModelCatalog.getHealth returns health for all providers", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));
  catalog.registerProvider(new AnthropicProvider({ apiKey: "test" }));

  const health = catalog.getHealth();
  assert.equal(health.length, 2);
  for (const h of health) {
    assert.equal(h.status, "healthy");
  }
});

// --- Router Tests ---

test("ModelRouter selects a model matching tool requirements", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  const decision = router.select({
    requiresTools: true,
    requiresStreaming: false,
    latencyTarget: "interactive"
  });

  assert.ok(decision.primary);
  assert.equal(decision.primary.supportsTools, true);
  assert.ok(decision.reason.includes(decision.primary.modelId));
});

test("ModelRouter produces fallbacks from different models", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));
  catalog.registerProvider(new AnthropicProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  const decision = router.select({
    requiresTools: true,
    requiresStreaming: false,
    latencyTarget: "interactive"
  });

  assert.ok(decision.fallbacks.length > 0);
  assert.ok(decision.fallbacks.length <= 2);
});

test("ModelRouter respects preferred provider", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));
  catalog.registerProvider(new AnthropicProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  const decision = router.select({
    requiresTools: true,
    requiresStreaming: false,
    preferredProviderId: "anthropic",
    latencyTarget: "interactive"
  });

  assert.equal(decision.primary.providerId, "anthropic");
  assert.ok(decision.reason.includes("matched-preferred-provider"));
});

test("ModelRouter respects preferred model", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  const decision = router.select({
    requiresTools: true,
    requiresStreaming: false,
    preferredModelId: "gpt-4o",
    latencyTarget: "interactive"
  });

  assert.equal(decision.primary.modelId, "gpt-4o");
  assert.ok(decision.reason.includes("matched-preferred-model"));
});

test("ModelRouter prefers fast models for interactive target", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  const decision = router.select({
    requiresTools: true,
    requiresStreaming: false,
    latencyTarget: "interactive"
  });

  // Fast or balanced should be preferred over deep for interactive.
  assert.ok(["fast", "balanced"].includes(decision.primary.latencyTier));
});

test("ModelRouter prefers deep models for background target", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  const decision = router.select({
    requiresTools: true,
    requiresStreaming: false,
    latencyTarget: "background"
  });

  // Deep or balanced should be preferred for background.
  assert.ok(["deep", "balanced"].includes(decision.primary.latencyTier));
});

test("ModelRouter logs decisions", () => {
  const catalog = new ModelCatalog();
  catalog.registerProvider(new OpenAIProvider({ apiKey: "test" }));

  const router = new ModelRouter(catalog);
  router.select({ requiresTools: false, requiresStreaming: false, latencyTarget: "interactive" });
  router.select({ requiresTools: true, requiresStreaming: false, latencyTarget: "background" });

  const log = router.getDecisionLog();
  assert.equal(log.length, 2);
  assert.ok(log[0].scores.length > 0);
  assert.ok(log[0].timestamp);
});

test("ModelRouter throws when no models match requirements", () => {
  const catalog = new ModelCatalog(); // empty catalog

  const router = new ModelRouter(catalog);
  assert.throws(
    () => router.select({ requiresTools: true, requiresStreaming: true, latencyTarget: "interactive" }),
    { message: /No models available/ }
  );
});
