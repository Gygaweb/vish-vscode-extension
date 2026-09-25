# Changelog

All notable changes to the Vish extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2026-09-25

- Add task search, priority/status filters, and grouping by source file.
- Preserve missing source tasks as stale until explicit cleanup.
- Document the workflow with a static usage illustration.

## [0.0.4] - 2026-09-25

- Add task context actions to edit, open the source line, delete, complete, and copy.
- Keep source-backed task actions synchronized with the workspace code.

## [0.0.3] - 2026-09-22

- Detect `@todo` and `@vish` markers in the current workspace automatically.
- Prioritize `@vish` tasks chronologically with yellow, bold highlighting.

## [0.0.2] - 2026-09-22

### Added

- VS Code sidebar for adding, completing, copying, deleting and refreshing workspace tasks.
- Persistent task storage in the current workspace.
- Confirmation before deleting tasks and feedback when a task is completed.
- Customizable keyboard shortcuts for the main task actions.
- MIT license for the project.

[unreleased]: https://github.com/Gygaweb/vish-vscode-extension/commits/main
[0.0.5]: https://github.com/Gygaweb/vish-vscode-extension/releases/tag/v0.0.5
[0.0.4]: https://github.com/Gygaweb/vish-vscode-extension/releases/tag/v0.0.4
[0.0.3]: https://github.com/Gygaweb/vish-vscode-extension/releases/tag/v0.0.3
[0.0.2]: https://github.com/Gygaweb/vish-vscode-extension/releases/tag/v0.0.2
