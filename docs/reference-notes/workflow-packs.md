# Workflow Pack Notes

## What Matters

Supercode already has the right core shape for curated workflow content:

- pack manifests in [manifests.ts](../../packages/workflows/src/manifests.ts)
- pack and plugin loading in [index.ts](../../packages/workflows/src/index.ts)
- project bootstrap guidance in [scaffold.ts](../../packages/cli/src/scaffold.ts)

The next useful step is not a new subsystem. It is richer content and clearer contracts.

## Useful Patterns To Keep

### 1. Curated vs local-only workflow assets

Keep a hard boundary between:

- curated packs that ship with Supercode
- user-managed local hooks and plugins under `.supercode/`
- future imported or generated assets that should not be treated as core product content

This keeps install, repair, and sync behavior predictable.

### 2. Install intent should stay machine-readable

Phase 7 already added install smoke checks. The next layer is stronger install semantics:

- what was requested
- what was resolved
- what files are managed by Supercode
- what can be safely repaired or removed later

That should stay tied to pack state and generated extension state, not inferred from loose file scans.

### 3. Commands and agents can be modeled as workflow content

The current built-in pack content is intentionally small. Future packs can expand into:

- planning guidance
- verification flows
- review personas
- security review personas
- orchestrated multi-step workflows

These should remain declarative where possible and only drop to runtime code when execution needs it.

### 4. Session snapshots need a stable contract if control-plane features grow

If Supercode grows richer multi-worker orchestration, use a single normalized session snapshot shape so:

- CLI inspection does not depend on backend-specific storage
- future UI layers can consume one format
- adapters can be swapped without rewriting consumers

## Current Gaps In Supercode

- pack `references` arrays are empty in [manifests.ts](../../packages/workflows/src/manifests.ts)
- pack content is still minimal compared with the plugin and hook runtime already implemented
- there is no formal contract yet for multi-session or worker snapshots

## Recommended Follow-Ups

1. Expand the `core` and `typescript` packs with more concrete review, verification, and release guidance.
2. Add one documented session snapshot schema before building deeper orchestration UX.
3. Keep generated and user-managed extension paths separate, and preserve that rule in future pack sync work.
