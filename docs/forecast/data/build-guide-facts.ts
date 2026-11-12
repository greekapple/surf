// T-071: merges the researched published-guide facts (JSON, one object per spot) into src/ocean/spotFactsSourced.ts.
// Run: node --experimental-strip-types docs/forecast/data/build-guide-facts.ts docs/forecast/data/guide-facts.json docs/forecast/data/mop-candidates-all.json docs/forecast/data/profile-research docs/forecast/data/guide-facts-held.json docs/forecast/data/guide-facts-merge-log.json > src/ocean/spotFactsSourced.ts
// T-073: the second file (scripts/mop-scan.mjs output) is used only for spots flagged `facingFromCoastline` whose guides give no single facing.
import fs from 'node:fs';
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as any[];
const scan = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const WORD: Record<string, number> = {N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5};
const cw = (a: number, b: number) => ((b - a) % 360 + 360) % 360;
/** "W to NNW" -> [270, 337.5]. T-073: a list of ranges or single points ("SSE to SW, WSW to W"; "SE to SW and WSW to WNW") becomes one range when each piece starts at most one compass point (22.5°) after the previous one ends; a list with a gap gives null.
 *  An attribution in brackets ("S to W (surfnerd)") is ignored. */
const range = (t: string | null | undefined): [number, number] | null => {
  const s = String(t ?? '').replace(/\.\s*(?:faces|best from)\b.*$/i, '').replace(/\([^)]*\)/g, '').trim().toUpperCase(); if (!s) return null;   // surfnerd prints "N - SSE. Faces ENE (surfnerd)": the tail is the facing / best swell, not part of the range
  const pieces = s.split(/\s*(?:,|;|\bAND\b)\s*/).filter(Boolean).map((p) => p.match(/^([NESW]{1,3})(?:\s*(?:TO|-|–)\s*([NESW]{1,3}))?$/));
  if (!pieces.length || pieces.some((m) => !m || !(m[1] in WORD) || (m[2] && !(m[2] in WORD)))) return null;
  const rs = pieces.map((m) => [WORD[m![1]], WORD[m![2] ?? m![1]]] as [number, number]);
  for (let i = 1; i < rs.length; i++) if (cw(rs[i - 1][1], rs[i][0]) > 22.5) return null;
  return [rs[0][0], rs[rs.length - 1][1]];
};
const span = ([a, b]: [number, number]) => cw(a, b);
/** The directions the guides call ideal ("South-southwest", "SouthWest, South"), as degrees on the 16-point rose. Text with no compass word gives none. */
const FULL: Record<string, number> = Object.fromEntries(Object.entries({north: 0, northnortheast: 22.5, northeast: 45, eastnortheast: 67.5, east: 90, eastsoutheast: 112.5, southeast: 135, southsoutheast: 157.5, south: 180, southsouthwest: 202.5, southwest: 225, westsouthwest: 247.5, west: 270, westnorthwest: 292.5, northwest: 315, northnorthwest: 337.5}));
const idealDegs = (t: string | null | undefined): number[] => String(t ?? '').replace(/\([^)]*\)/g, '').split(/[;,]/).map((x) => x.trim().toLowerCase().replace(/[^a-z]/g, '')).map((x) => FULL[x] ?? WORD[x.toUpperCase()]).filter((x): x is number => typeof x === 'number');
// The workable-over-exposure rule below is scoped to the Hawaii rows added in the rest-of-Hawaii round (Maui, Big Island, Kauai, Molokai, Lanai, Niihau, Oahu East and West): applying it to the older rows would move the windows of existing spots (5 California rows and 6 Oahu rows would change), and the ratings of existing spots must stay byte-identical.
const WORKABLE_RULE_IDS = new Set((JSON.parse(fs.readFileSync(new URL('./world-spots/hawaii.json', import.meta.url), 'utf8')).spots as any[]).filter((x) => !/Oahu (North|South) Shore$/.test(x.region)).map((x) => x.id));
const inside = (d: number, [a, b]: [number, number]) => cw(a, d) <= cw(a, b);
/** Swell exposure from the guides' free text. Clauses that talk only about WIND ("sheltered from N and S winds", "not wind protected") are dropped first: wind shelter is not swell shelter. */
const exposureOf = (t: string): string => {
  const s = String(t ?? '').split(/[;()]/).filter((c) => !/wind/i.test(c) || /swell/i.test(c)).join(' ').toLowerCase();
  if (/\bsheltered\b/.test(s) && !/somewhat/.test(s)) return 'sheltered'; if (/somewhat protected|protected/.test(s)) return 'somewhat protected'; if (/sheltered/.test(s)) return 'somewhat protected'; if (/exposed/.test(s)) return 'exposed'; return 'not stated';
};
/** Guide sizes are often converted from metres (12.1 ft = 3.7 m): round to the nearest half foot so a conversion artefact is not shown as precision. */
const half = (n: number) => Math.round(n * 2) / 2;
const LONG: Record<string, string> = {NORTH: 'N', NORTHEAST: 'NE', EAST: 'E', SOUTHEAST: 'SE', SOUTH: 'S', SOUTHWEST: 'SW', WEST: 'W', NORTHWEST: 'NW'};
/** The sixteen-point names that are written as two hyphenated words ("South-southwest"): read whole, never as the two words S and SW. */
const HYPHEN16: Record<string, string> = {'NORTH-NORTHEAST': 'NNE', 'EAST-NORTHEAST': 'ENE', 'EAST-SOUTHEAST': 'ESE', 'SOUTH-SOUTHEAST': 'SSE', 'SOUTH-SOUTHWEST': 'SSW', 'WEST-SOUTHWEST': 'WSW', 'WEST-NORTHWEST': 'WNW', 'NORTH-NORTHWEST': 'NNW'};
/** Compass tokens in a free-text facing statement. The guide's own "Faces X" token is read first (the surfnerd facing: 'South-southwest (surfnerd: "Faces SSW")' is ONE statement, SSW); otherwise whole hyphenated words are read as one point,
 *  then single words and letters. ("SW (text); characteristics list S" still has two tokens.) One distinct token = a stated facing; several = the sources disagree, so no facing is recorded. */
const facingOf = (t: string | null | undefined): {text: string; deg: number} | {conflict: string[]} | null => {
  const raw = String(t ?? ''), norm = (x: string) => LONG[x] ?? x;
  const faces = [...new Set([...raw.toUpperCase().matchAll(/\bFACES\s+([NESW]{1,3})\b/g)].map((m) => m[1]).filter((x) => x in WORD))];
  const toks = faces.length ? faces : [...new Set((raw.toUpperCase().replace(/\b(?:NORTH|SOUTH|EAST|WEST)-(?:NORTH|SOUTH|EAST|WEST)(?:EAST|WEST)\b/g, (m) => HYPHEN16[m] ?? m).match(/\b(?:NORTH|SOUTH|EAST|WEST)(?:EAST|WEST)?\b|\b[NESW]{1,3}\b/g) ?? []).map(norm).filter((x) => x in WORD))];
  return toks.length === 1 ? {text: toks[0], deg: WORD[toks[0]]} : toks.length > 1 ? {conflict: toks} : null;
};
/** T-073 facing derived from coastline geometry: the CDIP MOP shore normals (agency data, each point's own metadata) of the nearest valid points within 1.5 km, at most 5, at least 3.
 *  Their circular mean is the facing when every normal is within 30° of it; otherwise the coastline is too irregular and nothing is derived. */
const DERIVE = {radiusKm: 1.5, maxPoints: 5, minPoints: 3, maxSpreadDeg: 30};
const deriveFacing = (spotId: string) => {
  const s = scan?.spots?.find((x: any) => x.id === spotId); if (!s) return null;
  const pts = (s.nearest as any[]).filter((p) => p.shoreNormalDeg >= 0 && p.shoreNormalDeg < 360 && p.distanceKm <= DERIVE.radiusKm).slice(0, DERIVE.maxPoints);
  if (pts.length < DERIVE.minPoints) return null;
  const r = Math.PI / 180, x = pts.reduce((a, p) => a + Math.cos(p.shoreNormalDeg * r), 0), y = pts.reduce((a, p) => a + Math.sin(p.shoreNormalDeg * r), 0);
  const mean = ((Math.atan2(y, x) / r) % 360 + 360) % 360, dev = Math.max(...pts.map((p) => { const d = Math.abs(p.shoreNormalDeg - mean) % 360; return d > 180 ? 360 - d : d; }));
  if (dev > DERIVE.maxSpreadDeg) return null;
  const deg = Math.round(mean), word = Object.entries(WORD).sort((a, b) => { const da = Math.min(cw(a[1], deg), cw(deg, a[1])), db = Math.min(cw(b[1], deg), cw(deg, b[1])); return da - db; })[0][0];
  return {text: word, deg, basis: 'coastline geometry', sources: [{url: `https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/${pts[0].id}_forecast.nc.ascii?metaLatitude,metaLongitude,metaWaterDepth,metaShoreNormal`, site: 'facing derived from CDIP coastline geometry',
    title: `CDIP MOP shore normals (agency data) of ${pts.map((p) => `${p.id} ${p.shoreNormalDeg}°`).join(', ')}, within ${DERIVE.radiusKm} km; circular mean ${deg}°, spread ±${Math.round(dev)}°`, retrievedOn: (s.retrievedOn ?? scan.retrievedOn)}]};
};
/** Surfnerd's page boilerplate for a spot it has no notes for ("Detailed condition notes aren't available for it yet, so check the Surfnerd forecast...") is not a hazard: stored as one it would suppress "Hazard information unknown". */
const BOILERPLATE_HAZARD = /aren[’']?t available for it yet/i;
const SITE: Record<string, string> = {surfnerd: 'Surfnerd', 'surf-forecast': 'Surf-Forecast.com'};
const out: any[] = [];
for (const r of input) {
  const e = range(r.swellExposure), w = r.swellWorkable && Number.isFinite(r.swellWorkable.fromDeg) ? [r.swellWorkable.fromDeg, r.swellWorkable.toDeg] as [number, number] : null;
  // Where the workable range holds every direction the guides call ideal and the exposure does not (Dumps: exposure W-NW, ideal S/SSW, workable S-WNW), the exposure alone would refuse the swells the spot is surfed on: use the workable range.
  const ideal = idealDegs(r.idealSwell), useWorkable = !!(WORKABLE_RULE_IDS.has(r.spotId) && e && w && ideal.length && span(w) >= 45 && ideal.every((d) => inside(d, w)) && !ideal.every((d) => inside(d, e)));
  // Surfnerd's exposure compass in the "N - SSE. Faces ENE" form is only a fact about the break when the same page has real break notes (a workable swell, ideal swell, tide, bottom or a hazard): on a page without them the compass simply follows the facing, which is not a window (research README, "No window"). The older plain exposure texts are unchanged.
  const hasNotes = !!(r.swellWorkable && Number.isFinite(r.swellWorkable.fromDeg)) || !!r.idealSwell || !!r.tide || !!r.bottom || (Array.isArray(r.hazards) && r.hazards.some((h: any) => !BOILERPLATE_HAZARD.test(String(h))));
  const compassOnly = /\bfaces\b/i.test(String(r.swellExposure ?? '')) && !hasNotes;
  const tail = (s: string) => String(s).replace(/\.\s*(?:faces|best from)\b[^(]*/i, '');   // surfnerd's ". Best from SE" / ". Faces ENE" tail is not part of a range's text
  const win = !useWorkable && e && span(e) >= 22.5 && !compassOnly ? {text: tail(String(r.swellExposure)).replace(/\s*\([^)]*\)/g, ''), fromDeg: e[0], toDeg: e[1], basis: 'exposure', source: 'surfnerd'} : w && span(w) >= 45 ? {text: tail(r.swellWorkable.text), fromDeg: w[0], toDeg: w[1], basis: 'workable', source: /wannasurf/i.test(String(r.swellWorkable.text)) ? 'wannasurf' : 'surfnerd'} : null;
  const wt = String(r.waveType ?? '').toLowerCase(), type = /point|river|mouth/.test(wt) ? 'point' : /reef/.test(wt) ? 'reef' : /jetty/.test(wt) ? 'jetty' : /beach/.test(wt) ? 'beach' : null;
  const stated = facingOf(r.facing), derived = !(stated && 'deg' in stated) && r.facingFromCoastline ? deriveFacing(r.spotId) : null;
  const facing = stated && 'deg' in stated ? {...stated, basis: 'guide'} : derived;
  // Surfnerd's workable swell on many beaches is drawn clockwise over the LAND (Corolla "S - N" through west, on an ENE-facing beach). On a beach (or a spot with no stated type) a range with no direction within 90° of the facing is a land-side range,
  // never a window; and a workable range with nothing within ±60° of the facing, while the page's own exposure range contains the facing, disagrees with the page: it is dropped, so a straight beach is not refused as a wrapping point. Points, reefs and jetties keep theirs (swell does wrap onto them).
  let winOut = win, wOut = w; const landNotes: string[] = [];
  if (facing && (type === 'beach' || type === null)) {
    const near = (rg: [number, number], half: number) => { for (let d = 0; d < 360; d += 7.5) if (inside(d, rg) && Math.min(cw(d, facing.deg), cw(facing.deg, d)) <= half) return true; return false; };
    if (w && !near(w, 90)) { wOut = null; landNotes.push(`Surfnerd's workable swell (${r.swellWorkable.text}) lies wholly on the land side of the ${facing.text} facing, so it is not used.`); }
    else if (w && !near(w, 60) && e && inside(facing.deg, e)) { wOut = null; landNotes.push(`Surfnerd's workable swell (${r.swellWorkable.text}) has nothing within 60° of the ${facing.text} facing while its own exposure range contains the facing; the two disagree, so the workable range is not used.`); }
    if (winOut && winOut.basis === 'workable' && !wOut) winOut = null;
    if (winOut && winOut.basis === 'exposure' && !near([winOut.fromDeg, winOut.toDeg], 90)) { winOut = null; landNotes.push(`The exposure range (${win!.text}) lies wholly on the land side of the ${facing.text} facing, so it is not used.`); }
  }
  const sources = [...(r.sources ?? []).map((s: any) => ({url: s.url, site: s.site, title: s.title ?? `${SITE[s.site] ?? s.site} spot guide: ${r.name}`, retrievedOn: s.retrievedOn})), ...(derived ? derived.sources : [])];
  out.push({spotId: r.spotId, sources,
    facing, swellWindow: winOut, workable: wOut ? {text: tail(r.swellWorkable.text), fromDeg: wOut[0], toDeg: wOut[1]} : null, idealSwell: r.idealSwell ?? null, surfnerdWorkableWind: r.windOffshore ?? null, tide: r.tide ?? null, bottom: r.bottom ?? null, waveType: type,
    sizeFt: r.sizeFt && Number.isFinite(r.sizeFt.min) && Number.isFinite(r.sizeFt.max) ? {min: half(r.sizeFt.min), max: half(r.sizeFt.max)} : null, exposure: exposureOf(r.exposure), hazards: Array.isArray(r.hazards) ? r.hazards.map(String).filter((h) => !BOILERPLATE_HAZARD.test(h)) : [],
    notes: [String(r.notes ?? ''), ...landNotes, stated && 'conflict' in stated ? `Sources give different facings (${stated.conflict.join(', ')}); ${derived ? `the facing is derived from coastline geometry instead (${derived.deg}°)` : 'none is recorded'}.` : ''].filter(Boolean).join(' ').slice(0, 1600)});
}
// ---- offshore-surf step 2: the cited research files (docs/forecast/data/profile-research/*.json, GuideFacts-shaped) overlaid on the facts above. ----
// Rules (the research README's judgement calls are kept: no window from the facing alone, contradictions stay null, exposure only from swell sentences):
//  - a field the old record lacks takes the new cited value; where both exist and agree, the newer cited value wins; where they CONTRADICT, the old (already accepted) value is kept and the contradiction is logged, never averaged or guessed.
//  - contradiction: facings more than 22.5° apart; windows overlapping by less than half of the narrower; exposure two levels apart (exposed vs sheltered); a beach vs a point/reef/jetty type. A facing contradiction keeps the old facing AND window (a window is relative to the facing).
//  - sources are the union by URL (a page used for a kept field is still cited); notes are joined.
const researchDir = process.argv[4], heldFile = process.argv[5], logFile = process.argv[6];
const log: any[] = [];
const adiff = (a: number, b: number) => Math.min(cw(a, b), cw(b, a));
const overlap = (a: {fromDeg: number; toDeg: number}, b: {fromDeg: number; toDeg: number}) => { let both = 0, na = 0, nb = 0; for (let d = 0; d < 360; d += 2.5) { const x = inside(d, [a.fromDeg, a.toDeg]), y = inside(d, [b.fromDeg, b.toDeg]); if (x) na++; if (y) nb++; if (x && y) both++; } return both / Math.max(1, Math.min(na, nb)); };
// the page a researched window was read from: wannasurf where the record says so (its workable text names it, or its notes say the window is from wannasurf's good swell directions), else surfnerd
const srcOf = (n: any) => (/wannasurf/i.test(String(n.swellWindow?.text ?? '') + ' ' + String(n.workable?.text ?? '')) || /Window from wannasurf/i.test(String(n.notes ?? '')) ? 'wannasurf' : 'surfnerd');
const RANK: Record<string, number> = {sheltered: 0, 'somewhat protected': 1, exposed: 2};
if (researchDir) {
  const byId = new Map(out.map((o: any) => [o.spotId, o]));
  const files = fs.readdirSync(researchDir).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) for (const n of JSON.parse(fs.readFileSync(`${researchDir}/${f}`, 'utf8')) as any[]) {
    const o = byId.get(n.spotId); if (!o) { log.push({spotId: n.spotId, file: f, skipped: 'no such spot in guide-facts.json'}); continue; }
    const ch: any[] = [], bad: any[] = [], before = JSON.stringify(o);
    const take = (field: string, val: any, why: string) => { if (JSON.stringify(o[field]) !== JSON.stringify(val)) { ch.push({field, from: o[field] ?? null, to: val, why}); o[field] = val; } };
    // facing (and the window relative to it)
    let facingOk = true;
    if (n.facing) { if (!o.facing && /Sources give different facings/.test(String(o.notes))) { facingOk = false; bad.push({field: 'facing', kept: null, rejected: n.facing, why: 'the old guides disagree about the facing: a contradiction stays null'}); } else if (!o.facing) take('facing', n.facing, 'was missing'); else if (adiff(o.facing.deg, n.facing.deg) > 22.5) { facingOk = false; bad.push({field: 'facing', kept: o.facing, rejected: n.facing}); } else take('facing', n.facing, 'newer cited, agrees'); }
    if (n.swellWindow && facingOk) { if (!o.swellWindow) take('swellWindow', {...n.swellWindow, source: n.swellWindow.source ?? srcOf(n)}, 'was missing'); else if (overlap(o.swellWindow, n.swellWindow) < 0.5) bad.push({field: 'swellWindow', kept: o.swellWindow, rejected: n.swellWindow}); else if (span([n.swellWindow.fromDeg, n.swellWindow.toDeg]) > 1.5 * span([o.swellWindow.fromDeg, o.swellWindow.toDeg])) bad.push({field: 'swellWindow', kept: o.swellWindow, rejected: n.swellWindow, why: 'the newer window is more than 1.5x wider: a widening is not an agreement'}); else if (o.swellWindow.basis === 'exposure' && n.swellWindow.basis === 'workable') bad.push({field: 'swellWindow', kept: o.swellWindow, rejected: n.swellWindow, why: 'the exposure range comes first (the research order); a workable range does not replace it'}); else take('swellWindow', {...n.swellWindow, source: n.swellWindow.source ?? srcOf(n)}, 'newer cited, agrees'); }
    else if (n.swellWindow) bad.push({field: 'swellWindow', kept: o.swellWindow, rejected: n.swellWindow, why: 'facing contradicts'});
    if (n.workable && facingOk && !o.workable) take('workable', n.workable, 'was missing');
    const ex = n.exposure; if (ex && ex !== 'not stated') { if (!o.exposure || o.exposure === 'not stated') take('exposure', ex, 'was missing'); else if (Math.abs(RANK[o.exposure] - RANK[ex]) >= 2) bad.push({field: 'exposure', kept: o.exposure, rejected: ex}); else take('exposure', ex, 'newer cited, agrees'); }
    if (n.waveType) { if (!o.waveType) take('waveType', n.waveType, 'was missing'); else if (o.waveType !== n.waveType) bad.push({field: 'waveType', kept: o.waveType, rejected: n.waveType}); }
    for (const k of ['idealSwell', 'tide', 'bottom', 'sizeFt']) if (n[k] && !o[k]) take(k, n[k], 'was missing');
    if (n.hazards?.length) take('hazards', [...new Set([...(o.hazards ?? []), ...n.hazards])], 'union');
    take('sources', [...o.sources, ...(n.sources ?? []).filter((s: any) => !o.sources.some((x: any) => x.url === s.url))], 'union by URL');
    if (n.notes && !String(o.notes).includes(n.notes.slice(0, 60))) take('notes', [o.notes, n.notes].filter(Boolean).join(' ').slice(0, 2400), 'joined');
    if (JSON.stringify(o) !== before || bad.length) log.push({spotId: n.spotId, file: f, changed: ch.filter((c) => !['sources', 'notes', 'hazards'].includes(c.field)).map((c) => ({field: c.field, from: c.from, to: c.to, why: c.why})), contradictions: bad});
  }
}
// spots held back after the NWS comparison (docs/forecast/data/guide-facts-held.json: {spotId: reason}): the window is removed, so no estimate is made; the reason stays in the notes
if (heldFile && fs.existsSync(heldFile)) for (const [id, why] of Object.entries(JSON.parse(fs.readFileSync(heldFile, 'utf8')) as Record<string, string>)) { const o = out.find((x: any) => x.spotId === id); if (o) { o.swellWindow = null; o.notes = `${o.notes} HELD BACK: ${why}`.slice(0, 1800); log.push({spotId: id, held: why}); } }
if (logFile) fs.writeFileSync(logFile, JSON.stringify({generatedFrom: 'docs/forecast/data/build-guide-facts.ts', spots: log}, null, 1) + '\n');
console.log(`import type {GuideFacts} from './spotFactsRules.ts';\n\n/** Published spot-guide facts (T-071, T-073), generated by docs/forecast/data/build-guide-facts.ts from docs/forecast/data/guide-facts.json (and, for a facing derived from coastline geometry, docs/forecast/data/mop-candidates-all.json). Do not edit by hand.\n *  Each entry cites its pages and retrieval date; a fact a page does not state is null. */\nexport const guideFacts: GuideFacts[] = ${JSON.stringify(out, null, 1)};\nexport const guideFactsFor = (spotId: string) => guideFacts.find((f) => f.spotId === spotId) ?? null;`);
