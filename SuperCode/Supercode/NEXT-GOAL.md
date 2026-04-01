# Next Goal: Local Execution Kernel

Objective: make Supercode execute real repo tasks with safe, persisted results instead of only planning and matching workflows.

Status: M1 and M2 complete; active milestone is M3. See `NEXT-GOAL-M3.md` for the detailed work plan.

Scope (in):
- First-party tools: `shell.exec` (bounded cwd), `fs.read`, `fs.write` (scoped), `git.status`, `project.build`, `project.test`.
- Task executor: ordered steps, retries, cancellations, resumable state, progress events, permission gating.
- Result pipeline: normalize outputs, truncate for display, persist full artifacts with `ResultRecord` refs.
- CLI: `task retry`, `task resume`, `result list`, `result show`; integrate tool invocation outputs.

Scope (out for now):
- Subagents/fleet execution, hosted services, marketplace, memory/backends, rich UI.

Deliverables:
- `@supercode/tools` extended with the first-party tools and schemas.
- `@supercode/tasks` executor that runs tool steps with retries/timeouts and progress updates.
- `@supercode/state` result storage for large outputs and artifacts.
- CLI flow that starts tasks, runs tool plans, persists results, and supports retry/resume/list/show.

Milestones:
- [x] M1: Tool definitions and permission categories finalized; executor skeleton running no-op steps.
- [x] M2: Shell/fs/git/project tools implemented with scoped permissions and timeouts.
- [ ] M3: Result persistence plus CLI `result list/show`; task retry/resume paths wired.
- [ ] M4: End-to-end smoke: `supercode run <task>` generates tool actions, saves outputs, supports retry.

Risks/notes:
- Sandbox/permission alignment for shell/fs operations; avoid host-blocked commands.
- Output size management and truncation vs. full artifact storage.
- Deterministic execution order and idempotent retries to prevent duplicate side effects.
