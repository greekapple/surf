import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHOTOS, SPOT_PHOTOS} from '../ui/photos.ts';

// Audit C (R8): favourite-spot cards use the spot's own credited photo or none, never a generic barrel that reads as that spot's conditions.
const src = readFileSync('src/features/personal/parts.tsx', 'utf8');

test('SpotCover takes only the spot\'s own photo; a spot without one gets a plain card', () => {
  assert.match(src, /export const ownPhotoFor = \(spotId: string\): string \| null => SPOT_PHOTOS\[spotId\]\?\.\[0\] \?\? null;/);
  const cover = src.slice(src.indexOf('export function SpotCover'), src.indexOf('/** Image for a journal entry'));
  assert.doesNotMatch(cover, /GENERIC_PHOTOS|photoIdFor/);
  assert.match(cover, /if \(!id\) return <div className=\{`pz-cover pz-cover-none/);
});

test('every spot-specific photo is credited and not generic', () => {
  for (const [spot, ids] of Object.entries(SPOT_PHOTOS)) for (const id of ids) {
    const p = PHOTOS[id];
    assert.ok(p, `${spot}: ${id} exists`);
    assert.ok(!p.generic, `${spot}: ${id} is not a generic photo`);
    assert.ok(p.license, `${spot}: ${id} has a licence`);
  }
});
