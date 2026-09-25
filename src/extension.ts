import * as vscode from 'vscode';

export interface TaskSource {
    uri: string;
    line: number;
    character: number;
    tag: 'todo' | 'vish';
}

export interface Task {
    id: string;
    text: string;
    done: boolean;
    priority?: 'todo' | 'vish';
    source?: TaskSource;
    stale?: boolean;
}

export type TaskPriorityFilter = 'all' | 'todo' | 'vish';
export type TaskStatusFilter = 'all' | 'pending' | 'completed' | 'stale';

export interface TaskViewState {
    query: string;
    priority: TaskPriorityFilter;
    status: TaskStatusFilter;
    groupByFile: boolean;
}

export interface TaskGroup {
    key: string;
    tasks: Task[];
}

type TaskReference = Task | TaskItem;

const TASKS_KEY = 'workspace-todo.tasks';
const TAG_PATTERN = /(?<![\p{L}\p{N}_])@(todo|vish)(?![\p{L}\p{N}_])/giu;

function cleanTaskText(text: string, fallback: string): string {
    const cleaned = text.replace(/^\s*[:=\-–—]+\s*/, '').trim();
    return cleaned || fallback.trim();
}

export function parseTaggedTasks(text: string, uri = ''): Task[] {
    const tasks: Task[] = [];

    text.split(/\r?\n/).forEach((line, lineNumber) => {
        const matches = [...line.matchAll(TAG_PATTERN)];
        matches.forEach((match, index) => {
            const tag = match[0].slice(1).toLowerCase() as 'todo' | 'vish';
            const character = match.index ?? 0;
            const nextCharacter = matches[index + 1]?.index ?? line.length;
            const source = { uri, line: lineNumber, character, tag };
            tasks.push({
                id: `auto:${uri}:${lineNumber}:${character}`,
                text: cleanTaskText(line.slice(character + match[0].length, nextCharacter), line),
                done: false,
                priority: tag,
                source,
            });
        });
    });

    return tasks;
}

export function sortTasks(tasks: Task[]): Task[] {
    return tasks
        .map((task, index) => ({ task, index }))
        .sort((a, b) => {
            const aVish = a.task.priority === 'vish' || a.task.source?.tag === 'vish';
            const bVish = b.task.priority === 'vish' || b.task.source?.tag === 'vish';
            if (aVish !== bVish) {
                return aVish ? -1 : 1;
            }
            if (aVish && bVish) {
                const aSource = a.task.source;
                const bSource = b.task.source;
                if (aSource && bSource) {
                    return aSource.uri.localeCompare(bSource.uri) ||
                        aSource.line - bSource.line ||
                        aSource.character - bSource.character;
                }
            }
            return a.index - b.index;
        })
        .map(({ task }) => task);
}

export function filterTasks(tasks: Task[], view: TaskViewState): Task[] {
    const query = view.query.trim().toLocaleLowerCase();
    return sortTasks(tasks).filter(task => {
        const matchesQuery = !query || task.text.toLocaleLowerCase().includes(query);
        const matchesPriority = view.priority === 'all' || task.priority === view.priority;
        const matchesStatus = view.status === 'all' ||
            (view.status === 'stale' && task.stale) ||
            (view.status === 'completed' && task.done && !task.stale) ||
            (view.status === 'pending' && !task.done && !task.stale);
        return matchesQuery && matchesPriority && matchesStatus;
    });
}

export function groupTasks(tasks: Task[]): TaskGroup[] {
    const groups = new Map<string, Task[]>();
    for (const task of sortTasks(tasks)) {
        const key = task.source?.uri ?? 'manual';
        groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    return [...groups].map(([key, groupedTasks]) => ({ key, tasks: groupedTasks }));
}

function sourceKey(source?: TaskSource): string | undefined {
    return source && `${source.uri}:${source.line}:${source.character}`;
}

export function reconcileTaggedTasks(previousTasks: Task[], discoveredTasks: Task[]): Task[] {
    const previousBySource = new Map(
        previousTasks.filter(task => task.source).map(task => [sourceKey(task.source), task]),
    );
    const discoveredKeys = new Set(discoveredTasks.map(task => sourceKey(task.source)));
    const currentTasks = discoveredTasks.map(task => {
        const previous = previousBySource.get(sourceKey(task.source));
        return previous ? { ...task, id: previous.id, done: previous.done, stale: false } : task;
    });
    const manualTasks = previousTasks.filter(task => !task.source);
    const staleTasks = previousTasks
        .filter(task => task.source && !discoveredKeys.has(sourceKey(task.source)))
        .map(task => ({ ...task, stale: true }));
    return [...manualTasks, ...currentTasks, ...staleTasks];
}

async function scanWorkspaceTasks(): Promise<Task[]> {
    if (!vscode.workspace.workspaceFolders?.length) {
        return [];
    }

    const files = await vscode.workspace.findFiles(
        '**/*',
        '**/{node_modules,.git,dist,out,.vscode}/**',
    );
    files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));

    const tasks: Task[] = [];
    for (const file of files) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            tasks.push(...parseTaggedTasks(document.getText(), file.toString()));
        } catch {
            // Ignore files VS Code cannot decode as text.
        }
    }
    return tasks;
}

async function synchronizeTaggedTasks(context: vscode.ExtensionContext): Promise<void> {
    const currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
    const taggedTasks = await scanWorkspaceTasks();
    await context.workspaceState.update(TASKS_KEY, reconcileTaggedTasks(currentTasks, taggedTasks));
}

function getSourceRange(document: vscode.TextDocument, source: TaskSource, includeMarker: boolean): vscode.Range | undefined {
    if (source.line >= document.lineCount) {
        return undefined;
    }

    const line = document.lineAt(source.line).text;
    const matches = [...line.matchAll(TAG_PATTERN)];
    const matchIndex = matches.findIndex(match => match.index === source.character);
    const match = matches[matchIndex];
    if (!match || match.index === undefined) {
        return undefined;
    }

    const end = matches[matchIndex + 1]?.index ?? line.length;
    const start = includeMarker ? match.index : match.index + match[0].length;
    return new vscode.Range(source.line, start, source.line, end);
}

async function updateSourceTask(task: Task, text: string): Promise<boolean> {
    if (!task.source) {
        return false;
    }

    const uri = vscode.Uri.parse(task.source.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const range = getSourceRange(document, task.source, false);
    if (!range) {
        return false;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, range, ` ${text}`);
    return vscode.workspace.applyEdit(edit);
}

async function removeSourceTask(task: Task): Promise<boolean> {
    if (!task.source) {
        return false;
    }

    const uri = vscode.Uri.parse(task.source.uri);
    const document = await vscode.workspace.openTextDocument(uri);
    const range = getSourceRange(document, task.source, true);
    if (!range) {
        return false;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.delete(uri, range);
    return vscode.workspace.applyEdit(edit);
}

type TreeElement = TaskItem | TaskGroupItem;

// 1. Classe que fornece os dados para a Barra Lateral
class TaskTreeProvider implements vscode.TreeDataProvider<TreeElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | void> = new vscode.EventEmitter<TreeElement | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | void> = this._onDidChangeTreeData.event;
    private viewState: TaskViewState = { query: '', priority: 'all', status: 'all', groupByFile: false };

    constructor(private context: vscode.ExtensionContext) {}

    // Recarrega a barra lateral
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeElement): vscode.TreeItem {
        return element;
    }

    setViewState(changes: Partial<TaskViewState>): void {
        this.viewState = { ...this.viewState, ...changes };
        this.refresh();
    }

    getViewState(): TaskViewState {
        return this.viewState;
    }

    getChildren(element?: TreeElement): Thenable<TreeElement[]> {
        if (element instanceof TaskGroupItem) {
            return Promise.resolve(element.tasks.map(task => this.createTaskItem(task)));
        }

        const allTasks = this.context.workspaceState.get<Task[]>(TASKS_KEY, []);
        const tasks = filterTasks(allTasks, this.viewState);
        if (tasks.length === 0) {
            const emptyText = allTasks.length > 0 ? 'Nenhuma tarefa corresponde aos filtros 🔎' : 'Nenhuma tarefa pendente 🎉';
            return Promise.resolve([new TaskItem({ id: '', text: emptyText, done: false }, '', vscode.TreeItemCollapsibleState.None)]);
        }

        return Promise.resolve(this.viewState.groupByFile
            ? groupTasks(tasks).map(group => new TaskGroupItem(group.key, group.tasks))
            : tasks.map(task => this.createTaskItem(task)));
    }

    private createTaskItem(task: Task): TaskItem {
        const icon = task.stale
            ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'))
            : task.priority === 'vish'
                ? new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'))
                : task.done
                    ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'))
                    : new vscode.ThemeIcon('circle-large-outline');
        return new TaskItem(task, task.id, vscode.TreeItemCollapsibleState.None, icon, task.done, {
            command: 'workspace-todo.toggleTask',
            title: 'Alternar Status',
            arguments: [task]
        });
    }
}

class TaskGroupItem extends vscode.TreeItem {
    constructor(public readonly key: string, public readonly tasks: Task[]) {
        const label = key === 'manual' ? 'Tarefas manuais' : vscode.workspace.asRelativePath(vscode.Uri.parse(key), false);
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'taskGroup';
        this.description = `${tasks.length} tarefa(s)`;
    }
}

// 2. Elemento visual de cada linha na barra lateral
class TaskItem extends vscode.TreeItem {
    constructor(
        task: Task,
        public readonly id: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly done?: boolean,
        public readonly command?: vscode.Command
    ) {
        super({ label: task.text, highlights: task.priority === 'vish' ? [[0, task.text.length]] : undefined }, collapsibleState);
        this.contextValue = id ? (task.stale ? 'taskStale' : done ? 'taskDone' : 'task') : undefined;
        this.tooltip = task.source ? `${task.text} (${task.source.tag.toUpperCase()})` : task.text;
        this.description = task.stale ? 'Obsoleta' : this.done ? 'Concluída' : 'Pendente';
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Instancia e registra o provedor da barra lateral
    const taskProvider = new TaskTreeProvider(context);
    const taskTree = vscode.window.createTreeView('vish-tasks', { treeDataProvider: taskProvider });
    let selectedTaskId: string | undefined;
    context.subscriptions.push(taskTree, taskTree.onDidChangeSelection(event => {
        selectedTaskId = event.selection[0]?.id;
    }));

    const selectedTask = (taskClicked?: TaskReference): TaskReference | undefined => taskClicked ??
        (selectedTaskId ? { id: selectedTaskId, text: '', done: false } : undefined);
    const storedTask = (taskClicked?: TaskReference): Task | undefined => {
        const reference = selectedTask(taskClicked);
        return context.workspaceState.get<Task[]>(TASKS_KEY, []).find(task => task.id === reference?.id);
    };

    const searchCmd = vscode.commands.registerCommand('workspace-todo.search', async () => {
        const query = await vscode.window.showInputBox({
            prompt: 'Buscar tarefas',
            value: taskProvider.getViewState().query,
        });
        if (query !== undefined) {
            taskProvider.setViewState({ query });
        }
    });

    const filterPriorityCmd = vscode.commands.registerCommand('workspace-todo.filterPriority', async () => {
        const choice = await vscode.window.showQuickPick([
            { label: 'Todas as prioridades', value: 'all' as TaskPriorityFilter },
            { label: '@vish', value: 'vish' as TaskPriorityFilter },
            { label: '@todo', value: 'todo' as TaskPriorityFilter },
        ], { placeHolder: 'Filtrar por prioridade' });
        if (choice) {
            taskProvider.setViewState({ priority: choice.value });
        }
    });

    const filterStatusCmd = vscode.commands.registerCommand('workspace-todo.filterStatus', async () => {
        const choice = await vscode.window.showQuickPick([
            { label: 'Todos os status', value: 'all' as TaskStatusFilter },
            { label: 'Pendentes', value: 'pending' as TaskStatusFilter },
            { label: 'Concluídas', value: 'completed' as TaskStatusFilter },
            { label: 'Obsoletas', value: 'stale' as TaskStatusFilter },
        ], { placeHolder: 'Filtrar por status' });
        if (choice) {
            taskProvider.setViewState({ status: choice.value });
        }
    });

    const toggleGroupingCmd = vscode.commands.registerCommand('workspace-todo.toggleGrouping', () => {
        taskProvider.setViewState({ groupByFile: !taskProvider.getViewState().groupByFile });
    });

    const clearViewCmd = vscode.commands.registerCommand('workspace-todo.clearView', () => {
        taskProvider.setViewState({ query: '', priority: 'all', status: 'all', groupByFile: false });
    });

    let syncPromise: Promise<void> | undefined;
    const syncTasks = () => {
        syncPromise ??= synchronizeTaggedTasks(context).finally(() => { syncPromise = undefined; });
        return syncPromise;
    };
    const showReminder = () => {
        const pendingTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []).filter(t => !t.done);
        if (pendingTasks.length === 0) {
            return;
        }
        vscode.commands.executeCommand('vish-tasks.focus');
        vscode.window.showInformationMessage(
            `Lembrete: Você tem ${pendingTasks.length} tarefa(s) pendente(s).`,
            'Abrir Vish'
        ).then(selection => {
            if (selection === 'Abrir Vish') {
                vscode.commands.executeCommand('vish-tasks.focus');
            }
        });
    };

    void syncTasks().then(() => {
        taskProvider.refresh();
        showReminder();
    });
    const workspaceWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    const refreshTaggedTasks = () => { void syncTasks().then(() => taskProvider.refresh()); };
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(refreshTaggedTasks),
        workspaceWatcher,
        workspaceWatcher.onDidCreate(refreshTaggedTasks),
        workspaceWatcher.onDidDelete(refreshTaggedTasks),
        workspaceWatcher.onDidChange(refreshTaggedTasks),
    );

    // Comando: Adicionar
    const addTaskCmd = vscode.commands.registerCommand('workspace-todo.addTask', async () => {
        const taskText = await vscode.window.showInputBox({ prompt: 'Digite a nova tarefa' });
        if (taskText) {
            let currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
            currentTasks.push({ id: Date.now().toString(), text: taskText, done: false });
            await context.workspaceState.update(TASKS_KEY, currentTasks);
            taskProvider.refresh(); // Atualiza a barra lateral automaticamente
        }
    });

    // Comando: Alternar status ao clicar no item da barra lateral
    const toggleTaskCmd = vscode.commands.registerCommand('workspace-todo.toggleTask', async (taskClicked?: TaskReference) => {
        const task = storedTask(taskClicked);
        if (!task) {
            return;
        }
        let currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
        const taskIndex = currentTasks.findIndex(t => t.id === task.id);
        
        if (taskIndex > -1) {
            const completing = !currentTasks[taskIndex].done;
            currentTasks[taskIndex].done = !currentTasks[taskIndex].done;
            await context.workspaceState.update(TASKS_KEY, currentTasks);
            taskProvider.refresh();
            if (completing) {
                process.stdout.write('\u0007');
            }
        }
    });

    const editTaskCmd = vscode.commands.registerCommand('workspace-todo.editTask', async (taskClicked?: TaskReference) => {
        const task = storedTask(taskClicked);
        if (!task) {
            return;
        }

        const text = await vscode.window.showInputBox({ prompt: 'Editar tarefa', value: task.text });
        if (text === undefined || !text.trim()) {
            return;
        }

        if (task.source) {
            await updateSourceTask(task, text.trim());
            await syncTasks();
        } else {
            const currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
            await context.workspaceState.update(TASKS_KEY, currentTasks.map(current =>
                current.id === task.id ? { ...current, text: text.trim() } : current,
            ));
        }
        taskProvider.refresh();
    });

    const showTaskCmd = vscode.commands.registerCommand('workspace-todo.showTask', async (taskClicked?: TaskReference) => {
        const task = storedTask(taskClicked);
        if (!task?.source) {
            vscode.window.showInformationMessage('Esta tarefa não possui uma linha de código associada.');
            return;
        }

        const uri = vscode.Uri.parse(task.source.uri);
        const document = await vscode.workspace.openTextDocument(uri);
        const range = getSourceRange(document, task.source, true);
        if (!range) {
            vscode.window.showWarningMessage('A marcação desta tarefa não foi encontrada no arquivo.');
            return;
        }
        await vscode.window.showTextDocument(document, { selection: range, preview: false });
    });

    const completeTaskCmd = vscode.commands.registerCommand('workspace-todo.completeTask', async (taskClicked?: TaskReference) => {
        const task = storedTask(taskClicked);
        if (!task || task.done) {
            return;
        }

        const currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
        await context.workspaceState.update(TASKS_KEY, currentTasks.map(current =>
            current.id === task.id ? { ...current, done: true } : current,
        ));
        taskProvider.refresh();
        process.stdout.write('\u0007');
    });

    const copyTaskCmd = vscode.commands.registerCommand('workspace-todo.copyTask', async (taskClicked?: TaskReference) => {
        const task = storedTask(taskClicked);
        if (task) {
            await vscode.env.clipboard.writeText(task.text);
            vscode.window.showInformationMessage('Tarefa copiada para o clipboard.');
        }
    });

    const deleteTaskCmd = vscode.commands.registerCommand('workspace-todo.deleteTask', async (taskClicked?: TaskReference) => {
        const currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
        const task = storedTask(taskClicked);
        if (!task) {
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Excluir a tarefa “${task.text}”?`,
            { modal: true },
            'Excluir'
        );
        if (confirmation === 'Excluir') {
            if (task.stale) {
                await context.workspaceState.update(TASKS_KEY, currentTasks.filter(current => current.id !== task.id));
            } else if (task.source) {
                await removeSourceTask(task);
                await syncTasks();
            } else {
                await context.workspaceState.update(TASKS_KEY, currentTasks.filter(t => t.id !== task.id));
            }
            taskProvider.refresh();
        }
    });

    // Comando: Limpar concluídas
    const clearDoneCmd = vscode.commands.registerCommand('workspace-todo.clearDone', async () => {
        let currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
        const pendingOnly = currentTasks.filter(t => !t.done);
        await context.workspaceState.update(TASKS_KEY, pendingOnly);
        taskProvider.refresh();
    });

    // Comando: Atualizar manualmente
    const refreshCmd = vscode.commands.registerCommand('workspace-todo.refresh', () => {
        taskProvider.refresh();
    });

    const clearStaleCmd = vscode.commands.registerCommand('workspace-todo.clearStale', async () => {
        const currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
        await context.workspaceState.update(TASKS_KEY, currentTasks.filter(task => !task.stale));
        taskProvider.refresh();
    });

    context.subscriptions.push(
        addTaskCmd,
        toggleTaskCmd,
        searchCmd,
        filterPriorityCmd,
        filterStatusCmd,
        toggleGroupingCmd,
        clearViewCmd,
        editTaskCmd,
        showTaskCmd,
        completeTaskCmd,
        copyTaskCmd,
        deleteTaskCmd,
        clearDoneCmd,
        refreshCmd,
        clearStaleCmd,
    );
}

export function deactivate() {}
