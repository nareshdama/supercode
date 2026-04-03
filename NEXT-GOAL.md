# Current Goal: Release Candidate Cut

Phase 8 is complete as of 2026-04-02. The repository has now passed the in-repo release gate, including `npm run smoke:phase7`, and the project has moved from release-readiness work into release-candidate operations.

Objective:
- ship the first tagged release candidate from the green Phase 8 baseline

Current state after Phase 8:
- The execution kernel, model control plane, MCP layer, memory layer, workflow and extension layer, and install-path smoke coverage are in place.
- Hardening assets are current in-repo: release checklist, security review, performance baseline, docs verification, and example tutorials.
- Artifact persistence now has retention and size bounds, closing the highest-risk open follow-up called out during Phase 8.
- The repository root and docs are aligned to the standalone `Supercode` project layout.

Current release operations:
- keep `npm run build`, `npm test`, `npm run coverage:gate`, `npm run profile:baseline`, `npm run smoke:phase7`, and `npm run verify:docs` green before each candidate tag
- record the candidate version and date in the release decision flow
- keep [README.md](README.md), [STATUS.md](STATUS.md), and [examples/README.md](examples/README.md) aligned with actual CLI behavior as packaging evolves
- treat additional MCP and plugin adversarial coverage as ongoing hardening, not as a blocker to closing Phase 8

Notes:
- [NEXT-GOAL-M3.md](NEXT-GOAL-M3.md) remains the retained implementation record for the completed resilient execution-kernel milestone.
- The next milestone is operational release execution rather than another architecture phase.
