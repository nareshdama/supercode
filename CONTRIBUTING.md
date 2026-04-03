# Contributing To Supercode

## Purpose

This repository ships the Supercode runtime, CLI, scaffolder, and supporting packages. Contributions should improve shipped behavior, test coverage, packaging quality, documentation accuracy, or roadmap execution.

## Before You Change Code

- Read [README.md](README.md) for the current public surface.
- Read [STATUS.md](STATUS.md) for the current project state.
- Read [PROJECT-SCOPE.md](PROJECT-SCOPE.md) to stay inside the intended product boundary.
- Read [DEVELOPING.md](DEVELOPING.md) for package layout, commands, and release workflow.

## Local Setup

```bash
npm install
npm run build
npm test
```

Useful commands:

```bash
npm run verify:docs
npm run coverage:gate
npm run profile:baseline
npm run smoke:phase7
```

## Contribution Rules

- Keep changes scoped to one objective.
- Add or update tests when behavior changes.
- Update docs when public behavior, package names, commands, or release steps change.
- Preserve package boundaries instead of reaching across the monorepo ad hoc.
- Do not mix unrelated cleanup into feature or bug-fix changes.

## Pull Request Expectations

Each contribution should clearly answer:

- What changed
- Why the change is needed
- What packages or commands are affected
- What verification was run
- What docs were updated

## Verification Expectations

Minimum expectations depend on the change:

- Code changes: `npm test`
- Public CLI or docs changes: `npm run verify:docs`
- Packaging or install-flow changes: `npm run smoke:phase7`
- Release-sensitive changes: run the full release gate from [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)

## Docs To Keep In Sync

- [README.md](README.md)
- [STATUS.md](STATUS.md)
- [NEXT-GOAL.md](NEXT-GOAL.md)
- [ROADMAP.md](ROADMAP.md)
- [PROJECT-SCOPE.md](PROJECT-SCOPE.md)
- package-level and example READMEs when install or usage changes

## Package And Release Notes

- Published package names are scoped under `@nareshdama/*`.
- The CLI binary remains `supercode`.
- The scaffolder binary remains `create-supercode`.
- If a package version is already on npm, do not attempt to republish it. Publish a new version instead.

## Code Of Working

- Prefer small, reviewable patches.
- Prefer evidence from tests, docs, and concrete runtime behavior.
- Treat MCP, permissions, filesystem access, and packaging as high-sensitivity areas.
- Leave the repo in a releasable state when possible.
