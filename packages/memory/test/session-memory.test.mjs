import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryMemoryProvider, SessionMemory, renderMemoryContext } from "../dist/index.js";

test("SessionMemory stores memories scoped to the current session and retrieves attachments", () => {
  const provider = new InMemoryMemoryProvider();
  const sessionMemory = new SessionMemory({
    provider,
    sessionId: "session-1",
    defaultTags: ["phase-5"]
  });

  sessionMemory.remember({
    summary: "Runtime uses file-backed state",
    content: "State is written under the .supercode directory.",
    taskId: "task-1",
    tags: ["state"],
    importance: 0.9
  });
  sessionMemory.rememberResult({
    summary: "Result previews are truncated safely",
    content: "Large outputs are stored as artifacts and previewed in result records.",
    taskId: "task-1",
    resultRef: "result-1",
    tags: ["results"],
    importance: 0.7
  });

  const attachments = sessionMemory.attachForTask({
    taskId: "task-1",
    limit: 5
  });

  assert.equal(attachments.length, 2);
  assert.equal(attachments[0].provenance.sessionId, "session-1");
  assert.match(renderMemoryContext(attachments), /\[memory:/);
});

test("SessionMemory listForSession excludes memories from other sessions", () => {
  const provider = new InMemoryMemoryProvider();
  const sessionOne = new SessionMemory({ provider, sessionId: "session-1" });
  const sessionTwo = new SessionMemory({ provider, sessionId: "session-2" });

  sessionOne.remember({
    summary: "Session one note",
    content: "Only session one should see this.",
    tags: ["session-one"]
  });
  sessionTwo.remember({
    summary: "Session two note",
    content: "Only session two should see this.",
    tags: ["session-two"]
  });

  assert.equal(sessionOne.listForSession().length, 1);
  assert.equal(sessionTwo.listForSession().length, 1);
});
