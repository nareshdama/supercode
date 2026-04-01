import test from "node:test";
import assert from "node:assert/strict";
import { inferModelCapabilities } from "../dist/index.js";

test("inferModelCapabilities recognizes GPT-5 style models", () => {
  const result = inferModelCapabilities("gpt-5");

  assert.equal(result.provider, "openai");
  assert.equal(result.supportsTools, true);
  assert.equal(result.contextWindow, "large");
  assert.equal(result.reasoning, "deep");
});
