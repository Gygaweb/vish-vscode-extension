# Feature Specification: Workspace Task Discovery

**Feature Branch**: `001-task-discovery`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Add workspace task search, filters, grouping by source file, and stale task detection for the Vish task list"

## User Scenarios & Testing

### User Story 1 - Find relevant tasks quickly (Priority: P1)

A developer can search and filter the Vish task list to focus on the work that matters now instead of scanning every task manually.

**Why this priority**: Search and filtering provide immediate value in every workspace with more than a few tasks and are the smallest useful improvement to task navigation.

**Independent Test**: Create tasks with different text, tags, and completion states; search for text and apply each filter; verify that only matching tasks remain and clearing filters restores the full list.

**Acceptance Scenarios**:

1. **Given** a workspace with pending and completed tasks, **When** the user searches for a case-insensitive text fragment, **Then** the list shows only tasks whose displayed text contains that fragment.
2. **Given** tasks created from both supported markers, **When** the user filters by priority, **Then** only tasks with the selected marker priority are shown.
3. **Given** pending and completed tasks, **When** the user filters by status, **Then** the list shows only tasks in the selected status.
4. **Given** an active search or filter, **When** the user clears it, **Then** all current tasks are visible again in their normal priority order.

### User Story 2 - Understand tasks by source file (Priority: P2)

A developer can group discovered tasks by their source file and distinguish tasks created manually from tasks found in workspace code.

**Why this priority**: File grouping turns a flat list into an actionable view for code review and refactoring work without changing the existing task lifecycle.

**Independent Test**: Create tasks in at least two files plus one manual task; enable grouping; verify each source file has its own group and the manual task appears under a clearly identified group.

**Acceptance Scenarios**:

1. **Given** discovered tasks in multiple files, **When** the user enables grouping by file, **Then** tasks appear under their respective file groups.
2. **Given** a manually created task without a source file, **When** grouping is enabled, **Then** it appears under a group identifying it as manually created.
3. **Given** grouped tasks, **When** the user disables grouping, **Then** the existing flat list view returns without changing task state or ordering rules.

### User Story 3 - Handle stale source tasks safely (Priority: P3)

A developer can identify tasks whose source marker no longer exists and remove those stale entries intentionally, without losing valid manual or discovered tasks.

**Why this priority**: Source files change frequently; stale entries reduce trust in the list, but automatic deletion could hide work the developer still wants to track.

**Independent Test**: Create a discovered task, remove its marker from the source file, refresh the workspace, and verify the task is visibly marked stale and can be removed explicitly while unrelated tasks remain.

**Acceptance Scenarios**:

1. **Given** a discovered task whose source file or marker is missing, **When** the workspace is refreshed, **Then** the task remains visible with a stale status and cannot be mistaken for a current source task.
2. **Given** a stale task, **When** the user chooses the stale-task removal action, **Then** that stale entry is removed and valid tasks remain unchanged.
3. **Given** a stale task, **When** the source marker is restored at the same location, **Then** the task becomes current again without creating a duplicate.

## Edge Cases

- An empty search query and an “all” filter must behave like no filtering.
- Search and filters that match no task must show an explicit empty-state message rather than the general “no tasks” message.
- A file can contain multiple markers on one line; each marker remains an independent task.
- A source file can be renamed or deleted; its discovered tasks must be marked stale rather than silently removed.
- A workspace can contain no tasks, only manual tasks, or only discovered tasks.
- Filtering and grouping must not change completion state, source location, task priority, or manual-task persistence.

## Requirements

### Functional Requirements

- **FR-001**: The task list MUST provide case-insensitive text search over displayed task text.
- **FR-002**: The task list MUST provide a priority filter for `@vish`, `@todo`, and all priorities.
- **FR-003**: The task list MUST provide a status filter for pending, completed, stale, and all statuses.
- **FR-004**: The task list MUST allow the user to clear search, filters, and grouping without changing stored tasks.
- **FR-005**: The task list MUST support a grouped view organized by source file.
- **FR-006**: Tasks without a source file MUST appear in a clearly labeled manual-tasks group when grouping is enabled.
- **FR-007**: The system MUST identify discovered tasks whose source file or exact marker is missing as stale.
- **FR-008**: The system MUST preserve stale tasks until the user explicitly removes them or the source marker is restored.
- **FR-009**: Removing stale tasks MUST affect only stale entries and MUST preserve valid discovered and manual tasks.
- **FR-010**: A restored source marker MUST reconcile with its existing task identity rather than create a duplicate.
- **FR-011**: Existing actions for opening, editing, completing, deleting, and copying tasks MUST continue to work for filtered and grouped results.
- **FR-012**: The list MUST show distinct empty states for no tasks and no tasks matching the current search or filters.

### Key Entities

- **Task**: A pending or completed unit of work, either manually created or discovered from a workspace marker; includes text, priority, status, and optional source location.
- **Task View**: The current presentation state of the task list, including search text, selected filters, and whether grouping is enabled.
- **Source Reference**: The workspace file and marker position associated with a discovered task; determines whether the task is current or stale.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a validation with 100 tasks, search plus one filter must return the intended subset in at most 10 seconds, measured from command execution until the visible list update.
- **SC-002**: In a validation of at least 20 combinations of text, priority, and status filters, at least 19 results must contain only tasks matching every active criterion.
- **SC-003**: A user can identify the source file for every current discovered task from the grouped view without opening unrelated files.
- **SC-004**: Removing a source marker never removes an unrelated valid task or manual task in validation scenarios.
- **SC-005**: Existing task actions remain usable for 100% of tasks shown in flat, filtered, and grouped views.

## Assumptions

- The feature applies only to the currently opened workspace and keeps the existing workspace-scoped task storage.
- Search, filters, and grouping are local presentation controls; they do not change source files or task content.
- Stale tasks are retained by default so developers do not lose intentional work items.
- The existing marker syntax and `@vish` priority rules remain unchanged.
- Synchronization occurs through the existing refresh and workspace-change behavior.
