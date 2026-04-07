# Developing Supercode

## Workspace Overview

Supercode is a TypeScript monorepo with publishable packages under `packages/`.

Primary published packages:

- `@nareshdama/supercode`: CLI package
- `@nareshdama/create-supercode`: project scaffolder
- `@nareshdama/core`: shared contracts
- `@nareshdama/models`: model adapters, routing, budgets, prompts
- `@nareshdama/detect`: environment and project detection
- `@nareshdama/permissions`: runtime permission decisions
- `@nareshdama/progress`: progress tracking
- `@nareshdama/state`: persisted runtime state
- `@nareshdama/tasks`: task lifecycle and executor
- `@nareshdama/tools`: built-in runtime tool registry
- `@nareshdama/workflows`: workflow packs, plugins, hooks, validation
- `@nareshdama/mcp`: MCP runtime and trust posture
- `@nareshdama/memory`: optional memory layer

## Directory Layout

- `packages/`: publishable runtime packages
- `templates/`: scaffolded project templates
- `workflow-packs/`: shipped workflow-pack content
- `examples/`: example usage and integration walkthroughs
- `scripts/`: release, smoke, docs, profiling, and verification scripts
- `docs/reference-notes/`: reference-derived design notes

## Common Commands

```bash
npm install
npm run build
npm test
npm run verify:docs
npm run smoke:phase7
npm run coverage:gate
npm run profile:baseline
```

## Development Flow

1. Build context first.
2. Change the smallest stable surface that solves the problem.
3. Update tests with the code change.
4. Update docs when package names, commands, install paths, or roadmap state changes.
5. Re-run the narrowest command set that proves the change.

## Programmatic embedding

The CLI package exposes a stable subpath for host apps and integration tests:

```text
@nareshdama/supercode/runtime
```

- **Module system**: ESM only (`import` / dynamic `import()`). This matches `"type": "module"` on `@nareshdama/supercode`; CommonJS `require` of this subpath is not supported.
- **Execution profile**: Use `buildExecutionProfileForProject(cwd)` or `resolveExecutionProfileInputs(cwd)` so your embedder matches the CLI doctor/run pipeline (single detect + workflow recommendation + `createExecutionProfile`). Avoid hand-rolling imports from `@nareshdama/core`, `@nareshdama/detect`, and `@nareshdama/workflows` in application code unless you have a reason — strict package managers may not hoist nested dependencies.
- **Full kernel**: `createPersistedRuntimeContext` constructs the persisted runtime (filesystem layout, tool registry, MCP, optional memory). It is intentionally heavier than profile-only helpers; use it when you need the same kernel as `supercode task` / `supercode run`, not for a lightweight capability check.

Implementation: [`packages/cli/src/runtime.ts`](packages/cli/src/runtime.ts). Walkthrough: [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md). Deeper reference: [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md).

## Package Relationships

- `core` is the shared contract layer used by nearly every runtime package.
- `tasks`, `progress`, `permissions`, `state`, and `tools` make up the execution kernel.
- `models`, `mcp`, `memory`, and `workflows` extend the kernel with governed integration layers.
- `@nareshdama/supercode` composes those packages into the CLI.
- `@nareshdama/create-supercode` depends on the CLI package and selected runtime packages for bootstrap behavior.

## Public Commands

The installed CLI command is still:

```bash
supercode
```

The package name is:

```bash
@nareshdama/supercode
```

The scaffolder command is:

```bash
create-supercode
```

The package name is:

```bash
@nareshdama/create-supercode
```

## Release And Publish Workflow

Release-sensitive verification:

```bash
npm run build
npm test
npm run coverage:gate
npm run profile:baseline
npm run smoke:phase7
npm run verify:docs
```

Publish helper:

```bash
npm run publish:release:dry-run
npm run publish:release
```

Notes:

- The helper publishes packages in dependency order.
- It skips versions already present on npm.
- Scoped packages publish with public access.
- npm 2FA requires a real authenticator OTP, not an access token string.

## Docs That Matter During Development

- [USER-GUIDE.md](USER-GUIDE.md): end-user CLI guide (keep aligned when changing commands or workflows)
- [README.md](README.md): public entrypoint
- [STATUS.md](STATUS.md): shipped state
- [NEXT-GOAL.md](NEXT-GOAL.md): current execution focus
- [ROADMAP.md](ROADMAP.md): next phases
- [PROJECT-SCOPE.md](PROJECT-SCOPE.md): intended product boundary
- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md): release gate and pre-publish checks
- [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md): `@nareshdama/supercode/runtime` embedding surface
- [SECURITY-REVIEW.md](SECURITY-REVIEW.md) / [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md): update when changing trust boundaries or measured CLI performance

## Current Priority

See [NEXT-GOAL.md](NEXT-GOAL.md). As of the current repo state, the next phase is post-release stabilization, not core architecture invention.
