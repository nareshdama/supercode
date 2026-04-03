# Memory Architecture Notes

## Current State

Supercode memory is intentionally lightweight today:

- session-scoped capture in [session-memory.ts](../../packages/memory/src/session-memory.ts)
- pluggable provider surface in [simplemem-adapter.ts](../../packages/memory/src/simplemem-adapter.ts)
- runtime wiring in [runtime.ts](../../packages/cli/src/runtime.ts)

This is a good baseline, but it is only the first layer.

## Useful Patterns To Keep

### 1. Keep memory optional

Memory should remain a provider attached by configuration, not a mandatory runtime dependency.

That design is already correct in [runtime.ts](../../packages/cli/src/runtime.ts).

### 2. Separate session timeline from long-term retrieval

A richer memory system benefits from distinct layers:

- session lifecycle records
- extracted observations and summaries
- retrievable long-term memory entries

That separation avoids treating every raw event as durable memory.

### 3. Inject context with a budget

Useful memory recall should be assembled with a token or size budget and prioritized roughly as:

1. recent summaries
2. important observations
3. semantic matches relevant to the current task

This is better than blindly attaching the latest N records.

### 4. Preserve provenance

Every durable memory should keep enough metadata to answer:

- which session created it
- which task or result it came from
- why it was considered important

Supercode already stores some provenance. The next improvement is to make it richer and more queryable.

### 5. Consolidate over time

Long-term memory quality improves if the system can:

- decay stale entries
- merge near-duplicates
- prune low-value records safely

Without consolidation, memory quality drops as volume grows.

## Current Gaps In Supercode

- no formal session lifecycle hooks for memory start, stop, and finalization
- no ranked context-bundle assembly for task startup
- no consolidation pass for stale or duplicate memory
- no richer observation model beyond direct saved records

## Recommended Follow-Ups

1. Add a context-bundle builder ahead of task execution.
2. Introduce structured memory event types for task, result, decision, and discovery.
3. Add retention and consolidation behavior behind the provider interface instead of hard-coding it into the CLI.
