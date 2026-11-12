// server-captures (docs/forecast/SURF-CAPTURE.md): three keyless evidence captures into R2 (env.BUCKET), dispatched from the existing hourly "47 * * * *" cron by UTC hour. Nothing here is shown in the app.
//   1. Nearshore gauges, every hour: NDBC realtime2 .txt and .spec of 11 stations. Each object holds that station's rows of the PREVIOUS complete UTC hour, byte for byte, with NDBC's two header lines:
//        archive/surf-height/gauges/<station>/<YYYY-MM-DD>/<HH>.txt   and   .../<HH>.spec
//   2. NWS Surf Zone Forecasts, every 6 h (02, 08, 14, 20 UTC): the SRF products of 19 offices, each product id stored once:
//        archive/surf-height/srf/<OFFICE>/<id>.json       the product exactly as api.weather.gov returned it
//        archive/surf-height/srf/_seen.json               ids already stored per office (the de-dup index)
//   3. PacIOOS SWAN (Hawaii), every 3 h per cell: the 104 cells are split over three consecutive hourly invocations (cell i goes in slice i mod 3), so one invocation makes about 35 requests:
//        archive/swan/<YYYY-MM-DD>/swan-<HH>.json.gz      the slice's cells, rows as ERDDAP returned them (from 6 h ago through the whole forecast), gzip (Content-Encoding: gzip): about 380 KB raw a slice
//        archive/swan/<YYYY-MM-DD>/cdip-<id>-<HH>.csv     the CDIP Hawaii buoys 106 and 098 (slice 0 only), as THREDDS returned them (the last 6 h)
// Keyless public data, User-Agent "SWELLO surf forecast prototype", one request per second across the whole invocation. Writes are idempotent (same key, same bytes) and each job has its own subrequest budget.
// The Duck FRF data is private-use only and is NOT captured here (it stays in the local capture).
import {sliceByDay, gzip} from './ndbc-archive.mjs';
import {SWAN_CAPTURE_CELLS} from './swan-capture-cells.mjs';
import {slimProduct, serveKey} from './srf-serve.mjs';

export const UA = 'SWELLO surf forecast prototype';
export const GAUGE_STATIONS = ['LJPC1', '46254', '46266', '46274', '46285', '46268', '46286', '41115', '41121', '51211', '44056'];
export const GAUGE_KINDS = ['txt', 'spec'];
export const SRF_OFFICES = ['BOX', 'BRO', 'CAR', 'CRP', 'EKA', 'GUM', 'HFO', 'JAX', 'LOX', 'MFL', 'MFR', 'MLB', 'MOB', 'MTR', 'PQR', 'SGX', 'SJU', 'TAE', 'TBW'];
export const SRF_HOURS = [2, 8, 14, 20];
export const SWAN_SLICES = 3;
export const CDIP_BUOYS = ['106', '098'];
export const PREFIX = 'archive/surf-height/';
export const SWAN_PREFIX = 'archive/swan/';
export const KEYS = {
  gauge: (id, day, hh, kind) => `${PREFIX}gauges/${id}/${day}/${hh}.${kind}`,
  gaugeStatus: `${PREFIX}_status-gauges.json`,
  srf: (office, id) => `${PREFIX}srf/${office}/${id}.json`,
  srfSeen: `${PREFIX}srf/_seen.json`,
  srfStatus: `${PREFIX}_status-srf.json`,
  swan: (day, hh) => `${SWAN_PREFIX}${day}/swan-${hh}.json.gz`,
  cdip: (day, id, hh) => `${SWAN_PREFIX}${day}/cdip-${id}-${hh}.csv`,
  swanStatus: `${SWAN_PREFIX}_status.json`,
};
/** Subrequests (fetches + R2 operations) each job may use in one invocation. Gauges need 22 GETs + 22 PUTs + 1 status; SWAN about 35 + 1 (+ 4 in slice 0); SRF 19 lists + index read and write + 2 per new product (the first run stores about a week of products). */
export const BUDGETS = {gauges: 48, srf: 200, swan: 80};
export const MAX_PER_OFFICE = 30;     // new products taken from one office in one run, so one office cannot use the whole budget
export const SEEN_CAP = 300;          // ids remembered per office (the NWS list holds about a week: 70 to 100 products)
export const SWAN_BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/';
export const CDIP_BASE = 'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/';
const HOUR = 3600000, MAX_BYTES = 5000000;
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const utcHour = (ms) => new Date(ms).getUTCHours();
const hh2 = (h) => String(h).padStart(2, '0');

/** The rows of one UTC hour of an NDBC realtime2 file (any of .txt, .spec): {header, rows} with the lines as NDBC wrote them; `day` is YYYY-MM-DD. The hour is the fourth column. */
export function rowsForHour(text, day, hour) {
  const {header, days} = sliceByDay(text);
  const rows = (days.get(day) ?? []).filter((l) => Number(l.trim().split(/\s+/)[3]) === hour);
  return {header, rows};
}
export const hourText = (header, rows) => header.join('\n') + (header.length ? '\n' : '') + rows.join('\n') + '\n';
/** The ids of an api.weather.gov product list (newest first as served), keeping id, office and issuance time. */
export function parseSrfList(json) {
  const g = Array.isArray(json?.['@graph']) ? json['@graph'] : [];
  return g.filter((p) => p && typeof p.id === 'string' && /^[\w-]{8,64}$/.test(p.id)).map((p) => ({id: p.id, issuanceTime: typeof p.issuanceTime === 'string' ? p.issuanceTime : null, office: p.issuingOffice ?? null}));
}
/** The new products of a list: ids not in `seen`, newest first, at most `max`. */
export const newProducts = (list, seen, max = MAX_PER_OFFICE) => { const have = new Set(seen); const out = []; for (const p of list) { if (!have.has(p.id) && !out.some((o) => o.id === p.id)) out.push(p); } return out.sort((a, b) => String(b.issuanceTime).localeCompare(String(a.issuanceTime))).slice(0, max); };
/** Which jobs run at this scheduled time, and which SWAN slice. */
export function plan(ms) { const h = utcHour(ms); return {hour: h, gauges: true, srf: SRF_HOURS.includes(h), swanSlice: h % SWAN_SLICES}; }
/** The cells of one SWAN slice (cell i of the sorted list is in slice i mod 3). */
export const swanSliceCells = (slice, cells = SWAN_CAPTURE_CELLS) => cells.filter((_, i) => i % SWAN_SLICES === slice);

export function createSurfCapture({fetcher = fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), politeMs = 1000, timeoutMs = 30000, budgets = BUDGETS, stations = GAUGE_STATIONS, offices = SRF_OFFICES, cells = SWAN_CAPTURE_CELLS} = {}) {
  let lastFetch = 0;
  /** One polite GET: at least politeMs after the previous one in this invocation; one retry on a network error or 5xx. Returns {status: 'ok'|'404'|'http N'|'error: ...'|'budget', text?}. */
  async function get(url, spend, headers = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!spend()) return {status: 'budget'};
      const wait = politeMs - (now() - lastFetch); if (wait > 0 && lastFetch) await sleep(wait); lastFetch = now();
      try {
        const r = await fetcher(url, {headers: {'User-Agent': UA, ...headers}, signal: AbortSignal.timeout(timeoutMs)});
        if (r.status === 404) return {status: '404'};
        if (!r.ok) { if (attempt === 1 || r.status < 500) return {status: 'http ' + r.status}; continue; }
        const text = await r.text(); if (text.length > MAX_BYTES) return {status: 'too large'};
        return {status: 'ok', text};
      } catch (e) { if (attempt === 1) return {status: 'error: ' + String(e?.message ?? e).slice(0, 80)}; }
    }
    return {status: 'error'};
  }
  // `reserve` operations are kept back for the closing writes (index, status), so a run that hits its budget still records what it did
  const counter = (limit, reserve = 0) => { const c = {used: 0, limit}; c.spend = () => (c.used < c.limit - reserve ? (c.used++, true) : false); c.final = () => (c.used < c.limit ? (c.used++, true) : false); return c; };
  const put = async (bucket, c, key, body, meta, closing = false) => { if (!(closing ? c.final() : c.spend())) return false; try { await bucket.put(key, body, meta); return true; } catch { return false; } };

  /** Job 1: the previous complete UTC hour of each station's .txt and .spec. */
  async function gauges(env, ms = now()) {
    const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
    const target = ms - ms % HOUR - HOUR, day = utcDay(target), hour = utcHour(target), c = counter(budgets.gauges, 1), report = {};
    let written = 0, failures = 0;
    for (const id of stations) {
      report[id] = {};
      for (const kind of GAUGE_KINDS) {
        const got = await get(`https://www.ndbc.noaa.gov/data/realtime2/${id}.${kind}`, c.spend);
        let e = {status: got.status, rows: 0};
        if (got.status === 'ok') {
          const {header, rows} = rowsForHour(got.text, day, hour);
          if (!rows.length) e = {status: 'no rows for the hour', rows: 0};
          else if (await put(bucket, c, KEYS.gauge(id, day, hh2(hour), kind), hourText(header, rows), {httpMetadata: {contentType: 'text/plain'}, customMetadata: {rows: String(rows.length), first: rows[rows.length - 1].trim().split(/\s+/).slice(0, 5).join(' '), last: rows[0].trim().split(/\s+/).slice(0, 5).join(' ')}})) { e = {status: 'ok', rows: rows.length}; written++; }
          else e = {status: 'put failed', rows: rows.length};
        }
        if (e.status !== 'ok') failures++;
        report[id][kind] = e;
      }
    }
    const status = {schema: 1, updatedAt: new Date(now()).toISOString(), hour: `${day}T${hh2(hour)}`, written, failures, used: c.used, stations: report};
    await put(bucket, c, KEYS.gaugeStatus, JSON.stringify(status), {httpMetadata: {contentType: 'application/json'}}, true);
    return {ok: true, job: 'gauges', hour: status.hour, written, failures, used: c.used};
  }

  /** Job 2: each office's new SRF products. The index of stored ids is read first (a failed read aborts the run: a missing key is a fresh start, a failed read is never taken for one). */
  async function srf(env, ms = now()) {
    const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
    const c = counter(budgets.srf, 2), headers = {Accept: 'application/geo+json'};
    let index;
    if (!c.spend()) return {ok: false, job: 'srf', reason: 'budget'};
    try { const o = await bucket.get(KEYS.srfSeen); index = o ? await o.json() : null; } catch (e) { return {ok: false, job: 'srf', reason: `R2 read of the index failed: ${String(e?.message ?? e).slice(0, 80)}`}; }
    index = {schema: 1, runs: 0, offices: {}, ...(index ?? {})}; index.offices ??= {};
    const rot = (index.runs ?? 0) % offices.length, order = [...offices.slice(rot), ...offices.slice(0, rot)], report = {}; let stored = 0, failures = 0;
    for (const office of order) {
      const rep = report[office] = {listed: 0, new: 0, stored: 0}, seen = index.offices[office]?.ids ?? [];
      const list = await get(`https://api.weather.gov/products/types/SRF/locations/${office}`, c.spend, headers);
      if (list.status !== 'ok') { rep.status = list.status; failures++; if (list.status === 'budget') break; continue; }
      let json; try { json = JSON.parse(list.text); } catch { rep.status = 'bad json'; failures++; continue; }
      const all = parseSrfList(json), fresh = newProducts(all, seen);
      rep.listed = all.length; rep.new = newProducts(all, seen, Infinity).length;
      const ids = [...seen]; let newest = null;
      for (const p of fresh) {
        const got = await get(`https://api.weather.gov/products/${p.id}`, c.spend, headers);
        if (got.status !== 'ok') { failures++; rep.status = got.status; if (got.status === 'budget') break; continue; }
        let prod; try { prod = JSON.parse(got.text); } catch { failures++; rep.status = 'bad product json'; continue; }
        if (prod?.id !== p.id || typeof prod?.productText !== 'string') { failures++; rep.status = 'unexpected product'; continue; }
        if (await put(bucket, c, KEYS.srf(office, p.id), got.text, {httpMetadata: {contentType: 'application/json'}, customMetadata: {office, issuanceTime: p.issuanceTime ?? ''}})) { ids.push(p.id); rep.stored++; stored++; if (!newest || String(p.issuanceTime) > String(newest.issuanceTime)) newest = {issuanceTime: p.issuanceTime, prod}; } else { failures++; rep.status = 'put failed'; }
      }
      // The served product only ever moves FORWARD: a backlog drained after a newer product was served (MAX_PER_OFFICE per run, newest first, so later runs hold OLDER products) must never overwrite it. The index remembers what was served.
      const servedAt = Date.parse(index.offices[office]?.served?.issuedAt ?? ''); let served = index.offices[office]?.served ?? null;
      if (newest) { const slim = slimProduct(newest.prod, office); if (!slim) rep.served = 'unparsed'; else if (Number.isFinite(servedAt) && Date.parse(slim.issuedAt) <= servedAt) rep.served = 'kept newer'; else if (await put(bucket, c, serveKey(office), JSON.stringify(slim), {httpMetadata: {contentType: 'application/json'}})) { rep.served = slim.id; served = {id: slim.id, issuedAt: slim.issuedAt}; } else { failures++; rep.status = 'serve put failed'; } }
      index.offices[office] = {ids: ids.slice(-SEEN_CAP), updatedAt: new Date(now()).toISOString(), ...(served ? {served} : {})};
      if (c.used >= c.limit) break;
    }
    index.runs = (index.runs ?? 0) + 1; index.updatedAt = new Date(now()).toISOString();
    await put(bucket, c, KEYS.srfSeen, JSON.stringify(index), {httpMetadata: {contentType: 'application/json'}}, true);
    await put(bucket, c, KEYS.srfStatus, JSON.stringify({schema: 1, updatedAt: index.updatedAt, stored, failures, used: c.used, offices: report}), {httpMetadata: {contentType: 'application/json'}}, true);
    return {ok: true, job: 'srf', stored, failures, used: c.used};
  }

  /** Job 3: this invocation's slice of the SWAN cells (+ the two CDIP buoys in slice 0). */
  async function swan(env, ms = now(), slice = utcHour(ms) % SWAN_SLICES) {
    const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
    const c = counter(budgets.swan, 1), t = now(), day = utcDay(ms), hh = hh2(utcHour(ms)), from = new Date(t - 6 * HOUR).toISOString().replace(/\.\d+Z$/, 'Z');
    const mine = swanSliceCells(slice, cells), out = {capturedAt: new Date(t).toISOString(), source: SWAN_BASE, userAgent: UA, from, slice: {index: slice, of: SWAN_SLICES}, cells: {}, spots: {}};
    let ok = 0, fail = 0;
    for (const cell of mine) {
      const sel = (v) => `${v}%5B(${from}):1:(last)%5D%5B(0)%5D%5B(${cell.lat})%5D%5B(${cell.lon})%5D`;
      const got = await get(`${SWAN_BASE}${cell.dataset}_lon180.json?${sel('shgt')},${sel('pper')},${sel('pdir')}`, c.spend);
      let j = null; if (got.status === 'ok') { try { j = JSON.parse(got.text); } catch { /* counted as failed */ } }
      if (j?.table) { out.cells[cell.key] = {columnNames: j.table.columnNames, rows: j.table.rows}; for (const s of cell.spots) out.spots[s] = cell.key; ok++; } else fail++;
    }
    let body = null; try { body = await gzip(JSON.stringify(out)); } catch { /* recorded as not written */ }
    const wrote = body !== null && await put(bucket, c, KEYS.swan(day, hh), body, {httpMetadata: {contentType: 'application/json', contentEncoding: 'gzip'}, customMetadata: {cells: String(ok), failed: String(fail), slice: String(slice)}});
    let buoys = 0;
    if (slice === 0) for (const id of CDIP_BUOYS) {
      const q = new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: new Date(t - 6 * HOUR).toISOString(), time_end: new Date(t + HOUR).toISOString(), accept: 'csv'});
      const got = await get(`${CDIP_BASE}${id}p1_rt.nc?${q}`, c.spend);
      if (got.status === 'ok' && await put(bucket, c, KEYS.cdip(day, id, hh), got.text, {httpMetadata: {contentType: 'text/csv'}})) buoys++;
    }
    await put(bucket, c, KEYS.swanStatus, JSON.stringify({schema: 1, updatedAt: new Date(now()).toISOString(), slice, cells: ok, failed: fail, buoys, wrote, used: c.used}), {httpMetadata: {contentType: 'application/json'}}, true);
    return {ok: true, job: 'swan', slice, cells: ok, failed: fail, buoys, wrote, used: c.used};
  }

  /** What the hourly cron does: gauges every hour, SRF at 02/08/14/20 UTC, one SWAN slice every hour. A job that throws does not stop the next; nothing here can fail the NDBC archive that runs after it. */
  async function run(env, scheduledMs = now()) {
    const p = plan(scheduledMs), results = [];
    for (const [name, on, fn] of [['gauges', p.gauges, () => gauges(env, scheduledMs)], ['srf', p.srf, () => srf(env, scheduledMs)], ['swan', true, () => swan(env, scheduledMs, p.swanSlice)]]) {
      if (!on) continue;
      try { results.push(await fn()); } catch (e) { results.push({ok: false, job: name, reason: String(e?.message ?? e).slice(0, 120)}); }
    }
    return {hour: p.hour, results};
  }
  return {gauges, srf, swan, run};
}
