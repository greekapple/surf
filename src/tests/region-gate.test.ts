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

// ca-only-fix (data-honesty review of ca-only): every zone chip list, the hidden-spot state and the Home "saved" logic
import {zonesWithSpots, hiddenOnChoose} from '../ocean/regionGate.ts';
test('ca-only-fix 1-3: the chips on the map, Compare and Favorite spots are the zones that hold a gated spot (no Oregon, Hawaii or East Coast zone); the owner preview lists them all', () => {
  const ca = visibleEvidence(null, false), all = visibleEvidence({previewRegions: true}, true);
  const caZones = zonesWithSpots(ca), allZones = zonesWithSpots(all);
  assert.deepEqual(caZones, ['North Coast', 'Bay Area', 'Santa Cruz & Monterey', 'Central Coast', 'Southern California'].filter((z) => caZones.includes(z)));
  assert.ok(caZones.length >= 4 && caZones.every((z) => (CA_ZONES as readonly string[]).includes(z)), `California zones only: ${caZones.join(', ')}`);
  for (const bad of ['Oregon North Coast', 'Oregon South Coast', 'Washington Coast', 'Hawaii · Oahu', 'Florida', 'Maine', 'Alaska · Sitka']) assert.ok(!caZones.includes(bad) && allZones.includes(bad), `${bad}: hidden by default, offered with the preview`);
  const src = (f: string) => read(f);
  assert.match(src('src/features/explore/ExploreView.tsx'), /\['In view', 'All', \.\.\.zonesWithSpots\(evidenceSpots\)\]/);
  assert.match(src('src/features/explore/Compare.tsx'), /\['All', \.\.\.zonesWithSpots\(spotOptions\)\]/);
  assert.match(src('src/features/personal/PersonalView.tsx'), /\['All', \.\.\.zonesWithSpots\(spotOptions\)\]/);
  for (const f of ['src/features/explore/ExploreView.tsx', 'src/features/explore/Compare.tsx', 'src/features/personal/PersonalView.tsx']) assert.doesNotMatch(src(f), /\.\.\.ZONES\.map\(/, `${f}: no chip list built from all of ZONES`);
});
test('ca-only-fix 5 and 10: choosing a hidden spot from anywhere says "not open yet" and leaves the selection alone; the state clears when Forecast is left', () => {
  const maui = evidenceSpots.find((s) => s.region === 'Maui')!, ca = caByRegion[0];
  assert.equal(hiddenOnChoose(maui.id, null, false), maui.id); assert.equal(hiddenOnChoose(ca.id, null, false), null); assert.equal(hiddenOnChoose(maui.id, {previewRegions: true}, true), null);
  const store = read('src/app/store.tsx'), app = read('src/app/App.tsx');
  assert.match(store, /const hid = hiddenOnChoose\(id, profile\); if \(hid\) \{ setHiddenSpot\(hid\); setMissingSpot\(null\); const hq = [\s\S]*?hq\.set\('spot', slugFor\(id\)\); history\.replaceState[\s\S]*?return; \}/, 'setSpot stops at a hidden spot before it selects anything, and the URL names that spot (a reload shows the same page)');
  assert.match(store, /clearHiddenSpot = \(\) => \{ setHiddenSpot\(null\);[^}]*q\.delete\('spot'\)/, 'clearing drops ?spot= from the URL too');
  assert.match(app, /if \(area !== 'forecast' && hiddenSpot\) clearHiddenSpot\(\)/, 'leaving Forecast clears it, so Home then Forecast shows the forecast');
  assert.ok(store.indexOf('hiddenOnChoose(id, profile)') < store.indexOf('if (id !== view.selected) view.selectSpot(id)'), 'the hidden check comes before selectSpot');
});
test('ca-only-fix 6-9: Home asks nearIds with the gated list, saved spots that are all hidden count as none, the summary and Find spots follow the gate, and the wording does not promise a date', () => {
  const home = read('src/features/home/HomeView.tsx');
  assert.equal((home.match(/nearIds\(refIdEarly, evidenceSpots,/g) ?? []).length, 2, 'both nearIds calls get the gated list');
  assert.match(home, /const personal = saved\.some\(\(id\) => spotOptions\.some\(\(s\) => s\.id === id\)\)/, 'personal means at least one saved spot is shown');
  assert.match(read('src/features/personal/PersonalView.tsx'), /p\.region !== 'All regions' && spotOptions\.some\(\(x\) => x\.region === p\.region\) \? regionWithState/);
  assert.match(read('src/features/explore/FindSpots.tsx'), /No surf spot within 75 mi of you\. SWELLO covers California for now\./); assert.match(read('src/features/explore/FindSpots.tsx'), /Math\.min\(\.\.\.rows\.map\(\(r\) => r\.dist\)\) > 75/);
  const nf = read('src/ui/NotFound.tsx'); assert.match(nf, /is in a region that isn't open yet/); assert.doesNotMatch(nf, /opens later/);
});

// ca-scope: the load scope draws from the gated list, so a hidden spot is never requested even as a near neighbour of a California spot
import {computeScope, nearIds} from '../ocean/spotScope.ts';
test('ca-scope: with the gate, the scope of a California spot near the Oregon border holds no hidden spot; without it (the owner preview) it still can', () => {
  const gated = visibleEvidence(null, false), all = visibleEvidence({previewRegions: true}, true), hidden = new Set(all.filter((s) => !isCaliforniaSpot(s)).map((s) => s.id));
  const border = gated.find((s) => nearIds(s.id, all).some((id) => hidden.has(id)));
  assert.ok(border, 'a California spot with a hidden spot within 100 km exists (the Oregon border)');
  assert.ok(computeScope(border!.id, [], [], [], all).some((id) => hidden.has(id)), 'ungated scope includes a hidden neighbour');
  assert.ok(!computeScope(border!.id, [], [], [], gated).some((id) => hidden.has(id)), 'gated scope has none');
  assert.ok(!computeScope(gated[0].id, [[...hidden][0]].map(String), [], [], gated).some((id) => hidden.has(id)), 'a hidden favourite is not loaded either');
  assert.match(read('src/app/store.tsx'), /useForecast\(\{[^}]*spots: gate\.evidence\}\)/, 'the store gives useForecast the gated list');
  assert.match(read('src/hooks/useForecast.ts'), /computeScope\(selected,scopeInput\.favorites,scopeInput\.visible,scopeInput\.requested,scopeInput\.spots/);
});
