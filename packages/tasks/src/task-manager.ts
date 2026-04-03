import { randomUUID } from "node:crypto";
import type {
  CancelTaskInput,
  CompleteTaskInput,
  CreateTaskInput,
  FailTaskInput,
  TaskEvent,
  TaskEventType,
  TaskManager,
  TaskQuery,
  TaskRecord
} from "@nareshdama/core";

type TaskListener = (event: TaskEvent, task: TaskRecord) => void;

export interface TaskManagerSeed {
  tasks?: TaskRecord[];
  events?: TaskEvent[];
}

export interface RetryTaskOptions {
  force?: boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function sortByCreatedAt(tasks: TaskRecord[]): TaskRecord[] {
  return tasks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function matchesTaskQuery(task: TaskRecord, query?: TaskQuery): boolean {
  if (!query) {
    return true;
  }

  if (query.parentTaskId !== undefined && task.parentTaskId !== query.parentTaskId) {
    return false;
  }

  if (query.status === undefined) {
    return true;
  }

  if (Array.isArray(query.status)) {
    return query.status.includes(task.status);
  }

  return task.status === query.status;
}

export class InMemoryTaskManager implements TaskManager {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly events = new Map<string, TaskEvent[]>();
  private readonly listeners = new Set<TaskListener>();

  constructor(seed?: TaskManagerSeed) {
    for (const task of seed?.tasks ?? []) {
      this.tasks.set(task.taskId, clone(task));
      this.events.set(task.taskId, []);
    }

    for (const event of seed?.events ?? []) {
      const nextEvents = [...(this.events.get(event.taskId) ?? []), clone(event)];
      this.events.set(event.taskId, nextEvents);
    }
  }

  createTask(input: CreateTaskInput): TaskRecord {
    const goal = input.goal.trim();
    if (!goal) {
      throw new Error("Task goal must be non-empty.");
    }

    const createdAt = now();
    const taskId = randomUUID();
    const parentTask = input.parentTaskId ? this.getTaskOrThrow(input.parentTaskId) : undefined;
    const task: TaskRecord = {
      taskId,
      goal,
      status: "queued",
      priority: input.priority ?? "normal",
      createdAt,
      updatedAt: createdAt,
      parentTaskId: parentTask?.taskId,
      childTaskIds: [],
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 1,
      metadata: clone(input.metadata ?? {})
    };

    this.tasks.set(task.taskId, task);
    this.events.set(task.taskId, []);

    if (parentTask) {
      parentTask.childTaskIds = [...parentTask.childTaskIds, task.taskId];
      parentTask.updatedAt = createdAt;
      this.tasks.set(parentTask.taskId, parentTask);
    }

    this.emit(task, "created", "Task created and queued.");
    return clone(task);
  }

  startTask(taskId: string): TaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "queued") {
      throw new Error(`Task ${taskId} cannot start from status ${task.status}.`);
    }

    const updatedAt = now();
    task.status = "running";
    task.startedAt = task.startedAt ?? updatedAt;
    task.updatedAt = updatedAt;
    task.attempts += 1;
    task.error = undefined;
    task.result = undefined;
    task.completedAt = undefined;

    this.tasks.set(task.taskId, task);
    this.emit(task, "started", "Task started.");
    return clone(task);
  }

  completeTask(taskId: string, input: CompleteTaskInput): TaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "running") {
      throw new Error(`Task ${taskId} cannot complete from status ${task.status}.`);
    }

    const completedAt = now();
    task.status = "completed";
    task.updatedAt = completedAt;
    task.completedAt = completedAt;
    task.error = undefined;
    task.result = {
      outcome: "success",
      summary: input.summary.trim() || "Task completed.",
      data: clone(input.data),
      outputRef: input.outputRef,
      completedAt
    };

    this.tasks.set(task.taskId, task);
    this.emit(task, "completed", task.result.summary, task.result.data);
    return clone(task);
  }

  failTask(taskId: string, input: FailTaskInput): TaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "running") {
      throw new Error(`Task ${taskId} cannot fail from status ${task.status}.`);
    }

    const completedAt = now();
    task.status = "failed";
    task.updatedAt = completedAt;
    task.completedAt = completedAt;
    task.error = {
      message: input.message.trim() || "Task failed.",
      code: input.code,
      retryable: input.retryable ?? false,
      details: clone(input.details)
    };
    task.result = {
      outcome: "failure",
      summary: task.error.message,
      data: clone(input.details),
      completedAt
    };

    this.tasks.set(task.taskId, task);
    this.emit(task, "failed", task.error.message, task.error.details);
    return clone(task);
  }

  cancelTask(taskId: string, input?: CancelTaskInput): TaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (!["queued", "running"].includes(task.status)) {
      throw new Error(`Task ${taskId} cannot be cancelled from status ${task.status}.`);
    }

    const completedAt = now();
    const summary = input?.reason?.trim() || "Task cancelled.";
    task.status = "cancelled";
    task.updatedAt = completedAt;
    task.completedAt = completedAt;
    task.error = undefined;
    task.result = {
      outcome: "cancelled",
      summary,
      completedAt
    };

    this.tasks.set(task.taskId, task);
    this.emit(task, "cancelled", summary);
    return clone(task);
  }

  retryTask(taskId: string, force = false): TaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "failed") {
      throw new Error(`Task ${taskId} cannot retry from status ${task.status}.`);
    }

    if (!force && !task.error?.retryable) {
      throw new Error(`Task ${taskId} failed with a non-retryable error.`);
    }

    if (task.attempts >= task.maxAttempts) {
      throw new Error(`Task ${taskId} exhausted its retry budget.`);
    }

    const updatedAt = now();
    task.status = "queued";
    task.updatedAt = updatedAt;
    task.completedAt = undefined;
    task.error = undefined;
    task.result = undefined;

    this.tasks.set(task.taskId, task);
    this.emit(task, "retried", "Task moved back to the queue for another attempt.");
    return clone(task);
  }

  resumeTask(taskId: string): TaskRecord {
    const task = this.getTaskOrThrow(taskId);
    if (task.status !== "failed") {
      throw new Error(`Task ${taskId} cannot resume from status ${task.status}.`);
    }

    if (task.attempts >= task.maxAttempts) {
      throw new Error(`Task ${taskId} exhausted its retry budget.`);
    }

    const updatedAt = now();
    task.status = "running";
    task.updatedAt = updatedAt;
    task.attempts += 1;
    task.completedAt = undefined;
    task.error = undefined;
    task.result = undefined;

    this.tasks.set(task.taskId, task);
    this.emit(task, "retried", "Task resumed from stored progress.");
    return clone(task);
  }

  getTask(taskId: string): TaskRecord | undefined {
    const task = this.tasks.get(taskId);
    return task ? clone(task) : undefined;
  }

  listTasks(query?: TaskQuery): TaskRecord[] {
    return sortByCreatedAt(
      [...this.tasks.values()]
        .filter(task => matchesTaskQuery(task, query))
        .map(task => clone(task))
    );
  }

  getTaskEvents(taskId: string): TaskEvent[] {
    return (this.events.get(taskId) ?? []).map(event => clone(event));
  }

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getTaskOrThrow(taskId: string): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }

    return task;
  }

  private emit(task: TaskRecord, type: TaskEventType, message?: string, data?: unknown): void {
    const event: TaskEvent = {
      eventId: randomUUID(),
      taskId: task.taskId,
      type,
      status: task.status,
      timestamp: now(),
      message,
      data: clone(data)
    };
    const nextEvents = [...(this.events.get(task.taskId) ?? []), event];
    this.events.set(task.taskId, nextEvents);

    const taskSnapshot = clone(task);
    const eventSnapshot = clone(event);
    for (const listener of this.listeners) {
      listener(eventSnapshot, taskSnapshot);
    }
  }
}
