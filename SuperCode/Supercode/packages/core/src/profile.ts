import type {
  ExecutionProfile,
  HostCapabilities,
  ModelCapabilities,
  ProjectProfile,
  PromptBudgetProfile,
  SafetyProfile,
  VerificationLevel,
  WorkflowRecommendation,
  InvocationContext
} from "./types.js";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function deriveVerificationLevel(
  project: ProjectProfile,
  model: ModelCapabilities,
  host: HostCapabilities
): VerificationLevel {
  if (project.primaryLanguage === "typescript" && project.scripts.test && model.supportsTools && host.supportsTools) {
    return "strict";
  }

  if (project.primaryLanguage !== "unknown") {
    return "standard";
  }

  return "light";
}

export function derivePromptBudgetProfile(model: ModelCapabilities): PromptBudgetProfile {
  if (model.contextWindow === "small" || model.source === "unknown") {
    return "compact";
  }

  if (model.contextWindow === "large") {
    return "rich";
  }

  return "balanced";
}

export function createExecutionProfile(input: {
  invocation: InvocationContext;
  host: HostCapabilities;
  model: ModelCapabilities;
  project: ProjectProfile;
  safety: SafetyProfile;
  workflowRecommendation?: WorkflowRecommendation;
}): ExecutionProfile {
  const recommendedPackIds = input.workflowRecommendation?.recommendedPackIds ?? [];
  const notes = unique([
    ...(input.host.notes ?? []),
    ...(input.model.notes ?? []),
    input.project.gitDirty ? "Git working tree is dirty; verification should avoid destructive assumptions." : "",
    input.project.projectRoot !== input.project.cwd
      ? `Project signals were resolved from ${input.project.projectRoot} while the current working directory is ${input.project.cwd}.`
      : "",
    input.model.source === "unknown" ? "Model metadata is incomplete; Supercode is using conservative defaults." : "",
    input.host.source === "unknown" ? "Host metadata is incomplete; Supercode is treating the session as a generic CLI environment." : ""
  ]);

  return {
    invocation: input.invocation,
    host: input.host,
    model: input.model,
    project: input.project,
    safety: input.safety,
    recommendedPackIds,
    recommendationReasons: input.workflowRecommendation?.reasons ?? {},
    verificationLevel: deriveVerificationLevel(input.project, input.model, input.host),
    promptBudgetProfile: derivePromptBudgetProfile(input.model),
    notes
  };
}
