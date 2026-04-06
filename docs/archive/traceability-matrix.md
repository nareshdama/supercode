# Traceability Matrix

## TM1. Scope

This matrix maps every SHALL statement in `requirements.md` to a primary implementation owner, the governing design contract, and the minimum verification type expected before production implementation proceeds.

## Document Control

- Architecture Package Version: `1.0.0-draft`
- Last Updated: `2026-04-01`

### Change History

| Version | Date | Summary |
| --- | --- | --- |
| `1.0.0-draft` | `2026-04-01` | Added full requirement-to-design ownership and verification mapping for the production architecture package. |

Verification shorthand:

- `Contract`: interface- or module-level contract test
- `Integration`: multi-component execution test
- `Invariant`: property, race, or lifecycle correctness test
- `Static`: review gate or structural validation
- `Eval`: model-quality or prompt-regression harness

Current coverage status: all requirements in this package have explicit design ownership. No requirement is intentionally left without a contract reference.

## R1. Core Tool System

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R1.1 | Registry stores tools and schemas | `runtime/tools/ToolRegistry` | D3.2, D3.3 | Contract |
| R1.2 | Tool definitions validated before exposure | `runtime/tools/ToolRegistry` | D3.2, D3.3 | Contract |
| R1.3 | Tool defines schemas and execution logic | `runtime/tools/RuntimeTool` | D3.1, D3.3 | Contract |
| R1.4 | Tool declares side effects, concurrency, interrupt behavior | `runtime/tools/RuntimeTool` | D3.1, D5.2 | Contract |
| R1.5 | Runtime contract independent of UI framework | `runtime/tools/RuntimeTool` | D2.2, D3.1, D4.2 | Contract |
| R1.6 | Input validated before execution | `runtime/tools/RuntimeTool` | D3.1, D3.3 | Contract |
| R1.7 | Permission checking is input-aware | `runtime/permissions/PermissionSystem` | D3.1, D6.1 | Integration |
| R1.8 | Tool can report progress | `runtime/progress/ProgressTracker` | D3.1, D7.1 | Integration |
| R1.9 | Tool exposes names, aliases, descriptions, search hints | `runtime/tools/RuntimeTool` | D3.1, D4.2 | Contract |
| R1.10 | Tool results map to structured transport-safe blocks | `runtime/tools/ToolResultStore` | D3.5, D4.1 | Contract |

## R2. Task Lifecycle Management

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R2.1 | Supported task types exist | `runtime/tasks/TaskManager` | D5.1 | Contract |
| R2.2 | Task IDs carry type prefix | `runtime/tasks/TaskManager` | D5.1 | Contract |
| R2.3 | Task state machine uses pending -> running -> terminal | `runtime/tasks/TaskManager` | D5.1, D13.1 | Invariant |
| R2.4 | Task timestamps and pause duration tracked | `runtime/tasks/TaskManager` | D5.1 | Contract |
| R2.5 | Task output is durable with offsets | `runtime/tasks/TaskManager` | D5.1, D3.5 | Integration |
| R2.6 | Terminal tasks become non-transitional | `runtime/tasks/TaskManager` | D5.1, D14:C2 | Invariant |
| R2.7 | Cleanup mechanisms exist | `runtime/tasks/TaskManager` | D5.1 | Integration |
| R2.8 | AbortController supports task abortion | `runtime/tasks/TaskManager` | D5.1 | Integration |
| R2.9 | Task stores description, owner, tool use ID | `runtime/tasks/TaskManager` | D5.1 | Contract |
| R2.10 | Query by ID, type, lifecycle state | `runtime/tasks/TaskManager` | D5.1 | Contract |

## R3. Permission and Security System

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R3.1 | Modes `default`, `auto`, `bypass` supported | `runtime/permissions/PermissionSystem` | D6.1 | Contract |
| R3.2 | Permission checked before execution | `runtime/permissions/PermissionSystem` | D6.1, D14:C1 | Invariant |
| R3.3 | Allow, deny, ask rules supported | `runtime/permissions/PermissionSystem` | D6.1 | Contract |
| R3.4 | Additional working directories are scoped | `runtime/permissions/PermissionSystem` | D6.1 | Contract |
| R3.5 | Decisions track source, actor, timestamp | `runtime/permissions/PermissionSystem` | D6.1, D9.2 | Contract |
| R3.6 | Automated checks occur before dialogs | `runtime/permissions/PermissionSystem` | D6.1 | Integration |
| R3.7 | Auto mode strips dangerous permissions | `runtime/permissions/PermissionSystem` | D6.1 | Contract |
| R3.8 | Bypass mode supported only when available | `runtime/permissions/PermissionSystem` | D6.1 | Contract |
| R3.9 | Background agents avoid prompts unless policy requires | `runtime/permissions/PermissionSystem` | D6.1, D8.1 | Integration |
| R3.10 | Temporary modes restore prior permissions | `runtime/permissions/PermissionSystem` | D6.1 | Contract |

## R4. Progress Tracking and Reporting

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R4.1 | All required progress types supported | `runtime/progress/ProgressTracker` | D7.1 | Contract |
| R4.2 | Progress linked to tool use ID | `runtime/progress/ProgressTracker` | D7.1 | Contract |
| R4.3 | Progress callbacks available | `runtime/progress/ProgressTracker` | D7.1 | Contract |
| R4.4 | Progress filter by type and origin | `runtime/progress/ProgressTracker` | D7.1 | Contract |
| R4.5 | Progress history retained per tool use | `runtime/progress/ProgressTracker` | D7.1 | Contract |
| R4.6 | Spinner and animation states possible for interactive UIs | `presentation/PresentationAdapter` | D4.1, D7.1 | Integration |
| R4.7 | Progress notifications are UI-independent | `runtime/progress/ProgressTracker` | D7.1, D4.1 | Contract |
| R4.8 | Verbose, condensed, transcript progress views | `presentation/ToolPresentation` | D4.1, D4.2 | Integration |
| R4.9 | Per-tool-use progress ordering preserved | `runtime/progress/ProgressTracker` | D7.1 | Invariant |
| R4.10 | Presentation adapters can consume progress snapshots | `presentation/PresentationAdapter` | D4.1, D7.1 | Integration |

## R5. Agent Orchestration Context

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R5.1 | Runtime context exposes options, state, service handles | `runtime/orchestrator/Orchestrator` | D3.4 | Contract |
| R5.2 | Runtime context is separate from presentation callbacks | `runtime/orchestrator/Orchestrator` | D2.2, D3.4, D4.2 | Contract |
| R5.3 | Context includes commands, tools, MCP handles | `runtime/orchestrator/Orchestrator` | D3.4, D10.2 | Contract |
| R5.4 | Abort controller exposed | `runtime/orchestrator/Orchestrator` | D3.4, D5.1 | Contract |
| R5.5 | File state cache exposed | `runtime/orchestrator/Orchestrator` | D3.4 | Contract |
| R5.6 | State getters, setters, atomic transactions supported | `runtime/state/AppStateStore` | D3.4, D9.2 | Integration |
| R5.7 | Memory and dynamic skill triggers supported | `runtime/orchestrator/Orchestrator` | D3.4, D8.4 | Contract |
| R5.8 | User modification tracking supported | `runtime/state/UserModificationTracker` | D3.4, D9.3 | Integration |
| R5.9 | Message history, budget, session metadata available | `runtime/orchestrator/Orchestrator` | D3.4, D8.4, D9.1 | Contract |
| R5.10 | File and glob limits enforced | `runtime/orchestrator/Orchestrator` | D3.4 | Contract |

## R6. Tool Result Management

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R6.1 | Tool declares max result size | `runtime/tools/RuntimeTool` | D3.1 | Contract |
| R6.2 | Oversized results persisted durably | `runtime/tools/ToolResultStore` | D3.5, D14:C4 | Integration |
| R6.3 | Persisted results expose preview and reference | `runtime/tools/ToolResultStore` | D3.5, D7.2 | Contract |
| R6.4 | Structured content and metadata supported | `runtime/tools/ToolResultStore` | D3.5 | Contract |
| R6.5 | Truncation detected and recorded | `runtime/tools/ToolResultStore` | D3.5, D14:C4 | Contract |
| R6.6 | Searchable text extracted | `runtime/tools/ToolResultStore` | D3.5, D7.2 | Integration |
| R6.7 | Results render for verbose, compact, transcript, JSON | `presentation/ToolPresentation` | D4.1, D4.2 | Integration |
| R6.8 | Parallel tool uses can be grouped in presentation | `presentation/ToolPresentation` | D4.1, D4.2 | Integration |
| R6.9 | Queued, rejection, error, fallback envelopes supported | `runtime/tools/ToolResultStore` | D3.5, D4.2 | Contract |
| R6.10 | Retention and cleanup policy applied | `runtime/tools/ToolResultStore` | D3.5 | Integration |

## R7. Concurrency and Safety

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R7.1 | Tool declares concurrency safety per input | `runtime/tools/RuntimeTool` | D3.1 | Contract |
| R7.2 | Unsafe tools serialize by scope | `runtime/tasks/ConcurrencyCoordinator` | D3.1, D5.2 | Invariant |
| R7.3 | In-progress tool use IDs tracked | `runtime/tasks/ConcurrencyCoordinator` | D5.2, D9.2 | Contract |
| R7.4 | Cancel or block interrupt behavior supported | `runtime/tasks/ConcurrencyCoordinator` | D3.1, D5.2 | Contract |
| R7.5 | Exclusive tools can modify execution context | `runtime/orchestrator/Orchestrator` | D3.5, D5.2 | Integration |
| R7.6 | Abort signals supported | `runtime/orchestrator/Orchestrator` | D3.4, D5.1 | Integration |
| R7.7 | Cleanup occurs on abortion | `runtime/tasks/TaskManager` | D5.1, D12.2 | Integration |
| R7.8 | State update race conditions prevented | `runtime/state/AppStateStore` | D9.2, D14:C5 | Invariant |
| R7.9 | Atomic task and state transitions supported | `runtime/tasks/TaskManager` | D5.1, D9.2 | Invariant |
| R7.10 | Concurrent task lifecycle and result persistence coordinated | `runtime/orchestrator/Orchestrator` | D5.1, D3.5, D9.2 | Integration |

## R8. MCP Integration

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R8.1 | MCP connections have explicit lifecycle states | `mcp/MCPIntegration` | D10.1, M2 | Contract |
| R8.2 | Capability negotiation precedes exposure | `mcp/MCPIntegration` | D10.1, D10.2, M4, D14:C8 | Invariant |
| R8.3 | MCP tools and resources load dynamically with server association | `mcp/MCPIntegration` | D10.2, M4 | Integration |
| R8.4 | Invocation honors serialization and ordering rules | `mcp/MCPIntegration` | D10.2, M5 | Integration |
| R8.5 | Authentication and elicitation flows supported | `mcp/MCPIntegration` | D10.2, M2, M7 | Integration |
| R8.6 | Health, heartbeat, retry, backoff monitored | `mcp/MCPHealthMonitor` | D10.3, M5, D14:C9 | Integration |
| R8.7 | Streaming semantics and terminal completion handled | `mcp/MCPIntegration` | D10.2, M6, M10 | Invariant |
| R8.8 | Backpressure and per-server concurrency limits enforced | `mcp/MCPIntegration` | D10.1, M5 | Invariant |
| R8.9 | Server configs filtered and deduplicated by policy | `mcp/MCPTrustPolicy` | D10.3, M3 | Contract |
| R8.10 | Trust policy and isolation boundaries enforced | `mcp/MCPTrustPolicy` | D10.3, M3, M7, M8 | Integration |

## R9. Agent Delegation and Subagents

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R9.1 | Subagents spawn with isolated runtime context | `models/AgentCoordinator` | D8.1, D3.4 | Integration |
| R9.2 | Permission ceilings inherited from parent | `models/AgentCoordinator` | D8.1, D6.1, D14:C7 | Invariant |
| R9.3 | Local denial tracking supported | `models/AgentCoordinator` | D8.1, D9.2 | Contract |
| R9.4 | Content replacement state may be shared explicitly | `models/AgentCoordinator` | D8.1, D9.2 | Contract |
| R9.5 | Tool results may be preserved for transcripts | `models/AgentCoordinator` | D8.1, D3.5 | Integration |
| R9.6 | Agent type identification supported | `models/AgentCoordinator` | D8.1 | Contract |
| R9.7 | Query chain depth tracked | `models/AgentCoordinator` | D8.1 | Contract |
| R9.8 | Forked prompts or shared prompt caches supported | `models/PromptRegistry` | D8.1, D8.4 | Integration |
| R9.9 | Task-scoped state setters supported | `models/AgentCoordinator` | D8.1, D9.2 | Integration |
| R9.10 | Agent color or presentation identity assigned | `models/AgentCoordinator` | D8.1, D4.1 | Contract |

## R10. Session Management

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R10.1 | Session maintains message history | `runtime/session/SessionManager` | D9.1 | Contract |
| R10.2 | Session tracks file history | `runtime/session/SessionManager` | D9.1 | Contract |
| R10.3 | Session tracks attribution state | `runtime/session/SessionManager` | D9.1 | Contract |
| R10.4 | Session persists and restores | `runtime/session/SessionManager` | D9.1, D9.2 | Integration |
| R10.5 | Session can be backgrounded and resumed | `runtime/session/SessionManager` | D9.1 | Integration |
| R10.6 | Unique session IDs assigned | `runtime/session/SessionManager` | D9.1 | Contract |
| R10.7 | Concurrent sessions tracked | `runtime/session/SessionManager` | D9.1 | Integration |
| R10.8 | Session titles cached and updated | `runtime/session/SessionManager` | D9.1 | Contract |
| R10.9 | Search by custom title and metadata | `runtime/session/SessionManager` | D9.1 | Integration |
| R10.10 | Session environment variables and provenance stored | `runtime/session/SessionManager` | D9.1 | Contract |

## R11. Tool Schema and Validation

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R11.1 | Input schema uses Zod or JSON Schema | `runtime/tools/RuntimeTool` | D3.3 | Contract |
| R11.2 | Output schema defined for type safety | `runtime/tools/RuntimeTool` | D3.3 | Contract |
| R11.3 | Inputs validated against schema | `runtime/tools/RuntimeTool` | D3.1, D3.3 | Contract |
| R11.4 | Partial input supported for streaming | `runtime/tools/RuntimeTool` | D3.3 | Contract |
| R11.5 | Input equivalence checking supported | `runtime/tools/RuntimeTool` | D3.3 | Contract |
| R11.6 | Custom validation logic supported | `runtime/tools/RuntimeTool` | D3.1, D3.3 | Contract |
| R11.7 | Validation error messages exposed | `runtime/tools/RuntimeTool` | D3.1, D3.3 | Contract |
| R11.8 | Observable input backfill supported | `runtime/tools/RuntimeTool` | D3.3 | Contract |
| R11.9 | Permission matcher preparation supported | `runtime/tools/RuntimeTool` | D3.3, D6.1 | Contract |
| R11.10 | Strictness and schema compatibility policy defined | `runtime/tools/RuntimeTool` | D3.3 | Contract |

## R12. Tool Discovery and Deferral

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R12.1 | Tool supports deferral flag | `runtime/tools/RuntimeTool` | D3.1 | Contract |
| R12.2 | Tool supports always-load flag | `runtime/tools/RuntimeTool` | D3.1 | Contract |
| R12.3 | Search hints available | `runtime/tools/RuntimeTool` | D3.1 | Contract |
| R12.4 | Deferred discovery supported | `runtime/tools/ToolRegistry` | D3.2 | Integration |
| R12.5 | Deferred tools advertised with metadata | `runtime/tools/ToolRegistry` | D3.1, D3.2 | Contract |
| R12.6 | Aliases supported for backward compatibility | `runtime/tools/ToolRegistry` | D3.1, D3.2 | Contract |
| R12.7 | Name resolution includes aliases | `runtime/tools/ToolRegistry` | D3.2 | Contract |
| R12.8 | Tools refresh on MCP connect or disconnect | `mcp/MCPIntegration` | D3.2, D10.2 | Integration |
| R12.9 | Tool schemas cached | `runtime/tools/ToolRegistry` | D3.2, D12.4 | Integration |
| R12.10 | Enabled-state and policy filtering supported | `runtime/tools/ToolRegistry` | D3.2, D6.1 | Contract |

## R13. Rendering and UI Integration

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R13.1 | Presentation contracts separated from runtime contracts | `presentation/PresentationAdapter` | D2.2, D4.1, D4.2 | Contract |
| R13.2 | Tool use messages render partial input | `presentation/ToolPresentation` | D4.2 | Integration |
| R13.3 | Result messages render with progress history | `presentation/ToolPresentation` | D4.2, D7.1 | Integration |
| R13.4 | Progress messages render during execution | `presentation/ToolPresentation` | D4.2, D7.1 | Integration |
| R13.5 | Queued messages render while waiting | `presentation/ToolPresentation` | D4.2, D3.5 | Integration |
| R13.6 | Rejection messages render with custom UI | `presentation/ToolPresentation` | D4.2, D3.5 | Integration |
| R13.7 | Error messages render with custom UI | `presentation/ToolPresentation` | D4.2, D3.5 | Integration |
| R13.8 | Compact, verbose, transcript, machine-readable modes supported | `presentation/PresentationAdapter` | D4.1, D4.2 | Contract |
| R13.9 | Theme or frontend concerns stay outside runtime interfaces | `presentation/PresentationAdapter` | D2.2, D4.1 | Contract |
| R13.10 | Parallel executions and headless transcripts can be grouped | `presentation/ToolPresentation` | D4.1, D4.2 | Integration |

## R14. Analytics and Telemetry

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R14.1 | Tool invocations logged with metadata | `services/TelemetrySystem` | D12.1 | Integration |
| R14.2 | Task lifecycle transitions logged | `services/TelemetrySystem` | D5.1, D12.1 | Integration |
| R14.3 | Permission decisions logged | `services/TelemetrySystem` | D6.1, D12.1 | Integration |
| R14.4 | MCP connection and state changes logged | `services/TelemetrySystem` | D10.1, D12.1, M9 | Integration |
| R14.5 | Agent spawn and termination logged | `services/TelemetrySystem` | D8.1, D12.1 | Integration |
| R14.6 | Session start and end logged | `services/TelemetrySystem` | D9.1, D12.1 | Integration |
| R14.7 | Context metrics tracked | `services/TelemetrySystem` | D3.4, D12.1 | Integration |
| R14.8 | API metrics such as TTFT and latency tracked | `services/TelemetrySystem` | D8.2, D12.1 | Integration |
| R14.9 | Analytics opt-out supported | `services/TelemetrySystem` | D12.1 | Contract |
| R14.10 | PII and sensitive content sanitized | `services/TelemetrySystem` | D12.1 | Contract |

## R15. Error Handling and Recovery

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R15.1 | Execution failures captured as structured errors | `services/RecoveryManager` | D12.2 | Contract |
| R15.2 | Graceful shutdown supported on critical errors | `services/RecoveryManager` | D12.2 | Integration |
| R15.3 | Task cleanup occurs on failure | `runtime/tasks/TaskManager` | D5.1, D12.2 | Integration |
| R15.4 | Transient retries supported | `services/RecoveryManager` | D12.2 | Contract |
| R15.5 | Errors available to agents and presentation | `runtime/orchestrator/Orchestrator` | D3.5, D4.2, D12.2 | Integration |
| R15.6 | Fallback behaviors supported | `services/RecoveryManager` | D12.2, D8.3 | Integration |
| R15.7 | Errors logged for debugging and audit | `services/TelemetrySystem` | D12.1, D12.2 | Integration |
| R15.8 | Error boundaries isolate subsystem failures | `services/RecoveryManager` | D12.2 | Integration |
| R15.9 | Validation errors reported cleanly | `runtime/tools/RuntimeTool` | D3.1, D3.3, D12.2 | Contract |
| R15.10 | Timeouts handled for long-running operations | `services/RecoveryManager` | D12.2, D5.1, D10.3 | Integration |

## R16. Configuration and Settings

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R16.1 | File-based configuration supported | `services/ConfigManager` | D12.3 | Contract |
| R16.2 | Environment-based configuration supported | `services/ConfigManager` | D12.3 | Contract |
| R16.3 | CLI flag configuration supported | `services/ConfigManager` | D12.3 | Contract |
| R16.4 | Precedence of CLI > env > file enforced | `services/ConfigManager` | D12.3 | Contract |
| R16.5 | Configuration validated on load | `services/ConfigManager` | D12.3 | Contract |
| R16.6 | Safe hot-reload supported | `services/ConfigManager` | D12.3 | Integration |
| R16.7 | Managed settings from policy supported | `services/ConfigManager` | D12.3, D6.1 | Integration |
| R16.8 | Settings migration across versions supported | `services/ConfigManager` | D12.3 | Contract |
| R16.9 | Validation errors reported | `services/ConfigManager` | D12.3 | Contract |
| R16.10 | Source filtering and provenance reporting supported | `services/ConfigManager` | D12.3 | Contract |

## R17. Plugin and Extension System

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R17.1 | Plugins load from directories | `extensions/PluginLoader` | D11.1 | Integration |
| R17.2 | Plugins define tools, commands, hooks | `extensions/PluginLoader` | D11.1 | Contract |
| R17.3 | Plugin schemas validated on load | `extensions/PluginLoader` | D11.1 | Contract |
| R17.4 | Plugin versioning and compatibility checks supported | `extensions/PluginLoader` | D11.1 | Contract |
| R17.5 | Plugin dependencies supported | `extensions/PluginLoader` | D11.1 | Contract |
| R17.6 | Plugins can be enabled or disabled | `extensions/PluginLoader` | D11.1 | Integration |
| R17.7 | Managed plugins from policy supported | `extensions/PluginLoader` | D11.1, D6.1 | Integration |
| R17.8 | Plugin metadata cached | `extensions/PluginLoader` | D11.1, D12.4 | Contract |
| R17.9 | Plugin cleanup occurs on unload | `extensions/PluginLoader` | D11.1 | Integration |
| R17.10 | Plugin load and unload errors logged | `extensions/PluginLoader` | D11.1, D12.1 | Integration |

## R18. Hook System for Extensibility

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R18.1 | Pre-tool-use hooks supported | `extensions/HookSystem` | D11.2 | Integration |
| R18.2 | Post-tool-use hooks supported | `extensions/HookSystem` | D11.2 | Integration |
| R18.3 | Session-start hooks supported | `extensions/HookSystem` | D11.2 | Integration |
| R18.4 | Session-end hooks supported | `extensions/HookSystem` | D11.2 | Integration |
| R18.5 | Hooks receive context and tool input | `extensions/HookSystem` | D11.2 | Contract |
| R18.6 | Hooks return approve, reject, or modify | `extensions/HookSystem` | D11.2 | Contract |
| R18.7 | Hook progress reporting supported | `extensions/HookSystem` | D11.2, D7.1 | Integration |
| R18.8 | Hook timeout supported | `extensions/HookSystem` | D11.2, D12.2 | Integration |
| R18.9 | Hook errors handled and isolated | `extensions/HookSystem` | D11.2, D12.2 | Integration |
| R18.10 | Multiple hooks chain deterministically | `extensions/HookSystem` | D11.2 | Invariant |

## R19. State Management

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R19.1 | AppState contains all framework state | `runtime/state/AppStateStore` | D9.2 | Contract |
| R19.2 | AppState includes messages, tasks, permissions, settings, tool results, modifications | `runtime/state/AppStateStore` | D9.2, D9.3 | Contract |
| R19.3 | Immutable state updates supported | `runtime/state/AppStateStore` | D9.2 | Contract |
| R19.4 | Subscriptions supported | `runtime/state/AppStateStore` | D9.2 | Contract |
| R19.5 | Selectors supported | `runtime/state/AppStateStore` | D9.2 | Contract |
| R19.6 | State persistence supported | `runtime/state/AppStateStore` | D9.2 | Integration |
| R19.7 | State restoration supported | `runtime/state/AppStateStore` | D9.2 | Integration |
| R19.8 | State change callbacks supported | `runtime/state/AppStateStore` | D9.2 | Contract |
| R19.9 | Atomic state transactions supported | `runtime/state/AppStateStore` | D9.2, D14:C5 | Invariant |
| R19.10 | Debugging, inspection, and history supported | `runtime/state/AppStateStore` | D9.2 | Integration |

## R20. Performance Optimization

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R20.1 | Tool schemas cached | `runtime/tools/ToolRegistry` | D3.2, D12.4 | Integration |
| R20.2 | File reads cached with bounded eviction | `runtime/orchestrator/Orchestrator` | D3.4, D12.4 | Integration |
| R20.3 | Deferred tools lazily loaded | `runtime/tools/ToolRegistry` | D3.1, D3.2 | Integration |
| R20.4 | Large outputs streamed | `runtime/orchestrator/Orchestrator` | D3.5, D7.1 | Integration |
| R20.5 | CPU-intensive operations isolated | `services/PerformanceManager` | D10.3, D12.4 | Integration |
| R20.6 | API connections pooled or reused | `models/ModelProvider` | D8.2, D12.4 | Integration |
| R20.7 | Prompt caching supported | `models/PromptRegistry` | D8.4, D12.4 | Integration |
| R20.8 | Hot-path allocations minimized | `services/PerformanceManager` | D12.4 | Static |
| R20.9 | Efficient data structures used in hot paths | `runtime/state/AppStateStore` | D9.2, D12.4 | Static |
| R20.10 | Critical paths profiled and optimized | `services/PerformanceManager` | D12.4 | Integration |

## R21. Model and Prompt Control Plane

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R21.1 | Provider abstraction exists | `models/ModelProvider` | D8.2 | Contract |
| R21.2 | Model catalog tracks capability, cost, trust | `models/ModelProvider` | D8.2 | Contract |
| R21.3 | Routing uses task, tool, latency, budget, trust | `models/ModelRouter` | D8.3, D14:C6 | Integration |
| R21.4 | Fallback chains and health-based failover supported | `models/ModelRouter` | D8.2, D8.3 | Integration |
| R21.5 | Prompts managed by versioned registry | `models/PromptRegistry` | D8.4 | Contract |
| R21.6 | Token and spend budgets enforced | `models/BudgetPolicy` | D8.4, D13.3 | Integration |
| R21.7 | Memory and retrieval strategy defined | `models/MemoryPolicy` | D8.4 | Integration |
| R21.8 | Evaluation harness provided | `models/EvaluationHarness` | D8.4 | Eval |
| R21.9 | Provider responses normalized internally | `models/ModelProvider` | D8.2, D8.4 | Contract |
| R21.10 | Provider, model, routing, budget decisions audited | `services/TelemetrySystem` | D8.3, D8.4, D12.1 | Integration |

## R22. Specification Traceability and Correctness

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R22.1 | Every SHALL has a stable identifier | `architecture/package` | `requirements.md`, TM1 | Static |
| R22.2 | Every SHALL maps to owner and design contract | `architecture/package` | D15, `traceability-matrix.md` | Static |
| R22.3 | Correctness properties and invariants defined | `architecture/package` | D14, M10 | Static |
| R22.4 | Verification approach identified per requirement | `architecture/package` | `traceability-matrix.md` | Static |
| R22.5 | Unresolved or partial coverage tracked before implementation | `architecture/package` | TM1, D15 | Static |
| R22.6 | Architecture package is versioned and change-tracked | `architecture/package` | `requirements.md`, `design.md` | Static |
| R22.7 | Matrix updated whenever requirements or design change | `architecture/package` | D15, `traceability-matrix.md` | Static |
| R22.8 | Docs remain encoding-clean and machine-readable | `architecture/package` | `requirements.md`, `design.md` | Static |
| R22.9 | Missing traceability is release-blocking | `architecture/package` | D14:C10, D15 | Static |
| R22.10 | Production implementation waits for full or accepted-partial coverage | `architecture/package` | D15, `traceability-matrix.md` | Static |

## R23. Skills and Rules System

| ID | Criterion | Primary Owner | Design Refs | Verification |
| --- | --- | --- | --- | --- |
| R23.1 | Skills and rules are first-class workflow assets | `workflows/WorkflowCatalog` | D11.3 | Contract |
| R23.2 | Skills define intent, triggers, dependencies, instructions | `workflows/WorkflowCatalog` | D11.3 | Contract |
| R23.3 | Rules define scope, precedence, severity, targets | `workflows/WorkflowCatalog` | D11.3 | Contract |
| R23.4 | Curated core packs derive from prior reference implementations and are adapted for Supercode | `workflows/WorkflowInstaller` | D11.3 | Static + integration |
| R23.5 | Skill and rule packs are versioned and schema-validated | `workflows/WorkflowInstaller` | D11.3 | Contract |
| R23.6 | Skills and rules can be enabled, disabled, and policy-managed by scope | `workflows/WorkflowCatalog` | D11.3, D12.3 | Integration |
| R23.7 | Discovery and search across installed skills and rules works | `workflows/WorkflowCatalog` | D11.3 | Integration |
| R23.8 | Definitions are host-neutral with optional host adapters | `workflows/WorkflowInstaller` | D11.3 | Contract |
| R23.9 | Skills and rules are linted and tested before release | `workflows/WorkflowInstaller` | D11.3 | Integration |
| R23.10 | Provenance of reference-derived packs is tracked | `workflows/WorkflowInstaller` | D11.3 | Contract |
