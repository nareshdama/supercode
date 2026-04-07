# Release Checklist

This checklist is the canonical stable-release gate for Supercode.

Phase 8 established this gate; it remains the **canonical release gate** for Phase 9+ patch and minor releases. Keep it green before each tagged public release.

The CLI wrapper `supercode release check` can audit release metadata and optionally run the build/test/docs gate end-to-end. Use `supercode release check --skip-gates` for a fast static audit, or run it without `--skip-gates` from the repository root to execute the checklist commands in order.

## Build And Test

- Run `npm run clean`
- Run `npm run build`
- Run `npm test`
- Run `npm run coverage:gate`
- Run `npm run profile:baseline`
- Run `npm run smoke:phase7`
- Run `npm run verify:docs`

## Package And Install Validation

- Verify `npx @nareshdama/supercode init` works from a clean machine or clean temp directory
- Verify `npm install @nareshdama/core` works as a consumer install path
- Verify source checkout usage works with `npm install`, `npm run build`, and `node packages/cli/dist/index.js doctor`
- Verify published tarballs do not ship build metadata or unintended files

## Docs And Examples

- Confirm [USER-GUIDE.md](USER-GUIDE.md) stays aligned with shipped CLI behavior for end users
- Confirm [README.md](README.md) matches the actual CLI help output
- Confirm [examples/minimal-runtime/README.md](examples/minimal-runtime/README.md) uses valid CLI commands
- Confirm [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md) matches the current `@nareshdama/supercode/runtime` embedding surface and `npm run verify:docs` passes
- Confirm [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md) reflects the latest profiling run
- Confirm install guidance covers zero-install bootstrap, package-consumer usage, and source-checkout usage
- Confirm release notes mention user-visible command, install, or template changes

## Security And Runtime Review

- Confirm [SECURITY-REVIEW.md](SECURITY-REVIEW.md) is current for the release
- Review permission defaults for shell, filesystem, tool, and MCP execution
- Review plugin and hook execution paths for cycle detection, invalid tool references, and abort behavior
- Review MCP trust posture, transport boundaries, and degraded/backoff handling
- Review result and artifact persistence for truncation, retention, and path safety

## Release Decision

- Record the version being shipped
- Record the date of the release candidate
- Record any known limitations that remain acceptable for the release
- Confirm npm publish auth is valid: either an interactive session that can provide OTP or a granular access token with bypass-2FA enabled
- Do not publish until all blockers are resolved or explicitly accepted
