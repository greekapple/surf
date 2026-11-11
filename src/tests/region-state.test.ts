import {test} from 'node:test';
import assert from 'node:assert/strict';
import {regionWithState} from '../data/zones.ts';

test('audit R5: a home region carries its own state, never a blanket ", CA"', () => {
  assert.equal(regionWithState('Oahu North Shore'), 'Oahu North Shore, Hawaii');
  assert.equal(regionWithState('Tillamook'), 'Tillamook, Oregon');
  assert.equal(regionWithState('San Mateo'), 'San Mateo, California');
  assert.equal(regionWithState('Outer Banks'), 'Outer Banks, North Carolina');
  assert.equal(regionWithState('Maine'), 'Maine');
  assert.equal(regionWithState('Northern New Jersey'), 'Northern New Jersey');
  assert.equal(regionWithState('Somewhere new'), 'Somewhere new');
});
