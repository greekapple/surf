import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FEMALE, FEMALE_HAIR, STANDARD, figureOf} from '../ui/personPaths.ts';
import {callFor} from '../services/call.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile} from '../data/demo.ts';
import {PERSONAL_KEYS, WHY, ageAnswer, guardProfile} from '../services/profileFields.ts';
import {validateState, freshState} from '../utils/storage.ts';
import type {UserProfile} from '../models/index.ts';

const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
/** The absolute y extent of an SVG path (absolute M/L/H/V/Q/C and relative m/l/h/v/q/c commands). */
function yExtent(d: string): [number, number] {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+/g)!; let x = 0, y = 0, cmd = '', i = 0, lo = Infinity, hi = -Infinity; const n = () => Number(tok[i++]);
  const see = (yy: number) => { lo = Math.min(lo, yy); hi = Math.max(hi, yy); };
  while (i < tok.length) { if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++]; const rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase();
    if (c === 'Z') continue;
    if (c === 'H') { const v = n(); x = rel ? x + v : v; see(y); continue; }
    if (c === 'V') { const v = n(); y = rel ? y + v : v; see(y); continue; }
    const pairs = c === 'Q' ? 2 : c === 'C' ? 3 : 1; let nx = x, ny = y;
    for (let k = 0; k < pairs; k++) { const a = n(), b = n(); nx = rel ? x + a : a; ny = rel ? y + b : b; see(ny); }
    x = nx; y = ny; }
  return [lo, hi];
}
const T0 = Date.parse('2026-11-02T00:00:00Z') / 1000, times = Array.from({length: 48}, (_, i) => T0 + i * 3600);
const recs = (m: number) => normalizeOpenMeteo(evidenceSpot('spot-2')!, {latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's'},
  hourly: {time: times, wave_height: times.map(() => m + .1), swell_wave_height: times.map(() => m), swell_wave_direction: times.map(() => 280), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => null), secondary_swell_wave_direction: times.map(() => null), secondary_swell_wave_period: times.map(() => null)}},
  {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 6)}}, '2026-11-02T00:00:00Z').map(toLegacy);
const spot = allSpots.find((s) => s.id === 'spot-2')!;
const prof = (o: Partial<UserProfile>): UserProfile => ({...defaultProfile, heightUnit: 'ft', scale: 'Face height', ...o});

test('sex: female draws the female figure; male, prefer not to say and no answer draw the standard one', () => {
  assert.equal(figureOf(prof({sex: 'female'})), 'female');
  for (const s of ['male', 'prefer-not', null, undefined] as const) assert.equal(figureOf(prof({sex: s})), 'standard');
});

test('sex: both figures are the same height in the same box, so each is scaled from the person\'s height alike', () => {
  const [sLo, sHi] = yExtent(STANDARD), [fLo, fHi] = yExtent(FEMALE), [hLo] = yExtent(FEMALE_HAIR);
  assert.equal(fHi, sHi, 'feet on the same line'); assert.equal(sHi, 99.8);
  assert.equal(hLo, 0.6, 'the top of the hair is the top of the standard head (circle cy 7, r 6.4)');
  assert.ok(fLo >= 0 && sLo >= 0);
});

test('sex: never touches the Call, ratings or Board Match', () => {
  for (const m of [0.8, 2.5, 4]) { const r = recs(m);
    const call = (sex: UserProfile['sex']) => JSON.stringify([16, 20, 23].map((k) => callFor(spot, r[k], prof({sex}), {records: r, nowMs: Date.parse('2026-11-02T18:00:00Z')})));
    for (const s of ['female', 'male', 'prefer-not', null] as const) assert.equal(call(s), call(undefined), `the Call is identical (${s})`);
  }
  assert.match(read('../ratings/adapters.ts'), /export function rateForecast\(s:SurfSpot,f:Forecast,now=Date\.now\(\),opts:\{night\?:boolean\}=\{\}\)/, 'the rating takes no profile at all');
  for (const dir of ['../services', '../ratings', '../recommendation', '../ocean']) for (const f of fs.readdirSync(new URL(dir, import.meta.url)).filter((x) => /\.tsx?$/.test(x) && x !== 'profileFields.ts'))   // profileFields.ts defines the question itself (its why line, the under-13 guard, delete)
    assert.doesNotMatch(read(`${dir}/${f}`), /\.sex\b|\bsex:/, `${dir}/${f} never reads sex`);
});

test('sex: personal (under 13 never saved), validated, deleted with the profile; its line says what it changes; every drawn person uses the one shape', () => {
  assert.ok((PERSONAL_KEYS as readonly string[]).includes('sex'));
  assert.equal(guardProfile(prof({sex: 'female'}), ageAnswer('under-13')).sex, undefined);
  assert.equal(guardProfile(guardProfile(prof({}), ageAnswer('under-13')), {sex: 'male'}).sex, undefined);
  assert.equal(validateState({...freshState(), profile: prof({sex: 'female'})}).profile.sex, 'female');
  assert.throws(() => validateState({...freshState(), profile: prof({sex: 'x' as never})}), /sex/);
  assert.match(WHY.sex, /person drawn next to the wave/); assert.match(WHY.sex, /never ratings, the Call or Board Match/);
  for (const f of ['../ui/WaveGlyph.tsx', '../features/forecast/SpotPage.tsx', '../features/scale/ScaleStage.tsx']) { const s = read(f); assert.match(s, /<PersonShape figure=/, `${f} draws the shared figure`); assert.doesNotMatch(s, /M9 15 h12 q5 1 5\.5 6/, `${f} has no private copy of the outline`); }
  for (const [f, re] of [['../features/home/Welcome.tsx', /figure=\{figureOf\(profile\)\}/], ['../features/personal/ProfileFields.tsx', /figure=\{figureOf\(p\)\}/], ['../features/forecast/ForecastView.tsx', /figure=\{figureOf\(p\)\}/]] as const) assert.match(read(f), re, `${f} passes the person's figure`);
  assert.match(read('../features/personal/ProfileFields.tsx'), /\['prefer-not', 'Prefer not to say'\]/);
});
