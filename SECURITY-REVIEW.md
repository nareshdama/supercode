# Security Review

Date: `2026-04-02`

Scope:
- permission defaults
- filesystem and shell execution boundaries
- plugin and hook execution safety
- MCP trust and lifecycle controls
- persisted results and artifact handling

Reviewed components:
- [packages/permissions/src/permission-system.ts](packages/permissions/src/permission-system.ts)
- [packages/tools/src/builtin-tools.ts](packages/tools/src/builtin-tools.ts)
- [packages/cli/src/runtime.ts](packages/cli/src/runtime.ts)
- [packages/workflows/src/index.ts](packages/workflows/src/index.ts)
- [packages/state/src/file-store.ts](packages/state/src/file-store.ts)
- [mcp-lifecycle-security.md](mcp-lifecycle-security.md)

## Current Posture

- Shell, network, and MCP actions default to `prompt` in default mode through the runtime permission system.
- Filesystem tools are scoped to the runtime working directory.
- Plugin tools, commands, run steps, and hooks are schema-validated and checked for unknown tool references and local tool cycles.
- MCP exposure is guarded by trust classification, negotiation, and quarantine/backoff handling.
- Large persisted results are truncated for CLI display and stored as separate artifacts.

## Fixed In This Review

1. Workspace path-prefix bypass in filesystem writes and reads.
Before this review, workspace checks used a simple string prefix comparison. A sibling path such as `workspace-escape` could match the base prefix `workspace`.
Status: fixed in [builtin-tools.ts](packages/tools/src/builtin-tools.ts).

2. Unrestricted `cwd` overrides for shell and project commands.
Before this review, `shell.exec`, `git.status`, `project.build`, and `project.test` accepted `cwd` overrides resolved with `path.resolve()` but without workspace-boundary enforcement.
Status: fixed in [builtin-tools.ts](packages/tools/src/builtin-tools.ts).

3. Regression coverage for the above boundary issues.
Status: added in [builtin-tools.test.mjs](packages/tools/test/builtin-tools.test.mjs).

4. Artifact retention and size-bound enforcement for persisted outputs.
Before this review close-out, large persisted artifacts could accumulate indefinitely under `.supercode/artifacts/`, and there was no explicit maximum artifact size.
Status: fixed in [file-store.ts](packages/state/src/file-store.ts) with configurable entry-count and byte-size limits, oversized-artifact rejection, and regression coverage in [file-store.test.mjs](packages/state/test/file-store.test.mjs).

## Findings

- No current blocker was found in plugin cycle detection or invalid tool-reference validation. The workflow validator explicitly rejects duplicate plugin identifiers, duplicate command names, invalid hook failure policies, unknown tool references, and plugin-local tool cycles in [index.ts](packages/workflows/src/index.ts).
- MCP controls are documented strongly in [mcp-lifecycle-security.md](mcp-lifecycle-security.md) and partially enforced in runtime code, but this remains a high-risk surface because it combines transport, trust, and external tool execution.
- Permission behavior is conservative for shell, network, and MCP categories, but filesystem actions default to allow. That is acceptable for the current local-tooling model, but it is a release sensitivity if Supercode expands beyond explicitly user-scoped workspaces.

## Residual Risks

- `shell.exec` still executes arbitrary commands within the allowed workspace once permitted. This is intentional but high risk by design.
- Plugin tools can compose existing runtime tools. Validation and cycle detection reduce structural risk, but plugins remain a privileged extension surface once enabled.
- Result and artifact persistence writes under `.supercode/`. Artifact filenames remain runtime-generated IDs, retention and size limits are now enforced, and operational disk-growth monitoring still remains necessary.
- MCP remains the most security-sensitive subsystem. The design contract is stronger than the current implementation evidence, so Phase 8 should continue with explicit MCP-focused adversarial tests.

## Recommended Next Hardening Steps

- Add adversarial tests for MCP trust and quarantine transitions.
- Add negative tests for plugin hooks invoking denied tools through permission prompts.
- Add a small security regression suite for workspace-boundary enforcement across all first-party tools.
