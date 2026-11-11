// `/api/water-quality?spot=<id>` (water quality, spec item 4): ONE agency fact for a spot, from its rule-checked station (distance and name; 19 by hand) (src/data/waterQualitySourced.ts, STATION_REVIEW decision 'reviewed').
// On demand and hot-gated by nature: nothing is fetched until someone opens a spot page that has a reviewed station (no cron, no Open-Meteo). Each agency's list is fetched ONCE per TTL and shared by every spot of that
// agency; upstream calls are serialised at most 1 a second with the project User-Agent; the answer is kept in memory (3 h; 5 min after a failure, and a failed refresh keeps the older answer, labelled with its own date).
// The answer is the agency's OWN words and date, never an estimate: {ok, spotId, source, agency, agencyUrl, kind:'status'|'result'|'link'|'season', status, detail, date, link, retrievedAt}. Absent station = {ok:true, none:true}.
// Florida is link only (no data fetched). California is bacteria RESULTS (BeachWatch), never a posting or a closure. "No advisory" is never worded as "clean". Staff e-mail addresses in the Hawaii records are not read into the answer.
import {STATION_REVIEW, WQ_AGENCIES} from '../src/data/waterQualitySourced.ts';

export const WQ_UA = 'SWELLO surf forecast prototype', WQ_TTL_MS = 10800000, WQ_MISS_MS = 300000, WQ_GAP_MS = 1100;
const NC = 'https://services2.arcgis.com/kCu40SDxsCGcuUWO/arcgis/rest/services/PUBLICVIEWRecreationWaterQualityDatabase/FeatureServer';
const SC = 'https://gis.des.sc.gov/gisserver/rest/services/OCRM/BeachMonitoring/MapServer';
const CA_RESOURCE = '15a63495-8d9f-4a49-b43a-3092ef3106b9';
const ymd = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
const iso = (s) => String(s).slice(0, 10);
const BEACH_WORDS = /\b(beach|park|state|county|bay|point|island|street|access|pier|shoreline|the|and|of)\b/gi;
export const placeWords = (s) => new Set(String(s ?? '').normalize('NFD').replace(/[̀-ͯ‘’ʻ'`]/g, '').toLowerCase().replace(BEACH_WORDS, ' ').split(/[^a-z0-9]+/).filter((w) => w.length >= 4));

const NOADV = 'no advisory is not a clean-water result';
// ---- geometry (Hawaii area advisories are polygons): a station is covered when it is inside a polygon or within 100 m of one of its edges
const rings = (wkt) => [...String(wkt ?? '').matchAll(/\(([-0-9.eE ,]+)\)/g)].map((m) => m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite)));
const segKm = (x, y, [x1, y1], [x2, y2]) => { const k = Math.cos((y * Math.PI) / 180), px = (x - x1) * k, py = y - y1, dx = (x2 - x1) * k, dy = y2 - y1, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, (px * dx + py * dy) / L)) : 0; return Math.hypot(px - t * dx, py - t * dy) * 111.2; };
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
export function covers(wkt, lon, lat, nearKm = 0.1) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  const areal = /POLYGON/i.test(String(wkt));
  return rings(wkt).some((r) => (areal && r.length > 3 && inRing(lon, lat, r)) || r.some((p, i) => (r.length === 1 ? Math.hypot((lon - p[0]) * Math.cos((lat * Math.PI) / 180), lat - p[1]) * 111.2 : segKm(lon, lat, p, r[(i + 1) % r.length])) <= nearKm));
}
const nameKey = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ‘’ʻ'`.]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Hawaii: every OPEN notice that belongs to the station: (1) the notice names the station (bacteria "Beach Advisory": station.number), (2) the station lies in or within 100 m of the notice's area (events/{id}.locations[].geometry),
 *  (3) the notice's location name is the station's own name, in full. A shared word is NOT a match. No match = "No open DOH notice matched to <station>" (never "for this beach", never clean). */
export function hiMatches(station, e) {
  if (e.status !== 'Open') return false;
  if (e.station?.number != null && String(e.station.number) === String(station.stationId)) return true;
  if ((e.locations ?? []).some((l) => covers(l.geometry, station.lon, station.lat))) return true;
  return !!e.locationName && nameKey(e.locationName) === nameKey(station.station);
}
export function hiAnswer(station, events, retrievedAt) {
  const hits = (events?.list ?? []).filter((e) => hiMatches(station, e));
  if (hits.length) {
    const date = hits.map((e) => iso(e.postedDate)).sort().pop();
    return {kind: 'status', status: hits.map((e) => `${e.type}${e.cause ? `: ${String(e.cause).trim()}` : ''}${e.locationName ? ` (${e.locationName})` : ''}`).join('; '), detail: hits.length > 1 ? `${hits.length} open notices` : (hits[0].title ?? null), date, dateLabel: 'posted', link: 'https://eha-cloud.doh.hawaii.gov/cwb/#!/events'};
  }
  return {kind: 'status', status: `No open DOH notice matched to ${station.station}`, detail: NOADV, date: iso(retrievedAt), dateLabel: 'checked', link: 'https://eha-cloud.doh.hawaii.gov/cwb/#!/events'};
}
export function ncAnswer(station, stations, results, retrievedAt) {
  const f = (stations?.features ?? []).map((x) => x.attributes).find((a) => a.ASN === station.stationId); if (!f) return null;
  const r = (results?.features ?? []).map((x) => x.attributes).filter((a) => a.ASN === station.stationId).sort((a, b) => b.Date - a.Date)[0], status = String(f.Status ?? '').trim() || null;
  return r ? {kind: 'status', status, detail: null, date: new Date(r.Date).toISOString().slice(0, 10), dateLabel: 'last sample', link: WQ_AGENCIES['nc-deq-rwq'].url}
    : {kind: 'status', status, detail: 'no sample in 30 days', date: iso(retrievedAt), dateLabel: 'checked', link: WQ_AGENCIES['nc-deq-rwq'].url};
}
export function gaAnswer(station, geo) {
  const f = (geo?.features ?? []).map((x) => x.properties).find((p) => p.beachId === station.stationId || p.stationCode === station.stationId); if (!f) return null;
  const word = {Green: 'Green: no advisory', Yellow: 'Yellow: swimming advisory (high bacteria)', Gray: 'Gray: not currently tested'}[f.status] ?? String(f.status);
  const [m, d, y] = String(f.dateCollected ?? '').split('/');
  return {kind: 'status', status: word, detail: f.permanentAdvisory === 'YES' ? 'permanent advisory' : null, date: y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null, dateLabel: 'sampled', link: WQ_AGENCIES['ga-dnr-healthy-beaches'].url};
}
/** South Carolina: the TEMPORARY advisories layer (8: StationName, adv) takes precedence over the station layer's standing Advisory field. The layers carry no date: dated as CHECKED, with the routine sampling season. */
export function scAnswer(station, stations, temps, retrievedAt) {
  const f = (stations?.features ?? []).map((x) => x.attributes).find((a) => a.STATION === station.stationId); if (!f) return null;
  const t = (temps?.features ?? []).map((x) => x.attributes).find((a) => nameKey(a.StationName) === nameKey(station.stationId) || nameKey(a.StationName) === nameKey(f.LOCATION));
  const adv = String(f.Advisory ?? '').trim(), none = !adv || /^(none|no( advisory)?|n\/a|-)$/i.test(adv), common = {date: iso(retrievedAt), dateLabel: 'checked', link: WQ_AGENCIES['sc-des-beach'].url};
  if (t) return {kind: 'status', status: `Temporary advisory${t.adv ? `: ${String(t.adv).trim()}` : ''}`, detail: 'routine sampling May to October', ...common};
  return {kind: 'status', status: none ? 'No advisory posted' : `Advisory: ${adv}`, detail: 'routine sampling May to October', ...common};
}
/** California BeachWatch: the latest bacteria RESULT against the AB 411 single-sample limits (Enterococcus 104, Fecal Coliform 400; E. coli 400 as the counties apply it). The rule is named in the line; total coliform and the
 *  coliform ratio are not checked, so this is never "safe", "within the standard", open or closed. */
export const CA_LIMIT = {Enterococcus: 104, 'E. coli': 400, 'Fecal Coliform': 400};
export function caAnswer(station, records) {
  const link = WQ_AGENCIES['ca-beachwatch-fib'].url, mine = (records ?? []).filter((r) => r.StationCode === station.stationId && CA_LIMIT[r.Analyte] !== undefined);
  const day = mine.map((r) => iso(r.SampleDate)).sort().pop(); if (!day) return {kind: 'link', status: null, detail: null, date: null, note: 'No test in the last 45 days', link};
  const parts = mine.filter((r) => iso(r.SampleDate) === day).map((r) => `${r.Analyte} ${r.Result} ${r.Unit} (${r.Result > CA_LIMIT[r.Analyte] ? 'above' : 'below'} the AB 411 single-sample limit of ${CA_LIMIT[r.Analyte]})`);
  return {kind: 'result', status: parts.join('; '), detail: 'a lab result, not a posting or closure status; total coliform and the coliform ratio are not checked here', date: day, dateLabel: 'Latest test', link};
}
/** NJ's sampling program runs Memorial Day to Labor Day: outside it the agency says so; in season this build links to the agency (its live-status endpoint is not wired). */
export const njSeason = (t) => { const m = new Date(t).getUTCMonth() + 1; return m >= 5 && m <= 9; };
export function njAnswer(t) {
  const link = WQ_AGENCIES['nj-dep-ccmp'].url, y = new Date(t).getUTCFullYear() + (new Date(t).getUTCMonth() >= 9 ? 1 : 0);
  return njSeason(t) ? {kind: 'link', status: null, detail: null, date: null, link} : {kind: 'season', status: `Not monitored until the ${y} season`, detail: null, date: null, link};
}

export function createWaterQuality({fetcher = fetch, now = Date.now, timeoutMs = 20000} = {}) {
  const lists = new Map(), jobs = new Map(), answers = new Map(); let chain = Promise.resolve(), lastCall = 0;
  const reviewed = (spotId) => STATION_REVIEW.filter((r) => r.spotId === spotId && r.decision === 'reviewed').sort((a, b) => a.km - b.km)[0] ?? null;
  /** One upstream call at a time, at least WQ_GAP_MS apart. A rejected call never affects the next one, and every caller gets ITS OWN call's result (or error). */
  const serial = (fn) => { const run = chain.catch(() => {}).then(async () => { const wait = lastCall + WQ_GAP_MS - now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); lastCall = now(); return fn(); }); chain = run; return run; };
  const get = (url, accept = 'application/json') => serial(async () => {
    const r = await fetcher(url, {headers: {'User-Agent': WQ_UA, Accept: accept}, signal: AbortSignal.timeout(timeoutMs)}); if (!r.ok) throw new Error(`agency HTTP ${r.status}`);
    const j = await r.json(); if (j === null || typeof j !== 'object' || j.error) throw new Error('agency sent an empty or invalid body'); return j;
  });
  const arr = (x, what) => { if (!Array.isArray(x)) throw new Error(`agency answer lacks ${what}`); return x; };
  const FETCHERS = {
    'hi-doh-cwb': async () => {
      const j = await get('https://eha-cloud.doh.hawaii.gov/cwb/api/events?status=Open'); const list = arr(j.list, 'list');
      for (const e of list) if (e.status === 'Open' && e.station?.number == null && e.id != null && /^\d+$/.test(String(e.id))) { const d = await get(`https://eha-cloud.doh.hawaii.gov/cwb/api/events/${e.id}`); e.locations = arr(d.locations ?? [], 'locations').map((l) => ({geometry: l.geometry})); }   // the list omits the areas; one detail call per open area notice
      return {list: list.map((e) => ({id: e.id, type: e.type, status: e.status, title: e.title, locationName: e.locationName, cause: e.cause, postedDate: e.postedDate, station: e.station?.number != null ? {number: e.station.number} : null, locations: e.locations ?? []}))};   // nothing else is kept (the records carry staff e-mail addresses)
    },
    'nc-deq-rwq': async () => { const s = await get(`${NC}/0/query?where=1%3D1&outFields=ASN,Status&returnGeometry=false&f=json`); arr(s.features, 'features'); if (!s.features.length) throw new Error('no stations'); const since = new Date(now() - 30 * 86400000).toISOString().slice(0, 10); const r = await get(`${NC}/1/query?where=${encodeURIComponent(`Date >= timestamp '${since}'`)}&outFields=ASN,Date&returnGeometry=false&resultRecordCount=2000&f=json`); arr(r.features, 'features'); return {s, r}; },
    'sc-des-beach': async () => { const s = await get(`${SC}/1/query?where=1%3D1&outFields=STATION,LOCATION,Advisory&returnGeometry=false&f=json`); arr(s.features, 'features'); if (!s.features.length) throw new Error('no stations'); const t = await get(`${SC}/8/query?where=1%3D1&outFields=StationName,adv&returnGeometry=false&f=json`); arr(t.features, 'features'); return {s, t}; },
    'ga-dnr-healthy-beaches': async () => { const g = await get('https://webapp.gadnr.org/beach/working/beach.geojson'); if (!arr(g.features, 'features').length) throw new Error('no beaches'); return g; },
    'ca-beachwatch-fib': async () => { const codes = [...new Set(STATION_REVIEW.filter((r) => r.source === 'ca-beachwatch-fib' && r.decision === 'reviewed').map((r) => `'${r.stationId.replace(/'/g, '')}'`))].join(','); const since = new Date(now() - 45 * 86400000).toISOString().slice(0, 10); const sql = `SELECT "StationCode","SampleDate","Analyte","Result","Unit" FROM "${CA_RESOURCE}" WHERE "StationCode" IN (${codes}) AND "SampleDate" > '${since}' AND "Analyte" IN ('Enterococcus','E. coli','Fecal Coliform') ORDER BY "SampleDate" DESC LIMIT 5000`; const j = await get(`https://data.ca.gov/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`); if (j.success !== true) throw new Error('CKAN did not succeed'); return arr(j.result?.records, 'records'); },
  };
  function list(source) {
    const hit = lists.get(source); if (hit && now() < hit.until) return Promise.resolve(hit);
    if (!jobs.has(source)) jobs.set(source, FETCHERS[source]().then((data) => { const v = {data, at: new Date(now()).toISOString(), until: now() + WQ_TTL_MS}; lists.set(source, v); return v; }, (e) => { if (hit) { hit.until = now() + WQ_MISS_MS; return hit; } throw e; }).finally(() => jobs.delete(source)));   // an error or empty/invalid answer is never cached
    return jobs.get(source);
  }
  async function answer(spotId) {
    const st = reviewed(spotId); if (!st) return {ok: true, none: true};
    const ag = WQ_AGENCIES[st.source], base = {ok: true, spotId, source: st.source, agency: ag.agency, agencyUrl: ag.url, station: st.station, km: st.km};
    if (st.source === 'fl-doh-healthy-beaches') return {...base, kind: 'link', link: st.link ?? ag.url};
    if (st.source === 'nj-dep-ccmp') return {...base, ...njAnswer(now()), retrievedAt: new Date(now()).toISOString()};
    if (st.source === 'wa-ecy-beach') return {...base, kind: 'link', link: ag.url};
    const L = await list(st.source), d = L.data;
    const a = st.source === 'hi-doh-cwb' ? hiAnswer(st, d, L.at) : st.source === 'nc-deq-rwq' ? ncAnswer(st, d.s, d.r, L.at) : st.source === 'sc-des-beach' ? scAnswer(st, d.s, d.t, L.at) : st.source === 'ga-dnr-healthy-beaches' ? gaAnswer(st, d) : caAnswer(st, d);
    return a ? {...base, ...a, retrievedAt: L.at} : {...base, kind: 'link', link: ag.url, note: "Not in the agency's current data for this station", retrievedAt: L.at};
  }
  async function respond(url) {
    const spot = url.searchParams.get('spot') ?? '', headers = {'content-type': 'application/json', 'cache-control': 'public, max-age=300'};
    if (!/^[a-z0-9-]{1,80}$/.test(spot)) return new Response(JSON.stringify({ok: false, error: 'spot must be a spot id'}), {status: 400, headers});
    const hit = answers.get(spot); if (hit && now() < hit.until) return new Response(hit.body, {headers});
    try { const body = JSON.stringify(await answer(spot)); answers.set(spot, {body, until: now() + WQ_TTL_MS}); return new Response(body, {headers}); }
    catch (e) { const body = JSON.stringify({ok: false, error: 'The agency did not answer.'}); answers.set(spot, {body, until: now() + WQ_MISS_MS}); return new Response(body, {status: 502, headers}); }
  }
  return {answer, respond};
}
