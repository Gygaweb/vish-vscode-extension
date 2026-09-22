import * as vscode from 'vscode';

interface Task {
    id: string;
    text: string;
    done: boolean;
}

type TaskReference = Task | TaskItem;

const TASKS_KEY = 'workspace-todo.tasks';

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
        let tasks: Task[] = this.context.workspaceState.get<Task[]>(TASKS_KEY, []);
        
        if (tasks.length === 0) {
            return Promise.resolve([new TaskItem('Nenhuma tarefa pendente 🎉', '', vscode.TreeItemCollapsibleState.None)]);
        }

        // Transforma os dados em itens visuais (TaskItem)
        const items = tasks.map(t => {
            const icon = t.done ? new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed')) : new vscode.ThemeIcon('circle-large-outline');
            return new TaskItem(t.text, t.id, vscode.TreeItemCollapsibleState.None, icon, t.done, {
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
        public readonly label: string,
        public readonly id: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly done?: boolean,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.contextValue = id ? 'task' : undefined;
        this.tooltip = `${this.label}`;
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

    // Recupera tarefas para a notificação de abertura
    let tasks: Task[] = context.workspaceState.get<Task[]>(TASKS_KEY, []);
    const pendingTasks = tasks.filter(t => !t.done);
    
    if (pendingTasks.length > 0) {

        // Força o VS Code a abrir a barra lateral do Vish imediatamente
        vscode.commands.executeCommand('vish-tasks.focus');
        vscode.window.showInformationMessage(
            `Lembrete: Você tem ${pendingTasks.length} tarefa(s) pendente(s).`,
            'Abrir Vish'
        ).then(selection => {
            if (selection === 'Abrir Vish') {
                vscode.commands.executeCommand('vish-tasks.focus');
            }
        });
    }

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
        const task = selectedTask(taskClicked);
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

    const copyTaskCmd = vscode.commands.registerCommand('workspace-todo.copyTask', async (taskClicked?: TaskReference) => {
        const reference = selectedTask(taskClicked);
        const task = context.workspaceState.get<Task[]>(TASKS_KEY, []).find(t => t.id === reference?.id);
        if (task) {
            await vscode.env.clipboard.writeText(task.text);
            vscode.window.showInformationMessage('Tarefa copiada para o clipboard.');
        }
    });

    const deleteTaskCmd = vscode.commands.registerCommand('workspace-todo.deleteTask', async (taskClicked?: TaskReference) => {
        const currentTasks = context.workspaceState.get<Task[]>(TASKS_KEY, []);
        const reference = selectedTask(taskClicked);
        const task = currentTasks.find(t => t.id === reference?.id);
        if (!task) {
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Excluir a tarefa “${task.text}”?`,
            { modal: true },
            'Excluir'
        );
        if (confirmation === 'Excluir') {
            await context.workspaceState.update(TASKS_KEY, currentTasks.filter(t => t.id !== task.id));
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

    context.subscriptions.push(addTaskCmd, toggleTaskCmd, copyTaskCmd, deleteTaskCmd, clearDoneCmd, refreshCmd);
}

export function deactivate() {}
