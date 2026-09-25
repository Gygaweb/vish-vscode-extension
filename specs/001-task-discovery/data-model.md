# Data Model: Workspace Task Discovery

## Task

Existing workspace task record extended conceptually with a derived lifecycle state.

- `id`: stable task identity.
- `text`: displayed task text.
- `done`: completion state.
- `priority`: `todo` or `vish` for discovered tasks; absent for manual tasks.
- `source`: optional source reference for discovered tasks.
- `stale`: derived when `source` cannot be found in the current workspace content; it must not be treated as completed.

## Source Reference

- `uri`: workspace file identity.
- `line`: zero-based marker line.
- `character`: zero-based marker position on that line.
- `tag`: normalized marker type, `todo` or `vish`.

## Task View

Presentation-only state, not part of the task record:

- `query`: empty or case-insensitive text search term.
- `priorityFilter`: all, todo, or vish.
- `statusFilter`: all, pending, completed, or stale.
- `groupByFile`: boolean.

## Rules

- Manual tasks have no source and are never stale.
- A current source task remains linked to its source reference and retains completion state.
- A stale source task remains visible until explicit removal or successful source reconciliation.
- Filtering and grouping do not mutate task records.
