import type {
  MemoryAttachment,
  MemoryProvider,
  MemoryProviderInfo,
  MemoryQuery,
  MemoryRecord
} from "@nareshdama/core";
import { InMemoryMemoryProvider } from "./provider.js";

export interface SimpleMemAdapterOptions {
  providerId?: string;
  displayName?: string;
  delegate?: MemoryProvider;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class SimpleMemAdapter implements MemoryProvider {
  private readonly info: MemoryProviderInfo;
  private readonly delegate: MemoryProvider;

  constructor(options: SimpleMemAdapterOptions = {}) {
    this.info = {
      providerId: options.providerId ?? "simplemem-adapter",
      displayName: options.displayName ?? "SimpleMem Adapter",
      kind: "adapter"
    };
    this.delegate =
      options.delegate ??
      new InMemoryMemoryProvider({
        providerId: this.info.providerId,
        displayName: this.info.displayName,
        kind: "adapter"
      });
  }

  getInfo(): MemoryProviderInfo {
    return clone(this.info);
  }

  add(
    record: Omit<MemoryRecord, "memoryRef" | "createdAt" | "updatedAt"> &
      Partial<Pick<MemoryRecord, "memoryRef" | "createdAt" | "updatedAt">>
  ): MemoryRecord {
    return this.delegate.add(record);
  }

  get(memoryRef: string): MemoryRecord | undefined {
    return this.delegate.get(memoryRef);
  }

  list(query: MemoryQuery = {}): MemoryRecord[] {
    return this.delegate.list(query);
  }

  attach(query: MemoryQuery = {}): MemoryAttachment[] {
    return this.delegate.attach(query);
  }

  prune(): MemoryRecord[] {
    return this.delegate.prune();
  }
}
