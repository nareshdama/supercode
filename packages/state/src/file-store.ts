import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  PermissionLogEntry,
  ResultRecord,
  SessionState,
  StoredPlan,
  ExecutionPlan,
  TaskEvent,
  TaskProgressSnapshot,
  TaskRecord
} from "@supercode/core";

type PersistedTaskRecord = {
  task: TaskRecord;
  events: TaskEvent[];
};

export interface RuntimeStateLayout {
  supercodeDir: string;
  sessionPath: string;
  tasksDir: string;
  progressDir: string;
  resultsDir: string;
  plansDir: string;
  artifactsDir: string;
  permissionsPath: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

const MAX_PREVIEW_LENGTH = 2000;

function truncatePreview(value: string): string {
  if (value.length <= MAX_PREVIEW_LENGTH) {
    return value;
  }
  return value.slice(0, MAX_PREVIEW_LENGTH) + "\n[truncated]";
}

function readJson<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sortByTaskId<T extends { taskId: string }>(items: T[]): T[] {
  return items.sort((left, right) => left.taskId.localeCompare(right.taskId));
}

function sortResults(results: ResultRecord[]): ResultRecord[] {
  return results.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getRuntimeStateLayout(cwd: string): RuntimeStateLayout {
  const supercodeDir = path.join(cwd, ".supercode");
  return {
    supercodeDir,
    sessionPath: path.join(supercodeDir, "session.json"),
    tasksDir: path.join(supercodeDir, "tasks"),
    progressDir: path.join(supercodeDir, "progress"),
    resultsDir: path.join(supercodeDir, "results"),
    plansDir: path.join(supercodeDir, "plans"),
    artifactsDir: path.join(supercodeDir, "artifacts"),
    permissionsPath: path.join(supercodeDir, "permissions.json")
  };
}

export class FileRuntimeStateStore {
  readonly layout: RuntimeStateLayout;

  constructor(cwd: string) {
    this.layout = getRuntimeStateLayout(cwd);
  }

  ensureLayout(): RuntimeStateLayout {
    mkdirSync(this.layout.supercodeDir, { recursive: true });
    mkdirSync(this.layout.tasksDir, { recursive: true });
    mkdirSync(this.layout.progressDir, { recursive: true });
    mkdirSync(this.layout.resultsDir, { recursive: true });
    mkdirSync(this.layout.plansDir, { recursive: true });
    mkdirSync(this.layout.artifactsDir, { recursive: true });
    return this.layout;
  }

  loadSession(): SessionState | undefined {
    const parsed = readJson<SessionState>(this.layout.sessionPath);
    return parsed ? clone(parsed) : undefined;
  }

  loadOrCreateSession(): SessionState {
    this.ensureLayout();
    const existing = this.loadSession();
    if (existing) {
      return existing;
    }

    const createdAt = now();
    const session: SessionState = {
      sessionId: randomUUID(),
      createdAt,
      updatedAt: createdAt,
      activeTaskIds: [],
      recentTaskIds: [],
      resultRefs: []
    };
    this.saveSession(session);
    return session;
  }

  saveSession(session: SessionState): SessionState {
    this.ensureLayout();
    writeJson(this.layout.sessionPath, session);
    return clone(session);
  }

  saveTask(task: TaskRecord, events: TaskEvent[]): PersistedTaskRecord {
    this.ensureLayout();
    const persisted: PersistedTaskRecord = {
      task: clone(task),
      events: events.map(event => clone(event))
    };
    writeJson(path.join(this.layout.tasksDir, `${task.taskId}.json`), persisted);
    return persisted;
  }

  loadTask(taskId: string): PersistedTaskRecord | undefined {
    const parsed = readJson<PersistedTaskRecord>(path.join(this.layout.tasksDir, `${taskId}.json`));
    return parsed ? clone(parsed) : undefined;
  }

  listTasks(): TaskRecord[] {
    if (!existsSync(this.layout.tasksDir)) {
      return [];
    }

    const tasks = readdirSync(this.layout.tasksDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => readJson<PersistedTaskRecord>(path.join(this.layout.tasksDir, entry.name)))
      .filter(Boolean)
      .map(entry => clone((entry as PersistedTaskRecord).task));

    return sortByTaskId(tasks);
  }

  listTaskEvents(): TaskEvent[] {
    if (!existsSync(this.layout.tasksDir)) {
      return [];
    }

    const events = readdirSync(this.layout.tasksDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => readJson<PersistedTaskRecord>(path.join(this.layout.tasksDir, entry.name)))
      .filter(Boolean)
      .flatMap(entry => (entry as PersistedTaskRecord).events.map(event => clone(event)));

    return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  saveProgress(snapshot: TaskProgressSnapshot): TaskProgressSnapshot {
    this.ensureLayout();
    writeJson(path.join(this.layout.progressDir, `${snapshot.taskId}.json`), snapshot);
    return clone(snapshot);
  }

  loadProgress(taskId: string): TaskProgressSnapshot | undefined {
    const parsed = readJson<TaskProgressSnapshot>(path.join(this.layout.progressDir, `${taskId}.json`));
    return parsed ? clone(parsed) : undefined;
  }

  listProgress(): TaskProgressSnapshot[] {
    if (!existsSync(this.layout.progressDir)) {
      return [];
    }

    return readdirSync(this.layout.progressDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => readJson<TaskProgressSnapshot>(path.join(this.layout.progressDir, entry.name)))
      .filter(Boolean)
      .map(snapshot => clone(snapshot as TaskProgressSnapshot))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  loadPermissionLog(): PermissionLogEntry[] {
    const parsed = readJson<PermissionLogEntry[]>(this.layout.permissionsPath);
    return parsed ? parsed.map(entry => clone(entry)) : [];
  }

  savePermissionLog(entries: PermissionLogEntry[]): PermissionLogEntry[] {
    this.ensureLayout();
    writeJson(this.layout.permissionsPath, entries);
    return entries.map(entry => clone(entry));
  }

  appendPermissionLog(entry: PermissionLogEntry): PermissionLogEntry[] {
    const entries = [...this.loadPermissionLog(), clone(entry)];
    return this.savePermissionLog(entries);
  }

  saveResult(input: Omit<ResultRecord, "resultRef" | "createdAt" | "preview"> & Partial<Pick<ResultRecord, "resultRef" | "createdAt" | "preview">>): ResultRecord {
    this.ensureLayout();
    const resultRef = input.resultRef ?? randomUUID();
    const createdAt = input.createdAt ?? now();

    // Generate preview from data, truncating large outputs.
    let preview = input.preview ?? input.summary;
    let artifactRef: string | undefined = input.artifactRef;
    if (input.data !== undefined) {
      const serialized = JSON.stringify(input.data);
      if (serialized.length > MAX_PREVIEW_LENGTH) {
        // Store full data as an artifact file.
        artifactRef = artifactRef ?? resultRef;
        writeFileSync(
          path.join(this.layout.artifactsDir, `${artifactRef}.json`),
          `${serialized}\n`,
          "utf8"
        );
        preview = truncatePreview(serialized);
      } else {
        preview = serialized;
      }
    }

    const record: ResultRecord = {
      resultRef,
      createdAt,
      summary: input.summary,
      preview,
      taskId: input.taskId,
      toolId: input.toolId,
      kind: input.kind,
      data: clone(input.data),
      artifactRef
    };
    writeJson(path.join(this.layout.resultsDir, `${record.resultRef}.json`), record);

    const session = this.loadOrCreateSession();
    const nextSession: SessionState = {
      ...session,
      updatedAt: now(),
      resultRefs: [...new Set([record.resultRef, ...session.resultRefs])].slice(0, 50)
    };
    this.saveSession(nextSession);
    return clone(record);
  }

  loadResult(resultRef: string): ResultRecord | undefined {
    const parsed = readJson<ResultRecord>(path.join(this.layout.resultsDir, `${resultRef}.json`));
    return parsed ? clone(parsed) : undefined;
  }

  listResults(): ResultRecord[] {
    if (!existsSync(this.layout.resultsDir)) {
      return [];
    }

    const results = readdirSync(this.layout.resultsDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => readJson<ResultRecord>(path.join(this.layout.resultsDir, entry.name)))
      .filter(Boolean)
      .map(result => clone(result as ResultRecord));

    return sortResults(results);
  }

  // --- Plan persistence ---

  savePlan(plan: ExecutionPlan): StoredPlan {
    this.ensureLayout();
    const planRef = plan.planRef ?? randomUUID();
    const stored: StoredPlan = {
      planRef,
      plan: clone({ ...plan, planRef }),
      storedAt: now(),
      taskId: plan.taskId
    };
    writeJson(path.join(this.layout.plansDir, `${plan.taskId}.json`), stored);
    return clone(stored);
  }

  loadPlan(taskId: string): StoredPlan | undefined {
    const parsed = readJson<StoredPlan>(path.join(this.layout.plansDir, `${taskId}.json`));
    return parsed ? clone(parsed) : undefined;
  }

  listPlans(): StoredPlan[] {
    if (!existsSync(this.layout.plansDir)) {
      return [];
    }

    return readdirSync(this.layout.plansDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => readJson<StoredPlan>(path.join(this.layout.plansDir, entry.name)))
      .filter(Boolean)
      .map(stored => clone(stored as StoredPlan));
  }

  // --- Artifact persistence ---

  saveArtifact(resultRef: string, content: string): string {
    this.ensureLayout();
    const artifactPath = path.join(this.layout.artifactsDir, `${resultRef}.txt`);
    writeFileSync(artifactPath, content, "utf8");
    return artifactPath;
  }

  loadArtifact(resultRef: string): string | undefined {
    const txtPath = path.join(this.layout.artifactsDir, `${resultRef}.txt`);
    const jsonPath = path.join(this.layout.artifactsDir, `${resultRef}.json`);
    for (const candidate of [txtPath, jsonPath]) {
      if (existsSync(candidate)) {
        try {
          return readFileSync(candidate, "utf8");
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }
}
