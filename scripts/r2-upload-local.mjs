// Push the locally collected data (the NDBC realtime2 archive and the "how right" captures) into the production R2 bucket, so the 45-day backfill and the first captures survive the deploy.
//   node scripts/r2-upload-local.mjs [--dir /Users/milosin/Development/swello-data/r2] [--dry-run | --upload] [--via s3|wrangler] [--limit N] [--concurrency 6]
// - Only these prefixes are ever read or written: archive/ndbc/ and howright/v2/ (nothing else in the directory, nothing under forecast/). The bucket is fixed: swello-forecast-cache.
// - Default (no flag) and --dry-run: LIST what would upload (and what already exists in the bucket, via a head) without writing anything. Uploading needs the explicit --upload.
// - A key that already exists in the bucket is SKIPPED (head first): the script never overwrites what the Worker (or an earlier run) wrote. Transient `_score-partial.json` is not uploaded.
// - Order: the day objects first, then manifests and the scorecard, and `_status.json` / `_cursor.json` LAST, so an interrupted run never leaves a cursor that claims files the bucket does not have.
// - --via s3 (default): R2's S3-compatible API with SigV4 (node crypto, no dependency). Keeps what the Worker writes: content type, `Content-Encoding: gzip` and the customMetadata {rows, first, last, partial} of the archive's day
//   objects (rebuilt from the gzip contents: the local copies carry none). Credentials come from the ENVIRONMENT only and are never printed or stored: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (an R2 API token with
//   object read & write on this bucket; Cloudflare dashboard > R2 > Manage API tokens).
// - --via wrangler: `wrangler r2 object put/get --remote` (the logged-in wrangler). It cannot set customMetadata (no flag) and has no head (it downloads to test existence): content type and encoding are kept, rows/first/last/partial are not.
//   The loss is small (that metadata only lets the Worker's daily run keep a fuller copy of an archive file's FIRST day) but it is a loss; prefer s3.
// Run it BEFORE the first archive cron fires after the deploy (the archive's cron triggers are 17 6 and 47 * UTC), so the uploaded cursor says the backfill is done.
import {createHash, createHmac} from 'node:crypto';
import {readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join, relative, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

export const BUCKET = 'swello-forecast-cache';
export const PREFIXES = ['archive/ndbc/', 'howright/v2/'];
export const SKIP_KEYS = new Set(['howright/v2/_score-partial.json']);

/** Every uploadable key under `dir`, in upload order (day objects, then manifests / scorecard, then status and cursor last). Refuses anything outside PREFIXES. */
export function listKeys(dir) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p).split(sep).join('/')); } };
  if (existsSync(dir)) walk(dir);
  const keys = out.filter((k) => PREFIXES.some((p) => k.startsWith(p)) && !SKIP_KEYS.has(k) && !k.endsWith('.DS_Store'));
  const rank = (k) => (/\/_cursor\.json$/.test(k) ? 4 : /\/_status\.json$/.test(k) ? 3 : /\/_manifest\/|scorecard\.json$/.test(k) ? 2 : 1);
  return keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
export const contentTypeOf = (k) => (k.endsWith('.gz') ? 'text/plain' : k.endsWith('.json') ? 'application/json' : 'application/octet-stream');
const minuteOf = (line) => { const c = line.trim().split(/\s+/); return (+c[3]) * 60 + (+c[4]); };
/** The customMetadata the Worker writes for an archive day object ({rows, first, last, partial}), rebuilt from the gzip contents. null for anything else. */
export function archiveMetadata(key, body) {
  if (!/^archive\/ndbc\/(spec|data_spec)\/.+\.gz$/.test(key)) return null;
  const rows = gunzipSync(body).toString('utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  if (!rows.length) return null;
  const stamp = (l) => l.trim().split(/\s+/).slice(0, 5).join(' ');
  // NDBC files are newest first: the first row of the object is the latest of the day
  const sorted = [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b)));
  return {rows: String(rows.length), first: stamp(sorted[0]), last: stamp(sorted[sorted.length - 1]), partial: String(Math.min(...rows.map(minuteOf)) > 90)};
}

/* ---------- AWS Signature V4 (R2's S3 API: region "auto", service "s3") ---------- */
const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
/** Returns the headers to send (including Authorization). `headers` are the request headers to sign besides host / x-amz-date / x-amz-content-sha256. */
export function signV4({method, host, path, query = '', headers = {}, body = '', accessKeyId, secretAccessKey, region = 'auto', service = 's3', date = new Date(), payloadHash}) {
  const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = amz.slice(0, 8), ph = payloadHash ?? sha256(body);
  const h = {...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host, 'x-amz-content-sha256': ph, 'x-amz-date': amz};
  const names = Object.keys(h).sort(), signedHeaders = names.join(';');
  const canonical = [method, path.split('/').map(enc).join('/'), query, names.map((n) => `${n}:${h[n]}\n`).join(''), signedHeaders, ph].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`, toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac('AWS4' + secretAccessKey, day), region), service), 'aws4_request'), signature = createHmac('sha256', key).update(toSign).digest('hex');
  return {...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, _signature: signature};
}

/** The S3 transport: head (exists?) and put (with metadata). `fetcher` is injectable for tests. */
export function s3Transport({accountId, accessKeyId, secretAccessKey, fetcher = fetch, now = () => new Date()}) {
  const host = `${accountId}.r2.cloudflarestorage.com`, path = (k) => `/${BUCKET}/${k}`;
  const send = async (method, k, headers = {}, body = '') => {
    const s = signV4({method, host, path: path(k), headers, body, accessKeyId, secretAccessKey, date: now()}), {_signature, host: _h, ...rest} = s;
    return fetcher(`https://${host}${path(k).split('/').map(enc).join('/')}`, {method, headers: rest, body: method === 'PUT' ? body : undefined});
  };
  return {
    head: async (k) => { const r = await send('HEAD', k); if (r.status === 404) return false; if (r.ok) return true; throw new Error(`HEAD ${k}: HTTP ${r.status}`); },
    put: async (k, body, {contentType, contentEncoding, metadata}) => {
      const headers = {'content-type': contentType, ...(contentEncoding ? {'content-encoding': contentEncoding} : {}), ...Object.fromEntries(Object.entries(metadata ?? {}).map(([m, v]) => [`x-amz-meta-${m}`, v]))};
      const r = await send('PUT', k, headers, body); if (!r.ok) throw new Error(`PUT ${k}: HTTP ${r.status}`);
    },
  };
}
/** The wrangler transport: no head (get to a temp file) and no customMetadata. */
export function wranglerTransport({run = (args) => spawnSync('npx', ['--no-install', 'wrangler', ...args], {encoding: 'utf8'})} = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'r2up-'));
  return {
    head: async (k) => { const f = join(tmp, 'probe'); const r = run(['r2', 'object', 'get', `${BUCKET}/${k}`, '--remote', '--file', f]); if (r.status === 0) return true; if (/does not exist|not found|404|NoSuchKey/i.test(`${r.stdout}${r.stderr}`)) return false; throw new Error(`wrangler get ${k}: ${(r.stderr || r.stdout).slice(0, 200)}`); },
    put: async (k, body, {contentType, contentEncoding}) => { const f = join(tmp, 'up'); writeFileSync(f, body); const r = run(['r2', 'object', 'put', `${BUCKET}/${k}`, '--remote', '--file', f, '--content-type', contentType, ...(contentEncoding ? ['--content-encoding', contentEncoding] : [])]); if (r.status !== 0) throw new Error(`wrangler put ${k}: ${(r.stderr || r.stdout).slice(0, 200)}`); },
    done: () => rmSync(tmp, {recursive: true, force: true}),
  };
}

/** The whole job: list, head, (upload). Returns {total, exists, toUpload, uploaded, failed, bytes}. In dry-run nothing is written. */
export async function runUpload({dir, transport, upload = false, limit = Infinity, concurrency = 6, log = () => {}}) {
  const keys = listKeys(dir).slice(0, limit), r = {total: keys.length, exists: 0, toUpload: 0, uploaded: 0, failed: [], bytes: 0, planned: []};
  // ordered phases: a later phase starts only when the earlier one finished (cursor and status last)
  const phases = [1, 2, 3, 4].map((n) => keys.filter((k) => (/\/_cursor\.json$/.test(k) ? 4 : /\/_status\.json$/.test(k) ? 3 : /\/_manifest\/|scorecard\.json$/.test(k) ? 2 : 1) === n));
  for (const phase of phases) {
    let i = 0;
    const worker = async () => {
      for (;;) {
        const k = phase[i++]; if (k === undefined) return;
        try {
          if (transport?.head && await transport.head(k)) { r.exists++; continue; }
          r.toUpload++; r.planned.push(k);
          if (!upload) continue;
          const body = readFileSync(join(dir, k)), meta = archiveMetadata(k, body);
          await transport.put(k, body, {contentType: contentTypeOf(k), contentEncoding: k.endsWith('.gz') ? 'gzip' : undefined, metadata: meta ?? undefined});
          r.uploaded++; r.bytes += body.length;
        } catch (e) { r.failed.push(`${k}: ${String(e.message).slice(0, 160)}`); }
      }
    };
    await Promise.all(Array.from({length: Math.min(concurrency, Math.max(1, phase.length))}, worker));
    if (r.failed.length) { log(`stopping after phase with ${r.failed.length} failure(s): later phases (status, cursor) are NOT uploaded`); break; }
  }
  return r;
}

if (process.argv[1]?.endsWith('r2-upload-local.mjs')) {
  const a = process.argv.slice(2), opt = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const dir = opt('--dir', '/Users/milosin/Development/swello-data/r2'), via = opt('--via', 'wrangler-if-no-env'), upload = a.includes('--upload') && !a.includes('--dry-run'), limit = Number(opt('--limit', Infinity)), concurrency = Number(opt('--concurrency', 6));
  const e = process.env, haveS3 = !!(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY);
  const mode = via === 's3' || (via === 'wrangler-if-no-env' && haveS3) ? 's3' : 'wrangler';
  if (mode === 's3' && !haveS3) { console.error('--via s3 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in the environment (never pass them on the command line).'); process.exit(2); }
  const planOnly = !upload && via === 'wrangler-if-no-env' && !haveS3;   // a dry run without credentials lists the LOCAL plan only (a head per key through wrangler would be 3,000 spawns)
  const transport = planOnly ? null : mode === 's3' ? s3Transport({accountId: e.R2_ACCOUNT_ID, accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY}) : wranglerTransport();
  const keys = listKeys(dir); console.log(`${keys.length} local keys under ${dir} (prefixes ${PREFIXES.join(', ')}); transport ${planOnly ? 'none (local plan only: set the R2_* variables to also check what the bucket has)' : mode}${!planOnly && mode === 'wrangler' ? ' (no customMetadata, existence by download, slow)' : ''}; ${upload ? 'UPLOAD' : 'DRY RUN (nothing is written; add --upload to write)'}`);
  const r = await runUpload({dir, transport, upload, limit, concurrency, log: console.log});
  transport?.done?.();
  console.log(JSON.stringify({total: r.total, alreadyInBucket: r.exists, [upload ? 'uploaded' : 'wouldUpload']: upload ? r.uploaded : r.toUpload, megabytes: Math.round(r.bytes / 1048576 * 10) / 10, failed: r.failed.length}));
  if (!upload) console.log(r.planned.slice(0, 12).join('\n') + (r.planned.length > 12 ? `\n… and ${r.planned.length - 12} more` : ''));
  if (r.failed.length) { console.error(r.failed.slice(0, 10).join('\n')); process.exit(1); }
}
