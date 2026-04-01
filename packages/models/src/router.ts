import type {
  ModelDescriptor,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelSelectionDecision,
  ModelSelectionRequest
} from "@supercode/core";
import type { ModelCatalog } from "./catalog.js";

const TRUST_SCORES: Record<string, number> = {
  first_party: 3,
  approved_third_party: 2,
  restricted: 1
};

const LATENCY_SCORES: Record<string, Record<string, number>> = {
  interactive: { fast: 3, balanced: 2, deep: 1 },
  background: { deep: 3, balanced: 2, fast: 1 }
};

function scoreModel(model: ModelDescriptor, request: ModelSelectionRequest): number {
  let score = 0;

  // Capability match (mandatory).
  if (request.requiresTools && !model.supportsTools) return -1;
  if (request.requiresStreaming && !model.supportsStreaming) return -1;

  // Trust tier.
  score += (TRUST_SCORES[model.trustTier] ?? 0) * 10;

  // Latency alignment.
  const latencyMap = LATENCY_SCORES[request.latencyTarget] ?? LATENCY_SCORES.interactive;
  score += (latencyMap[model.latencyTier] ?? 0) * 5;

  // Cost efficiency (lower is better — invert).
  const costScore = 1 / (model.cost.inputPer1kTokens + model.cost.outputPer1kTokens + 0.0001);
  score += Math.min(costScore, 20);

  // Preference bonuses.
  if (request.preferredProviderId && model.providerId === request.preferredProviderId) {
    score += 15;
  }
  if (request.preferredModelId && model.modelId === request.preferredModelId) {
    score += 25;
  }

  // Context window bonus (larger is better for complex tasks).
  if (model.contextWindow >= 200_000) {
    score += 3;
  } else if (model.contextWindow >= 100_000) {
    score += 1;
  }

  return score;
}

export interface RoutingDecisionLog {
  request: ModelSelectionRequest;
  decision: ModelSelectionDecision;
  scores: Array<{ modelId: string; providerId: string; score: number }>;
  timestamp: string;
}

export class ModelRouter {
  private readonly catalog: ModelCatalog;
  private readonly decisionLog: RoutingDecisionLog[] = [];

  constructor(catalog: ModelCatalog) {
    this.catalog = catalog;
  }

  select(request: ModelSelectionRequest): ModelSelectionDecision {
    const allModels = this.catalog.listModels();
    const healthMap = new Map(
      this.catalog.getHealth().map(h => [h.providerId, h])
    );

    // Score and filter.
    const scored = allModels
      .map(model => {
        let score = scoreModel(model, request);

        // Penalize unhealthy providers.
        const health = healthMap.get(model.providerId);
        if (health) {
          if (health.status === "degraded") score -= 10;
          if (health.status === "down") score -= 50;
        }

        return { model, score };
      })
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      throw new Error("No models available that match the request requirements.");
    }

    const primary = scored[0].model;
    const fallbacks = scored
      .slice(1)
      .filter(entry => entry.model.providerId !== primary.providerId || entry.model.modelId !== primary.modelId)
      .slice(0, 2)
      .map(entry => entry.model);

    const reason = this.buildReason(primary, request, scored[0].score);

    const decision: ModelSelectionDecision = { primary, fallbacks, reason };

    this.decisionLog.push({
      request,
      decision,
      scores: scored.map(s => ({ modelId: s.model.modelId, providerId: s.model.providerId, score: s.score })),
      timestamp: new Date().toISOString()
    });

    return decision;
  }

  async invoke(request: ModelSelectionRequest, invocationRequest: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const decision = this.select(request);
    const chain = [decision.primary, ...decision.fallbacks];

    let lastError: Error | undefined;

    for (const model of chain) {
      try {
        const result = await this.catalog.invoke(model.providerId, {
          ...invocationRequest,
          modelId: model.modelId
        });
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("All models in the fallback chain failed.");
  }

  getDecisionLog(): RoutingDecisionLog[] {
    return [...this.decisionLog];
  }

  clearDecisionLog(): void {
    this.decisionLog.length = 0;
  }

  private buildReason(model: ModelDescriptor, request: ModelSelectionRequest, score: number): string {
    const parts: string[] = [
      `Selected ${model.modelId} (${model.providerId})`,
      `score=${score.toFixed(1)}`,
      `latency=${model.latencyTier}`,
      `trust=${model.trustTier}`
    ];

    if (request.preferredModelId === model.modelId) {
      parts.push("matched-preferred-model");
    }
    if (request.preferredProviderId === model.providerId) {
      parts.push("matched-preferred-provider");
    }

    return parts.join(", ");
  }
}
