import test from 'node:test';
import assert from 'node:assert/strict';
import {HDONTAP_CAMS, heroCamFor, sectionCamsFor, snapshotCamsFor, hasSnapshot, hdontapPage, snapshotSrc} from '../ocean/hdontapCams.ts';
import {evidenceSpots} from '../ocean/spots.ts';

// cam-hero (user, 2026-11-13: "on Venice, the cam replaces the little diagram at the top ... only for Venice right now"): opt-in per camera, never by spot id.
test('only Venice Breakwater has a header camera: the Venice Roaming snapshot', () => {
  const heroes = evidenceSpots.map((s) => [s.id, heroCamFor(s.id)] as const).filter(([, c]) => c);
  assert.deepEqual(heroes.map(([id, c]) => [id, c!.name]), [['cs-venice-breakwater', 'Venice Roaming Surf Cam']]);
});
test('a header camera is a camera that has a snapshot (opt-in on the camera), and a spot has at most one', () => {
  for (const c of HDONTAP_CAMS.filter((x) => x.hero)) { assert.ok(c.snapshotUrl, `${c.name} has a snapshot`); assert.ok(!c.status, `${c.name} is not marked down`); }
  const by = new Map<string, number>(); for (const c of HDONTAP_CAMS.filter((x) => x.hero)) by.set(c.spotId, (by.get(c.spotId) ?? 0) + 1);
  for (const [spot, n] of by) assert.equal(n, 1, `${spot}: one header camera`);
});
test('the camera section never repeats the header camera; every other spot keeps all its snapshot cameras', () => {
  const v = 'cs-venice-breakwater', hero = heroCamFor(v)!;
  assert.ok(!sectionCamsFor(v).some((c) => c.stream === hero.stream));
  assert.deepEqual(sectionCamsFor(v).map((c) => c.stream), snapshotCamsFor(v).filter((c) => c.stream !== hero.stream).map((c) => c.stream));
  for (const s of evidenceSpots) if (s.id !== v) assert.deepEqual(sectionCamsFor(s.id), snapshotCamsFor(s.id), s.id);
});
test('the header camera keeps HDOnTap\'s terms: their URL as given plus the per-minute cache-bust, and its older link is replaced (shown once)', () => {
  const hero = heroCamFor('cs-venice-breakwater')!, t = Date.UTC(2026, 10, 13, 22, 0, 30);
  assert.equal(snapshotSrc(hero.snapshotUrl!, t), `${hero.snapshotUrl}&t=${Math.floor(t / 60000)}`);
  assert.equal(snapshotSrc(hero.snapshotUrl!, t + 29_000), snapshotSrc(hero.snapshotUrl!, t), 'the same minute asks for the same picture');
  assert.ok(hasSnapshot(hdontapPage(hero), 'cs-venice-breakwater'));
});
