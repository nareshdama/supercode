# Agent Handoff

Read this file first if you are picking up work in this repository.

## Current State

- Phase 8 is complete and `0.1.0` is already shipped.
- The latest pushed commits on `main` are:
  - `c877ea7` `Archive obsolete planning docs`
  - `055fef5` `Add release readiness checks`
- There is local Phase 9 work in progress that is not yet committed.

## Current Local Work

Phase name: Release Script Execution Hardening

Goal:
- Make release-related scripts reliable on Windows and in constrained local environments.
- Keep `supercode release check` green end-to-end by hardening the scripts it depends on.

Working tree changes currently present:
- `scripts/lib/command-runner.mjs` (new)
- `scripts/test/command-runner.test.mjs` (new)
- `scripts/phase7-smoke.mjs` (modified)
- `scripts/publish-release.mjs` (modified)
- `scripts/test-files.mjs` (modified)

## What Changed In This Cycle

- Added a shared script runner in `scripts/lib/command-runner.mjs`.
- The runner uses file-backed stdout/stderr capture instead of `stdio: "pipe"`.
- Windows shell mode is enabled only for `npm` and `npx` wrappers.
- `scripts/phase7-smoke.mjs` now uses the shared runner and writes npm cache data into `.tmp-phase7-smoke/npm-cache`.
- `scripts/publish-release.mjs` now uses the shared runner while preserving terminal output on successful runs.
- `scripts/test-files.mjs` now includes `scripts/test/*.test.mjs`.
- Added regression coverage in `scripts/test/command-runner.test.mjs`.

## Verified In This Environment

These commands were run successfully after the current local changes:

```bash
npm test
npm run smoke:phase7
node packages/cli/dist/index.js release check
```

Observed result:
- `release check` passed end-to-end, including `Gate Phase 7 Smoke`.

## Key Files To Read

Start here:
- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `NEXT-GOAL.md`
- `RELEASE-CHECKLIST.md`
- `DEVELOPING.md` (includes programmatic embedding via `@nareshdama/supercode/runtime`)
- `docs/reference-notes/programmatic-embedding.md`
- `examples/programmatic-runtime/README.md`

Then inspect the active release-script work:
- `scripts/lib/command-runner.mjs`
- `scripts/phase7-smoke.mjs`
- `scripts/publish-release.mjs`
- `scripts/test/command-runner.test.mjs`

## Design Decisions To Preserve

- Release scripts remain sequential.
- Windows shell mode is used only for `npm` and `npx` commands.
- Failures should surface captured stdout/stderr clearly.
- Smoke validation should use a workspace-local temp cache instead of the user-profile npm cache.
- `supercode release check` remains the top-level readiness entrypoint; do not create a parallel release workflow.

## Known Limits

- `publish-release` still depends on live npm auth and network access.
- Script-level regression tests cover the shared runner directly, not every publish edge case.
- Large command output is still read fully from temp files before being returned to the caller.

## Recommended Next Step

Build on the current Phase 9 hardening work instead of starting a new release surface.

The next high-value areas are:
1. Add stronger release-script coverage around publish decision paths and failure shaping.
2. Extend Phase 10 embedding work (runtime subpath and [programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md) are documented; add examples or SDK polish as needed).
