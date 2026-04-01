import { randomUUID } from "node:crypto";
import type {
  ProgressEvent,
  ProgressStep,
  ProgressTracker,
  RecordProgressInput,
  TaskEvent,
  TaskProgressSnapshot,
  TaskStatus
} from "@supercode/core";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function cloneSteps(steps: ProgressStep[]): ProgressStep[] {
  return steps.map(step => clone(step));
}

function createSnapshot(taskId: string, timestamp: string): TaskProgressSnapshot {
  return {
    taskId,
    status: "queued",
    percentComplete: 0,
    steps: [],
    events: [],
    updatedAt: timestamp
  };
}

function sortSnapshots(snapshots: TaskProgressSnapshot[]): TaskProgressSnapshot[] {
  return snapshots.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export class InMemoryProgressTracker implements ProgressTracker {
  private readonly snapshots = new Map<string, TaskProgressSnapshot>();

  constructor(seed?: TaskProgressSnapshot[]) {
    for (const snapshot of seed ?? []) {
      this.snapshots.set(snapshot.taskId, clone(snapshot));
    }
  }

  record(input: RecordProgressInput): TaskProgressSnapshot {
    return this.applyEvent({
      eventId: randomUUID(),
      taskId: input.taskId,
      type: input.type,
      timestamp: now(),
      status: input.status,
      message: input.message,
      percentComplete: input.percentComplete,
      step: input.step ? clone(input.step) : undefined
    });
  }

  recordTaskEvent(event: TaskEvent): TaskProgressSnapshot {
    const mapped = this.mapTaskEvent(event);
    return this.applyEvent({
      eventId: event.eventId,
      taskId: event.taskId,
      type: mapped.type,
      timestamp: event.timestamp,
      status: mapped.status,
      message: mapped.message,
      percentComplete: mapped.percentComplete
    });
  }

  getTaskProgress(taskId: string): TaskProgressSnapshot | undefined {
    const snapshot = this.snapshots.get(taskId);
    return snapshot ? clone(snapshot) : undefined;
  }

  listTaskProgress(): TaskProgressSnapshot[] {
    return sortSnapshots([...this.snapshots.values()].map(snapshot => clone(snapshot)));
  }

  private applyEvent(event: ProgressEvent): TaskProgressSnapshot {
    const current = this.snapshots.get(event.taskId);
    const next = current ? clone(current) : createSnapshot(event.taskId, event.timestamp);

    if (event.status) {
      next.status = event.status;
    }

    if (event.message) {
      next.summary = event.message;
    }

    if (event.percentComplete !== undefined) {
      next.percentComplete = clampPercent(event.percentComplete);
    }

    if (event.step) {
      next.steps = this.updateSteps(next.steps, event.step, event.timestamp);
    }

    next.updatedAt = event.timestamp;
    next.events = [...next.events, clone(event)];
    this.snapshots.set(next.taskId, next);
    return clone(next);
  }

  private updateSteps(steps: ProgressStep[], step: ProgressStep, timestamp: string): ProgressStep[] {
    const nextSteps = cloneSteps(steps);
    const index = nextSteps.findIndex(existing => existing.stepId === step.stepId);
    const normalizedStep: ProgressStep = {
      ...clone(step),
      startedAt: step.startedAt ?? (step.status === "in_progress" ? timestamp : step.startedAt),
      completedAt:
        step.completedAt ??
        (["completed", "failed", "cancelled"].includes(step.status) ? timestamp : step.completedAt)
    };

    if (index === -1) {
      nextSteps.push(normalizedStep);
      return nextSteps;
    }

    nextSteps[index] = {
      ...nextSteps[index],
      ...normalizedStep,
      startedAt: normalizedStep.startedAt ?? nextSteps[index].startedAt,
      completedAt: normalizedStep.completedAt ?? nextSteps[index].completedAt
    };
    return nextSteps;
  }

  private mapTaskEvent(event: TaskEvent): {
    type: ProgressEvent["type"];
    status: TaskStatus;
    message?: string;
    percentComplete?: number;
  } {
    switch (event.type) {
      case "created":
        return {
          type: "task-status",
          status: event.status,
          message: event.message ?? "Task queued.",
          percentComplete: 0
        };
      case "started":
        return {
          type: "task-status",
          status: event.status,
          message: event.message ?? "Task started."
        };
      case "completed":
        return {
          type: "task-status",
          status: event.status,
          message: event.message ?? "Task completed.",
          percentComplete: 100
        };
      case "failed":
        return {
          type: "task-status",
          status: event.status,
          message: event.message ?? "Task failed."
        };
      case "cancelled":
        return {
          type: "task-status",
          status: event.status,
          message: event.message ?? "Task cancelled."
        };
      case "retried":
        return {
          type: "task-status",
          status: event.status,
          message: event.message ?? "Task re-queued.",
          percentComplete: 0
        };
      default:
        return {
          type: "message",
          status: event.status,
          message: event.message
        };
    }
  }
}
