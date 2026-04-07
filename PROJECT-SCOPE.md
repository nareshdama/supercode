# Project Scope

## Product Definition

Supercode is a developer orchestration framework built around:

- a headless runtime kernel
- a developer CLI
- a project scaffolder
- optional MCP and memory integrations
- workflow packs, plugins, hooks, and extension validation

## Target Users

- individual developers who want a local orchestration runtime
- teams embedding the runtime into their own tools
- developers who want scaffolded workflow-aware projects
- contributors extending tools, workflows, MCP support, and runtime safety

## In Scope

- task orchestration and persisted runtime state
- permission-aware tool execution
- local filesystem and shell tool execution with guardrails
- MCP discovery, invocation, trust posture, and health handling
- optional local memory and retrieval support
- workflow packs, plugin commands, hook execution, and extension validation
- CLI-based setup, inspection, and runtime operations
- publishable npm packages and source-checkout usage

## Out Of Scope For The Current Line

- a full hosted SaaS platform
- multi-tenant cloud control plane
- heavy UI-first product work
- marketplace infrastructure for third-party pack distribution
- remote worker fleets as a required core dependency
- mandatory long-term memory services

## Supported Delivery Modes

- `npx @nareshdama/supercode init`
- `npm install @nareshdama/core`
- `npm install @nareshdama/supercode` (CLI plus the `./runtime` subpath for programmatic embedding — ESM `import` only)
- source checkout from GitHub

## Current Project Boundary

The repository is responsible for:

- the runtime contracts and kernel packages
- the CLI and scaffolder
- shipped workflow packs and templates
- packaging, verification, and release scripts
- canonical documentation for **CLI users** ([USER-GUIDE.md](USER-GUIDE.md)), **contributors** ([CONTRIBUTING.md](CONTRIBUTING.md)), and **developers / embedders** ([DEVELOPING.md](DEVELOPING.md), reference notes under [docs/reference-notes/](docs/reference-notes/README.md))

It is not responsible for:

- managing external MCP servers
- hosting provider APIs
- shipping non-TypeScript SDKs today

## Quality Bar

Changes should keep the repository:

- buildable
- testable
- installable from npm
- consistent with docs
- safe by default around tools, permissions, and MCP

## Current Scope Decision

Phases 1 through 8 are complete. The line is in **Phase 9** (stabilization) and **Phase 10** (embedding / adoption quality)—controlled expansion, not open-ended architectural churn. Future work should extend the existing kernel and package boundaries rather than replace them; see [ROADMAP.md](ROADMAP.md).
