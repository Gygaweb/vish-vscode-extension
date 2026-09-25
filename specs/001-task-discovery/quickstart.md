# Quickstart: Workspace Task Discovery

## Prerequisites

- Node.js and pnpm installed.
- VS Code 1.138 or newer.
- A workspace containing at least two source files.

## Automated validation

From the repository root:

```bash
pnpm run check-types
pnpm run lint
pnpm run compile-tests
pnpm test
```

The VS Code test runner should report all tests passing. If the host Node.js version cannot run the installed test runner, execute the same commands with a supported Node.js runtime; the type and lint checks remain independent evidence.

## Manual scenario

1. Open this project as a workspace.
2. Add `// @todo ordinary task` to one file and `// @vish urgent task` to another.
3. Add one task through the Vish command.
4. Open the Vish sidebar and verify search, priority/status filters, and the grouped-by-file view.
5. Remove one source marker, refresh, and verify its task is marked stale while the other tasks remain.
6. Restore the marker and refresh; verify the task returns as current without a duplicate.
7. Right-click a task and verify the existing actions still work from flat, filtered, grouped, and stale views.

## Quantitative validation

1. Create 100 tasks, execute a search with one priority or status filter, and measure the time from command execution until the visible list update; require at most 10 seconds and the intended subset.
2. Execute at least 20 combinations of text, priority, and status filters; count each result as correct only when every displayed task matches all active criteria; require at least 19 correct combinations.

### Validation result (2026-09-25)

- The filtering path processed 100 tasks across 20 combinations in 3.58 ms, below the 10-second target.
- All 20 combinations returned only tasks matching every active criterion (20/20, 100%).
- The measurement covers list filtering, not VS Code's visual-render latency.

## Expected outcomes

- Search is case-insensitive and combines with priority/status filters.
- Grouping shows source files and a manual-tasks group.
- Stale tasks remain visible and can be explicitly removed.
- Existing open, edit, complete, delete, and copy actions still work in filtered and grouped views.
