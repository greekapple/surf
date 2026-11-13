import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {CA_REGIONS, CA_ZONES, hiddenSpotId, isCaliforniaSpot, previewActive, visibleEvidence, visibleSpot} from '../ocean/regionGate.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {ZONES} from '../data/zones.ts';
import {freshState, validateState} from '../utils/storage.ts';
import {headlineSurf} from '../services/headlineSurf.ts';
import {assignmentFor, mopAssignments, mopPoint} from '../ocean/mop.ts';
import {docTitle} from '../app/titles.ts';

// ca-only: the app shows California only; the owner's preview shows the rest; nothing but the UI is gated.
const caByRegion = evidenceSpots.filter(isCaliforniaSpot);
// an independent rule, the coordinates: the California coast is latitude 32.4 to 42.0 and west of -114.0 (the Oregon "Curry" and Washington "Clallam" counties are above 42)
const caByCoordinates = evidenceSpots.filter((s) => (s.country ?? 'US') === 'US' && s.latitude >= 32.4 && s.latitude <= 42.0 && s.longitude < -114.0 && s.longitude > -125);

test('ca-only: the region rule and the coordinate rule pick the same California spots, and the count is stated', () => {
  assert.deepEqual(caByRegion.map((s) => s.id).sort(), caByCoordinates.map((s) => s.id).sort(), 'every California-region spot is inside California and vice versa');
  assert.ok(caByRegion.length > 200 && caByRegion.length < evidenceSpots.length / 2, `${caByRegion.length} California spots of ${evidenceSpots.length}`);
  assert.equal(visibleEvidence(null, false).length, caByRegion.length, 'the gated list has exactly the California spots');
  assert.equal(visibleEvidence({previewRegions: false}, true).length, caByRegion.length);
  assert.equal(visibleEvidence({previewRegions: true}, true).length, evidenceSpots.length, 'the owner preview lists every region');
  assert.equal(CA_ZONES.length, 5); for (const z of CA_ZONES) assert.ok(ZONES.some(([name]) => name === z), `${z} is a zone`);
  for (const r of ['Maui', 'Space Coast', 'Puerto Rico', 'Curry', 'Clallam', 'Lincoln', 'Sitka']) assert.ok(!CA_REGIONS.has(r), `${r} is not California`);
  for (const r of ['Del Norte', 'Humboldt', 'Big Sur', 'San Diego', 'Orange County', 'Santa Cruz']) assert.ok(CA_REGIONS.has(r), `${r} is California`);
  console.log(`ca-only gate: ${caByRegion.length} California spots of ${evidenceSpots.length} in the catalogue`);
});
test('ca-only: the catalogue the screens use (allSpots) agrees with the evidence list, region by region', () => {
  const byId = new Map(evidenceSpots.map((s) => [s.id, s] as const));
  for (const s of allSpots) { const e = byId.get(s.id); if (e) assert.equal(isCaliforniaSpot(s), isCaliforniaSpot(e), s.id); }
});
test('ca-only: preview on and off, and the build flag decides whether a stored field counts', () => {
  const hawaii = {region: 'Maui'}, ca = {region: 'Santa Cruz'};
  assert.equal(visibleSpot(ca, null, false), true); assert.equal(visibleSpot(hawaii, null, false), false);
  assert.equal(visibleSpot(hawaii, {previewRegions: false}, true), false, 'preview off: California only');
  assert.equal(visibleSpot(hawaii, {previewRegions: true}, true), true, 'preview on with the flag on: every region');
  assert.equal(visibleSpot(ca, {previewRegions: true}, true), true);
  assert.equal(visibleSpot(hawaii, {previewRegions: true}, false), false, 'flag off: a stored previewRegions is ignored');
  assert.equal(previewActive({previewRegions: true}, false), false); assert.equal(previewActive({previewRegions: true}, true), true); assert.equal(previewActive(undefined, true), false);
  assert.equal(visibleEvidence({previewRegions: true}, false).length, caByRegion.length, 'flag off + stored field: still California only');
  const maui = evidenceSpots.find((s) => s.region === 'Maui')!;
  assert.equal(hiddenSpotId(maui.id, null, false), maui.id, 'a shared link into a hidden region is recognised'); assert.equal(hiddenSpotId(maui.id, {previewRegions: true}, true), null);
  assert.equal(hiddenSpotId(caByRegion[0].id, null, false), null); assert.equal(hiddenSpotId('no-such-spot', null, false), null); assert.equal(hiddenSpotId(null, null, false), null);
});
test('ca-only: previewRegions defaults to false, is validated, and survives a backup round trip', () => {
  assert.equal(freshState().profile.previewRegions, false);
  const s = freshState(); s.profile.previewRegions = true; assert.equal(validateState(JSON.parse(JSON.stringify(s))).profile.previewRegions, true);
  const old = JSON.parse(JSON.stringify(freshState())); delete old.profile.previewRegions; assert.equal(validateState(old).profile.previewRegions, false, 'a backup from before the field is read as off');
  const bad = JSON.parse(JSON.stringify(freshState())); bad.profile.previewRegions = 'yes'; assert.throws(() => validateState(bad), /preview/i);
});
test('ca-only: the region-not-open page has its own title', () => { assert.match(docTitle('forecast', '', {notFound: 'region'}), /isn't open yet/); });

// every UI list goes through the gate (source check)
const read = (f: string) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const walk = (d: string): string[] => fs.readdirSync(new URL(`../../${d}`, import.meta.url), {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${d}/${e.name}`] : []));
const UI = ['src/features', 'src/app', 'src/ui', 'src/hooks'].flatMap(walk);
test('ca-only: UI files may read the whole evidence list only to look one spot up by id; every list is built from the gate', () => {
  // lookups by id (`.find(` / `.some(`) of a spot the screen already has: the allowlist, checked exactly so a new importer must be looked at
  const importsEvidence = UI.filter((f) => /import\s*\{[^}]*\bevidenceSpots\b[^}]*\}\s*from\s*'(\.\.\/)+ocean\/spots(\.ts)?'/.test(read(f))).sort();
  assert.deepEqual(importsEvidence, ['src/features/forecast/SpotBand.tsx', 'src/features/forecast/SpotPage.tsx', 'src/features/forecast/helpers.ts', 'src/features/forecast/tideNote.ts', 'src/features/home/Welcome.tsx', 'src/features/scale/solar.ts', 'src/hooks/useForecast.ts', 'src/hooks/useModelSpread.ts']);
  for (const f of importsEvidence) { const src = read(f), uses = [...src.matchAll(/evidenceSpots(\.\w+|\)|\[|,|;)/g)].map((m) => m[1]);
    assert.ok(uses.every((u) => u === '.find' || u === '.some'), `${f}: evidenceSpots is only looked up (.find/.some), got ${[...new Set(uses)].join(' ')}`);
    assert.ok(!/\.\.\.evidenceSpots|of evidenceSpots|\(evidenceSpots\)|evidenceSpots\.(filter|map|flatMap|slice|sort|forEach|reduce)/.test(src), `${f}: no list built from evidenceSpots`); }
  // the catalogue (allSpots) the same way
  const importsCatalog = UI.filter((f) => /from\s*'(\.\.\/)+data\/catalog(\.ts)?'/.test(read(f))).sort();
  assert.deepEqual(importsCatalog, ['src/app/routes.ts', 'src/app/store.tsx', 'src/features/explore/ExploreView.tsx', 'src/features/personal/PersonalView.tsx', 'src/hooks/useForecast.ts']);
  for (const f of importsCatalog) assert.ok(!/\b(allSpots|spots)\.(filter|map|flatMap|slice|sort|forEach|reduce)\(|\.\.\.(allSpots|spots)\b/.test(read(f).replace(/spotOptions\.\w+/g, '')) || f === 'src/app/store.tsx', `${f}: the catalogue is looked up, never listed`);
  // the screens that list spots read the gate (store.gate / spotOptions), not the catalogue
  for (const [f, needle] of [['src/features/explore/ExploreView.tsx', 'gate.evidence'], ['src/features/explore/FindSpots.tsx', 'gate.evidence'], ['src/features/explore/PointPanel.tsx', 'gate.evidence'], ['src/features/home/HomeView.tsx', 'gate.evidence'], ['src/features/personal/PersonalView.tsx', 'gate.evidence'], ['src/features/personal/ProfileFields.tsx', 'spotOptions'], ['src/features/explore/Compare.tsx', 'spotOptions'], ['src/app/Nav.tsx', 'spotOptions'], ['src/ui/NotFound.tsx', 'spotOptions']] as const) assert.ok(read(f).includes(needle), `${f} reads ${needle}`);
  const store = read('src/app/store.tsx'); assert.match(store, /spotOptions = useMemo\(\(\) => \(live \? gate\.evidence\.map/, 'the store builds spotOptions from the gate'); assert.match(store, /spots\.filter\(gate\.visible\)/, 'the demo list is gated too');
  assert.match(store, /hiddenSpotId\(/, 'a shared link to a hidden spot is recognised'); assert.match(read('src/app/App.tsx'), /hiddenSpot \? 'region'/); assert.match(read('src/ui/NotFound.tsx'), /This region isn't open yet/);
});
test('ca-only: owner tools exist only behind the build flag, which is on in dev and the private deploy and absent from the launch build', () => {
  const owner = read('src/features/personal/OwnerTools.tsx'); assert.match(owner, /if \(!OWNER_TOOLS\) return null/); assert.match(owner, /Preview regions not open yet/); assert.match(owner, /previewRegions: v/);
  assert.match(read('package.json'), /"build:cf:private": "[^"]*VITE_OWNER_TOOLS=true vite build/);
  assert.doesNotMatch(read('package.json').replace(/"build:cf:private"[^\n]*\n/, ''), /VITE_OWNER_TOOLS/, 'only the private build sets the flag');
  assert.doesNotMatch(read('.env.production'), /VITE_OWNER_TOOLS\s*=\s*true/); assert.match(read('.env.development'), /^VITE_OWNER_TOOLS=true$/m);
  assert.match(read('docs/specs/LAUNCH-GATE.md'), /VITE_OWNER_TOOLS/);
});
test('ca-only: nothing outside the UI was touched (capture, cron, how-right, SWAN, services keep every region)', () => {
  for (const f of ['services/forecast-service.mjs', 'services/surf-capture.mjs', 'src/services/howRightAll.ts', 'src/services/howRightSpots.ts', 'src/ocean/server.ts', 'src/ocean/pipeline.ts']) { let s = ''; try { s = read(f); } catch { continue; } assert.ok(!/regionGate/.test(s), `${f} does not use the region gate`); }
});

// CA headlines are byte-identical to forecast-trust (the hash was taken on a pristine checkout of forecast-trust e9059df and on this branch; the same 205 spots x 3 swell directions)
test('ca-only: California headlines are byte-identical to forecast-trust', () => {
  const FT = 1 / 0.3048, T = '2026-11-02T18:00:00.000Z', NOW = Date.parse('2026-11-02T12:00:00Z');
  const hourOf = (spotId: string) => ({spotId, timestamp: T, day: 0, hour: 18, face: NaN, offshore: 5.2, availability: {face: false, swell: true, wind: true, tide: true, organization: false}, evidence: undefined}) as any;
  const run = (spotId: string, dp: number) => { const a = assignmentFor(spotId)!, mk = (unit: any, value: number) => ({value, unit, source: {} as any}); const rec = {timestamp: T, height: mk('ft', 1.8 * FT), period: mk('s', 14), direction: mk('deg', dp), qualityFlag: 1, mopId: a.mopId, product: 'forecast'};
    return headlineSurf(spotId, hourOf(spotId), {bundle: {nearshore: [], mop: {[a.mopId]: {mopId: a.mopId, records: [rec], issue: null, retrievedAt: T, url: 'x'}}} as any, nowMs: NOW}); };
  const numbers = (h: any) => JSON.stringify({k: h.kind, lo: h.loFt, hi: h.hiFt, c: h.centralFt, m: h.method, band: h.band, i: h.interval, w: h.words, ft: h.ft, label: h.label, conf: h.confidence});
  const ca = mopAssignments.filter((a) => { const p = mopPoint(a.mopId); return p && p.lat >= 32.5 && p.lat <= 42 && p.lon < -117; }).map((a) => a.spotId).sort();
  const out: string[] = []; for (const id of ca) for (const dp of [200, 250, 290]) { let h: any; try { h = run(id, dp); } catch { h = {kind: 'error'}; } out.push(id + dp + numbers(h)); }
  assert.equal(ca.length, 205); assert.equal(out.length, 615);
  assert.equal(crypto.createHash('sha256').update(out.join('\n')).digest('hex').slice(0, 16), '483017460e6d2218');
});
