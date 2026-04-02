# Current Goal: Release Readiness

Phase 8 is active. The repository already includes the main hardening artifacts, so the current goal is no longer to start Phase 8 but to close it cleanly.

Objective:
- move Supercode from architecture-complete and install-validated to release-candidate ready

Current status inside Phase 8:
- The execution kernel, model control plane, MCP layer, memory layer, workflow and extension layer, and install-path smoke coverage are already in place.
- Hardening assets now exist in-repo: release checklist, security review, performance baseline, docs verification, and example tutorials.
- The repository root and docs have been normalized to the standalone `Supercode` project layout.
- The remaining work is verification discipline: rerun the gate, keep docs current, and close the highest-risk hardening follow-ups before release.

Current release-gate work:
- re-run `npm run clean`, `npm run build`, `npm test`, `npm run coverage:gate`, `npm run profile:baseline`, `npm run smoke:phase7`, and `npm run verify:docs`
- validate package contents and install behavior outside the source tree
- continue MCP, plugin, and artifact-retention hardening from [SECURITY-REVIEW.md](SECURITY-REVIEW.md)
- keep [README.md](README.md), [STATUS.md](STATUS.md), and [examples/README.md](examples/README.md) aligned with actual CLI behavior

Exit criteria:
- release candidate installable by outside users
- docs and examples match shipped behavior
- no unresolved release blockers in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)

Notes:
- [NEXT-GOAL-M3.md](NEXT-GOAL-M3.md) remains the retained implementation record for the completed resilient execution-kernel milestone.
- Phase 8 should continue to prioritize shipped-surface hardening over new feature expansion.
