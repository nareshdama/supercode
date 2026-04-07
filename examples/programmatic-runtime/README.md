# Programmatic Runtime Example

Use the CLI once to scaffold state, then construct the same **persisted runtime** a host application would use by importing `@nareshdama/supercode/runtime`.

## Prerequisites

- Repository checkout with dependencies installed (`npm install` at the repo root)
- TypeScript build output for workspace packages (`npm run build`)

## Steps

Initialize a throwaway project (from any empty directory):

```bash
npx @nareshdama/supercode init
```

From the **repository root**, print runtime summary JSON for that project (replace the path):

```bash
node examples/programmatic-runtime/host.mjs /absolute/path/to/your/project
```

If you omit the path, the script uses the current working directory:

```bash
cd /absolute/path/to/your/project
node /absolute/path/to/supercode/examples/programmatic-runtime/host.mjs
```

## What this demonstrates

- `createPersistedRuntimeContext` from `@nareshdama/supercode/runtime` — the same persisted kernel the CLI uses for tasks, tools, and state. This constructor does substantial work (filesystem layout, registries, subscribers); use it when you need the full kernel, not for a quick capability probe.
- `buildExecutionProfileForProject` — the same execution-profile pipeline as the CLI (`resolveExecutionProfileInputs` / doctor flow), so embedders do not re-compose `@nareshdama/core` + `@nareshdama/detect` + `@nareshdama/workflows` by hand (avoids strict package-manager hoisting issues when only `@nareshdama/supercode` is a direct dependency).

## Notes

- **Package entry**: `@nareshdama/supercode` is ESM-first (`"type": "module"`). Use `import` or dynamic `import()` for `./runtime`. CommonJS `require("@nareshdama/supercode/runtime")` is not supported for this subpath.
- **Stdout**: the example prints `sessionId` in the JSON summary; treat that as sensitive in shared logs if needed.
- Follow [examples/README.md](../README.md) for the broader tutorial set and docs verification expectations.
