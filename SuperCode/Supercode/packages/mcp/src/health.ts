import type { MCPHealthStatus, MCPConnectionState } from "@supercode/core";

export interface HealthMonitorOptions {
  degradedThreshold?: number;
  backoffThreshold?: number;
  concurrencyLimit?: number;
}

export class MCPHealthMonitor {
  private status: "healthy" | "degraded" | "down" = "healthy";
  private errorCount = 0;
  private lastError?: string;
  private lastCheckedAt: string;
  private activeRequests = 0;
  
  private readonly degradedThreshold: number;
  private readonly backoffThreshold: number;
  private readonly concurrencyLimit: number;

  constructor(options?: HealthMonitorOptions) {
    this.degradedThreshold = options?.degradedThreshold ?? 1;
    this.backoffThreshold = options?.backoffThreshold ?? 3;
    this.concurrencyLimit = options?.concurrencyLimit ?? 5;
    this.lastCheckedAt = new Date().toISOString();
  }

  getHealth(): MCPHealthStatus {
    return {
      status: this.status,
      errorCount: this.errorCount,
      lastError: this.lastError,
      lastCheckedAt: this.lastCheckedAt
    };
  }

  recordSuccess(latencyMs?: number): void {
    this.errorCount = 0;
    this.status = "healthy";
    this.lastCheckedAt = new Date().toISOString();
  }

  recordFailure(error: Error | string): void {
    this.errorCount += 1;
    this.lastError = error instanceof Error ? error.message : String(error);
    this.lastCheckedAt = new Date().toISOString();

    if (this.errorCount >= this.backoffThreshold) {
      this.status = "down";
    } else if (this.errorCount >= this.degradedThreshold) {
      this.status = "degraded";
    }
  }

  evaluateStateTransition(currentState: MCPConnectionState): MCPConnectionState {
    if (currentState === "quarantined" || currentState === "disconnected") {
      return currentState; // Terminal/locked states
    }

    if (this.status === "down") {
      return "backoff";
    }
    
    if (this.status === "degraded" && currentState === "ready") {
      return "degraded";
    }

    if (this.status === "healthy" && (currentState === "degraded" || currentState === "backoff")) {
      return "ready";
    }

    return currentState;
  }

  canAcceptRequest(): boolean {
    return this.activeRequests < this.concurrencyLimit;
  }

  async acquireConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canAcceptRequest()) {
      throw new Error(`MCP concurrency limit exceeded (${this.concurrencyLimit} active requests).`);
    }

    this.activeRequests += 1;
    try {
      return await fn();
    } finally {
      this.activeRequests -= 1;
    }
  }
}
