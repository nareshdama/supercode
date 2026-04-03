import type {
  MemoryAttachment,
  MemoryProvider,
  MemoryQuery,
  MemoryRecord,
  MemoryRetentionPolicy
} from "@nareshdama/core";

export interface SessionMemoryOptions {
  provider: MemoryProvider;
  sessionId: string;
  defaultRetention?: MemoryRetentionPolicy;
  defaultTags?: string[];
}

export interface RememberMemoryInput {
  content: string;
  summary: string;
  tags?: string[];
  taskId?: string;
  resultRef?: string;
  sourceKind?: MemoryRecord["provenance"]["sourceKind"];
  sourceLabel?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export class SessionMemory {
  private readonly provider: MemoryProvider;
  private readonly sessionId: string;
  private readonly defaultRetention: MemoryRetentionPolicy;
  private readonly defaultTags: string[];

  constructor(options: SessionMemoryOptions) {
    this.provider = options.provider;
    this.sessionId = options.sessionId;
    this.defaultRetention = options.defaultRetention ?? {
      strategy: "count-bound",
      maxEntries: 200
    };
    this.defaultTags = options.defaultTags ?? [];
  }

  remember(input: RememberMemoryInput): MemoryRecord {
    return this.provider.add({
      content: input.content,
      summary: input.summary,
      tags: unique([...this.defaultTags, ...(input.tags ?? [])]),
      importance: input.importance ?? 0.5,
      provenance: {
        sessionId: this.sessionId,
        taskId: input.taskId,
        resultRef: input.resultRef,
        sourceKind: input.sourceKind ?? "task",
        sourceLabel: input.sourceLabel
      },
      retention: this.defaultRetention,
      metadata: input.metadata
    });
  }

  rememberResult(input: Omit<RememberMemoryInput, "sourceKind">): MemoryRecord {
    return this.remember({
      ...input,
      sourceKind: "result"
    });
  }

  attachForTask(query: Omit<MemoryQuery, "sessionId"> = {}): MemoryAttachment[] {
    return this.provider.attach({
      ...query,
      sessionId: this.sessionId
    });
  }

  listForSession(query: Omit<MemoryQuery, "sessionId"> = {}): MemoryRecord[] {
    return this.provider.list({
      ...query,
      sessionId: this.sessionId
    });
  }
}
