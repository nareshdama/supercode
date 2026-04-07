# Current Goal: Post-Release Stabilization

`0.1.0` is now shipped. The next goal is to stabilize the published line, improve contributor and developer onboarding, and prepare the repository for low-friction patch releases.

Objective:

- make the published `0.1.x` line easier to maintain, adopt, and extend safely

Immediate priorities:

- keep `npm run build`, `npm test`, `npm run coverage:gate`, `npm run profile:baseline`, `npm run smoke:phase7`, and `npm run verify:docs` green before any patch release
- maintain the top-level docs set: [USER-GUIDE.md](USER-GUIDE.md), [CONTRIBUTING.md](CONTRIBUTING.md), [DEVELOPING.md](DEVELOPING.md), [PROJECT-SCOPE.md](PROJECT-SCOPE.md), [ROADMAP.md](ROADMAP.md), [README.md](README.md), [STATUS.md](STATUS.md), [SECURITY-REVIEW.md](SECURITY-REVIEW.md), and [PERFORMANCE-BASELINE.md](PERFORMANCE-BASELINE.md) when behavior or baselines change
- validate published package contents and install paths whenever package metadata or release scripts change
- continue MCP and plugin adversarial coverage as the highest-value hardening stream after launch

Near-term outcomes:

- cleaner patch-release workflow
- less docs drift between public package behavior and repo docs
- better contributor onboarding
- better guidance for teams embedding the runtime packages (canonical entry: `@nareshdama/supercode/runtime`; see [DEVELOPING.md](DEVELOPING.md#programmatic-embedding) and [docs/reference-notes/programmatic-embedding.md](docs/reference-notes/programmatic-embedding.md))

Notes:

- The next roadmap phases are now tracked in [ROADMAP.md](ROADMAP.md).
