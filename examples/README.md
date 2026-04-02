# Example Apps And Tutorials

These examples are the Phase 8 baseline for shipped tutorials and the current release-readiness docs set.

Available examples:

- [minimal-runtime/README.md](minimal-runtime/README.md): initialize a project, inspect the execution profile, and run a basic task
- [memory-enabled-runtime/README.md](memory-enabled-runtime/README.md): enable memory explicitly and inspect stored memories across repeated runs
- [plugin-release-workflow/README.md](plugin-release-workflow/README.md): validate extensions, inspect plugins, and exercise plugin-driven workflow customization

Verification:

- `npm run verify:docs` checks example CLI commands against the built help output
- `npm run smoke:phase7` covers the install-path baseline before following the examples
