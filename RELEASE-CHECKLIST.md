# Release Checklist

This checklist is the Phase 8 release gate for Supercode.

## Build And Test

- Run `npm run clean`
- Run `npm run build`
- Run `npm test`
- Run `npm run coverage:gate`
- Run `npm run smoke:phase7`
- Run `npm run verify:docs`

## Package And Install Validation

- Verify `npx supercode init` works from a clean machine or clean temp directory
- Verify `npm install @supercode/core` works as a consumer install path
- Verify source checkout usage works with `npm install`, `npm run build`, and `node packages/cli/dist/index.js doctor`
- Verify published tarballs do not ship build metadata or unintended files

## Docs And Examples

- Confirm [README.md](/D:/SuperCode/Supercode/README.md) matches the actual CLI help output
- Confirm [examples/minimal-runtime/README.md](/D:/SuperCode/Supercode/examples/minimal-runtime/README.md) uses valid CLI commands
- Confirm install guidance covers zero-install bootstrap, package-consumer usage, and source-checkout usage
- Confirm release notes mention user-visible command, install, or template changes

## Security And Runtime Review

- Review permission defaults for shell, filesystem, tool, and MCP execution
- Review plugin and hook execution paths for cycle detection, invalid tool references, and abort behavior
- Review MCP trust posture, transport boundaries, and degraded/backoff handling
- Review result and artifact persistence for truncation, retention, and path safety

## Release Decision

- Record the version being shipped
- Record the date of the release candidate
- Record any known limitations that remain acceptable for the release
- Do not publish until all blockers are resolved or explicitly accepted
