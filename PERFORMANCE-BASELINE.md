# Performance Baseline

This document records the **profiling regression baseline** for local CLI flows (established in Phase 8, maintained in Phase 9+). Re-run `npm run profile:baseline` after meaningful CLI or runtime performance work and update the **Latest baseline** section below.

Related: [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md), [STATUS.md](STATUS.md).

Method:
- Build the repo with `npm run build`
- Run `npm run profile:baseline`
- Measure three samples per scenario
- Report `min`, `avg`, and `max` wall-clock duration in milliseconds
- Use the built CLI module in-process to profile core command execution paths with minimal shell-launch overhead

Scenarios:
- `doctor --json` in the repository root
- `extension validate` in a freshly initialized project
- `mcp list` in a freshly initialized project
- `run "profile baseline"` in a freshly initialized project
- `result list` after one `run`

Latest baseline:
- Recorded at `2026-04-03T00:20:46.498Z`
- Sample count per scenario: `3`

| Scenario | Min (ms) | Avg (ms) | Max (ms) |
| --- | ---: | ---: | ---: |
| `doctor --json` | `1.05` | `1.89` | `3.54` |
| `extension validate` | `0.22` | `0.36` | `0.62` |
| `mcp list` | `3.85` | `4.19` | `4.84` |
| `run "profile baseline"` | `21.44` | `22.33` | `23.58` |
| `result list` after one run | `4.08` | `7.26` | `12.13` |

Interpretation:
- This baseline is intended as a regression detector, not a cross-machine benchmark.
- Because the profiler imports the built CLI module directly, these timings emphasize Supercode runtime overhead more than process-launch overhead.
- Large deviations should be investigated before release, especially for `doctor`, `run`, and `extension validate`.
