# Agent Handoff

Read this file first if you are picking up work in this repository.

## Current State

- **Phases 1–8** are complete; **`0.1.0`** is shipped on `@nareshdama/*`.
- **Phase 9** (stabilization) and **Phase 10** (embedding / adoption) are active per [ROADMAP.md](ROADMAP.md) and [STATUS.md](STATUS.md).
- Default branch **`main`** tracks published work; use `git log` for recent commits instead of relying on hashes in this file.

## Documentation Map (2026-04)

| Doc | Role |
|-----|------|
| [README.md](README.md) | Public index, CLI command list (must match `supercode help`), Phase 8 snippet for `verify:docs` |
| [USER-GUIDE.md](USER-GUIDE.md) | End-user CLI guide |
| [STATUS.md](STATUS.md) | Shipped vs in-flight scope |
| [ROADMAP.md](ROADMAP.md) | Phases 9–11 |
| [SECURITY-REVIEW.md](SECURITY-REVIEW.md) | Threat model and residual risks |
| [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md) | Profiling regression baseline |
| [DEVELOPING.md](DEVELOPING.md) | Monorepo, embedding (`@nareshdama/supercode/runtime`) |
| [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md) | Runtime subpath for host apps |
| [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md) | Node embedding example |

## Key Implementation Areas

- **CLI / runtime package:** `packages/cli/src/` — `runtime.ts` exports embedding API; `index.ts` is the CLI.
- **Release & smoke:** `scripts/publish-release.mjs`, `scripts/phase7-smoke.mjs`, `scripts/lib/command-runner.mjs`, tests under `scripts/test/`.
- **Docs gate:** `npm run verify:docs` (README commands + example READMEs).

## Design Decisions To Preserve

- Release scripts remain sequential; Windows shell mode only for `npm` / `npx` where applicable.
- `supercode release check` stays the single readiness entrypoint for releases.
- Programmatic embedding stays **ESM-only** on `@nareshdama/supercode/runtime`.
- Execution profile construction stays centralized (`resolveExecutionProfileInputs`) so the CLI and embedders do not drift.

## Verified Commands (typical)

```bash
npm run build
npm test
npm run verify:docs
npm run smoke:phase7
node packages/cli/dist/index.js release check
```

## Recommended Next Steps

1. Keep **Phase 9** green: tests, smoke, docs verification, patch-release hygiene.
2. Extend **Phase 10**: more embedding examples, versioning guidance, or SDK polish as needed—see [ROADMAP.md](ROADMAP.md).
3. When changing permissions, tools, MCP, or persistence, update [SECURITY-REVIEW.md](SECURITY-REVIEW.md) and [USER-GUIDE.md](USER-GUIDE.md) as appropriate.

## Known Limits

- `publish-release` requires live npm auth and network for real publishes.
- Security review is a point-in-time assessment plus ongoing maintenance; it is not a substitute for dependency and supply-chain monitoring.
