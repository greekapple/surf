#!/usr/bin/env node
// swan-hawaii: keeps a local record of the PacIOOS SWAN forecast at every Hawaii spot's proposed cell (src/ocean/swanPointsSourced.ts) and of the two CDIP Hawaii buoys it will be compared with (Waimea Bay 106, Mokapu Point 098), so the
// buoy comparison (scripts/swan-vs-buoy.mjs) has at least 7 days to work with. Keyless public data, a descriptive User-Agent, at most 1 request per second. Output stays OUTSIDE the repo:
//   ~/Development/swello-data/swan/<YYYY-MM-DD>/swan-<ISO>.json   (one capture: every distinct cell, its forecast rows exactly as ERDDAP returned them)
//   ~/Development/swello-data/swan/<YYYY-MM-DD>/cdip-<id>-<ISO>.csv
// Usage: node scripts/swan-capture-local.mjs                        one capture and exit
//        node scripts/swan-capture-local.mjs --every 3 --until 07:00   a capture every 3 h until 07:00 local (the next morning), then exit
//        node scripts/swan-capture-local.mjs --every 3 --start-at 07:00   open-ended: first capture at 07:00 local, then every 3 h while the process lives
// Nothing here is shown in the app. It is a data log; it does not touch the repo, the Worker, launchd or cron.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SWAN_POINTS} from '../src/ocean/swanPointsSourced.ts';
const BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/', UA = 'SWELLO surf forecast prototype', ROOT = path.join(os.homedir(), 'Development', 'swello-data', 'swan');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const every = Number(opt('--every', 0)), until = opt('--until', null);
let last = 0; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, text = false) {
  const wait = 1100 - (Date.now() - last); if (wait > 0) await sleep(wait); last = Date.now();
  for (let a = 0; a < 2; a++) { try { const r = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(60000)}); if (r.ok) return text ? await r.text() : await r.json(); if (r.status === 404) return null; } catch { /* retry */ } await sleep(2000); }
  return null;
}
async function capture() {
  const now = new Date(), iso = now.toISOString().replace(/[:.]/g, '').slice(0, 15) + 'Z', day = now.toISOString().slice(0, 10), dir = path.join(ROOT, day); fs.mkdirSync(dir, {recursive: true});
  const t0 = new Date(now.getTime() - 6 * 3600000).toISOString().replace(/\.\d+Z$/, 'Z'), cells = new Map();
  for (const p of SWAN_POINTS) cells.set(`${p.dataset}:${p.lat},${p.lon}`, p);
  const result = {capturedAt: now.toISOString(), source: BASE, userAgent: UA, from: t0, cells: {}, spots: {}};
  for (const p of SWAN_POINTS) (result.spots[p.spotId] = `${p.dataset}:${p.lat},${p.lon}`);
  let ok = 0, fail = 0;
  for (const [key, p] of cells) {
    const sel = (v) => `${v}%5B(${t0}):1:(last)%5D%5B(0)%5D%5B(${p.lat})%5D%5B(${p.lon})%5D`;
    const j = await get(`${BASE}${p.dataset}_lon180.json?${sel('shgt')},${sel('pper')},${sel('pdir')}`);
    if (j?.table) { result.cells[key] = {columnNames: j.table.columnNames, rows: j.table.rows}; ok++; } else fail++;
  }
  fs.writeFileSync(path.join(dir, `swan-${iso}.json`), JSON.stringify(result));
  let buoys = 0;
  for (const id of ['106', '098']) {
    const csv = await get(`https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/${id}p1_rt.nc?${new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: new Date(now.getTime() - 86400000).toISOString(), time_end: new Date(now.getTime() + 3600000).toISOString(), accept: 'csv'})}`, true);
    if (csv) { fs.writeFileSync(path.join(dir, `cdip-${id}-${iso}.csv`), csv); buoys++; }
  }
  console.log(`${now.toISOString()} captured ${ok} SWAN cells (${fail} failed; ${SWAN_POINTS.length} spots share ${cells.size} cells) and ${buoys} CDIP buoys -> ${dir}`);
  return {ok, fail, buoys, cells: cells.size};
}
const untilMs = () => { if (!until) return Infinity; const [h, m] = until.split(':').map(Number), d = new Date(); d.setHours(h, m || 0, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); };
const stop = untilMs();
const startAt = opt('--start-at', null);   // HH:MM local: wait until then before the first capture (lets a new open-ended loop take over from one that ends at that time)
if (startAt) { const [h, m] = startAt.split(':').map(Number), d = new Date(); d.setHours(h, m || 0, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); await sleep(d.getTime() - Date.now()); }
await capture();
while (every > 0 && Date.now() + every * 3600000 < stop) { await sleep(every * 3600000); await capture(); }
console.log('done');
