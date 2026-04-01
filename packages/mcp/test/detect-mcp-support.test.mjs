import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectMcpSupport } from "../dist/index.js";

const HOST = {
  hostId: "generic-cli",
  displayName: "Generic CLI",
  supportsTools: true,
  supportsMcp: true,
  supportsStreaming: true,
  supportsMultiAgent: false,
  source: "default",
  confidence: "medium"
};

test("detectMcpSupport parses project config and trust posture", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  writeFileSync(
    path.join(cwd, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["@modelcontextprotocol/server-filesystem"],
            trusted: true
          },
          github: {
            command: "npx",
            args: ["@modelcontextprotocol/server-github"],
            trust: "untrusted"
          }
        }
      },
      null,
      2
    )
  );

  const summary = detectMcpSupport(cwd, HOST);

  assert.equal(summary.configured, true);
  assert.equal(summary.configSource, "project");
  assert.equal(summary.serverCount, 2);
  assert.deepEqual(summary.serverIds, ["filesystem", "github"]);
  assert.equal(summary.trustMode, "mixed");
});

test("detectMcpSupport prefers project config over .supercode config", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  mkdirSync(path.join(cwd, ".supercode"), { recursive: true });

  writeFileSync(
    path.join(cwd, ".mcp.json"),
    JSON.stringify({
      servers: {
        filesystem: {
          command: "npx"
        }
      }
    })
  );
  writeFileSync(
    path.join(cwd, ".supercode", "mcp.json"),
    JSON.stringify({
      servers: {
        memory: {
          command: "npx"
        }
      }
    })
  );

  const summary = detectMcpSupport(cwd, HOST);

  assert.equal(summary.configSource, "project");
  assert.deepEqual(summary.serverIds, ["filesystem"]);
  assert.ok(summary.notes.some(note => /takes precedence/i.test(note)));
});

test("detectMcpSupport handles disabled MCP safely", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  writeFileSync(
    path.join(cwd, ".mcp.json"),
    JSON.stringify({
      servers: {
        filesystem: {
          command: "npx"
        }
      }
    })
  );

  const summary = detectMcpSupport(cwd, HOST, {
    SUPERCODE_DISABLE_MCP: "1"
  });

  assert.equal(summary.available, false);
  assert.equal(summary.configured, true);
  assert.ok(summary.notes.some(note => /disabled explicitly/i.test(note)));
});
