import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allSpots} from '../data/catalog.ts';
import {evidenceSpots} from '../ocean/spots.ts';
// D-03 regression: a star must never be accepted for a spot Home and the picker cannot show.
test('every catalogue spot has live evidence, so every star can appear on Home and in the picker',()=>{
 const live=new Set(evidenceSpots.map(s=>s.id));
 assert.deepEqual(allSpots.filter(s=>!live.has(s.id)).map(s=>s.id),[]);
});
