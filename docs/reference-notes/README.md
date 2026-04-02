# Reference Notes

This directory preserves the design patterns that were useful during Supercode's early architecture work without keeping the original reference archive in the repo.

The notes here are distilled for Supercode's current structure:

- [workflow-packs.md](D:\SuperCode\Supercode\docs\reference-notes\workflow-packs.md)
- [memory-architecture.md](D:\SuperCode\Supercode\docs\reference-notes\memory-architecture.md)
- [prompt-system.md](D:\SuperCode\Supercode\docs\reference-notes\prompt-system.md)
- [mcp-hardening.md](D:\SuperCode\Supercode\docs\reference-notes\mcp-hardening.md)

Use these notes when extending:

- [runtime.ts](D:\SuperCode\Supercode\packages\cli\src\runtime.ts)
- [manifests.ts](D:\SuperCode\Supercode\packages\workflows\src\manifests.ts)
- [index.ts](D:\SuperCode\Supercode\packages\workflows\src\index.ts)
- [prompt-registry.ts](D:\SuperCode\Supercode\packages\models\src\prompt-registry.ts)
- [session-memory.ts](D:\SuperCode\Supercode\packages\memory\src\session-memory.ts)
- [simplemem-adapter.ts](D:\SuperCode\Supercode\packages\memory\src\simplemem-adapter.ts)
- [config.ts](D:\SuperCode\Supercode\packages\mcp\src\config.ts)
- [trust.ts](D:\SuperCode\Supercode\packages\mcp\src\trust.ts)

The main takeaways are:

- workflow content should keep growing as curated packs, rules, and commands
- memory should remain optional, but its lifecycle can become much richer
- prompts need a composition model, not only a template registry
- MCP should keep moving toward stronger normalization and trust controls
