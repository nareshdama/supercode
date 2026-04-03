import type { MCPHealthStatus, MCPConnectionState } from "@nareshdama/core";

export interface HealthMonitorOptions {
  degradedThreshold?: number;
  backoffThreshold?: number;
  concurrencyLimit?: number;
  queueLimit?: number;
}

export class MCPHealthMonitor {
  private status: "healthy" | "degraded" | "down" = "healthy";
  private errorCount = 0;
  private lastError?: string;
  private lastCheckedAt: string;
  private activeRequests = 0;
  private readonly waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  
  private readonly degradedThreshold: number;
  private readonly backoffThreshold: number;
  private readonly concurrencyLimit: number;
  private readonly queueLimit: number;

  constructor(options?: HealthMonitorOptions) {
    this.degradedThreshold = options?.degradedThreshold ?? 1;
    this.backoffThreshold = options?.backoffThreshold ?? 3;
    this.concurrencyLimit = options?.concurrencyLimit ?? 5;
    this.queueLimit = options?.queueLimit ?? 10;
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

  private acquireSlot(): Promise<void> {
    if (this.canAcceptRequest()) {
      this.activeRequests += 1;
      return Promise.resolve();
    }

    if (this.waitQueue.length >= this.queueLimit) {
      return Promise.reject(
        new Error(
          `MCP request queue limit exceeded (${this.queueLimit} queued requests).`
        )
      );
    }

    return new Promise((resolve, reject) => {
      this.waitQueue.push({
        resolve: () => resolve(),
        reject
      });
    });
  }

  private releaseSlot(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next.resolve();
      return;
    }

    if (this.activeRequests > 0) {
      this.activeRequests -= 1;
    }
  }

  async acquireConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      return await fn();
    } finally {
      this.releaseSlot();
    }
  }
}
