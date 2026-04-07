# Example Apps And Tutorials

These examples are the shipped tutorial set and the current stable-release documentation baseline.

Available examples:

- [minimal-runtime/README.md](minimal-runtime/README.md): initialize a project, inspect the execution profile, and run a basic task
- [memory-enabled-runtime/README.md](memory-enabled-runtime/README.md): enable memory explicitly and inspect stored memories across repeated runs
- [plugin-release-workflow/README.md](plugin-release-workflow/README.md): validate extensions, inspect plugins, and exercise plugin-driven workflow customization
- [programmatic-runtime/README.md](programmatic-runtime/README.md): embed the persisted kernel from Node.js — import `@nareshdama/supercode/runtime` only (`buildExecutionProfileForProject`, `createPersistedRuntimeContext`, …) so host apps stay aligned with the CLI profile pipeline and strict package layouts

Verification:

- `npm run verify:docs` checks example CLI commands against the built help output
- `npm run smoke:phase7` covers the install-path baseline before following the examples
