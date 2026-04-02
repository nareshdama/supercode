# Performance Baseline

This document records the Phase 8 profiling baseline for the current local CLI flows.

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
- Recorded at `2026-04-02T15:35:44.464Z`
- Sample count per scenario: `3`

| Scenario | Min (ms) | Avg (ms) | Max (ms) |
| --- | ---: | ---: | ---: |
| `doctor --json` | `0.78` | `1.63` | `3.30` |
| `extension validate` | `0.17` | `0.31` | `0.59` |
| `mcp list` | `2.78` | `3.22` | `3.72` |
| `run "profile baseline"` | `14.89` | `16.01` | `18.22` |
| `result list` after one run | `3.45` | `5.82` | `10.07` |

Interpretation:
- This baseline is intended as a regression detector, not a cross-machine benchmark.
- Because the profiler imports the built CLI module directly, these timings emphasize Supercode runtime overhead more than process-launch overhead.
- Large deviations should be investigated before release, especially for `doctor`, `run`, and `extension validate`.
