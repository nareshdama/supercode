#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type {
  DoctorJsonReport,
  ExecutionProfile,
  McpInvocationResult,
  McpRuntimeSummary,
  McpServerStatus,
  PermissionLogEntry,
  SessionState,
  TaskProgressSnapshot,
  TaskRecord,
  WorkflowHookRunResult,
  WorkflowPackSummary,
  WorkflowRecommendation
} from "@nareshdama/core";
import { createExecutionProfile } from "@nareshdama/core";
import type { ModelDescriptor, ProviderHealth } from "@nareshdama/core";
import { detectRuntimeInputs } from "@nareshdama/detect";
import { detectMcpSupport } from "@nareshdama/mcp";
import { ModelCatalog, BudgetPolicy } from "@nareshdama/models";
import {
  getWorkflowPack,
  installWorkflowPack,
  installRecommendedWorkflowPacks,
  listWorkflowPackSummaries,
  listWorkflowPlugins,
  loadResolvedWorkflowCommands,
  loadResolvedWorkflowRunSteps,
  loadWorkflowExtensionState,
  loadInstalledPackState,
  recommendWorkflowPacks,
  searchRules,
  searchSkills,
  syncWorkflowPackState,
  validateWorkflowExtensions,
  uninstallWorkflowPack
} from "@nareshdama/workflows";
import { getFirstPartyTools } from "@nareshdama/tools";
import {
  createPersistedRuntimeContext,
  evaluateRuntimePermission,
  getRuntimeMemory,
  getCompletedStepIds,
  getRuntimeSession,
  invokeRuntimeTool,
  listRuntimeMemory,
  runWorkflowHooks,
  saveRuntimeResult,
  type McpInvokeInput,
  type WorkflowMatchOutput
} from "./runtime.js";
import { renderHelp } from "./help.js";
import {
  parseReleaseCheckArgs,
  renderReleaseReadinessReport,
  runReleaseReadiness
} from "./release-readiness.js";
import { initializeProject } from "./scaffold.js";

export interface CliIo {
  out(message: string): void;
  err(message: string): void;
}

type RuntimeState = {
  executionProfile: ExecutionProfile;
  workflowRecommendation: WorkflowRecommendation;
  installedPacks: ReturnType<typeof loadInstalledPackState>;
  availablePacks: WorkflowPackSummary[];
  mcpSummary: ReturnType<typeof detectMcpSupport>;
};

const BUILTIN_COMMAND_NAMES = [
  "help",
  "doctor",
  "init",
  "run",
  "task",
  "session",
  "permission",
  "result",
  "memory",
  "mcp",
  "extension",
  "plugin",
  "pack",
  "skill",
  "rule",
  "model",
  "release"
];

function getDefaultIo(): CliIo {
  return {
    out: message => console.log(message),
    err: message => console.error(message)
  };
}

function renderProfile(profile: ExecutionProfile): string {
  const frameworks = profile.project.frameworks.length > 0 ? profile.project.frameworks.join(", ") : "(none)";
  const notes = profile.notes.length > 0 ? profile.notes.map(note => `- ${note}`).join("\n") : "- (none)";
  const lines = [
    "Supercode Doctor",
    `CWD: ${profile.project.cwd}`,
    profile.project.projectRoot !== profile.project.cwd ? `Project root: ${profile.project.projectRoot}` : "",
    "",
    `Invocation: ${profile.invocation.launcher} via ${profile.invocation.packageManager}`,
    `Host: ${profile.host.displayName} [${profile.host.source}/${profile.host.confidence}]`,
    `Model: ${profile.model.modelId ?? "unknown"} (${profile.model.provider})`,
    `Project: ${profile.project.primaryLanguage}, package manager ${profile.project.packageManager}, frameworks ${frameworks}`,
    `Verification: ${profile.verificationLevel}`,
    `Prompt budget: ${profile.promptBudgetProfile}`,
    `Recommended packs: ${profile.recommendedPackIds.join(", ") || "(none)"}`,
    "",
    "Notes:",
    notes
  ];

  return lines.filter((line, index) => line !== "" || (index > 0 && lines[index - 1] !== "")).join("\n");
}

function buildRuntimeState(cwd: string): RuntimeState {
  const detected = detectRuntimeInputs(cwd, process.env);
  const workflowRecommendation = recommendWorkflowPacks(detected.project, detected.host, detected.model);
  const executionProfile = createExecutionProfile({
    ...detected,
    workflowRecommendation
  });
  const installedPacks = loadInstalledPackState(cwd);
  const availablePacks = listWorkflowPackSummaries();
  const mcpSummary = detectMcpSupport(cwd, detected.host, process.env);

  return {
    executionProfile,
    workflowRecommendation,
    installedPacks,
    availablePacks,
    mcpSummary
  };
}

function buildDoctorJsonReport(state: RuntimeState): DoctorJsonReport {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    executionProfile: state.executionProfile,
    workflowRecommendation: state.workflowRecommendation,
    availablePacks: state.availablePacks,
    installedPacks: state.installedPacks,
    mcp: state.mcpSummary
  };
}

function renderPackStatuses(pack: WorkflowPackSummary, state: RuntimeState): string {
  const statuses = [
    state.installedPacks.installedPackIds.includes(pack.packId) ? "installed" : "available",
    state.workflowRecommendation.recommendedPackIds.includes(pack.packId) ? "recommended" : "",
    pack.installMode
  ].filter(Boolean);
  return statuses.join(", ");
}

function renderExtensionSummaryLine(cwd: string): string {
  const extensionState = loadWorkflowExtensionState(cwd);
  if (!extensionState) {
    return "Extensions: (none)";
  }

  const plugins = listWorkflowPlugins(cwd);
  return `Extensions: packs=${extensionState.packs.length} skills=${extensionState.skills.length} rules=${extensionState.rules.length} plugins=${plugins.length}`;
}

function mergeCommandInput(defaultInput: unknown, providedInput: unknown): unknown {
  if (providedInput === undefined) {
    return structuredClone(defaultInput);
  }
  if (defaultInput === undefined) {
    return structuredClone(providedInput);
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
      merged[key] = mergeCommandInput((defaultInput as Record<string, unknown>)[key], value);
    }
    return merged;
  }

  return structuredClone(providedInput);
}

function parsePluginCommandInput(
  argsMode: "none" | "text" | "json" | "argv",
  args: string[]
): unknown {
  if (argsMode === "none") {
    return undefined;
  }
  if (argsMode === "text") {
    const text = args.join(" ").trim();
    return {
      text,
      content: text,
      argv: [...args]
    };
  }
  if (argsMode === "argv") {
    return {
      argv: [...args],
      text: args.join(" ").trim()
    };
  }
  if (args.length === 0) {
    return undefined;
  }

  return JSON.parse(args.join(" "));
}

function parseInitArgs(args: string[], cwd: string): { targetDir: string; force: boolean } {
  const force = args.includes("--force");
  const pathArg = args.find(arg => !arg.startsWith("-"));

  return {
    targetDir: pathArg ? path.resolve(cwd, pathArg) : cwd,
    force
  };
}

function renderRankedMatches(matches: Array<{ title: string; score: number }>): string {
  if (matches.length === 0) {
    return "(none)";
  }

  return matches
    .slice(0, 3)
    .map(match => {
      const withSource = match as { title: string; score: number; sourceType?: "pack" | "plugin"; sourceId?: string };
      const source =
        withSource.sourceType && withSource.sourceId ? ` <${withSource.sourceType}:${withSource.sourceId}>` : "";
      return `${match.title} [${match.score}]${source}`;
    })
    .join(", ");
}

function renderMcpSummary(summary: RuntimeState["mcpSummary"]): string[] {
  return [
    `MCP: available=${summary.available} configured=${summary.configured} source=${summary.configSource} servers=${summary.serverCount} trust=${summary.trustMode}`,
    ...(summary.serverIds.length > 0 ? [`MCP servers: ${summary.serverIds.join(", ")}`] : []),
    ...summary.notes.map(note => `- ${note}`)
  ];
}

function renderTaskStatusLine(task: TaskRecord): string {
  return `${task.taskId} [${task.status}/${task.priority}] ${task.goal}`;
}

function renderTaskDetails(task: TaskRecord, progress?: TaskProgressSnapshot): string[] {
  const lines = [
    `Task: ${task.taskId}`,
    `Goal: ${task.goal}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Attempts: ${task.attempts}/${task.maxAttempts}`,
    `Created: ${task.createdAt}`,
    task.startedAt ? `Started: ${task.startedAt}` : "",
    task.completedAt ? `Completed: ${task.completedAt}` : "",
    task.parentTaskId ? `Parent: ${task.parentTaskId}` : "",
    task.childTaskIds.length > 0 ? `Children: ${task.childTaskIds.join(", ")}` : "",
    progress ? `Progress: ${progress.percentComplete ?? 0}%` : "",
    progress?.summary ? `Summary: ${progress.summary}` : "",
    progress && progress.steps.length > 0 ? `Steps: ${progress.steps.map(step => `${step.title} [${step.status}]`).join(", ")}` : "",
    task.result?.summary ? `Result: ${task.result.summary}` : "",
    task.result?.outputRef ? `Output ref: ${task.result.outputRef}` : "",
    task.error?.message ? `Error: ${task.error.message}` : ""
  ];

  return lines.filter(Boolean);
}

function renderSession(session: SessionState): string[] {
  return [
    `Session: ${session.sessionId}`,
    `Created: ${session.createdAt}`,
    `Updated: ${session.updatedAt}`,
    `Active tasks: ${session.activeTaskIds.join(", ") || "(none)"}`,
    `Recent tasks: ${session.recentTaskIds.join(", ") || "(none)"}`,
    `Results: ${session.resultRefs.join(", ") || "(none)"}`
  ];
}

function renderMemoryStatus(enabled: boolean, attachmentCount: number): string {
  return enabled
    ? `Memory: enabled, attached=${attachmentCount}`
    : "Memory: disabled";
}

function renderMemoryListLine(memory: {
  memoryRef: string;
  summary: string;
  provenance: { sourceKind: string; taskId?: string };
  score?: number;
}): string {
  const score = memory.score !== undefined ? ` score=${memory.score}` : "";
  const task = memory.provenance.taskId ? ` task=${memory.provenance.taskId}` : "";
  return `${memory.memoryRef}: ${memory.summary} [${memory.provenance.sourceKind}]${task}${score}`;
}

function summarizeWorkflowOutput(task: string, output: WorkflowMatchOutput): string {
  return `Matched ${output.matchedSkills.length} skill(s) and ${output.matchedRules.length} rule(s) for "${task}".`;
}

function renderCompactMcpState(summary: McpRuntimeSummary): string {
  return `MCP: available=${summary.available} configured=${summary.configured} servers=${summary.serverCount} trust=${summary.trustMode}`;
}

function renderMcpServerStatus(server: McpServerStatus): string {
  const trust = server.trusted === undefined ? "unknown" : server.trusted ? "trusted" : "untrusted";
  const enabled = server.enabled ? "enabled" : "disabled";
  const availability = server.available ? "available" : "unavailable";
  return `${server.serverId} [${server.transport}] ${enabled}, ${availability}, trust=${trust}, timeout=${server.timeoutMs}ms, retries=${server.retryCount}`;
}

function parseJsonObjectArgument(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MCP invocation arguments must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function summarizeMcpInvocation(input: McpInvokeInput, result: McpInvocationResult): string {
  return result.ok
    ? `Invoked MCP ${input.serverId}.${input.toolName} successfully in ${result.attemptCount} attempt(s).`
    : `MCP ${input.serverId}.${input.toolName} failed after ${result.attemptCount} attempt(s).`;
}

function renderPermissionLog(entries: PermissionLogEntry[]): string[] {
  if (entries.length === 0) {
    return ["Permissions: (no recorded decisions)"];
  }

  return [
    `Permissions: ${entries.length} recorded decision${entries.length === 1 ? "" : "s"}`,
    ...entries
      .slice(-10)
      .reverse()
      .map(entry => `${entry.decision.decidedAt} ${entry.request.category} ${entry.request.resource} -> ${entry.decision.decision}`)
  ];
}

function renderHookSummary(result: WorkflowHookRunResult): string {
  const counts = {
    completed: result.executions.filter(execution => execution.status === "completed").length,
    blocked: result.executions.filter(execution => execution.status === "blocked").length,
    failed: result.executions.filter(execution => execution.status === "failed").length
  };
  return `Hooks ${result.event}: completed=${counts.completed} blocked=${counts.blocked} failed=${counts.failed} halted=${result.halted ? "yes" : "no"}`;
}

function renderHookExecutionLine(result: WorkflowHookRunResult["executions"][number]): string {
  const parts = [
    `hook ${result.hookId}`,
    `[${result.status}]`,
    `policy=${result.failurePolicy}`,
    `source=${result.source}`,
    result.pluginId ? `plugin=${result.pluginId}` : "",
    `tool=${result.toolId}`
  ].filter(Boolean);
  const errorSuffix = result.error ? ` error=${result.error}` : "";
  return `${parts.join(" ")}${errorSuffix}`;
}

function emitHookReport(io: CliIo, result: WorkflowHookRunResult): void {
  if (result.executions.length === 0) {
    return;
  }

  io.out(renderHookSummary(result));
  for (const execution of result.executions) {
    io.out(renderHookExecutionLine(execution));
  }
}

export async function runCli(argv: string[] = process.argv.slice(2), io: CliIo = getDefaultIo()): Promise<number> {
  const [command, subcommand, ...rest] = argv;
  const cwd = process.cwd();

  if (!command || command === "--help" || command === "-h" || command === "help") {
    io.out(renderHelp());
    return 0;
  }

  if (command === "doctor") {
    const state = buildRuntimeState(cwd);
    if ([subcommand, ...rest].includes("--json")) {
      io.out(JSON.stringify(buildDoctorJsonReport(state), null, 2));
      return 0;
    }

    io.out(renderProfile(state.executionProfile));
    io.out("");
    io.out(`Installed packs: ${state.installedPacks.installedPackIds.join(", ") || "(none)"}`);
    for (const line of renderMcpSummary(state.mcpSummary)) {
      io.out(line);
    }
    return 0;
  }

  if (command === "release") {
    if (subcommand !== "check") {
      io.err("Usage: supercode release check [--json] [--skip-gates]");
      return 1;
    }

    let options: ReturnType<typeof parseReleaseCheckArgs>;
    try {
      options = parseReleaseCheckArgs(rest);
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }

    let report;
    try {
      report = runReleaseReadiness(cwd, {
        runGates: options.runGates
      });
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }

    if (options.json) {
      io.out(JSON.stringify(report, null, 2));
    } else {
      for (const line of renderReleaseReadinessReport(report)) {
        io.out(line);
      }
    }

    return report.status === "passed" ? 0 : 1;
  }

  if (command === "init") {
    const { targetDir, force } = parseInitArgs([subcommand, ...rest].filter(Boolean), cwd);
    mkdirSync(targetDir, { recursive: true });
    const result = initializeProject(targetDir, {
      executionProfile: buildRuntimeState(targetDir).executionProfile,
      force,
      resolveExecutionProfile: nextCwd => buildRuntimeState(nextCwd).executionProfile
    });
    io.out(`Initialized Supercode in ${targetDir}`);
    io.out(`Installed packs: ${result.installedPackIds.join(", ") || "(none)"}`);
    io.out(renderExtensionSummaryLine(targetDir));
    io.out(`Created files: ${result.createdFiles.length}`);
    io.out(`Selected packs: ${result.executionProfile.recommendedPackIds.join(", ") || "(none)"}`);
    return 0;
  }

  if (command === "run") {
    const task = [subcommand, ...rest].filter(Boolean).join(" ").trim();
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile, {
      allowCategories: ["shell", "filesystem", "tool", "session"]
    });
    const activePackIds =
      state.installedPacks.installedPackIds.length > 0
        ? state.installedPacks.installedPackIds
        : state.executionProfile.recommendedPackIds;

    io.out(`Execution profile ready for ${state.executionProfile.project.primaryLanguage} in ${state.executionProfile.host.displayName}.`);
    io.out(`Active packs: ${activePackIds.join(", ") || "(none)"}`);
    io.out(`Verification level: ${state.executionProfile.verificationLevel}`);
    io.out(`Prompt budget: ${state.executionProfile.promptBudgetProfile}`);

    if (!task) {
      io.out(`Runtime tools: ${runtime.toolRegistry.listTools().map(tool => tool.toolId).join(", ") || "(none)"}`);
      io.out(renderMemoryStatus(Boolean(runtime.sessionMemory), 0));
      return 0;
    }

    const memoryAttachments = listRuntimeMemory(runtime, {
      text: task,
      limit: runtime.config.memory.attachLimit
    });

    const taskRecord = runtime.taskManager.createTask({
      goal: task,
      metadata: {
        command: "run",
        activePackIds
      }
    });
    const runningTask = runtime.taskManager.startTask(taskRecord.taskId);
    runtime.stateStore.saveProgress(
      runtime.progressTracker.record({
        taskId: runningTask.taskId,
        type: "message",
        status: runningTask.status,
        message: "Executing runtime tools for the requested task."
      })
    );

    io.out(`Started task ${runningTask.taskId}`);
    io.out(renderMemoryStatus(Boolean(runtime.sessionMemory), memoryAttachments.length));

    const beforeHooks = await runWorkflowHooks(runtime, "run.before", {
      task,
      taskId: runningTask.taskId,
      activePackIds
    });
    emitHookReport(io, beforeHooks);
    if (beforeHooks.halted) {
      const message = beforeHooks.abortReason ?? `Hooks ${beforeHooks.event} aborted command execution.`;
      runtime.stateStore.saveProgress(
        runtime.progressTracker.record({
          taskId: runningTask.taskId,
          type: "message",
          status: "failed",
          message
        })
      );
      runtime.taskManager.failTask(runningTask.taskId, {
        message,
        retryable: false,
        details: {
          hookEvent: beforeHooks.event,
          haltedByHookId: beforeHooks.haltedByHookId,
          executions: beforeHooks.executions
        }
      });
      io.err(message);
      return 1;
    }

    const workflowResult = await invokeRuntimeTool(
      runtime,
      "workflow.match",
      {
        task,
        activePackIds
      },
      {
        taskId: runningTask.taskId,
        workingDirectory: cwd,
        metadata: {
          activePackIds,
          command: "run"
        }
      }
    );

    if (!workflowResult.ok || !workflowResult.output) {
      const message = workflowResult.error ?? "Runtime tool workflow.match failed.";
      runtime.stateStore.saveProgress(
        runtime.progressTracker.record({
          taskId: runningTask.taskId,
          type: "message",
          status: "failed",
          message
        })
      );
      runtime.taskManager.failTask(runningTask.taskId, {
        message,
        retryable: false,
        details: {
          toolId: workflowResult.toolId,
          invocationId: workflowResult.invocationId
        }
      });
      io.err(message);
      return 1;
    }

    const workflowOutput = workflowResult.output as WorkflowMatchOutput;
    const mcpResult = await invokeRuntimeTool(runtime, "mcp.inspect", undefined, {
      taskId: runningTask.taskId,
      workingDirectory: cwd,
      metadata: {
        command: "run"
      }
    });
    const mcpSummary = (mcpResult.ok ? mcpResult.output : state.mcpSummary) as McpRuntimeSummary;
    const resultSummary = summarizeWorkflowOutput(task, workflowOutput);
    const resultRecord = saveRuntimeResult(runtime, {
      kind: "tool-result",
      taskId: runningTask.taskId,
      toolId: workflowResult.toolId,
      summary: resultSummary,
      data: {
        workflow: workflowOutput,
        memory: memoryAttachments,
        mcp: mcpSummary,
        invocations: {
          workflow: {
            invocationId: workflowResult.invocationId,
            ok: workflowResult.ok
          },
          mcp: {
            invocationId: mcpResult.invocationId,
            ok: mcpResult.ok,
            error: mcpResult.ok ? undefined : mcpResult.error
          }
        }
      }
    });

    // Build the execution plan from defaults plus matching plugin-contributed run steps.
    const hasNodeModules = existsSync(path.join(state.executionProfile.project.projectRoot, "node_modules"));
    const pluginRunSteps = loadResolvedWorkflowRunSteps(cwd, task);
    const defaultPlanSteps = [
      {
        stepId: randomUUID(),
        toolId: "git.status",
        title: "Git Status"
      },
      ...(state.executionProfile.project.scripts.build && hasNodeModules
        ? [
            {
              stepId: randomUUID(),
              toolId: "project.build",
              title: "Project Build",
              input: {
                script: state.executionProfile.project.scripts.build,
                packageManager: state.executionProfile.project.packageManager
              }
            }
          ]
        : []),
      ...(state.executionProfile.project.scripts.test && hasNodeModules
        ? [
            {
              stepId: randomUUID(),
              toolId: "project.test",
              title: "Project Test",
              input: {
                script: state.executionProfile.project.scripts.test,
                packageManager: state.executionProfile.project.packageManager
              }
            }
          ]
        : [])
    ];
    const beforeDefaultPluginSteps = pluginRunSteps
      .filter(step => step.placement === "before-defaults")
      .map(step => ({
        stepId: randomUUID(),
        toolId: step.toolId,
        title: step.title,
        description: step.description,
        input: step.input,
        metadata: {
          source: "plugin-run-step",
          pluginId: step.pluginId,
          pluginTitle: step.pluginTitle,
          pluginStepId: step.stepId,
          path: step.path,
          placement: step.placement
        }
      }));
    const afterDefaultPluginSteps = pluginRunSteps
      .filter(step => step.placement !== "before-defaults")
      .map(step => ({
        stepId: randomUUID(),
        toolId: step.toolId,
        title: step.title,
        description: step.description,
        input: step.input,
        metadata: {
          source: "plugin-run-step",
          pluginId: step.pluginId,
          pluginTitle: step.pluginTitle,
          pluginStepId: step.stepId,
          path: step.path,
          placement: step.placement
        }
      }));
    const planSteps = [
      ...beforeDefaultPluginSteps,
      ...defaultPlanSteps,
      ...afterDefaultPluginSteps
    ];

    const plan = {
      planRef: randomUUID(),
      taskId: runningTask.taskId,
      steps: planSteps,
      createdAt: new Date().toISOString(),
      metadata: {
        command: "run",
        activePackIds,
        pluginRunStepIds: pluginRunSteps.map(step => `${step.pluginId}:${step.stepId}`)
      }
    };

    // Persist the plan for retry/resume.
    runtime.stateStore.savePlan(plan);

    const execOutcome = await runtime.executor.run(plan);
    if (!execOutcome.success) {
      runtime.taskManager.failTask(runningTask.taskId, {
        message: execOutcome.summary,
        retryable: true,
        details: { ...execOutcome.data, stepOutcomes: execOutcome.stepOutcomes }
      });
      io.err(execOutcome.summary);
      return 1;
    }

    const executionResult = saveRuntimeResult(runtime, {
      kind: "task-output",
      taskId: runningTask.taskId,
      toolId: "executor",
      summary: execOutcome.summary,
      data: {
        execution: execOutcome,
        plan,
        workflow: workflowOutput,
        memory: memoryAttachments,
        mcp: mcpSummary
      }
    });

    const completedTask = runtime.taskManager.completeTask(runningTask.taskId, {
      summary: execOutcome.summary,
      outputRef: resultRecord.resultRef,
      data: {
        resultRef: resultRecord.resultRef,
        executionResultRef: executionResult.resultRef,
        planRef: plan.planRef
      }
    });

    const afterHooks = await runWorkflowHooks(runtime, "run.after", {
      task,
      taskId: completedTask.taskId,
      resultRef: resultRecord.resultRef,
      executionResultRef: executionResult.resultRef,
      activePackIds,
      success: true
    });
    io.out(`Completed task ${completedTask.taskId}`);
    io.out(`Saved result ${resultRecord.resultRef}`);
    io.out(`Task: ${task}`);
    io.out(renderCompactMcpState(mcpSummary));
    io.out(`Matched skills: ${renderRankedMatches(workflowOutput.matchedSkills)}`);
    io.out(`Matched rules: ${renderRankedMatches(workflowOutput.matchedRules)}`);
    if (pluginRunSteps.length > 0) {
      io.out(
        `Plugin run steps: ${pluginRunSteps.map(step => `${step.title} <plugin:${step.pluginId}> [${step.placement}]`).join(", ")}`
      );
    }
    emitHookReport(io, afterHooks);
    if (afterHooks.halted) {
      io.err(afterHooks.abortReason ?? `Hooks ${afterHooks.event} aborted command completion.`);
      return 1;
    }
    return 0;
  }

  if (command === "task" && subcommand === "start") {
    const goal = rest.join(" ").trim();
    if (!goal) {
      io.err("Usage: supercode task start <goal>");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const decision = evaluateRuntimePermission(runtime, {
      category: "session",
      resource: "task.start",
      reason: "Start a runtime task from the CLI."
    });

    if (decision.decision !== "allow") {
      io.err(`Task start is blocked: ${decision.decision} (${decision.reason ?? "no reason provided"}).`);
      return 1;
    }

    const task = runtime.taskManager.createTask({
      goal
    });
    const runningTask = runtime.taskManager.startTask(task.taskId);
    const progress = runtime.progressTracker.record({
      taskId: runningTask.taskId,
      type: "message",
      status: runningTask.status,
      message: "Task started from the CLI."
    });
    runtime.stateStore.saveProgress(progress);

    io.out(`Started task ${runningTask.taskId}`);
    io.out(`Status: ${runningTask.status}`);
    io.out(`Goal: ${runningTask.goal}`);
    return 0;
  }

  if (command === "task" && subcommand === "list") {
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const tasks = runtime.taskManager.listTasks();

    if (tasks.length === 0) {
      io.out("Tasks: (none)");
      return 0;
    }

    for (const task of tasks) {
      io.out(renderTaskStatusLine(task));
    }
    return 0;
  }

  if (command === "task" && subcommand === "show") {
    const taskId = rest[0];
    if (!taskId) {
      io.err("Usage: supercode task show <task-id>");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const task = runtime.taskManager.getTask(taskId);
    if (!task) {
      io.err(`Unknown task: ${taskId}`);
      return 1;
    }

    const progress = runtime.progressTracker.getTaskProgress(taskId);
    for (const line of renderTaskDetails(task, progress)) {
      io.out(line);
    }
    return 0;
  }

  if (command === "task" && subcommand === "cancel") {
    const taskId = rest[0];
    if (!taskId) {
      io.err("Usage: supercode task cancel <task-id>");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const decision = evaluateRuntimePermission(runtime, {
      category: "session",
      resource: "task.cancel",
      reason: `Cancel task ${taskId} from the CLI.`,
      taskId
    });

    if (decision.decision !== "allow") {
      io.err(`Task cancel is blocked: ${decision.decision} (${decision.reason ?? "no reason provided"}).`);
      return 1;
    }

    try {
      const task = runtime.taskManager.cancelTask(taskId, {
        reason: "Cancelled from the CLI."
      });
      io.out(`Cancelled task ${task.taskId}`);
      io.out(`Status: ${task.status}`);
      return 0;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "task" && subcommand === "retry") {
    const taskId = rest.find(arg => !arg.startsWith("-"));
    const force = rest.includes("--force");
    if (!taskId) {
      io.err("Usage: supercode task retry <task-id> [--force]");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile, {
      allowCategories: ["shell", "filesystem", "tool", "session"]
    });

    // Permission gate for retry.
    const decision = evaluateRuntimePermission(runtime, {
      category: "session",
      resource: "task.retry",
      reason: `Retry task ${taskId} from the CLI.`,
      taskId
    });
    if (decision.decision !== "allow") {
      io.err(`Task retry is blocked: ${decision.decision} (${decision.reason ?? "no reason provided"}).`);
      return 1;
    }

    try {
      const retriedTask = runtime.taskManager.retryTask(taskId, force);
      const startedTask = runtime.taskManager.startTask(retriedTask.taskId);
      runtime.stateStore.saveProgress(
        runtime.progressTracker.record({
          taskId: startedTask.taskId,
          type: "message",
          status: startedTask.status,
          message: "Retrying task from stored plan."
        })
      );

      io.out(`Retrying task ${startedTask.taskId} (attempt ${startedTask.attempts}/${startedTask.maxAttempts})`);

      // Load stored plan.
      const storedPlan = runtime.stateStore.loadPlan(taskId);
      if (!storedPlan) {
        runtime.taskManager.failTask(startedTask.taskId, {
          message: "No stored plan found for retry.",
          retryable: false
        });
        io.err("No stored plan found for this task. Cannot retry.");
        return 1;
      }

      // Re-execute the full plan.
      const plan = { ...storedPlan.plan, taskId: startedTask.taskId };
      runtime.stateStore.savePlan(plan);
      const outcome = await runtime.executor.run(plan);

      if (!outcome.success) {
        runtime.taskManager.failTask(startedTask.taskId, {
          message: outcome.summary,
          retryable: true,
          details: { ...outcome.data, stepOutcomes: outcome.stepOutcomes }
        });
        io.err(outcome.summary);
        return 1;
      }

      const resultRecord = saveRuntimeResult(runtime, {
        kind: "task-output",
        taskId: startedTask.taskId,
        toolId: "executor",
        summary: outcome.summary,
        data: { execution: outcome, plan: storedPlan.plan }
      });

      runtime.taskManager.completeTask(startedTask.taskId, {
        summary: outcome.summary,
        outputRef: resultRecord.resultRef,
        data: { resultRef: resultRecord.resultRef, planRef: storedPlan.planRef }
      });

      io.out(`Completed retry for task ${startedTask.taskId}`);
      io.out(`Saved result ${resultRecord.resultRef}`);
      return 0;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "task" && subcommand === "resume") {
    const taskId = rest[0];
    if (!taskId) {
      io.err("Usage: supercode task resume <task-id>");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile, {
      allowCategories: ["shell", "filesystem", "tool", "session"]
    });

    // Permission gate for resume.
    const decision = evaluateRuntimePermission(runtime, {
      category: "session",
      resource: "task.resume",
      reason: `Resume task ${taskId} from stored progress.`,
      taskId
    });
    if (decision.decision !== "allow") {
      io.err(`Task resume is blocked: ${decision.decision} (${decision.reason ?? "no reason provided"}).`);
      return 1;
    }

    try {
      const resumedTask = runtime.taskManager.resumeTask(taskId);
      runtime.stateStore.saveProgress(
        runtime.progressTracker.record({
          taskId: resumedTask.taskId,
          type: "message",
          status: resumedTask.status,
          message: "Resuming task from stored progress."
        })
      );

      io.out(`Resuming task ${resumedTask.taskId} (attempt ${resumedTask.attempts}/${resumedTask.maxAttempts})`);

      // Load stored plan.
      const storedPlan = runtime.stateStore.loadPlan(taskId);
      if (!storedPlan) {
        runtime.taskManager.failTask(resumedTask.taskId, {
          message: "No stored plan found for resume.",
          retryable: false
        });
        io.err("No stored plan found for this task. Cannot resume.");
        return 1;
      }

      // Determine completed steps from stored progress.
      const completedStepIds = getCompletedStepIds(runtime, taskId);
      io.out(`Skipping ${completedStepIds.length} completed step(s).`);

      const plan = { ...storedPlan.plan, taskId: resumedTask.taskId };
      runtime.stateStore.savePlan(plan);
      const outcome = await runtime.executor.resume(plan, completedStepIds);

      if (!outcome.success) {
        runtime.taskManager.failTask(resumedTask.taskId, {
          message: outcome.summary,
          retryable: true,
          details: { ...outcome.data, stepOutcomes: outcome.stepOutcomes }
        });
        io.err(outcome.summary);
        return 1;
      }

      const resultRecord = saveRuntimeResult(runtime, {
        kind: "task-output",
        taskId: resumedTask.taskId,
        toolId: "executor",
        summary: outcome.summary,
        data: { execution: outcome, plan: storedPlan.plan }
      });

      runtime.taskManager.completeTask(resumedTask.taskId, {
        summary: outcome.summary,
        outputRef: resultRecord.resultRef,
        data: { resultRef: resultRecord.resultRef, planRef: storedPlan.planRef }
      });

      io.out(`Completed resume for task ${resumedTask.taskId}`);
      io.out(`Saved result ${resultRecord.resultRef}`);
      return 0;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "session" && subcommand === "show") {
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    for (const line of renderSession(getRuntimeSession(runtime))) {
      io.out(line);
    }
    return 0;
  }

  if (command === "permission" && subcommand === "show") {
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    for (const line of renderPermissionLog(runtime.stateStore.loadPermissionLog())) {
      io.out(line);
    }
    return 0;
  }

  if (command === "model" && subcommand === "list") {
    const catalog = ModelCatalog.autoDiscover();
    const models = catalog.listModels();
    if (models.length === 0) {
      io.out("No model providers configured.");
      io.out("Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable providers.");
      return 0;
    }
    io.out(`Available models (${models.length}):`);
    io.out("");
    const byProvider = new Map<string, ModelDescriptor[]>();
    for (const m of models) {
      const list = byProvider.get(m.providerId) ?? [];
      list.push(m);
      byProvider.set(m.providerId, list);
    }
    for (const [providerId, providerModels] of byProvider) {
      io.out(`[${providerId}]`);
      for (const m of providerModels) {
        const cost = `$${m.cost.inputPer1kTokens}/$${m.cost.outputPer1kTokens} per 1k`;
        const ctx = m.contextWindow >= 1_000_000 ? `${(m.contextWindow / 1_000_000).toFixed(0)}M` : `${(m.contextWindow / 1_000).toFixed(0)}K`;
        const caps = [m.supportsTools ? "tools" : "", m.supportsStreaming ? "stream" : ""].filter(Boolean).join(",");
        io.out(`  ${m.modelId} [${m.family}] ctx=${ctx} ${m.latencyTier} ${cost} [${caps}]`);
      }
      io.out("");
    }
    return 0;
  }

  if (command === "model" && subcommand === "status") {
    const catalog = ModelCatalog.autoDiscover();
    const providers = catalog.listProviders();
    if (providers.length === 0) {
      io.out("No model providers configured.");
      io.out("Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable providers.");
      return 0;
    }
    io.out("Provider Status:");
    for (const p of providers) {
      const health: ProviderHealth = p.getHealth();
      io.out(`  ${p.displayName} (${p.providerId}): ${health.status} [errors=${health.errorCount}]`);
      if (health.latencyMs !== undefined) {
        io.out(`    Last latency: ${health.latencyMs}ms`);
      }
      for (const note of health.notes) {
        io.out(`    Note: ${note}`);
      }
    }
    io.out("");
    const budget = new BudgetPolicy();
    const snap = budget.snapshot();
    io.out("Budget:");
    io.out(`  Invocations: ${snap.invocationCount}`);
    io.out(`  Input tokens: ${snap.totalInputTokens}`);
    io.out(`  Output tokens: ${snap.totalOutputTokens}`);
    io.out(`  Estimated cost: $${snap.totalCostEstimate.toFixed(4)}`);
    if (snap.maxBudget !== undefined) {
      io.out(`  Budget limit: $${snap.maxBudget.toFixed(4)}`);
      io.out(`  Remaining: $${(snap.remainingBudget ?? 0).toFixed(4)}`);
    } else {
      io.out("  Budget limit: unlimited");
    }
    return 0;
  }

  if (command === "result" && subcommand === "list") {
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const results = runtime.stateStore.listResults();
    if (results.length === 0) {
      io.out("Results: (none)");
      return 0;
    }
    for (const result of results) {
      const artifact = result.artifactRef ? " [has-artifact]" : "";
      const preview = result.preview
        ? ` — ${result.preview.slice(0, 80)}${result.preview.length > 80 ? "…" : ""}`
        : "";
      io.out(`${result.resultRef}: ${result.summary} [${result.kind}]${result.taskId ? ` task=${result.taskId}` : ""}${artifact}${preview}`);
    }
    return 0;
  }

  if (command === "memory" && subcommand === "list") {
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const query = rest.join(" ").trim();

    if (runtime.sessionMemory) {
      const memories = listRuntimeMemory(runtime, query ? { text: query } : {});
      if (memories.length === 0) {
        io.out("Memory: (none)");
        return 0;
      }

      for (const memory of memories) {
        io.out(renderMemoryListLine(memory));
      }
      return 0;
    }

    const persisted = runtime.stateStore.listMemory({
      sessionId: runtime.session.sessionId,
      text: query || undefined
    });
    if (persisted.length === 0) {
      io.out("Memory is disabled and there are no persisted records for this session.");
      return 0;
    }

    io.out("Memory is disabled; showing persisted records for this session.");
    for (const memory of persisted) {
      io.out(renderMemoryListLine(memory));
    }
    return 0;
  }

  if (command === "memory" && subcommand === "show") {
    const memoryRef = rest[0];
    if (!memoryRef) {
      io.err("Usage: supercode memory show <memory-id>");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const memory = getRuntimeMemory(runtime, memoryRef);
    if (!memory) {
      io.err(`Unknown memory: ${memoryRef}`);
      return 1;
    }

    io.out(`Memory: ${memory.memoryRef}`);
    io.out(`Summary: ${memory.summary}`);
    io.out(`Tags: ${memory.tags.join(", ") || "(none)"}`);
    io.out(`Importance: ${memory.importance}`);
    io.out(`Source: ${memory.provenance.sourceKind}`);
    if (memory.provenance.taskId) io.out(`Task: ${memory.provenance.taskId}`);
    if (memory.provenance.resultRef) io.out(`Result: ${memory.provenance.resultRef}`);
    io.out(`Created: ${memory.createdAt}`);
    io.out(`Updated: ${memory.updatedAt}`);
    io.out(`Content: ${memory.content}`);
    return 0;
  }

  if (command === "result" && subcommand === "show") {
    const resultId = rest[0];
    if (!resultId) {
      io.err("Usage: supercode result show <result-id>");
      return 1;
    }
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const result = runtime.stateStore.loadResult(resultId);
    if (!result) {
      io.err(`Unknown result: ${resultId}`);
      return 1;
    }

    io.out(`Result: ${result.resultRef}`);
    io.out(`Summary: ${result.summary}`);
    io.out(`Kind: ${result.kind}`);
    if (result.taskId) io.out(`Task: ${result.taskId}`);
    if (result.toolId) io.out(`Tool: ${result.toolId}`);
    io.out(`Created: ${result.createdAt}`);
    if (result.artifactRef) {
      io.out(`Artifact: ${result.artifactRef}`);
    }
    if (result.preview !== undefined) {
      io.out(`Preview: ${result.preview}`);
    } else if (result.data !== undefined) {
      io.out(`Data: ${JSON.stringify(result.data)}`);
    }
    return 0;
  }

  if (command === "mcp" && subcommand === "list") {
    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
    const summary = runtime.mcpRuntime.getSummary();
    const servers = runtime.mcpRuntime.listServers();

    io.out(renderCompactMcpState(summary));
    if (servers.length === 0) {
      io.out("MCP servers: (none)");
      return 0;
    }

    for (const server of servers) {
      io.out(renderMcpServerStatus(server));
    }
    return 0;
  }

  if (command === "mcp" && subcommand === "invoke") {
    const serverId = rest[0];
    const toolName = rest[1];
    if (!serverId || !toolName) {
      io.err("Usage: supercode mcp invoke <server-id> <tool-name> [json-args]");
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile, {
      allowCategories: ["mcp"]
    });
    let input: McpInvokeInput;
    try {
      input = {
        serverId,
        toolName,
        arguments: parseJsonObjectArgument(rest[2])
      };
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }

    const taskRecord = runtime.taskManager.createTask({
      goal: `Invoke MCP ${serverId}.${toolName}`,
      metadata: {
        command: "mcp.invoke",
        serverId,
        toolName
      }
    });
    const runningTask = runtime.taskManager.startTask(taskRecord.taskId);
    runtime.stateStore.saveProgress(
      runtime.progressTracker.record({
        taskId: runningTask.taskId,
        type: "message",
        status: runningTask.status,
        message: `Invoking MCP ${serverId}.${toolName}.`
      })
    );

    io.out(`Started task ${runningTask.taskId}`);

    const toolResult = await invokeRuntimeTool(runtime, "mcp.invoke", input, {
      taskId: runningTask.taskId,
      workingDirectory: cwd,
      metadata: {
        command: "mcp.invoke",
        serverId,
        toolName
      }
    });

    if (!toolResult.ok || !toolResult.output) {
      const message = toolResult.error ?? `MCP invocation ${serverId}.${toolName} failed.`;
      runtime.stateStore.saveProgress(
        runtime.progressTracker.record({
          taskId: runningTask.taskId,
          type: "message",
          status: "failed",
          message
        })
      );
      runtime.taskManager.failTask(runningTask.taskId, {
        message,
        retryable: false,
        details: {
          toolId: toolResult.toolId,
          invocationId: toolResult.invocationId
        }
      });
      io.err(message);
      return 1;
    }

    const invocation = toolResult.output as McpInvocationResult;
    const resultSummary = summarizeMcpInvocation(input, invocation);
    const resultRecord = saveRuntimeResult(runtime, {
      kind: "tool-result",
      taskId: runningTask.taskId,
      toolId: toolResult.toolId,
      summary: resultSummary,
      data: invocation
    });
    runtime.stateStore.saveProgress(
      runtime.progressTracker.record({
        taskId: runningTask.taskId,
        type: "percent",
        status: invocation.ok ? "running" : "failed",
        percentComplete: invocation.ok ? 100 : 0
      })
    );

    if (!invocation.ok) {
      runtime.taskManager.failTask(runningTask.taskId, {
        message: invocation.error ?? resultSummary,
        retryable: invocation.timedOut,
        details: invocation
      });
      io.err(invocation.error ?? resultSummary);
      return 1;
    }

    const completedTask = runtime.taskManager.completeTask(runningTask.taskId, {
      summary: resultSummary,
      outputRef: resultRecord.resultRef,
      data: invocation
    });
    runtime.stateStore.saveProgress(
      runtime.progressTracker.record({
        taskId: completedTask.taskId,
        type: "message",
        status: completedTask.status,
        message: "MCP invocation completed successfully."
      })
    );

    io.out(`Completed task ${completedTask.taskId}`);
    io.out(`Saved result ${resultRecord.resultRef}`);
    io.out(`Attempts: ${invocation.attemptCount}`);
    io.out(`Response: ${JSON.stringify(invocation.response)}`);
    return 0;
  }

  if (command === "extension" && subcommand === "list") {
    const extensionState = loadWorkflowExtensionState(cwd);
    if (!extensionState) {
      io.out("Extensions: (none)");
      return 0;
    }

    io.out(renderExtensionSummaryLine(cwd));
    io.out(`Generated at: ${extensionState.generatedAt}`);
    for (const pack of extensionState.packs) {
      io.out(`${pack.packId} [${pack.installMode}]: skills=${pack.skillCount}, rules=${pack.ruleCount}`);
    }
    const plugins = listWorkflowPlugins(cwd);
    io.out(`Plugins: ${plugins.length}`);
    for (const plugin of plugins) {
      io.out(
        `plugin ${plugin.pluginId} [${plugin.enabled ? "enabled" : "disabled"}]: skills=${plugin.skillCount}, rules=${plugin.ruleCount}, tools=${plugin.toolCount}, runSteps=${plugin.runStepCount}, commands=${plugin.commandCount}, hooks=${plugin.hookCount}`
      );
    }
    return 0;
  }

  if (command === "extension" && subcommand === "validate") {
    const report = validateWorkflowExtensions(cwd, {
      knownToolIds: [
        "workflow.match",
        "mcp.inspect",
        "mcp.invoke",
        ...getFirstPartyTools().map(tool => tool.toolId)
      ],
      reservedCommandNames: BUILTIN_COMMAND_NAMES
    });

    if (report.issues.length === 0) {
      io.out("Extension validation passed.");
      return 0;
    }

    io.out(`Extension validation: errors=${report.errorCount} warnings=${report.warningCount}`);
    for (const issue of report.issues) {
      const source = issue.sourceId ? `${issue.sourceType}:${issue.sourceId}` : issue.sourceType;
      io.out(`${issue.severity.toUpperCase()} ${source} ${issue.path}: ${issue.message}`);
    }
    return report.ok ? 0 : 1;
  }

  if (command === "plugin" && subcommand === "list") {
    const plugins = listWorkflowPlugins(cwd);
    if (plugins.length === 0) {
      io.out("Plugins: (none)");
      return 0;
    }

    for (const plugin of plugins) {
      io.out(
        `${plugin.pluginId} [${plugin.enabled ? "enabled" : "disabled"}]: skills=${plugin.skillCount}, rules=${plugin.ruleCount}, tools=${plugin.toolCount}, runSteps=${plugin.runStepCount}, commands=${plugin.commandCount}, hooks=${plugin.hookCount} path=${plugin.path}`
      );
    }
    return 0;
  }

  if (command === "pack" && subcommand === "list") {
    const state = buildRuntimeState(cwd);
    for (const pack of state.availablePacks) {
      io.out(`${pack.packId} [${renderPackStatuses(pack, state)}]: ${pack.description}`);
    }
    return 0;
  }

  if (command === "pack" && subcommand === "recommend") {
    const state = buildRuntimeState(cwd);
    if (rest.includes("--apply")) {
      const installed = installRecommendedWorkflowPacks(cwd, state.workflowRecommendation);
      io.out(`Applied recommended packs. Installed set: ${installed.installedPackIds.join(", ") || "(none)"}`);
      io.out(renderExtensionSummaryLine(cwd));
      return 0;
    }

    for (const packId of state.workflowRecommendation.recommendedPackIds) {
      const reasons = state.workflowRecommendation.reasons[packId] ?? [];
      io.out(`${packId}: ${reasons.join(" ") || "No recommendation rationale recorded."}`);
    }
    return 0;
  }

  if (command === "pack" && subcommand === "sync") {
    const synced = syncWorkflowPackState(cwd);
    io.out(`Synced pack state. Installed set: ${synced.installedPackIds.join(", ") || "(none)"}`);
    io.out(renderExtensionSummaryLine(cwd));
    return 0;
  }

  if (command === "pack" && subcommand === "install") {
    const packId = rest[0];
    if (!packId) {
      io.err("Usage: supercode pack install <pack-id>");
      return 1;
    }

    const pack = getWorkflowPack(packId);
    if (!pack) {
      io.err(`Unknown pack: ${packId}`);
      return 1;
    }

    try {
      const installed = installWorkflowPack(cwd, packId);
      io.out(`Installed pack ${packId}. Installed set: ${installed.installedPackIds.join(", ")}`);
      const state = buildRuntimeState(cwd);
      const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
      const hookExecutions = await runWorkflowHooks(runtime, "pack.install.after", {
        packId,
        installedPackIds: installed.installedPackIds
      });
      emitHookReport(io, hookExecutions);
      if (hookExecutions.halted) {
        io.err(hookExecutions.abortReason ?? `Hooks ${hookExecutions.event} aborted command completion.`);
        return 1;
      }
      return 0;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "pack" && subcommand === "uninstall") {
    const packId = rest[0];
    if (!packId) {
      io.err("Usage: supercode pack uninstall <pack-id>");
      return 1;
    }

    try {
      const installed = uninstallWorkflowPack(cwd, packId);
      io.out(`Uninstalled pack ${packId}. Installed set: ${installed.installedPackIds.join(", ") || "(none)"}`);
      const state = buildRuntimeState(cwd);
      const runtime = createPersistedRuntimeContext(cwd, state.executionProfile);
      const hookExecutions = await runWorkflowHooks(runtime, "pack.uninstall.after", {
        packId,
        installedPackIds: installed.installedPackIds
      });
      emitHookReport(io, hookExecutions);
      if (hookExecutions.halted) {
        io.err(hookExecutions.abortReason ?? `Hooks ${hookExecutions.event} aborted command completion.`);
        return 1;
      }
      return 0;
    } catch (error) {
      io.err(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "skill" && subcommand === "search") {
    const query = rest.join(" ").trim();
    if (!query) {
      io.err("Usage: supercode skill search <query>");
      return 1;
    }

    for (const skill of searchSkills(query, cwd)) {
      io.out(`${skill.skillId}: ${skill.summary}`);
    }
    return 0;
  }

  if (command === "rule" && subcommand === "search") {
    const query = rest.join(" ").trim();
    if (!query) {
      io.err("Usage: supercode rule search <query>");
      return 1;
    }

    for (const rule of searchRules(query, cwd)) {
      io.out(`${rule.ruleId}: ${rule.summary}`);
    }
    return 0;
  }

  const pluginCommand = loadResolvedWorkflowCommands(cwd).find(candidate => candidate.commandName === command);
  if (pluginCommand) {
    let parsedInput: unknown;
    try {
      parsedInput = parsePluginCommandInput(pluginCommand.argsMode ?? "argv", [subcommand, ...rest].filter(Boolean));
    } catch (error) {
      io.err(
        `Invalid input for plugin command ${pluginCommand.commandName}: ${error instanceof Error ? error.message : String(error)}`
      );
      return 1;
    }

    const state = buildRuntimeState(cwd);
    const runtime = createPersistedRuntimeContext(cwd, state.executionProfile, {
      allowCategories: ["shell", "filesystem", "tool", "session"]
    });
    const taskRecord = runtime.taskManager.createTask({
      goal: `plugin command ${pluginCommand.commandName}`,
      metadata: {
        command: pluginCommand.commandName,
        pluginId: pluginCommand.pluginId,
        pluginCommandId: pluginCommand.commandId
      }
    });
    const runningTask = runtime.taskManager.startTask(taskRecord.taskId);
    runtime.stateStore.saveProgress(
      runtime.progressTracker.record({
        taskId: runningTask.taskId,
        type: "message",
        status: runningTask.status,
        message: `Executing plugin command ${pluginCommand.commandName}.`
      })
    );

    io.out(`Started task ${runningTask.taskId}`);

    const toolResult = await invokeRuntimeTool(
      runtime,
      pluginCommand.toolId,
      mergeCommandInput(pluginCommand.input, parsedInput),
      {
        taskId: runningTask.taskId,
        workingDirectory: cwd,
        metadata: {
          command: pluginCommand.commandName,
          pluginId: pluginCommand.pluginId,
          pluginCommandId: pluginCommand.commandId,
          pluginCommandPath: pluginCommand.path
        }
      }
    );

    if (!toolResult.ok) {
      const message = toolResult.error ?? `Plugin command ${pluginCommand.commandName} failed.`;
      runtime.taskManager.failTask(runningTask.taskId, {
        message,
        retryable: false,
        details: {
          toolId: toolResult.toolId,
          invocationId: toolResult.invocationId,
          pluginId: pluginCommand.pluginId,
          commandName: pluginCommand.commandName
        }
      });
      io.err(message);
      return 1;
    }

    const resultSummary = `Plugin command ${pluginCommand.commandName} completed successfully.`;
    const resultRecord = saveRuntimeResult(runtime, {
      kind: "tool-result",
      taskId: runningTask.taskId,
      toolId: pluginCommand.toolId,
      summary: resultSummary,
      data: {
        pluginId: pluginCommand.pluginId,
        commandId: pluginCommand.commandId,
        commandName: pluginCommand.commandName,
        output: toolResult.output
      }
    });
    const completedTask = runtime.taskManager.completeTask(runningTask.taskId, {
      summary: resultSummary,
      outputRef: resultRecord.resultRef,
      data: {
        resultRef: resultRecord.resultRef,
        pluginId: pluginCommand.pluginId,
        commandId: pluginCommand.commandId
      }
    });

    io.out(`Completed task ${completedTask.taskId}`);
    io.out(`Saved result ${resultRecord.resultRef}`);
    io.out(`Plugin command: ${pluginCommand.commandName} <plugin:${pluginCommand.pluginId}>`);
    io.out(`Tool: ${pluginCommand.toolId}`);
    return 0;
  }

  io.err(renderHelp());
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then(
    code => {
      process.exitCode = code;
    },
    error => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
