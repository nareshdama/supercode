# Supercode Phase 1 MVP

Supercode is an adaptive developer orchestration framework. This Phase 1 MVP focuses on the bootstrap layer: detect the current environment, build an execution profile, select workflow packs, and expose a usable CLI.

## Packages

- `supercode`: CLI entrypoint
- `create-supercode`: fresh project bootstrap
- `@supercode/core`: shared runtime contracts
- `@supercode/tasks`: in-memory task lifecycle manager
- `@supercode/progress`: task progress tracking and timelines
- `@supercode/permissions`: runtime permission decisions and logging
- `@supercode/state`: file-backed session, task, and progress persistence
- `@supercode/tools`: executable tool registry with permission-aware invocation
- `@supercode/detect`: host, model, project, and safety detection
- `@supercode/models`: model capability inference
- `@supercode/workflows`: workflow pack catalog and matching
- `@supercode/mcp`: MCP config parsing, runtime inventory, and transport adapters

## Install and Run

Quick start with `npx`:

```bash
npx supercode init
```

Local workspace usage:

```bash
npm install
npm run build
node packages/cli/dist/index.js doctor
```

Fresh project bootstrap:

```bash
npx create-supercode my-app
```

## CLI Commands

- `supercode init [path] [--force]`
- `supercode doctor [--json]`
- `supercode run [task]`
- `supercode task start <goal>`
- `supercode task list`
- `supercode task show <task-id>`
- `supercode task cancel <task-id>`
- `supercode task retry <task-id> [--force]`
- `supercode task resume <task-id>`
- `supercode session show`
- `supercode permission show`
- `supercode result list`
- `supercode result show <result-id>`
- `supercode mcp list`
- `supercode mcp invoke <server-id> <tool-name> [json-args]`
- `supercode pack list`
- `supercode pack recommend`
- `supercode pack install <pack-id>`
- `supercode pack uninstall <pack-id>`
- `supercode skill search <query>`
- `supercode rule search <query>`
- `supercode model list`
- `supercode model status`

## What Phase 1 Does

- Detects invocation mode, package manager, host, model metadata, project root, frameworks, and git state.
- Produces a stable execution profile and machine-readable `doctor --json` report.
- Scaffolds `.supercode` project state plus a starter TypeScript template for empty directories.
- Selects and installs workflow packs automatically for detected projects.
- Ranks workflow skills and rules for a task instead of using raw substring matching.
- Reports MCP availability, config source, server count, server IDs, and trust posture.

## Project State

`supercode init` writes:

- `.supercode/config.json`
- `.supercode/profile.snapshot.json`
- `.supercode/packs.json`
- `.supercode/session.json`
- `.supercode/README.md`
- `.supercode/tasks/`
- `.supercode/progress/`
- `.supercode/results/`
- `.supercode/plans/`
- `.supercode/artifacts/`

For an empty directory it also creates:

- `package.json`
- `tsconfig.json`
- `src/index.ts`

`--force` refreshes Supercode-managed files in `.supercode` but does not overwrite user project files such as `package.json` or `src/index.ts`.

## Phase 1 Status

Phase 1 is complete when these behaviors are present:

- stable contract types for config, pack state, snapshots, and doctor output
- validated workflow manifests
- pack install and uninstall lifecycle
- conservative host/model detection with overrides
- scaffold re-detection for empty directories
- ranked workflow matching
- richer MCP reporting
- green build and test suite

## Phase 2 Slice 1

The first Phase 2 runtime slice is now implemented:

- shared task, progress, permission, session, tool, and MCP invocation contracts in `@supercode/core`
- `@supercode/tasks` with an in-memory task manager
- `@supercode/progress` with an in-memory progress tracker

## Phase 2 Slice 2

The next runtime slice is now implemented:

- `@supercode/permissions` with a conservative runtime permission system and logged decisions
- `@supercode/state` with file-backed session, task, progress, and permission persistence
- CLI task runtime commands for `task start`, `task list`, `task show`, `task cancel`, `session show`, and `permission show`

## Phase 2 Slice 3

The execution path now runs through the runtime instead of direct CLI helpers:

- `@supercode/tools` provides a permission-aware executable tool registry
- `supercode run <task>` creates a persisted task, invokes built-in runtime tools, and stores a structured result record
- task details now include output references for stored results in `.supercode/results/`
- MCP inspection is available as a built-in runtime tool and is captured alongside workflow matching results

## Phase 2 Slice 4

The MCP layer now has a real runtime boundary instead of config-only inspection:

- `@supercode/mcp` now parses structured MCP server configs and exposes a runtime with server inventory and invocation APIs
- builtin, `stdio`, and `http` MCP transport adapters are now supported through the same runtime contract
- `supercode mcp list` shows configured MCP servers and effective runtime posture
- `supercode mcp invoke <server-id> <tool-name> [json-args]` runs through task, permission, progress, and result persistence

## Phase 2 Slice 5

The local execution kernel is partially live:

- first-party tools: `shell.exec` (bounded cwd), `fs.read` and `fs.write` (scoped), `git.status`, `project.build`, `project.test`
- `@supercode/tasks` executor runs ordered steps, reports progress, and returns structured outcomes
- `supercode run <task>` now pipelines through the executor and builtin tools
- `result list` and `result show` surface stored outputs from completed tasks

## Phase 2 Slice 6 — M3: Resilient Execution Kernel

The execution kernel is now resilient with structured result storage and task recovery:

- **Rich result records**: results now carry a `preview` (truncated to 2000 chars for safe CLI rendering) and an optional `artifactRef` pointing to the full output stored in `.supercode/artifacts/`
- **Per-step capture**: executor records `startedAt`, `completedAt`, `durationMs`, stdout, stderr, exit code, and timeout status for each execution step in `stepOutcomes`
- **Plan persistence**: execution plans are stored in `.supercode/plans/` so retry and resume can reuse them without re-planning
- **`task retry <task-id> [--force]`**: re-executes a failed task using its stored plan; `--force` bypasses the `retryable` check on the original error while still respecting `maxAttempts`
- **`task resume <task-id>`**: loads stored plan and progress, skips already-completed steps, and continues execution from the first incomplete step — preventing duplicate side effects
- **Enhanced `result list`**: shows truncated preview and `[has-artifact]` indicator for results with stored full output
- **Enhanced `result show`**: displays the preview with safe truncation and links to the artifact path for full output access
- **Permission gates**: retry and resume both evaluate permission gates for shell and filesystem categories before re-executing steps
- **Result retention**: up to 50 result references are tracked in the session; full outputs are stored as artifact files alongside the truncated preview

## Phase 3: Model Control Plane

The governed model invocation layer is implemented:
- **Provider Adapters**: OpenAI and Anthropic adapters are available, using native `fetch` (no external dependencies) and supporting auto-discovery via `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.
- **Model Catalog**: Exposes model capabilities (context window, tool/streaming support, trust tier, cost, latency tier) and provider health tracking.
- **Scoring Router**: `ModelRouter` scores available models based on capability match, trust tier, latency targets, and cost. It builds fallback chains, automatically retries on provider failure, and logs routing decisions for auditability.
- **Prompt Registry**: Versioned prompt templates with variable substitution, equipped with initial `supercode.system`, `supercode.task-plan`, and `supercode.review` built-in prompts.
- **Budget Policy**: Session-scoped budget tracking with limit checks, usage recording, and snapshots mapping input/output tokens to estimated cost.
- **CLI Commands**:
  - `supercode model list`: shows available models categorized by provider with cost and capabilities.
  - `supercode model status`: shows provider health, last latency, and the current session's budget snapshot.

## Next Goal

**Phase 4: MCP Production Layer**. Implement the full lifecycle, trust policy, and isolation capability for Model Context Protocol connections.
