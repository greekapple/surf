import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapStatus, type MapStatusIn} from '../features/explore/mapStatus.ts';

const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const base: MapStatusIn = {phone: true, srcWarn: '', heldNote: '', seaNote: '', fallbackName: '', cacheNote: '', darkNow: false, seaFailed: false};
const held = 'Loading swell… · showing Swell, Fri 3 PM', slow = 'Still loading waves (taking longer than usual) · showing Waves, Fri 3 PM';

test('map-status P1-1: phone, after dark, a held or slow sea: the after-dark note carries what the sea shows (and its Retry), the model and the cache', () => {
  for (const h of [held, slow]) {
    const o = mapStatus({...base, darkNow: true, heldNote: h, seaNote: h, fallbackName: 'WW3 fallback', cacheNote: 'cached Fri 11 PM PST · updating…'});
    assert.equal(o.status, 'dark'); assert.equal(o.showDark, true); assert.equal(o.showTop, false, 'one message');
    assert.deepEqual(o.darkExtras, [h, 'WW3 fallback', 'cached Fri 11 PM PST · updating…'], 'no label dropped');
  }
  assert.match(read('../features/explore/ExploreView.tsx'), /\{phone && retryFn && <button type="button" className="xdark-retry" onClick=\{retryFn\}>Retry<\/button>\}/, 'the Retry rides in the after-dark note');
});

test('map-status P1-2: wide screen, after dark and the sea failed (or slow): both are shown (they sit in different places)', () => {
  const o = mapStatus({...base, phone: false, darkNow: true, seaFailed: true, heldNote: "Couldn't load waves", seaNote: "Couldn't load waves"});
  assert.equal(o.showDark, true, 'the after-dark note stays');
  const ev = read('../features/explore/ExploreView.tsx');
  assert.match(ev, /if \(slow && anyLoading\) return <p className="xload"/, 'the slow pill is not hidden at night');
  assert.doesNotMatch(ev, /!seaFailed\) && <p className="xdark"/);
});

test('map-status P1-3: phone, a source warning with a cached map and a slow sea: the cached-map label stays in the one note', () => {
  const o = mapStatus({...base, srcWarn: 'Limited: Open-Meteo Marine', cacheNote: 'cached Fri 11 PM PST · not updated'});
  assert.equal(o.status, 'fail'); assert.equal(o.showTop, true); assert.equal(o.showCacheChip, false);
  assert.match(o.top, /^Limited: Open-Meteo Marine · cached Fri 11 PM PST · not updated$/, 'no sea note, still the cache label');
  const s = mapStatus({...base, srcWarn: 'Limited: Open-Meteo Marine', heldNote: slow, seaNote: slow, cacheNote: 'cached Fri 11 PM PST · not updated', darkNow: true});
  for (const part of ['Limited:', 'Still loading', 'cached Fri 11 PM', 'after dark']) assert.ok(s.top.includes(part), `${part} kept`);
});

test('map-status: never more than one message on a phone; the cache chip only on its own', () => {
  const combos: Partial<MapStatusIn>[] = [{}, {darkNow: true}, {srcWarn: 'Limited: X'}, {seaNote: 'Loading waves…'}, {cacheNote: 'cached'}, {darkNow: true, cacheNote: 'cached'}, {srcWarn: 'Limited: X', darkNow: true, seaFailed: true, heldNote: 'Couldn\'t load waves', seaNote: 'Couldn\'t load waves'}];
  for (const c of combos) { const o = mapStatus({...base, ...c}); assert.ok([o.showTop, o.showDark, o.showCacheChip].filter(Boolean).length <= 1, JSON.stringify(c)); }
});

test('map-status P1-4: the offshore-only pill is hollow and empty (no "off", which read as offshore wind); the key says so', () => {
  assert.match(read('../map/engine/dotIcon.ts'), /text = i\.kind === 'off' \|\| i\.kind === 'snap' \? '' : i\.pill/);
  assert.match(read('../features/explore/Panels.tsx'), /\['off', null, 'Hollow: offshore wave height only, no surf size here'\]/);
  assert.equal((read('../features/explore/Panels.tsx').match(/Dimmed: after dark\./g) ?? []).length, 1);
  assert.match(read('../features/explore/ExploreView.tsx'), /<button type="button" className="xchip xstatus"/, 'the status line is a button (keyboard)');
  assert.doesNotMatch(read('../map/engine/maplibreEngine.ts'), /'hide'/, 'no filter on a property that no longer exists (a null get would hide every pill)');
});

test('map-tidy (lead P2): over a cached map the cache label says "not updated" and gets the Retry; the offshore sample in the key is a pill; the group sheet is gone', () => {
  const ev = read('../features/explore/ExploreView.tsx');
  assert.match(ev, /const cacheRetry = !seaRetry && !!cache && cacheDrawn && opts\.heat && live && \(!anyLoading \|\| slow\)/);
  assert.match(ev, /\{cacheRetry && <button type="button" className="xdark-retry" onClick=\{cacheRetry\}>Retry<\/button>\}/, 'the cache chip carries it');
  assert.match(read('../features/explore/cacheLabel.ts'), /chip: `cached \$\{valid\} · not updated`/, 'not loading any more: "not updated"');
  assert.match(read('../features/explore/explore.css'), /\.xg-dot\.k-off \{ border: 2\.5px solid var\(--c\); width: 28px; border-radius: 999px; \}/);
  assert.doesNotMatch(ev, /groupOpen|className="xgroup"/, 'the old coast-group list is removed');
  assert.doesNotMatch(read('../map/engine/dotIcon.ts'), /screen readers say so/);
});
