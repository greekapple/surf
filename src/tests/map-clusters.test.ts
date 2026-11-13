import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ringSegments, clusterKey, parseClusterKey} from '../map/engine/dotIcon.ts';
import {pillText, dotFace} from '../features/explore/dots.ts';
import {headlineSurf, headlineText} from '../services/headlineSurf.ts';
import {defaultProfile} from '../data/demo.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';

const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');

test('map-clusters: the ring\'s segments are exactly each rating\'s share of the cluster\'s spots, in a fixed order', () => {
  const seg = ringSegments({good: 2, fair: 5, poor: 1, none: 2});
  assert.deepEqual(seg.map(([b, a, z]) => [b, Math.round((z - a) * 1000) / 1000]), [['good', 0.2], ['fair', 0.5], ['poor', 0.1], ['none', 0.2]]);
  assert.equal(seg[0][1], 0); assert.ok(Math.abs(seg[seg.length - 1][2] - 1) < 1e-9, 'the ring closes');
  for (let i = 1; i < seg.length; i++) assert.equal(seg[i][1], seg[i - 1][2], 'segments touch, no gaps or overlaps');
  assert.deepEqual(ringSegments({good: 0, fair: 3, poor: 0, none: 0}).map(([b]) => b), ['fair'], 'a band with no spots has no segment');
  assert.deepEqual(ringSegments({good: 0, fair: 0, poor: 0, none: 0}), []);
});

test('map-clusters: the cluster\'s number is how many spots it holds (the sum of its band counts), carried in its image name', () => {
  const c = {good: 3, fair: 7, poor: 2, none: 4}, colours = {good: '#0a0', fair: '#ca0', poor: '#888', none: '#aaa', surface: '#fff', text: '#111'};
  assert.deepEqual(parseClusterKey(clusterKey(c, colours)), c);
  assert.equal(parseClusterKey('swd|est|5'), null, 'a spot dot is not a cluster');
  // the engine sums one count per band in MapLibre's clusterProperties, so point_count === good + fair + poor + none for every cluster
  const eng = read('../map/engine/maplibreEngine.ts');
  assert.match(eng, /clusterProperties: \{\.\.\.Object\.fromEntries\(BANDS\.map\(\(b\) => \[b, \['\+', \['case', \['==', \['get', 'band'\], b\], 1, 0\]\]\]\)\)/);
  assert.match(eng, /const BANDS: RingBand\[\] = \['good', 'fair', 'poor', 'none'\];/);
  assert.match(read('../map/engine/dotIcon.ts'), /const n = c\.good \+ c\.fair \+ c\.poor \+ c\.none/, 'the drawn number is the spot count');
  // every spot sent to the engine carries its band (a spot with no rating is 'none'), so the four counts cover all of them
  assert.match(read('../features/explore/ExploreView.tsx'), /layer: 'spot', icon, prio, name: e\.name, dim: dark, band:/);
});

test('map-clusters: a pill shows the spot page\'s own range for the hour, shortened only in form', () => {
  assert.equal(pillText('4–6 ft'), '4–6 ft'); assert.equal(pillText('about 4 ft'), '~4 ft'); assert.equal(pillText('up to 3 ft'), '≤3 ft');
  assert.equal(pillText('Flat'), 'Flat'); assert.equal(pillText('1.2–1.8 m'), '1.2–1.8 m'); assert.equal(pillText('4–6 ft ≈ Hawaiian'), '4–6 ft (H)');
  assert.equal(pillText('—'), null); assert.equal(pillText('Unavailable'), null);
  // with real records: the pill text is the page's headlineText value
  const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, times = Array.from({length: 24}, (_, i) => T0 + i * 3600);
  for (const m of [0.6, 1.5, 3]) {
    const recs = normalizeOpenMeteo(evidenceSpot('spot-2')!, {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
      hourly: {time: times, wave_height: times.map(() => m + .1), swell_wave_height: times.map(() => m), swell_wave_direction: times.map(() => 280), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => null), secondary_swell_wave_direction: times.map(() => null), secondary_swell_wave_period: times.map(() => null)}},
      {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 6)}}, '2026-11-02T00:00:00Z').map(toLegacy);
    const h = headlineSurf('spot-2', recs[20], {nowMs: Date.parse('2026-11-02T18:00:00Z')}), t = headlineText(h, defaultProfile), face = dotFace(h, t, 'ft', {loaded: true});
    // (review) compared with the page's OWN string, not with pillText again: an estimate range is the page's text exactly
    if (face.kind === 'est') assert.equal(face.pill, t.value.replace(/\s*≈\s*Hawaiian/, ' (H)'), `the pill is the page's ${t.value}`);
    else if (face.kind === 'nws') assert.equal(face.pill, t.value.replace(/^up to /, '≤').replace(/^about /, '~'), `the pill is the NWS page's ${t.value}`);
    else assert.equal(face.pill, undefined, 'offshore or nothing: no size on the pill');
  }
});

test('map-clusters: layers only, kind styling kept, selected spot apart, far zoom clean, the status line never wider than the screen', () => {
  const eng = read('../map/engine/maplibreEngine.ts'), icon = read('../map/engine/dotIcon.ts');
  assert.match(eng, /cluster: true, clusterMaxZoom: Math\.floor\(to\)/);
  assert.match(eng, /id: 'swello-dots-sel', type: 'symbol', source: DOT_SRC/, 'the selected spot is its own unclustered source');
  assert.match(eng, /minzoom: o\.groupsFrom - ZOFF/, 'nothing below the cluster zoom (far out stays clean)');
  for (const k of ["i.kind === 'nws'", "i.kind === 'off'", "i.kind === 'snap'", 'setLineDash']) assert.ok(icon.includes(k), `pill keeps ${k}`);
  assert.match(icon, /text = i\.kind === 'off' \? 'off' : i\.kind === 'snap' \? '' : i\.pill/, 'offshore says "off", never a size; the daily forecast has no number');
  assert.match(read('../features/explore/explore.css'), /\.xb-right:has\(> \.xstatus\) \{ flex: 1 1 100%; order: 3; min-width: 0; max-width: 100%; \}/);
  // (data-honesty review) the ring counts only live ratings ('none' for a dot that shows nothing or the daily forecast), the selected spot is counted in its cluster,
  // a night cluster is dimmed like the pills, and 'none' is a hairline (never a grey arc that reads as 'poor')
  const ev = read('../features/explore/ExploreView.tsx');
  assert.match(ev, /band: face\.kind === 'none' \|\| face\.kind === 'snap' \? 'none' : band\}\);/);   // the selected spot is drawn on its own (not over its cluster)
  assert.match(eng, /dark: \['max', \['case', \['get', 'dim'\], 1, 0\]\]/); assert.match(eng, /'icon-opacity': \['case', \['==', \['get', 'dark'\], 1\], 0\.65, 1\]/);
  assert.match(icon, /g\.lineWidth = b === 'none' \? 1\.2 : ring/);
});

test('map-load: one status at a time, folded so no label is lost; slow only after 20 s, still worded as loading', () => {
  const ev = read('../features/explore/ExploreView.tsx');
  assert.match(ev, /export const SLOW_MS = 20000;/);
  assert.doesNotMatch(ev.replace(/\/\/.*$/gm, ''), /not loading/i, 'no text on screen says "not loading" (only a real failure says it could not load); comments aside');
  assert.match(ev, /\(taking longer than usual\)/);
  assert.match(ev, /const statusNow: 'fail' \| 'dark' \| 'note' \| null = failNote \? 'fail' : darkNow \? 'dark'/, 'failure > after dark > notes');
  assert.match(ev, /const phoneTop = \[srcWarn, seaNote,/, 'the one phone note leads with the source warning and carries the sea note, the cached map and the hour');
  assert.match(ev, /not a surf window\{phone \? \[fallbackName, cacheNote\]/, 'the after-dark note carries the model and cache labels at night');
});
