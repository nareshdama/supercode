# Next Goal: Hardening And Launch

Phase 7 is complete. The next active roadmap target is Phase 8 from `masterplan.md`.

Objective:
- move Supercode from architecture-complete to production-ready

Current status entering Phase 8:
- The execution kernel, model control plane, MCP layer, memory layer, workflow/extension layer, and install-path smoke coverage are in place.
- `smoke:phase7` now verifies the three main install flows: `npx supercode init`, `npm install @supercode/core`, and source checkout usage.
- The current gap is release discipline: hardening gates, docs verification, security review artifacts, and launch-facing examples.

Primary deliverables:
- coverage gates
- performance profiling
- security review
- docs verification
- release checklist
- example apps and tutorials

Initial Phase 8 slice:
- automated docs verification script
- release checklist baseline
- roadmap and status updates that mark Phase 8 as active

Exit criteria:
- release candidate installable by outside users
- docs and examples match shipped behavior

Notes:
- `NEXT-GOAL-M3.md` remains the retained implementation record for the completed resilient execution-kernel milestone.
- Phase 8 should focus on hardening the shipped surface before any major scope expansion.
