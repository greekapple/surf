// One command to add spots and rebuild every generated artefact (spec docs/specs/2026-11-08-spot-expansion.md).
//
//   node --experimental-strip-types docs/forecast/data/add-spots.ts <rows.json> [--no-network] [--force-wind] [--step=a,b]
//
// <rows.json> is the phase-a-spots.json shape: an array, or {rows: [...]} / {spots: [...]}, of rows. A row is either the COAST_ROWS tuple
// [id, name, region, type, lat, lon, seaward] or an object {id, name, region, type, lat|latitude, lon|longitude, seaward|facing}.
// type is Beach | Point | Reef; lat/lon the beach point (3 decimals); seaward the direction the beach faces (degrees). Extra keys (sources, notes) are ignored here:
// the guide facts go in docs/forecast/data/guide-facts.json (build-guide-facts.ts reads them), they are not copied by this script.
//
// Steps, in order (each child process is the exact command in the generator's own header; every step is idempotent: a second run on the same rows changes nothing):
//   rows    COAST_ROWS (src/data/coast.ts, by latitude) -> coastServiceSpots (services/forecast-service.mjs)
//   scan    scripts/mop-scan.mjs for the NEW ids only -> merged into docs/forecast/data/mop-candidates-all.json (each scanned spot carries its own retrievedOn)   [network]
//   mopc    build-mop-candidates.ts -> src/ocean/mopCandidatesSourced.ts
//   facts   build-guide-facts.ts    -> src/ocean/spotFactsSourced.ts
//   mopids  mopServiceIds (services/forecast-service.mjs) = assignedMopIds() of the regenerated mop.ts
//   slope   mop-slope-all.ts --write --only <new ids> -> src/ocean/nearshoreSlopeSourced.ts (existing rows kept verbatim)   [network: ETOPO, cached in etopo-cache.json]
//   tides   nearest OPEN-COAST CO-OPS prediction station (mdapi; not up a river, slough or lagoon: tideStationExposure) for each new spot, added to src/ocean/tideStations.ts + hiloTideStationIds + tideHiloServiceStationIds   [network]
//   nws     api.weather.gov/points land zone of each new spot (any state: CAZ, ORZ, WAZ...) -> src/services/nwsZones.ts; a point in a marine zone is looked up again 0.8 km, then 2 km inland, and only then borrows the nearest zoned spot within 15 km   [network]
//   wind    build-shore-wind.ts -> src/ocean/shoreWind.json, then shoreWindServiceStations (services/forecast-service.mjs)   [network; only when a spot was added, or --force-wind]
// A spot with no matching MOP point stays without an assignment (the existing mop.ts rule says so honestly); the summary lists it. Nothing is invented.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT = new URL('../../../', import.meta.url).pathname, rel = (p: string) => ROOT + p;
const args = process.argv.slice(2), rowsFile = args.find((a) => !a.startsWith('--')), regionFilter = args.find((a) => a.startsWith('--region='))?.slice(9).split(',') ?? null, NO_NET = args.includes('--no-network'), FORCE_WIND = args.includes('--force-wind');
const idsArg = args.find((a) => a.startsWith('--ids='))?.slice(6), idFilter: Set<string> | null = idsArg ? new Set(JSON.parse(fs.readFileSync(idsArg, 'utf8'))) : null;   // --ids=<file.json>: an array of spot ids to import (a batch list)
const only = args.find((a) => a.startsWith('--step='))?.slice(7).split(',') ?? null, want = (s: string) => !only || only.includes(s);
if (!rowsFile) { console.error('usage: node --experimental-strip-types docs/forecast/data/add-spots.ts <rows.json> [--region=Oahu North Shore,Oahu South Shore] [--no-network] [--force-wind] [--step=a,b]'); process.exit(2); }
const read = (p: string) => fs.readFileSync(rel(p), 'utf8'), write = (p: string, t: string) => { if (read(p) !== t) { fs.writeFileSync(rel(p), t); return true; } return false; };
const today = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
const node = (script: string, a: string[], opts: {out?: string} = {}) => {   // run a generator exactly as its header says; stdout goes to a file only if the run succeeds
  const full = ['--experimental-strip-types', '--no-warnings', rel(script), ...a], res = execFileSync('node', full, {cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'inherit']}).toString();
  if (opts.out) write(opts.out, res); return res;
};
const evalIn = (code: string): any => JSON.parse(execFileSync('node', ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code], {cwd: ROOT, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'inherit']}).toString());
const km = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

// ---------- 0. rows
type Row = [string, string, string, 'Beach' | 'Point' | 'Reef' | null, number, number, number, string?, string?];   // ... seaward, timeZone, country
const raw = JSON.parse(fs.readFileSync(rowsFile, 'utf8'));
// WORLD MODE (spec 2026-11-09 C4): docs/forecast/data/world-spots/<region>.json = {region, spots: [{id, name, country, region, timeZone, type, lat, lon, seaward, facts, nearestSources...}]}.
// Each spot becomes a row WITH its time zone and country, and its `facts` (guide-facts schema) are merged into guide-facts.json (replacing an entry with the same spotId). --region= keeps only the spots whose region ends with one of the names.
const world = !Array.isArray(raw) && Array.isArray(raw.spots) && raw.spots.length > 0 && raw.spots[0].facts !== undefined;
// The world files name countries in words; the app stores ISO 3166-1 alpha-2 (countryOf / hasUsData read it). US territories keep their own code (PR, VI, GU, AS, MP) so they get the US lookups.
const COUNTRY: Record<string, string> = {'United States': 'US', 'USA': 'US', 'US': 'US', 'Puerto Rico': 'PR', 'U.S. Virgin Islands': 'VI', 'US Virgin Islands': 'VI', 'Guam': 'GU', 'American Samoa': 'AS', 'Northern Mariana Islands': 'MP',
  'Canada': 'CA', 'Mexico': 'MX', 'United Kingdom': 'GB', 'Ireland': 'IE', 'France': 'FR', 'Spain': 'ES', 'Portugal': 'PT', 'Italy': 'IT', 'Germany': 'DE', 'Netherlands': 'NL', 'Denmark': 'DK', 'Norway': 'NO', 'Sweden': 'SE', 'Iceland': 'IS', 'Greece': 'GR', 'Malta': 'MT', 'Cyprus': 'CY', 'Croatia': 'HR', 'Israel': 'IL', 'Morocco': 'MA',
  'Senegal': 'SN', 'Ghana': 'GH', 'Namibia': 'NA', 'South Africa': 'ZA', 'Brazil': 'BR', 'Argentina': 'AR', 'Uruguay': 'UY', 'Chile': 'CL', 'Peru': 'PE', 'Ecuador': 'EC', 'Colombia': 'CO', 'Costa Rica': 'CR', 'Panama': 'PA', 'Nicaragua': 'NI', 'El Salvador': 'SV', 'Guatemala': 'GT', 'Honduras': 'HN', 'Belize': 'BZ',
  'Haiti': 'HT', 'Dominican Republic': 'DO', 'Cuba': 'CU', 'Jamaica': 'JM', 'Barbados': 'BB', 'The Bahamas': 'BS', 'Bahamas': 'BS', 'Trinidad and Tobago': 'TT', 'Australia': 'AU', 'New Zealand': 'NZ', 'Fiji': 'FJ', 'Samoa': 'WS', 'Vanuatu': 'VU', 'Solomon Islands': 'SB', 'Papua New Guinea': 'PG', 'French Polynesia': 'PF', 'New Caledonia': 'NC',
  'Indonesia': 'ID', 'Philippines': 'PH', 'Japan': 'JP', 'South Korea': 'KR', 'Taiwan': 'TW', 'China': 'CN', 'India': 'IN', 'Sri Lanka': 'LK', 'Maldives': 'MV', 'Thailand': 'TH', 'Vietnam': 'VN', 'Malaysia': 'MY'};
const countryCode = (name: string) => { const c = COUNTRY[name]; if (!c && !/^[A-Z]{2}$/.test(name)) throw new Error(`no ISO code for country "${name}": add it to COUNTRY in add-spots.ts`); return c ?? name; };
let list: any[] = Array.isArray(raw) ? raw : raw.rows ?? raw.spots ?? [];
if (idFilter) { list = list.filter((r) => idFilter.has(r.id)); const miss = [...idFilter].filter((id) => !list.some((r) => r.id === id)); if (miss.length) throw new Error(`--ids not in the file: ${miss.slice(0, 5).join(', ')}`); }
const worldFacts: any[] = world ? list.filter((r) => !regionFilter || regionFilter.some((n) => String(r.region).endsWith(n))).map((r) => r.facts) : [];
if (world && regionFilter) list = list.filter((r) => regionFilter.some((n) => String(r.region).endsWith(n)));
/** A world row without a break type: derived from the guide's own wave-type words (never guessed beyond them): a point or a reef only when the guide says so and does not also call it a beach, a beach when it says beach, pier or jetty, and NULL (shown nowhere) when the guide states no wave type. */
const worldType = (r: any): 'Beach' | 'Point' | 'Reef' | null => { const w = String(r.facts?.waveType ?? '').toLowerCase(); if (!w || /not stated/.test(w)) return null; return /point/.test(w) ? 'Point' : /reef/.test(w) && !/beach/.test(w) ? 'Reef' : 'Beach'; };
/** US East: the file's region is the state; the long coasts are split into the areas a surfer names, by latitude (navigation groups only; the spot facts are unchanged). */
const eastRegion = (r: any, region: string): string => {
  if (r.country !== 'United States' || r.timeZone !== 'America/New_York') return region;
  if (region === 'Florida') return r.lat >= 29.4 ? 'Northeast Florida' : r.lat >= 27.45 ? 'Space Coast' : r.lat >= 26.9 ? 'Treasure Coast' : 'Southeast Florida';
  if (region === 'North Carolina') return r.lat >= 35.0 ? 'Outer Banks' : 'Southern North Carolina';
  if (region === 'New Jersey') return r.lat >= 39.6 ? 'Northern New Jersey' : 'Southern New Jersey';
  return region;
};
/** US West (round 4): the catalogue's region is "California, <town>" (a census place); the app groups California by county (as the first 86 spots do), so a row's region is the county of its latitude on the coast
 *  (county lines at the coast, north to south; a navigation grouping only, the spot facts are unchanged). The Big Sur coast (Monterey county south of Point Sur's bay, 36.30 N to the SLO line) keeps the app's "Big Sur" name. */
const CA_COUNTIES: [number, string][] = [[41.54, 'Del Norte'], [40.0, 'Humboldt'], [38.77, 'Mendocino'], [38.31, 'Sonoma'], [37.83, 'Marin'], [37.708, 'San Francisco'], [37.107, 'San Mateo'], [36.85, 'Santa Cruz'], [36.3, 'Monterey'], [35.79, 'Big Sur'], [34.97, 'San Luis Obispo'], [34.37, 'Santa Barbara'], [34.045, 'Ventura'], [33.745, 'Los Angeles'], [33.388, 'Orange County'], [-90, 'San Diego']];
const westRegion = (r: any, region: string): string => (r.timeZone === 'America/Los_Angeles' && String(r.region).startsWith('California,') ? CA_COUNTIES.find(([min]) => r.lat >= min)![1] : region);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const {pointInUs} = await import('../../../src/ocean/coverage.ts');
const rows: Row[] = list.map((r) => Array.isArray(r) ? r : [r.id, r.name, world ? westRegion(r, eastRegion(r, String(r.region).replace(/^[^,]+,\s*/, ''))) : r.region, r.type ?? worldType(r), r.lat ?? r.latitude, r.lon ?? r.longitude, r.seaward ?? r.facing, r.timeZone, r.country ? countryCode(r.country) : undefined]).map((r: any[], i: number) => {
  const [id, name, region, type, lat, lon, seaward, timeZone, country] = r;
  if (!/^[a-z0-9-]+$/.test(String(id))) throw new Error(`row ${i}: bad id ${id}`);
  if (!name || !region) throw new Error(`${id}: name and region are required`);
  if (type !== null && !['Beach', 'Point', 'Reef'].includes(type)) throw new Error(`${id}: type must be Beach, Point, Reef or null (got ${type})`);
  if (country !== undefined && country !== 'US') { if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error(`${id}: bad coordinates`); }
  else if (!pointInUs(lat, lon)) throw new Error(`${id}: ${lat}, ${lon} is outside the US boxes (West Coast to 49.1 N, Hawaii, Alaska)`);
  if (!(seaward >= 0 && seaward <= 360)) throw new Error(`${id}: seaward ${seaward} is not a direction in degrees`);
  if (timeZone) { try { new Intl.DateTimeFormat('en-US', {timeZone}); } catch { throw new Error(`${id}: ${timeZone} is not an IANA time zone`); } }
  return [String(id), String(name), String(region), type, r3(+lat), r3(+lon), Math.round(+seaward), ...(timeZone ? [String(timeZone)] : []), ...(timeZone && country ? [String(country)] : [])] as Row;
});
{ const ids = rows.map((r) => r[0]); if (new Set(ids).size !== ids.length) throw new Error('duplicate ids in the rows file'); }
const COAST = 'src/data/coast.ts', SERVICE = 'services/forecast-service.mjs';
const arrayOf = (text: string, name: string): {start: number; end: number; rows: any[]} => {
  const a = text.indexOf(name); if (a < 0) throw new Error('not found: ' + name); const start = text.indexOf('[', text.indexOf('=', a)), end = text.indexOf('\n];', start);
  return {start, end, rows: new Function('return ' + text.slice(start, end + 2))()};
};
const tupleText = (r: Row) => `  [${JSON.stringify(r[0]).replace(/"/g, "'")}, ${quote(r[1])}, ${quote(r[2])}, ${r[3] === null ? 'null' : `'${r[3]}'`}, ${r[4]}, ${r[5]}, ${r[6]}${r[7] ? `, ${quote(r[7])}` : ''}${r[8] ? `, ${quote(r[8])}` : ''}],`;
const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
let added: Row[] = [], changed = false;
if (want('rows')) {
  let t = read(COAST); const cur = arrayOf(t, 'export const COAST_ROWS'), upgraded = arrayOf(t, 'export const UPGRADED_ROWS'), have = new Map<string, any[]>([...cur.rows, ...upgraded.rows].map((r) => [r[0], r]));
  let lines = t.slice(cur.start + 1, cur.end).split('\n').filter((l) => l.trim());   // one row per line
  for (const r of rows) {
    const old = have.get(r[0]);
    if (old) { if (JSON.stringify(old) !== JSON.stringify(r)) { const i = lines.findIndex((l) => l.includes(`['${r[0]}',`)); if (i < 0) throw new Error(`${r[0]} exists outside COAST_ROWS and differs`); lines[i] = tupleText(r); changed = true; } continue; }
    // by latitude, north to south, like the existing list: before the first row that lies further south
    const next = cur.rows.find((x) => x[4] < r[4]), at = next ? lines.findIndex((l) => l.includes(`['${next[0]}',`)) : lines.length; lines.splice(at < 0 ? lines.length : at, 0, tupleText(r)); cur.rows.splice(next ? cur.rows.indexOf(next) : cur.rows.length, 0, r); added.push(r); changed = true;
  }
  t = t.slice(0, cur.start + 1) + '\n' + lines.join('\n') + t.slice(cur.end); write(COAST, t);
  // coastServiceSpots = the evidence rows of coast.ts (UPGRADED_ROWS then COAST_ROWS), marine point 0.08 degrees seaward (coast.ts marinePoint)
  const all = [...arrayOf(t, 'export const UPGRADED_ROWS').rows, ...arrayOf(t, 'export const COAST_ROWS').rows];
  const mp = (lat: number, lon: number, sea: number) => { const th = (sea * Math.PI) / 180, d = 0.08; return {lat: r3(lat + d * Math.cos(th)), lon: r3(lon + (d * Math.sin(th)) / Math.cos((lat * Math.PI) / 180))}; };
  // a marine point on LAND returns no wave data: every point (default or the explicit one of src/data/marinePoints.ts) is checked against the Natural Earth land polygons, and the import fails on a land point
  const {MARINE_POINT_OVERRIDES} = await import('../../../src/data/marinePoints.ts'), {pointOnLand} = await import('../../../src/map/landCheck.ts');
  const landPoints = all.filter(([id, , , , lat, lon, sea]) => { const m = MARINE_POINT_OVERRIDES[id] ?? mp(lat, lon, sea); return pointOnLand(m.lat, m.lon); }).map((r) => r[0]);
  if (landPoints.length) throw new Error(`marine query point on land for ${landPoints.slice(0, 12).join(', ')}${landPoints.length > 12 ? ` (+${landPoints.length - 12})` : ''}: add an explicit sea point with a reason to src/data/marinePoints.ts`);
  const lit = '[' + all.map(([id, , , , lat, lon, sea]) => { const m = MARINE_POINT_OVERRIDES[id] ?? mp(lat, lon, sea); return `{id:'${id}',lat:${lat},lon:${lon},mlat:${m.lat},mlon:${m.lon}}`; }).join(',') + ']';
  let s = read(SERVICE); const a = s.indexOf('export const coastServiceSpots='), b = s.indexOf(';', a); s = s.slice(0, a) + 'export const coastServiceSpots=' + lit + s.slice(b);
  write(SERVICE, s);
  console.log(`rows: ${added.length} added, ${rows.length - added.length} already present${changed && !added.length ? ' (some updated)' : ''}`);
}
// world mode: merge each spot's facts into guide-facts.json (replace by spotId, else append), before the generators read it
if (world && want('facts')) {
  const GF = 'docs/forecast/data/guide-facts.json', all: any[] = JSON.parse(read(GF)); let n = 0;
  for (const f of worldFacts) { const i = all.findIndex((x) => x.spotId === f.spotId); if (i >= 0) { if (JSON.stringify(all[i]) !== JSON.stringify(f)) { all[i] = f; n++; } } else { all.push(f); n++; } }
  write(GF, JSON.stringify(all, null, 1) + '\n'); console.log(`wfacts: ${n} guide-facts entries added or replaced`);
}
const newIds = rows.map((r) => r[0]);   // every row of the file is (re)processed by the per-id steps; each is a no-op for an id already done

// ---------- 1. scan (MOP candidates for ids not yet scanned)
const SCAN = 'docs/forecast/data/mop-candidates-all.json';
if (want('scan')) {
  const scan = JSON.parse(read(SCAN)), done = new Set(scan.spots.map((s: any) => s.id)), todo = rows.filter((r) => !done.has(r[0]) && r[4] >= 32 && r[4] <= 42.1 && r[5] <= -114);   // CDIP MOP covers California only: a spot elsewhere has no scan and says so
  if (todo.length && NO_NET) console.log(`scan: skipped (--no-network), ${todo.length} spots have no MOP candidates yet`);
  else if (todo.length) {
    const tmp = `/tmp/add-spots-${process.pid}`; fs.mkdirSync(tmp, {recursive: true});
    fs.writeFileSync(`${tmp}/spots.json`, JSON.stringify(todo.map((r) => ({id: r[0], name: r[1], lat: r[4], lon: r[5]}))));
    execFileSync('node', [rel('scripts/mop-scan.mjs'), `${tmp}/spots.json`, '--out', `${tmp}/scan.json`], {cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit']});
    const fresh = JSON.parse(fs.readFileSync(`${tmp}/scan.json`, 'utf8'));
    for (const s of fresh.spots) scan.spots.push({...s, retrievedOn: fresh.retrievedOn});   // the file's own retrievedOn stays; a new spot carries its scan date
    write(SCAN, JSON.stringify(scan, null, 1) + '\n'); fs.rmSync(tmp, {recursive: true, force: true}); console.log(`scan: ${todo.length} spots scanned`);
  } else console.log('scan: nothing new');
}
if (want('mopc')) { node('docs/forecast/data/build-mop-candidates.ts', [rel(SCAN)], {out: 'src/ocean/mopCandidatesSourced.ts'}); console.log('mopc: regenerated'); }
if (want('facts')) { node('docs/forecast/data/build-guide-facts.ts', [rel('docs/forecast/data/guide-facts.json'), rel(SCAN)], {out: 'src/ocean/spotFactsSourced.ts'}); console.log('facts: regenerated'); }

// ---------- 2. mopServiceIds
if (want('mopids')) {
  const ids: string[] = evalIn(`import {assignedMopIds} from './src/ocean/mop.ts'; console.log(JSON.stringify(assignedMopIds()))`);
  let s = read(SERVICE); const a = s.indexOf('export const mopServiceIds='), b = s.indexOf(';', a); s = s.slice(0, a) + 'export const mopServiceIds=' + JSON.stringify(ids).replace(/"/g, "'") + s.slice(b);
  console.log(`mopids: ${write(SERVICE, s) ? 'updated' : 'unchanged'} (${ids.length} points)`);
}

// ---------- 3. slope (new ids only; existing rows untouched)
if (want('slope')) { if (NO_NET) console.log('slope: skipped (--no-network)'); else { node('docs/forecast/data/mop-slope-all.ts', ['--write', '--only', newIds.join(',')]); console.log('slope: done'); } }

// ---------- 4. tides
// The nearest CO-OPS prediction station that is not up a river, slough or lagoon (src/ocean/tideStations.ts tideStationExposure: the open-coast rule), within 40 km; the rejected nearer ones are printed with the reason.
const TIDES = 'src/ocean/tideStations.ts', spotsNow = () => evalIn(`import {evidenceSpots} from './src/ocean/spots.ts'; console.log(JSON.stringify(evidenceSpots.map((s) => ({id: s.id, name: s.name, lat: s.latitude, lon: s.longitude}))))`) as {id: string; name: string; lat: number; lon: number}[];
if (want('tides')) {
  if (NO_NET) console.log('tides: skipped (--no-network)');
  else {
    let t = read(TIDES); const regIds = new Set([...t.matchAll(/\{id: '([^']+)', name:/g)].map((m) => m[1])), cur = spotsNow().filter((s) => newIds.includes(s.id));
    const res = await fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions', {signal: AbortSignal.timeout(60000)}); if (!res.ok) throw new Error('CO-OPS mdapi ' + res.status);
    const list: {id: string; name: string; lat: number; lon: number}[] = ((await res.json()).stations ?? []).filter((x: any) => Number.isFinite(x.lat) && Number.isFinite(x.lng)).map((x: any) => ({id: x.id, name: x.name, lat: x.lat, lon: x.lng})), addIds: string[] = [];
    const {pickTideStation, tideStationExposure} = await import('../../../src/ocean/tideStations.ts');
    for (const s of cur) {
      const pick = pickTideStation(s.lat, s.lon, list);
      const skipped = list.map((x) => ({x, km: km(s.lat, s.lon, x.lat, x.lon)})).filter((c) => c.km <= (pick?.distanceKm ?? 40) && tideStationExposure(c.x.name, c.x.id).exposure !== 'open' && tideStationExposure(c.x.name, c.x.id).exposure !== 'unknown').sort((a, b) => a.km - b.km).slice(0, 3);
      if (skipped.length) console.log(`tides: ${s.name}: skipped ${skipped.map((c) => `${c.x.name} (${c.x.id}) ${c.km.toFixed(1)} km [${tideStationExposure(c.x.name, c.x.id).why}]`).join('; ')}`);
      if (!pick) { console.log(`tides: ${s.name}: no open-coast CO-OPS prediction station within 40 km`); continue; }
      if (!regIds.has(pick.station.id) && !addIds.includes(pick.station.id)) {
        addIds.push(pick.station.id); const x = pick.station, line = `  {id: '${x.id}', name: ${JSON.stringify(x.name)}, lat: ${x.lat.toFixed(5)}, lon: ${x.lon.toFixed(5)}, retrievedOn: '${today}', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=${x.id}'},`;
        t = t.replace(/\n\];\nexport const SF_STATION/, `\n${line}\n];\nexport const SF_STATION`);
      }
    }
    if (addIds.length) { t = t.replace(/(export const hiloTideStationIds = \[[^\]]*?)\];/, (_m, a) => `${a}${a.trim().endsWith(',') ? '' : ','}  ${addIds.map((i) => `'${i}'`).join(',  ')}];`); }
    write(TIDES, t);
    if (addIds.length) { let sv = read(SERVICE); sv = sv.replace(/(export const tideHiloServiceStationIds=\[[^\]]*?)\];/, (_m, a) => `${a},  ${addIds.map((i) => `'${i}'`).join(',  ')}];`); write(SERVICE, sv); }
    console.log(`tides: ${addIds.length} station(s) added${addIds.length ? ': ' + addIds.join(', ') : ''}`);
  }
}

// ---------- 5. NWS zones
// Two passes: (1) resolve the zone of every new spot that has none yet; (2) THEN, for every new spot with no land zone of its own, borrow the nearest spot that has one
// (within 15 km, a spot's own zone only, never a borrowed one). The borrow is recomputed on every run, so it never depends on the order the rows were processed in.
const NWS = 'src/services/nwsZones.ts';
if (want('nws')) {
  if (NO_NET) console.log('nws: skipped (--no-network)');
  else {
    let t = read(NWS); const have = (id: string) => new RegExp(`^  '${id}':`, 'm').test(t.slice(0, t.indexOf('export const NWS_ZONE_APPROX'))), all = spotsNow(), fresh = all.filter((s) => newIds.includes(s.id) && !have(s.id)), lines: string[] = [];
    const {isLandZoneId} = await import('../../../src/services/nwsZones.ts');
    const zoneAt = async (lat: number, lon: number, name: string): Promise<{zone: string | null; other: string}> => {
      try {
        const r = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {headers: {'User-Agent': 'SWELLO surf app', Accept: 'application/geo+json'}, signal: AbortSignal.timeout(30000)});
        if (r.ok) { const z = String(((await r.json()) as any).properties?.forecastZone ?? '').split('/').pop() ?? ''; return isLandZoneId(z) ? {zone: z, other: ''} : {zone: null, other: z}; }
        console.log(`nws: ${name}: HTTP ${r.status}`);
      } catch (e) { console.log(`nws: ${name}: ${String(e).slice(0, 60)}`); }
      await new Promise((r) => setTimeout(r, 300)); return {zone: null, other: ''};
    };
    for (const s of fresh) {
      let {zone, other: marine} = await zoneAt(s.lat, s.lon, s.name), inland = false, inlandKm = 0.8;
      await new Promise((r) => setTimeout(r, 300));
      if (!zone) {   // a beach point often falls in the marine zone: look again 0.8 km inland (opposite the beach's seaward direction) before borrowing from a neighbour
        const sea = rows.find((r) => r[0] === s.id)?.[6]; if (sea !== undefined) {
          for (const km0 of [0.8, 2]) {   // 0.8 km inland first, then 2 km (Florence's 0.8 km point is still in the marine zone)
            const th = ((sea + 180) % 360) * Math.PI / 180, d = km0 / 111.2, la = s.lat + d * Math.cos(th), lo = s.lon + (d * Math.sin(th)) / Math.cos(s.lat * Math.PI / 180);
            const z2 = await zoneAt(la, lo, `${s.name} (${km0} km inland)`); await new Promise((r) => setTimeout(r, 300)); if (z2.zone) { zone = z2.zone; inland = true; inlandKm = km0; break; }
          }
        }
      }
      lines.push(zone ? `  '${s.id}': "${zone}",${inland ? ` // resolved ${inlandKm} km inland: the beach point is in ${marine ? 'marine zone ' + marine : 'a marine zone'}` : ''}` : `  '${s.id}': null, // ${marine ? 'marine zone ' + marine : 'no zone resolved'}: no land beach-hazard zone resolved`);
    }
    if (lines.length) t = t.replace(/\n\};\n\n\/\*\* Spots whose own point/, `\n${lines.join('\n')}\n};\n\n/** Spots whose own point`);
    // pass 2: every new spot whose own zone is null borrows from the nearest spot with its own land zone (all spots, new or old)
    const own: Record<string, string> = {}; for (const m of t.slice(0, t.indexOf('export const NWS_ZONE_APPROX')).matchAll(/^  '([^']+)': "([A-Z]{2}Z\d+)"/gm)) own[m[1]] = m[2];
    const isNull = (id: string) => new RegExp(`^  '${id}': null`, 'm').test(t.slice(0, t.indexOf('export const NWS_ZONE_APPROX')));
    const apx = t.indexOf('export const NWS_ZONE_APPROX'), apxEnd = t.indexOf('\n};', apx); let body = t.slice(t.indexOf('\n', apx) + 1, apxEnd).split('\n').filter((l) => l.trim());
    let borrowed = 0;
    for (const s of all.filter((x) => newIds.includes(x.id) && isNull(x.id))) {
      const near = all.filter((o) => own[o.id]).map((o) => ({o, d: km(s.lat, s.lon, o.lat, o.lon)})).sort((a, b) => a.d - b.d)[0];
      body = body.filter((l) => !l.includes(`'${s.id}':`));
      if (near && near.d <= 15) { body.push(`  '${s.id}': {zone: '${own[near.o.id]}', viaSpot: '${near.o.id}', km: ${Math.round(near.d * 10) / 10}}, // ${s.name} -> ${near.o.name}`); borrowed++; }
    }
    t = t.slice(0, t.indexOf('\n', apx) + 1) + body.join('\n') + t.slice(apxEnd);
    write(NWS, t); console.log(`nws: ${fresh.length} spot(s) resolved, ${borrowed} borrow a neighbour's zone`);
  }
}

// ---------- 6. shore wind
if (want('wind')) {
  if (NO_NET) console.log('wind: skipped (--no-network)');
  else if (!added.length && !FORCE_WIND) console.log('wind: no new spots (use --force-wind to rebuild)');
  else {
    node('docs/forecast/data/build-shore-wind.ts', []);
    const reg = JSON.parse(read('src/ocean/shoreWind.json')), seen: string[] = [], ents: string[] = [];
    for (const a of reg.assignments) { const k = a.kind + a.stationId; if (!seen.includes(k)) { seen.push(k); ents.push(`{kind:'${a.kind}',id:'${a.stationId}'}`); } }
    let s = read(SERVICE); const a = s.indexOf('export const shoreWindServiceStations='), b = s.indexOf(';', a); s = s.slice(0, a) + 'export const shoreWindServiceStations=[' + ents.join(',') + ']' + s.slice(b); write(SERVICE, s);
    console.log(`wind: ${reg.assignments.length} spots with a shore station, ${ents.length} stations ingested`);
  }
}

// ---------- summary: what each row ended up with (honest "none"s)
{
  const out = evalIn(`import {assignmentFor} from './src/ocean/mop.ts'; import {sourcedSlopes} from './src/ocean/nearshoreSlopeSourced.ts'; import {nearestTideStations} from './src/ocean/tideStations.ts'; import {zoneFor} from './src/services/nwsZones.ts'; import {shoreAssignmentFor} from './src/ocean/shoreWind.ts'; import {evidenceSpots} from './src/ocean/spots.ts';
    const ids = ${JSON.stringify(newIds)}; console.log(JSON.stringify(ids.map((id) => { const s = evidenceSpots.find((e) => e.id === id); if (!s) return {id, missing: true}; const a = assignmentFor(id), t = nearestTideStations(s.latitude, s.longitude)[0], z = zoneFor(id), w = shoreAssignmentFor(id);
      return {id, name: s.name, mop: a ? a.mopId : null, slope: sourcedSlopes.some((x) => x.spotId === id), tide: t ? t.station.name + ' ' + t.distanceKm + ' km' : null, nws: z ? z.zone + (z.approx ? ' (approx via ' + z.viaSpot + ')' : '') : null, wind: w ? w.stationId + ' ' + w.distanceKm + ' km' : null}; })))`) as any[];
  console.log('\nspot                          MOP      slope  tide station                         NWS zone        shore wind');
  for (const r of out) console.log(r.missing ? `${r.id}: NOT in evidenceSpots` : `${r.name.padEnd(29)} ${String(r.mop ?? 'none').padEnd(8)} ${String(r.slope ? 'yes' : 'no').padEnd(6)} ${String(r.tide ?? 'none').padEnd(36)} ${String(r.nws ?? 'none').padEnd(15)} ${r.wind ?? 'none'}`);
}
