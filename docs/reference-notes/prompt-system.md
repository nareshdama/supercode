# Prompt System Notes

## Current State

Supercode has a useful prompt registry in [prompt-registry.ts](../../packages/models/src/prompt-registry.ts), but it is still only a template catalog.

That is enough for the current release baseline, but not enough for a more advanced agent runtime.

## Useful Patterns To Keep

### 1. Compose prompts from layers

A stronger prompt system should be built from distinct layers:

- base system identity
- runtime mode or coordinator instructions
- task-specific instructions
- optional agent or pack-specific additions
- append-only operator guidance

That is more flexible than choosing exactly one full prompt body.

### 2. Keep prompt variants purpose-built

Different prompt families should stay separate:

- normal task execution
- planning
- review
- memory extraction
- context summarization or compaction

Trying to force all of that into one generic template usually produces weak instructions.

### 3. Memory prompts need explicit save boundaries

If Supercode grows richer memory support, prompt design should be explicit about:

- what should be remembered
- what should never be remembered
- when to use memory vs plan state vs task state
- how memory writes are indexed and deduplicated

### 4. Compaction needs a strict output contract

If future sessions use summarization or context compaction, the summarizer should emit a structured summary shape with:

- request and intent
- technical concepts
- files touched
- errors and fixes
- pending tasks
- exact current stopping point

This reduces drift when a long-running session is resumed.

## Current Gaps In Supercode

- built-in prompts are minimal and not yet connected to richer runtime modes
- there is no prompt composition pipeline in the CLI runtime
- there is no memory-extraction or compaction prompt family yet

## Recommended Follow-Ups

1. Split prompt concerns into execution, planning, review, and memory families.
2. Add a prompt-composition layer above the registry.
3. Keep prompt inputs strongly typed so future agent modes stay testable.
