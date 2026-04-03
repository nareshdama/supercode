import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  ExecutionProfile,
  MemoryAttachment,
  MemoryProvider,
  MemoryQuery,
  McpInvocationResult,
  McpRuntimeSummary,
  PermissionActionCategory,
  PermissionDecision,
  PermissionRequest,
  ResultRecord,
  SessionState,
  SupercodeConfig,
  TaskRecord,
  ToolExecutionContext,
  ToolResult
} from "@supercode/core";
import type { WorkflowHookEvent, WorkflowHookExecution, WorkflowHookRunResult } from "@supercode/core";
import { InMemoryMemoryProvider, SessionMemory, SimpleMemAdapter } from "@supercode/memory";
import { createMcpRuntime, type LocalMcpRuntime } from "@supercode/mcp";
import { DefaultPermissionSystem } from "@supercode/permissions";
import { InMemoryProgressTracker } from "@supercode/progress";
import { FileRuntimeStateStore } from "@supercode/state";
import { InMemoryTaskManager, SimpleTaskExecutor } from "@supercode/tasks";
import { ExecutableToolRegistry, registerFirstPartyTools } from "@supercode/tools";
import { loadResolvedWorkflowHooks, loadResolvedWorkflowPluginTools, rankRulesForTask, rankSkillsForTask } from "@supercode/workflows";

export interface PersistedRuntimeContext {
  cwd: string;
  config: SupercodeConfig;
  executionProfile: ExecutionProfile;
  stateStore: FileRuntimeStateStore;
  session: SessionState;
  taskManager: InMemoryTaskManager;
  progressTracker: InMemoryProgressTracker;
  permissionSystem: DefaultPermissionSystem;
  mcpRuntime: LocalMcpRuntime;
  memoryProvider?: MemoryProvider;
  sessionMemory?: SessionMemory;
  toolRegistry: ExecutableToolRegistry;
  executor: SimpleTaskExecutor;
}

export interface RuntimePermissionOverrides {
  allowCategories?: PermissionActionCategory[];
  denyCategories?: PermissionActionCategory[];
}

type WorkflowMatchInput = {
  task: string;
  activePackIds?: string[];
};

type RankedWorkflowSelection = {
  id: string;
  title: string;
  summary: string;
  score: number;
  reasons: string[];
  sourceType: "pack" | "plugin";
  sourceId: string;
  sourceTitle: string;
  path?: string;
};

export interface WorkflowMatchOutput {
  task: string;
  activePackIds: string[];
  verificationLevel: ExecutionProfile["verificationLevel"];
  promptBudgetProfile: ExecutionProfile["promptBudgetProfile"];
  matchedSkills: RankedWorkflowSelection[];
  matchedRules: RankedWorkflowSelection[];
}

export interface McpInvokeInput {
  serverId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  timeoutMs?: number;
  retryCount?: number;
}

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function interpolateHookString(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawPath) => {
    const pathSegments = String(rawPath)
      .split(".")
      .map(segment => segment.trim())
      .filter(Boolean);
    let current: unknown = payload;

    for (const segment of pathSegments) {
      if (!current || typeof current !== "object" || !(segment in current)) {
        return "";
      }
      current = (current as Record<string, unknown>)[segment];
    }

    if (current === undefined || current === null) {
      return "";
    }
    if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
      return String(current);
    }
    return JSON.stringify(current);
  });
}

function renderHookInput(value: unknown, payload: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return interpolateHookString(value, payload);
  }
  if (Array.isArray(value)) {
    return value.map(item => renderHookInput(item, payload));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderHookInput(entry, payload)])
    );
  }
  return value;
}

function mergeToolInput(defaultInput: unknown, providedInput: unknown): unknown {
  if (providedInput === undefined) {
    return clone(defaultInput);
  }
  if (defaultInput === undefined) {
    return clone(providedInput);
  }
  if (
    defaultInput &&
    providedInput &&
    typeof defaultInput === "object" &&
    typeof providedInput === "object" &&
    !Array.isArray(defaultInput) &&
    !Array.isArray(providedInput)
  ) {
    const merged: Record<string, unknown> = { ...(defaultInput as Record<string, unknown>) };
    for (const [key, value] of Object.entries(providedInput as Record<string, unknown>)) {
      merged[key] = mergeToolInput((defaultInput as Record<string, unknown>)[key], value);
    }
    return merged;
  }

  return clone(providedInput);
}

const PLUGIN_TOOL_STACK_METADATA_KEY = "workflowPluginToolStack";

function readPluginToolStack(metadata: Record<string, unknown> | undefined): string[] {
  const stack = metadata?.[PLUGIN_TOOL_STACK_METADATA_KEY];
  return Array.isArray(stack) ? stack.filter((entry): entry is string => typeof entry === "string") : [];
}

function classifyHookStatus(result: ToolResult): WorkflowHookExecution["status"] {
  if (result.ok) {
    return "completed";
  }
  if (result.error?.includes("blocked by permission decision")) {
    return "blocked";
  }
  return "failed";
}

function previewHookOutput(output: unknown): string | undefined {
  if (output === undefined) {
    return undefined;
  }

  const preview =
    typeof output === "string"
      ? output
      : JSON.stringify(output);
  if (!preview) {
    return undefined;
  }

  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
}

function createDefaultConfig(executionProfile: ExecutionProfile): SupercodeConfig {
  const timestamp = now();
  return {
    version: 1,
    selectedPackIds: executionProfile.recommendedPackIds,
    verificationLevel: executionProfile.verificationLevel,
    promptBudgetProfile: executionProfile.promptBudgetProfile,
    memory: {
      enabled: false,
      provider: "local",
      attachLimit: 5,
      defaultTags: ["supercode"],
      defaultImportance: 0.6,
      retention: {
        strategy: "count-bound",
        maxEntries: 200
      }
    },
    artifacts: {
      maxEntries: 50,
      maxTotalBytes: 5_000_000,
      maxArtifactBytes: 1_000_000
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function loadRuntimeConfig(cwd: string, executionProfile: ExecutionProfile): SupercodeConfig {
  const fallback = createDefaultConfig(executionProfile);
  const configPath = path.join(cwd, ".supercode", "config.json");
  if (!existsSync(configPath)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SupercodeConfig>;
    const configuredMemory = (parsed.memory ?? {}) as Partial<SupercodeConfig["memory"]>;
    return {
      version: 1,
      selectedPackIds: Array.isArray(parsed.selectedPackIds) ? parsed.selectedPackIds : fallback.selectedPackIds,
      verificationLevel: parsed.verificationLevel ?? fallback.verificationLevel,
      promptBudgetProfile: parsed.promptBudgetProfile ?? fallback.promptBudgetProfile,
      memory: {
        enabled: configuredMemory.enabled ?? fallback.memory.enabled,
        provider: configuredMemory.provider ?? fallback.memory.provider,
        attachLimit:
          typeof configuredMemory.attachLimit === "number" && configuredMemory.attachLimit > 0
            ? Math.floor(configuredMemory.attachLimit)
            : fallback.memory.attachLimit,
        defaultTags: Array.isArray(configuredMemory.defaultTags)
          ? configuredMemory.defaultTags.map((tag: string) => String(tag)).filter(Boolean)
          : fallback.memory.defaultTags,
        defaultImportance:
          typeof configuredMemory.defaultImportance === "number"
            ? Math.max(0, Math.min(1, configuredMemory.defaultImportance))
            : fallback.memory.defaultImportance,
        retention: configuredMemory.retention ?? fallback.memory.retention
      },
      artifacts: {
        maxEntries:
          typeof parsed.artifacts?.maxEntries === "number" && parsed.artifacts.maxEntries > 0
            ? Math.floor(parsed.artifacts.maxEntries)
            : fallback.artifacts.maxEntries,
        maxTotalBytes:
          typeof parsed.artifacts?.maxTotalBytes === "number" && parsed.artifacts.maxTotalBytes > 0
            ? Math.floor(parsed.artifacts.maxTotalBytes)
            : fallback.artifacts.maxTotalBytes,
        maxArtifactBytes:
          typeof parsed.artifacts?.maxArtifactBytes === "number" && parsed.artifacts.maxArtifactBytes > 0
            ? Math.floor(parsed.artifacts.maxArtifactBytes)
            : fallback.artifacts.maxArtifactBytes
      },
      createdAt: parsed.createdAt ?? fallback.createdAt,
      updatedAt: parsed.updatedAt ?? fallback.updatedAt
    };
  } catch {
    return fallback;
  }
}

function isActiveTask(task: TaskRecord): boolean {
  return task.status === "queued" || task.status === "running";
}

function reconcileSession(session: SessionState, tasks: TaskRecord[]): SessionState {
  const activeTaskIds = tasks.filter(isActiveTask).map(task => task.taskId);
  const recentTaskIds = unique([
    ...session.recentTaskIds,
    ...tasks
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(task => task.taskId)
  ]).slice(0, 20);

  return {
    ...session,
    activeTaskIds,
    recentTaskIds,
    updatedAt: now()
  };
}

function renderTaskMemoryContent(task: TaskRecord): string {
  return [
    `Task goal: ${task.goal}`,
    `Status: ${task.status}`,
    task.result?.summary ? `Result: ${task.result.summary}` : "",
    task.error?.message ? `Error: ${task.error.message}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function renderResultMemoryContent(result: ResultRecord): string {
  return [
    `Result summary: ${result.summary}`,
    result.preview ? `Preview: ${result.preview}` : "",
    result.taskId ? `Task: ${result.taskId}` : "",
    result.toolId ? `Tool: ${result.toolId}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function persistPermissionDecision(
  permissionSystem: DefaultPermissionSystem,
  stateStore: FileRuntimeStateStore,
  request: Omit<PermissionRequest, "requestId" | "requestedAt">
): PermissionDecision {
  const decision = permissionSystem.evaluate(request);
  stateStore.savePermissionLog(permissionSystem.getDecisionLog());
  return decision;
}

function toRankedWorkflowSelection(
  match: ReturnType<typeof rankSkillsForTask>[number] | ReturnType<typeof rankRulesForTask>[number]
): RankedWorkflowSelection {
  const item = match.item as { title: string; summary: string; skillId?: string; ruleId?: string };

  return {
    id: item.skillId ?? item.ruleId ?? item.title,
    title: item.title,
    summary: item.summary,
    score: match.score,
    reasons: [...match.reasons],
    sourceType: match.sourceType,
    sourceId: match.sourceId,
    sourceTitle: match.sourceTitle,
    path: match.path
  };
}

function createToolRegistry(
  cwd: string,
  executionProfile: ExecutionProfile,
  mcpRuntime: LocalMcpRuntime,
  authorize: (request: Omit<PermissionRequest, "requestId" | "requestedAt">) => PermissionDecision
): ExecutableToolRegistry {
  const registry = new ExecutableToolRegistry({
    authorize: context => authorize(context.request)
  });

  registry.registerTool<WorkflowMatchInput, WorkflowMatchOutput>({
    toolId: "workflow.match",
    title: "Workflow Match",
    description: "Rank Supercode skills and rules for a task goal.",
    category: "workflow",
    requiresPermission: ["tool"],
    execute: input => {
      const activePackIds =
        input.activePackIds && input.activePackIds.length > 0
          ? [...new Set(input.activePackIds)]
          : executionProfile.recommendedPackIds;

      return {
        task: input.task,
        activePackIds,
        verificationLevel: executionProfile.verificationLevel,
        promptBudgetProfile: executionProfile.promptBudgetProfile,
        matchedSkills: rankSkillsForTask(input.task, activePackIds, cwd).map(toRankedWorkflowSelection),
        matchedRules: rankRulesForTask(input.task, activePackIds, cwd).map(toRankedWorkflowSelection)
      };
    }
  });

  registry.registerTool<void, McpRuntimeSummary>({
    toolId: "mcp.inspect",
    title: "MCP Inspect",
    description: "Inspect local MCP availability and config state for the current project.",
    category: "mcp",
    requiresPermission: ["tool"],
    execute: () => mcpRuntime.getSummary()
  });

  registry.registerTool<McpInvokeInput, McpInvocationResult>({
    toolId: "mcp.invoke",
    title: "MCP Invoke",
    description: "Invoke a configured MCP server tool through the runtime boundary.",
    category: "mcp",
    requiresPermission: ["tool", "mcp"],
    execute: (input, context) =>
      mcpRuntime.invoke({
        serverId: input.serverId,
        toolName: input.toolName,
        arguments: input.arguments,
        timeoutMs: input.timeoutMs,
        retryCount: input.retryCount,
        taskId: context.taskId
      })
  });

  registerFirstPartyTools(tool => registry.registerTool(tool));

  const pluginTools = loadResolvedWorkflowPluginTools(cwd);
  const availableToolIds = new Set([
    ...registry.listTools().map(tool => tool.toolId),
    ...pluginTools.map(tool => tool.runtimeToolId)
  ]);

  for (const pluginTool of pluginTools) {
    if (!availableToolIds.has(pluginTool.targetToolId)) {
      continue;
    }

    registry.registerTool({
      toolId: pluginTool.runtimeToolId,
      title: pluginTool.title,
      description: pluginTool.description,
      category: "custom",
      requiresPermission: ["tool"],
      execute: async (input: unknown, context: ToolExecutionContext) => {
        const pluginToolStack = readPluginToolStack(context.metadata);
        if (pluginToolStack.includes(pluginTool.runtimeToolId)) {
          const cycleStartIndex = pluginToolStack.indexOf(pluginTool.runtimeToolId);
          const cycle = [...pluginToolStack.slice(cycleStartIndex), pluginTool.runtimeToolId];
          throw new Error(`Plugin tool cycle detected: ${cycle.join(" -> ")}.`);
        }

        const mergedInput = mergeToolInput(pluginTool.input, input);
        const result = await registry.invoke(pluginTool.targetToolId, mergedInput, {
          ...context,
          metadata: {
            ...(context.metadata ?? {}),
            [PLUGIN_TOOL_STACK_METADATA_KEY]: [...pluginToolStack, pluginTool.runtimeToolId]
          }
        });
        if (!result.ok) {
          throw new Error(result.error ?? `Plugin tool ${pluginTool.runtimeToolId} failed.`);
        }
        return result.output;
      }
    });
  }

  return registry;
}

export function createPersistedRuntimeContext(
  cwd: string,
  executionProfile: ExecutionProfile,
  permissionOverrides: RuntimePermissionOverrides = {}
): PersistedRuntimeContext {
  const config = loadRuntimeConfig(cwd, executionProfile);
  const stateStore = new FileRuntimeStateStore(cwd, {
    artifactPolicy: config.artifacts
  });
  stateStore.ensureLayout();
  const session = stateStore.loadOrCreateSession();
  const taskManager = new InMemoryTaskManager({
    tasks: stateStore.listTasks(),
    events: stateStore.listTaskEvents()
  });
  const progressTracker = new InMemoryProgressTracker(stateStore.listProgress());
  const permissionSystem = new DefaultPermissionSystem(
    {
      mode: executionProfile.safety.permissionMode,
      allowCategories: permissionOverrides.allowCategories,
      denyCategories: permissionOverrides.denyCategories
    },
    stateStore.loadPermissionLog()
  );
  const mcpRuntime = createMcpRuntime(cwd, executionProfile.host, process.env);
  const seededMemories = stateStore.listMemory();
  const memoryProvider = config.memory.enabled
    ? config.memory.provider === "simplemem"
      ? new SimpleMemAdapter({
          delegate: new InMemoryMemoryProvider({
            providerId: "simplemem-local-seed",
            displayName: "SimpleMem Local Seed",
            kind: "adapter",
            seed: seededMemories
          })
        })
      : new InMemoryMemoryProvider({
          providerId: "local-memory",
          displayName: "Local Memory",
          kind: "local",
          seed: seededMemories
        })
    : undefined;
  const sessionMemory = memoryProvider
    ? new SessionMemory({
        provider: memoryProvider,
        sessionId: session.sessionId,
        defaultTags: config.memory.defaultTags,
        defaultRetention: config.memory.retention
      })
    : undefined;
  const toolRegistry = createToolRegistry(cwd, executionProfile, mcpRuntime, request =>
    persistPermissionDecision(permissionSystem, stateStore, request)
  );

  let runtimeSession = reconcileSession(session, taskManager.listTasks());
  stateStore.saveSession(runtimeSession);

  taskManager.subscribe((event, task) => {
    stateStore.saveTask(task, taskManager.getTaskEvents(task.taskId));
    stateStore.saveProgress(progressTracker.recordTaskEvent(event));
    runtimeSession = reconcileSession(runtimeSession, taskManager.listTasks());
    stateStore.saveSession(runtimeSession);

    if (sessionMemory && event.type === "completed") {
      const memory = sessionMemory.remember({
        summary: `Completed task: ${task.goal}`,
        content: renderTaskMemoryContent(task),
        taskId: task.taskId,
        resultRef: task.result?.outputRef,
        sourceKind: "task",
        sourceLabel: "task completion",
        importance: config.memory.defaultImportance,
        tags: ["task", task.status]
      });
      stateStore.saveMemory(memory);
    }
  });

  return {
    cwd,
    config,
    executionProfile,
    stateStore,
    session: runtimeSession,
    taskManager,
    progressTracker,
    permissionSystem,
    mcpRuntime,
    memoryProvider,
    sessionMemory,
    toolRegistry,
    executor: new SimpleTaskExecutor(taskManager, progressTracker, toolRegistry)
  };
}

export function evaluateRuntimePermission(
  context: PersistedRuntimeContext,
  request: Omit<PermissionRequest, "requestId" | "requestedAt">
): PermissionDecision {
  return persistPermissionDecision(context.permissionSystem, context.stateStore, request);
}

export function getRuntimeSession(context: PersistedRuntimeContext): SessionState {
  const nextSession = context.stateStore.loadSession();
  if (!nextSession) {
    return context.session;
  }

  context.session = nextSession;
  return nextSession;
}

export async function invokeRuntimeTool(
  context: PersistedRuntimeContext,
  toolId: string,
  input: unknown,
  options: {
    taskId?: string;
    workingDirectory?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<ToolResult> {
  return context.toolRegistry.invoke(toolId, input, {
    sessionId: context.session.sessionId,
    taskId: options.taskId,
    workingDirectory: options.workingDirectory,
    metadata: options.metadata
  });
}

export function saveRuntimeResult(
  context: PersistedRuntimeContext,
  input: Parameters<FileRuntimeStateStore["saveResult"]>[0]
): ResultRecord {
  const result = context.stateStore.saveResult(input);
  if (context.sessionMemory) {
    const memory = context.sessionMemory.rememberResult({
      summary: `Stored result: ${result.summary}`,
      content: renderResultMemoryContent(result),
      taskId: result.taskId,
      resultRef: result.resultRef,
      sourceLabel: "result persistence",
      importance: context.config.memory.defaultImportance,
      tags: ["result", result.kind, result.toolId ?? "runtime"]
    });
    context.stateStore.saveMemory(memory);
  }
  return result;
}

export function listRuntimeMemory(
  context: PersistedRuntimeContext,
  query: Omit<MemoryQuery, "sessionId"> = {}
): MemoryAttachment[] {
  if (!context.sessionMemory) {
    return [];
  }

  return context.sessionMemory.attachForTask({
    ...query,
    limit: query.limit ?? context.config.memory.attachLimit
  });
}

export function getRuntimeMemory(
  context: PersistedRuntimeContext,
  memoryRef: string
) {
  return context.stateStore.loadMemory(memoryRef);
}

export async function runWorkflowHooks(
  context: PersistedRuntimeContext,
  event: WorkflowHookEvent,
  payload: Record<string, unknown>
): Promise<WorkflowHookRunResult> {
  const hooks = loadResolvedWorkflowHooks(context.cwd).filter(hook => hook.enabled && hook.event === event);
  const executions: WorkflowHookExecution[] = [];
  let haltedByHookId: string | undefined;
  let abortReason: string | undefined;

  for (const hook of hooks) {
    const failurePolicy = hook.onFailure ?? "continue";
    const input = renderHookInput(hook.input, {
      event: payload,
      hook: {
        hookId: hook.hookId,
        title: hook.title,
        event: hook.event,
        toolId: hook.toolId,
        onFailure: failurePolicy,
        source: hook.source,
        pluginId: hook.pluginId
      }
    });
    const result = await context.toolRegistry.invoke(hook.toolId, input, {
      sessionId: context.session.sessionId,
      taskId: typeof payload.taskId === "string" ? payload.taskId : undefined,
      workingDirectory: context.cwd,
      metadata: {
        hookId: hook.hookId,
        hookEvent: hook.event,
        trigger: "workflow-hook"
      }
    });

    const execution: WorkflowHookExecution = {
      hookId: hook.hookId,
      title: hook.title,
      event: hook.event,
      toolId: hook.toolId,
      status: classifyHookStatus(result),
      failurePolicy,
      source: hook.source,
      pluginId: hook.pluginId,
      path: hook.path,
      invocationId: result.invocationId,
      error: result.error,
      outputPreview: result.ok ? previewHookOutput(result.output) : undefined,
      completedAt: result.completedAt
    };
    executions.push(execution);

    if (execution.status !== "completed" && failurePolicy === "abort") {
      haltedByHookId = execution.hookId;
      abortReason = `Hook "${execution.hookId}" failed during ${event} and requested abort.`;
      break;
    }
  }

  return {
    event,
    executions,
    halted: Boolean(haltedByHookId),
    haltedByHookId,
    abortReason
  };
}

/**
 * Returns the list of completed step IDs from stored progress for a given task.
 * Used by the resume flow to skip already-completed steps.
 */
export function getCompletedStepIds(context: PersistedRuntimeContext, taskId: string): string[] {
  const progress = context.progressTracker.getTaskProgress(taskId);
  if (!progress) {
    return [];
  }
  return progress.steps
    .filter(step => step.status === "completed")
    .map(step => step.stepId);
}
