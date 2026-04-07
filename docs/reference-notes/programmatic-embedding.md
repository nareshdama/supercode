# Programmatic embedding (`@nareshdama/supercode/runtime`)

Use this note when wiring host applications or tests that need the same persisted kernel as the CLI without driving `supercode` interactively.

## Package entry

- **Subpath**: `@nareshdama/supercode/runtime` → `packages/cli` build output (`dist/runtime.js`, `dist/runtime.d.ts`).
- **Module system**: ESM only. The CLI package is `"type": "module"`. Use static `import` or dynamic `import()` from CommonJS; do not rely on `require("@nareshdama/supercode/runtime")`.

## Primary exports (conceptual)

| Symbol | Role |
|--------|------|
| `resolveExecutionProfileInputs` | One `detectRuntimeInputs` pass plus workflow recommendation and `ExecutionProfile` — shared with the CLI doctor/run pipeline. |
| `buildExecutionProfileForProject` | Convenience: returns only the `ExecutionProfile` from that pipeline. |
| `createPersistedRuntimeContext` | Full persisted kernel (state layout, tools, MCP, optional memory). Intentionally heavy; use when you need the real runtime, not a quick probe. |
| `invokeRuntimeTool`, `evaluateRuntimePermission`, `runWorkflowHooks`, … | Same persisted-context operations the CLI uses. |

Source of truth: [`packages/cli/src/runtime.ts`](../../packages/cli/src/runtime.ts).

## Dependency story

Prefer importing **only** `@nareshdama/supercode` (and thus the `./runtime` subpath) in application `package.json`. The profile helpers bundle the same `@nareshdama/core` + `@nareshdama/detect` + `@nareshdama/workflows` composition the CLI uses, which avoids strict package-manager hoisting issues when nested packages are not direct dependencies.

## Examples and tutorials

- [examples/programmatic-runtime/README.md](../../examples/programmatic-runtime/README.md) — minimal Node host that builds a profile and prints a JSON summary.
- [examples/README.md](../../examples/README.md) — full tutorial index.

## Operational notes

- `createPersistedRuntimeContext` performs substantial filesystem and registry work; profile-only checks should use `buildExecutionProfileForProject` or `resolveExecutionProfileInputs`.
- Host examples may print `sessionId` in stdout; treat as sensitive in shared logs if needed.
- Example hosts may redact stderr paths; adjust for your deployment policy.
