# Next Goal: Distribution and Install Experience

Phase 6 is complete. The next active roadmap target is Phase 7 from `masterplan.md`.

Objective:
- make Supercode easy to adopt through the CLI package, npm packages, and source checkout flows

Current status entering Phase 7:
- The execution kernel, model control plane, MCP layer, memory layer, and workflow/extension layer are all in place.
- `supercode init`, `doctor`, `run`, pack management, plugin loading, hooks, plugin tools, plugin run steps, and plugin commands are operational.
- The scaffold now includes an editor-neutral project template with local workflow guidance and example extension files.
- Phase 7 is now primarily about packaging, install-path polish, and smoke-test quality rather than new runtime architecture.

Primary deliverables:
- npm publish flow
- install-path cleanup for `supercode` and `npx supercode init`
- standalone repo quick-start polish
- Windows and Unix install guidance or scripts
- package smoke tests across install modes

Exit criteria:
- fresh-machine smoke tests succeed for:
- `npx supercode init`
- `npm install @supercode/core`
- clone-and-run standalone repo flow

Notes:
- `NEXT-GOAL-M3.md` is retained as an implementation record for the completed resilient execution-kernel milestone.
- Phase 6 workflow and extension work is considered complete enough to support packaging and adoption work.
