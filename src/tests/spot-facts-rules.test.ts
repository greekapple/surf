import test from 'node:test';
import assert from 'node:assert/strict';
import {enablement, clampWindow, pickMop, breakingProfileFromGuide, profileFromGuide, openSector, derivedFacing, isGeometrySource, wraps, GENERIC_MIN_PERIOD_S, MOP_NORMAL_TOLERANCE_DEG, type GuideFacts} from '../ocean/spotFactsRules.ts';
import {estimateBreaking, estimateBreakingV2} from '../ocean/breakingEstimate.ts';
import {guideFacts, guideFactsFor} from '../ocean/spotFactsSourced.ts';
import {breakingProfiles, breakingProfile} from '../ocean/localCalibration.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';
import {spotProfiles} from '../ocean/spotProfiles.ts';
import {mopAssignments, mopPoint, assignmentFor} from '../ocean/mop.ts';
import {profileProblems} from '../ocean/spotProfile.ts';

const src = [{url: 'https://example.test/guide', title: 't', site: 'surfnerd', retrievedOn: '2026-11-02'}];
const base: GuideFacts = {spotId: 'x', sources: src, facing: {text: 'W', deg: 270}, swellWindow: {text: 'S to NW', fromDeg: 180, toDeg: 315, basis: 'workable'}, idealSwell: null, surfnerdWorkableWind: null, tide: null, bottom: 'sand', waveType: 'beach', sizeFt: null, exposure: 'not stated', hazards: [], notes: ''};

test('enablement: facing and swell range are required; sheltered never; points, reefs and jetties need an explicit "exposed"', () => {
  assert.equal(enablement(base).estimate, true); assert.equal(enablement(base).shelter, 1);
  assert.match(enablement({...base, facing: null}).reasons.join(), /which way the beach faces/); assert.match(enablement({...base, swellWindow: null}).reasons.join(), /swell directions/);
  assert.match(enablement({...base, exposure: 'sheltered'}).reasons.join(), /sheltered/);
  assert.equal(enablement({...base, exposure: 'somewhat protected'}).estimate, true, 'a beach one source calls somewhat protected still estimates, with the narrower window');
  for (const t of ['point', 'reef', 'jetty'] as const) { assert.equal(enablement({...base, waveType: t}).estimate, false, t); assert.equal(enablement({...base, waveType: t, exposure: 'exposed'}).estimate, true, t); }
});
test('clampWindow: a wide published range is limited to ±60° of the facing; wrap and empty cases', () => {
  assert.deepEqual(clampWindow(180, 360, 270), [210, 330]); assert.deepEqual(clampWindow(270, 337.5, 315), [270, 337.5]);
  assert.deepEqual(clampWindow(270, 90, 270), [270, 330], 'W through E via N, facing W');
  assert.equal(clampWindow(270, 360, 202.5), null, 'nothing left within ±60° of a SSW-facing beach'); assert.deepEqual(clampWindow(0, 359, 90), [30, 150]);
});
test('MOP facing-match rule: Linda Mar (faces NW) takes SM382 among its own beach transects; Bolinas (faces SE) has no candidate within 25°; the tolerance is documented', () => {
  const lm = guideFactsFor('spot-3')!, bo = guideFactsFor('spot-0')!;
  assert.equal(MOP_NORMAL_TOLERANCE_DEG, 25);
  const pick = pickMop(lm, ['SM380', 'SM381', 'SM382', 'SM383', 'SM384', 'SM385'].map((id) => ({id, shoreNormalDeg: mopPoint(id)!.shoreNormalDeg}))); assert.equal(pick!.id, 'SM382'); assert.ok(pick!.offsetDeg < 4);
  assert.equal(new Set(['SM380', 'SM381', 'SM382', 'SM383', 'SM384', 'SM385'].map((id) => `${mopPoint(id)!.lat},${mopPoint(id)!.lon}`)).size, 1, 'the beach transects share one CDIP output point');
  assert.equal(pickMop(bo, [{id: 'MA140', shoreNormalDeg: mopPoint('MA140')!.shoreNormalDeg}]), null);
  assert.equal(assignmentFor('spot-3')!.mopId, 'SM382'); assert.equal(assignmentFor('spot-0')?.mopId, 'MA137'); assert.doesNotMatch(assignmentFor('spot-0')!.note, /facing-match rule/); assert.match(assignmentFor('spot-3')!.note, /facing-match rule/);
  for (const a of mopAssignments) assert.ok(a.sourceUrl.startsWith('https://'));
});
test('the breaking profile from a guide: generic 8 s minimum, shelter 1, window inside ±60°, shared unvalidated face factors', () => {
  const p = breakingProfileFromGuide(base)!; assert.equal(p.minPeriod, GENERIC_MIN_PERIOD_S); assert.equal(p.shelter, 1); assert.deepEqual(p.window, [210, 315]); assert.deepEqual(p.faceFactors, [0.7, 1.4]); assert.match(p.note, /generic 8 s/);
  assert.equal(breakingProfileFromGuide({...base, exposure: 'sheltered'}), null); assert.equal(breakingProfileFromGuide({...base, facing: null}), null);
});
test('Ocean Beach keeps its reviewed values; guide facing fills orientation only where it was null', () => {
  assert.equal(evidenceSpot('spot-2').orientation, 263.49); assert.deepEqual(breakingProfile('spot-2')!.window, [203, 323]);
  assert.equal(evidenceSpot('spot-3').orientation, 315); assert.equal(evidenceSpot('spot-0').orientation, 135); assert.equal(evidenceSpot('cs-shelter-cove').orientation, null);
  assert.equal(evidenceSpot('cs-pismo').orientation, 245, 'T-073: Pismo\'s facing is derived from coastline geometry');
});
test('provenance: every guide entry cites https pages with a retrieval date and the same spots the app lists; every derived value says "published guide"', () => {
  assert.deepEqual(guideFacts.map((f) => f.spotId).sort(), evidenceSpots.map((e) => e.id).sort());
  for (const f of guideFacts) { assert.ok(f.sources.length >= 1, f.spotId); for (const s of f.sources) assert.ok(/^https:\/\//.test(s.url) && /^\d{4}-\d\d-\d\d$/.test(s.retrievedOn) && s.title.length > 5, f.spotId); if (f.facing) assert.ok(f.facing.deg >= 0 && f.facing.deg < 360); if (f.swellWindow) assert.ok(f.swellWindow.fromDeg >= 0 && f.swellWindow.toDeg <= 360); }
  for (const p of spotProfiles) assert.deepEqual(profileProblems(p), [], p.spotId);
  const lm = spotProfiles.find((p) => p.spotId === 'spot-3')!; assert.equal(lm.orientation.provenance, 'published guide'); assert.equal(lm.periodResponse.provenance, 'published guide (generic)'); assert.equal(lm.mop.value!.id, 'SM382');
});
test('a sheltered spot with no published open sector gets facts but no estimate; a spot with no single facing and no "exposed" reef statement gets neither; coverage is 460 of 726 (spot expansion phases A, B, C, Hawaii (all islands), US East batch 1 and the California west-ca batch)', () => {
  assert.equal(breakingProfile('spot-7'), null); assert.equal(spotProfiles.find((p) => p.spotId === 'spot-7')!.orientation.value!.beachNormalDeg, 112.5);
  assert.match(enablement(guideFactsFor('spot-7')!).reasons.join(), /no source lists the swell directions it is open to/);
  assert.equal(breakingProfile('cs-shelter-cove'), null); assert.equal(spotProfiles.find((p) => p.spotId === 'cs-shelter-cove')!.orientation.value, null);
  assert.deepEqual(enablement(guideFactsFor('cs-shelter-cove')!).reasons, ['no source states which way the beach faces', 'a reef break needs a source that says it is exposed']);
  assert.equal(breakingProfiles.length, 460); assert.equal(spotProfiles.length, 726); assert.ok(breakingProfiles.every((p) => p.window[0] !== p.window[1] && p.minPeriod === 8 && p.shelter === (['spot-1', 'cs-huntington', 'cs-crescent-city', 'cs-rodeo-beach', 'cs-capitola'].includes(p.spotId) ? 0 : 1)), 'shelter 0 only at the sheltered open-sector spots');
  assert.ok(profileFromGuide({...base, facing: null, swellWindow: null}).orientation.value === null);
});
test('T-073 sheltered with a published open sector: shelter 0 so the offshore-swell v1 refuses, CDIP v2 estimates inside that sector only; a generic workable range is not enough', () => {
  const sh: GuideFacts = {...base, exposure: 'sheltered', facing: {text: 'SW', deg: 225, basis: 'guide'}, swellWindow: {text: 'SSE to SW, WSW to W', fromDeg: 157.5, toDeg: 270, basis: 'exposure'}};
  assert.equal(openSector(sh), true); assert.equal(enablement(sh).estimate, true); assert.equal(enablement(sh).shelter, 0);
  const p = breakingProfileFromGuide(sh)!; assert.deepEqual(p.window, [165, 270]); assert.equal(p.shelter, 0); assert.match(p.note, /Shelter 0 for the offshore-swell estimate \(v1 refuses\)/);
  assert.equal(estimateBreaking({swellHsFt: 6, periodS: 14, directionDeg: 225, combinedHsFt: 6}, p, 225).ok === false && (estimateBreaking({swellHsFt: 6, periodS: 14, directionDeg: 225, combinedHsFt: 6}, p, 225) as any).code, 'no-shelter', 'v1 refuses');
  assert.equal(estimateBreakingV2({hsFt: 4, periodS: 14, directionDeg: 225, depthM: 15, shoreNormalDeg: 225}, p).ok, true, 'v2 (CDIP, models the sheltering) estimates inside the open sector');
  assert.equal(enablement({...sh, swellWindow: {...sh.swellWindow!, basis: 'workable'}}).estimate, false, 'a workable range says what makes surf, not what the spot is open to');
  assert.equal(enablement({...sh, waveType: 'point', swellWindow: {...sh.swellWindow!, basis: 'workable'}}).estimate, false);
  assert.equal(enablement({...base, exposure: 'sheltered', swellWindow: null}).estimate, false);
  // the real spots: Stinson (Surfnerd sheltered crescent, open SSE–SW and WSW–W), Huntington and Crescent City estimate through their CDIP points; Cowell's (land in every direction) does not
  assert.deepEqual(breakingProfile('spot-1')!.window, [165, 270]); assert.deepEqual(breakingProfile('cs-huntington')!.window, [165, 285]); assert.deepEqual(breakingProfile('cs-crescent-city')!.window, [180, 225]);
  for (const id of ['spot-1', 'cs-huntington', 'cs-crescent-city', 'cs-rodeo-beach', 'cs-capitola']) { const f = guideFactsFor(id)!; assert.equal(f.exposure, 'sheltered', id); assert.equal(f.swellWindow!.basis, 'exposure', id); }
});
test('T-073 facing derived from coastline geometry: its own provenance and CDIP sources, never "published guide"; other facts keep the guide sources', () => {
  const cdip = {url: 'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/SL092_forecast.nc.ascii?metaShoreNormal', title: 'CDIP MOP shore normals (agency data) of SL092 244.5°', site: 'facing derived from CDIP coastline geometry', retrievedOn: '2026-11-02'};
  const d: GuideFacts = {...base, sources: [...src, cdip], facing: {text: 'WSW', deg: 245, basis: 'coastline geometry', sources: [cdip]}};
  assert.equal(derivedFacing(d), true); assert.equal(isGeometrySource(cdip), true);
  const p = profileFromGuide(d);
  assert.equal(p.orientation.provenance, 'derived from coastline geometry'); assert.deepEqual(p.orientation.sources.map((s) => s.url), [cdip.url]); assert.match(p.orientation.note!, /derived from coastline geometry/);
  assert.equal(p.swellWindow.provenance, 'published guide'); assert.ok(p.swellWindow.sources.every((s) => s.url !== cdip.url), 'the CDIP geometry source is not cited for guide facts');
  assert.match(breakingProfileFromGuide(d)!.note, /245° derived from coastline geometry/); assert.doesNotMatch(breakingProfileFromGuide(d)!.note, /guides \([^)]*CDIP/);
  // the real spot: Pismo's guide gives WSW and SW, so the facing comes from the CDIP shore normals near the pier
  const pf = guideFactsFor('cs-pismo')!; assert.equal(pf.facing!.basis, 'coastline geometry'); assert.equal(pf.facing!.deg, 245); assert.match(pf.notes, /different facings \(WSW, SW\)/);
  const pp = spotProfiles.find((x) => x.spotId === 'cs-pismo')!; assert.equal(pp.orientation.provenance, 'derived from coastline geometry'); assert.ok(pp.orientation.sources.every((s) => s.url.startsWith('https://thredds.cdip.ucsd.edu/')));
  for (const f of guideFacts) if (f.facing?.basis !== 'coastline geometry') assert.equal(spotProfiles.find((x) => x.spotId === f.spotId)!.orientation.provenance === 'derived from coastline geometry', false, f.spotId);
});
test('T-073 wrap rule: Rincon and Mavericks refuse because the guides\' working swell lies entirely outside ±60° of the stated facing', () => {
  for (const id of ['cs-rincon', 'spot-5']) { assert.equal(breakingProfile(id), null, id); assert.equal(assignmentFor(id)?.status, 'sourced', `${id}: T-130 gives the refused spot a reviewed MOP point but still NO breaking profile`); assert.match(enablement(guideFactsFor(id)!).reasons.join(), /wraps around the point or reef/, id); }
  assert.equal(wraps(guideFactsFor('cs-rincon')!), true); assert.equal(guideFactsFor('cs-rincon')!.workable!.text, 'W to N');
  assert.equal(guideFactsFor('cs-rincon')!.swellWindow!.basis, 'workable', 'Surfnerd\'s exposure list has a gap and is kept verbatim, so it gives no range');
  assert.equal(guideFactsFor('spot-5')!.exposure, 'exposed', 'the exposure statement is recorded; the wrap is why it refuses');
  assert.equal(wraps({...base, workable: {text: 'S to NW', fromDeg: 180, toDeg: 315}}), false); assert.equal(wraps({...base, workable: null}), false);
  for (const f of guideFacts) if (breakingProfile(f.spotId) && f.spotId !== 'spot-2') assert.equal(wraps(f), false, f.spotId);
});

import {headlineSurf, guideBasis} from '../services/headlineSurf.ts';
import {explainRating} from '../ratings/explain.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {nowcastFor} from '../services/nearshoreSelect.ts';
import {pickMop as pickMopRecord} from '../services/nearshoreSelect.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';

const T = 1792454400, NOW = T * 1000 + 600000, times = Array.from({length: 30}, (_, i) => T - 3600 + i * 3600);
const marine = {latitude: 37.6, longitude: -122.6, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'},
  hourly: {time: times, wave_height: times.map(() => 1.6), swell_wave_height: times.map(() => 1.5), swell_wave_direction: times.map(() => 315), swell_wave_period: times.map(() => 14), secondary_swell_wave_height: times.map(() => 0), secondary_swell_wave_direction: times.map(() => 0), secondary_swell_wave_period: times.map(() => 0), sea_surface_temperature: times.map(() => 14)}};
const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 135), wind_gusts_10m: times.map(() => 5)}};
const rec = (id: string) => normalizeOpenMeteo(evidenceSpot(id), marine, weather, new Date(NOW).toISOString());
const m = (v: number) => ({value: v, unit: 'ft', source: {retrievedAt: '2026-11-02T00:00:00Z'}});
const nr = (iso: string, hs: number, mopId?: string) => ({timestamp: iso, height: m(hs), period: m(14), direction: m(300), qualityFlag: 1, product: 'nowcast' as const, ...(mopId ? {mopId} : {})});

test('T-071b: a spot never shows another point\'s nowcast (Linda Mar SM382 vs the Ocean Beach SF023 nowcast)', () => {
  const iso = new Date(T * 1000).toISOString(), sf023 = [nr(iso, 6.5, 'SF023'), nr(iso, 6.5)];
  assert.equal(nowcastFor('SM382', sf023), undefined); assert.equal(nowcastFor('SF023', sf023)!.length, 2); assert.deepEqual(nowcastFor('SF023', [nr(iso, 5, 'SM382')]), []);
  // the selector with SM382 sees only its forecast, never the SF023 record, even for the current hour
  const fc = [{...nr(iso, 3.1, 'SM382'), product: 'forecast' as const}], pick = pickMopRecord(Date.parse(iso), NOW, nowcastFor('SM382', sf023), fc);
  assert.ok(pick.state === 'ok' && pick.product === 'forecast' && pick.record.height.value === 3.1);
  // headlineSurf for Linda Mar uses the SM382 forecast (v2) even though the bundle carries Ocean Beach's nowcast
  const bundle = {nearshore: sf023, mop: {SM382: {mopId: 'SM382', records: fc, issue: null, retrievedAt: iso, url: 'x'}}} as any;
  const f = toLegacy(rec('spot-3')[1]), h = headlineSurf('spot-3', f, {bundle, nowMs: NOW, observations: []}) as any;
  assert.equal(h.kind, 'estimate'); assert.equal(h.method, 'mop-v2'); assert.equal(h.mop.id, 'SM382'); assert.equal(h.mop.product, 'forecast');
});
test('T-071b: a guide-derived estimate says once where its inputs came from; Ocean Beach (reviewed) does not', () => {
  assert.match(guideBasis('spot-3')!, /facing and swell window from published guides \(Surfnerd, Surf-Forecast\), not reviewed; 8 s generic minimum period/); assert.equal(guideBasis('spot-2'), null);
  const f = toLegacy(rec('spot-0')[1]), h = headlineSurf('spot-0', f, {nowMs: NOW, observations: []}) as any;
  if (h.kind === 'estimate') { assert.match(h.methodLabel, /published guides/); assert.equal((h.methodLabel.match(/published guides/g) ?? []).length, 1); }
  const lm = headlineSurf('spot-3', toLegacy(rec('spot-3')[1]), {bundle: {nearshore: [], mop: {SM382: {mopId: 'SM382', records: [{...nr(new Date(T * 1000).toISOString(), 3, 'SM382'), product: 'forecast' as const}], issue: null, retrievedAt: '', url: 'x'}}} as any, nowMs: NOW, observations: []}) as any;
  assert.match(lm.methodLabel, /SM382 assigned by the facing-match rule/); assert.match(lm.methodLabel, /published guides/);
});
test('T-071b: explainRating counts guide-filled facts as "from published guides, not reviewed" and the wind reason says the shore direction is from a guide', () => {
  const q = rateOcean(evidenceSpot('spot-3'), rec('spot-3')[1], NOW), e = explainRating(q, {spotId: 'spot-3', wind: {mph: 5, relation: 'Offshore'}});
  assert.ok(e.guideFacts.includes('Beach orientation') && e.guideFacts.includes('Swell window')); assert.ok(!e.unknownFacts.includes('Beach orientation'));
  assert.match(e.reliability.reasons.at(-1)!, /not reviewed: \d+ come from published guides/);
  assert.match(e.items.find((i) => /wind/i.test(i.factor))!.reason, /Shore direction comes from a published guide \(approximate, not surveyed\)/);
  const ob = explainRating(rateOcean(evidenceSpot('spot-2'), rec('spot-2')[1], NOW), {spotId: 'spot-2', wind: {mph: 5, relation: 'Offshore'}});
  assert.doesNotMatch(ob.items.find((i) => /wind/i.test(i.factor))!.reason, /published guide/, 'the CDIP orientation is not a guide fact');
});
test('T-071b: exposure parsing separates wind shelter from swell shelter; sizes are rounded to half feet', () => {
  assert.notEqual(guideFactsFor('cs-sand-dollar')!.exposure, 'sheltered'); assert.equal(enablement(guideFactsFor('cs-sand-dollar')!).estimate, true);
  assert.equal(guideFactsFor('cs-asilomar')!.exposure, 'exposed'); assert.equal(guideFactsFor('spot-3')!.exposure, 'somewhat protected'); assert.equal(guideFactsFor('spot-3')!.sizeFt!.max, 12);
  assert.ok(guideFacts.every((f) => !f.sizeFt || (f.sizeFt.min * 2) % 1 === 0 && (f.sizeFt.max * 2) % 1 === 0));
  assert.match(breakingProfile('cs-swamis')!.note, /rests on one guide's "exposed" statement/);
});

test('a rivermouth (Andrew Molera) is a point-type break: it needs a source that says it is exposed, so it gets facts but no estimate and no MOP assignment', () => {
  assert.equal(guideFactsFor('cs-andrew-molera')?.waveType, 'point'); assert.equal(breakingProfile('cs-andrew-molera'), null);
  assert.match(enablement(guideFactsFor('cs-andrew-molera')!).reasons.join(), /a point break needs a source that says it is exposed/);
});

test('Hawaii review round: Pohue Bay Beach has no breaking profile (its only source says it has no break information); Dumps works on its south swells (workable range wins where it holds the guides\' ideal directions); older spots keep their windows', () => {
  assert.equal(breakingProfile('w-hawaii-pohue-bay-beach'), null);
  assert.deepEqual(enablement(guideFactsFor('w-hawaii-pohue-bay-beach')!).reasons, ['its only source page says it has no detailed break information on record']);
  assert.deepEqual(breakingProfile('w-hawaii-dumps')!.window, [210, 292.5]);   // was 270-315 from the exposure alone
  assert.deepEqual(breakingProfile('w-hawaii-pakala')!.window, [187.5, 292.5]);
  assert.deepEqual(breakingProfile('cs-neah-bay')!.window, [202.5, 292.5]);   // an existing row: the rule is scoped to the new Hawaii rows
});

test('3C review: ideal-swell text parsing: full names, the 16 abbreviations, per-guide lists, "(both)", "(surf-forecast: southwest)" inside a segment; Wannasurf is not a best', async () => {
  const {idealByGuide} = await import('../ocean/spotFactsRules.ts');
  assert.deepEqual(idealByGuide('SW (surfnerd); W (surf-forecast)'), [{guides: ['surfnerd'], dirs: [225]}, {guides: ['surf-forecast'], dirs: [270]}]);
  assert.deepEqual(idealByGuide('South-southwest (surf-forecast); SouthWest, South (wannasurf)'), [{guides: ['surf-forecast'], dirs: [202.5]}, {guides: ['wannasurf'], dirs: [225, 180]}]);
  assert.deepEqual(idealByGuide('W (both)'), [{guides: ['surfnerd', 'surf-forecast'], dirs: [270]}]);
  assert.deepEqual(idealByGuide('West (surf-forecast: southwest)'), [{guides: ['surf-forecast'], dirs: [225]}, {guides: [], dirs: [270]}]);
  assert.deepEqual(idealByGuide('surfnerd: best days from crossed-up combo swells (no direction); surf-forecast: SW angle'), [{guides: ['surf-forecast'], dirs: [225]}]);
  assert.deepEqual(idealByGuide('not stated (surfnerd)'), []);
});
test('3C review: the outside-the-facing sentence names the guide per direction, says "partly" only when some best direction is inside, is a plain list, and leaves Wannasurf-only and inside-window spots alone', async () => {
  const {outsideFacing} = await import('../ocean/spotFactsRules.ts');
  const f = (idealSwell: string) => ({idealSwell}) as any;
  const whole = outsideFacing(f('South-southwest (surf-forecast); South (wannasurf)'), [210, 292.5])!;
  assert.equal(whole.partly, false); assert.equal(whole.text, "published best swell is outside ±60° of the sourced facing: swells from SSW (Surf-Forecast's best) give no surf-height estimate (never widened by estimate)");
  const partly = outsideFacing(f('SW (surfnerd); W (surf-forecast)'), [250, 340])!;   // W inside, SW outside
  assert.equal(partly.partly, true); assert.match(partly.text, /^published best swell is partly outside ±60° of the sourced facing: swells from SW \(Surfnerd's best; Surf-Forecast says W\) give no/);
  const two = outsideFacing(f('N (surfnerd); S (surf-forecast)'), [90, 150])!; assert.match(two.text, /N \(Surfnerd's best; Surf-Forecast says S\) and S \(Surf-Forecast's best; Surfnerd says N\) give/); assert.doesNotMatch(two.text, / and .* and /);
  assert.match(outsideFacing(f('SE (both)'), [0, 90])!.text, /SE \(both guides' best\)/);
  assert.equal(outsideFacing(f('SouthEast, East (wannasurf)'), [270, 330]), null, 'Wannasurf lists directions that work, not a best');
  assert.equal(outsideFacing(f('W (surfnerd)'), [250, 330]), null, 'inside the window');
  assert.deepEqual(whole.dirs, [202.5]);
});
test('3C review: Dumps says so with the guide named, abbreviations now count (Malibu, Capitola, Neah Bay), the counts are 105 rows (23 in the original California spots, 28 Hawaii, 23 US East, 31 West Coast), and no window moved', async () => {
  const {outsideFacingNote} = await import('../services/headlineSurf.ts');
  assert.deepEqual(breakingProfile('w-hawaii-dumps')!.window, [210, 292.5]);
  assert.match(outsideFacingNote('w-hawaii-dumps')!, /swells from SSW \(Surf-Forecast's best\) give no surf-height estimate/);
  assert.match(breakingProfile('w-hawaii-dumps')!.note, /Published best swell is outside ±60° of the sourced facing/);
  for (const id of ['cs-malibu', 'cs-capitola', 'cs-neah-bay', 'spot-6', 'spot-8']) assert.ok(outsideFacingNote(id), id);
  assert.equal(outsideFacingNote('spot-2'), null);   // Ocean Beach: reviewed, not a guide profile
  const withNote = breakingProfiles.filter((p) => outsideFacingNote(p.spotId)); assert.equal(withNote.length, 105); assert.equal(withNote.filter((p) => !p.spotId.startsWith('w-')).length, 23); assert.equal(withNote.filter((p) => p.spotId.startsWith('w-usw-')).length, 31);
  assert.deepEqual(breakingProfile('w-hawaii-pakala')!.window, [187.5, 292.5]); assert.deepEqual(breakingProfile('cs-neah-bay')!.window, [202.5, 292.5]);
});
test('3C review: the scale card says it only on an hour refused for being outside the window, on one of the listed directions; a short-period or inside-window refusal says nothing', async () => {
  const {outsideFacingForHour, guideBasis} = await import('../services/headlineSurf.ts');
  const hour = (refusalCode: string, swellDirectionDeg: number | null) => ({evidence: {faceEstimate: {refusal: 'x', refusalCode, swellDirectionDeg}}}) as any;
  assert.match(outsideFacingForHour('w-hawaii-dumps', hour('outside-window', 200))!, /SSW \(Surf-Forecast's best\)/);   // SSW = 202.5 ± 11.25
  assert.equal(outsideFacingForHour('w-hawaii-dumps', hour('outside-window', 100)), null, 'outside the window but not a listed direction');
  assert.equal(outsideFacingForHour('w-hawaii-dumps', hour('short-period', 200)), null);
  assert.equal(outsideFacingForHour('w-hawaii-dumps', hour('wind-sea-dominant', 200)), null);
  assert.equal(outsideFacingForHour('w-hawaii-dumps', hour('outside-window', null)), null);
  assert.equal(outsideFacingForHour('w-hawaii-dumps', undefined), null);
  assert.match(guideBasis('w-hawaii-dumps')!, /; published best swell is outside ±60° of the sourced facing: swells from SSW/);
});

test('a single-source guide facing is one statement: "South-southwest (surfnerd: Faces SSW)" is SSW, not S + SW + SSW; only real disagreements are conflicts', () => {
  const f = guideFactsFor('w-usw-13th-street')!; assert.equal(f.facing!.deg, 202.5); assert.ok(breakingProfile('w-usw-13th-street'), 'and the profile follows');
  const conflicts = guideFacts.filter((g) => /Sources give different facings/.test(g.notes ?? ''));
  assert.ok(conflicts.length <= 3, `${conflicts.length} real conflicts: ${conflicts.map((g) => g.spotId).join(', ')}`); assert.ok(conflicts.every((g) => g.facing === null || g.facing?.basis === 'coastline geometry'), 'a conflict records no guide facing');
});
