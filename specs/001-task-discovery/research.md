# Research: Workspace Task Discovery

## Decision: Reuse the native tree provider for search and filters

**Rationale**: The extension already owns a `TreeDataProvider` and refresh event. Filtering the stored task array before creating tree items keeps the feature local, dependency-free, and compatible with existing context commands.

**Alternatives considered**: A webview would allow richer controls but adds a second renderer and synchronization surface without being needed for this MVP.

## Decision: Keep view state separate from task state

**Rationale**: Search text, selected filters, and grouping are presentation choices. Keeping them outside the task records prevents filtering from mutating completion, source, or priority data.

**Alternatives considered**: Persisting view state in every task would duplicate data and make task migrations harder.

## Decision: Mark stale source tasks instead of deleting them

**Rationale**: A deleted or moved marker may represent intentional work that should not disappear. A stale state lets the user decide while preserving manual tasks and valid source tasks.

**Alternatives considered**: Automatically deleting missing source tasks is simpler but loses user-visible work and makes synchronization destructive.

## Decision: Use the existing source reference as the reconciliation identity

**Rationale**: Existing tasks already carry workspace URI, line, character, and tag. Reusing that identity avoids duplicate records when a marker is restored and avoids new persistence fields unless implementation proves one is required.

**Alternatives considered**: Hashing full file contents would be unstable under unrelated edits and would not preserve the current task contract.

## Decision: No external contract artifact

**Rationale**: This is a local VS Code UI feature with no public API, network endpoint, or inter-process contract.
