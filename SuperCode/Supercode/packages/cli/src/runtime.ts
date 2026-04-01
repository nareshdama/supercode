import type {
  ExecutionProfile,
  McpInvocationResult,
  McpRuntimeSummary,
  PermissionActionCategory,
  PermissionDecision,
  PermissionRequest,
  SessionState,
  TaskRecord,
  ToolResult
} from "@supercode/core";
import { createMcpRuntime, type LocalMcpRuntime } from "@supercode/mcp";
import { DefaultPermissionSystem } from "@supercode/permissions";
import { InMemoryProgressTracker } from "@supercode/progress";
import { FileRuntimeStateStore } from "@supercode/state";
import { InMemoryTaskManager, SimpleTaskExecutor } from "@supercode/tasks";
import { ExecutableToolRegistry, registerFirstPartyTools } from "@supercode/tools";
import { rankRulesForTask, rankSkillsForTask } from "@supercode/workflows";

export interface PersistedRuntimeContext {
  executionProfile: ExecutionProfile;
  stateStore: FileRuntimeStateStore;
  session: SessionState;
  taskManager: InMemoryTaskManager;
  progressTracker: InMemoryProgressTracker;
  permissionSystem: DefaultPermissionSystem;
  mcpRuntime: LocalMcpRuntime;
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
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
    reasons: [...match.reasons]
  };
}

function createToolRegistry(
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
        matchedSkills: rankSkillsForTask(input.task, activePackIds).map(toRankedWorkflowSelection),
        matchedRules: rankRulesForTask(input.task, activePackIds).map(toRankedWorkflowSelection)
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
  return registry;
}

export function createPersistedRuntimeContext(
  cwd: string,
  executionProfile: ExecutionProfile,
  permissionOverrides: RuntimePermissionOverrides = {}
): PersistedRuntimeContext {
  const stateStore = new FileRuntimeStateStore(cwd);
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
  const toolRegistry = createToolRegistry(executionProfile, mcpRuntime, request =>
    persistPermissionDecision(permissionSystem, stateStore, request)
  );

  let runtimeSession = reconcileSession(session, taskManager.listTasks());
  stateStore.saveSession(runtimeSession);

  taskManager.subscribe((event, task) => {
    stateStore.saveTask(task, taskManager.getTaskEvents(task.taskId));
    stateStore.saveProgress(progressTracker.recordTaskEvent(event));
    runtimeSession = reconcileSession(runtimeSession, taskManager.listTasks());
    stateStore.saveSession(runtimeSession);
  });

  return {
    executionProfile,
    stateStore,
    session: runtimeSession,
    taskManager,
    progressTracker,
    permissionSystem,
    mcpRuntime,
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
