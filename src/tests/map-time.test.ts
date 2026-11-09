import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stampLabel, mapDayKey, mapWhen, mapHour, mapWeekShort, mapZoneAbbr} from '../features/explore/mapTime.ts';
import {MAP_TIME_ZONE, setActiveZone, activeZone, timeZoneOf} from '../ocean/spotZone.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';

test.after(() => setActiveZone(null));
test('the global map surfaces use ONE explicit zone: a Honolulu selection does not mix zones in the stamp, the strip days or the hour labels', () => {
  evidenceSpots.push({...evidenceSpot('spot-2'), id: 'zz-hnl', timeZone: 'Pacific/Honolulu'} as any);
  try {
    setActiveZone(timeZoneOf('zz-hnl')); assert.equal(activeZone(), 'Pacific/Honolulu');
    const iso = '2026-11-10T07:30:00Z';   // 11:30 PM Nov 9 in Los Angeles, 9:30 PM Nov 9 in Honolulu
    assert.equal(MAP_TIME_ZONE, 'America/Los_Angeles'); assert.equal(stampLabel(iso), 'Mon, Nov 9 · 11:30 PM', 'date and hour come from the same (map) zone');
    assert.equal(mapHour(iso), '11 PM'); assert.equal(mapZoneAbbr(iso), 'PST'); assert.equal(mapZoneAbbr('2026-07-10T07:30:00Z'), 'PDT'); assert.equal(mapWhen(iso), 'Mon 11 PM');
    assert.equal(mapDayKey('2026-11-10T07:59:00Z'), '2026-11-09'); assert.equal(mapDayKey('2026-11-10T08:00:00Z'), '2026-11-10', 'the strip cuts days at the map zone midnight (08:00 UTC), not at Honolulu midnight (10:00 UTC)');
    assert.equal(mapWeekShort('2026-11-10T08:00:00Z'), 'Tue 10');
    // a per-spot label is in the spot's own zone: the two coexist
    assert.equal(new Intl.DateTimeFormat('en-US', {timeZone: timeZoneOf('zz-hnl'), hour: 'numeric', minute: '2-digit'}).format(new Date(iso)), '9:30 PM');
  } finally { evidenceSpots.splice(evidenceSpots.findIndex((x) => x.id === 'zz-hnl'), 1); }
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
