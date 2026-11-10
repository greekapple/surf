import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceSpots} from '../ocean/spots.ts';
import {ZONES} from '../data/zones.ts';
import {BAR_KEY, COASTS, SEABOARDS, TIER, ancestors, buildNodes, layoutPills, levelOf, mapZoneOf, nameOf, nodeId, overlaps, parentOf, pillText, summarise, type NodeId, type Rect, type SpotState} from '../features/explore/coastGroups.ts';

// 4E coast groups (spec docs/specs/2026-11-10-round-4-overnight.md 4E).
const nodes = buildNodes(evidenceSpots);
test('every spot sits in one region, and every region climbs to one of the three seaboards', () => {
  const regions = [...nodes.keys()].filter((id) => levelOf(id) === 0);
  assert.equal(regions.reduce((n, id) => n + nodes.get(id)!.length, 0), evidenceSpots.length);
  for (const id of regions) { const a = ancestors(id); assert.equal(a.length, 3, `${id}: ${a.join(' > ')}`); assert.ok(SEABOARDS.some(([s]) => nodeId(3, s) === a[2])); }
  for (const [s] of SEABOARDS) assert.ok(nodes.has(nodeId(3, s)), s);
  assert.equal(nodes.get(nodeId(3, 'West Coast'))!.length + nodes.get(nodeId(3, 'Hawaii'))!.length + nodes.get(nodeId(3, 'East Coast'))!.length, evidenceSpots.length);
  // every browsing zone is under a coast (the island zones through their county grouping)
  const coastKids = new Set(COASTS.flatMap(([, z]) => z));
  for (const [z, regs] of ZONES) for (const r of regs) assert.ok(coastKids.has(mapZoneOf(r)), `${z} / ${r}`);
});
test('the map groups the small islands by county: Niihau with Kauai, Molokai and Lanai with Maui', () => {
  assert.equal(parentOf(nodeId(0, 'Niihau')), parentOf(nodeId(0, 'Kauai')));
  assert.equal(parentOf(nodeId(0, 'Molokai')), parentOf(nodeId(0, 'Maui'))); assert.equal(parentOf(nodeId(0, 'Lanai')), parentOf(nodeId(0, 'Maui')));
  assert.equal(nameOf(parentOf(nodeId(0, 'Space Coast'))!), 'Florida');
});

const st = (id: string, score: number | null, band: SpotState['band'], loaded = true, dark = false, rank = 0): SpotState => ({id, name: id, loaded, score, category: score === null ? null : (band === 'good' ? 'SOLID' : band === 'fair' ? 'NOT BAD' : 'WEAK'), band, dark, rank});
test('summary: the BEST spot and the spread; nothing is averaged; unloaded spots are counted as unloaded, never as poor', () => {
  // nine poor beaches and one good point: an average would say poor; the pill says best good
  const s = summarise([...Array.from({length: 9}, (_, i) => st(`b${i}`, 10, 'poor')), st('point', 80, 'good')]);
  assert.equal(s.best!.id, 'point'); assert.deepEqual(s.counts, {good: 1, fair: 0, poor: 9, none: 0}); assert.equal(s.loaded, 10);
  assert.ok(!('average' in s) && !('mean' in s));
  const u = summarise([st('a', null, 'none', false), st('b', 55, 'fair'), st('c', null, 'none')]);
  assert.equal(u.total, 3); assert.equal(u.loaded, 2); assert.deepEqual(u.counts, {good: 0, fair: 1, poor: 0, none: 1}); assert.equal(u.best!.id, 'b');
  const none = summarise([st('a', null, 'none'), st('b', null, 'none')]); assert.equal(none.best, null); assert.equal(none.counts.none, 2);
  const cold = summarise([st('a', null, 'none', false)]); assert.equal(cold.loaded, 0); assert.equal(cold.best, null);
});

/** Web Mercator pixels at zoom z (256 px tiles), a fixed pill size, anchored at the group's centre. */
const layoutAt = (z: number, w: number, h: number, prio: (id: NodeId) => number = () => 0, avoid: Rect[] = []) => {
  const by = new Map(evidenceSpots.map((e) => [e.id, e] as const)), s = 256 * 2 ** z;
  const px = (lat: number, lon: number) => ({x: ((lon + 180) / 360) * s, y: ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * s});
  const box = (id: NodeId): Rect => { const ids = nodes.get(id)!; let la = 0, lo = 0; for (const i of ids) { la += by.get(i)!.latitude; lo += by.get(i)!.longitude; } const c = px(la / ids.length, lo / ids.length); return {left: c.x - w / 2, right: c.x + w / 2, top: c.y - h / 2, bottom: c.y + h / 2}; };
  const out = layoutPills([...nodes.keys()].filter((id) => levelOf(id) === 0), box, prio, avoid);
  return {out, rect: (id: NodeId) => { const r = box(id), [dx, dy] = out.get(id)!; return {left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy}; }};
};
for (const [w, h] of [[160, 56], [120, 44]]) for (const z of [3, 4, 5, 6]) {
  test(`layout ${w}×${h} at z${z}: no two pills overlap, and every spot is under exactly one drawn pill`, () => {
    const {out, rect} = layoutAt(z, w, h), ids = [...out.keys()];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(!overlaps(rect(ids[i]), rect(ids[j]), 0), `${ids[i]} × ${ids[j]}`);
    const covered = ids.flatMap((id) => nodes.get(id)!);
    if (z >= 4) { assert.equal(covered.length, evidenceSpots.length); assert.equal(new Set(covered).size, evidenceSpots.length); }   // nothing dropped: merging alone made room
    for (const [dx, dy] of out.values()) assert.ok(Math.abs(dx) <= w * 0.35 && Math.abs(dy) <= h * 1.5);
    // nudges keep each pill on its side of its neighbours: two drawn pills never swap their north-south order by more than half a pill
    for (const a of ids) for (const c of ids) { const ra = rect(a), rc = rect(c), [, da] = out.get(a)!, [, dc] = out.get(c)!; if ((ra.top - da) < (rc.top - dc) - h) assert.ok(ra.top < rc.top + h / 2, `${a} above ${c}`); }
  });
}
test('closer in, finer groups: California has more pills at z6 than at z4; Hawaii splits into its islands by z6 on a phone', () => {
  const ca = (z: number) => [...layoutAt(z, 160, 56).out.keys()].filter((id) => ancestors(id).concat(id).includes(nodeId(3, 'West Coast'))).length;
  assert.ok(ca(6) > ca(4), `${ca(4)} -> ${ca(6)}`);
  const hi = [...layoutAt(6, 120, 44).out.keys()].filter((id) => id === nodeId(3, 'Hawaii') || ancestors(id).includes(nodeId(3, 'Hawaii')));
  assert.equal(hi.length, 4, hi.join(' | '));
});
test('the layout does not depend on ratings (pills do not jump while scrubbing) unless nothing can merge further', () => {
  const a = layoutAt(5, 160, 56, () => 0).out, b = layoutAt(5, 160, 56, (id) => (nameOf(id).length * 7) % 100).out;
  assert.deepEqual([...a].sort(), [...b].sort());
});
test('pills keep clear of the pins that stay (focused, favourites) where they can', () => {
  const bay = nodeId(1, 'Bay Area'), base = layoutAt(6, 160, 56); assert.ok(base.out.has(bay));
  const r = base.rect(bay), pin = {left: r.left + 10, top: r.top + 10, right: r.left + 140, bottom: r.top + 40};   // a kept pin right on the Bay Area pill
  const again = layoutAt(6, 160, 56, () => 0, [pin]);
  const drawn = [...again.out.keys()].filter((id) => !overlaps(again.rect(id), pin));
  assert.equal(drawn.length, again.out.size, `pills over the pin: ${[...again.out.keys()].filter((id) => overlaps(again.rect(id), pin)).join(', ')}`);
});
test('when nothing can merge further, the pills are placed in priority order (focused, favourites, best)', () => {
  const box = (id: NodeId): Rect => ({left: id.length, right: id.length + 100, top: 0, bottom: 40}), leaves = [nodeId(3, 'West Coast'), nodeId(3, 'Hawaii'), nodeId(3, 'East Coast')];
  const order = (prio: (id: NodeId) => number) => [...layoutPills(leaves, box, prio, [], 0).keys()];
  assert.equal(order((id) => (id.includes('East') ? 2 * TIER : 0))[0], nodeId(3, 'East Coast'));
  assert.equal(order((id) => (id.includes('Hawaii') ? 80 : 10))[0], nodeId(3, 'Hawaii'));
});

const word = (c: string) => c.charAt(0) + c.slice(1).toLowerCase(), COLOR = {good: 'G', fair: 'F', poor: 'P', none: 'N'} as const;
test('after dark: a dark spot is never the best while a daylit one is rated; when all are dark the pill says "After dark", not "Best"', () => {
  const mixed = summarise([st('night', 90, 'good', true, true), st('day', 50, 'fair')]);
  assert.equal(mixed.best!.id, 'day'); assert.equal(mixed.allDark, false);
  const allDark = summarise([st('a', 90, 'good', true, true), st('b', 50, 'fair', true, true)]);
  assert.equal(allDark.best!.id, 'a'); assert.equal(allDark.allDark, true);
  const t = pillText('Bay Area', allDark, word, COLOR);
  assert.match(t.html, /After dark ·<\/span> Solid/); assert.doesNotMatch(t.html, /Best/); assert.match(t.label, /after dark, the highest is solid at a/);
});
test('wording: "No ratings yet · loading" while spots are unloaded, "No ratings this hour" when all are loaded; "Best of M/N" when partly loaded; band words with colours', () => {
  assert.match(pillText('X', summarise([st('a', null, 'none'), st('b', null, 'none', false)]), word, COLOR).html, /No ratings yet · loading/);
  assert.match(pillText('X', summarise([st('a', null, 'none'), st('b', null, 'none')]), word, COLOR).html, /No ratings this hour/);
  assert.match(pillText('X', summarise([st('a', null, 'none', false)]), word, COLOR).html, /Not loaded yet/);
  const part = pillText('X', summarise([st('a', 70, 'good'), st('b', 30, 'poor'), st('c', null, 'none', false)]), word, COLOR);
  assert.match(part.html, /Best of 2\/3:<\/span> Solid/); assert.match(part.label, /best of the 2 loaded of 3: solid at a/);
  assert.match(part.label, /1 in the good band \(green\), 1 in the poor band \(red\), 1 not loaded/);
  const full = pillText('X', summarise([st('a', 70, 'good'), st('b', null, 'none')]), word, COLOR);
  assert.match(full.html, /Best:<\/span> Solid/); assert.match(full.label, /1 not rated \(grey\)/); assert.ok(full.title.endsWith(BAR_KEY)); assert.equal(full.color, 'G');
  assert.doesNotMatch(full.html + full.label, /average|mean/i);
});
test('a tie on score goes to the higher pin rank (the pins\' own priority), then the earlier spot', () => {
  assert.equal(summarise([st('a', 60, 'fair', true, false, 10), st('b', 60, 'fair', true, false, 2000)]).best!.id, 'b');
  assert.equal(summarise([st('a', 60, 'fair', true, false, 5), st('b', 60, 'fair', true, false, 5)]).best!.id, 'a');
});
test('a pill that cannot be placed and overlaps nothing where it stands merges with its NEAREST placed pill, not an arbitrary one', () => {
  // A and B (Florida) stack, so B is nudged down; D (Florida, short, off to the side) overlaps nothing but every nudge it may take would lift it above B, which is
  // north of it: it cannot be placed. A far West Coast pill W is placed first; the old fallback merged W. Now D merges with its nearest neighbour.
  const W = nodeId(0, 'San Diego'), A = nodeId(0, 'Space Coast'), B = nodeId(0, 'Treasure Coast'), D = nodeId(0, 'Southeast Florida');
  const fixed: Record<string, Rect> = {[W]: {left: 0, right: 100, top: -500, bottom: -460}, [A]: {left: 1000, right: 1100, top: 0, bottom: 40}, [B]: {left: 1000, right: 1100, top: 5, bottom: 45}, [D]: {left: 1300, right: 1400, top: 30, bottom: 40}};
  const out = layoutPills([W, A, B, D], (id) => fixed[id] ?? (nodes.has(id) ? {left: 5000, right: 5100, top: 5000, bottom: 5040} : null), () => 0);
  assert.ok(out.has(W), `the far pill is untouched: ${[...out.keys()].join(' | ')}`);
  assert.ok(out.has(nodeId(1, 'Florida')) && !out.has(D), [...out.keys()].join(' | '));
});

/* ---------- pills-snapshot: spots with no live record take the daily forecast, and the pill says so ---------- */
const sn = (id: string, score: number | null, band: SpotState['band'], dark = false, rank = 0, retrieved = RUN): SpotState => ({...st(id, score, band, false, dark, rank), snap: true, retrieved});
const NOWMS = Date.parse('2026-11-10T17:00:00Z'), RUN = Date.parse('2026-11-10T07:40:00Z');   // the run is 9 h 20 min old
const SNAP = {nowMs: NOWMS, fmt: (ms: number) => new Date(ms).toISOString().slice(5, 16).replace('T', ' ') + ' UTC'};
test('far coasts: Hawaii seen from Ocean Beach (nothing loaded) reads from the daily forecast with its AGE in the visible key, not "Not loaded yet"; with no snapshot it still says "Not loaded yet"', () => {
  const hawaii = summarise([sn('a', 70, 'good'), sn('b', 40, 'fair'), sn('c', 10, 'poor'), sn('d', null, 'none')]);
  assert.deepEqual([hawaii.total, hawaii.loaded, hawaii.snap], [4, 0, 4]); assert.equal(hawaii.best!.id, 'a'); assert.equal(hawaii.best!.snap, true); assert.deepEqual([hawaii.snapFrom, hawaii.snapTo], [RUN, RUN]);
  const t = pillText('Hawaii', hawaii, word, COLOR, SNAP);
  assert.match(t.html, /<span class="xc-k">Best<span class="xc-kl">, forecast 9 h old<\/span>:<\/span> Solid/, 'the age is in the key on a wide screen'); assert.match(t.html, /<small class="xc-age">striped = forecast 9 h old<\/small>/, 'and on its own line on the phone, with what the stripes mean (the counts line is hidden there)'); assert.doesNotMatch(t.html, /Not loaded yet/); assert.match(t.html, /4 spots · 4 forecast, striped/);
  assert.match(t.label, /best, from the daily forecast \(model run 9 h old\): solid at a/); assert.match(t.label, /1 from the daily forecast, in the good band \(green\)/);
  assert.match(t.label, /Daily forecast: the model run retrieved 11-10 07:40 UTC \(9 h old\), rated with the current rules as of that run; not live\. A pin loads the newest run, so the two can differ\./); assert.doesNotMatch(t.label, /re-rated now|captured/); assert.equal((t.label.match(/not live/g) ?? []).length, 1, 'one source line');
  assert.match(t.title, /striped segments are from the daily forecast, not live/); assert.match(t.html, /class="xc-snap"[^>]*background:G/); assert.doesNotMatch(t.html, /class="xc-unl"/);
  assert.match(pillText('Hawaii', summarise([sn('a', 70, 'good')].map((x) => ({...x, snap: false}))), word, COLOR).html, /Not loaded yet/, 'a spot with no snapshot value and no live record is not loaded');
  assert.match(pillText('Hawaii', hawaii, word, COLOR).html, /Not loaded yet/, 'no snapshot (hour outside the 48 h, no capture, request failed): the pill does not use the spots\' daily-forecast values');
});
test('the age is the BEST spot\'s own model run; a range of runs is said in the label; the age reads in minutes, hours and days', () => {
  const OLD = Date.parse('2026-11-08T17:00:00Z'), g = summarise([sn('best', 80, 'good', false, 0, OLD), sn('other', 30, 'poor', false, 0, RUN)]);
  const t = pillText('X', g, word, COLOR, SNAP); assert.match(t.html, /Best<span class="xc-kl">, forecast 2 d old<\/span>:/); assert.match(t.label, /the model run retrieved 11-08 17:00 UTC to 11-10 07:40 UTC \(2 d old\)/);
  assert.match(pillText('X', summarise([sn('a', 50, 'fair', false, 0, NOWMS - 40 * 60000)]), word, COLOR, SNAP).html, /, forecast 40 min old/);
});
test('"Best of covered/total" whenever spots stay uncovered, the snapshot variant included; "Loading forecast…" while the snapshot is fetched, never "Not loaded yet" then', () => {
  const part = pillText('X', summarise([sn('a', 70, 'good'), st('b', 30, 'poor'), st('c', null, 'none', false)]), word, COLOR, SNAP); assert.match(part.html, /Best of 2\/3<span class="xc-kl">, forecast 9 h old<\/span>:/); assert.match(part.label, /best of the 2 covered of 3, from the daily forecast/); assert.match(part.label, /1 not loaded/);
  const liveBest = pillText('X', summarise([st('a', 80, 'good'), sn('b', 40, 'fair'), st('c', null, 'none', false)]), word, COLOR, SNAP); assert.match(liveBest.html, /Best of 2\/3:<\/span> Solid/); assert.match(liveBest.label, /best of the 2 covered of 3: solid at a/);
  const none = summarise([st('a', null, 'none', false)]); assert.match(pillText('X', none, word, COLOR, SNAP, true).html, /Loading forecast…/); assert.doesNotMatch(pillText('X', none, word, COLOR, SNAP, true).html, /Not loaded yet/); assert.match(pillText('X', none, word, COLOR, SNAP, false).html, /Not loaded yet/);
});
test('live values stay live: a live record wins a tie, the live and the snapshot spots are counted apart, the bar marks the snapshot segments, the pill names both counts', () => {
  const g = summarise([st('live-fair', 55, 'fair'), sn('snap-fair', 55, 'fair'), sn('snap-good', 70, 'good'), st('live-poor', 20, 'poor'), st('cold', null, 'none', false)]);
  assert.deepEqual([g.loaded, g.snap, g.counts.fair, g.counts.poor, g.snapCounts.fair, g.snapCounts.good], [2, 2, 1, 1, 1, 1]);
  assert.equal(g.best!.id, 'snap-good', 'the best spot is the highest rating, and the pill says it is from the daily forecast');
  const tie = summarise([sn('a', 60, 'fair', false, 999), st('b', 60, 'fair', true, false, 1)]); assert.equal(tie.best!.id, 'b', 'a live value beats a daily-forecast value of the same score whatever the rank');
  const t = pillText('Northern California', g, word, COLOR, SNAP);
  assert.match(t.html, /5 spots · 2 live · 2 forecast, striped/); assert.match(t.label, /1 live, in the fair band/); assert.match(t.label, /1 from the daily forecast, in the fair band/); assert.match(t.label, /1 not loaded/); assert.match(t.html, /xc-unl/);
  assert.doesNotMatch(t.html + t.label, /average|mean/i);
});
test('after dark from the daily forecast says so (with the age), and a snapshot spot in the dark is never the best while a daylit one is rated', () => {
  const dark = pillText('Hawaii', summarise([sn('a', 90, 'good', true), sn('b', 50, 'fair', true)]), word, COLOR, SNAP); assert.match(dark.html, /After dark<span class="xc-kl">, forecast 9 h old<\/span> ·<\/span> Solid/);
  const mixed = summarise([sn('night', 90, 'good', true), sn('day', 50, 'fair')]); assert.equal(mixed.best!.id, 'day');
});
