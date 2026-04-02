import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { createMcpRuntime, loadMcpRuntimeConfig, SessionManager } from "../dist/index.js";

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

function writeBuiltinConfig(cwd, overrides = {}) {
  writeFileSync(
    path.join(cwd, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          local: {
            transport: "builtin",
            trusted: true,
            timeoutMs: 40,
            retryCount: 1,
            ...overrides
          }
        }
      },
      null,
      2
    )
  );
}

function writeStdioConfig(cwd, scriptPath, overrides = {}) {
  writeFileSync(
    path.join(cwd, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          local: {
            transport: "stdio",
            trusted: true,
            command: process.execPath,
            args: [scriptPath],
            timeoutMs: 200,
            retryCount: 0,
            ...overrides
          }
        }
      },
      null,
      2
    )
  );
}

function writeHttpConfig(cwd, url, overrides = {}) {
  writeFileSync(
    path.join(cwd, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          remote: {
            transport: "http",
            trusted: true,
            url,
            timeoutMs: 200,
            retryCount: 0,
            ...overrides
          }
        }
      },
      null,
      2
    )
  );
}

test("loadMcpRuntimeConfig parses builtin server transport and defaults", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  writeBuiltinConfig(cwd);

  const config = loadMcpRuntimeConfig(cwd);

  assert.equal(config.configSource, "project");
  assert.equal(config.servers[0].transport, "builtin");
});

test("LocalMcpRuntime invokes builtin logic over mock JSON-RPC", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  writeBuiltinConfig(cwd);

  const runtime = createMcpRuntime(cwd, HOST);
  const result = await runtime.invoke({
    serverId: "local",
    toolName: "echo",
    arguments: { message: "hello" }
  });

  // the builtin mock currently always returns { capabilities: { tools: [] } }
  assert.equal(result.ok, true);
  assert.equal(result.attemptCount, 1);
  await runtime.destroy();
});

test("LocalMcpRuntime invokes stdio MCP servers over JSON-RPC", async t => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  const scriptPath = path.join(cwd, "stdio-server.mjs");
  
  // A simple JSON-RPC mock server over stdio
  writeFileSync(
    scriptPath,
    [
      "import { createInterface } from 'readline';",
      "const rl = createInterface({ input: process.stdin, output: process.stdout });",
      "rl.on('line', (line) => {",
      "  const req = JSON.parse(line);",
      "  if (req.method === 'initialize') {",
      "    console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { capabilities: {} } }));",
      "  } else if (req.method === 'tools/list') {",
      "    console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { tools: [] } }));",
      "  } else if (req.method === 'resources/list') {",
      "    console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { resources: [] } }));",
      "  } else if (req.method === 'tools/call') {",
      "    console.log(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { content: [{type:'text', text:'hello from stdio'}] } }));",
      "  }",
      "});"
    ].join("\n"),
    "utf8"
  );
  writeStdioConfig(cwd, scriptPath);

  const runtime = createMcpRuntime(cwd, HOST);
  const result = await runtime.invoke({
    serverId: "local",
    toolName: "echo",
    arguments: { message: "hello" }
  });

  if (!result.ok && /eperm|operation not permitted|access is denied/i.test(result.error ?? "")) {
    t.skip("Stdio child-process spawning is blocked in the current sandbox.");
  }

  assert.equal(result.ok, true);
  assert.deepEqual(result.response, { content: [{type:'text', text:'hello from stdio'}] });
  await runtime.destroy();
});

test("LocalMcpRuntime invokes HTTP MCP servers over JSON-RPC", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", chunk => body += chunk);
    request.on("end", () => {
      const payload = JSON.parse(body);
      response.writeHead(200, { "content-type": "application/json" });
      
      if (payload.method === 'initialize') {
        response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: { capabilities: {} } }));
      } else if (payload.method === 'tools/list') {
        response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: { tools: [] } }));
      } else if (payload.method === 'resources/list') {
         response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: { resources: [] } }));
      } else if (payload.method === 'tools/call') {
        response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: { content: [{type:'text', text:'hello from http'}] } }));
      } else {
         response.end(JSON.stringify({ jsonrpc: "2.0" }));
      }
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  
  try {
    writeHttpConfig(cwd, `http://127.0.0.1:${address.port}/invoke`);
    const runtime = createMcpRuntime(cwd, HOST);
    const result = await runtime.invoke({
      serverId: "remote",
      toolName: "echo",
      arguments: { message: "hello" }
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.response, { content: [{type:'text', text:'hello from http'}] });
    await runtime.destroy();
  } finally {
    server.close();
  }
});

test("LocalMcpRuntime enforces concurrency limits via health monitor", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  writeBuiltinConfig(cwd, {
    concurrencyLimit: 1,
    queueLimit: 1
  });

  const runtime = createMcpRuntime(cwd, HOST);
  const startedAt = Date.now();
  const results = await Promise.all([
    runtime.invoke({ serverId: "local", toolName: "echo", arguments: { i: 1, delayMs: 40 } }),
    runtime.invoke({ serverId: "local", toolName: "echo", arguments: { i: 2, delayMs: 40 } }),
    runtime.invoke({ serverId: "local", toolName: "echo", arguments: { i: 3, delayMs: 40 } })
  ]);
  const durationMs = Date.now() - startedAt;
  const succeeded = results.filter(result => result.ok);
  const failed = results.filter(result => !result.ok);

  assert.equal(succeeded.length, 2);
  assert.equal(failed.length, 1);
  assert.match(failed[0].error, /queue limit exceeded/i);
  assert.ok(durationMs >= 70);
  await runtime.destroy();
});

test("LocalMcpRuntime rejects invocations for servers in backoff", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  writeBuiltinConfig(cwd, {
    retryCount: 0
  });

  const runtime = createMcpRuntime(cwd, HOST);
  for (let i = 0; i < 5; i++) {
    await runtime.invoke({ serverId: "local", toolName: "fail", arguments: { message: "crash" } });
  }
  
  const finalResult = await runtime.invoke({ serverId: "local", toolName: "echo", arguments: {} });
  assert.equal(finalResult.ok, false);
  assert.match(finalResult.error, /backoff/);
  
  await runtime.destroy();
});

test("SessionManager transitions through degraded and back to ready", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  const session = new SessionManager(
    {
      serverId: "local",
      transport: "builtin",
      enabled: true,
      trusted: true,
      timeoutMs: 50,
      retryCount: 0,
      concurrencyLimit: 1,
      queueLimit: 1,
      notes: []
    },
    cwd
  );

  await session.connect();
  assert.equal(session.state, "ready");

  session.recordFailure("recoverable transport error");
  assert.equal(session.state, "degraded");

  session.recordSuccess();
  assert.equal(session.state, "ready");

  await session.disconnect();
});

test("LocalMcpRuntime quarantines servers on capability schema violations", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "supercode-mcp-"));
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", chunk => body += chunk);
    request.on("end", () => {
      const payload = JSON.parse(body);
      response.writeHead(200, { "content-type": "application/json" });

      if (payload.method === "initialize") {
        response.end(JSON.stringify({
          jsonrpc: "2.0",
          id: payload.id,
          result: { capabilities: { tools: {} } }
        }));
        return;
      }

      if (payload.method === "tools/list") {
        response.end(JSON.stringify({
          jsonrpc: "2.0",
          id: payload.id,
          result: { tools: {} }
        }));
        return;
      }

      response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result: {} }));
    });
  });

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    writeHttpConfig(cwd, `http://127.0.0.1:${address.port}/invoke`);
    const runtime = createMcpRuntime(cwd, HOST);

    const first = await runtime.invoke({
      serverId: "remote",
      toolName: "echo",
      arguments: { message: "hello" }
    });
    assert.equal(first.ok, false);
    assert.match(first.error, /capability schema violation/i);

    const second = await runtime.invoke({
      serverId: "remote",
      toolName: "echo",
      arguments: { message: "hello again" }
    });
    assert.equal(second.ok, false);
    assert.match(second.error, /quarantined/i);

    await runtime.destroy();
  } finally {
    server.close();
  }
});
