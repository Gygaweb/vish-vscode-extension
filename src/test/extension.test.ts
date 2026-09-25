import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { parseTaggedTasks, sortTasks } from '../extension';

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
});
