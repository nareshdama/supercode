# MCP Lifecycle and Security Specification

## M1. Purpose

This document defines the production contract for Supercode's MCP subsystem. It complements `design.md` by specifying lifecycle states, trust boundaries, capability negotiation, health management, streaming behavior, and quarantine rules.

## Document Control

- Architecture Package Version: `1.0.0-draft`
- Last Updated: `2026-04-01`

### Change History

| Version | Date | Summary |
| --- | --- | --- |
| `1.0.0-draft` | `2026-04-01` | Added MCP lifecycle states, trust policy, health/backpressure rules, streaming semantics, and quarantine invariants. |

## M2. Connection Lifecycle

### M2.1 States

```text
configured
  -> connecting
  -> authenticating
  -> negotiating
  -> ready
  -> degraded
  -> backoff
  -> disconnected
  -> quarantined
```

### M2.2 State Meanings

| State | Meaning | Exposed to Registry |
| --- | --- | --- |
| `configured` | Known to the system but not connected | No |
| `connecting` | Transport open in progress | No |
| `authenticating` | Credential or user approval flow in progress | No |
| `negotiating` | Capabilities being exchanged and validated | No |
| `ready` | Healthy and eligible for exposure | Yes |
| `degraded` | Partially functional, under increased monitoring | Limited |
| `backoff` | Temporarily unavailable after failures | No |
| `disconnected` | Cleanly closed or unavailable | No |
| `quarantined` | Trust or safety violation detected | No |

### M2.3 Transition Rules

1. A server MAY enter `ready` only after transport establishment, trust classification, authentication, and capability negotiation succeed.
2. A server SHALL enter `degraded` after repeated heartbeat failures, partial stream corruption, or recoverable protocol errors.
3. A server SHALL enter `backoff` after transient failures exceed retry thresholds.
4. A server SHALL enter `quarantined` after trust-policy violation, capability mismatch, or repeated unsafe behavior.
5. A quarantined server SHALL require explicit administrative or policy action before re-entry to `configured`.

## M3. Trust Model

### M3.1 Trust Classes

| Trust Class | Meaning | Default Exposure |
| --- | --- | --- |
| `trusted` | First-party or explicitly approved managed server | Eligible for negotiated capabilities |
| `restricted` | Approved only within policy limits | Eligible for filtered capabilities |
| `untrusted` | Not approved for direct exposure | No exposure |

### M3.2 Trust Inputs

Trust classification SHOULD consider:

- Installation source
- Signature or provenance when available
- Declared transport type
- Credential handling mode
- Requested filesystem and network scope
- Historical failure and quarantine record

### M3.3 Trust Rules

1. Plugins SHALL NOT bypass MCP trust policy by registering servers directly into the tool registry.
2. Server capabilities SHALL be filtered after negotiation and before tool exposure.
3. Credential delegation SHALL be denied to untrusted servers.
4. Restricted servers SHALL run with brokered or no credential access.

## M4. Capability Negotiation

### M4.1 Negotiation Flow

1. Open transport.
2. Exchange protocol version and server metadata.
3. Request capabilities.
4. Validate capability schema.
5. Apply trust and policy filters.
6. Materialize kernel-visible tools, resources, and prompts.

### M4.2 Negotiation Requirements

- Unknown capability fields MAY be ignored only in explicitly compatible protocol ranges.
- Tool schemas SHALL be validated before registry exposure.
- Resource descriptors SHALL retain server association.
- Streaming support SHALL be recorded explicitly, not inferred.
- Negotiated concurrency limits SHALL be honored by the runtime.

## M5. Health, Retry, and Backpressure

### M5.1 Health Signals

The MCP health monitor SHALL track:

- Transport open and close failures
- Heartbeat latency and miss count
- Invocation success rate
- Stream completion rate
- Protocol parse failures
- Authentication expiry or renewal failures

### M5.2 Retry Policy

- Connection retries SHOULD use exponential backoff with jitter.
- Authentication failures SHOULD NOT be retried automatically unless the auth mode declares refresh support.
- Protocol validation failures SHALL skip retry and move directly to `quarantined` or `disconnected`, based on policy.

### M5.3 Backpressure

Each server SHALL have:

- A maximum in-flight request count
- A bounded request queue
- A queue rejection policy of fail, shed-oldest, or caller-blocked
- A stream buffer policy with explicit overflow handling

If a server exceeds its declared or configured concurrency limit, the kernel SHALL queue or reject the request before transport write.

## M6. Streaming and Invocation Semantics

### M6.1 Invocation Ordering

1. Requests scoped to the same MCP server SHALL preserve per-request event ordering.
2. Requests scoped to the same tool MAY be serialized if capability metadata or policy requires it.
3. Partial stream chunks SHALL be associated with a stable tool-use ID.
4. Every stream SHALL terminate with exactly one terminal event: `completed`, `failed`, or `cancelled`.

### M6.2 Stream Failure Handling

- Mid-stream transport loss SHALL emit a terminal failure event and update health state.
- Partial output MAY be persisted, but it SHALL be marked incomplete.
- Duplicate terminal events SHALL be ignored after the first committed terminal state.

## M7. Isolation and Credentials

### M7.1 Isolation Modes

| Boundary | Use Case | Notes |
| --- | --- | --- |
| `in_process` | Trusted, low-risk built-in transport | Lowest overhead, highest trust requirement |
| `worker` | CPU or parser isolation | Shared runtime, isolated execution loop |
| `subprocess` | External binary with local brokering | Preferred for restricted local servers |
| `remote` | Network-hosted server | Requires strongest trust and credential controls |

### M7.2 Credential Modes

| Mode | Description |
| --- | --- |
| `none` | No credentials exposed |
| `brokered` | Kernel executes auth flow and passes opaque handles only |
| `delegated` | Server receives direct credentials or renewable tokens |

Rules:

1. Untrusted servers SHALL use `none`.
2. Restricted servers SHALL use `none` or `brokered`.
3. Delegated credentials SHALL require explicit policy allow.
4. Filesystem access SHALL be `brokered` or scoped for any non-trusted local server.

## M8. Quarantine and Recovery

### M8.1 Quarantine Triggers

- Capability schema violation
- Attempted access outside declared isolation bounds
- Repeated malformed protocol frames
- Security policy violation
- Repeated authentication abuse or token misuse

### M8.2 Recovery Rules

1. Quarantine SHALL revoke tool and resource exposure immediately.
2. Quarantine SHALL create an audit event with server ID, reason, and timestamp.
3. Quarantined servers SHALL not reconnect automatically.
4. Recovery from quarantine SHALL require operator, policy, or signed update approval.

## M9. Observability

The MCP subsystem SHALL emit telemetry for:

- Connection state changes
- Negotiation success or failure
- Tool exposure count changes
- Invocation latency and failure rates
- Heartbeat results
- Quarantine entry and exit

## M10. MCP-Specific Invariants

| ID | Invariant |
| --- | --- |
| `MCP-C1` | No MCP capability is exposed before trust classification and negotiation both succeed. |
| `MCP-C2` | No request is written to transport after a server enters `quarantined`. |
| `MCP-C3` | Each stream yields at most one committed terminal state. |
| `MCP-C4` | Backpressure is applied before queue growth becomes unbounded. |
