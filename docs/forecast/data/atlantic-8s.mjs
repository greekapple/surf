#!/usr/bin/env node
// atlantic-8s: evidence for the Atlantic 8 s minimum period of the v1 breaking estimate (docs/forecast/ATLANTIC-8S.md). Analysis only: src/ is not changed.
//   node docs/forecast/data/atlantic-8s.mjs [--offline]
// What it does:
//  - SPOTS: US East Coast spots (lon > -82, lat > 24, not the Keys) whose v1 breaking profile has minPeriod 8 and that have a beach orientation.
//  - BYPASS: the profiles are the exported `breakingProfiles` array of src/ocean/localCalibration.ts; this script sets minPeriod to 0 on its own in-memory copy
//    (the same module instance the engine reads) and runs the app's own chain (normalizeOpenMeteo -> headlineSurf, method 'v1' only). Every other refusal
//    (outside the window, wind sea larger than the swell, no shelter) still applies. A second pass with the profiles untouched marks which hours the app shows today.
//  - PERIOD BIN: the primary swell period the gate reads (Open-Meteo swell_wave_period at the spot's marine point): <5, 5-6, 6-7, 7-8, >=8 s (control).
//  - INPUTS: (1) the stored shown captures (forecast as issued, 48 h each; ~/Development/swello-data/srf-compare/r2 and r2/howright/v2/shown); (2) Open-Meteo marine
//    past_days (the model's own recent hours, a hindcast-like series) for a few spots per SRF zone (past 8 days) and the spots within 10 km of an East Coast nearshore
//    gauge (past 45 days). Cached under ~/Development/swello-data/atlantic-8s/; --offline uses the cache only.
//  - SRF: NWS Surf Zone Forecast "Surf Height" for the spot's zone and local date (services/srf-parse.mjs, pickEntry by seaward bearing; "or less" excluded).
//    Captures: the product issued closest to the capture (as scripts/srf-compare.mjs). Hindcast: the newest product issued before 17Z of that date.
//    Per daylight hour: our mid-range (lo+hi)/2 against their [lo, hi]: inside / above / below, ours - their mid, and the distance outside their range (0 inside).
//  - GAUGES: NDBC realtime2 WVHT (45 days, nearest reading within 15 min of the hour) of the East Coast nearshore buoys (depth <= 45 m) plus 44056 (Duck FRF 17 m,
//    private-use data, read here for internal analysis only). Ours: the central (typical wave, the 10 m-depth convention height) for the same hour; the model's offshore Hs is a reference.
// Spots in one zone share an SRF range and spots near one gauge share its readings, so the independent counts (zone-days, gauge-hours) are printed beside n.
import fs from 'node:fs';
import path from 'node:path';
import {parseSrf, pickEntry} from '../../../services/srf-parse.mjs';
import {DATA, HOUR, M_TO_FT, files, readJson, median, kmBetween, loadShown, DEFAULT_SHOWN} from '../../../scripts/lib/compare-common.mjs';
import {breakingProfiles} from '../../../src/ocean/localCalibration.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {normalizeOpenMeteo, marineFields} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {headlineSurf} from '../../../src/services/headlineSurf.ts';
import {isDark} from '../../../src/services/daylight.ts';
import {timeZoneOf} from '../../../src/ocean/spotZone.ts';
import {dateInMs} from '../../../src/ocean/time.ts';
import {COAST_ROWS, UPGRADED_ROWS} from '../../../src/data/coast.ts';

const UA = 'SWELLO surf forecast prototype', OFFLINE = process.argv.includes('--offline');
const CACHE = path.join(DATA, 'atlantic-8s'), OUT = path.join(CACHE, 'out');
fs.mkdirSync(path.join(CACHE, 'om'), {recursive: true}); fs.mkdirSync(path.join(CACHE, 'ndbc'), {recursive: true}); fs.mkdirSync(OUT, {recursive: true});
const map = readJson(new URL('./surf-height-sources.json', import.meta.url).pathname);
const seaward = new Map([...UPGRADED_ROWS, ...COAST_ROWS].map((r) => [r[0], r[6]]));
const SRF_OFFICES = ['BOX', 'CAR', 'GYX', 'OKX', 'PHI', 'AKQ', 'MHX', 'ILM', 'CHS', 'JAX', 'MLB', 'MFL'];
const SRF_SPOTS_PER_ZONE = 3, GAUGE_KM = 25, GAUGE_SPOTS = 3, SRF_PAST = 8, GAUGE_PAST = 45;

// ---- spots
const original = new Map(breakingProfiles.map((p) => [p.spotId, p.minPeriod]));
const spots = Object.entries(map.spots).flatMap(([id, s]) => {
  if (!(s.lon > -82 && s.lat > 24) || s.region === 'Florida Keys') return [];
  const p = breakingProfiles.find((x) => x.spotId === id); if (!p || p.minPeriod !== 8 || !(p.shelter > 0)) return []; // no shelter = refused every hour, not a period question
  let ev = null; try { ev = evidenceSpot(id); } catch { /* not an app spot */ } if (!ev || ev.orientation == null) return [];
  return [{id, name: s.name, region: s.region, lat: s.lat, lon: s.lon, office: s.nws_srf?.office, zone: s.nws_srf?.zone, ev}];
});
const setMin = (v) => { for (const p of breakingProfiles) if (original.has(p.spotId)) p.minPeriod = v === null ? original.get(p.spotId) : v; };

// ---- our hours for one spot from an Open-Meteo marine response: Map<ms, {period, mid, lo, hi, central, offshoreFt, appShows, code}>
function hoursFrom(sp, marine, retrievedAt) {
  // faceEstimate is computed inside normalizeOpenMeteo and headlineSurf reads the profile too, so each pass runs the whole chain under its own setting
  const nowMs = Date.parse(retrievedAt), ctx = {spread: null, bundle: null, nowMs, felt: [], observations: []}, out = new Map();
  const pass = (v) => { setMin(v); try { return normalizeOpenMeteo(sp.ev, marine, null, retrievedAt).map((r) => { let h = null; try { h = headlineSurf(sp.id, toLegacy(r), ctx); } catch { /* none */ } return {r, h: h && h.kind === 'estimate' && h.method === 'v1' ? h : null}; }); } finally { setMin(null); } };
  const base = new Map(pass(null).map((x) => [x.r.timestamp, x.h]));
  for (const {r, h} of pass(0)) {
    const t = Date.parse(r.timestamp), period = r.primary?.period?.value, offshoreFt = r.offshore?.value;
    if (!Number.isFinite(period)) continue;
    const code = h ? 'ok' : (r.faceEstimate?.refusalCode ?? 'other');
    out.set(t, {period, offshoreFt, appShows: !!base.get(r.timestamp), code, ...(h ? {lo: h.loFt, hi: h.hiFt, mid: (h.loFt + h.hiFt) / 2, central: h.centralFt ?? (h.loFt + h.hiFt) / 2} : {})});
  }
  return out;
}
const asResponse = (h, units) => ({hourly: h, hourly_units: {time: 'unixtime', ...units}});

// ---- Open-Meteo marine with past_days, cached per marine point
let omCalls = 0;
async function marinePast(sp, pastDays) {
  const f = path.join(CACHE, 'om', `${sp.ev.marineLatitude},${sp.ev.marineLongitude}-p${pastDays}.json`);
  if (fs.existsSync(f)) return readJson(f);
  if (OFFLINE) return null;
  const u = `https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: String(sp.ev.marineLatitude), longitude: String(sp.ev.marineLongitude), hourly: marineFields.join(','), timezone: 'GMT', timeformat: 'unixtime', past_days: String(pastDays), forecast_days: '1'})}`;
  const r = await fetch(u, {headers: {'User-Agent': UA}}); omCalls++;
  if (!r.ok) { console.error('open-meteo', r.status, await r.text()); return null; }
  const j = await r.json(); j.__retrievedAt = new Date().toISOString(); fs.writeFileSync(f, JSON.stringify(j)); return j;
}
async function ndbc(id) {
  const f = path.join(CACHE, 'ndbc', `${id}.txt`);
  if (!fs.existsSync(f) && !OFFLINE) { const r = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`, {headers: {'User-Agent': UA}}); if (r.ok) fs.writeFileSync(f, await r.text()); else console.error('ndbc', id, r.status); }
  if (!fs.existsSync(f)) return new Map();
  let hdr = null; const rows = new Map();
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('#YY')) { hdr = line.replace(/^#/, '').trim().split(/\s+/); continue; }
    if (!line || line.startsWith('#') || !hdr) continue;
    const c = line.trim().split(/\s+/), t = Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3], +c[4]), w = c[hdr.indexOf('WVHT')], dpd = c[hdr.indexOf('DPD')];
    if (!Number.isFinite(t) || w === undefined || w === 'MM' || !Number.isFinite(+w)) continue;
    rows.set(t, {wvhtM: +w, dpd: dpd && dpd !== 'MM' ? +dpd : null});
  }
  const hourly = new Map(); for (const [t, v] of rows) { const h = Math.round(t / HOUR) * HOUR, d = Math.abs(t - h); if (d <= 15 * 60000 && (!hourly.has(h) || d < hourly.get(h).d)) hourly.set(h, {...v, d}); }
  return hourly;
}

// ---- SRF products (local capture + R2 copies)
const products = new Map();
for (const f of files([path.join(DATA, 'surf-height', 'srf', 'products'), path.join(DATA, 'srf-compare', 'r2srf', 'products')], /\.json$/)) { const p = readJson(f); if (p?.id && typeof p.productText === 'string' && !products.has(p.id)) products.set(p.id, p); }
const parsed = [...products.values()].map(parseSrf).filter((p) => SRF_OFFICES.includes(String(p.office).replace(/^K/, '')));
const srfDays = new Map(); // zone|date -> [{issuedMs, per, z}]
for (const p of parsed) for (const z of p.zones) for (const per of z.periods) {
  if (per.part !== 'day' || !per.date) continue;
  for (const u of z.ugc) { const k = `${u}|${per.date}`; (srfDays.get(k) ?? srfDays.set(k, []).get(k)).push({issuedMs: Date.parse(p.issuedAt), per, z, office: p.office}); }
}
const srfZones = new Set([...srfDays.keys()].map((k) => k.split('|')[0]));

const BINS = [['<5 s', 0, 5], ['5-6 s', 5, 6], ['6-7 s', 6, 7], ['7-8 s', 7, 8], ['5-8 s (all)', 5, 8], ['>=8 s (control)', 8, 99]];
const inBin = (p, [, a, b]) => p >= a && p < b;
const excluded = {}, skip = (w) => { excluded[w] = (excluded[w] ?? 0) + 1; };

// SRF rows for one spot's hours; pick(per-date candidates) -> the product used
function srfRows(sp, hours, pick, source) {
  const rows = [], tz = timeZoneOf(sp.id), bearing = seaward.get(sp.id);
  for (const [t, v] of hours) {
    if (isDark(sp.id, new Date(t).toISOString())) continue;
    const date = dateInMs(tz, t), cands = srfDays.get(`${sp.zone}|${date}`); if (!cands) continue;
    const c = pick(cands, t); if (!c) continue;
    if (date === c.z.issued?.date && t + HOUR <= c.issuedMs) continue; // same-day product: only hours from its issue on
    // "N feet or less" is read as their own statement, 0 to N
    const e = pickEntry(c.per.surf.map((x) => (x.kind === 'or_less' && Number.isFinite(x.hi) ? {...x, kind: 'range', lo: 0, orLess: true} : x)), bearing); if (e.reason) { skip(`${source}: ${e.reason}`); continue; }
    const {lo, hi} = e.entry, orLess = !!e.entry.orLess; // or-less rows count for inside / above / below, not for the mid-range error
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) { skip(`${source}: their surf height has no numbers`); continue; }
    rows.push({source, spot: sp.id, zone: sp.zone, date, t, period: v.period, code: v.code, appShows: v.appShows, lo, hi, orLess, mid: v.mid, issued: c.issuedMs});
  }
  return rows;
}

const srf = [], gauge = [], refusals = [];
// (1) captures: forecast as issued
const captures = loadShown(DEFAULT_SHOWN);
for (const [capDate, cap] of captures) {
  const capMs = Date.parse(cap.capturedAt);
  for (const sp of spots) {
    const s = cap.spots[sp.id]; if (!s || !srfZones.has(sp.zone)) continue;
    let hours; try { hours = hoursFrom(sp, asResponse(s.marine, s.marineUnits), s.retrievedAt ?? cap.capturedAt); } catch { continue; }
    for (const [, v] of hours) refusals.push({source: 'capture', period: v.period, code: v.code, appShows: v.appShows});
    srf.push(...srfRows(sp, hours, (cands) => cands.reduce((b, c) => (!b || Math.abs(c.issuedMs - capMs) < Math.abs(b.issuedMs - capMs) ? c : b), null), `capture ${capDate}`));
  }
}
// (2) Open-Meteo past days: a few spots per SRF zone with products
const byZone = new Map(); for (const sp of spots) if (srfZones.has(sp.zone)) (byZone.get(sp.zone) ?? byZone.set(sp.zone, []).get(sp.zone)).push(sp);
for (const [, list] of byZone) {
  const seen = new Set(), pickN = list.filter((sp) => { const k = sp.ev.marineLatitude + ',' + sp.ev.marineLongitude; if (seen.has(k)) return false; seen.add(k); return true; });
  const step = Math.max(1, Math.floor(pickN.length / SRF_SPOTS_PER_ZONE));
  for (const sp of pickN.filter((_, i) => i % step === 0).slice(0, SRF_SPOTS_PER_ZONE)) {
    const m = await marinePast(sp, SRF_PAST); if (!m) continue;
    const hours = hoursFrom(sp, m, m.__retrievedAt), nowMs = Date.parse(m.__retrievedAt);
    for (const [t] of hours) if (t > nowMs) hours.delete(t);
    for (const [, v] of hours) refusals.push({source: 'hindcast', period: v.period, code: v.code, appShows: v.appShows});
    srf.push(...srfRows(sp, hours, (cands, t) => { const date = dateInMs(timeZoneOf(sp.id), t), cut = Date.parse(date + 'T17:00:00Z'); return cands.filter((c) => c.issuedMs <= cut).sort((a, b) => b.issuedMs - a.issuedMs)[0] ?? null; }, 'hindcast'));
  }
}
// (3) gauges
const gauges = map.gauges.filter((g) => g.kind === 'buoy' && Number.isFinite(g.depth_m) && g.depth_m <= 45 && g.lon > -82 && g.lat > 24 && g.lat < 42.5); // lat < 42.5 leaves out Lake Ontario (45215)
if (!gauges.some((g) => g.id === '44056')) gauges.push({id: '44056', name: 'Duck FRF 17 m, NC (433) [FRF, private use]', lat: 36.2, lon: -75.714, depth_m: 17.4});
const gaugeUsed = [];
for (const g of gauges) {
  const near = spots.map((s) => ({...s, km: kmBetween(g.lat, g.lon, s.lat, s.lon)})).filter((s) => s.km <= GAUGE_KM).sort((a, b) => a.km - b.km).slice(0, GAUGE_SPOTS);
  if (!near.length) continue;
  const obs = await ndbc(g.id); if (!obs.size) { skip(`gauge ${g.id}: no readings`); continue; }
  gaugeUsed.push(`${g.id} ${g.name} (${g.depth_m} m; ${near.map((s) => `${s.name} ${s.km.toFixed(1)} km`).join(', ')})`);
  for (const sp of near) {
    const m = await marinePast(sp, GAUGE_PAST); if (!m) continue;
    const hours = hoursFrom(sp, m, m.__retrievedAt);
    for (const [t, v] of hours) { const o = obs.get(t); if (!o) continue; gauge.push({gauge: g.id, spot: sp.id, km: sp.km, t, period: v.period, code: v.code, appShows: v.appShows, gFt: o.wvhtM * M_TO_FT, gDpd: o.dpd, central: v.central, offshoreFt: v.offshoreFt}); }
  }
}

// ---- tables
const f1 = (x) => (x === null || !Number.isFinite(x) ? '–' : (Math.round(x * 10) / 10).toFixed(1)), pct = (a, n) => (n ? Math.round((100 * a) / n) + '%' : '–');
function srfTable(rows) {
  const lines = ['| peak period (bin) | n hours | spots | zone-days | their range \"N or less\" | inside | above | below | median ours − their mid (ft; \"or less\" rows left out) | median distance outside their range (ft) | app shows today |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const b of BINS) {
    const all = rows.filter((r) => inBin(r.period, b)), ok = all.filter((r) => r.code === 'ok');
    const ins = ok.filter((r) => r.mid >= r.lo && r.mid <= r.hi).length, ab = ok.filter((r) => r.mid > r.hi).length, be = ok.filter((r) => r.mid < r.lo).length;
    const dist = ok.map((r) => (r.mid > r.hi ? r.mid - r.hi : r.mid < r.lo ? r.mid - r.lo : 0));
    lines.push(`| ${b[0]} | ${ok.length} (of ${all.length}) | ${new Set(ok.map((r) => r.spot)).size} | ${new Set(ok.map((r) => r.zone + r.date + r.source)).size} | ${pct(ok.filter((r) => r.orLess).length, ok.length)} | ${pct(ins, ok.length)} | ${pct(ab, ok.length)} | ${pct(be, ok.length)} | ${f1(median(ok.filter((r) => !r.orLess).map((r) => r.mid - (r.lo + r.hi) / 2)))} | ${f1(median(dist))} | ${pct(all.filter((r) => r.appShows).length, all.length)} |`);
  }
  return lines.join('\n');
}
function gaugeTable(rows) {
  const lines = ['| peak period (bin) | n hours | gauge-hours | gauges | median ours − gauge Hs (ft) | mean abs miss (ft) | median ours / gauge | median model offshore Hs − gauge (ft) | app shows today |', '|---|---|---|---|---|---|---|---|---|'];
  for (const b of BINS) {
    const all = rows.filter((r) => inBin(r.period, b)), ok = all.filter((r) => r.code === 'ok' && Number.isFinite(r.central));
    const d = ok.map((r) => r.central - r.gFt);
    lines.push(`| ${b[0]} | ${ok.length} (of ${all.length}) | ${new Set(ok.map((r) => r.gauge + r.t)).size} | ${new Set(ok.map((r) => r.gauge)).size} | ${f1(median(d))} | ${f1(d.length ? d.reduce((s, x) => s + Math.abs(x), 0) / d.length : null)} | ${ok.length ? (Math.round(median(ok.filter((r) => r.gFt > 0.3).map((r) => r.central / r.gFt)) * 100) / 100).toFixed(2) : '–'} | ${f1(median(ok.filter((r) => Number.isFinite(r.offshoreFt)).map((r) => r.offshoreFt - r.gFt)))} | ${pct(all.filter((r) => r.appShows).length, all.length)} |`);
  }
  return lines.join('\n');
}
function refusalTable(rows) {
  const codes = [...new Set(rows.map((r) => r.code))].sort();
  const lines = [`| peak period (bin) | hours | app shows today | ${codes.map((c) => `bypassed: ${c}`).join(' | ')} |`, `|---|---|---|${codes.map(() => '---').join('|')}|`];
  for (const b of BINS) { const a = rows.filter((r) => inBin(r.period, b)); lines.push(`| ${b[0]} | ${a.length} | ${pct(a.filter((r) => r.appShows).length, a.length)} | ${codes.map((c) => pct(a.filter((r) => r.code === c).length, a.length)).join(' | ')} |`); }
  return lines.join('\n');
}
const perGauge = (rows) => ['| gauge | 5-8 s n | 5-8 s median ours − gauge (ft) | 5-8 s ours / gauge | >=8 s n | >=8 s median ours − gauge (ft) | >=8 s ours / gauge |', '|---|---|---|---|---|---|---|', ...[...new Set(rows.map((r) => r.gauge))].map((g) => {
  const ok = rows.filter((r) => r.gauge === g && r.code === 'ok'), s = ok.filter((r) => r.period >= 5 && r.period < 8), l = ok.filter((r) => r.period >= 8);
  const rat = (a) => (a.filter((r) => r.gFt > 0.3).length ? (Math.round(median(a.filter((r) => r.gFt > 0.3).map((r) => r.central / r.gFt)) * 100) / 100).toFixed(2) : '–');
  return `| ${g} | ${s.length} | ${f1(median(s.map((r) => r.central - r.gFt)))} | ${rat(s)} | ${l.length} | ${f1(median(l.map((r) => r.central - r.gFt)))} | ${rat(l)} |`;
})].join('\n');
const perSrfSource = (rows) => ['| SRF office | 5-8 s n (zone-days) | 5-8 s inside / above / below | 5-8 s median ours − their mid (ft) | >=8 s n (zone-days) | >=8 s inside / above / below | >=8 s median ours − their mid (ft) |', '|---|---|---|---|---|---|---|', ...[...new Set(rows.map((r) => officeOf(r.zone)))].sort().map((o) => {
  const ok = rows.filter((r) => officeOf(r.zone) === o && r.code === 'ok'), s = ok.filter((r) => r.period >= 5 && r.period < 8), l = ok.filter((r) => r.period >= 8);
  const ibb = (a) => `${pct(a.filter((r) => r.mid >= r.lo && r.mid <= r.hi).length, a.length)} / ${pct(a.filter((r) => r.mid > r.hi).length, a.length)} / ${pct(a.filter((r) => r.mid < r.lo).length, a.length)}`, zd = (a) => new Set(a.map((r) => r.zone + r.date + r.source)).size;
  return `| ${o} | ${s.length} (${zd(s)}) | ${ibb(s)} | ${f1(median(s.filter((r) => !r.orLess).map((r) => r.mid - (r.lo + r.hi) / 2)))} | ${l.length} (${zd(l)}) | ${ibb(l)} | ${f1(median(l.filter((r) => !r.orLess).map((r) => r.mid - (r.lo + r.hi) / 2)))} |`;
})].join('\n');
function officeOf(zone) { return spots.find((s) => s.zone === zone)?.office ?? '?'; }

const srfCap = srf.filter((r) => r.source.startsWith('capture')), srfHind = srf.filter((r) => r.source === 'hindcast');
const dates = (rs, k) => { const d = rs.map((r) => r[k]).sort(); return d.length ? `${d[0]} to ${d[d.length - 1]}` : 'none'; };
const md = `# atlantic-8s run ${new Date().toISOString()}

Spots: ${spots.length} East Coast spots with minPeriod 8 and an orientation; SRF zones with captured products: ${[...srfZones].filter((z) => spots.some((s) => s.zone === z)).length} (${[...new Set(spots.filter((s) => srfZones.has(s.zone)).map((s) => s.office))].join(', ')}).
SRF products read: ${parsed.length} East Coast (${[...new Set(parsed.map((p) => p.office))].join(' ')}). Captures: ${[...captures.keys()].join(', ')}. Open-Meteo calls this run: ${omCalls}.

## SRF, captures (forecast as issued), local dates ${dates(srfCap, 'date')}
${srfTable(srfCap)}

## SRF, Open-Meteo past days (hindcast-like), local dates ${dates(srfHind, 'date')}
${srfTable(srfHind)}

## SRF, both inputs, by office
${perSrfSource(srf)}

## Gauges (Open-Meteo past ${GAUGE_PAST} days, spots within ${GAUGE_KM} km), hours ${gauge.length ? new Date(Math.min(...gauge.map((r) => r.t))).toISOString().slice(0, 13) + 'Z to ' + new Date(Math.max(...gauge.map((r) => r.t))).toISOString().slice(0, 13) + 'Z' : 'none'}
${gaugeTable(gauge)}

### Per gauge
${perGauge(gauge)}

Gauges used: ${gaugeUsed.map((x) => '\n- ' + x).join('')}

## What happens to each hour once the 8 s gate is bypassed (all spot-hours read, captures + hindcast SRF spots)
${refusalTable(refusals)}

## Excluded
${Object.entries(excluded).map(([k, v]) => `- ${v} x ${k}`).join('\n')}
`;
fs.writeFileSync(path.join(OUT, 'atlantic-8s.md'), md);
fs.writeFileSync(path.join(OUT, 'atlantic-8s-srf.json'), JSON.stringify(srf));
fs.writeFileSync(path.join(OUT, 'atlantic-8s-gauge.json'), JSON.stringify(gauge));
console.log(md);
