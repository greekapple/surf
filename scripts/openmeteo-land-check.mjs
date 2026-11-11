#!/usr/bin/env node
// Open-Meteo Marine land-cell check for the Europe study (docs/forecast/EUROPE-DATA.md blocker 1; method as docs/forecast/AUSTRALIA-DATA.md section 3). For every spot in docs/forecast/data/europe-sources.json it asks Open-Meteo
// Marine for 24 hours of wave_height at the three stored points (appMarine9km first, then seaward2km, then the beach pin) and records whether 24 of 24 hours came back non-null, the grid point Open-Meteo answered from, and how far that is from the asked point.
//   node scripts/openmeteo-land-check.mjs [--out docs/forecast/data/europe-model-check.json]
// Keyless public API, 25 coordinates per call, at most 1 call per second, a descriptive User-Agent. It stops at the first 429 and writes what it has (the daily limit is shared by every local bulk job on this machine's IP).
import fs from 'node:fs';
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'docs/forecast/data/europe-model-check.json';
const spots = JSON.parse(fs.readFileSync(new URL('../docs/forecast/data/europe-sources.json', import.meta.url), 'utf8')).spots;
const rad = Math.PI / 180, km = (aLa, aLo, bLa, bLo) => { const dLa = (bLa - aLa) * rad, dLo = (bLo - aLo) * rad, h = Math.sin(dLa / 2) ** 2 + Math.cos(aLa * rad) * Math.cos(bLa * rad) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const KINDS = ['appMarine9km', 'seaward2km', 'beach'], jobs = []; for (const k of KINDS) for (const s of spots) { const p = s.model?.pointsToCheck?.[k]; if (p) jobs.push({id: s.id, kind: k, lat: p[0], lon: p[1]}); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), results = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')).points : {};
let stopped = null, calls = 0;
for (let i = 0; i < jobs.length && !stopped; i += 25) {
  const batch = jobs.slice(i, i + 25).filter((j) => !results[`${j.id}|${j.kind}`]); if (!batch.length) continue;
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${batch.map((j) => j.lat).join(',')}&longitude=${batch.map((j) => j.lon).join(',')}&hourly=wave_height&forecast_days=1`;
  let res = null; for (let a = 0; a < 3 && !res; a++) { const r = await fetch(url, {headers: {'User-Agent': 'SWELLO surf forecast prototype'}}); calls++; if (r.status === 429) { stopped = '429 daily limit'; break; } if (r.ok) res = await r.json(); else await sleep(3000); }
  if (!res) { stopped ??= 'request failed'; break; }
  const arr = Array.isArray(res) ? res : [res];
  batch.forEach((j, n) => { const x = arr[n], h = x?.hourly?.wave_height ?? []; results[`${j.id}|${j.kind}`] = {nonNull: h.filter((v) => v !== null && v !== undefined).length, hours: h.length, gridLat: x?.latitude ?? null, gridLon: x?.longitude ?? null, gridKm: x ? Math.round(km(j.lat, j.lon, x.latitude, x.longitude) * 10) / 10 : null}; });
  await sleep(1100);
}
fs.writeFileSync(out, JSON.stringify({checkedAt: new Date().toISOString(), source: 'Open-Meteo Marine wave_height, forecast_days=1, 25 coordinates per call', points: results, stopped, calls}, null, 0) + '\n');
console.log(`${Object.keys(results).length} of ${jobs.length} points checked${stopped ? `; stopped: ${stopped}` : ''}`);
