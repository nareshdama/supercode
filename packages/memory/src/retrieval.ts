import type { MemoryAttachment, MemoryProvider, MemoryQuery } from "@supercode/core";

export function attachTopMemories(provider: MemoryProvider, query: MemoryQuery = {}): MemoryAttachment[] {
  return provider.attach(query);
}

export function renderMemoryContext(attachments: MemoryAttachment[]): string {
  return attachments
    .map(
      attachment =>
        `[memory:${attachment.memoryRef}] ${attachment.summary}\n${attachment.content}`
    )
    .join("\n\n");
}
