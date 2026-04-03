# MCP Hardening Notes

## Current State

Supercode already has a solid MCP baseline:

- config parsing in [config.ts](../../packages/mcp/src/config.ts)
- runtime health and session control in [runtime.ts](../../packages/mcp/src/runtime.ts) and [session.ts](../../packages/mcp/src/session.ts)
- trust classification in [trust.ts](../../packages/mcp/src/trust.ts)

## Useful Patterns To Keep

### 1. Normalize names and transports aggressively

Server IDs, transport kinds, trust flags, and capability metadata should be normalized early so the rest of the runtime works on one canonical shape.

### 2. Separate parsing from trust policy

Keep these as different layers:

- config parsing
- transport detection
- trust classification
- capability filtering

That separation is already mostly present and should stay that way.

### 3. Prefer fail-closed defaults

If an MCP server is ambiguous or malformed:

- do not silently grant trust
- do not expose high-risk capabilities
- surface notes and degraded status to the caller

### 4. Consider an official-registry or allowlist layer later

If Supercode eventually supports broader remote MCP usage, it may benefit from an optional registry-backed classification layer for known servers. That should be additive, not required for local development.

## Current Gaps In Supercode

- no official-server classification layer yet
- only basic name and trust normalization today
- no stronger provenance for where a trust decision came from

## Recommended Follow-Ups

1. Add explicit normalization tests for edge-case server names and URLs.
2. Record why a server was classified as trusted, restricted, or untrusted.
3. Add an optional allowlist or registry layer only if remote MCP becomes a bigger product surface.
