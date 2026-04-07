# Supercode Status (2026-04-03)

## Current State
- Phases 1 through 8 are complete. The monorepo, CLI, execution kernel, model control plane, MCP runtime, memory layer, workflow and extension layer, install-path smoke coverage, and release hardening are all in place.
- Phase 8 (Hardening and Launch) is complete as of 2026-04-02. The repository includes the hardening baseline: release checklist, security review, performance baseline, documentation verification, example tutorials, install-validation scripts, and artifact-retention controls.
- `0.1.0` has been shipped under the `@nareshdama/*` npm scope, including the scoped CLI and scaffolder packages.
- Current work is centered on post-release stabilization and contributor/developer readiness rather than another major subsystem landing.
- The repository is now MIT-licensed through [LICENSE](LICENSE).

## Implemented Surface
- Phase 1: bootstrap, environment detection, workflow-pack recommendation, scaffold generation, and `doctor` reporting.
- Phase 2: resilient execution kernel with persisted tasks, plans, results, artifacts, retry, and resume flows.
- Phase 3: model routing, provider adapters, prompt registry, and budget tracking.
- Phase 4: lifecycle-aware MCP integration with trust posture, health monitoring, and backpressure controls.
- Phase 5: optional local memory with persisted records and CLI inspection commands.
- Phase 6: workflow packs, plugins, hooks, extension validation, plugin commands, and plugin-expanded run plans.
- Phase 7: adoption paths for `npx @nareshdama/supercode init`, package-consumer installs, source checkout usage, and smoke validation across those paths.
- Phase 10 (in progress): programmatic embedding via `@nareshdama/supercode/runtime` with shared execution-profile helpers aligned to the CLI; see [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md).
- Release baseline: [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md), [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md), [examples/README.md](examples/README.md), and `npm run verify:docs`.
- Contributor, developer, and **user** docs are part of the maintained top-level surface: [USER-GUIDE.md](USER-GUIDE.md), [CONTRIBUTING.md](CONTRIBUTING.md), [DEVELOPING.md](DEVELOPING.md), [PROJECT-SCOPE.md](PROJECT-SCOPE.md), and [ROADMAP.md](ROADMAP.md).

## Current Development Focus
- Keep top-level docs, examples, and CLI help aligned with shipped behavior.
- Document programmatic embedding via `@nareshdama/supercode/runtime` (`buildExecutionProfileForProject`, `resolveExecutionProfileInputs`, `createPersistedRuntimeContext`) for host apps; see [DEVELOPING.md](DEVELOPING.md#programmatic-embedding) and [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md).
- Re-run the release gate in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) before each patch or minor release.
- Continue MCP and plugin adversarial testing as post-Phase-8 hardening work.
- Validate published package contents and install behavior from outside the source tree whenever packaging changes land.
- Improve onboarding quality for contributors and downstream embedders.

## Known Risks And Watchpoints
- MCP remains the highest-risk subsystem because it combines transport, trust posture, and external tool execution.
- `shell.exec` is intentionally powerful once approved; the safety model depends on conservative prompting and workspace scoping.
- Persisted artifacts under `.supercode/artifacts/` now have configured retention and size limits, but still need operational monitoring as usage grows.
- Docs drift remains a release risk, which is why `npm run verify:docs` is part of the Phase 8 gate.

For the active roadmap, see [ROADMAP.md](ROADMAP.md).
