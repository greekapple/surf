import test from 'node:test';
import assert from 'node:assert/strict';
import {spotHourOf} from '../services/spotHour.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile, demoBoards} from '../data/demo.ts';

const T = 1792454400, NOW = T * 1000 + 600000, times = Array.from({length: 24}, (_, i) => T + i * 3600), spot = allSpots.find((s) => s.id === 'spot-2')!;
const marine = (hs: number) => ({latitude: 37.75, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => hs + 0.05), swell_wave_height: times.map(() => hs), swell_wave_direction: times.map(() => 263.49), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}});
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 4), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 4)}};
import fs from 'node:fs';
import {boardPickFor, rankBoards, recommended} from '../features/quiver/fit.ts';
import {scoreBoard} from '../recommendation/board.ts';

// T-099: Home's quiver pick, Board Match and Personal call ONE function (boardPickFor) for a spot-hour, so for the same spot-hour and height
// they name the same board. Checked for Ocean Beach (spot-2) and Linda Mar (spot-3), in both ranking modes.
const recFor = (id: string, hs: number) => toLegacy(normalizeOpenMeteo(evidenceSpot(id), marine(hs), weather, new Date(T * 1000).toISOString())[1]);
for (const [id, name] of [['spot-2', 'Ocean Beach'], ['spot-3', 'Linda Mar']] as const) {
  const s = allSpots.find((x) => x.id === id)!;
  test(`${name}: one board pick for the spot-hour (size mode = rankBoards on the spotHourOf headline)`, () => {
    for (const hs of [0.6, 1.2, 1.8, 2.6]) {
      const f = recFor(id, hs), choice = boardPickFor(demoBoards, s, f, NOW, defaultProfile, {});
      const h = spotHourOf(s, f, NOW, defaultProfile, {}).surf.headline;
      const est: [number, number] | null = h.kind === 'estimate' ? [h.loFt, h.hiFt] : null;
      assert.deepEqual(choice.est, est, `${name} ${hs} m: the pick uses the same headline as every surface`);
      if (choice.mode === 'size') assert.equal(choice.pick?.id ?? null, recommended(rankBoards(demoBoards, est, f.primary?.period ?? null))[0]?.board.id ?? null);
      if (choice.pick) { const r = choice.ranked.find((x) => x.board.id === choice.pick!.id)!; if (choice.mode === 'size') assert.ok(r.size.state === 'in' || r.size.state === 'edge', 'the pick suits the size'); }
      // the same inputs give the same answer (Home, Board Match and Personal pass exactly these)
      assert.equal(boardPickFor(demoBoards, s, f, NOW, defaultProfile, {}).pick?.id, choice.pick?.id);
    }
  });
  test(`${name}: with a measured face and character the full scoring decides, still one pick`, () => {
    const f: any = {...recFor(id, 1.5), face: 5, character: 'Peaky', availability: {face: true, swell: true, wind: true, tide: true, organization: true}};
    const choice = boardPickFor(demoBoards, s, f, NOW, defaultProfile, {});
    assert.equal(choice.mode, 'score');
    const top = demoBoards.map((b) => scoreBoard(b, f, defaultProfile, choice.est)).sort((a, b) => b.score - a.score).find((x) => x.eligible)?.board.id ?? null;
    assert.equal(choice.pick?.id ?? null, top);
  });
}
test('all three screens use boardPickFor and no other board ranking (the preference-range heuristic is gone)', () => {
  const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const f of ['../features/home/Welcome.tsx', '../features/quiver/QuiverView.tsx', '../features/personal/PersonalView.tsx']) {
    const src = read(f);
    assert.match(src, /boardPickFor\(/, `${f} calls boardPickFor`);
    assert.doesNotMatch(src, /pickBoard\(|recommended\(rankBoards|rankBoards\(boards/, `${f} has no second ranking`);
  }
  assert.equal(fs.existsSync(new URL('../features/personal/recommend.ts', import.meta.url)), false);
});
