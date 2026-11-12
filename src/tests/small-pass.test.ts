import test from 'node:test';
import assert from 'node:assert/strict';
import {withSign} from '../utils/signed.ts';

test('a signed tide height never reads "−0.0"', () => {
  assert.equal(withSign(-0.04, '0.0'), '0.0');
  assert.equal(withSign(0.04, '0.0'), '0.0');
  assert.equal(withSign(-0.3, '0.3'), '−0.3');
  assert.equal(withSign(-0, '0'), '0');
  assert.equal(withSign(1.25, '1.3'), '1.3');
  assert.equal(withSign(-0.02, '0.0 ft'), '0.0 ft');   // with its unit (the share card's tide)
  assert.equal(withSign(-1.2, '1.2 ft'), '−1.2 ft');
});
