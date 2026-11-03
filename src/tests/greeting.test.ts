import test from 'node:test';
import assert from 'node:assert/strict';
import {greetingWord, greetingLine} from '../features/home/greeting.ts';

// T-099: the greeting follows the local hour; overnight is "Still up?" (it said "Good evening" at 2 AM).
test('greeting by local hour', () => {
  const want: [number, string][] = [[0, 'Still up?'], [2, 'Still up?'], [4, 'Still up?'], [5, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [16, 'Good afternoon'],
    [17, 'Good evening'], [21, 'Good evening'], [22, 'Still up?'], [23, 'Still up?']];
  for (const [h, w] of want) assert.equal(greetingWord(h), w, `${h}:00`);
});
test('greeting line punctuation, with and without a name', () => {
  assert.equal(greetingLine(8, 'Sam'), 'Good morning, Sam.'); assert.equal(greetingLine(8, null), 'Good morning.');
  assert.equal(greetingLine(2, 'Sam'), 'Still up, Sam?'); assert.equal(greetingLine(2, null), 'Still up?');
});
