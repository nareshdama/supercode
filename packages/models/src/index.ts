import type { ContextWindowTier, ModelCapabilities, ModelProvider, ReasoningTier } from "@nareshdama/core";

type Signature = {
  matcher: RegExp;
  provider: ModelProvider;
  contextWindow: ContextWindowTier;
  reasoning: ReasoningTier;
  supportsTools: boolean;
  supportsStreaming: boolean;
};

const MODEL_SIGNATURES: Signature[] = [
  { matcher: /^gpt-5/i, provider: "openai", contextWindow: "large", reasoning: "deep", supportsTools: true, supportsStreaming: true },
  { matcher: /^gpt-4\.1/i, provider: "openai", contextWindow: "large", reasoning: "balanced", supportsTools: true, supportsStreaming: true },
  { matcher: /^gpt-4o/i, provider: "openai", contextWindow: "medium", reasoning: "balanced", supportsTools: true, supportsStreaming: true },
  { matcher: /^o[13]/i, provider: "openai", contextWindow: "large", reasoning: "deep", supportsTools: true, supportsStreaming: true },
  { matcher: /^o4/i, provider: "openai", contextWindow: "large", reasoning: "deep", supportsTools: true, supportsStreaming: true },
  { matcher: /^claude/i, provider: "anthropic", contextWindow: "large", reasoning: "deep", supportsTools: true, supportsStreaming: true },
  { matcher: /gemini/i, provider: "google", contextWindow: "large", reasoning: "balanced", supportsTools: true, supportsStreaming: true },
  { matcher: /(llama|mistral|qwen|deepseek|phi)/i, provider: "local", contextWindow: "medium", reasoning: "balanced", supportsTools: true, supportsStreaming: true }
];

export function inferProviderFromModelId(modelId?: string): ModelProvider {
  if (!modelId) {
    return "unknown";
  }

  const match = MODEL_SIGNATURES.find(signature => signature.matcher.test(modelId));
  return match?.provider ?? "unknown";
}

export function inferModelCapabilities(modelId?: string, provider?: string): ModelCapabilities {
  if (!modelId) {
    return {
      provider: provider ?? "unknown",
      supportsTools: false,
      supportsStreaming: false,
      contextWindow: "unknown",
      reasoning: "unknown",
      source: "unknown",
      confidence: "low",
      notes: ["No model metadata was provided by the host."]
    };
  }

  const match = MODEL_SIGNATURES.find(signature => signature.matcher.test(modelId));
  const inferredProvider = provider ?? match?.provider ?? inferProviderFromModelId(modelId);

  return {
    provider: inferredProvider,
    modelId,
    supportsTools: match?.supportsTools ?? false,
    supportsStreaming: match?.supportsStreaming ?? false,
    contextWindow: match?.contextWindow ?? "unknown",
    reasoning: match?.reasoning ?? "unknown",
    source: provider ? "explicit" : "inferred",
    confidence: match ? "medium" : "low",
    notes: match ? [] : ["Model family is not in the built-in catalog; using conservative capability defaults."]
  };
}

export function getKnownModelFamilies(): string[] {
  return ["gpt-5", "gpt-4.1", "gpt-4o", "o1/o3", "o4", "claude", "gemini", "llama/mistral/qwen/deepseek/phi"];
}

// Phase 3 exports
export { BaseModelProvider } from "./provider.js";
export type { BaseProviderOptions, FetchFn } from "./provider.js";
export { OpenAIProvider } from "./openai-provider.js";
export { AnthropicProvider } from "./anthropic-provider.js";
export { ModelCatalog } from "./catalog.js";
export type { ModelCatalogOptions } from "./catalog.js";
export { ModelRouter } from "./router.js";
export type { RoutingDecisionLog } from "./router.js";
export { PromptRegistry } from "./prompt-registry.js";
export { BudgetPolicy } from "./budget.js";
export type { BudgetPolicyOptions } from "./budget.js";
export { runEvaluation } from "./eval.js";
export type { EvaluationCase, EvaluationSuite, EvaluationCaseResult, EvaluationReport } from "./eval.js";
