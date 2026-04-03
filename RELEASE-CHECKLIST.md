# Release Checklist

This checklist is the canonical stable-release gate for Supercode.

Phase 8 established this gate. Keep it green before each tagged public release.

## Build And Test

- Run `npm run clean`
- Run `npm run build`
- Run `npm test`
- Run `npm run coverage:gate`
- Run `npm run profile:baseline`
- Run `npm run smoke:phase7`
- Run `npm run verify:docs`

## Package And Install Validation

- Verify `npx supercode init` works from a clean machine or clean temp directory
- Verify `npm install @nareshdama/core` works as a consumer install path
- Verify source checkout usage works with `npm install`, `npm run build`, and `node packages/cli/dist/index.js doctor`
- Verify published tarballs do not ship build metadata or unintended files

## Docs And Examples

- Confirm [README.md](README.md) matches the actual CLI help output
- Confirm [examples/minimal-runtime/README.md](examples/minimal-runtime/README.md) uses valid CLI commands
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
