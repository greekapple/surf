import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stampLabel, mapDayKey, mapWhen, mapHour, mapWeekShort, mapZoneAbbr} from '../features/explore/mapTime.ts';
import {setMapZone, mapZone, labelZoneFor, differsFromViewer, zoneAbbr, setActiveZone, activeZone, timeZoneOf} from '../ocean/spotZone.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';

test.after(() => { setActiveZone(null); setMapZone(null); });
test('the global map surfaces use ONE explicit zone: a Honolulu selection does not mix zones in the stamp, the strip days or the hour labels', () => {
  evidenceSpots.push({...evidenceSpot('spot-2'), id: 'zz-hnl', timeZone: 'Pacific/Honolulu'} as any);
  try {
    setActiveZone(timeZoneOf('zz-hnl')); assert.equal(activeZone(), 'Pacific/Honolulu');
    setMapZone('America/Los_Angeles');   // the label zone of an LA viewer, or of a focused California spot
    const iso = '2026-11-10T07:30:00Z';   // 11:30 PM Nov 9 in Los Angeles, 9:30 PM Nov 9 in Honolulu
    assert.equal(mapZone(), 'America/Los_Angeles'); assert.equal(stampLabel(iso), 'Mon, Nov 9 · 11:30 PM', 'date and hour come from the same (map) zone');
    assert.equal(mapHour(iso), '11 PM'); assert.equal(mapZoneAbbr(iso), 'PST'); assert.equal(mapZoneAbbr('2026-07-10T07:30:00Z'), 'PDT'); assert.equal(mapWhen(iso), 'Mon 11 PM');
    assert.equal(mapDayKey('2026-11-10T07:59:00Z'), '2026-11-09'); assert.equal(mapDayKey('2026-11-10T08:00:00Z'), '2026-11-10', 'the strip cuts days at the map zone midnight (08:00 UTC), not at Honolulu midnight (10:00 UTC)');
    assert.equal(mapWeekShort('2026-11-10T08:00:00Z'), 'Tue 10');
    // a per-spot label is in the spot's own zone: the two coexist
    assert.equal(new Intl.DateTimeFormat('en-US', {timeZone: timeZoneOf('zz-hnl'), hour: 'numeric', minute: '2-digit'}).format(new Date(iso)), '9:30 PM');
  } finally { evidenceSpots.splice(evidenceSpots.findIndex((x) => x.id === 'zz-hnl'), 1); }
});
test('1A: the strip cuts days at the label zone midnight: Honolulu (10:00 UTC) and New York (05:00 UTC in winter, 04:00 in summer)', () => {
  try {
    setMapZone('Pacific/Honolulu');
    assert.equal(mapDayKey('2026-11-10T09:59:00Z'), '2026-11-09'); assert.equal(mapDayKey('2026-11-10T10:00:00Z'), '2026-11-10');
    assert.equal(mapWeekShort('2026-11-10T10:00:00Z'), 'Tue 10'); assert.equal(mapZoneAbbr('2026-11-10T10:00:00Z'), 'HST'); assert.equal(mapHour('2026-11-10T07:30:00Z'), '9 PM');
    assert.equal(stampLabel('2026-11-10T07:30:00Z'), 'Mon, Nov 9 · 9:30 PM', 'date and hour from the same zone');
    setMapZone('America/New_York');
    assert.equal(mapDayKey('2026-11-10T04:59:00Z'), '2026-11-09'); assert.equal(mapDayKey('2026-11-10T05:00:00Z'), '2026-11-10');
    assert.equal(mapDayKey('2026-07-10T03:59:00Z'), '2026-07-09'); assert.equal(mapDayKey('2026-07-10T04:00:00Z'), '2026-07-10');
    assert.equal(mapZoneAbbr('2026-11-10T05:00:00Z'), 'EST'); assert.equal(mapZoneAbbr('2026-07-10T04:00:00Z'), 'EDT');
    // the time steps are the same instants; only the day a step belongs to changes with the zone
    const steps = ['2026-11-10T06:00:00Z', '2026-11-10T09:00:00Z', '2026-11-10T12:00:00Z'];
    assert.deepEqual(steps.map(mapDayKey), ['2026-11-10', '2026-11-10', '2026-11-10']);
    setMapZone('Pacific/Honolulu'); assert.deepEqual(steps.map(mapDayKey), ['2026-11-09', '2026-11-09', '2026-11-10']);
  } finally { setMapZone(null); }
});
test('1A: the label zone follows the spot in view, else the viewer', () => {
  const hnl = 'Pacific/Honolulu', la = 'America/Los_Angeles', ldn = 'Europe/London';
  assert.equal(labelZoneFor('forecast', '', hnl, false, la), hnl, 'a Forecast page is in its spot\'s zone, focused on the map or not');
  assert.equal(labelZoneFor('explore', '', hnl, true, la), hnl, 'the map with Pipeline focused');
  assert.equal(labelZoneFor('explore', 'wind', 'America/New_York', true, ldn), 'America/New_York');
  assert.equal(labelZoneFor('explore', '', hnl, false, ldn), ldn, 'the map with nothing focused: the viewer');
  assert.equal(labelZoneFor('home', '', hnl, true, ldn), ldn, 'Home shows several spots: the viewer');
  assert.equal(labelZoneFor('explore', 'compare', hnl, true, la), la); assert.equal(labelZoneFor('explore', 'discover', hnl, true, la), la);
  assert.equal(setMapZone('Not/AZone'), la, 'an invalid zone falls back, never throws');
  setMapZone(null);
  assert.equal(zoneAbbr(la, '2026-11-10T07:30:00Z'), 'PST');
  assert.equal(differsFromViewer(la, '2026-11-10T07:30:00Z', la), false, 'an LA viewer on Ocean Beach: no tag (unchanged)');
  assert.equal(differsFromViewer(hnl, '2026-11-10T07:30:00Z', la), true);
  assert.equal(differsFromViewer(la, '2026-11-10T07:30:00Z', ldn), true, 'a London viewer on Ocean Beach sees PST');
});
test('multi-spot surfaces never fall back to the zone of the last spot opened: every clock helper call in them names its zone', () => {
  const files = ['src/app/Nav.tsx', 'src/features/explore/ExploreView.tsx', 'src/features/explore/FindSpots.tsx', 'src/features/explore/Compare.tsx', 'src/features/explore/PointPanel.tsx', 'src/features/explore/Panels.tsx'];
  const helpers = ['timeLabelPT', 'weekdayPT', 'dayNumPT', 'localHour', 'hourLabel', 'dayLabel', 'fullTimeLabel'], bad: string[] = [];
  for (const f of files) {
    const src = fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
    for (const h of helpers) {
      const re = new RegExp(`(?<![\\w.])${h}\\(`, 'g'); let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const ls = src.lastIndexOf('\n', m.index) + 1, prefix = src.slice(ls, m.index); if (/import|function |const \w+ = \(/.test(prefix)) continue;
        let j = m.index + m[0].length, depth = 1, comma = false; while (j < src.length && depth) { const c = src[j]; if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--; else if (c === ',' && depth === 1) comma = true; j++; }
        if (!comma) bad.push(`${f}: ${src.slice(m.index, Math.min(j, m.index + 60)).replace(/\n/g, ' ')}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'calls without an explicit zone: ' + bad.join(' | '));
});
test('correction: viewerTag names a spot clock only where it differs from the viewer; the viewer zone is read once', async () => {
  const {viewerTag, viewerZone} = await import('../ocean/spotZone.ts');
  const v = viewerZone(), iso = '2026-11-10T07:30:00Z';
  assert.equal(viewerZone(), v, 'stable across calls');
  assert.equal(viewerTag(v, iso), '', 'the viewer\'s own zone carries no tag');
  const other = v === 'Pacific/Honolulu' ? 'America/New_York' : 'Pacific/Honolulu';
  assert.match(viewerTag(other, iso), /^ (HST|EST)$/);
});
