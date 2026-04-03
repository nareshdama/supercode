import { randomUUID } from "node:crypto";
import type {
  ModelDescriptor,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelProviderAdapter,
  ModelUsage,
  ProviderHealth,
  ProviderHealthStatus
} from "@nareshdama/core";

function now(): string {
  return new Date().toISOString();
}

export type FetchFn = typeof globalThis.fetch;

export interface BaseProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: FetchFn;
  defaultModel?: string;
}

export abstract class BaseModelProvider implements ModelProviderAdapter {
  abstract readonly providerId: string;
  abstract readonly displayName: string;

  protected readonly apiKey: string | undefined;
  protected readonly baseUrl: string;
  protected readonly fetchFn: FetchFn;
  protected readonly defaultModel: string;

  private errorCount = 0;
  private lastStatus: ProviderHealthStatus = "healthy";
  private lastCheckedAt: string = now();
  private lastLatencyMs: number | undefined;

  constructor(baseUrl: string, defaultModel: string, options?: BaseProviderOptions) {
    this.apiKey = options?.apiKey;
    this.baseUrl = options?.baseUrl ?? baseUrl;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.defaultModel = options?.defaultModel ?? defaultModel;
  }

  abstract listModels(): ModelDescriptor[];

  abstract invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;

  getHealth(): ProviderHealth {
    return {
      providerId: this.providerId,
      status: this.lastStatus,
      lastCheckedAt: this.lastCheckedAt,
      latencyMs: this.lastLatencyMs,
      errorCount: this.errorCount,
      notes: this.apiKey ? [] : ["No API key configured."]
    };
  }

  protected recordSuccess(latencyMs: number): void {
    this.lastStatus = "healthy";
    this.lastCheckedAt = now();
    this.lastLatencyMs = latencyMs;
    if (this.errorCount > 0) {
      this.errorCount = Math.max(0, this.errorCount - 1);
    }
  }

  protected recordFailure(): void {
    this.errorCount++;
    this.lastCheckedAt = now();
    if (this.errorCount >= 3) {
      this.lastStatus = "down";
    } else {
      this.lastStatus = "degraded";
    }
  }

  protected resolveModel(request: ModelInvocationRequest): string {
    return request.modelId ?? this.defaultModel;
  }

  protected makeRequestId(): string {
    return randomUUID();
  }

  protected computeUsage(input: number, output: number): ModelUsage {
    return { inputTokens: input, outputTokens: output, totalTokens: input + output };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
