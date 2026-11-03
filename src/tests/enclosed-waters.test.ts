import test from 'node:test';
import assert from 'node:assert/strict';
import {isEnclosedWater, enclosedCellCount, ENCLOSED_NOTE} from '../map/enclosed.ts';

test('T-092: SF Bay and other enclosed waters are not covered; the open sea, coastal fringe and open bays are', () => {
  const enclosed: [string, number, number][] = [['Alcatraz / Central Bay', 37.826, -122.423], ['South Bay', 37.55, -122.15], ['San Pablo Bay', 38.05, -122.38], ['Richardson Bay', 37.87, -122.47], ['Humboldt Bay', 40.75, -124.2]];
  const open: [string, number, number][] = [['Golden Gate, ocean side', 37.80, -122.55], ['Ocean Beach 3 km off', 37.76, -122.55], ['Half Moon Bay offshore', 37.50, -122.55], ['Monterey Bay centre', 36.80, -121.95], ['Monterey Bay head', 36.85, -121.80], ['Drakes Bay', 38.0, -122.95], ['Santa Monica Bay', 33.9, -118.55], ['50 km offshore', 37.8, -123.3], ['San Diego offshore', 32.6, -117.4]];
  for (const [n, la, lo] of enclosed) assert.equal(isEnclosedWater(la, lo), true, `${n} should be enclosed`);
  for (const [n, la, lo] of open) assert.equal(isEnclosedWater(la, lo), false, `${n} should be open`);
  assert.ok(enclosedCellCount() > 800 && enclosedCellCount() < 8000, `${enclosedCellCount()} cells`);
  assert.equal(isEnclosedWater(0, 0), false); assert.equal(isEnclosedWater(NaN, NaN), false); assert.match(ENCLOSED_NOTE, /not resolve/);
});
