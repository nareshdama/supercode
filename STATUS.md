# Supercode Status (2026-04-01)

## Current State
- Phase 1 (bootstrap, detection, packs) is complete.
- Phase 2 (execution kernel) is complete (M1-M3 resilient execution).
- Phase 3 (model control plane) is complete:
  - Provider adapters: OpenAI and Anthropic adapters implemented using built-in `fetch()`. Fully decoupled from external HTTP lib dependencies.
  - Model catalog: Supports auto-discovery via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) and health tracking.
  - Scoring router: Determines optimal model via capability matching, trust tier, cost, and latency profiling. Computes fallback chains with automatic retry.
  - Prompt registry: Supports versioned templates, variable checking, and includes built-in Supercode system prompt definitions.
  - Budget policy: Session-scoped token mapping tracking, estimating cost per token according to individual model costs.
  - CLI commands: `model list` and `model status` built and wired up to environment detection and catalog queries.
  - Test suite verified (117 tests passing, 0 failures).

- Phase 4 (MCP Production Layer) is complete:
  - Lifecycle integration: Configured -> Ready -> Degraded -> Backoff state machine.
  - Trust & Isolation: Built-in capability filtering and permission posture enforcement.
  - Health Monitoring: Real-time error tracking and automatic state demotion/recovery.
  - Backpressure: Concurrency limits and request queueing for all MCP transports.
  - Negotiation: MCP JSON-RPC `initialize` sequence for server profiles.

- Phase 5 (Memory Layer) is operational:
  - Local memory package: `@supercode/memory` provides in-process providers, retrieval scoring, retention helpers, and a SimpleMem adapter seam.
  - Explicit config: `.supercode/config.json` now controls whether memory is enabled and which provider mode to use.
  - Persistence: memory records are stored under `.supercode/memory/` and reloaded into the runtime on subsequent invocations.
  - Runtime integration: `supercode run <task>` retrieves matching memories when enabled and stores new task/result memories automatically.
  - CLI inspection: `memory list` and `memory show` expose stored memory records for the current session.
  - Test suite verified (125 tests passing, 0 failures, 1 sandbox-blocked skip).

- Phase 6 (Workflow and Extension Layer) is complete:
  - Installed workflow packs now materialize generated skill and rule assets under `.supercode/extensions/generated/`.
  - Extension inventory: `.supercode/extensions/manifest.json` records the generated local workflow baseline.
  - Local overlay path: `.supercode/extensions/local/` is reserved for project-specific extension assets.
  - CLI inspection: `extension list` shows the current generated extension baseline and per-pack counts.
  - Local hooks: `.supercode/extensions/local/hooks.json` can execute lifecycle hooks through the standard tool registry.
  - Initial hook events: `run.before`, `run.after`, `pack.install.after`, and `pack.uninstall.after`.
  - Hook policy: hooks can now declare `onFailure: "continue" | "abort"` to either report failures or stop command completion.
  - Plugin loader: discovers `.supercode/extensions/plugins/<plugin-id>/plugin.json` and merges enabled plugin hooks into runtime execution.
  - Plugin workflow assets: enabled plugins can contribute skills and rules into CLI search and runtime task matching.
  - Plugin tool adapters: enabled plugins can register tool wrappers that expose plugin-owned tool IDs over existing runtime tools and other plugin tools.
  - Plugin run steps: enabled plugins can contribute matched execution steps into `supercode run`, before or after the default plan steps.
  - Plugin commands: enabled plugins can contribute top-level CLI commands that invoke runtime tools directly.
  - Plugin composition: plugin-local tool targets can use short local IDs and resolve into namespaced runtime tool IDs.
  - Validation: `extension validate` checks local hooks, plugin manifests, duplicate workflow identifiers, invalid tool references, plugin tool cycles, malformed hook failure policies, invalid plugin run-step tool references, and conflicting plugin command definitions.
  - Precedence: local hooks override plugin hooks with the same `hookId`.
  - Runtime safety: plugin tool cycles are detected at invocation time and fail hook execution safely.
  - Reporting: CLI hook output now includes per-hook status, source, policy, tool, and whether the event halted command completion.
  - Plan persistence: plugin-expanded run steps are persisted into the normal execution plan and therefore participate in retry/resume.
  - Command surface: plugin commands run through the same runtime tool registry and persist normal task/result state.
  - Pack lifecycle: `pack recommend --apply` can reapply the current recommendation set, and `pack sync` reconciles `.supercode/packs.json` with the generated extension baseline.
  - Editor-neutral template: scaffolded projects now include a root `README.md`, `.supercode/WORKFLOW.md`, and copy-safe local hook/plugin example files.
  - Match provenance: workflow matches now carry pack-vs-plugin source metadata through runtime output.

## Next Phases
- **Phase 8: Hardening and Launch**
  - coverage gates and performance profiling.
  - security review and docs verification.
  - release checklist plus example apps/tutorials.

## Known Risks/Watchpoints
- Fallback chain timeouts: Ensure user experiences fail fast appropriately if API endpoints are dead.
- Prompt variable leakage: Guard against unexpected prompt injections within the `.render()` method.

For the full roadmap, see `masterplan.md`.
