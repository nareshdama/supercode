# Supercode Status (2026-04-06)

## Current State

- **Phases 1–8** are complete: monorepo, CLI, execution kernel, model control plane, MCP runtime, memory layer, workflow and extension layer, install-path smoke coverage, and Phase 8 hardening (release checklist, security review, performance baseline, docs verification, examples).
- **`0.1.0`** is shipped under the `@nareshdama/*` npm scope (scoped CLI and scaffolder).
- **Phase 9** (post-release stabilization) is **active**: release/smoke script hardening, `npm run verify:docs`, and keeping public docs aligned with CLI behavior.
- **Phase 10** (embedding) is **partially delivered**: `@nareshdama/supercode/runtime` exposes shared profile construction (`resolveExecutionProfileInputs`, `buildExecutionProfileForProject`) and `createPersistedRuntimeContext`; see [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md) and [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md).
- **End-user documentation:** [USER-GUIDE.md](USER-GUIDE.md) is the maintained CLI-oriented guide.
- Repository license: [LICENSE](LICENSE) (MIT).

## Implemented Surface (Summary)

| Area | Notes |
|------|--------|
| Phase 1–7 | Bootstrap, detection, doctor, tasks, MCP, memory, workflows, packs, plugins, hooks, install paths |
| Phase 8 | Release gate, [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md), artifact retention |
| Phase 9 (ongoing) | Script/test hardening, docs index in [README.md](README.md), user guide |
| Phase 10 (partial) | Runtime subpath API, programmatic example, embedding reference note |

Canonical doc sets:

- **Users:** [USER-GUIDE.md](USER-GUIDE.md), [examples/README.md](examples/README.md)
- **Contributors:** [CONTRIBUTING.md](CONTRIBUTING.md), [DEVELOPING.md](DEVELOPING.md)
- **Direction:** [PROJECT-SCOPE.md](PROJECT-SCOPE.md), [ROADMAP.md](ROADMAP.md), [NEXT-GOAL.md](NEXT-GOAL.md)
- **Release / safety:** [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md), [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md)

## Current Development Focus

- Keep [README.md](README.md) CLI command list, [USER-GUIDE.md](USER-GUIDE.md), and example READMEs aligned with `supercode help` (`npm run verify:docs`).
- Maintain programmatic embedding docs ([DEVELOPING.md](DEVELOPING.md#programmatic-embedding), [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md)) when the `./runtime` surface changes.
- Run the release gate in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) before each tagged public release.
- Continue MCP and plugin adversarial testing as the highest-value post-launch hardening stream.
- Validate published packages and install behavior whenever `package.json` or publish scripts change.

## Known Risks And Watchpoints

- MCP combines transport, trust posture, and external execution—treat as the highest-risk subsystem.
- `shell.exec` is intentionally powerful after approval; safety depends on workspace scoping and permission mode.
- Artifacts under `.supercode/artifacts/` have retention and size limits; monitor disk usage in long-running projects.
- Docs drift is a release risk; `npm run verify:docs` and manual review of [USER-GUIDE.md](USER-GUIDE.md) and [SECURITY-REVIEW.md](SECURITY-REVIEW.md) reduce it.

For roadmap detail, see [ROADMAP.md](ROADMAP.md).
