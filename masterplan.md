# Supercode Master Plan

## 1. Purpose

Supercode should become an installable agent-orchestration framework with three user-facing modes:

1. `npx supercode ...` for zero-install bootstrapping and project setup
2. npm packages for teams embedding the framework into their own products
3. a standalone GitHub project for users who want the full source, templates, and reference workflows

This plan is based on four local inputs:

- a large TypeScript runtime reference covering tools, tasks, context, state, and MCP
- a memory-focused reference project covering long-term and cross-session memory
- a workflow and packaging reference project covering install strategy, skills, rules, hooks, and operational patterns
- a historical internal Codex workflow reference used during planning, not a required part of the Supercode product architecture

## 2. What We Reuse From Each Reference

### 2.1 Runtime Reference

Adopt as inspiration:

- tool registry and tool metadata patterns
- task lifecycle and task ID model
- permission context and decision flow
- progress tracking and session state concepts
- MCP connection and resource integration patterns

Do not copy directly:

- the current runtime/presentation coupling
- monolithic `ToolUseContext`
- product-specific feature flags and UI concerns

Supercode should extract the kernel shape, then rebuild it using the layered contracts already defined in [design.md](design.md).

Current development status as of `2026-04-02`:

- Phases 1 through 8 are complete.
- Phase 8 hardening is complete, with release checklist, security review, performance baseline, docs verification, example tutorials, install validation, and artifact-retention controls landed in-repo.
- Current work is focused on the first stable release cut rather than major architecture expansion.

### 2.2 Memory Reference

Adopt as inspiration:

- memory as a distinct subsystem, not a hidden side effect
- cross-session lifecycle: start, collect, stop, consolidate
- retrieval planning, provenance, and memory maintenance
- MCP-based memory service model

Supercode should treat memory as optional:

- `@nareshdama/memory` for local or embedded memory
- `@nareshdama/memory-mcp` for external memory service integration

Memory must not block the core kernel from being lightweight.

### 2.3 Workflow and Packaging Reference

Adopt as inspiration:

- distribution strategy across plugin, CLI, and source repo forms
- curated workflows: agents, skills, commands, rules, hooks
- cross-platform install scripts and packaging discipline
- validation scripts and coverage gates

Supercode should not be only a workflow pack. It should use this repo's operational model to wrap a real runtime framework.

### 2.4 Historical Codex Workflow Reference

A historical internal Codex workflow reference informed how this repo was operated while planning Supercode:

- `explorer`: read-only evidence gathering before structural changes
- `reviewer`: correctness, security, regression, and missing-test review
- `docs-researcher`: verify API and behavior claims before they land
- instruction-first security and sandbox discipline

This informed development process only. It should not be treated as part of the shipped Supercode architecture.

## 3. Product Definition

Supercode should be positioned as:

- a TypeScript orchestration kernel
- a developer CLI
- an extension host for tools, MCP servers, plugins, skills, rules, workflows, and memory providers
- a source-available reference project with production-ready docs and templates

Core promise:

- use tools safely
- orchestrate agents and subagents
- manage permissions, sessions, progress, and results
- integrate MCP and optional long-term memory
- ship powerful curated skills and rules informed by prior reference implementations
- run headless or with frontends

## 4. Delivery Modes

### 4.1 Core Library

Primary packages:

- `@nareshdama/core`: runtime contracts and orchestrator kernel
- `@nareshdama/models`: provider abstraction, routing, prompt registry, budgets, evals
- `@nareshdama/mcp`: MCP lifecycle manager, trust policy, health monitor
- `@nareshdama/memory`: optional local memory facade
- `@nareshdama/workflows`: curated skills, rules, prompts, and workflow packs
- `@nareshdama/sdk`: embedding API for external apps and services

### 4.2 CLI

User entrypoint:

- `supercode`

Initial commands:

- `supercode init`
- `supercode doctor`
- `supercode run`
- `supercode eval`
- `supercode mcp list`
- `supercode mcp add`
- `supercode memory status`
- `supercode pack list`
- `supercode pack install`
- `supercode skill search`
- `supercode rule search`

### 4.3 Zero-Install Bootstrap

User entrypoint:

- `npx supercode init`

This should:

- scaffold a new project or add Supercode to an existing project
- create config files
- install example workflow packs
- optionally wire memory and MCP defaults

### 4.4 Standalone GitHub Project

The repo should also work as:

- a full source checkout
- a self-hosted development environment
- the canonical docs, templates, and examples source

### 4.5 Optional Hosted Services Later

Not required for v1, but worth designing for:

- hosted memory service
- hosted evaluation dashboard
- hosted trace and telemetry viewer
- remote worker pool for subagents

## 5. Proposed Monorepo Shape

```text
Supercode/
|-- docs/
|   |-- architecture/
|   |-- workflows/
|   `-- examples/
|-- packages/
|   |-- core/
|   |-- models/
|   |-- mcp/
|   |-- memory/
|   |-- workflows/
|   |-- sdk/
|   |-- cli/
|   `-- create-supercode/
|-- templates/
|   |-- basic-cli/
|   |-- service-runtime/
|   `-- agent-project/
|-- workflow-packs/
|   |-- core/
|   |-- languages/
|   `-- frameworks/
|-- examples/
|   |-- minimal-runtime/
|   |-- mcp-runtime/
|   `-- memory-enabled-runtime/
|-- scripts/
|-- tests/
|   |-- contracts/
|   |-- integration/
|   `-- e2e/
|-- requirements.md
|-- design.md
|-- mcp-lifecycle-security.md
|-- traceability-matrix.md
`-- masterplan.md
```

## 6. Development Workflow

Follow the local planning workflow:

1. Explore first
   - trace existing behavior and source references before changing contracts
2. Plan second
   - add or update requirements, design, and traceability before complex implementation
3. Implement with tests
   - contract tests first for runtime interfaces
   - integration tests for MCP, permissions, tasks, and memory
4. Review before merge
   - reviewer pass for correctness and regressions
5. Verify claims before release
   - docs-researcher pass for external behavior, install docs, and public APIs

Suggested branch gate:

- architecture docs updated
- traceability coverage maintained
- contract tests pass
- integration tests pass
- packaging smoke test passes

## 6.1 Skills and Rules Strategy

Supercode should ship powerful skills and rules, but they must be curated into Supercode-owned packs instead of copied raw from prior reference material.

Reference sources:

- workflow and packaging reference material for high-value skills, rules, agent workflows, and packaging patterns
- memory reference material for retrieval guidance and lifecycle design
- runtime reference material for constraints that workflow packs must respect

Pack tiers:

- `core`: planning, implementation, review, testing, debugging, security
- `language`: TypeScript, Python, Go, Rust, Java, and others as added
- `framework`: React, Next.js, FastAPI, Spring, database, MCP, memory
- `experimental`: packs under evaluation and disabled by default

Curation rules:

- normalize imported ideas into Supercode schema and naming
- keep packs editor-neutral by default
- support optional host adapters only at export or install time
- add tests and linting for packs before release
- track provenance for all reference-derived packs

## 7. Roadmap

### Phase 0: Reference Distillation

Goal:

- turn the three main reference inputs into explicit Supercode decisions

Deliverables:

- architecture docs already started in `requirements.md`, `design.md`, `traceability-matrix.md`, `mcp-lifecycle-security.md`
- this master plan
- codemap of reusable patterns from the runtime reference

Exit criteria:

- every major subsystem has a source reference and a Supercode-specific decision

### Phase 1: Repository and Package Scaffold

Goal:

- create a real TypeScript monorepo with publishable packages

Deliverables:

- workspace manager setup
- `packages/core`, `packages/cli`, `packages/create-supercode`
- shared TS config, linting, testing, release tooling
Exit criteria:

- `npm install`
- `npm test`
- `npm run build`
- `npx supercode --help`

### Phase 2: Kernel Runtime

Goal:

- implement the orchestration kernel from the current design docs

Deliverables:

- tool registry
- task manager
- permission system
- progress tracker
- state store
- session manager
- result store

Exit criteria:

- contract tests for all core runtime interfaces
- headless example runtime can execute a small tool set

### Phase 3: Model Control Plane

Goal:

- add provider abstraction and governed model invocation

Deliverables:

- model provider interface
- model router
- prompt registry
- budget policy
- memory-selection hooks for prompt construction
- evaluation harness skeleton

Exit criteria:

- at least two provider adapters can be normalized behind one API
- routing and fallback decisions are testable and logged

### Phase 4: MCP Production Layer

Goal:

- implement safe, lifecycle-aware MCP support

Deliverables:

- MCP integration service
- capability negotiation
- trust policy
- isolation policy
- health monitor
- backpressure and retry handling

Exit criteria:

- MCP contract tests pass
- degraded, backoff, and quarantined states are exercised in tests

### Phase 5: Memory Layer

Goal:

- integrate optional long-term and cross-session memory

Deliverables:

- `@nareshdama/memory`
- memory provider interface
- SimpleMem-inspired adapter
- session memory collection and retrieval pipeline
- provenance and retention policy

Exit criteria:

- core runtime still works with memory disabled
- memory-enabled example works with explicit configuration

### Phase 6: Workflow and Extension Layer

Goal:

- package curated workflows around the kernel

Deliverables:

- plugin loader
- hook system
- workflow catalog
- workflow pack installer
- curated skill packs derived from prior reference implementations
- curated rule packs derived from prior reference implementations
- example rules, skills, and agent roles
- pack validation and linting
- editor-neutral project template with optional local agent/workflow configuration

Exit criteria:

- users can scaffold a project with a working rules and skills baseline
- `supercode pack list` and `supercode pack install` work

### Phase 7: Distribution and Install Experience

Goal:

- make Supercode easy to adopt

Deliverables:

- npm publish flow
- `npx supercode init`
- Windows and Unix install scripts
- standalone repo quick-start
- package smoke tests across install modes

Exit criteria:

- fresh machine smoke test succeeds for:
  - `npx supercode init`
  - `npm install @nareshdama/core`
  - clone-and-run standalone repo path

### Phase 8: Hardening and Launch

Goal:

- move from architecture-complete to production-ready

Deliverables:

- coverage gates
- performance profiling
- security review
- docs verification
- release checklist
- example apps and tutorials

Exit criteria:

- release candidate installable by outside users
- docs and examples match shipped behavior

## 8. MVP Definition

The first public MVP should include only what is needed to prove the framework:

- headless kernel
- CLI
- local tool registry
- task and permission system
- basic model provider abstraction
- MCP integration for a small safe subset
- optional memory disabled by default
- one scaffold template

Do not make v1 depend on:

- hosted services
- full workflow marketplace
- complex UI
- remote agent farms

## 9. Packaging Strategy

### 9.1 Package Names

Recommended initial names:

- `supercode`: CLI package
- `create-supercode`: project scaffolder
- `@nareshdama/core`
- `@nareshdama/models`
- `@nareshdama/mcp`
- `@nareshdama/memory`
- `@nareshdama/workflows`
- `@nareshdama/sdk`

### 9.2 Publish Strategy

- keep CLI and scaffolder separately publishable
- keep core runtime semver-stable
- keep experimental adapters behind opt-in packages
- publish templates and examples from the main repo

### 9.3 Install Paths

User-facing install paths:

- `npm install supercode`
- `npm install @nareshdama/core`
- `npm install -g supercode`
- `git clone <repo>`

## 10. Possibility Space

High-value expansion paths after MVP:

- editor-neutral agent and workflow templates
- Claude/OpenCode/Cursor adapter packs
- marketplace-quality skill and rule packs
- hosted memory service
- remote subagent workers
- workflow marketplace
- evaluation dashboard
- team memory and runbook sync
- secure enterprise policy packs

## 11. Main Risks

### 11.1 Architectural Risk

- rebuilding too much of the runtime reference without preserving its battle-tested execution patterns

Mitigation:

- codemap first
- contract tests before feature expansion

### 11.2 Product Risk

- trying to launch kernel, workflow marketplace, and hosted platform at the same time

Mitigation:

- keep MVP focused on kernel + CLI + scaffold

### 11.3 Packaging Risk

- over-coupling CLI, templates, memory, and MCP into one heavy install

Mitigation:

- package split and optional adapters

### 11.4 Security Risk

- shipping MCP and tool execution without strong permission defaults

Mitigation:

- default-safe permissions
- audited decision logging
- quarantine and trust policy from day one

### 11.5 Docs Drift Risk

- architecture docs and shipped package behavior diverging

Mitigation:

- traceability matrix as a merge gate
- docs verification before release

## 12. First Concrete Next Steps

1. Create the monorepo scaffold under `Supercode/` with `packages/core`, `packages/cli`, and `packages/create-supercode`.
2. Build a codemap from the runtime reference that maps its tool, task, permission, MCP, and state patterns into the new package boundaries.
3. Define the first stable CLI surface: `init`, `doctor`, `run`, and `mcp`.
4. Implement contract tests directly from [traceability-matrix.md](traceability-matrix.md).
5. Add a minimal example project that proves `npx supercode init` and `supercode run`.
6. Treat memory as phase 5, not as a prerequisite for the kernel.
7. Distill the first curated workflow pack from the workflow reference into Supercode-native skills and rules.

## 13. Decision Summary

Supercode should be built as a layered TypeScript monorepo with a small kernel-first MVP.

- the runtime reference informs runtime architecture
- the memory reference informs optional memory and cross-session continuity
- the workflow and packaging reference informs install, workflow, rules, and packaging strategy
- `.codex` only informed the internal planning workflow and is not part of the target product architecture

The right near-term target is not "clone all three references". The right target is "extract the kernel, keep memory optional, curate powerful skills and rules into Supercode-owned packs, and ship a CLI plus scaffold that users can adopt through `npx`, npm, or a standalone repo."
