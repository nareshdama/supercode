import test from "node:test";
import assert from "node:assert/strict";
import { PromptRegistry } from "../dist/index.js";

test("PromptRegistry registers and resolves a template", () => {
  const registry = new PromptRegistry();
  registry.register({
    promptId: "test.greeting",
    version: "1.0.0",
    description: "A greeting prompt.",
    body: "Hello, {{name}}!",
    variables: ["name"]
  });

  const template = registry.resolve("test.greeting");
  assert.ok(template);
  assert.equal(template.promptId, "test.greeting");
  assert.equal(template.version, "1.0.0");
});

test("PromptRegistry resolves specific version", () => {
  const registry = new PromptRegistry();
  registry.register({
    promptId: "test.greeting",
    version: "1.0.0",
    description: "v1",
    body: "Hello, {{name}}!",
    variables: ["name"]
  });
  registry.register({
    promptId: "test.greeting",
    version: "2.0.0",
    description: "v2",
    body: "Hi there, {{name}}!",
    variables: ["name"]
  });

  const v1 = registry.resolve("test.greeting", "1.0.0");
  assert.equal(v1?.body, "Hello, {{name}}!");

  const v2 = registry.resolve("test.greeting", "2.0.0");
  assert.equal(v2?.body, "Hi there, {{name}}!");
});

test("PromptRegistry resolves latest version when no version specified", () => {
  const registry = new PromptRegistry();
  registry.register({
    promptId: "test.greeting",
    version: "1.0.0",
    description: "v1",
    body: "Hello, {{name}}!",
    variables: ["name"]
  });
  registry.register({
    promptId: "test.greeting",
    version: "2.0.0",
    description: "v2",
    body: "Hi there, {{name}}!",
    variables: ["name"]
  });

  const latest = registry.resolve("test.greeting");
  assert.equal(latest?.version, "2.0.0");
});

test("PromptRegistry renders template with variables", () => {
  const registry = new PromptRegistry();
  registry.register({
    promptId: "test.greeting",
    version: "1.0.0",
    description: "greeting",
    body: "Hello, {{name}}! Welcome to {{place}}.",
    variables: ["name", "place"]
  });

  const rendered = registry.render("test.greeting", { name: "Alice", place: "Supercode" });
  assert.equal(rendered.content, "Hello, Alice! Welcome to Supercode.");
  assert.equal(rendered.promptId, "test.greeting");
  assert.equal(rendered.version, "1.0.0");
  assert.ok(rendered.renderedAt);
});

test("PromptRegistry render throws on missing variable", () => {
  const registry = new PromptRegistry();
  registry.register({
    promptId: "test.greeting",
    version: "1.0.0",
    description: "greeting",
    body: "Hello, {{name}}!",
    variables: ["name"]
  });

  assert.throws(
    () => registry.render("test.greeting", {}),
    { message: /Missing variable "name"/ }
  );
});

test("PromptRegistry render throws on unknown prompt", () => {
  const registry = new PromptRegistry();

  assert.throws(
    () => registry.render("nonexistent", {}),
    { message: /not found/ }
  );
});

test("PromptRegistry.withBuiltins contains system prompts", () => {
  const registry = PromptRegistry.withBuiltins();
  const all = registry.list();

  assert.ok(all.length >= 3);
  assert.ok(registry.resolve("supercode.system"));
  assert.ok(registry.resolve("supercode.task-plan"));
  assert.ok(registry.resolve("supercode.review"));
});

test("PromptRegistry.withBuiltins system prompt renders correctly", () => {
  const registry = PromptRegistry.withBuiltins();
  const rendered = registry.render("supercode.system", {
    projectType: "TypeScript",
    goal: "fix the build errors"
  });

  assert.ok(rendered.content.includes("TypeScript"));
  assert.ok(rendered.content.includes("fix the build errors"));
  assert.ok(!rendered.content.includes("{{"));
});

test("PromptRegistry listVersions returns sorted versions", () => {
  const registry = new PromptRegistry();
  registry.register({ promptId: "p", version: "2.0.0", description: "", body: "", variables: [] });
  registry.register({ promptId: "p", version: "1.0.0", description: "", body: "", variables: [] });
  registry.register({ promptId: "p", version: "1.5.0", description: "", body: "", variables: [] });

  const versions = registry.listVersions("p");
  assert.deepEqual(versions, ["1.0.0", "1.5.0", "2.0.0"]);
});

test("PromptRegistry resolve returns undefined for unknown prompt", () => {
  const registry = new PromptRegistry();
  assert.equal(registry.resolve("unknown"), undefined);
});
