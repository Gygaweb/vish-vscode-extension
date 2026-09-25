# Implementation Plan: Workspace Task Discovery

**Branch**: `001-task-discovery` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-task-discovery/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Add local search, filters, source-file grouping, and stale-source handling to the existing Vish task tree. Reuse the current task store, source references, synchronization pass, and native VS Code tree APIs; do not add dependencies or a second storage layer.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 6 targeting ES2022; VS Code extension runtime

**Primary Dependencies**: VS Code Extension API 1.138, esbuild, Mocha/assert through the existing test runner

**Storage**: Existing workspace-scoped `workspaceState` task store

**Testing**: TypeScript checks, ESLint, compiled VS Code extension tests

**Target Platform**: VS Code 1.138+ on supported desktop platforms

**Project Type**: VS Code desktop extension with a native sidebar tree view

**Performance Goals**: Filtering and grouping should be synchronous over the loaded task list and complete without a visible delay for 100 tasks.

**Constraints**: Workspace-only discovery; preserve manual tasks; preserve existing source identity and `@vish` ordering; no new runtime dependency; never package `.env`.

**Scale/Scope**: One active workspace and its existing task list; initial feature targets approximately 100 visible tasks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file is still the repository template with no ratified principles or enforceable gates. No gate violations are introduced: the design reuses existing storage and UI patterns, keeps the feature local, and adds focused tests.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── extension.ts
└── test/extension.test.ts
package.json
README.md
CHANGELOG.md
```

**Structure Decision**: Keep the implementation in the existing single extension module because the task store, scanner, provider, and commands already share one execution path. Keep parser/view-state helpers close to `src/extension.ts`; extend the existing integration tests in `src/test/extension.test.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | Existing provider and workspace state are sufficient. |
