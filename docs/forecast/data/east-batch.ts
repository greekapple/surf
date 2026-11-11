// Batch 3 (US East, US Gulf, Puerto Rico and the US Virgin Islands): which appCandidate rows of world-spots/{us-east,us-gulf,caribbean}.json become app spots, and which are left out with the reason.
//   node --experimental-strip-types docs/forecast/data/east-batch.ts   -> world-spots/us-east-gulf-pr-batch3-{east,gulf,pr}-ids.json + us-east-gulf-pr-batch3-drops.json
// appCandidate is set by scripts/mark-app-candidates.py (guide facing, CO-OPS tide within 30 km, live wave buoy within 100 km). Dropped here, with the reason:
//  1. NEAR APP SPOT: any spot already in the app within 1.5 km (the catalogue only dropped rows within 1 km or the same name within 25 km). The app spot's name is recorded so a different break can be put back by hand.
//  2. SAME BREAK AS ANOTHER CANDIDATE: the same name (case, punctuation, "state/beach/the", street = st ignored) within 0.5 km; the row with more facts is kept.
//  3. NAME VARIANTS AND SHARED SOURCES (review round 2026-11-10): two rows whose names match once spaces, plurals, "point/beach/island/park/jetty" and one letter are ignored (Matunuck/Matanuck, Fox Hill/Foxhill Point, Rockaways/Rockaway) within 3 km, or that cite the same source page within 2.5 km, are FLAGGED. Every flagged pair (batch row against another batch row or an app spot) must have a decision below: MERGE (one row per break; the dropped row's sources are added to the kept row's facts) or KEEP (a different break, with the reason). An undecided pair stops the script.
//  4. NO OPEN-WATER MARINE POINT along the facing (decided by hand).
import fs from 'node:fs';
import {COAST_ROWS, UPGRADED_ROWS} from '../../../src/data/coast.ts';
const dir = new URL('./world-spots/', import.meta.url).pathname;
const km = (a: {lat: number; lon: number}, b: {lat: number; lon: number}) => { const r = Math.PI / 180, h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const norm = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).map((w) => (w === 'street' ? 'st' : w)).filter((w) => w && !['state', 'beach', 'the', 'st'].includes(w)).join(' ');
const weight = (s: any) => (s.facts?.sources?.length ?? 0) * 100 + Object.values(s.facts ?? {}).filter((v) => v !== null && v !== undefined && v !== '').length;
// the app spots as they were BEFORE this batch: every row of coast.ts except the batch's own candidates (after an import they are in coast.ts too)
const candIds = new Set(['us-east.json', 'us-gulf.json', 'caribbean.json'].flatMap((f) => JSON.parse(fs.readFileSync(dir + f, 'utf8')).spots.filter((s: any) => s.appCandidate === true).map((s: any) => s.id)));
const app = [...UPGRADED_ROWS, ...COAST_ROWS].filter((r: any) => !candIds.has(r[0])).map((r: any) => ({id: r[0], name: r[1], lat: r[4], lon: r[5]}));
const SETS: {tag: string; file: string; keep: (s: any) => boolean}[] = [
  {tag: 'east', file: 'us-east.json', keep: () => true}, {tag: 'gulf', file: 'us-gulf.json', keep: () => true}, {tag: 'pr', file: 'caribbean.json', keep: (s) => s.country === 'Puerto Rico' || s.country === 'U.S. Virgin Islands'}];
/** dropped id -> kept id, with the reason: the same break written twice (names or source pages). The kept row gets the dropped row's sources. */
export const MERGES: Record<string, {keep: string; reason: string}> = {
  'w-us-rockaway': {keep: 'w-us-rockaways', reason: 'the same surf-forecast page (Rockaway_1), 0.4 km apart; surfnerd lists it as "Rockaways" (faces S) and "Rockaway" (faces SSE)'},
  'w-us-matanuck': {keep: 'w-us-matunuck', reason: 'a misspelling of Matunuck, 0.2 km apart (surfnerd faces S and SSE)'},
  'w-us-fox-hill': {keep: 'w-us-foxhill-point', reason: 'Fox Hill and Foxhill Point, 0.16 km apart, both "Faces ESE" (the kept row has the surf-forecast page)'},
  'w-carib-wilderness-puerto-rico': {keep: 'w-carib-wilderness-aguadilla', reason: 'Wilderness in Aguadilla written twice, 0.55 km apart (surfnerd NW and WNW; the kept row has the surf-forecast page)'},
  'w-us-fishermans-island-virginia': {keep: 'w-us-fishermans-island', reason: 'Fisherman Island, Virginia, 1.3 km apart, both a point (surfnerd S and SW); the kept row has the surf-forecast page'},
  'w-us-san-jose-island': {keep: 'w-us-st-joes-island', reason: "St. Joseph (San Jose) Island, 0.7 km apart, both \"Faces ESE\"; the kept row has three sources"},
};
/** Flagged pairs that are different breaks, kept (key = the two ids sorted and joined with +). */
export const KEEP_BOTH: Record<string, string> = {
  'w-us-lido-beach+w-us-lido-beach-new-york': 'two different surf-forecast pages (Lido Beach and Lido West), 1.1 km apart; the names are the same in the guide',
  'w-carib-middles+w-carib-middles-isabela': 'two different surfnerd pages and positions 1.7 km apart (faces NNE and N); the guide lists both as Middles',
  'w-us-moody-beach+w-us-moody-point': 'a beach and a point with their own surfnerd pages, 1 km apart',
  'w-us-wells-beach+w-us-wells-jetties': 'the beach and the jetties, separate pages 1.4 km apart',
  'w-us-5th-street+w-us-7th-street-new-jersey': 'different streets', 'w-us-5th-street+w-us-8th-street-jetty': 'different streets', 'w-us-7th-street-new-jersey+w-us-8th-street-jetty': 'different streets',
};
/** Rows with no open-water marine point along the facing: left out. */
export const NO_WATER_POINT: Record<string, {set: string; name: string; reason: string}> = {
  'w-us-kite-point': {set: 'east', name: 'Kite Point', reason: 'faces west (270 degrees) into Pamlico Sound (a sound-side kiteboarding spot, ETOPO -1.9 m): no open-ocean marine point exists along its facing and a sound is not an ocean break'},
  'w-us-meudon-beach': {set: 'east', name: 'Meudon Beach', reason: 'faces north-north-west (338 degrees) into Long Island Sound (enclosed water, ETOPO -9 m): no open-ocean marine point exists along its facing'},
  'w-us-pickens-point': {set: 'gulf', name: 'Pickens Point', reason: 'faces west (270 degrees) into Pensacola Pass at the west end of Santa Rosa Island (the point reads +5 m, land): no open-water marine point exists along its facing'},
};
const kept: any[] = [], s0 = (rows: any[], id: string) => rows.find((r) => r.id === id);
const drops: any[] = [], summary: Record<string, any> = {};
const looseKey = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '').replace(/(state|beach|the|point|park|island|islands|jetties|jetty)/g, '').replace(/s$/, '');
const lev = (a: string, b: string) => { const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const factsAll: any[] = JSON.parse(fs.readFileSync(new URL('./guide-facts.json', import.meta.url).pathname, 'utf8')), worldFacts = new Map<string, any>();
for (const f of ['us-east.json', 'us-gulf.json', 'caribbean.json']) for (const x of JSON.parse(fs.readFileSync(dir + f, 'utf8')).spots) worldFacts.set(x.id, x.facts);
const urlsOf = (id: string) => new Set<string>(((worldFacts.get(id) ?? factsAll.find((g) => g.spotId === id))?.sources ?? []).map((x: any) => String(x.url ?? '').replace(/[#?].*$/, '')).filter((u: string) => u && !/\/$/.test(u)));
for (const set of SETS) {
  const rows: any[] = JSON.parse(fs.readFileSync(dir + set.file, 'utf8')).spots.filter((s: any) => s.appCandidate === true && set.keep(s)).map((s: any) => ({...s, lat: +s.lat, lon: +s.lon})), gone = new Set<string>();
  for (const s of rows) {
    let best: any = null; for (const a of app) { const d = km(s, a); if (d <= 1.5 && (!best || d < best.d)) best = {d, a}; }
    if (best) { gone.add(s.id); drops.push({set: set.tag, id: s.id, name: s.name, kind: 'near-app-spot', keptId: best.a.id, keptName: best.a.name, km: Math.round(best.d * 100) / 100, sameName: norm(s.name) === norm(best.a.name), reason: `${Math.round(best.d * 100) / 100} km from the app spot "${best.a.name}" (rule: within 1.5 km)`}); }
  }
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j]; if (gone.has(a.id) || gone.has(b.id) || !norm(a.name) || norm(a.name) !== norm(b.name)) continue;
    const d = km(a, b); if (d > 0.5) continue; const [keep, lose] = weight(b) > weight(a) ? [b, a] : [a, b]; gone.add(lose.id);
    drops.push({set: set.tag, id: lose.id, name: lose.name, kind: 'same-break-candidate', keptId: keep.id, keptName: keep.name, km: Math.round(d * 100) / 100, reason: `the same break as "${keep.name}" (${Math.round(d * 100) / 100} km apart, same name): one row kept, the one with more guide facts`});
  }
  for (const s of rows) { const m = MERGES[s.id]; if (m && !gone.has(s.id)) { gone.add(s.id); const keep = worldFacts.get(m.keep) ? m.keep : m.keep; drops.push({set: set.tag, id: s.id, name: s.name, kind: 'same-break-merged', keptId: keep, keptName: m.keep, reason: m.reason + '; its sources are added to the kept row'}); } const nw = NO_WATER_POINT[s.id]; if (nw && !gone.has(s.id)) { gone.add(s.id); drops.push({set: set.tag, id: s.id, name: nw.name, kind: 'no-open-water-marine-point', reason: nw.reason}); } }
  const ids = rows.filter((s) => !gone.has(s.id)).map((s) => s.id).sort(); fs.writeFileSync(dir + `us-east-gulf-pr-batch3-${set.tag}-ids.json`, JSON.stringify(ids, null, 1) + '\n');
  summary[set.tag] = {candidates: rows.length, import: ids.length, dropped: gone.size}; for (const id of ids) kept.push(s0(rows, id));
}
// flagged pairs: every kept batch row against every other kept batch row and every app spot not dropped
const flagged: string[] = [], seenPair = new Set<string>();
for (const a of kept) for (const b of [...kept, ...app.map((x: any) => ({...x, app: true}))]) {
  if (a.id === b.id) continue; const key = [a.id, b.id].sort().join('+'); if (seenPair.has(key)) continue; seenPair.add(key); const d = km(a, b); if (d > 3) continue;
  const la = looseKey(a.name), lb = looseKey(b.name), nameSim = la && lb && (la === lb || (Math.min(la.length, lb.length) >= 5 && lev(la, lb) <= 1)), ua = urlsOf(a.id), ub = urlsOf(b.id), shared = [...ua].some((u) => ub.has(u));
  if ((nameSim && d <= 3) || (shared && d <= 2.5)) { if (!KEEP_BOTH[key]) flagged.push(`${a.name} (${a.id}) ~ ${b.name} (${b.id}) ${Math.round(d * 100) / 100} km${shared ? ', shared source' : ''}`); }
}
if (flagged.length) { console.error('UNDECIDED duplicate pairs (add a MERGES or KEEP_BOTH entry):\n  ' + flagged.join('\n  ')); process.exit(1); }
fs.writeFileSync(dir + 'us-east-gulf-pr-batch3-drops.json', JSON.stringify(drops, null, 1) + '\n');
console.log(JSON.stringify(summary)); for (const d of drops) console.log(`  drop [${d.set}] ${d.name} (${d.id}) ~ ${d.keptName} ${d.km} km${d.sameName ? ' SAME NAME' : ''} (${d.kind})`);
