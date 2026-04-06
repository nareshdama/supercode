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

- [README.md](README.md): public entrypoint
- [STATUS.md](STATUS.md): shipped state
- [NEXT-GOAL.md](NEXT-GOAL.md): current execution focus
- [ROADMAP.md](ROADMAP.md): next phases
- [PROJECT-SCOPE.md](PROJECT-SCOPE.md): intended product boundary
- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md): release gate and pre-publish checks

## Current Priority

See [NEXT-GOAL.md](NEXT-GOAL.md). As of the current repo state, the next phase is post-release stabilization, not core architecture invention.
