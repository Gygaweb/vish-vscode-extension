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
    const previousTagged = new Map(
        currentTasks.filter(task => task.source).map(task => [`${task.source?.uri}:${task.source?.line}:${task.source?.character}`, task]),
    );
    const syncedTagged = taggedTasks.map(task => {
        const previous = previousTagged.get(`${task.source?.uri}:${task.source?.line}:${task.source?.character}`);
        return previous ? { ...task, done: previous.done, id: previous.id } : task;
    });
    const manualTasks = currentTasks.filter(task => !task.source);
    await context.workspaceState.update(TASKS_KEY, [...manualTasks, ...syncedTagged]);
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

// 1. Classe que fornece os dados para a Barra Lateral
class TaskTreeProvider implements vscode.TreeDataProvider<TaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | void> = new vscode.EventEmitter<TaskItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

    // Recarrega a barra lateral
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskItem): Thenable<TaskItem[]> {
        const tasks = sortTasks(this.context.workspaceState.get<Task[]>(TASKS_KEY, []));
        
        if (tasks.length === 0) {
            return Promise.resolve([new TaskItem({ id: '', text: 'Nenhuma tarefa pendente 🎉', done: false }, '', vscode.TreeItemCollapsibleState.None)]);
        }

        // Transforma os dados em itens visuais (TaskItem)
        const items = tasks.map(t => {
            const icon = t.priority === 'vish'
                ? new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'))
                : t.done
                    ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'))
                    : new vscode.ThemeIcon('circle-large-outline');
            return new TaskItem(t, t.id, vscode.TreeItemCollapsibleState.None, icon, t.done, {
                command: 'workspace-todo.toggleTask',
                title: 'Alternar Status',
                arguments: [t] // Passa a tarefa clicada para o comando
            });
        });

        return Promise.resolve(items);
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
        this.contextValue = id ? (done ? 'taskDone' : 'task') : undefined;
        this.tooltip = task.source ? `${task.text} (${task.source.tag.toUpperCase()})` : task.text;
        this.description = this.done ? 'Concluída' : 'Pendente';
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
            if (task.source) {
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

    context.subscriptions.push(
        addTaskCmd,
        toggleTaskCmd,
        editTaskCmd,
        showTaskCmd,
        completeTaskCmd,
        copyTaskCmd,
        deleteTaskCmd,
        clearDoneCmd,
        refreshCmd,
    );
}

export function deactivate() {}
