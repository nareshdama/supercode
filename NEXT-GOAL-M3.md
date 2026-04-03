# Completed Goal (M3): Resilient Execution Kernel

Status: complete. This document is retained as the implementation record for the finished Phase 2 M3 milestone.

Objective: finish the local execution kernel by persisting structured outputs, exposing results cleanly, and making task execution recoverable.

Scope (in):
- normalize task outcomes into result records with truncation for display and full artifact storage
- executor capture of stdout/stderr/exit codes plus timing metadata
- CLI support for `result list` and `result show` backed by stored records
- CLI support for `task retry` and `task resume` using persisted plans and outcomes
- permission and safety gates for shell/fs reruns with clear prompts
- tests for state persistence, executor resilience, and CLI flows

Scope (out):
- subagent orchestration or remote workers
- hosted services, telemetry export, or UI frontends
- model-routing layer changes

Deliverables:
- updated result record schema in `@nareshdama/state` with preview plus artifact references
- executor writes result records and links them to task history
- `result list` and `result show` read from stored records with truncation and pagination safeguards
- `task retry` and `task resume` commands that reuse stored plans and progress, respecting permissions
- regression and integration tests covering retries, resumes, and result viewing
- docs updated for result semantics and retry/resume usage

Work plan:
- define result record shape and storage layout under `.supercode/results/`, including max preview sizes
- extend `SimpleTaskExecutor` to capture step outputs, timings, and errors, and to persist consolidated outcomes
- wire executor outcome references into the task manager and runtime context so CLI commands resolve them
- implement `result list` and `result show` to read persisted records and render previews with safe truncation
- implement `task retry` and `task resume` commands with plan reuse, progress reconciliation, and permission prompts
- add safeguards for timeouts, backoff, and cancellation during retries to avoid runaway reruns
- add unit tests for state layer serialization plus executor retry/resume, and CLI integration tests for the new commands
- document result retention, preview limits, and retry/resume behavior in README and CLI help

Acceptance:
- running `supercode run <task>` produces stored result records; `result list` and `result show` reflect them without reading raw files
- retrying a failed task reuses the prior plan, logs a new attempt, and respects shell/fs permission gating
- resuming a partial task continues from stored progress without duplicating completed steps
- tests pass locally with new retry/resume and result views covered

Risks/notes:
- large outputs need aggressive truncation to avoid slow CLI rendering
- retries must avoid double side effects; plan steps should be idempotent or gated
- permission prompts for reruns must stay conservative to prevent silent shell execution
