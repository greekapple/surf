#!/usr/bin/env node
// swan-hawaii step 5 (docs/specs/DRAFT-nearshore-wiring.md): scores the PacIOOS SWAN cell that contains each CDIP Hawaii buoy against that buoy ("model right AT the buoy"), over the last N days. Keyless, 1 request per second.
//   node scripts/swan-vs-buoy.mjs [--days 30] > docs/forecast/SWAN-VS-BUOY.md
// Rule (the How-right harness rule): bias <= 0.5 ft, average miss <= 1 ft, at least 200 hours, judged over the FIRST two thirds of the window; the last third is shown as a hold-out and never used to pass.
// Pairing: an hour is used only when the buoy has a record at exactly that time and both have finite values (no interpolation, no shifting, no filling). Heights in feet (1 m = 3.28084 ft). Direction difference is the circular difference.
// What this is: the model's archived value at the buoy's cell vs the buoy's own Hs/Tp/Dp. SWAN's own past hours are model output (PacIOOS publishes no issue time), so this is a check of the model's skill at a point, NOT of a forecast at a lead time, and NOT of surf height at any spot.
import fs from 'node:fs';
const UA = 'SWELLO surf forecast prototype', ERDDAP = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/', CDIP = 'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/';
const days = Number((process.argv.includes('--days') ? process.argv[process.argv.indexOf('--days') + 1] : 30)), FT = 1 / 0.3048, rad = Math.PI / 180;
let last = 0; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, text = false) { const w = 1100 - (Date.now() - last); if (w > 0) await sleep(w); last = Date.now(); const r = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(90000)}); if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 120)}`); return text ? r.text() : r.json(); }
const now = new Date(), t1 = now.toISOString().replace(/\.\d+Z$/, 'Z'), t0 = new Date(now.getTime() - days * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
const BUOYS = [{id: '106', name: 'Waimea Bay'}, {id: '098', name: 'Mokapu Point'}];
const circ = (a, b) => ((a - b + 540) % 360) - 180, km = (aLa, aLo, bLa, bLo) => { const dLa = (bLa - aLa) * rad, dLo = (bLo - aLo) * rad, h = Math.sin(dLa / 2) ** 2 + Math.cos(aLa * rad) * Math.cos(bLa * rad) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, r2 = (n) => Math.round(n * 100) / 100;
function stats(pairs) {
  if (!pairs.length) return null; const hs = pairs.map((p) => p.sh - p.bh), ah = hs.map(Math.abs), tp = pairs.filter((p) => Number.isFinite(p.st) && Number.isFinite(p.bt)).map((p) => p.st - p.bt), dd = pairs.filter((p) => Number.isFinite(p.sd) && Number.isFinite(p.bd)).map((p) => Math.abs(circ(p.sd, p.bd)));
  const mx = mean(pairs.map((p) => p.sh)), my = mean(pairs.map((p) => p.bh)); let sxy = 0, sxx = 0, syy = 0; for (const p of pairs) { sxy += (p.sh - mx) * (p.bh - my); sxx += (p.sh - mx) ** 2; syy += (p.bh - my) ** 2; }
  return {n: pairs.length, biasFt: r2(mean(hs)), maeFt: r2(mean(ah)), corr: r2(sxy / Math.sqrt(sxx * syy)), buoyMeanFt: r2(my), swanMeanFt: r2(mx), tpBiasS: tp.length ? r2(mean(tp)) : null, dirMaeDeg: dd.length ? Math.round(mean(dd)) : null};
}
const out = [];
for (const b of BUOYS) {
  const csv = (await get(`${CDIP}${b.id}p1_rt.nc?${new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: t0, time_end: t1, accept: 'csv'})}`, true)).trim().split(/\r?\n/).slice(1);
  const rows = csv.map((l) => { const c = l.split(','), n = c.length; return {t: c[0], lat: +c[n - 5], lon: +c[n - 4], hs: +c[n - 3], tp: +c[n - 2], dp: +c[n - 1]}; }).filter((r) => Number.isFinite(Date.parse(r.t)));
  const lat = rows[0].lat, lon = rows[0].lon, byT = new Map(rows.map((r) => [r.t, r]));
  const box = await get(`${ERDDAP}swan_oahu_lon180.json?shgt%5B(last)%5D%5B(0)%5D%5B(${(lat - 0.012).toFixed(4)}):1:(${(lat + 0.012).toFixed(4)})%5D%5B(${(lon - 0.012).toFixed(4)}):1:(${(lon + 0.012).toFixed(4)})%5D`);
  const cell = box.table.rows.filter((r) => Number.isFinite(r[4])).map((r) => ({lat: r[2], lon: r[3], d: km(lat, lon, r[2], r[3])})).sort((a, c) => a.d - c.d)[0];
  if (!cell) { out.push({...b, error: 'no wet SWAN cell within 2 km of the buoy'}); continue; }
  const sel = (v) => `${v}%5B(${t0}):1:(${t1})%5D%5B(0)%5D%5B(${cell.lat})%5D%5B(${cell.lon})%5D`, sw = (await get(`${ERDDAP}swan_oahu_lon180.json?${sel('shgt')},${sel('pper')},${sel('pdir')}`)).table;
  const ix = (n) => sw.columnNames.indexOf(n), pairs = [];
  for (const r of sw.rows) { const t = r[ix('time')], bu = byT.get(t); if (!bu || !Number.isFinite(r[ix('shgt')]) || !Number.isFinite(bu.hs) || bu.hs < 0) continue; pairs.push({t, sh: r[ix('shgt')] * FT, bh: bu.hs * FT, st: r[ix('pper')], bt: bu.tp, sd: r[ix('pdir')], bd: bu.dp}); }
  pairs.sort((a, c) => a.t.localeCompare(c.t)); const cut = Math.floor(pairs.length * 2 / 3), first = pairs.slice(0, cut), hold = pairs.slice(cut), all = stats(pairs), f = stats(first), h = stats(hold);
  const pass = !!f && f.n >= 200 && Math.abs(f.biasFt) <= 0.5 && f.maeFt <= 1;
  out.push({...b, buoyLat: lat, buoyLon: lon, cell, pairedHours: pairs.length, from: pairs[0]?.t, to: pairs.at(-1)?.t, all, first: f, hold: h, pass});
}
const line = (s) => (s ? `${s.n} h, bias ${s.biasFt >= 0 ? '+' : ''}${s.biasFt} ft, average miss ${s.maeFt} ft, correlation ${s.corr}; buoy mean ${s.buoyMeanFt} ft, SWAN mean ${s.swanMeanFt} ft; period bias ${s.tpBiasS ?? 'n/a'} s; direction miss ${s.dirMaeDeg ?? 'n/a'}°` : 'no paired hours');
console.log(`# PacIOOS SWAN against the Hawaii CDIP buoys (generated ${t1.slice(0, 10)})

Generated by \`scripts/swan-vs-buoy.mjs --days ${days}\`. It scores SWAN's value in the cell that contains each buoy against that buoy's own Hs, Tp and Dp. **This is the model at a point, not a forecast at a lead time and not surf height at any spot.** SWAN's own past hours are model output (PacIOOS publishes no issue time), so a pass here says the model tracks the buoy where the buoy is; it does not say its 500 m cell values near a break are right. Rule (the How-right harness rule): bias at most 0.5 ft, average miss at most 1 ft, at least 200 paired hours, judged on the first two thirds of the window; the last third is a hold-out and cannot make a failing buoy pass. An hour is used only when the buoy has a record at exactly that time (no interpolation, shifting or filling). Window ${t0} to ${t1}.

| Buoy | SWAN cell (distance from the buoy) | Rule result (first two thirds) |
|---|---|---|
${out.map((o) => (o.error ? `| ${o.name} (${o.id}) | ${o.error} | not scored |` : `| ${o.name} (${o.id}), ${o.buoyLat}, ${o.buoyLon} | ${o.cell.lat}, ${o.cell.lon} (${r2(o.cell.d)} km) | ${o.pass ? 'PASS' : 'FAIL'}: ${line(o.first)} |`)).join('\n')}

${out.filter((o) => !o.error).map((o) => `## ${o.name} (${o.id})\n- All ${o.pairedHours} paired hours (${o.from} to ${o.to}): ${line(o.all)}\n- First two thirds: ${line(o.first)}\n- Hold-out (last third): ${line(o.hold)}\n`).join('\n')}
## What this does and does not show
- The SWAN flag stays OFF (\`src/ocean/swanFlag.ts\`). Nothing here turns it on.
- Spots are not scored by this table. The spot-level How-right check (our forecast at least 12 h ahead against a buoy carried to the point) needs the captured runs in ~/Development/swello-data/swan (\`scripts/swan-capture-local.mjs\`), at least 7 days of them, and is a separate step.
- A buoy in deep water (106 about 200 m, 098 about 80 m) and a 500 m cell near it share a regime that is not the surf zone, which is where most Hawaii spots sit; the 32 spots with no 8 to 20 m cell are listed in \`src/ocean/swanPointsSourced.ts\` with the reason.
`);
