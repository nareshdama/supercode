# Supercode User Guide

This guide is for **people using Supercode on their projects**—installing the CLI, initializing a workspace, running tasks, and using workflow packs, memory, and MCP. For **contributing code** to this repository, see [CONTRIBUTING.md](CONTRIBUTING.md) and [DEVELOPING.md](DEVELOPING.md).

## What Supercode Is

Supercode is a **local developer orchestration** tool: it detects your environment, keeps **persisted state** under `.supercode/` in your project, runs **tasks** through a **permission-aware tool** layer, and connects to **workflow packs**, optional **memory**, and **MCP** servers when you configure them.

You drive it from the terminal with the `supercode` command (after install).

## Install The CLI

**Zero-install (recommended to try):**

```bash
npx @nareshdama/supercode --help
```

**Project dependency:**

```bash
npm install @nareshdama/supercode
```

Then use `npx supercode` or add an npm script that calls `supercode`.

**Fresh app from a template:**

```bash
npx @nareshdama/create-supercode my-app
```

## Quick Start

1. **Go to your project directory** (or an empty folder for a new project).

2. **Initialize Supercode state:**

   ```bash
   npx @nareshdama/supercode init
   ```

   This creates `.supercode/` with config, session, task storage, and related layout. For an empty directory it can also scaffold a minimal TypeScript starter.

3. **Inspect what Supercode detected:**

   ```bash
   supercode doctor
   ```

   Use `supercode doctor --json` for machine-readable output (scripts and CI).

4. **Run a task** in one of two ways:

   - One-shot orchestration:

     ```bash
     supercode run "your task description"
     ```

   - Explicit task record:

     ```bash
     supercode task start "your goal"
     ```

5. **List and inspect work:**

   ```bash
   supercode task list
   supercode task show <task-id>
   supercode result list
   supercode result show <result-id>
   ```

## The `.supercode` Directory

After `init`, your project contains a **`.supercode/`** folder. Supercode stores configuration, session metadata, tasks, progress, results, optional memory, plans, and artifacts there. Treat it as **project-local state** (version control: ignore or commit depending on your team policy; many teams gitignore it except for shared config snippets).

- **`--force` on `init`** refreshes Supercode-managed files under `.supercode/` without overwriting your normal project files (for example `package.json` or `src/`).

## Doctor And Session

- **`supercode doctor`**: summarizes host, model, project, verification level, recommended workflow packs, and MCP-related signals.
- **`supercode session show`**: inspects current session-oriented state the CLI exposes.

Use **`supercode permission show`** to review permission decisions logged for the workspace.

## Tasks: Run Versus Task Commands

- **`supercode run [task]`** runs a task through the workflow and executor path (hooks, plans, tools, results).
- **`supercode task start <goal>`** creates a tracked task you can list, show, **cancel**, **retry**, or **resume** after failures.

Recovery:

- **`supercode task retry <task-id> [--force]`** — re-run from a stored plan.
- **`supercode task resume <task-id>`** — continue from stored progress and skip completed steps where applicable.

## Workflow Packs, Skills, And Rules

Supercode ships **workflow packs** (bundled guidance). You can list, install, sync, and get recommendations:

```bash
supercode pack list
supercode pack recommend
supercode pack recommend --apply
supercode pack install <pack-id>
supercode pack uninstall <pack-id>
supercode pack sync
```

Search curated content:

```bash
supercode skill search <query>
supercode rule search <query>
```

## Optional Memory

Memory is **off by default**. Enable it in `.supercode/config.json` under the `memory` block, then use:

```bash
supercode memory list [query]
supercode memory show <memory-id>
```

A step-by-step tutorial: [examples/memory-enabled-runtime/README.md](examples/memory-enabled-runtime/README.md).

## Model Commands

If you use the model control plane features:

```bash
supercode model list
supercode model status
```

## MCP (Model Context Protocol)

Configure MCP in your project (see project docs and `.mcp.json` conventions). Then:

```bash
supercode mcp list
supercode mcp invoke <server-id> <tool-name> [json-args]
```

MCP calls go through the same permission and runtime boundaries as other tools.

## Extensions And Plugins

- **`supercode extension list`** and **`supercode extension validate`** — generated extensions and validation.
- **`supercode plugin list`** — discover local plugins.
- Some plugins register **top-level commands**: `supercode <plugin-command> [args]`.

## Embedding In Your Own App

If you build a **host application** in Node and need the same persisted runtime as the CLI (not the interactive terminal), use the **`@nareshdama/supercode/runtime`** package subpath. That flow is **ESM-only** and is documented in [DEVELOPING.md](DEVELOPING.md#programmatic-embedding) and [examples/programmatic-runtime/README.md](examples/programmatic-runtime/README.md).

## Tutorials And Examples

The maintained walkthroughs live under [examples/README.md](examples/README.md):

- Minimal CLI usage
- Memory-enabled flow
- Plugin and extension workflow
- Programmatic runtime from Node

## Safety And Permissions

Supercode defaults to **conservative** permission behavior for sensitive categories (shell, network, MCP). Review [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the threat model and residual risks. You are still responsible for what you approve in **prompt** mode and for **plugin** code you enable.

## Release Checks (Advanced)

If you maintain a fork or release from source:

```bash
supercode release check [--json] [--skip-gates]
```

Most users do not need this day to day.

## Full Command List

The exact set of commands is maintained in the root [README.md](README.md) under **CLI Commands** and must match `supercode help` for each release.

## Where To Go Next

| Need | Document |
|------|----------|
| Repo status and roadmap | [STATUS.md](STATUS.md), [ROADMAP.md](ROADMAP.md) |
| What this project is / is not | [PROJECT-SCOPE.md](PROJECT-SCOPE.md) |
| Contributor workflow | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Monorepo and embedding API | [DEVELOPING.md](DEVELOPING.md) |
| Agent handoff / current focus | [HANDOFF.md](HANDOFF.md) |
