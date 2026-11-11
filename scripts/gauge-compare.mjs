#!/usr/bin/env node
// srf-compare (gauges): scores our surf estimate at each spot within 5 km of a NEARSHORE gauge against the gauge's own significant wave height, hour by hour.
//   node scripts/gauge-compare.mjs [--shown <dir-or-file> ...] [--gauges <dir> ...] [--out <dir>] [--date YYYY-MM-DD] [--km 5]
// Defaults: shown as in scripts/srf-compare.mjs; gauges = ~/Development/swello-data/surf-height/gauges (the local capture: whole NDBC realtime2 .txt files, any date folder) and ~/Development/swello-data/srf-compare/r2gauges
// (R2 copies from services/surf-capture.mjs: archive/surf-height/gauges/<station>/<date>/<HH>.txt). Output (outside the repo): <out>/gauge-compare-<date>.csv and .md; the summary is also printed.
// What is compared, exactly:
//  - GAUGE: NDBC WVHT (significant wave height, metres -> feet), the reading nearest each whole UTC hour within 15 minutes (the offset is a column); MM is skipped. The gauge list, positions and water depths are the ones in
//    docs/forecast/data/surf-height-sources.json (NDBC buoys with depth <= 45 m); depth and the distance from the gauge to the spot are columns. The Duck FRF instruments are private-use data and are not read here.
//  - OURS: for a spot within --km (default 5) of the gauge, the app's surf range for that hour (src/services/headlineSurf.ts surfBand: lo, hi, central = the typical wave) re-derived now with the current engine from the stored shown
//    capture (uncalibrated; no MOP, SWAN or model-spread input, so the v1 offshore-to-break chain), plus the model's own offshore wave_height at the spot's marine point for reference. The capture used for an hour is the newest one made
//    before that hour that holds it (the lead in hours is a column); only hours that have passed and have a gauge reading are used.
//  - These are not the same quantity: a gauge Hs is the significant height at its depth and position, our number is a breaking surf range at the break. The bias is printed as it is, with depth and distance, and nothing is adjusted. n is printed everywhere;
//    spots near one gauge share its readings, so n_hours (distinct gauge hours) is shown beside n.
import fs from 'node:fs';
import path from 'node:path';
import {DATA, HOUR, M_TO_FT, DEFAULT_SHOWN, argsOf, files, readJson, r2, median, csvCell, kmBetween, loadShown, ourHours} from './lib/compare-common.mjs';

const {multi} = argsOf(process.argv.slice(2)), KM = Number(multi('--km')[0] ?? 5), TOL_MIN = 15;
const shownIn = multi('--shown').length ? multi('--shown') : DEFAULT_SHOWN;
const gaugeIn = multi('--gauges').length ? multi('--gauges') : [path.join(DATA, 'surf-height', 'gauges'), path.join(DATA, 'srf-compare', 'r2gauges')];
const outDir = multi('--out')[0] ?? path.join(DATA, 'srf-compare', 'out'), today = multi('--date')[0] ?? new Date().toISOString().slice(0, 10);
const map = readJson(new URL('../docs/forecast/data/surf-height-sources.json', import.meta.url).pathname);
const gauges = map.gauges.filter((g) => g.kind === 'buoy' && Number.isFinite(g.depth_m) && g.depth_m <= 45 && /^[\w]+$/.test(g.id));
const captures = loadShown(shownIn);

// gauge rows from every file found under the inputs (recursively): Map<station, Map<ms, {wvhtM, tp, ...}>> keyed by the reading's own time
function* walk(p) { if (!fs.existsSync(p)) return; for (const e of fs.readdirSync(p, {withFileTypes: true})) { const f = path.join(p, e.name); if (e.isDirectory()) yield* walk(f); else yield f; } }
const readings = new Map(), sources = new Map();
for (const root of gaugeIn) for (const f of walk(root)) {
  const m = /(?:^|[\\/])(?:([A-Za-z0-9]+)-\d{4}\.txt|([A-Za-z0-9]+)[\\/]\d{4}-\d{2}-\d{2}[\\/]\d{2}\.txt)$/.exec(f), id = m?.[1] ?? m?.[2]; if (!id || !gauges.some((g) => g.id === id)) continue;
  let hdr = null; const rows = readings.get(id) ?? readings.set(id, new Map()).get(id);
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('#YY')) { hdr = line.replace(/^#/, '').trim().split(/\s+/); continue; }
    if (!line || line.startsWith('#') || !hdr) continue;
    const c = line.trim().split(/\s+/), t = Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3], +c[4]), w = c[hdr.indexOf('WVHT')], dpd = c[hdr.indexOf('DPD')];
    if (!Number.isFinite(t) || w === undefined || w === 'MM' || !Number.isFinite(+w)) continue;
    rows.set(t, {wvhtM: +w, dpd: dpd !== undefined && dpd !== 'MM' ? +dpd : null});
  }
  sources.set(id, (sources.get(id) ?? 0) + 1);
}

const inCapture = new Set([...captures.values()].flatMap((c) => Object.keys(c.spots)));
const spotCoords = Object.entries(map.spots).filter(([id]) => inCapture.has(id)).map(([id, s]) => ({id, name: s.name, region: s.region, lat: s.lat, lon: s.lon}));
const rows = [], excluded = {}, skip = (w) => { excluded[w] = (excluded[w] ?? 0) + 1; };
const capsSorted = [...captures.values()].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
const nowMs = Date.now(), noReadings = [];
for (const g of gauges) {
  const obs = readings.get(g.id); if (!obs?.size) { noReadings.push(g.id); continue; }
  const near = spotCoords.map((s) => ({...s, km: kmBetween(g.lat, g.lon, s.lat, s.lon)})).filter((s) => s.km <= KM);
  if (!near.length) continue;
  // the gauge reading nearest each whole hour within TOL_MIN
  const hourly = new Map(); for (const [t, v] of obs) { const h = Math.round(t / HOUR) * HOUR, d = Math.abs(t - h); if (d <= TOL_MIN * 60000 && (!hourly.has(h) || d < hourly.get(h).d)) hourly.set(h, {...v, d}); }
  for (const s of near) {
    for (const [h, v] of hourly) {
      if (h > nowMs) continue;
      const cap = [...capsSorted].reverse().find((c) => Date.parse(c.capturedAt) <= h && c.spots[s.id] && ourHours(captures, c.date, s.id).has(h));
      if (!cap) { skip('gauge hours (of the readings kept, up to 45 days) that no capture of ours holds for the spot: before our first capture or after the last'); continue; }
      const o = ourHours(captures, cap.date, s.id).get(h), gFt = v.wvhtM * M_TO_FT;
      rows.push({h, gauge: g, spot: s, cap, leadH: (h - Date.parse(cap.capturedAt)) / HOUR, gFt, offMin: v.d / 60000, o, diff: o.central - gFt, diffMid: o.mid - gFt, offDiff: Number.isFinite(o.offshoreFt) ? o.offshoreFt - gFt : null});
    }
  }
}
rows.sort((a, b) => a.gauge.id.localeCompare(b.gauge.id) || a.spot.id.localeCompare(b.spot.id) || a.h - b.h);
const HEAD = ['utc_hour', 'gauge_id', 'gauge_name', 'gauge_depth_m', 'spot_id', 'spot_name', 'region', 'km_gauge_to_spot', 'capture_utc', 'lead_h', 'gauge_offset_min', 'gauge_hs_ft', 'our_lo_ft', 'our_hi_ft', 'our_central_ft', 'our_mid_ft', 'model_offshore_hs_ft', 'central_minus_gauge_ft', 'mid_minus_gauge_ft', 'offshore_minus_gauge_ft'];
const csv = [HEAD.join(','), ...rows.map((r) => [new Date(r.h).toISOString(), r.gauge.id, r.gauge.name, r.gauge.depth_m, r.spot.id, r.spot.name, r.spot.region, r2(r.spot.km), r.cap.capturedAt, r2(r.leadH), r2(r.offMin), r2(r.gFt), r2(r.o.lo), r2(r.o.hi), r2(r.o.central), r2(r.o.mid), r2(r.o.offshoreFt), r2(r.diff), r2(r.diffMid), r2(r.offDiff)].map(csvCell).join(','))].join('\n') + '\n';
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null), sgn = (x) => (x === null ? 'n/a' : (x >= 0 ? '+' : '') + r2(x));
function stat(rs) { const d = rs.map((r) => r.diff), od = rs.map((r) => r.offDiff).filter((x) => x !== null); return {n: rs.length, hours: new Set(rs.map((r) => `${r.gauge.id}|${r.h}`)).size, spots: new Set(rs.map((r) => r.spot.id)).size, g: avg(rs.map((r) => r.gFt)), c: avg(rs.map((r) => r.o.central)), off: avg(rs.map((r) => r.o.offshoreFt).filter(Number.isFinite)), bias: avg(d), mae: avg(d.map(Math.abs)), med: median(d), offBias: avg(od)}; }
const line = (k, s) => `| ${k} | ${s.n} | ${s.hours} | ${s.spots} | ${r2(s.g)} | ${r2(s.c)} | ${sgn(s.bias)} | ${r2(s.mae)} | ${sgn(s.med)} | ${r2(s.off)} | ${sgn(s.offBias)} |`;
const hdr = '| | n (gauge-hour x spot) | gauge hours | spots | gauge Hs (ft) | our central (ft) | ours - gauge, mean (ft) | mean abs miss (ft) | median diff (ft) | model offshore Hs (ft) | offshore - gauge, mean (ft) |\n|---|---|---|---|---|---|---|---|---|---|---|';
const byG = new Map(); for (const r of rows) { if (!byG.has(r.gauge.id)) byG.set(r.gauge.id, []); byG.get(r.gauge.id).push(r); }
const distB = (r) => (r.spot.km <= 1 ? 'spot within 1 km' : r.spot.km <= 2.5 ? '1 to 2.5 km' : '2.5 to 5 km'), depB = (r) => (r.gauge.depth_m <= 12 ? 'gauge 12 m or shallower' : r.gauge.depth_m <= 25 ? 'gauge 12 to 25 m' : 'gauge 25 to 45 m');
const grp = (f) => { const m = new Map(); for (const r of rows) { const k = f(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return [...m]; };
const span = rows.length ? `${new Date(rows[0].h).toISOString().slice(0, 13)}Z to ${new Date(Math.max(...rows.map((r) => r.h))).toISOString().slice(0, 13)}Z` : 'none';
const md = `# Nearshore gauges vs our surf estimate at the spots within ${KM} km (generated ${today})

Generated by \`scripts/gauge-compare.mjs\`. **Plumbing and first numbers, not a calibration or a verdict.** A gauge reads the significant wave height at its depth and position; our number is the breaking surf range at the break (v1 chain re-derived now from the stored hours, uncalibrated, no MOP/SWAN input). They are different quantities and nothing is adjusted: the bias is shown with the gauge depth and the distance. Method: the script header.

**Inputs:** ${captures.size} shown capture(s) (${[...captures.keys()].join(', ') || 'none'}); readings from ${readings.size} of ${gauges.length} nearshore gauges (${[...readings].map(([k, v]) => `${k} ${v.size}`).join(', ')} readings); hours ${span}.

## Overall
${hdr}
${line('all', stat(rows))}

**n is small and the rows are not independent:** the spots near one gauge share its readings, and ${captures.size} capture day(s) hold only the hours from each capture onward.

### By gauge (depth, spots within ${KM} km)
${hdr}
${[...byG].sort((a, b) => b[1].length - a[1].length).map(([id, rs]) => line(`${id} ${rs[0].gauge.name.replace(/\|/g, '/')}, ${rs[0].gauge.depth_m} m`, stat(rs))).join('\n')}

### By distance gauge to spot
${hdr}
${grp(distB).map(([k, rs]) => line(k, stat(rs))).join('\n')}

### By gauge depth
${hdr}
${grp(depB).map(([k, rs]) => line(k, stat(rs))).join('\n')}

## Not compared
${Object.entries(excluded).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} x ${k}`).join('\n') || '- nothing excluded'}
- ${noReadings.length} of the ${gauges.length} nearshore gauges have no captured readings (the capture holds only the stations listed under Inputs): ${noReadings.join(' ')}
`;
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, `gauge-compare-${today}.csv`), csv); fs.writeFileSync(path.join(outDir, `gauge-compare-${today}.md`), md);
console.log(md); console.error(`wrote ${path.join(outDir, `gauge-compare-${today}.csv`)} (${rows.length} rows)`);
