# Roadmap

## Current Position

- Phases 0 through 8 are complete.
- `0.1.0` has been shipped under the `@nareshdama/*` package scope.
- The architecture baseline is in place. The next work is stabilization, adoption quality, and controlled expansion.

## Completed Phases

- Phase 0: reference distillation and architecture framing
- Phase 1: repository and package scaffold
- Phase 2: execution kernel
- Phase 3: model control plane
- Phase 4: MCP production layer
- Phase 5: memory layer
- Phase 6: workflow and extension layer
- Phase 7: distribution and install experience
- Phase 8: hardening and launch

## Next Phases

### Phase 9: Post-Release Stabilization

Focus:

- reduce packaging and install friction
- harden publish and release operations
- close docs gaps for contributors and downstream adopters
- increase confidence around regression-sensitive runtime surfaces

Exit targets:

- clean contributor and developer onboarding docs
- stable npm publishing workflow with scoped packages
- repeatable patch-release process
- reduced release friction for docs, install, and packaging changes

### Phase 10: Embedding And SDK Expansion

Focus:

- improve composability for teams embedding the runtime
- formalize integration seams currently implied by internal package boundaries
- expand example usage beyond the CLI path

Progress (docs and API):

- `@nareshdama/supercode/runtime` exposes `resolveExecutionProfileInputs`, `buildExecutionProfileForProject`, and `createPersistedRuntimeContext` aligned with the CLI profile pipeline; tutorials live under [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md) and [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md).

Potential deliverables:

- clearer embedding patterns around runtime construction (in progress)
- stronger package-level API guidance
- additional examples for host applications and custom tool registries
- more explicit compatibility and versioning guidance

### Phase 11: Advanced Safety And Integration Hardening

Focus:

- deepen adversarial coverage around MCP, plugins, hooks, and tool execution
- improve operational controls around trust posture and failure handling

Potential deliverables:

- stronger MCP and plugin abuse-case tests
- more operational diagnostics around permission and tool flows
- better packaging checks for plugin and workflow integrity

## Longer-Term Possibilities

- richer SDK layers
- hosted memory or evaluation services
- enterprise policy packs
- broader language or framework pack coverage
- remote worker or subagent infrastructure

These are options, not current commitments.

## Planning Rule

Future work should extend the current runtime and package model. New phases should not re-open settled package boundaries or replace the existing kernel without a concrete, high-value reason.
