import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextFailed, spotLoaded, spotPhase} from '../services/dataPhase.ts';

// Audit A6 (R1): loading is never reported as "no data" on Quiver, Board Match, Personal or the header search.
const loaded = new Set(['spot-2']);
const hook = (over: Partial<Parameters<typeof spotLoaded>[0]>) => ({enabled: true, bundle: null, error: '', loading: false, loaded: null, ...over});

test('a spot is not "loaded" before the first retrieval has arrived or failed (search rows show loading, not "No forecast data")', () => {
  assert.equal(spotLoaded(hook({}), 'spot-2'), false);                 // the render before the effect runs
  assert.equal(spotLoaded(hook({loading: true}), 'spot-2'), false);    // first retrieval pending
  assert.equal(spotLoaded(hook({error: 'x'}), 'spot-2'), true);        // failed: the "no data" states are true now
  assert.equal(spotLoaded(hook({error: 'x', loading: true}), 'spot-2'), false); // retrying
  assert.equal(spotLoaded(hook({bundle: {}, loaded}), 'spot-2'), true);
  assert.equal(spotLoaded(hook({bundle: {}, loaded}), 'spot-9'), false); // outside the loaded scope: loads on demand
  assert.equal(spotLoaded(hook({bundle: {}}), 'spot-9'), true);          // a full bundle has every spot
  assert.equal(spotLoaded(hook({enabled: false}), 'spot-9'), true);      // demonstration data is local
});

test('spotPhase: loading / failed / ready per spot', () => {
  const isSpotLoaded = (id: string) => loaded.has(id);
  assert.equal(spotPhase({loading: true, bundle: null, error: ''}, 'spot-2'), 'loading');
  assert.equal(spotPhase({loading: false, bundle: null, error: ''}, 'spot-2'), 'loading');
  assert.equal(spotPhase({loading: false, bundle: null, error: 'down'}, 'spot-2'), 'failed');
  assert.equal(spotPhase({loading: false, bundle: {}, error: '', isSpotLoaded}, 'spot-2'), 'ready');
  assert.equal(spotPhase({loading: true, bundle: {}, error: '', isSpotLoaded}, 'spot-9'), 'loading');
  assert.equal(spotPhase({loading: false, bundle: null, error: ''}, 'spot-9', false), 'ready');
});

test('Quiver, Board Match and Personal gate their "no estimate" text on the spot phase', () => {
  const q = readFileSync('src/features/quiver/QuiverView.tsx', 'utf8'), pz = readFileSync('src/features/personal/PersonalView.tsx', 'utf8');
  assert.match(q, /spotPhase\(view\.ocean, view\.selected/);
  assert.match(q, /matchLine = pending \?/);
  assert.match(q, /\{pending \? <Skeleton/);
  assert.match(q, /new Map\(pending \? \[\]/);
  assert.match(pz, /boardPending \? \{value: <SkelInline/);
  assert.match(readFileSync('src/hooks/useOceanData.ts', 'utf8'), /isSpotLoaded=\(id:string\)=>spotLoaded\(/);
});

// Review HIGH: a spot outside the kept bundle whose load failed is 'failed' (Quiver shows "Try again"), never an endless skeleton.
test('a failed scope load marks the attempted ids failed; a good load clears them', () => {
  const have = new Set(['spot-2']);
  const f1 = nextFailed(new Set(), ['spot-2', 'spot-9'], null, false, have);
  assert.deepEqual([...f1], ['spot-9']);
  const isSpotLoaded = (id: string) => have.has(id), isSpotFailed = (id: string) => f1.has(id);
  assert.equal(spotPhase({loading: false, bundle: {}, error: 'Refresh did not provide usable wave data', isSpotLoaded, isSpotFailed}, 'spot-9'), 'failed');
  assert.equal(spotPhase({loading: false, bundle: {}, error: '', isSpotLoaded, isSpotFailed}, 'spot-2'), 'ready');
  assert.deepEqual([...nextFailed(f1, ['spot-9'], ['spot-2', 'spot-9'], true, null)], []);
  assert.equal(spotLoaded({...hook({bundle: {}, loaded: have}), failed: f1}, 'spot-9'), true, 'search rows may say no data once the load failed');
  assert.equal(spotLoaded({...hook({bundle: {}, loaded: have, loading: true}), failed: f1}, 'spot-9'), false, 'a retry shows loading again');
  assert.match(readFileSync('src/hooks/useOceanData.ts', 'utf8'), /isSpotFailed=\(id:string\)=>/);
});
