import { randomUUID } from "node:crypto";
import type {
  MemoryAttachment,
  MemoryProvider,
  MemoryProviderInfo,
  MemoryQuery,
  MemoryRecord
} from "@nareshdama/core";

export interface InMemoryMemoryProviderOptions {
  providerId?: string;
  displayName?: string;
  kind?: MemoryProviderInfo["kind"];
  seed?: MemoryRecord[];
}

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clampImportance(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
}

function matchesQuery(record: MemoryRecord, query: MemoryQuery): boolean {
  const normalizedText = query.text?.trim().toLowerCase();
  if (normalizedText) {
    const haystack = `${record.summary}\n${record.content}`.toLowerCase();
    if (!haystack.includes(normalizedText)) {
      return false;
    }
  }

  const normalizedTags = query.tags?.map(tag => tag.trim().toLowerCase()).filter(Boolean) ?? [];
  if (normalizedTags.length > 0) {
    const recordTags = new Set(record.tags.map(tag => tag.toLowerCase()));
    if (!normalizedTags.every(tag => recordTags.has(tag))) {
      return false;
    }
  }

  if (query.sessionId && record.provenance.sessionId !== query.sessionId) {
    return false;
  }

  if (query.taskId && record.provenance.taskId !== query.taskId) {
    return false;
  }

  return true;
}

export function scoreMemoryRecord(record: MemoryRecord, query: MemoryQuery = {}): number {
  let score = clampImportance(record.importance);

  if (query.text) {
    const normalizedText = query.text.trim().toLowerCase();
    if (record.summary.toLowerCase().includes(normalizedText)) {
      score += 0.35;
    } else if (record.content.toLowerCase().includes(normalizedText)) {
      score += 0.2;
    }
  }

  if (query.tags && query.tags.length > 0) {
    const recordTags = new Set(record.tags.map(tag => tag.toLowerCase()));
    const overlap = query.tags.filter(tag => recordTags.has(tag.toLowerCase())).length;
    score += overlap * 0.15;
  }

  if (query.sessionId && record.provenance.sessionId === query.sessionId) {
    score += 0.1;
  }

  if (query.taskId && record.provenance.taskId === query.taskId) {
    score += 0.15;
  }

  return Number(score.toFixed(4));
}

export class InMemoryMemoryProvider implements MemoryProvider {
  private readonly info: MemoryProviderInfo;
  private readonly records = new Map<string, MemoryRecord>();

  constructor(options: InMemoryMemoryProviderOptions = {}) {
    this.info = {
      providerId: options.providerId ?? "local-memory",
      displayName: options.displayName ?? "Local Memory",
      kind: options.kind ?? "local"
    };

    for (const seedRecord of options.seed ?? []) {
      this.records.set(seedRecord.memoryRef, clone(seedRecord));
    }
  }

  getInfo(): MemoryProviderInfo {
    return clone(this.info);
  }

  add(
    input: Omit<MemoryRecord, "memoryRef" | "createdAt" | "updatedAt"> &
      Partial<Pick<MemoryRecord, "memoryRef" | "createdAt" | "updatedAt">>
  ): MemoryRecord {
    const createdAt = input.createdAt ?? now();
    const record: MemoryRecord = {
      memoryRef: input.memoryRef ?? randomUUID(),
      content: input.content,
      summary: input.summary,
      tags: normalizeTags(input.tags),
      importance: clampImportance(input.importance),
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
      provenance: clone(input.provenance),
      retention: clone(input.retention),
      metadata: input.metadata ? clone(input.metadata) : undefined
    };

    this.records.set(record.memoryRef, record);
    return clone(record);
  }

  get(memoryRef: string): MemoryRecord | undefined {
    const record = this.records.get(memoryRef);
    return record ? clone(record) : undefined;
  }

  list(query: MemoryQuery = {}): MemoryRecord[] {
    const matches = [...this.records.values()]
      .filter(record => matchesQuery(record, query))
      .sort((left, right) => {
        const scoreDelta = scoreMemoryRecord(right, query) - scoreMemoryRecord(left, query);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map(record => clone(record));

    const limit = typeof query.limit === "number" && query.limit > 0 ? Math.floor(query.limit) : undefined;
    return limit ? matches.slice(0, limit) : matches;
  }

  attach(query: MemoryQuery = {}): MemoryAttachment[] {
    return this.list(query).map(record => ({
      memoryRef: record.memoryRef,
      summary: record.summary,
      content: record.content,
      score: scoreMemoryRecord(record, query),
      provenance: clone(record.provenance)
    }));
  }

  prune(): MemoryRecord[] {
    const removed: MemoryRecord[] = [];
    const sorted = [...this.records.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const currentTime = Date.now();

    for (const record of sorted) {
      if (record.retention.strategy === "ttl" && record.retention.ttlDays !== undefined) {
        const ttlMs = Math.max(0, record.retention.ttlDays) * 24 * 60 * 60 * 1000;
        const ageMs = currentTime - new Date(record.updatedAt).getTime();
        if (ageMs > ttlMs) {
          this.records.delete(record.memoryRef);
          removed.push(clone(record));
        }
      }
    }

    const remaining = [...this.records.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    remaining.forEach((record, index) => {
      if (record.retention.strategy === "count-bound" && record.retention.maxEntries !== undefined) {
        if (index >= Math.max(0, Math.floor(record.retention.maxEntries))) {
          this.records.delete(record.memoryRef);
          removed.push(clone(record));
        }
      }
    });

    return removed;
  }
}
