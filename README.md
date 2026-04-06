# Supercode

Supercode is an adaptive developer orchestration framework. The current repository has Phases 1 through 8 implemented, including the Phase 8 hardening deliverables: release checks, security review, performance baselining, docs verification, and example tutorials.

## Development Status

- Current phase: Phase 8: Hardening and Launch, complete as of 2026-04-02
- Delivery status: `0.1.0` shipped under the `@nareshdama/*` npm scope
- Completed roadmap slices: bootstrap, execution kernel, model control plane, MCP production layer, memory layer, workflow and extension layer, and install-path validation
- Current priority: post-release stabilization, contributor onboarding, and controlled expansion planning

## Project Docs

- [HANDOFF.md](HANDOFF.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [DEVELOPING.md](DEVELOPING.md)
- [PROJECT-SCOPE.md](PROJECT-SCOPE.md)
- [ROADMAP.md](ROADMAP.md)
- [STATUS.md](STATUS.md)
- [NEXT-GOAL.md](NEXT-GOAL.md)
- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)

## Packages

- `@nareshdama/supercode`: CLI entrypoint
- `@nareshdama/create-supercode`: fresh project bootstrap
- `@nareshdama/core`: shared runtime contracts
- `@nareshdama/tasks`: in-memory task lifecycle manager
- `@nareshdama/progress`: task progress tracking and timelines
- `@nareshdama/permissions`: runtime permission decisions and logging
- `@nareshdama/state`: file-backed session, task, and progress persistence
- `@nareshdama/tools`: executable tool registry with permission-aware invocation
- `@nareshdama/detect`: host, model, project, and safety detection
- `@nareshdama/memory`: optional session and cross-run memory providers with retrieval helpers
- `@nareshdama/models`: model capability inference
- `@nareshdama/workflows`: workflow pack catalog and matching
- `@nareshdama/mcp`: MCP config parsing, runtime inventory, and transport adapters

## Install and Run

Zero-install bootstrap:

```bash
npx @nareshdama/supercode init
```

Package consumer path:

```bash
npm install @nareshdama/core
```

Source checkout:

```bash
npm install
npm run build
node packages/cli/dist/index.js doctor
```

Fresh project bootstrap:

```bash
npx @nareshdama/create-supercode my-app
```

Install-path verification:

```bash
npm run smoke:phase7
```

Phase 8 hardening checks:

```bash
npm run coverage:gate
npm run profile:baseline
npm run verify:docs
```

Phase 8 review artifacts:

- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)
- [SECURITY-REVIEW.md](SECURITY-REVIEW.md)
- [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md)
- [examples/README.md](examples/README.md)

Release publishing helpers:

```bash
npm run publish:release:dry-run
npm run publish:release
```

Release-readiness helper:

```bash
node packages/cli/dist/index.js release check --skip-gates
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
- `supercode memory list [query]`
- `supercode memory show <memory-id>`
- `supercode mcp list`
- `supercode mcp invoke <server-id> <tool-name> [json-args]`
- `supercode extension list`
- `supercode extension validate`
- `supercode plugin list`
- `supercode <plugin-command> [args]`
- `supercode pack list`
- `supercode pack recommend`
- `supercode pack recommend --apply`
- `supercode pack install <pack-id>`
- `supercode pack uninstall <pack-id>`
- `supercode pack sync`
- `supercode skill search <query>`
- `supercode rule search <query>`
- `supercode model list`
- `supercode model status`
- `supercode release check [--json] [--skip-gates]`

## What Phase 1 Does

- Detects invocation mode, package manager, host, model metadata, project root, frameworks, and git state.
- Produces a stable execution profile and machine-readable `doctor --json` report.
- Scaffolds `.supercode` project state plus a starter TypeScript template for empty directories.
- Adds an editor-neutral starter template for empty directories, including a root `README.md`, `.supercode/WORKFLOW.md`, and copy-safe hook/plugin examples.
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
- `.supercode/WORKFLOW.md`
- `.supercode/extensions/`
- `.supercode/tasks/`
- `.supercode/progress/`
- `.supercode/results/`
- `.supercode/memory/`
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

- shared task, progress, permission, session, tool, and MCP invocation contracts in `@nareshdama/core`
- `@nareshdama/tasks` with an in-memory task manager
- `@nareshdama/progress` with an in-memory progress tracker

## Phase 2 Slice 2

The next runtime slice is now implemented:

- `@nareshdama/permissions` with a conservative runtime permission system and logged decisions
- `@nareshdama/state` with file-backed session, task, progress, and permission persistence
- CLI task runtime commands for `task start`, `task list`, `task show`, `task cancel`, `session show`, and `permission show`

## Phase 2 Slice 3

The execution path now runs through the runtime instead of direct CLI helpers:

- `@nareshdama/tools` provides a permission-aware executable tool registry
- `supercode run <task>` creates a persisted task, invokes built-in runtime tools, and stores a structured result record
- task details now include output references for stored results in `.supercode/results/`
- MCP inspection is available as a built-in runtime tool and is captured alongside workflow matching results

## Phase 2 Slice 4

The MCP layer now has a real runtime boundary instead of config-only inspection:

- `@nareshdama/mcp` now parses structured MCP server configs and exposes a runtime with server inventory and invocation APIs
- builtin, `stdio`, and `http` MCP transport adapters are now supported through the same runtime contract
- `supercode mcp list` shows configured MCP servers and effective runtime posture
- `supercode mcp invoke <server-id> <tool-name> [json-args]` runs through task, permission, progress, and result persistence

## Phase 2 Slice 5

The local execution kernel is partially live:

- first-party tools: `shell.exec` (bounded cwd), `fs.read` and `fs.write` (scoped), `git.status`, `project.build`, `project.test`
- `@nareshdama/tasks` executor runs ordered steps, reports progress, and returns structured outcomes
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
- **Result retention**: up to 50 result references are tracked in the session; full outputs are stored as artifact files alongside the truncated preview, with configurable artifact count and size limits

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

## Phase 4: MCP Production Layer

The MCP runtime is now lifecycle-aware and production-oriented:
- config parsing plus builtin, `stdio`, and `http` transports
- trust filtering, negotiation validation, degraded/backoff/quarantine handling
- bounded concurrency and queueing
- CLI inspection and invocation through the runtime boundary

## Phase 5: Memory Layer

The memory layer is now operational as an optional runtime feature:
- `@nareshdama/memory` provides local memory storage, retrieval scoring, retention helpers, and a SimpleMem adapter seam
- `.supercode/config.json` now carries explicit memory and artifact-retention configuration and keeps memory disabled by default
- `.supercode/memory/` persists memory records across runs
- `supercode run <task>` retrieves matching session memory when enabled and stores new task/result memories automatically
- `supercode memory list [query]` and `supercode memory show <memory-id>` expose persisted memory records for inspection

## Phase 6: Workflow and Extension Layer

The workflow and extension layer is now functionally complete:
- installed packs materialize generated skill and rule assets under `.supercode/extensions/generated/`
- `.supercode/extensions/manifest.json` records the generated extension inventory for the current project
- `.supercode/extensions/local/` is reserved for project-specific extension assets
- `.supercode/extensions/local/hooks.json` defines local lifecycle hooks executed through the standard tool registry
- `.supercode/extensions/plugins/<plugin-id>/plugin.json` defines local plugins discovered by the plugin loader
- enabled plugins can contribute skills and rules into workflow search and task matching
- enabled plugins can also declare tool adapters that wrap existing runtime tools or other plugin tools under plugin-owned tool IDs
- enabled plugins can contribute declarative `runSteps` that inject matched execution steps into `supercode run`
- enabled plugins can contribute declarative top-level commands that invoke runtime tools directly from the CLI
- plugin-local tool targets can use short local IDs and are resolved into namespaced runtime tool IDs
- plugin run steps can target built-in tools or plugin-local tool adapters and can run before or after the default plan steps
- hooks now support `onFailure: "continue" | "abort"` so a failing hook can either be reported or stop the enclosing command
- plugin commands can target built-in tools or plugin-local tool adapters and expose direct top-level CLI entrypoints
- `supercode extension validate` checks local hooks, plugin manifests, duplicate workflow IDs, invalid tool references, plugin tool cycles, malformed hook failure policies, invalid plugin run-step tools, and conflicting or invalid plugin commands
- `run.before`, `run.after`, `pack.install.after`, and `pack.uninstall.after` are the first supported hook events
- local hooks override plugin hooks with the same `hookId`
- runtime plugin tool invocation now detects adapter cycles and fails hooks safely instead of recursing indefinitely
- matched plugin run steps are persisted into the normal execution plan, so retry/resume uses the same plugin-expanded plan
- CLI hook output now reports per-hook status, source, tool, and whether the event halted command completion
- CLI run output now reports matched plugin run steps, plugin listing shows `runSteps` and `commands` counts, and installed plugins can add direct top-level commands
- pack lifecycle now includes `pack recommend --apply` and `pack sync` for recommendation re-application and state reconciliation against generated extensions
- scaffolded projects now include an editor-neutral local workflow guide plus copy-safe `hooks.example.json` and `plugin.example.json` templates
- task matching now reports whether a match came from a pack or a plugin
- `supercode extension list` and `supercode plugin list` show the generated baseline and discovered plugins

## Current Development Focus

Phase 8 is complete as of 2026-04-02. The architecture-complete and install-validated codebase now has the release gate, current docs, package/install smoke validation, and artifact-retention controls in place. Ongoing work is operational release management rather than Phase 8 feature completion. See [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).
