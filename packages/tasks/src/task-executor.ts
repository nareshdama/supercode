import { randomUUID } from "node:crypto";
import type {
  ExecutionOutcome,
  ExecutionPlan,
  ExecutionStep,
  ProgressTracker,
  StepOutcome,
  TaskExecutor,
  TaskManager,
  ToolRegistry
} from "@nareshdama/core";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function stepToProgress(step: ExecutionStep, status: "pending" | "in_progress" | "completed" | "failed") {
  return {
    stepId: step.stepId,
    title: step.title ?? step.toolId,
    status
  };
}

function mapToolFailure(
  step: ExecutionStep,
  result: Awaited<ReturnType<ToolRegistry["invoke"]>>,
  stepOutcomes: StepOutcome[],
  runStartedAt: string
): ExecutionOutcome {
  const completedAt = now();
  const durationMs = new Date(completedAt).getTime() - new Date(runStartedAt).getTime();
  return {
    success: false,
    summary: result.error ?? `Tool ${step.toolId} failed.`,
    outputRef: result.outputRef,
    data: result,
    completedAt,
    startedAt: runStartedAt,
    durationMs,
    stepOutcomes
  };
}

function extractShellFields(output: unknown): { exitCode?: number | null; stdout?: string; stderr?: string; timedOut?: boolean } {
  if (!output || typeof output !== "object") {
    return {};
  }
  const record = output as Record<string, unknown>;
  return {
    exitCode: typeof record.code === "number" || record.code === null ? (record.code as number | null) : undefined,
    stdout: typeof record.stdout === "string" ? record.stdout : undefined,
    stderr: typeof record.stderr === "string" ? record.stderr : undefined,
    timedOut: typeof record.timedOut === "boolean" ? record.timedOut : undefined
  };
}

export class SimpleTaskExecutor implements TaskExecutor {
  constructor(
    private readonly tasks: TaskManager,
    private readonly progress: ProgressTracker,
    private readonly tools: ToolRegistry
  ) {}

  async run(plan: ExecutionPlan): Promise<ExecutionOutcome> {
    return this.executeSteps(plan, new Set());
  }

  async resume(plan: ExecutionPlan, completedStepIds: string[]): Promise<ExecutionOutcome> {
    return this.executeSteps(plan, new Set(completedStepIds));
  }

  private async executeSteps(plan: ExecutionPlan, skipStepIds: Set<string>): Promise<ExecutionOutcome> {
    const task = this.tasks.getTask(plan.taskId);
    if (!task || task.status !== "running") {
      return {
        success: false,
        summary: `Task ${plan.taskId} is not running; executor did not start.`,
        completedAt: now()
      };
    }

    const runStartedAt = now();
    const stepOutcomes: StepOutcome[] = [];

    for (const step of plan.steps) {
      // Skip completed steps during resume.
      if (skipStepIds.has(step.stepId)) {
        this.progress.record({
          taskId: plan.taskId,
          type: "step-updated",
          status: task.status,
          step: stepToProgress(step, "completed"),
          message: "Step skipped (already completed)."
        });
        continue;
      }

      this.progress.record({
        taskId: plan.taskId,
        type: "step-updated",
        status: task.status,
        step: stepToProgress(step, "in_progress")
      });

      const stepStartedAt = now();
      const result = await this.tools.invoke(step.toolId, clone(step.input ?? {}), {
        taskId: plan.taskId,
        metadata: {
          ...(step.metadata ?? {}),
          stepId: step.stepId,
          planCreatedAt: plan.createdAt,
          planRef: plan.planRef
        }
      });
      const stepCompletedAt = now();
      const stepDurationMs = new Date(stepCompletedAt).getTime() - new Date(stepStartedAt).getTime();

      const shellFields = extractShellFields(result.output);
      const stepOutcome: StepOutcome = {
        stepId: step.stepId,
        toolId: step.toolId,
        ok: result.ok,
        output: result.output,
        error: result.error,
        startedAt: stepStartedAt,
        completedAt: stepCompletedAt,
        durationMs: stepDurationMs,
        ...shellFields
      };
      stepOutcomes.push(stepOutcome);

      if (!result.ok) {
        this.progress.record({
          taskId: plan.taskId,
          type: "step-updated",
          status: "failed",
          step: stepToProgress(step, "failed")
        });

        return mapToolFailure(step, result, stepOutcomes, runStartedAt);
      }

      this.progress.record({
        taskId: plan.taskId,
        type: "step-updated",
        status: task.status,
        step: stepToProgress(step, "completed")
      });
    }

    const completedAt = now();
    const durationMs = new Date(completedAt).getTime() - new Date(runStartedAt).getTime();
    const executedCount = plan.steps.length - skipStepIds.size;
    const skippedCount = skipStepIds.size;
    const summaryParts = [`Executed ${executedCount} step(s) successfully.`];
    if (skippedCount > 0) {
      summaryParts.push(`Skipped ${skippedCount} completed step(s).`);
    }

    return {
      success: true,
      summary: summaryParts.join(" "),
      data: {
        planId: plan.planRef ?? randomUUID(),
        steps: plan.steps.map(step => step.stepId)
      },
      completedAt,
      startedAt: runStartedAt,
      durationMs,
      stepOutcomes
    };
  }
}
