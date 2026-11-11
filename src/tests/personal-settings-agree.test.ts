import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_BOARD_PREFS, swellSummary} from '../features/personal/journal.ts';

// Audit C (R18): Personal settings no longer contradict each other.
test('the list says "Not set" exactly when the form shows nothing chosen', () => {
  assert.deepEqual(swellSummary(DEFAULT_BOARD_PREFS), {value: 'Not set'});
  assert.deepEqual(swellSummary({...DEFAULT_BOARD_PREFS, periodSet: true}), {value: 'Any direction', sub: '10–16 seconds'});
  assert.deepEqual(swellSummary({...DEFAULT_BOARD_PREFS, swellDirs: ['W', 'NW']}), {value: 'W, NW', sub: undefined});
});

test('ability is set in one place, and the notes agree on what it shapes', () => {
  const src = readFileSync('src/features/personal/PersonalView.tsx', 'utf8');
  assert.equal(src.match(/label="Surfing ability"/g)?.length, 1);
  assert.doesNotMatch(src, /Shown on your profile; forecasts are not filtered by them/);
  assert.match(src, /value=\{prefs\.periodSet \? prefs\.periodMin : ''\} placeholder="10"/);
});

test('review: copy says what uses the preferences; the board row says No pick with its reason; journal photos are own-or-none', () => {
  const src = readFileSync('src/features/personal/PersonalView.tsx', 'utf8');
  assert.match(src, /Board Match ranks boards by each board's own wave range \(and your ability in the demonstration week\)/);
  assert.match(src, /boardPhase === 'failed' \? \{value: 'No pick', sub: `The forecast for/);
  assert.match(src, /choice\?\.est \? \{value: 'None suits it'/);
  assert.match(src, /label="Height scale"/);
  const parts = readFileSync('src/features/personal/parts.tsx', 'utf8');
  assert.match(parts, /const id = ownPhotoFor\(spotId\);\n  return id \? \{src: photoUrl\(id\), own: false, id\} : null;/);
});
