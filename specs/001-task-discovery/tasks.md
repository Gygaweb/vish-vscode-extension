---

description: "Implementation tasks for Workspace Task Discovery"
---

# Tasks: Workspace Task Discovery

**Input**: Design documents from `/specs/001-task-discovery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included because the feature changes task parsing, synchronization, filtering, and tree rendering.

**Organization**: Tasks are grouped by user story and execute sequentially because the existing provider and command flow live in `src/extension.ts`.

## Phase 1: Setup

- [X] T001 Verify the existing VS Code extension scripts and test entry points in `package.json` and preserve the no-new-dependency constraint.

## Phase 2: Foundational

- [X] T002 Add task view state types and stale-task state rules in `src/extension.ts` based on `data-model.md`.
- [X] T003 Extend task-tree test fixtures and helpers in `src/test/extension.test.ts` for view filtering, grouping, and stale reconciliation.

## Phase 3: User Story 1 - Find relevant tasks quickly (Priority: P1) 🎯 MVP

**Goal**: Search and filter the task list without mutating stored task data.

**Independent Test**: Search a mixed list of tasks and apply priority/status filters; only matching tasks remain, and clearing the view restores the normal list.

- [X] T004 [US1] Add failing tests for case-insensitive query matching, priority/status filters, and distinct filtered empty state in `src/test/extension.test.ts`.
- [X] T005 [US1] Implement pure task-view filtering and normal priority-preserving ordering in `src/extension.ts`.
- [X] T006 [US1] Add native command-palette/view-title actions for search, priority filter, status filter, and clearing view state in `package.json` and `src/extension.ts`.
- [X] T007 [US1] Refresh the tree after each view-state change and preserve existing task commands in `src/extension.ts`.

## Phase 4: User Story 2 - Understand tasks by source file (Priority: P2)

**Goal**: Present discovered tasks under source-file groups while keeping manual tasks identifiable.

**Independent Test**: Group tasks from two files plus a manual task, inspect each group, then disable grouping and verify the flat list and task state are unchanged.

- [X] T008 [US2] Add failing tests for source-file groups, manual-task grouping, group collapse/expand, and flat-view restoration in `src/test/extension.test.ts`.
- [X] T009 [US2] Add group tree elements and grouped child rendering while preserving task context commands in `src/extension.ts`.
- [X] T010 [US2] Add the group-by-file toggle command and view-title contribution in `package.json` and `src/extension.ts`.

## Phase 5: User Story 3 - Handle stale source tasks safely (Priority: P3)

**Goal**: Keep missing source tasks visible as stale and provide explicit stale-task removal.

**Independent Test**: Remove a source marker, refresh, verify stale status, restore it without duplication, and remove only stale entries through the explicit action.

- [X] T011 [US3] Add failing tests for missing source markers, missing files, restored source identity, and stale-only removal in `src/test/extension.test.ts`.
- [X] T012 [US3] Update workspace synchronization to retain missing source tasks as stale and reconcile restored source references in `src/extension.ts`.
- [X] T013 [US3] Render stale status and add the stale-task cleanup command/menu in `package.json` and `src/extension.ts`.
- [X] T014 [US3] Verify existing open, edit, complete, delete, and copy commands remain safe for filtered, grouped, and stale task items in `src/extension.ts` and `src/test/extension.test.ts`.

## Phase 6: Polish and cross-cutting concerns

- [X] T015 [P] Add search/filter/group/stale usage instructions and the static usage illustration in `README.md` and `docs/usage.svg`.
- [X] T016 [P] Update feature notes and validation scenarios in `CHANGELOG.md` and `specs/001-task-discovery/quickstart.md`.
- [X] T017 Run `pnpm run check-types`, `pnpm run lint`, `pnpm run compile-tests`, `pnpm test`, and `git diff --check` from the repository root.
- [X] T018 Execute the quantitative validation for SC-001 and SC-002 from `specs/001-task-discovery/quickstart.md` and record the timing and correctness results.

## Dependencies and Execution Order

- Phase 1 precedes Phase 2.
- Phase 2 blocks all user stories.
- User Story 1 is the MVP and precedes User Story 2 because grouping renders the filtered task view.
- User Story 3 follows the existing source synchronization contract and can begin after foundational types, but is executed after US1 and US2 because it changes the same provider path.
- Polish tasks T015 and T016 are parallel with each other after feature behavior is complete; T017 runs before the manual quantitative validation T018.

## Parallel Opportunities

- T015 and T016 can run in parallel because they edit different documentation files.
- No implementation tasks are marked parallel because they share `src/extension.ts` or `src/test/extension.test.ts`.

## Implementation Strategy

1. Complete setup and foundational state definitions.
2. Deliver User Story 1 as the MVP and validate it independently.
3. Add grouping without changing task persistence.
4. Add stale reconciliation and explicit cleanup.
5. Update documentation, run the full validation gate, and review the final diff.
