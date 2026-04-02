import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryMemoryProvider, SimpleMemAdapter } from "../dist/index.js";

test("SimpleMemAdapter delegates add and attach operations", () => {
  const adapter = new SimpleMemAdapter({
    delegate: new InMemoryMemoryProvider()
  });

  const record = adapter.add({
    summary: "SimpleMem compatible note",
    content: "Adapters should preserve Supercode memory contracts.",
    tags: ["adapter"],
    importance: 0.8,
    provenance: {
      sessionId: "session-1",
      sourceKind: "system"
    },
    retention: {
      strategy: "keep-all"
    }
  });

  const attachments = adapter.attach({ text: "contracts" });

  assert.equal(adapter.getInfo().kind, "adapter");
  assert.equal(adapter.get(record.memoryRef)?.summary, "SimpleMem compatible note");
  assert.equal(attachments.length, 1);
});

test("InMemoryMemoryProvider prune removes expired TTL memories", () => {
  const provider = new InMemoryMemoryProvider();
  provider.add({
    memoryRef: "expired",
    summary: "Expired note",
    content: "This record should be pruned.",
    tags: ["ttl"],
    importance: 0.2,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    provenance: {
      sessionId: "session-1",
      sourceKind: "system"
    },
    retention: {
      strategy: "ttl",
      ttlDays: 1
    }
  });

  const removed = provider.prune();

  assert.equal(removed.length, 1);
  assert.equal(provider.get("expired"), undefined);
});
