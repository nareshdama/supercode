# Reference Notes

This directory preserves the design patterns that were useful during Supercode's early architecture work without keeping the original reference archive in the repo.

The notes here are distilled for Supercode's current structure:

- [workflow-packs.md](workflow-packs.md)
- [memory-architecture.md](memory-architecture.md)
- [prompt-system.md](prompt-system.md)
- [mcp-hardening.md](mcp-hardening.md)
- [programmatic-embedding.md](programmatic-embedding.md)

Use these notes when extending:

- [runtime.ts](../../packages/cli/src/runtime.ts) — see [programmatic-embedding.md](programmatic-embedding.md) for the public `./runtime` embedding surface
- [manifests.ts](../../packages/workflows/src/manifests.ts)
- [index.ts](../../packages/workflows/src/index.ts)
- [prompt-registry.ts](../../packages/models/src/prompt-registry.ts)
- [session-memory.ts](../../packages/memory/src/session-memory.ts)
- [simplemem-adapter.ts](../../packages/memory/src/simplemem-adapter.ts)
- [config.ts](../../packages/mcp/src/config.ts)
- [trust.ts](../../packages/mcp/src/trust.ts)

The main takeaways are:

- workflow content should keep growing as curated packs, rules, and commands
- memory should remain optional, but its lifecycle can become much richer
- prompts need a composition model, not only a template registry
- MCP should keep moving toward stronger normalization and trust controls
