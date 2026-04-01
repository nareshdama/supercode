import { randomUUID } from "node:crypto";
import type {
  HostCapabilities,
  McpInvocationRequest,
  McpInvocationAttempt,
  McpInvocationResult,
  McpRuntime,
  McpRuntimeConfig,
  McpRuntimeSummary,
  McpServerConfig,
  McpServerStatus,
  MCPConnectionState
} from "@supercode/core";
import { detectMcpSupport, loadMcpRuntimeConfig } from "./config.js";
import { SessionManager } from "./session.js";

export interface LocalMcpRuntimeOptions {
  cwd: string;
  host: HostCapabilities;
  env?: NodeJS.ProcessEnv;
}

class McpTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`MCP invocation timed out after ${timeoutMs}ms.`);
    this.name = "McpTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new McpTimeoutError(timeoutMs));
    }, timeoutMs);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function sortServers<T extends { serverId: string }>(servers: T[]): T[] {
  return servers.sort((left, right) => left.serverId.localeCompare(right.serverId));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function finalizeFailure(
  requestId: string,
  serverId: string,
  toolName: string,
  attempts: McpInvocationAttempt[],
  error: string,
  completedAt: string,
  timedOut: boolean
): McpInvocationResult {
  return {
    requestId,
    serverId,
    toolName,
    ok: false,
    error,
    attemptCount: attempts.length,
    attempts: attempts.map(attempt => clone(attempt)),
    timedOut,
    completedAt
  };
}

function isNonRetryableError(error: string): boolean {
  return /unknown server|not available|disabled|does not expose|http 4\d\d|eperm|operation not permitted|access is denied/i.test(error);
}

export class LocalMcpRuntime implements McpRuntime {
  private readonly cwd: string;
  private readonly config: McpRuntimeConfig;
  private readonly summary: McpRuntimeSummary;
  private readonly sessions = new Map<string, SessionManager>();

  constructor(options: LocalMcpRuntimeOptions) {
    this.cwd = options.cwd;
    this.config = loadMcpRuntimeConfig(options.cwd);
    this.summary = detectMcpSupport(options.cwd, options.host, options.env);
  }

  getSummary(): McpRuntimeSummary {
    return clone(this.summary);
  }

  getConfig(): McpRuntimeConfig {
    return clone(this.config);
  }

  listServers(): McpServerStatus[] {
    return sortServers(
      this.config.servers.map(server => ({
        serverId: server.serverId,
        transport: server.transport,
        enabled: server.enabled,
        trusted: server.trusted,
        available: this.summary.available && server.enabled,
        timeoutMs: server.timeoutMs,
        retryCount: server.retryCount,
        notes: [...server.notes]
      }))
    );
  }

  private getOrCreateSession(server: McpServerConfig): SessionManager {
    let session = this.sessions.get(server.serverId);
    if (!session) {
      session = new SessionManager(server, this.cwd);
      this.sessions.set(server.serverId, session);
    }
    return session;
  }

  async invoke(
    requestInput: Omit<McpInvocationRequest, "requestId" | "requestedAt">
  ): Promise<McpInvocationResult> {
    const requestId = randomUUID();
    const server = this.config.servers.find(candidate => candidate.serverId === requestInput.serverId);
    if (!server) {
      return finalizeFailure(requestId, requestInput.serverId, requestInput.toolName, [], `Unknown MCP server: ${requestInput.serverId}.`, now(), false);
    }

    if (!this.summary.available) {
      return finalizeFailure(requestId, requestInput.serverId, requestInput.toolName, [], "MCP is not available in the current runtime.", now(), false);
    }

    if (!server.enabled) {
      return finalizeFailure(requestId, requestInput.serverId, requestInput.toolName, [], `MCP server ${server.serverId} is disabled in the active config.`, now(), false);
    }

    const session = this.getOrCreateSession(server);

    // Initialize if disconnected or configured
    if (session.state === "configured" || session.state === "disconnected") {
      try {
        await session.connect();
      } catch (err) {
        return finalizeFailure(requestId, requestInput.serverId, requestInput.toolName, [], `Failed to connect to MCP server: ${toErrorMessage(err)}`, now(), false);
      }
    }

    if (session.state === "quarantined" || session.state === "backoff") {
      const stateMsg = session.state === "quarantined" ? "quarantined" : "currently in backoff due to previous errors";
      return finalizeFailure(requestId, requestInput.serverId, requestInput.toolName, [], `MCP server ${server.serverId} is ${stateMsg} and cannot accept requests.`, now(), false);
    }

    const timeoutMs = Math.max(1, Math.floor(requestInput.timeoutMs ?? server.timeoutMs));
    const retryCount = Math.max(0, Math.floor(requestInput.retryCount ?? server.retryCount));
    const maxAttempts = retryCount + 1;
    const argumentsInput = clone(requestInput.arguments ?? {});
    const attempts: McpInvocationAttempt[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = now();

      try {
        // Use concurrency queue (Backpressure)
        const response = await session.healthMonitor.acquireConcurrency(() =>
          withTimeout(
            session.send({
              jsonrpc: "2.0",
              id: randomUUID(),
              method: `tools/call`,
              params: {
                name: requestInput.toolName,
                arguments: argumentsInput
              }
            }),
            timeoutMs
          )
        );

        const completedAt = now();
        
        // Handle JSON-RPC Error object
        if (response && "error" in response && response.error) {
           throw new Error(response.error.message);
        }

        attempts.push({ attempt, startedAt, completedAt, ok: true, timedOut: false });
        session.recordSuccess();

        return {
          requestId,
          serverId: server.serverId,
          toolName: requestInput.toolName,
          ok: true,
          response: clone(response && "result" in response ? response.result : response),
          attemptCount: attempts.length,
          attempts: attempts.map(entry => clone(entry)),
          timedOut: false,
          completedAt
        };
      } catch (error) {
        const completedAt = now();
        const message = toErrorMessage(error);
        const timedOut = error instanceof McpTimeoutError;

        session.recordFailure(message);

        attempts.push({ attempt, startedAt, completedAt, ok: false, timedOut, error: message });

        if (attempt >= maxAttempts || isNonRetryableError(message) || (session.state as any) === "degraded" || (session.state as any) === "backoff") {
          return finalizeFailure(
            requestId,
            server.serverId,
            requestInput.toolName,
            attempts,
            message,
            completedAt,
            attempts.some(entry => entry.timedOut)
          );
        }
      }
    }

    return finalizeFailure(
      requestId,
      server.serverId,
      requestInput.toolName,
      attempts,
      `MCP invocation for ${server.serverId}.${requestInput.toolName} failed without a terminal result.`,
      now(),
      attempts.some(entry => entry.timedOut)
    );
  }

  async destroy(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.disconnect();
    }
  }
}

export function createMcpRuntime(
  cwd: string,
  host: HostCapabilities,
  env: NodeJS.ProcessEnv = process.env
): LocalMcpRuntime {
  return new LocalMcpRuntime({ cwd, host, env });
}
