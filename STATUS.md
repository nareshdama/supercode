# Supercode Status (2026-04-02)

## Current State
- Phases 1 through 7 are complete. The monorepo, CLI, execution kernel, model control plane, MCP runtime, memory layer, workflow and extension layer, and install-path smoke coverage are all in place.
- Phase 8 (Hardening and Launch) is active. The repository now includes the hardening baseline: release checklist, security review, performance baseline, documentation verification, example tutorials, and install-validation scripts.
- The project is in pre-release development. Current work is centered on release gating, consistency, and verification rather than new subsystem expansion.
- The repository is now MIT-licensed through [LICENSE](LICENSE).

## Implemented Surface
- Phase 1: bootstrap, environment detection, workflow-pack recommendation, scaffold generation, and `doctor` reporting.
- Phase 2: resilient execution kernel with persisted tasks, plans, results, artifacts, retry, and resume flows.
- Phase 3: model routing, provider adapters, prompt registry, and budget tracking.
- Phase 4: lifecycle-aware MCP integration with trust posture, health monitoring, and backpressure controls.
- Phase 5: optional local memory with persisted records and CLI inspection commands.
- Phase 6: workflow packs, plugins, hooks, extension validation, plugin commands, and plugin-expanded run plans.
- Phase 7: adoption paths for `npx supercode init`, package-consumer installs, source checkout usage, and smoke validation across those paths.
- Phase 8 baseline: [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md), [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md), [examples/README.md](examples/README.md), and `npm run verify:docs`.

## Current Development Focus
- Keep top-level docs, examples, and CLI help aligned as the release surface settles.
- Re-run the release gate in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) before each release candidate.
- Continue hardening around MCP trust transitions, workspace-boundary enforcement, plugin execution, and persisted-artifact retention.
- Validate published package contents and install behavior from outside the source tree.

## Known Risks And Watchpoints
- MCP remains the highest-risk subsystem because it combines transport, trust posture, and external tool execution.
- `shell.exec` is intentionally powerful once approved; the safety model depends on conservative prompting and workspace scoping.
- Persisted artifacts under `.supercode/artifacts/` need ongoing retention and size monitoring as usage grows.
- Docs drift remains a release risk, which is why `npm run verify:docs` is part of the Phase 8 gate.

For the full roadmap, see [masterplan.md](masterplan.md).
