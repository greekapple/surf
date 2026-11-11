// NDBC realtime2 archive (round 4A, docs/specs/DRAFT-spec-archive.md): NDBC deletes its realtime2 files after 45 days, so once a day this job keeps each buoy's
// `.spec` (the published swell / wind-sea split) and `.data_spec` (the spectrum and NDBC's Sep_Freq) as one gzip object per buoy per UTC day.
//   archive/ndbc/spec/<id>/<YYYY>/<YYYY-MM-DD>.spec.gz
//   archive/ndbc/data_spec/<id>/<YYYY>/<YYYY-MM-DD>.data_spec.gz
//   archive/ndbc/_manifest/<YYYY-MM-DD>.json   runs of that UTC day (what was kept, per buoy and file; failures)
//   archive/ndbc/_cursor.json                  backfill cursor + the last header seen per file kind
// Rows are NDBC's lines byte for byte (header lines kept). A day slice is the lines whose `YY MM DD` columns match. Writes are idempotent: a rerun overwrites the same key with the same bytes.
// Its own invocation and its own subrequest budget (worker/cloudflare.mjs: a separate cron trigger, never the 5-minute refresh).

/** The buoys archived (83): the NDBC-hosted union of the split audit, the HI/East audit (minus 46656) and the app's context buoys. A test keeps every NDBC context buoy in it. */
export const ARCHIVE_BUOYS = [
  '46012', '46026', '46214', '46221', '46235', '46236', '46237', '46254', '46275',
  '51201', '51202', '51207', '51210', '51211', '51212',
  '41024', '41025', '41029', '41033', '41038', '41065', '41066', '41067', '41068', '41069', '41070', '41076', '41108', '41110', '41112', '41113', '41114', '41117', '41120', '41122', '41159',
  // US West batch 2 (2026-11-10): the 10 Oregon, Washington and Sitka buoys (each has a realtime2 .spec)
  '46084', '46087', '46088', '46267', '46211', '46243', '46278', '46050', '46229', '46015',
  // US West round 4 (2026-11-10): the 19 California context / scoring buoys added with the west-ca batch (each has a realtime2 .spec)
  '46014', '46025', '46028', '46042', '46053', '46215', '46218', '46222', '46232', '46244', '46253', '46256', '46266', '46268', '46274', '46277', '46285', '46286', 'LJPC1',
  '44013', '44022', '44025', '44029', '44056', '44064', '44065', '44069', '44085', '44086', '44087', '44090', '44091', '44095', '44097', '44098', '44099', '44100',
];
export const KINDS = ['spec', 'data_spec'];
export const ARCHIVE_PREFIX = 'archive/ndbc/';
export const ARCHIVE_KEYS = {
  file: (kind, id, day) => `${ARCHIVE_PREFIX}${kind}/${id}/${day.slice(0, 4)}/${day}.${kind}.gz`,
  manifest: (day) => `${ARCHIVE_PREFIX}_manifest/${day}.json`,
  cursor: `${ARCHIVE_PREFIX}_cursor.json`,
  status: `${ARCHIVE_PREFIX}_status.json`,
};
export const ndbcFileURL = (id, kind) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.${kind}`;
/** Subrequests (fetches + R2 operations) one invocation may use; the same convention as the refresh (the Paid plan allows 1,000). */
export const ARCHIVE_BUDGET = 800;
export const DAILY_DAYS = 3;       // the previous 3 complete UTC days: covers 2 missed runs
export const BACKFILL_DAYS = 45;   // what NDBC still holds
const DAY = 86400000, MAX_BYTES = 5000000;
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Split a realtime2 text file into header lines and per-UTC-day data lines (lines kept as they are). Day = the first three columns (YY MM DD; a 2-digit year is read as 20YY). */
export function sliceByDay(text) {
  const header = [], days = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) { header.push(line); continue; }
    const m = /^(\d{2,4})\s+(\d{1,2})\s+(\d{1,2})\s/.exec(line);
    if (!m) continue;
    const y = m[1].length === 2 ? '20' + m[1] : m[1], day = `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(line);
  }
  return {header, days};
}
/** The text of one day object: the header lines, then that day's lines, newline-terminated. */
export const dayText = (header, rows) => header.join('\n') + (header.length ? '\n' : '') + rows.join('\n') + '\n';

export async function gzip(text) {
  const cs = new CompressionStream('gzip'), w = cs.writable.getWriter();
  w.write(new TextEncoder().encode(text)); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
export async function gunzip(bytes) {
  const ds = new DecompressionStream('gzip'), w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Response(ds.readable).text();
}
/** The UTC days one pass keeps: backfill = every day NDBC still holds (before today), daily = the last DAILY_DAYS complete days. Today is left out (partial); the next run takes it whole. */
export const wantedDays = (days, nowMs, mode) => { const today = utcDay(nowMs), keep = mode === 'backfill' ? BACKFILL_DAYS + 1 : DAILY_DAYS; const lo = utcDay(nowMs - keep * DAY); return [...days].filter((d) => d < today && d >= lo).sort(); };

const hasher = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); };

export const RETRY_MAX_ATTEMPTS = 12;       // a buoy that still fails after this many backfill tries is reported as abandoned instead of blocking `done` forever
export const RUN_DEADLINE_MS = 600000;      // a run stops starting new buoys after this long, and still writes manifest, cursor and status
/** Terminal outcomes: the file is not there (404) or has no rows. Everything else is worth another try while the 45-day window still holds the days. */
const TERMINAL = new Set(['ok', '404', 'empty']);
/** The first day of an NDBC file starts wherever the 45-day window starts (or after a reset), so it is probably partial: the earliest row is later than this. */
const PARTIAL_AFTER_MIN = 90;
const minuteOf = (line) => { const c = line.trim().split(/\s+/); return (+c[3]) * 60 + (+c[4]); };

class R2ReadError extends Error {}

export function createNdbcArchive({fetcher = fetch, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), politeMs = 1000, timeoutMs = 30000, buoys = ARCHIVE_BUOYS, budget = ARCHIVE_BUDGET, deadlineMs = RUN_DEADLINE_MS} = {}) {
  /**
   * One invocation. opts.backfillOnly: an extra tick that only continues an unfinished backfill (a no-op, one R2 read, when it is done).
   * Returns a short report: {mode, used, buoys, failures, backfill, lastArchiveDay}.
   * An R2 READ that throws aborts the run before any write ({ok: false}): a missing key is not an error, a failed read is never taken for "no cursor".
   */
  async function run(env, opts = {}) {
    const bucket = env?.BUCKET; if (!bucket) return {ok: false, reason: 'no bucket'};
    const t0 = now(), today = utcDay(t0), run = {used: 0, limit: budget};
    const spend = () => (run.used < run.limit ? (run.used++, true) : false);
    const getJSON = async (key) => { run.used++; try { const o = await bucket.get(key); return o ? await o.json() : null; } catch (e) { throw new R2ReadError(`R2 read of ${key} failed: ${String(e?.message ?? e).slice(0, 80)}`); } };
    let cursor;
    try { cursor = await getJSON(ARCHIVE_KEYS.cursor); } catch (e) { return {ok: false, reason: e.message}; }
    if (!cursor) cursor = {schema: 1, createdAt: new Date(t0).toISOString(), backfill: {done: false, next: 0, retry: [], abandoned: [], startedAt: new Date(t0).toISOString()}, headers: {}, lastDay: null};
    cursor.headers ??= {}; cursor.backfill ??= {done: true, next: buoys.length}; cursor.backfill.retry ??= []; cursor.backfill.abandoned ??= [];
    const bf = cursor.backfill, backfilling = !bf.done;
    if (!backfilling && opts.backfillOnly) return {ok: true, mode: 'noop', used: run.used, backfill: 'done'};
    const mode = backfilling ? 'backfill' : 'daily';
    const entries = [], failures = [];
    let firstGet = true, stoppedBy = null;
    const fetchText = async (url) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!spend()) return {status: 'budget'};
        if (!firstGet) await sleep(politeMs); firstGet = false;
        try {
          const r = await fetcher(url, {headers: {'User-Agent': 'SWELLO-archive (NDBC realtime2 daily archive)'}, signal: AbortSignal.timeout(timeoutMs)});
          if (r.status === 404) return {status: '404'};
          if (!r.ok) { if (attempt === 2) return {status: 'http ' + r.status}; continue; }
          const text = await r.text();
          if (text.length > MAX_BYTES) return {status: 'too large'};
          return {status: 'ok', text};
        } catch (e) { if (attempt === 2) return {status: 'error: ' + String(e?.message ?? e).slice(0, 80)}; }
      }
      return {status: 'error'};
    };
    /** One buoy: both files. Returns true when every file ended terminally (ok, 404, empty). */
    async function doBuoy(id) {
      let terminal = true;
      for (const kind of KINDS) {
        const got = await fetchText(ndbcFileURL(id, kind));
        const e = {buoy: id, kind, status: got.status, days: 0, rows: 0, first: null, last: null, bytes: 0};
        if (got.status === 'ok') {
          const {header, days} = sliceByDay(got.text), hdr = hasher(header.join('\n'));
          if (!days.size) e.status = 'empty';
          else {
            if (cursor.headers[kind] && cursor.headers[kind] !== hdr) e.headerChanged = true;
            cursor.headers[kind] = hdr;
            const fileDays = [...days.keys()].sort(), firstFileDay = fileDays[0];
            const partialFirst = Math.min(...days.get(firstFileDay).map(minuteOf)) > PARTIAL_AFTER_MIN;
            const wanted = wantedDays(days.keys(), t0, mode);
            let putFail = 0; const skipped = [];
            for (const day of wanted) {
              const rows = days.get(day), isPartial = day === firstFileDay && partialFirst;
              if (isPartial) { (e.partialDays ??= []).push(day); }
              // a partial day (the oldest of the file, or a reset file) never replaces a copy with more rows
              if (isPartial && typeof bucket.head === 'function') {
                if (!spend()) { e.status = 'budget'; break; }
                try { const h = await bucket.head(ARCHIVE_KEYS.file(kind, id, day)); const had = Number(h?.customMetadata?.rows); if (Number.isFinite(had) && had > rows.length) { skipped.push(day); continue; } } catch { /* unknown: write */ }
              }
              if (!spend()) { e.status = 'budget'; break; }
              try {
                const body = await gzip(dayText(header, rows));
                await bucket.put(ARCHIVE_KEYS.file(kind, id, day), body, {httpMetadata: {contentType: 'text/plain', contentEncoding: 'gzip'}, customMetadata: {rows: String(rows.length), first: rows[rows.length - 1].trim().split(/\s+/).slice(0, 5).join(' '), last: rows[0].trim().split(/\s+/).slice(0, 5).join(' '), partial: String(isPartial)}});
                e.days++; e.rows += rows.length; e.bytes += body.length; e.first ??= day; e.last = day;
              } catch { putFail++; }
            }
            if (skipped.length) e.keptLarger = skipped;
            if (putFail) { e.status = 'put failed'; e.putFailed = putFail; }
            // days we expected between the oldest wanted day and yesterday but the file does not have (an NDBC outage): recorded, not an error
            if (e.status === 'ok' && wanted.length) { const miss = []; for (let d = Date.parse(wanted[0]); utcDay(d) < today; d += DAY) if (!days.has(utcDay(d))) miss.push(utcDay(d)); if (miss.length) e.missingDays = miss; }
            // every swell field MM (41065 style): the archive keeps the file, the manifest says it holds no swell values
            if (kind === 'spec' && [...days.values()].flat().every((l) => { const c = l.trim().split(/\s+/); return [c[6], c[7], c[8], c[9]].every((v) => v === 'MM' || v === undefined); })) e.note = 'no swell values (all MM)';
          }
        }
        if (e.status !== 'ok') failures.push({buoy: id, kind, status: e.status});
        if (!TERMINAL.has(e.status)) terminal = false;
        entries.push(e);
      }
      return terminal;
    }
    const perBuoy = 2 + KINDS.length * ((mode === 'backfill' ? BACKFILL_DAYS : DAILY_DAYS) + 2);   // GETs, one put per day and file, one head for the possibly partial first day
    const reserve = 6;   // manifest (read + write), cursor, status
    const room = () => { if (now() - t0 > deadlineMs) { stoppedBy = 'deadline'; return false; } if (run.used + perBuoy + reserve > run.limit) { stoppedBy = 'budget'; return false; } return true; };
    const start = backfilling ? Math.min(bf.next ?? 0, buoys.length) : 0;
    let i = start; const failedNow = new Set();
    for (; i < buoys.length; i++) {
      if (!room()) break;
      const ok = await doBuoy(buoys[i]);
      // the cursor moves on, but a buoy that did not end terminally is remembered: the backfill is not done until it succeeds
      if (backfilling && !ok) failedNow.add(buoys[i]);
      if (backfilling && !ok && !bf.retry.some((r) => r.buoy === buoys[i])) bf.retry.push({buoy: buoys[i], attempts: 1, last: entries.filter((e) => e.buoy === buoys[i] && !TERMINAL.has(e.status)).map((e) => `${e.kind}: ${e.status}`).join('; ')});
    }
    const mainDone = i >= buoys.length; if (backfilling) bf.next = i;
    // retries: once the main pass is over, each tick tries the buoys that failed; success removes them, repeated failure eventually abandons them (reported, never silently)
    if (backfilling && mainDone) {
      for (const r of [...bf.retry]) {
        if (failedNow.has(r.buoy)) continue;   // it just failed in this invocation: the next tick tries it again
        if (!room()) break;
        const ok = await doBuoy(r.buoy);
        if (ok) bf.retry = bf.retry.filter((x) => x.buoy !== r.buoy);
        else { r.attempts++; r.last = entries.filter((e) => e.buoy === r.buoy && !TERMINAL.has(e.status)).map((e) => `${e.kind}: ${e.status}`).join('; '); if (r.attempts > RETRY_MAX_ATTEMPTS) { bf.abandoned.push({...r, abandonedAt: new Date(now()).toISOString()}); bf.retry = bf.retry.filter((x) => x.buoy !== r.buoy); } }
      }
      if (!bf.retry.length) { bf.done = true; bf.finishedAt = new Date(now()).toISOString(); }
    }
    if (mode === 'daily' && mainDone) cursor.lastDay = utcDay(t0 - DAY);
    if (mode === 'backfill' && mainDone) cursor.lastDay = utcDay(t0 - DAY);
    cursor.lastRunDay = today; cursor.updatedAt = new Date(now()).toISOString();
    const report = {startedAt: new Date(t0).toISOString(), finishedAt: new Date(now()).toISOString(), mode, buoysFrom: start, buoysTo: i, of: buoys.length, stoppedBy, notReached: mode === 'daily' ? buoys.length - i : 0, retry: bf.retry.map((r) => r.buoy), used: 0, limit: run.limit, failures: failures.length, entries};
    // manifest (accumulates the runs of the UTC day), cursor, status. A manifest READ that throws is not taken for "no manifest": this run goes to its own object instead.
    let manifest = null, manifestKey = ARCHIVE_KEYS.manifest(today);
    try { manifest = await getJSON(manifestKey); } catch { manifestKey = `${ARCHIVE_PREFIX}_manifest/${today}.run-${new Date(t0).toISOString().slice(11, 19).replace(/:/g, '')}.json`; }
    const used = run.used + 3;
    manifest = {schema: 1, date: today, runs: [...(manifest?.runs ?? []), {...report, used}]};
    await bucket.put(manifestKey, JSON.stringify(manifest), {httpMetadata: {contentType: 'application/json'}});
    await bucket.put(ARCHIVE_KEYS.cursor, JSON.stringify(cursor), {httpMetadata: {contentType: 'application/json'}});
    await bucket.put(ARCHIVE_KEYS.status, JSON.stringify({schema: 1, updatedAt: cursor.updatedAt, mode, lastArchiveDay: cursor.lastDay, backfill: bf, buoysFrom: start, buoysTo: i, of: buoys.length, stoppedBy, failures}), {httpMetadata: {contentType: 'application/json'}});
    return {ok: true, mode, used, buoys: i - start, of: buoys.length, backfill: bf.done ? 'done' : bf.next < buoys.length ? `next ${bf.next}/${buoys.length}` : `retrying ${bf.retry.map((r) => r.buoy).join(',')}`, stoppedBy, failures: failures.length, lastArchiveDay: cursor.lastDay};
  }
  return {run};
}
