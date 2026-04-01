import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { McpServerConfig, MCPServerSession, MCPConnectionState } from "@supercode/core";
import { MCPHealthMonitor } from "./health.js";
import { determineTrustClass, filterCapabilitiesByTrust } from "./trust.js";
import { negotiateCapabilities, JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from "./negotiation.js";

export class SessionManager {
  private child?: ChildProcessWithoutNullStreams;
  public readonly serverId: string;
  private readonly config: McpServerConfig;
  private readonly cwd: string;

  public state: MCPConnectionState = "configured";
  public healthMonitor: MCPHealthMonitor;
  public capabilities?: MCPServerSession["capabilities"];

  private readonly pendingRequests = new Map<string | number, { resolve: (resp: JsonRpcResponse) => void; reject: (err: Error) => void }>();
  private dataBuffer = "";

  constructor(config: McpServerConfig, cwd: string) {
    this.serverId = config.serverId;
    this.config = config;
    this.cwd = cwd;
    this.healthMonitor = new MCPHealthMonitor();
  }

  public getSession(): MCPServerSession {
    return {
      serverId: this.serverId,
      displayName: this.serverId,
      state: this.state,
      trustClass: determineTrustClass(this.config),
      capabilities: this.capabilities,
      health: this.healthMonitor.getHealth()
    };
  }

  private transitionState(newState: MCPConnectionState): void {
    this.state = this.healthMonitor.evaluateStateTransition(newState);
  }

  public recordSuccess(latencyMs?: number): void {
    this.healthMonitor.recordSuccess(latencyMs);
    this.transitionState(this.state);
  }

  public recordFailure(error: Error | string): void {
    this.healthMonitor.recordFailure(error);
    this.transitionState(this.state);
  }

  public async connect(): Promise<void> {
    if (this.state === "ready" || this.state === "connecting" || this.state === "negotiating") {
      return;
    }

    if (this.state === "quarantined") {
      throw new Error(`Cannot connect to quarantined server: ${this.serverId}`);
    }

    this.transitionState("connecting");

    try {
      if (this.config.transport === "builtin") {
        this.transitionState("ready");
        return; // Built-in transport is a mock for now
      }

      if (this.config.transport === "stdio") {
        await this.startStdio();
      } else if (this.config.transport === "http") {
        // HTTP servers don't "connect" per say but we verify they exist
      }

      this.transitionState("negotiating");

      // Negotiate capabilities
      const rawCaps = await negotiateCapabilities(async (msg) => this.send(msg));
      
      // Apply trust filters
      const trustClass = determineTrustClass(this.config);
      this.capabilities = filterCapabilitiesByTrust(rawCaps, trustClass);

      this.transitionState("ready");
      this.healthMonitor.recordSuccess();

    } catch (error) {
      this.healthMonitor.recordFailure(error instanceof Error ? error : String(error));
      this.transitionState("degraded");
      await this.disconnect();
      throw error;
    }
  }

  private startStdio(): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = this.config.command;
      if (!command) {
        return reject(new Error("Missing command for stdio transport"));
      }

      this.child = spawn(command, this.config.args ?? [], {
        cwd: this.cwd,
        env: { ...process.env, ...(this.config.env ?? {}) },
        stdio: ["pipe", "pipe", "pipe"]
      });

      this.child.stdout.setEncoding("utf8");
      this.child.stdout.on("data", (chunk: string) => this.handleStdioData(chunk));

      this.child.stderr.setEncoding("utf8");
      this.child.stderr.on("data", (chunk: string) => {
        // Some servers log to stderr heavily, ignore unless close event fires
      });

      this.child.on("error", (err) => {
        this.healthMonitor.recordFailure(`Process error: ${err.message}`);
        this.transitionState("disconnected");
        reject(err);
      });

      this.child.on("close", (code) => {
        if (code !== 0 && code !== null) {
          this.healthMonitor.recordFailure(`Exited with code ${code}`);
        }
        this.transitionState("disconnected");
      });

      resolve();
    });
  }

  private handleStdioData(chunk: string): void {
    this.dataBuffer += chunk;
    const lines = this.dataBuffer.split("\n");
    this.dataBuffer = lines.pop() ?? ""; // keep incomplete chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const payload = JSON.parse(trimmed);
        
        // Handle JSON-RPC response
        if (payload.jsonrpc === "2.0" && ("result" in payload || "error" in payload) && payload.id !== undefined) {
          const pending = this.pendingRequests.get(payload.id);
          if (pending) {
            this.pendingRequests.delete(payload.id);
            pending.resolve(payload);
          }
        }
      } catch {
        // Not JSON, skip
      }
    }
  }

  public send(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | void> {
    if (this.state === "quarantined") {
      return Promise.reject(new Error("Server quarantined"));
    }

    if (this.config.transport === "builtin") {
      const id = "id" in message ? message.id : randomUUID();
      if (message.method === "initialize") {
        return Promise.resolve({ jsonrpc: "2.0", id, result: { capabilities: { tools: [] } } });
      }
      if (message.method === "tools/call" && message.params && typeof message.params === "object") {
        const { name, arguments: args } = message.params as any;
        if (name === "echo") return Promise.resolve({ jsonrpc: "2.0", id, result: { serverId: this.serverId, toolName: name, arguments: args } });
        if (name === "fail") return Promise.reject(new Error(args?.message || "Builtin MCP tool fail failed."));
      }
      return Promise.resolve({ jsonrpc: "2.0", id, result: { capabilities: { tools: [] } } });
    }

    if (this.config.transport === "stdio") {
      return this.sendStdio(message);
    }

    if (this.config.transport === "http") {
      return this.sendHttp(message);
    }

    return Promise.reject(new Error("Unsupported transport"));
  }

  private sendStdio(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | void> {
    return new Promise((resolve, reject) => {
      if (!this.child || this.child.killed) {
        return reject(new Error("Stdio process is not running"));
      }

      if ("id" in message) {
        this.pendingRequests.set(message.id, { resolve, reject });
      } else {
        resolve(); // notifications don't get resolved with response
      }

      this.child.stdin.write(JSON.stringify(message) + "\n");
    });
  }

  private async sendHttp(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | void> {
    if (!this.config.url) throw new Error("Missing HTTP URL");

    const response = await fetch(this.config.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...this.config.headers },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    if ("id" in message) {
      return response.json() as Promise<JsonRpcResponse>;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    
    // Fail all pending
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    if (this.state !== "quarantined") {
      this.transitionState("disconnected");
    }
  }
}
