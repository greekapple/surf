import test from 'node:test';
import assert from 'node:assert/strict';
import {dotNumber, dotFace, swellFrom, inkFor} from '../features/explore/dots.ts';
import {headlineSurf, headlineText, type HeadlineSurf} from '../services/headlineSurf.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';

test('map-dots: the dot number is the midpoint of the page\'s own range text, in the person\'s unit', () => {
  assert.equal(dotNumber('4–6 ft', 'ft'), '5');
  assert.equal(dotNumber('3–4 ft', 'ft'), '3');   // a midpoint between two steps rounds DOWN: the dot never reads bigger than the range
  assert.equal(dotNumber('1–2 ft', 'ft'), '1');
  assert.equal(dotNumber('5–8 ft', 'ft'), '6');
  assert.equal(dotNumber('1.2–1.5 m', 'm'), '1.3');
  assert.equal(dotNumber('up to 0.2 m', 'm'), '<.3');
  assert.equal(dotNumber('up to 1.5 m', 'm'), '≤1.5');
  assert.equal(dotNumber('2–3 ft ≈ Hawaiian', 'ft'), '2');
  assert.equal(dotNumber('0–1 ft', 'ft'), '<1');
  assert.equal(dotNumber('Flat', 'ft'), '<1');
  assert.equal(dotNumber('1.2–1.8 m', 'm'), '1.5');
  assert.equal(dotNumber('0.1–0.3 m', 'm'), '<.3');
  assert.equal(dotNumber('up to 3 ft', 'ft'), '≤3');
  assert.equal(dotNumber('about 4 ft', 'ft'), '4');
  assert.equal(dotNumber('6 ft', 'ft'), '6');
  assert.equal(dotNumber('Unavailable', 'ft'), null);
  assert.equal(dotNumber('—', 'ft'), null);
});

test('map-dots: the dot style says the kind of number; an offshore height is never a dot number', () => {
  const p = defaultProfile;
  const off = {kind: 'offshore', ft: 7, label: 'offshore · not surf size'} as HeadlineSurf;
  const f = dotFace(off, headlineText(off, p), 'ft', {loaded: true});
  assert.equal(f.kind, 'off'); assert.equal(f.num, null); assert.match(f.words, /offshore · not surf size/);
  assert.deepEqual(dotFace(null, null, 'ft', {loaded: false}), {kind: 'none', num: null, faded: false, words: 'not loaded yet'});
  assert.equal(dotFace(null, null, 'ft', {loaded: false, snap: true}).kind, 'snap');
  assert.equal(dotFace(null, null, 'ft', {loaded: false, snap: true}).num, null);
  const demo = {kind: 'demonstration', ft: 4, label: 'Demonstration'} as HeadlineSurf;
  assert.equal(dotFace(demo, headlineText(demo, p), 'ft', {loaded: true}).num, null);
});

const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, times = Array.from({length: 72}, (_, i) => T0 + i * 3600);
const marineBig = {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'}, hourly: {time: times, wave_height: times.map(() => 3.1), swell_wave_height: times.map(() => 3), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 270), secondary_swell_wave_period: times.map(() => 8)}};
test('map-dots: every dot number is the spot page\'s number for the same hour, of the same kind (real records)', () => {
  let checked = 0;
  for (const id of ['spot-2', 'spot-0', 'spot-3']) {
    const spot = allSpots.find((s) => s.id === id)!;
    const recs = normalizeOpenMeteo(evidenceSpot(id), marineBig as never, {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 3), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}} as never, '2026-11-02T00:00:00Z').map(toLegacy);
    for (const unit of ['ft', 'm'] as const) for (const scale of ['Face', 'Hawaiian'] as const) {
      const p = {...defaultProfile, heightUnit: unit, scale} as typeof defaultProfile;
      for (const hour of recs.filter((_, i) => i % 6 === 0)) {
        const page = headlineText(headlineSurf(spot.id, hour, {bundle: null, nowMs: Date.parse('2026-11-02T00:00:00Z')}), p);   // what the spot page shows (SpotPage surfOf: headlineText(headlineSurf(...)))
        const h = headlineSurf(id, hour, {bundle: null, nowMs: Date.parse('2026-11-02T00:00:00Z')}), face = dotFace(h, headlineText(h, p), unit, {loaded: true});
        const nums = [...page.value.replace(/≈ Hawaiian/, '').matchAll(/[\d.]+/g)].map((m) => Number(m[0]));
        if (h.kind === 'estimate' && nums.length) {
          assert.equal(face.kind, 'est');
          const mid = nums.length === 2 ? (nums[0] + nums[1]) / 2 : nums[0];
          const down = (x: number) => Math.ceil(x - 0.5 - 1e-9);
          assert.equal(face.num, unit === 'm' ? (mid < 0.3 ? '<.3' : String(down(mid * 10) / 10)) : mid < 1 ? '<1' : String(down(mid)), `${id} ${hour.timestamp} ${page.value}`);
          assert.ok(Number(face.num.replace(/[<≤]/, '')) <= nums[nums.length - 1] + 1e-9, 'the dot never exceeds the top of the range');
          checked++;
        } else if (h.kind === 'official') assert.equal(face.kind, 'nws');
        else assert.equal(face.num, null);
      }
    }
  }
  assert.ok(checked > 0, 'some estimate hours were compared');
});

test('map-dots: the swell tick needs a swell partition; the number ink keeps contrast', () => {
  assert.equal(swellFrom({height: 1.2, direction: 290, period: 12}), 290);
  assert.equal(swellFrom({height: 0, direction: 290, period: 12}), null);
  assert.equal(swellFrom({height: NaN, direction: 290, period: 12}), null);
  assert.equal(swellFrom(null), null);
  assert.equal(inkFor([0x24, 0x8a, 0x3d]), 'dark');    // --good light: dark ink has the higher contrast (4.8:1 vs 4.4:1)
  assert.equal(inkFor([0x50, 0x60, 0x6c]), 'light');   // --poor dark: white number
  assert.equal(inkFor([0xd9, 0xb8, 0x4a]), 'dark');    // --fair dark: dark number
});
