import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyForm, missingBoardFields, PLACEHOLDER} from '../features/quiver/boardForm.ts';

// Audit B11 (R12): Add board must not pre-fill invented dimensions as real values.
test('a new board form starts with every dimension blank; the examples are placeholders', () => {
  for (const k of ['length', 'width', 'thickness', 'volume', 'fins', 'tail'] as const) assert.equal(emptyForm[k], '', k);
  assert.equal(PLACEHOLDER.length, `6'0"`);
  assert.equal(PLACEHOLDER.volume, '30');
});

test('saving a name alone is refused: the missing fields are named', () => {
  assert.deepEqual(missingBoardFields({...emptyForm, name: 'Fish'}), ['length', 'width', 'thickness', 'volume']);
  assert.deepEqual(missingBoardFields({...emptyForm}), ['name', 'length', 'width', 'thickness', 'volume']);
  assert.deepEqual(missingBoardFields({name: 'x', length: `5'10"`, width: '20', thickness: '2.5', volume: ' '}), ['volume']);
  assert.deepEqual(missingBoardFields({name: 'x', length: `5'10"`, width: '20', thickness: '2.5', volume: '31'}), []);
});

test('the form uses inline errors, not the native validation bubble', () => {
  const src = readFileSync('src/features/quiver/QuiverView.tsx', 'utf8');
  assert.match(src, /onSubmit=\{submit\} noValidate/);
  assert.doesNotMatch(src, /required: true/);
});
