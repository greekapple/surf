// T-071: merges the researched published-guide facts (JSON, one object per spot) into src/ocean/spotFactsSourced.ts.
// Run: node --experimental-strip-types docs/forecast/data/build-guide-facts.ts docs/forecast/data/guide-facts.json docs/forecast/data/mop-candidates-all.json > src/ocean/spotFactsSourced.ts
// T-073: the second file (scripts/mop-scan.mjs output) is used only for spots flagged `facingFromCoastline` whose guides give no single facing.
import fs from 'node:fs';
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as any[];
const scan = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const WORD: Record<string, number> = {N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5};
const cw = (a: number, b: number) => ((b - a) % 360 + 360) % 360;
/** "W to NNW" -> [270, 337.5]. T-073: a list of ranges or single points ("SSE to SW, WSW to W"; "SE to SW and WSW to WNW") becomes one range when each piece starts at most one compass point (22.5°) after the previous one ends; a list with a gap gives null.
 *  An attribution in brackets ("S to W (surfnerd)") is ignored. */
const range = (t: string | null | undefined): [number, number] | null => {
  const s = String(t ?? '').replace(/\([^)]*\)/g, '').trim().toUpperCase(); if (!s) return null;
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
  const win = !useWorkable && e && span(e) >= 22.5 ? {text: String(r.swellExposure).replace(/\s*\([^)]*\)/g, ''), fromDeg: e[0], toDeg: e[1], basis: 'exposure'} : w && span(w) >= 45 ? {text: r.swellWorkable.text, fromDeg: w[0], toDeg: w[1], basis: 'workable'} : null;
  const wt = String(r.waveType ?? '').toLowerCase(), type = /point|river|mouth/.test(wt) ? 'point' : /reef/.test(wt) ? 'reef' : /jetty/.test(wt) ? 'jetty' : /beach/.test(wt) ? 'beach' : null;
  const stated = facingOf(r.facing), derived = !(stated && 'deg' in stated) && r.facingFromCoastline ? deriveFacing(r.spotId) : null;
  const facing = stated && 'deg' in stated ? {...stated, basis: 'guide'} : derived;
  const sources = [...(r.sources ?? []).map((s: any) => ({url: s.url, site: s.site, title: s.title ?? `${SITE[s.site] ?? s.site} spot guide: ${r.name}`, retrievedOn: s.retrievedOn})), ...(derived ? derived.sources : [])];
  out.push({spotId: r.spotId, sources,
    facing, swellWindow: win, workable: w ? {text: r.swellWorkable.text, fromDeg: w[0], toDeg: w[1]} : null, idealSwell: r.idealSwell ?? null, surfnerdWorkableWind: r.windOffshore ?? null, tide: r.tide ?? null, bottom: r.bottom ?? null, waveType: type,
    sizeFt: r.sizeFt && Number.isFinite(r.sizeFt.min) && Number.isFinite(r.sizeFt.max) ? {min: half(r.sizeFt.min), max: half(r.sizeFt.max)} : null, exposure: exposureOf(r.exposure), hazards: Array.isArray(r.hazards) ? r.hazards.map(String).filter((h) => !BOILERPLATE_HAZARD.test(h)) : [],
    notes: [String(r.notes ?? ''), stated && 'conflict' in stated ? `Sources give different facings (${stated.conflict.join(', ')}); ${derived ? `the facing is derived from coastline geometry instead (${derived.deg}°)` : 'none is recorded'}.` : ''].filter(Boolean).join(' ').slice(0, 800)});
}
console.log(`import type {GuideFacts} from './spotFactsRules.ts';\n\n/** Published spot-guide facts (T-071, T-073), generated by docs/forecast/data/build-guide-facts.ts from docs/forecast/data/guide-facts.json (and, for a facing derived from coastline geometry, docs/forecast/data/mop-candidates-all.json). Do not edit by hand.\n *  Each entry cites its pages and retrieval date; a fact a page does not state is null. */\nexport const guideFacts: GuideFacts[] = ${JSON.stringify(out, null, 1)};\nexport const guideFactsFor = (spotId: string) => guideFacts.find((f) => f.spotId === spotId) ?? null;`);
