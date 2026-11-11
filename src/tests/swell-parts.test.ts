import {test} from 'node:test';
import assert from 'node:assert/strict';
import {partitionKind, partitionNotes, shownPartitions} from '../services/swellParts.ts';

test('audit A13: junk partitions are not shown as swell', () => {
  assert.equal(partitionKind({height: 0.1, period: 1}), 'noise', "Cocoa's 0.1 ft · 1 s secondary");
  assert.equal(partitionKind({height: 0.3, period: 9}), 'noise', 'a tiny non-primary partition');
  assert.equal(partitionKind({height: 0.3, period: 9}, true), 'swell', 'a small primary is still the swell');
  assert.equal(partitionKind({height: 2, period: 3.5}, true), 'chop', "Manasquan's 3–4 s primary is wind chop");
  assert.equal(partitionKind({height: 4, period: 12}), 'swell');
  assert.equal(partitionKind(null), 'noise');
  const shown = shownPartitions([{height: 3, period: 11, direction: 280}, {height: 0.1, period: 1, direction: 118}, {height: 1.2, period: 4, direction: 90}]);
  assert.deepEqual(shown.map((s) => s.kind), ['swell', 'chop']);
});

test('review fix A13: the 0.5 ft floor spares long-period swell; the footer says what was hidden', () => {
  assert.equal(partitionKind({height: 0.4, period: 16}), 'swell', 'a small long-period groundswell is real');
  assert.equal(partitionKind({height: 0.4, period: 8}), 'noise');
  assert.deepEqual(partitionNotes([{height: 3, period: 11}, {height: 0.3, period: 7}]), {smallHidden: true, onlyNoise: false});
  assert.deepEqual(partitionNotes([{height: 3, period: 11}, {height: 0.1, period: 1}]), {smallHidden: false, onlyNoise: false});
  assert.deepEqual(partitionNotes([{height: 0.2, period: 1}, {height: 0.1, period: 1}]), {smallHidden: false, onlyNoise: true});
});
