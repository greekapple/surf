#!/usr/bin/env node
// srf-compare: copies the captures the comparison scripts read from R2 to ~/Development/swello-data/srf-compare (outside the repo). Read-only (`wrangler r2 object get --remote`, the lead's login); an object already
// copied is skipped, so a rerun only fetches what is new. Run it the way the other scripts run (zsh -lic 'cd <worktree> && node scripts/pull-r2-captures.mjs').
//   node scripts/pull-r2-captures.mjs [--shown-days 5] [--gauges-from 2026-11-11T16] [--no-srf] [--no-gauges] [--no-shown]
//   howright/v2/shown/<day>.json                          -> srf-compare/r2/shown-<day>.json            (the last N UTC days; the newest two are always refetched)
//   archive/surf-height/srf/_seen.json + .../<OFFICE>/<id>.json -> srf-compare/r2srf/products/<id>.json  (every id the index lists)
//   archive/surf-height/gauges/<station>/<day>/<HH>.txt   -> srf-compare/r2gauges/<station>/<day>/<HH>.txt (every hour from --gauges-from to the previous complete UTC hour; a 404 is simply an hour with no object)
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DATA} from './lib/compare-common.mjs';
import {GAUGE_STATIONS} from '../services/surf-capture.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BUCKET = 'swello-forecast-cache', OUT = path.join(DATA, 'srf-compare'), HOUR = 3600000;
let fetched = 0, missing = 0, skipped = 0;
function get(key, dest, {force = false} = {}) {
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped++; return true; }
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  try { execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', dest], {stdio: 'pipe', timeout: 60000}); if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { fetched++; return true; } } catch { /* a missing object */ }
  try { fs.rmSync(dest, {force: true}); } catch { /* nothing to remove */ } missing++; return false;
}
const now = Date.now(), day = (ms) => new Date(ms).toISOString().slice(0, 10);
if (!args.includes('--no-shown')) for (let i = 0; i < Number(opt('--shown-days', 5)); i++) get(`howright/v2/shown/${day(now - i * 86400000)}.json`, path.join(OUT, 'r2', `shown-${day(now - i * 86400000)}.json`), {force: i < 2});
if (!args.includes('--no-srf')) {
  const seen = path.join(OUT, 'r2srf', '_seen.json');
  if (get('archive/surf-height/srf/_seen.json', seen, {force: true})) {
    const idx = JSON.parse(fs.readFileSync(seen, 'utf8'));
    for (const [office, v] of Object.entries(idx.offices ?? {})) for (const id of v.ids ?? []) get(`archive/surf-height/srf/${office}/${id}.json`, path.join(OUT, 'r2srf', 'products', `${id}.json`));
  } else console.error('no SRF index in R2 yet (the first run is at 02, 08, 14 or 20 UTC after the deploy)');
}
if (!args.includes('--no-gauges')) {
  const from = Date.parse(opt('--gauges-from', '2026-11-11T16') + ':00:00Z'), last = now - now % HOUR - HOUR;
  for (let t = from; t <= last; t += HOUR) for (const st of GAUGE_STATIONS) get(`archive/surf-height/gauges/${st}/${day(t)}/${String(new Date(t).getUTCHours()).padStart(2, '0')}.txt`, path.join(OUT, 'r2gauges', st, day(t), `${String(new Date(t).getUTCHours()).padStart(2, '0')}.txt`));
}
console.log(`fetched ${fetched}, already had ${skipped}, not in R2 ${missing}`);
