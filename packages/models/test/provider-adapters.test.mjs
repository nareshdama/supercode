import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider, AnthropicProvider } from "../dist/index.js";

// --- OpenAI Provider Tests ---

test("OpenAIProvider lists known models", () => {
  const provider = new OpenAIProvider({ apiKey: "test" });
  const models = provider.listModels();

  assert.ok(models.length >= 8);
  assert.ok(models.some(m => m.modelId === "gpt-4.1-mini"));
  assert.ok(models.some(m => m.modelId === "gpt-5"));
  assert.ok(models.some(m => m.modelId === "o3"));
  assert.ok(models.some(m => m.modelId === "o4-mini"));
  for (const m of models) {
    assert.equal(m.providerId, "openai");
    assert.ok(m.cost.inputPer1kTokens >= 0);
  }
});

test("OpenAIProvider starts healthy", () => {
  const provider = new OpenAIProvider({ apiKey: "test" });
  const health = provider.getHealth();

  assert.equal(health.providerId, "openai");
  assert.equal(health.status, "healthy");
  assert.equal(health.errorCount, 0);
});

test("OpenAIProvider health notes warn when no API key", () => {
  const provider = new OpenAIProvider({});
  const health = provider.getHealth();

  assert.ok(health.notes.some(n => n.includes("No API key")));
});

test("OpenAIProvider invoke normalizes response", async () => {
  const mockResponse = {
    choices: [
      {
        message: { role: "assistant", content: "Hello from mock!" },
        finish_reason: "stop"
      }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5 }
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockResponse,
    text: async () => ""
  });

  const provider = new OpenAIProvider({
    apiKey: "test-key",
    fetchFn: mockFetch
  });

  const result = await provider.invoke({
    messages: [{ role: "user", content: "Hi" }]
  });

  assert.equal(result.providerId, "openai");
  assert.equal(result.content, "Hello from mock!");
  assert.equal(result.usage.inputTokens, 10);
  assert.equal(result.usage.outputTokens, 5);
  assert.equal(result.finishReason, "stop");
  assert.ok(result.requestId);
  assert.ok(result.latencyMs >= 0);
});

test("OpenAIProvider invoke handles tool calls", async () => {
  const mockResponse = {
    choices: [
      {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_123",
              function: { name: "search", arguments: '{"query":"test"}' }
            }
          ]
        },
        finish_reason: "tool_calls"
      }
    ],
    usage: { prompt_tokens: 20, completion_tokens: 10 }
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockResponse,
    text: async () => ""
  });

  const provider = new OpenAIProvider({ apiKey: "test-key", fetchFn: mockFetch });
  const result = await provider.invoke({
    messages: [{ role: "user", content: "Search" }],
    tools: [{ name: "search", description: "Search", parameters: {} }]
  });

  assert.equal(result.finishReason, "tool_calls");
  assert.ok(result.toolCalls);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].id, "call_123");
  assert.equal(result.toolCalls[0].name, "search");
});

test("OpenAIProvider invoke records failure on HTTP error", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({}),
    text: async () => "Rate limited"
  });

  const provider = new OpenAIProvider({ apiKey: "test-key", fetchFn: mockFetch });

  await assert.rejects(
    () => provider.invoke({ messages: [{ role: "user", content: "Hi" }] }),
    { message: /OpenAI API error 429/ }
  );

  const health = provider.getHealth();
  assert.equal(health.status, "degraded");
  assert.equal(health.errorCount, 1);
});

// --- Anthropic Provider Tests ---

test("AnthropicProvider lists known models", () => {
  const provider = new AnthropicProvider({ apiKey: "test" });
  const models = provider.listModels();

  assert.ok(models.length >= 4);
  assert.ok(models.some(m => m.modelId.includes("claude")));
  for (const m of models) {
    assert.equal(m.providerId, "anthropic");
  }
});

test("AnthropicProvider starts healthy", () => {
  const provider = new AnthropicProvider({ apiKey: "test" });
  const health = provider.getHealth();

  assert.equal(health.providerId, "anthropic");
  assert.equal(health.status, "healthy");
});

test("AnthropicProvider invoke normalizes response", async () => {
  const mockResponse = {
    content: [
      { type: "text", text: "Hello from Claude!" }
    ],
    usage: { input_tokens: 15, output_tokens: 8 },
    stop_reason: "end_turn"
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockResponse,
    text: async () => ""
  });

  const provider = new AnthropicProvider({ apiKey: "test-key", fetchFn: mockFetch });
  const result = await provider.invoke({
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi" }
    ]
  });

  assert.equal(result.providerId, "anthropic");
  assert.equal(result.content, "Hello from Claude!");
  assert.equal(result.usage.inputTokens, 15);
  assert.equal(result.usage.outputTokens, 8);
  assert.equal(result.finishReason, "stop");
});

test("AnthropicProvider invoke handles tool_use blocks", async () => {
  const mockResponse = {
    content: [
      { type: "tool_use", id: "tu_456", name: "fs_read", input: { path: "/tmp/test" } }
    ],
    usage: { input_tokens: 30, output_tokens: 15 },
    stop_reason: "tool_use"
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockResponse,
    text: async () => ""
  });

  const provider = new AnthropicProvider({ apiKey: "test-key", fetchFn: mockFetch });
  const result = await provider.invoke({
    messages: [{ role: "user", content: "Read file" }],
    tools: [{ name: "fs_read", description: "Read a file", parameters: {} }]
  });

  assert.equal(result.finishReason, "tool_calls");
  assert.ok(result.toolCalls);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].id, "tu_456");
  assert.equal(result.toolCalls[0].name, "fs_read");
});

test("AnthropicProvider invoke records failure on HTTP error", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({}),
    text: async () => "Internal error"
  });

  const provider = new AnthropicProvider({ apiKey: "test-key", fetchFn: mockFetch });

  await assert.rejects(
    () => provider.invoke({ messages: [{ role: "user", content: "Hi" }] }),
    { message: /Anthropic API error 500/ }
  );

  const health = provider.getHealth();
  assert.equal(health.status, "degraded");
});
