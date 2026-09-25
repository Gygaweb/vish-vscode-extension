import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import {
	filterTasks,
	groupTasks,
	parseTaggedTasks,
	reconcileTaggedTasks,
	sortTasks,
	Task,
} from '../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('maps all tags and prioritizes Vish chronologically', () => {
		const tasks = parseTaggedTasks([
			'// @TODO revisar o formulário',
			'// @vIsH corrigir o fluxo',
			'// @todo documentar @VISH publicar a versão',
		].join('\n'), 'file:///workspace/app.ts');

		const sorted = sortTasks(tasks);
		assert.deepStrictEqual(sorted.map(task => task.text), [
			'corrigir o fluxo',
			'publicar a versão',
			'revisar o formulário',
			'documentar',
		]);
		assert.strictEqual(sorted[0].priority, 'vish');
		assert.strictEqual(sorted[1].source?.line, 2);
	});

	test('only maps standalone markers, not words containing them', () => {
		const tasks = parseTaggedTasks([
			'// @TODO tarefa válida',
			'// @VISH tarefa prioritária',
			'const contact = "email@todo.com";',
			'const value = "@vishful";',
			'const plain = "TODO sem arroba";',
		].join('\n'));

		assert.deepStrictEqual(tasks.map(task => task.text), ['tarefa válida', 'tarefa prioritária']);
		assert.deepStrictEqual(tasks.map(task => task.priority), ['todo', 'vish']);
	});

	test('filters tasks without changing task records', () => {
		const tasks: Task[] = [
			{ id: '1', text: 'Corrigir login', done: false, priority: 'vish' },
			{ id: '2', text: 'Documentar API', done: true, priority: 'todo' },
			{ id: '3', text: 'Revisar layout', done: false },
		];

		assert.deepStrictEqual(filterTasks(tasks, {
			query: 'LOGIN', priority: 'all', status: 'pending', groupByFile: false,
		}).map(task => task.id), ['1']);
		assert.deepStrictEqual(filterTasks(tasks, {
			query: '', priority: 'todo', status: 'all', groupByFile: false,
		}).map(task => task.id), ['2']);
		assert.deepStrictEqual(tasks.map(task => task.done), [false, true, false]);
	});

	test('groups source tasks and keeps manual tasks separate', () => {
		const tasks: Task[] = [
			{ id: '1', text: 'A', done: false, source: { uri: 'file:///a.ts', line: 0, character: 3, tag: 'todo' } },
			{ id: '2', text: 'B', done: false },
			{ id: '3', text: 'C', done: false, source: { uri: 'file:///b.ts', line: 1, character: 3, tag: 'vish' } },
		];

		assert.deepStrictEqual(groupTasks(tasks).map(group => [group.key, group.tasks.map(task => task.id)]), [
			['file:///b.ts', ['3']],
			['file:///a.ts', ['1']],
			['manual', ['2']],
		]);
	});

	test('retains missing source tasks as stale and reconciles restored markers', () => {
		const previous: Task[] = [
			{ id: 'old', text: 'Old', done: true, source: { uri: 'file:///a.ts', line: 0, character: 3, tag: 'todo' } },
			{ id: 'manual', text: 'Manual', done: false },
		];
		const stale = reconcileTaggedTasks(previous, []);
		assert.strictEqual(stale.find(task => task.id === 'old')?.stale, true);
		assert.strictEqual(stale.find(task => task.id === 'manual')?.stale, undefined);

		const restored = reconcileTaggedTasks(stale, [{
			id: 'new', text: 'Restored', done: false,
			source: { uri: 'file:///a.ts', line: 0, character: 3, tag: 'todo' },
		}]);
		assert.deepStrictEqual(restored.filter(task => task.source).map(task => [task.id, task.stale]), [['old', false]]);
	});
});
