# Vish — Workspace To-Do

O Vish é uma extensão do Visual Studio Code para registrar, acompanhar e concluir tarefas diretamente no ambiente de desenvolvimento. Ele mantém suas tarefas no armazenamento do workspace, apresenta lembretes ao abrir um projeto e oferece uma visão lateral simples para você não perder o próximo passo.

## Recursos

- Adição rápida de tarefas pela barra lateral do Vish.
- Alternância entre tarefas pendentes e concluídas com um clique.
- Sinal sonoro tecnológico ao concluir uma tarefa.
- Cópia do texto de uma tarefa para o clipboard.
- Exclusão individual de tarefas com confirmação.
- Atalhos de teclado remapeáveis para todas as ações principais.
- Limpeza das tarefas concluídas e atualização manual da lista.
- Detecção automática de `@todo` e `@vish` em todos os arquivos do workspace.
- Priorização cronológica de `@vish`, com destaque amarelo e negrito.
- Menu de contexto nas tarefas para editar, exibir a linha do código, excluir, concluir e copiar.

## Como usar

1. Abra a visão **Vish!** na barra de atividades do VS Code.
2. Clique em **Adicionar tarefa** e informe o que precisa ser feito.
3. Clique em uma tarefa para alternar seu status.
4. Use os ícones exibidos ao lado da tarefa para copiá-la ou excluí-la.

As tarefas são armazenadas no workspace atual e ficam disponíveis novamente quando o projeto for reaberto.
Marcadores encontrados no workspace aberto são sincronizados automaticamente ao salvar ou alterar arquivos. `@vish` aparece antes dos demais marcadores; a comparação não diferencia maiúsculas e minúsculas.
Clique com o botão direito em uma tarefa para abrir as ações disponíveis. Em tarefas encontradas no código, **Exibir** navega até o marcador, **Editar** altera o texto associado e **Excluir** remove o marcador do arquivo.

## Atalhos padrão

| Ação | Atalho |
| --- | --- |
| Adicionar tarefa | `Ctrl+Alt+N` |
| Alternar status | `Ctrl+Enter` |
| Copiar tarefa | `Ctrl+Shift+C` |
| Excluir tarefa | `Ctrl+Shift+Backspace` |
| Limpar concluídas | `Ctrl+Alt+Backspace` |
| Atualizar lista | `Ctrl+Alt+R` |

Todos os atalhos podem ser alterados em **Arquivo → Preferências → Atalhos de Teclado** (`Ctrl+K Ctrl+S`).

## Licença

Este projeto está disponível sob a licença MIT. Consulte [LICENSE.md](LICENSE.md).
