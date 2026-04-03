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
- Recorded at `2026-04-03T00:17:40.877Z`
- Sample count per scenario: `3`

| Scenario | Min (ms) | Avg (ms) | Max (ms) |
| --- | ---: | ---: | ---: |
| `doctor --json` | `0.95` | `1.97` | `3.88` |
| `extension validate` | `0.22` | `0.40` | `0.73` |
| `mcp list` | `3.56` | `4.27` | `5.46` |
| `run "profile baseline"` | `20.65` | `22.64` | `25.18` |
| `result list` after one run | `4.75` | `7.34` | `12.49` |

Interpretation:
- This baseline is intended as a regression detector, not a cross-machine benchmark.
- Because the profiler imports the built CLI module directly, these timings emphasize Supercode runtime overhead more than process-launch overhead.
- Large deviations should be investigated before release, especially for `doctor`, `run`, and `extension validate`.
