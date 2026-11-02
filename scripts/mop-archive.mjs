#!/usr/bin/env node
// T-041: archives each CDIP MOP forecast as fetched, so lead-time skill can be measured later (plan §5).
// Usage: node scripts/mop-archive.mjs [SF023 ...]   (default: SF023, the assigned points in src/ocean/mop.ts)
// Writes data/archive/mop/<ID>/<issued>__<retrieved>.csv plus a .json sidecar with the file's own issue time and coverage.
// Public CDIP THREDDS only; no key. Run it from cron or by hand; it skips a forecast whose issue time is already stored.
// The deployed Worker archives the same forecast as immutable snapshots (forecast/v10/snapshots/nearshore-<ID>-forecast/) when R2 is bound.
import fs from 'node:fs';
import path from 'node:path';
const NCSS = 'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/';
const DODS = 'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['SF023'];
const attr = (t, n) => t.match(new RegExp(`String ${n} "([^"]*)"`))?.[1] ?? null;
for (const id of ids) {
  const das = await (await fetch(`${DODS}${id}_forecast.nc.das`, {signal: AbortSignal.timeout(40000)})).text();
  const issued = attr(das, 'date_issued');
  if (!issued || !Number.isFinite(Date.parse(issued))) { console.error(`${id}: no issue time in the file; not archiving`); continue; }
  const dir = path.join('data', 'archive', 'mop', id);
  fs.mkdirSync(dir, {recursive: true});
  const stamp = issued.replace(/[:]/g, '');
  if (fs.readdirSync(dir).some((f) => f.startsWith(stamp + '__') && f.endsWith('.csv'))) { console.log(`${id}: issue ${issued} already archived`); continue; }
  const start = new Date(Date.now() - 2 * 86400000).toISOString(), end = new Date(Date.now() + 12 * 86400000).toISOString();
  const csv = await (await fetch(`${NCSS}${id}_forecast.nc?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: start, time_end: end, accept: 'csv'}), {signal: AbortSignal.timeout(60000)})).text();
  if (!csv.startsWith('time,station,')) { console.error(`${id}: unexpected response; not archiving`); continue; }
  const retrieved = new Date().toISOString().replace(/[:]/g, '');
  const base = path.join(dir, `${stamp}__${retrieved}`);
  fs.writeFileSync(base + '.csv', csv);
  fs.writeFileSync(base + '.json', JSON.stringify({id, issuedAt: new Date(issued).toISOString(), retrievedAt: new Date().toISOString(), coverageStart: attr(das, 'time_coverage_start'), coverageEnd: attr(das, 'time_coverage_end'), history: attr(das, 'history'), rows: csv.trim().split('\n').length - 1}, null, 1) + '\n');
  console.log(`${id}: archived issue ${issued} (${csv.trim().split('\n').length - 1} rows) -> ${base}.csv`);
}
