import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheLabel} from '../features/explore/cacheLabel.ts';

const when = (iso: string) => iso.slice(5, 13);
test('a network frame gets no cache label', () => {
  assert.equal(cacheLabel({validAt: '2026-11-04T18:00:00.000Z'}, true, when), null);
  assert.equal(cacheLabel(null, true, when), null);
});
test('a cached frame is labelled with its own valid time and says it is updating', () => {
  const l = cacheLabel({validAt: '2026-11-04T18:00:00.000Z', cached: {savedAt: '2026-11-03T22:00:00.000Z'}}, true, when)!;
  assert.equal(l.chip, 'cached 11-04T18 · updating…');
  assert.match(l.line, /11-04T18 model frame from this device's cache \(saved 11-03T22\) · updating…$/);
});
test('a cached frame that could not be refreshed never claims to be updating', () => {
  const l = cacheLabel({validAt: '2026-11-04T18:00:00.000Z', cached: {savedAt: 'bad'}}, false, when)!;
  assert.equal(l.chip, 'cached 11-04T18 · not updated');
  assert.doesNotMatch(l.line, /updating|saved/);
});
