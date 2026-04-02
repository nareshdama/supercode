import type { MemoryRecord } from "@supercode/core";

export function isMemoryExpired(record: MemoryRecord, referenceTime = Date.now()): boolean {
  if (record.retention.strategy !== "ttl" || record.retention.ttlDays === undefined) {
    return false;
  }

  const ttlMs = Math.max(0, record.retention.ttlDays) * 24 * 60 * 60 * 1000;
  return referenceTime - new Date(record.updatedAt).getTime() > ttlMs;
}

export function sortMemoryByRecency(records: MemoryRecord[]): MemoryRecord[] {
  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
