# Supercode 0.1.0-rc.1

Release candidate date: `2026-04-02`

## Summary

`0.1.0-rc.1` is the first release candidate for Supercode. It packages the completed Phase 1 through Phase 8 surface into a release-candidate-ready monorepo with a working CLI, package-consumer install path, source-checkout path, docs verification, performance baseline, security review, and packaged install smoke validation.

## Highlights

- CLI runtime with task creation, execution, retry, resume, progress persistence, results, permissions, and session inspection
- Model control plane with provider adapters, routing, prompt registry, and budget tracking
- Lifecycle-aware MCP runtime with trust posture, health handling, and invocation support
- Optional memory layer with persisted local memory inspection commands
- Workflow packs, local hooks, plugins, plugin commands, plugin run steps, and extension validation
- Install-path validation for `npx supercode init`, `npm install @supercode/core`, and source-checkout usage
- Release hardening artifacts: coverage gate, performance baseline, security review, example tutorials, and docs verification
- Artifact-retention hardening for persisted runtime outputs with configurable count and size limits

## Verification Baseline

The release candidate was validated with:

- `npm run build`
- `npm test`
- `npm run coverage:gate`
- `npm run profile:baseline`
- `npm run smoke:phase7`
- `npm run verify:docs`

## Known Limitations

- MCP remains the highest-risk subsystem and should continue to receive adversarial trust and transport testing after the release candidate cut.
- Plugin and permission interactions are validated structurally, but deeper denied-tool and hostile-plugin coverage is still future hardening work.
- Artifact retention now has bounded limits, but operational disk-growth monitoring remains necessary in long-lived workspaces.
