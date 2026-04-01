# Requirements Document

## Introduction

Supercode is a TypeScript agent-orchestration kernel for AI and LLM systems. It coordinates tools, tasks, permissions, progress, sessions, subagents, plugins, hooks, skills, rules, and MCP servers while remaining reusable in both headless and interactive environments.

This document defines the product requirements for a production-safe implementation. The emphasis is not only feature coverage, but also architectural boundaries, auditability, lifecycle safety, and traceability from requirement to implementation owner.

## Document Control

- Architecture Package Version: `1.0.0-draft`
- Last Updated: `2026-04-01`

### Change History

| Version | Date | Summary |
| --- | --- | --- |
| `1.0.0-draft` | `2026-04-01` | Introduced runtime/presentation separation, explicit model control plane requirements, MCP production requirements, and traceability governance. |

## Glossary

- **Supercode**: The orchestration kernel described by this requirements package
- **Agent**: An AI or LLM execution entity that plans or performs work
- **Subagent**: A delegated agent with inherited constraints and scoped context
- **Tool**: A callable capability exposed to agents
- **Skill**: A reusable workflow instruction asset that captures intent, triggers, and execution guidance
- **Rule**: A reusable policy or guidance asset that applies to specific scopes, targets, or workflows
- **Runtime Contract**: The execution-facing interface that is safe to use without a UI framework
- **Presentation Contract**: The rendering-facing interface used by CLI, web, transcript, or other frontends
- **Task**: A tracked unit of work with lifecycle state and output
- **Permission System**: The policy engine that decides whether operations may proceed
- **Progress Tracker**: The component that records and distributes execution progress
- **Session**: A persisted conversational and execution context
- **Model Control Plane**: The provider, routing, prompt, memory, and budget layer for model invocation
- **MCP**: Model Context Protocol integration for external tools, resources, and prompts
- **Traceability Matrix**: The artifact mapping requirements to design contracts, implementation owners, and verification methods

## Architectural Principles

1. Runtime execution SHALL be separable from rendering concerns.
2. Every side-effecting operation SHALL pass through explicit permission and audit boundaries.
3. Every externally integrated capability SHALL have health, lifecycle, and trust semantics.
4. Every SHALL statement SHALL be traceable to a concrete design contract and implementation owner before coding begins.

## Requirements

Acceptance-criteria identifiers are defined as `R<requirement-number>.<criterion-number>`. For example, the third criterion under Requirement 8 is `R8.3`.

### Requirement 1: Core Tool System

**User Story:** As a developer, I want a comprehensive tool framework, so that agents can execute operations with strong contracts and predictable behavior.

#### Acceptance Criteria

1. THE Tool_Registry SHALL maintain a collection of available tools with their schemas.
2. WHEN a tool is registered, THE Tool_Registry SHALL validate the tool definition before exposure.
3. THE Tool SHALL define input schema, output schema, and execution logic.
4. THE Tool SHALL declare side-effect class, concurrency behavior, and interrupt behavior.
5. THE Tool SHALL expose a runtime contract that is independent of any specific UI framework.
6. WHEN a tool is invoked, THE Tool SHALL validate input against its schema before execution.
7. THE Tool SHALL support permission checking logic that can depend on the input.
8. THE Tool SHALL support progress reporting during execution.
9. THE Tool SHALL provide user-facing names, descriptions, aliases, and search hints.
10. THE Tool SHALL support structured results that can be mapped to transport-safe result blocks.

### Requirement 2: Task Lifecycle Management

**User Story:** As a developer, I want robust task management, so that I can track and control agent work execution.

#### Acceptance Criteria

1. THE Task_Manager SHALL support task types: local_bash, local_agent, remote_agent, in_process_teammate, local_workflow, monitor_mcp, and dream.
2. WHEN a task is created, THE Task_Manager SHALL assign it a unique task ID with a type prefix.
3. THE Task SHALL transition through states: pending -> running -> (completed | failed | killed).
4. THE Task_Manager SHALL track task creation time, start time, end time, and total paused duration.
5. THE Task_Manager SHALL maintain task output in files or durable result records with offset tracking.
6. WHEN a task reaches a terminal state, THE Task_Manager SHALL mark it as non-transitional.
7. THE Task_Manager SHALL provide task cleanup mechanisms.
8. THE Task_Manager SHALL support task abortion via AbortController.
9. THE Task SHALL store description, owner, and optional tool use ID.
10. THE Task_Manager SHALL support querying tasks by ID, type, and lifecycle state.

### Requirement 3: Permission and Security System

**User Story:** As a developer, I want fine-grained permission control, so that I can ensure safe agent operations.

#### Acceptance Criteria

1. THE Permission_System SHALL support permission modes: default, auto, and bypass.
2. WHEN a tool requests execution, THE Permission_System SHALL check permissions before allowing execution.
3. THE Permission_System SHALL support allow rules, deny rules, and ask rules.
4. THE Permission_System SHALL support additional working directories with scoped permissions.
5. THE Permission_System SHALL track permission decisions with source, actor, and timestamp.
6. THE Permission_System SHALL support automated permission checks before showing dialogs.
7. WHEN in auto mode, THE Permission_System SHALL strip dangerous permissions.
8. THE Permission_System SHALL support bypass permissions mode when available.
9. THE Permission_System SHALL avoid permission prompts for background agents unless policy requires elevation.
10. THE Permission_System SHALL restore pre-plan-mode permissions on exit from temporary modes.

### Requirement 4: Progress Tracking and Reporting

**User Story:** As a developer, I want real-time progress tracking, so that I can monitor agent execution status.

#### Acceptance Criteria

1. THE Progress_Tracker SHALL support progress types: tool_progress, hook_progress, bash_progress, agent_progress, mcp_progress, repl_progress, skill_progress, task_output_progress, and web_search_progress.
2. WHEN a tool reports progress, THE Progress_Tracker SHALL associate it with the tool use ID.
3. THE Progress_Tracker SHALL support progress callbacks during execution.
4. THE Progress_Tracker SHALL filter progress messages by type and origin.
5. THE Progress_Tracker SHALL maintain progress message history per tool use.
6. THE Progress_Tracker SHALL support spinner modes and animation states for interactive frontends.
7. THE Progress_Tracker SHALL support progress notifications independent of UI framework choice.
8. THE Progress_Tracker SHALL support verbose, condensed, and transcript-oriented views of progress.
9. THE Progress_Tracker SHALL preserve ordering guarantees for progress messages emitted by the same tool use.
10. THE Progress_Tracker SHALL make progress snapshots available to presentation adapters.

### Requirement 5: Agent Orchestration Context

**User Story:** As a developer, I want rich execution context, so that agents can access necessary state and services without coupling runtime to presentation.

#### Acceptance Criteria

1. THE Orchestrator SHALL provide a runtime ToolUseContext with options, state access, and service handles.
2. THE ToolUseContext SHALL be separable from presentation callbacks and frontend-specific rendering state.
3. THE ToolUseContext SHALL include available commands, tools, and MCP handles.
4. THE ToolUseContext SHALL provide abort controller access for cancellation.
5. THE ToolUseContext SHALL provide file state cache for read operations.
6. THE ToolUseContext SHALL provide state getters, setters, and atomic transaction support.
7. THE ToolUseContext SHALL support nested memory attachment triggers and dynamic skill directory triggers.
8. THE ToolUseContext SHALL support user modification tracking.
9. THE ToolUseContext SHALL provide message history, budget state, and session metadata access.
10. THE ToolUseContext SHALL support file reading and glob limits.

### Requirement 6: Tool Result Management

**User Story:** As a developer, I want efficient tool result handling, so that I can manage output size, persistence, and searchability.

#### Acceptance Criteria

1. THE Tool SHALL specify maximum result size in characters.
2. WHEN a tool result exceeds max size, THE Orchestrator SHALL persist it to durable storage.
3. THE Orchestrator SHALL provide result previews and references for persisted results.
4. THE Tool SHALL support structured content and metadata in results.
5. THE Orchestrator SHALL detect and record result truncation.
6. THE Orchestrator SHALL extract searchable text from results.
7. THE Orchestrator SHALL support rendering results for verbose, condensed, transcript, and headless JSON targets.
8. THE Orchestrator SHALL support grouped presentation of parallel tool uses.
9. THE Orchestrator SHALL support custom queued, rejection, error, and fallback result envelopes.
10. THE Orchestrator SHALL apply retention and cleanup policy to persisted results.

### Requirement 7: Concurrency and Safety

**User Story:** As a developer, I want safe concurrent execution, so that agents can run multiple operations without conflicts.

#### Acceptance Criteria

1. THE Tool SHALL declare concurrency safety per input.
2. WHEN a tool is not concurrency-safe, THE Orchestrator SHALL serialize executions by the declared scope.
3. THE Orchestrator SHALL track in-progress tool use IDs.
4. THE Orchestrator SHALL support interrupt behavior of cancel or block per tool.
5. THE Orchestrator SHALL support context modifiers for tools that require exclusive access.
6. THE Orchestrator SHALL support abort signals for cancellation.
7. THE Orchestrator SHALL handle cleanup on task abortion.
8. THE Orchestrator SHALL prevent race conditions in state updates.
9. THE Orchestrator SHALL support atomic task and state transitions.
10. THE Orchestrator SHALL coordinate concurrent task lifecycle changes and result persistence safely.

### Requirement 8: MCP Integration

**User Story:** As a developer, I want production-grade MCP integration, so that agents can use external tools and resources safely and reliably.

#### Acceptance Criteria

1. THE Orchestrator SHALL support MCP server connections with explicit lifecycle states.
2. THE Orchestrator SHALL negotiate capabilities before exposing MCP tools, prompts, or resources.
3. THE Orchestrator SHALL load MCP tools and resources dynamically with server association.
4. THE Orchestrator SHALL handle MCP tool invocation with proper serialization and ordering guarantees where required.
5. THE Orchestrator SHALL support MCP authentication flows and elicitation requests.
6. THE Orchestrator SHALL monitor transport health, heartbeat status, retries, and backoff for MCP connections.
7. THE Orchestrator SHALL support MCP streaming semantics, including partial output and terminal completion handling.
8. THE Orchestrator SHALL enforce backpressure and per-server concurrency limits.
9. THE Orchestrator SHALL filter and deduplicate MCP server configurations by policy.
10. THE Orchestrator SHALL enforce trust policy and isolation boundaries between plugins, the kernel, and MCP servers.

### Requirement 9: Agent Delegation and Subagents

**User Story:** As a developer, I want agent delegation capabilities, so that I can create hierarchical agent workflows.

#### Acceptance Criteria

1. THE Orchestrator SHALL support spawning subagents with isolated runtime context.
2. THE Subagent SHALL inherit parent permission ceilings and policy context.
3. THE Subagent SHALL support local denial tracking for async execution.
4. THE Subagent SHALL share content replacement state with its parent when explicitly configured.
5. THE Subagent SHALL support preserved tool use results for viewable transcripts.
6. THE Subagent SHALL support agent type identification.
7. THE Subagent SHALL support query chain tracking with depth.
8. THE Subagent SHALL support forked system prompts or shared prompt caches when allowed.
9. THE Subagent SHALL support task-scoped state setters.
10. THE Subagent SHALL support agent color or presentation identity assignment for UI differentiation.

### Requirement 10: Session Management

**User Story:** As a developer, I want robust session management, so that I can maintain agent state across interactions.

#### Acceptance Criteria

1. THE Session SHALL maintain message history.
2. THE Session SHALL track file history state.
3. THE Session SHALL track attribution state for commits or external actions.
4. THE Session SHALL support session persistence and restoration.
5. THE Session SHALL support session backgrounding and resumption.
6. THE Session SHALL assign unique session IDs.
7. THE Session SHALL support concurrent session tracking.
8. THE Session SHALL support session title caching and derived title updates.
9. THE Session SHALL support session search by custom title and metadata.
10. THE Session SHALL support session environment variables and environment provenance.

### Requirement 11: Tool Schema and Validation

**User Story:** As a developer, I want strong schema validation, so that tool inputs and outputs are type-safe and evolvable.

#### Acceptance Criteria

1. THE Tool SHALL define input schema using Zod or JSON Schema.
2. THE Tool SHALL define output schema for type safety.
3. WHEN tool input is provided, THE Tool SHALL validate against input schema.
4. THE Tool SHALL support partial input for streaming scenarios.
5. THE Tool SHALL support input equivalence checking for deduplication.
6. THE Tool SHALL support custom validation logic beyond schema.
7. THE Tool SHALL provide validation error messages.
8. THE Tool SHALL support backfilling observable input for legacy compatibility.
9. THE Tool SHALL support permission matcher preparation for pattern matching.
10. THE Tool SHALL support strict mode and schema version compatibility policy.

### Requirement 12: Tool Discovery and Deferral

**User Story:** As a developer, I want efficient tool loading, so that I can minimize initial prompt size and startup latency.

#### Acceptance Criteria

1. THE Tool SHALL support a deferral flag for lazy loading.
2. THE Tool SHALL support an always-load flag for critical tools.
3. THE Tool SHALL provide search hints for keyword matching.
4. THE Orchestrator SHALL support deferred tool discovery.
5. WHEN a tool is deferred, THE Orchestrator SHALL advertise it with defer-loading metadata.
6. THE Orchestrator SHALL support tool aliases for backward compatibility.
7. THE Orchestrator SHALL support tool name matching including aliases.
8. THE Orchestrator SHALL refresh tools dynamically when MCP servers connect or disconnect.
9. THE Orchestrator SHALL cache tool schemas for performance.
10. THE Orchestrator SHALL support tool filtering by enabled state and policy.

### Requirement 13: Rendering and UI Integration

**User Story:** As a developer, I want flexible presentation contracts, so that execution can be displayed in multiple frontends without contaminating runtime contracts.

#### Acceptance Criteria

1. THE Orchestrator SHALL separate presentation contracts from runtime contracts.
2. THE Presentation layer SHALL render tool use messages with partial input support.
3. THE Presentation layer SHALL render tool result messages with progress history.
4. THE Presentation layer SHALL render progress messages during execution.
5. THE Presentation layer SHALL render queued messages when waiting.
6. THE Presentation layer SHALL render rejection messages with custom UI.
7. THE Presentation layer SHALL render error messages with custom UI.
8. THE Presentation layer SHALL support condensed, verbose, transcript, and machine-readable modes.
9. THE Presentation layer SHALL support theme-aware or frontend-specific rendering without changing runtime interfaces.
10. THE Presentation layer SHALL support grouped rendering for parallel executions and headless transcripts.

### Requirement 14: Analytics and Telemetry

**User Story:** As a developer, I want comprehensive telemetry, so that I can monitor framework performance and usage safely.

#### Acceptance Criteria

1. THE Orchestrator SHALL log tool invocations with metadata.
2. THE Orchestrator SHALL log task lifecycle transitions.
3. THE Orchestrator SHALL log permission decisions.
4. THE Orchestrator SHALL log MCP server connections and state changes.
5. THE Orchestrator SHALL log agent spawning and termination.
6. THE Orchestrator SHALL log session start and end.
7. THE Orchestrator SHALL track context metrics such as tokens, files, and size.
8. THE Orchestrator SHALL track API metrics such as time-to-first-token and latency.
9. THE Orchestrator SHALL support analytics opt-out.
10. THE Orchestrator SHALL sanitize PII and sensitive content from telemetry data.

### Requirement 15: Error Handling and Recovery

**User Story:** As a developer, I want robust error handling, so that agents can recover from failures gracefully.

#### Acceptance Criteria

1. WHEN a tool execution fails, THE Orchestrator SHALL capture structured error details.
2. THE Orchestrator SHALL support graceful shutdown on critical errors.
3. THE Orchestrator SHALL support task cleanup on failure.
4. THE Orchestrator SHALL support retry logic for transient failures.
5. THE Orchestrator SHALL provide error messages to agents and presentation adapters.
6. THE Orchestrator SHALL support fallback behaviors for tool, provider, or MCP failures.
7. THE Orchestrator SHALL log errors for debugging and audit.
8. THE Orchestrator SHALL support error boundary patterns for isolated subsystems.
9. THE Orchestrator SHALL support validation error reporting.
10. THE Orchestrator SHALL support timeout handling for long-running operations.

### Requirement 16: Configuration and Settings

**User Story:** As a developer, I want flexible configuration, so that I can customize framework behavior safely.

#### Acceptance Criteria

1. THE Orchestrator SHALL support configuration via files.
2. THE Orchestrator SHALL support configuration via environment variables.
3. THE Orchestrator SHALL support configuration via CLI flags.
4. THE Orchestrator SHALL support configuration precedence of CLI over environment over file.
5. THE Orchestrator SHALL validate configuration on load.
6. THE Orchestrator SHALL support hot-reloading of configuration where safe.
7. THE Orchestrator SHALL support managed settings from policy.
8. THE Orchestrator SHALL support settings migration across versions.
9. THE Orchestrator SHALL support settings validation with error reporting.
10. THE Orchestrator SHALL support settings source filtering and provenance reporting.

### Requirement 17: Plugin and Extension System

**User Story:** As a developer, I want a plugin system, so that I can extend framework capabilities without modifying the kernel.

#### Acceptance Criteria

1. THE Orchestrator SHALL support loading plugins from directories.
2. THE Plugin SHALL define tools, commands, and hooks.
3. THE Orchestrator SHALL validate plugin schemas on load.
4. THE Orchestrator SHALL support plugin versioning and compatibility checks.
5. THE Orchestrator SHALL support plugin dependencies.
6. THE Orchestrator SHALL support plugin enable and disable controls.
7. THE Orchestrator SHALL support managed plugins from policy.
8. THE Orchestrator SHALL cache plugin metadata for performance.
9. THE Orchestrator SHALL support plugin cleanup on unload.
10. THE Orchestrator SHALL log plugin load and unload errors.

### Requirement 18: Hook System for Extensibility

**User Story:** As a developer, I want a hook system, so that I can intercept and modify framework behavior safely.

#### Acceptance Criteria

1. THE Orchestrator SHALL support pre-tool-use hooks.
2. THE Orchestrator SHALL support post-tool-use hooks.
3. THE Orchestrator SHALL support session-start hooks.
4. THE Orchestrator SHALL support session-end hooks.
5. THE Hook SHALL receive context and tool input.
6. THE Hook SHALL return approval, rejection, or modification.
7. THE Orchestrator SHALL support hook progress reporting.
8. THE Orchestrator SHALL support hook timeout.
9. THE Orchestrator SHALL support hook error handling and isolation.
10. THE Orchestrator SHALL support hook chaining with multiple hooks.

### Requirement 19: State Management

**User Story:** As a developer, I want centralized state management, so that I can maintain consistent framework state.

#### Acceptance Criteria

1. THE Orchestrator SHALL maintain AppState with all framework state.
2. THE AppState SHALL include messages, tasks, permissions, settings, tool results, and user modification state.
3. THE Orchestrator SHALL support immutable state updates.
4. THE Orchestrator SHALL support state subscriptions for reactivity.
5. THE Orchestrator SHALL support state selectors for derived data.
6. THE Orchestrator SHALL support state persistence.
7. THE Orchestrator SHALL support state restoration.
8. THE Orchestrator SHALL support state change callbacks.
9. THE Orchestrator SHALL support atomic state transactions.
10. THE Orchestrator SHALL support state debugging, inspection, and history.

### Requirement 20: Performance Optimization

**User Story:** As a developer, I want maximum performance, so that agents can operate with minimal latency.

#### Acceptance Criteria

1. THE Orchestrator SHALL cache tool schemas to avoid recomputation.
2. THE Orchestrator SHALL cache file reads with LRU or equivalent bounded eviction.
3. THE Orchestrator SHALL use lazy loading for deferred tools.
4. THE Orchestrator SHALL use streaming for large outputs.
5. THE Orchestrator SHALL use worker threads or isolated execution for CPU-intensive operations where appropriate.
6. THE Orchestrator SHALL use connection pooling or reuse for API requests where transports support it.
7. THE Orchestrator SHALL use prompt caching for repeated system prompts.
8. THE Orchestrator SHALL minimize memory allocations in hot paths.
9. THE Orchestrator SHALL use efficient data structures such as Maps and Sets in hot paths.
10. THE Orchestrator SHALL profile and optimize critical paths.

### Requirement 21: Model and Prompt Control Plane

**User Story:** As a developer, I want an explicit model-control layer, so that model selection, prompting, budgets, and memory are governed instead of implicit.

#### Acceptance Criteria

1. THE Orchestrator SHALL expose a provider abstraction for model invocation.
2. THE Orchestrator SHALL maintain a model catalog with capabilities, costs, and trust attributes.
3. THE Orchestrator SHALL route model requests using task type, tool needs, latency target, budget, and trust policy.
4. THE Orchestrator SHALL support fallback chains and health-based failover between providers or models.
5. THE Orchestrator SHALL manage prompts through a versioned prompt registry.
6. THE Orchestrator SHALL enforce token-budget and spend-budget policy.
7. THE Orchestrator SHALL define memory and retrieval strategy for prompt construction.
8. THE Orchestrator SHALL provide an evaluation harness for regression and quality checks.
9. THE Orchestrator SHALL normalize provider responses into a consistent internal format.
10. THE Orchestrator SHALL log provider, model, routing, and budget decisions for audit.

### Requirement 22: Specification Traceability and Correctness

**User Story:** As a chief architect, I want a traceable architecture package, so that implementation work can begin only after design coverage is explicit and testable.

#### Acceptance Criteria

1. EVERY SHALL statement in this document SHALL have a stable identifier.
2. EVERY SHALL statement SHALL be mapped to a concrete design contract and primary implementation owner.
3. THE Design package SHALL define correctness properties and invariants for critical behaviors.
4. THE Design package SHALL identify verification approach for each requirement.
5. THE Architecture package SHALL track unresolved or partial coverage before implementation starts.
6. THE Architecture package SHALL be versioned and updated with change history.
7. THE Traceability_Matrix SHALL be updated whenever requirements or design contracts change.
8. THE Requirements and Design documents SHALL remain free of encoding corruption and machine-readable ambiguity.
9. THE Project SHALL treat missing traceability as a release-blocking architecture defect.
10. THE Project SHALL not start production implementation until requirements have full or explicitly accepted partial design coverage.

### Requirement 23: Skills and Rules System

**User Story:** As a developer, I want powerful skills and rules, so that Supercode can ship opinionated, high-value workflows informed by the `DATA` references without hard-coding them into the runtime kernel.

#### Acceptance Criteria

1. THE Orchestrator SHALL support installable skills and rules as first-class workflow assets.
2. THE Skill SHALL define intent, trigger metadata, dependencies, and reusable workflow instructions.
3. THE Rule SHALL define scope, precedence, severity, and applicable targets.
4. THE Framework SHALL support curated core packs derived from the `DATA` references and evolved for Supercode.
5. THE Framework SHALL support versioned skill and rule packs with schema validation.
6. THE Framework SHALL support enable, disable, and policy management for skills and rules at user, project, and package scope.
7. THE Framework SHALL support discovery and search across installed skills and rules.
8. THE Framework SHALL support host-neutral skill and rule definitions with optional host adapters for different editors or runtimes.
9. THE Framework SHALL support testing and linting of skills and rules before release.
10. THE Framework SHALL track provenance for curated skills and rules so reference-derived assets remain reviewable and maintainable.
