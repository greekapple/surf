// T-089: validation harness for the surf height and its range. Refresh: node --experimental-strip-types docs/forecast/data/validate-surf-height.ts [--no-archive]
// 1. BACKTEST (works today): what the wave models forecast N days ahead (Open-Meteo Marine "previous day N" fields) for the past 14 days, carried through our v1 chain (src/ocean/breakingEstimate.ts nearshoreFt) with the real range
//    (src/services/uncertainty.ts, no model-spread term), scored against two observations of the same quantity at the spot's MOP point:
//    (a) CDIP MOP nowcast Hs (a model that assimilates buoys, so NOT independent), and (b) the nearest deep-water NDBC buoy carried through the SAME transform to 10 m (independent).
// 2. FORWARD ARCHIVE: the live v2 headline (central, range, lead) for every v2 spot is appended compactly to docs/forecast/data/validation-archive.jsonl (one line per spot-hour-lead bucket) and scored against the MOP nowcast
//    once the hour has passed, so the live product's own numbers get evidence over time.
// Writes docs/forecast/VALIDATION.md.
import fs from 'node:fs';
import {normalizeNearshore} from '../../../src/ocean/nearshore.ts';
import {mopURL, assignedMopIds, assignmentFor, mopPoint} from '../../../src/ocean/mop.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {marineURL, weatherURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {estimateBreaking} from '../../../src/ocean/breakingEstimate.ts';
import {breakingProfile} from '../../../src/ocean/localCalibration.ts';
import {intervalFor, LEAD_SKILL} from '../../../src/services/uncertainty.ts';
import {headlineSurf} from '../../../src/services/headlineSurf.ts';
import {surfBandFor, setsFactor, CONFIDENCE_HIGH_W, CONFIDENCE_MEDIUM_W} from '../../../src/services/surfBand.ts';
import {breakerType} from '../../../src/services/breaker.ts';
import {allSpots} from '../../../src/data/catalog.ts';

const FT = 1 / 0.3048, HOUR = 3600000, now = Date.now(), retrieved = new Date(now).toISOString(), LEADS = [0, 1, 3, 5];
const get = async (u: string, text = false) => { const r = await fetch(u, {signal: AbortSignal.timeout(90000)}); if (!r.ok) throw new Error(`${r.status} ${u.slice(0, 80)}`); return text ? r.text() : r.json(); };
const hourOf = (t: number) => Math.round(t / HOUR) * HOUR;
const BUOYS = [{id: '46026', lat: 37.75, lon: -122.84}, {id: '46042', lat: 36.78, lon: -122.4}, {id: '46054', lat: 34.27, lon: -120.45}, {id: '46025', lat: 33.75, lon: -119.05}, {id: '46086', lat: 32.5, lon: -118.0}];
const km = (a: number, b: number, c: number, d: number) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };

const buoyObs = new Map<string, Map<number, {hs: number; tp: number}>>();
for (const b of BUOYS) {
  try {
    const m = new Map<number, {hs: number; tp: number}>();
    for (const l of (await get(`https://www.ndbc.noaa.gov/data/realtime2/${b.id}.txt`, true) as string).split('\n').slice(2)) {
      const p = l.trim().split(/\s+/); if (p.length < 12 || p[8] === 'MM' || p[9] === 'MM') continue;
      const hs = +p[8], tp = +p[9]; if (!Number.isFinite(hs) || !Number.isFinite(tp)) continue;
      const tt = Date.UTC(+p[0], +p[1] - 1, +p[2], +p[3], +p[4]), hh = hourOf(tt), prev = (m as any).off?.get(hh); if (prev === undefined || Math.abs(tt - hh) < prev) { m.set(hh, {hs, tp}); ((m as any).off ??= new Map()).set(hh, Math.abs(tt - hh)); } // keep the reading nearest the hour
    }
    buoyObs.set(b.id, m);
  } catch { /* buoy unavailable */ }
}

type Obs = {hs: number; tp: number; dp: number};
const nowcast: Record<string, Map<number, Obs>> = {};
for (const id of assignedMopIds()) {
  try {
    const u = mopURL(id, 'nowcast', now).replace(/time_start=[^&]+/, 'time_start=' + encodeURIComponent(new Date(now - 15 * 86400000).toISOString()));
    const m = new Map<number, Obs>();
    for (const r of normalizeNearshore(await get(u, true), retrieved, 'mop', 'nowcast')) if (r.height.value !== null && r.period.value !== null && r.direction.value !== null && (r.qualityFlag === 1 || r.qualityFlag === undefined)) m.set(hourOf(Date.parse(r.timestamp)), {hs: r.height.value, tp: r.period.value, dp: r.direction.value});
    nowcast[id] = m;
  } catch { /* point unavailable */ }
}

type Row = {off?: number; kd?: number; shelter?: number; depth?: number; windFrac?: number; lead: number; spot: string; central: number; lo: number; hi: number; lo2: number; hi2: number; /** T-118: the surf band shown now (typical wave to the sets) and its confidence word. */ bLo?: number; bHi?: number; conf?: string; buoyId?: string; mop?: number; buoy?: number};
const rows: Row[] = [];
for (const s of evidenceSpots) {
  const a = assignmentFor(s.id), prof = breakingProfile(s.id); if (!a || !prof || s.orientation === null || !nowcast[a.mopId]) continue;
  const nb = BUOYS.map((b) => ({b, d: km(s.latitude, s.longitude, b.lat, b.lon)})).sort((x, y) => x.d - y.d)[0], bo = nb.d <= 250 ? buoyObs.get(nb.b.id) : undefined;
  const F = ['wave_height', 'swell_wave_height', 'swell_wave_period', 'swell_wave_direction'], f = (n: number) => (n === 0 ? F : ['wave_height']).map((x) => (n === 0 ? x : `${x}_previous_day${n}`)).join(','); // only TOTAL wave_height exists for earlier runs (the swell partition fields are null)
  let j: any; try { j = await get(`https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: String(s.marineLatitude), longitude: String(s.marineLongitude), hourly: LEADS.map(f).join(','), past_days: '14', forecast_days: '1', timezone: 'GMT', timeformat: 'unixtime'})}`); } catch { continue; }
  const t: number[] = j.hourly?.time ?? [];
  for (const n of LEADS) for (let i = 0; i < t.length; i++) {
    // lead 0: the model's own analysis hour. Lead N: the analysis chain with the swell scaled by (total Hs forecast N days earlier ÷ total Hs analysis), i.e. only the Hs forecast error is tested; period and direction come from the analysis.
    const hs0 = j.hourly.swell_wave_height?.[i], tp = j.hourly.swell_wave_period?.[i], dp = j.hourly.swell_wave_direction?.[i], tot0 = j.hourly.wave_height?.[i], totN = n === 0 ? tot0 : j.hourly[`wave_height_previous_day${n}`]?.[i];
    if (![hs0, tot0, totN].every((x) => typeof x === 'number') || tot0 <= 0 || totN <= 0) continue; const k = totN / tot0, hs = hs0 * k, tot = totN;
    const vt = hourOf(t[i] * 1000), ob = nowcast[a.mopId].get(vt);
    if (!ob || vt > now - HOUR || ![hs, tp, dp].every((x) => typeof x === 'number') || hs <= 0) continue;
    const r = estimateBreaking({swellHsFt: hs * FT, periodS: tp, directionDeg: dp, combinedHsFt: typeof tot === 'number' ? tot * FT : null, secondaryHsFt: null}, prof, s.orientation); if (!r.ok) continue;
    const iv = intervalFor({method: 'v1', centralFt: r.nearshoreFt, leadHours: n * 24, modelSpread: null})!, iv2 = intervalFor({method: 'mop-v2', centralFt: r.nearshoreFt, leadHours: n * 24, modelSpread: null})!;
    const spotType = allSpots.find((x) => x.id === s.id)?.type, brk = breakerType({id: s.id}, {primary: {height: hs * FT, period: tp, direction: dp}} as any), band = surfBandFor({centralFt: r.nearshoreFt, setsFactor: setsFactor(spotType, brk), halfWidth: iv2.halfWidth, disagree: false, interval: {loFt: iv2.loFt, hiFt: iv2.hiFt}});
    const bu = bo?.get(vt), rb = bu ? estimateBreaking({swellHsFt: bu.hs * FT, periodS: bu.tp, directionDeg: ob.dp, combinedHsFt: bu.hs * FT, secondaryHsFt: null}, prof, s.orientation) : null;
    rows.push({off: hs0 * FT, kd: r.kd, shelter: prof.shelter, depth: mopPoint(a.mopId)?.depthM, windFrac: tot0 / hs0, lead: n, spot: s.id, central: r.nearshoreFt, lo: iv.loFt, hi: iv.hiFt, lo2: iv2.loFt, hi2: iv2.hiFt, bLo: band.loFt, bHi: band.hiFt, conf: band.confidence, mop: ob.hs, ...(rb && rb.ok ? {buoy: rb.nearshoreFt, buoyId: nb.b.id} : {})});
  }
}

const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
function score(rs: Row[], key: 'mop' | 'buoy') {
  const r = rs.filter((x) => typeof x[key] === 'number'), rb = r.filter((x) => x.bLo !== undefined);
  const covB = rb.filter((x) => x[key]! >= x.bLo! && x[key]! <= x.bHi!).length / Math.max(1, rb.length), covB1 = rb.filter((x) => x[key]! >= x.bLo! - 1 && x[key]! <= x.bHi! + 1).length / Math.max(1, rb.length), below = rb.filter((x) => x[key]! < x.bLo!).length / Math.max(1, rb.length), above = rb.filter((x) => x[key]! > x.bHi!).length / Math.max(1, rb.length), bandWidth = q(rb.map((x) => x.bHi! - x.bLo!), .5);
  return {nb: rb.length, covB, covB1, below, above, bandWidth, n: r.length, cov2: r.filter((x) => x[key]! >= x.lo2 && x[key]! <= x.hi2).length / Math.max(1, r.length), cov: r.filter((x) => x[key]! >= x.lo && x[key]! <= x.hi).length / Math.max(1, r.length), medAbs: q(r.map((x) => Math.abs(x[key]! - x.central)), .5), medRel: Math.exp(q(r.map((x) => Math.abs(Math.log(x[key]! / x.central))), .5)) - 1, bias: q(r.map((x) => x[key]! / x.central), .5), width: q(r.map((x) => x.hi - x.lo), .5)};
}
const pc = (n: number) => (Number.isFinite(n) ? (100 * n).toFixed(0) + '%' : 'n/a'), f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : 'n/a'), f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a');
const line = (n: number, m: ReturnType<typeof score>) => `| ${n === 0 ? '0' : n + ' (Hs-error only)'} | ${m.n} | ${pc(m.cov)} | ${pc(m.cov2)} | ${f1(m.medAbs)} | ${pc(m.medRel)} | ${f2(m.bias)} | ${f1(m.width)} |`;
const tableFor = (rs: Row[], key: 'mop' | 'buoy') => LEADS.map((n) => line(n, score(rs.filter((x) => x.lead === n), key))).join('\n');
const head = '| lead (days) | n distinct hours | coverage, v1 range (incl. ±17% offshore step) | coverage, v2-style range (no step; what v2 spots show) | median abs error, ft | median rel. error | median obs ÷ central | median range width, ft |\n|---|---|---|---|---|---|---|---|';
const lineB = (n: number, m: ReturnType<typeof score>) => `| ${n === 0 ? '0' : n + ' (Hs-error only)'} | ${m.nb} | ${pc(m.covB)} | ${pc(m.covB1)} | ${pc(m.below)} | ${pc(m.above)} | ${f1(m.bandWidth)} |`;
const headB = '| lead (days) | n | observed inside the band | inside the band ± 1 ft | below the band | above the band | median band width, ft |\n|---|---|---|---|---|---|---|';
const tableB = (rs: Row[], key: 'mop' | 'buoy') => LEADS.map((n) => lineB(n, score(rs.filter((x) => x.lead === n), key))).join('\n');
const byConf = (rs: Row[], key: 'mop' | 'buoy') => ['high', 'medium', 'low'].map((c) => { const m = score(rs.filter((x) => x.conf === c), key); return `| ${c} | ${m.nb} | ${pc(m.covB)} | ${pc(m.covB1)} | ${f1(m.medAbs)} | ${pc(m.medRel)} |`; }).join('\n');
const cH = score(rows.filter((x) => x.conf === 'high'), 'mop'), cL = score(rows.filter((x) => x.conf === 'low'), 'mop'), cM = score(rows.filter((x) => x.conf === 'medium'), 'mop');
const confFinding = cH.nb && cL.nb && Math.abs(cH.covB - cL.covB) < 0.05 ? `**Finding: the word did not separate how often the observed height fell inside the band** (high ${pc(cH.covB)} vs low ${pc(cL.covB)}${cM.nb ? `, medium ${pc(cM.covB)}` : ', no medium rows at the tested leads of 0, 1, 3 and 5 days'}). The thresholds are our own judgement and the word is NOT validated; the leads of 1 day and more score the Hs error only (see section 1), which understates the difference between a short and a long lead. The surfaces and the tooltips say so.` : `The word separates the coverage here (high ${pc(cH.covB)}, low ${pc(cL.covB)}); that is one fortnight, so it is still a judgement, not a validation.`;
const big = rows.filter((r) => r.central >= 3), spots = new Set(rows.map((r) => r.spot)), buoySpots = new Set(rows.filter((r) => r.buoy !== undefined).map((r) => r.spot));
const both = rows.filter((r) => r.buoy !== undefined && r.mop !== undefined), buoyVsMop = both.map((r) => Math.abs(Math.log(r.buoy! / r.mop!)));

// forward archive: compact, one line per spot-hour-lead bucket: [run hour, spot, valid hour, bucket hours, method, central, lo, hi]
const ARCH = new URL('./validation-archive.jsonl', import.meta.url); let archived = 0, scoredFwd = '';
if (!process.argv.includes('--no-archive')) {
  const mop: Record<string, any> = {};
  for (const id of assignedMopIds()) { try { mop[id] = {mopId: id, records: normalizeNearshore(await get(mopURL(id, 'forecast', now), true), retrieved, 'mop', 'forecast'), issue: null, retrievedAt: retrieved, url: 'mop'}; } catch { /* skip */ } }
  const seen = new Set<string>(fs.existsSync(ARCH) ? fs.readFileSync(ARCH, 'utf8').split('\n').filter(Boolean).map((l) => { const a = JSON.parse(l); return `${a[1]}|${a[2]}|${a[3]}`; }) : []), out: string[] = [];
  for (const s of evidenceSpots) {
    if (!assignmentFor(s.id)) continue;
    let recs: any[]; try { recs = normalizeOpenMeteo(s, await get(marineURL(s)), await get(weatherURL(s)), retrieved).map(toLegacy); } catch { continue; }
    for (const f of recs) {
      const vt = hourOf(Date.parse(f.timestamp)), lead = (vt - now) / HOUR, bucket = [0, 24, 72, 120].find((b) => lead >= Math.max(0, b - 6) && lead <= b + (b === 0 ? 3 : 0));
      if (bucket === undefined || Math.round(vt / HOUR) % 3 !== 0) continue; // MOP forecast steps are 3-hourly: archive those hours only, to keep the file small
      const key = `${s.id}|${new Date(vt).toISOString().slice(0, 13)}|${bucket}`; if (seen.has(key)) continue;
      const h = headlineSurf(s.id, f, {bundle: {nearshore: [], mop}, nowMs: now, observations: [], felt: [], spread: null}) as any;
      if (h.kind !== 'estimate' || h.method !== 'mop-v2' || !Number.isFinite(h.centralFt)) continue;
      seen.add(key); out.push(JSON.stringify([retrieved.slice(0, 13), s.id, new Date(vt).toISOString().slice(0, 13), bucket, 'v2', Math.round(h.centralFt * 10) / 10, h.loFt, h.hiFt, h.interval?.loFt ?? null, h.interval?.hiFt ?? null])); archived++; // T-118: lo/hi are the surf BAND the app shows; the last two are the uncertainty interval it used to show (older entries have only lo/hi, which were that interval)
    }
  }
  if (out.length) fs.appendFileSync(ARCH, out.join('\n') + '\n');
}
// Finalise matured archive entries into an append-only scores file, so the evidence does not disappear when the hour leaves the 15-day nowcast window the next day (Codex P2).
// One line per spot-hour-bucket: [spot, valid hour UTC, bucket hours, central ft, lo, hi, MOP-nowcast Hs ft (0.1)]. The workflow commits it to the data branch with the archive.
const SCORES = new URL('./validation-scores.jsonl', import.meta.url); if (!fs.existsSync(SCORES)) fs.writeFileSync(SCORES, '');
const done = new Set<string>(fs.readFileSync(SCORES, 'utf8').split('\n').filter(Boolean).map((l) => { const a = JSON.parse(l); return `${a[0]}|${a[1]}|${a[2]}`; })), fresh: string[] = [];
if (fs.existsSync(ARCH)) for (const l of fs.readFileSync(ARCH, 'utf8').split('\n').filter(Boolean)) {
  const [, spot, valid, bucket, , c, lo, hi, ivLo, ivHi] = JSON.parse(l), a = assignmentFor(spot), vt = Date.parse(valid + ':00:00Z'), key = `${spot}|${valid}|${bucket}`;
  if (!a || vt > now - HOUR || done.has(key)) continue;
  const ob = nowcast[a.mopId]?.get(vt); if (!ob) continue; // no observation in the window yet (or ever): stays in the archive, scored if it appears
  done.add(key); fresh.push(JSON.stringify([spot, valid, bucket, c, lo, hi, Math.round(ob.hs * 10) / 10, ivLo ?? null, ivHi ?? null]));
}
if (fresh.length) fs.appendFileSync(SCORES, fresh.join('\n') + '\n');
{
  const fr: Row[] = [];
  for (const l of fs.readFileSync(SCORES, 'utf8').split('\n').filter(Boolean)) { const [spot, , bucket, c, lo, hi, obs, ivLo, ivHi] = JSON.parse(l), band = typeof ivLo === 'number'; fr.push({lead: bucket / 24, spot, central: c, lo: band ? ivLo : lo, hi: band ? ivHi : hi, lo2: band ? ivLo : lo, hi2: band ? ivHi : hi, ...(band ? {bLo: lo, bHi: hi} : {}), mop: obs}); } // entries from before T-118 stored the interval as lo/hi: they score as the interval only
  // archived ranges ARE the v2-style ranges (no step term, no model-spread term), so one coverage column is shown, not the backtest's two
  const lineF = (n: number, m: ReturnType<typeof score>) => `| ${n} | ${m.n} | ${pc(m.cov2)} | ${f1(m.medAbs)} | ${pc(m.medRel)} | ${f2(m.bias)} | ${f1(m.width)} |`;
  const headF = '| lead (days) | n | coverage, archived v2 uncertainty interval | median abs error, ft | median rel. error | median obs ÷ central | median interval width, ft |\n|---|---|---|---|---|---|---|';
  scoredFwd = fr.length ? `Matured entries so far: ${fr.length} (finalised in \`validation-scores.jsonl\`, which keeps them after the hour leaves the nowcast window; ${fr.filter((x) => x.bLo !== undefined).length} carry the surf band, the rest were archived before T-118 and score as the interval only).\n\n${headF}\n${LEADS.map((n) => lineF(n, score(fr.filter((x) => x.lead === n), 'mop'))).join('\n')}\n\nSurf band (entries archived since T-118):\n\n${headB}\n${tableB(fr.filter((x) => x.bLo !== undefined), 'mop')}` : 'No archived hour has matured yet (the archive starts today; rerun this script daily, entries mature as their hours pass).';
}

const a0 = score(rows.filter((x) => x.lead === 0), 'mop'), a5 = score(rows.filter((x) => x.lead === 5), 'mop'), b0 = score(rows.filter((x) => x.lead === 0), 'buoy'), bAll = score(rows, 'buoy'), mAll = score(rows, 'mop');
const hoursPerSpot = rows.filter((x) => x.lead === 0).length / Math.max(1, spots.size), buoyCounts = [...new Set(rows.map((r) => r.buoyId).filter(Boolean))].map((id) => `${id}: ${new Set(rows.filter((r) => r.buoyId === id).map((r) => r.spot)).size} spots`).join(', ');
const findings = [
  `- Coverage against the MOP nowcast at lead 0 is ${pc(a0.cov)} with the v1 range (which includes the ±17% offshore-to-10 m step) and ${pc(a0.cov2)} with the v2-style range (no step term), which is what spots with a MOP point actually show. At lead 5 days: ${pc(a5.cov)} / ${pc(a5.cov2)}. Against the buoy-derived value (all leads): ${pc(bAll.cov)} / ${pc(bAll.cov2)}. The range was designed around the central 80% of the wave-model error, so coverage above 80% means it is, if anything, wider than needed in this sample, and a v2-style coverage below 80% in a row would mean too narrow. These numbers do not contradict the range for this sample; they do not prove it.`,
  `- Sample size: ${hoursPerSpot.toFixed(0)} distinct hours per spot on average (the MOP nowcast quality filter and gaps leave far fewer than the 336 hours of 14 days), from ${spots.size} spots that share a few swell events and a handful of buoys, so the effective number of independent samples is small (a few events, not thousands of hours). No confidence interval is attached to the coverage figures.`,
  `- Median absolute error is flat across leads (${f1(a0.medAbs)} ft at 0 days, ${f1(a5.medAbs)} ft at 5). Partly this is an artefact of the reconstruction (leads 1 to 5 keep the analysis period and direction and scale only the Hs, which removes period and direction error), partly it is consistent with the spot transform and observation differences dominating in this fortnight. Coverage rising with lead is the range widening, not better forecasts.`,
  `- Relative to MOP, our central is about ${pc(1 / a0.bias - 1)} high (observed MOP is ${f2(a0.bias)} of it); relative to the buoy-derived value it is low (${f2(b0.bias)}). The two observations differ from each other by a median ${pc(Math.exp(q(buoyVsMop, .5)) - 1)}, which is bigger than the bias being discussed, so neither source can settle it. This is NOT reconciled with the Ocean Beach finding in src/services/uncertainty.ts (header: MOP ÷ v1 median 1.06, v1 about 6% low, 782 hours, t008-pairs.csv; OB-BIAS-T076.md reports MOP ÷ buoy 0.95). This table averages ${spots.size} spots with guide-derived shelter and window assumptions and uses post-T-081 total Hs; the cause of the opposite sign is unknown (a guess: those spot assumptions). Ocean Beach (spot-2) is in the table like any other spot.`,
  `- Not yet measured: the live v2 headline at lead (section 2 fills in as hours mature, and compares a MOP forecast with the MOP nowcast, i.e. the same model family, not with reality), and surfer-reported heights (T-059 calibration is the only source for that).`,
].join('\n');
// ---- reconciliation (T-090): is the bias spot-dependent, size-dependent, or a v1-vs-v2 chain difference? (lead 0 rows only: no forecast-lead mix)
const v2cmp: Record<string, number[]> = {};
for (const id of assignedMopIds()) { try { const fc = normalizeNearshore(await get(mopURL(id, 'forecast', now), true), retrieved, 'mop', 'forecast'); const arr: number[] = []; for (const r of fc) { const vt = hourOf(Date.parse(r.timestamp)), ob = nowcast[id]?.get(vt); if (ob && r.height.value && vt <= now - HOUR && vt >= now - 24 * HOUR) arr.push(ob.hs / r.height.value); } v2cmp[id] = arr; } catch { /* skip */ } }
const L0 = rows.filter((r) => r.lead === 0 && r.mop !== undefined), med = (a: number[]) => q(a, .5), lr = (a: number, b: number) => Math.log(a / b);
const corr = (xs: number[], ys: number[]) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy || 1); };
const y = L0.map((r) => lr(r.mop!, r.central));
const preds: [string, number[]][] = [['ln shelter factor', L0.map((r) => Math.log(r.shelter ?? 1))], ['MOP depth (10 vs 15 m)', L0.map((r) => r.depth ?? 0)], ['ln direction factor kd', L0.map((r) => Math.log(r.kd || 1))], ['ln total ÷ swell Hs (wind-sea share)', L0.map((r) => Math.log(r.windFrac || 1))], ['ln offshore swell Hs', L0.map((r) => Math.log(r.off || 1))]];
const sizeBins: [string, (c: number) => boolean][] = [['< 2 ft', (c) => c < 2], ['2 to 4 ft', (c) => c >= 2 && c < 4], ['4 to 7 ft', (c) => c >= 4 && c < 7], ['7 ft and up', (c) => c >= 7]];
const perSpot = [...new Set(L0.map((r) => r.spot))].map((id) => { const rs = L0.filter((r) => r.spot === id), a = assignmentFor(id)!; const bu = rs.filter((r) => r.buoy !== undefined); return {id, n: rs.length, mop: med(rs.map((r) => r.mop! / r.central)), buoy: bu.length ? med(bu.map((r) => r.buoy! / r.central)) : NaN, depth: rs[0].depth, shelter: rs[0].shelter, kd: med(rs.map((r) => r.kd ?? NaN)), central: med(rs.map((r) => r.central)), v2: med(v2cmp[a.mopId] ?? []), v2n: (v2cmp[a.mopId] ?? []).length}; }).sort((x, y2) => x.mop - y2.mop);
const v2all = Object.values(v2cmp).flat(), big20 = perSpot.filter((r) => r.n >= 20), ySpot = big20.map((r) => Math.log(r.mop)), spotCorr = (xs: number[]) => corr(xs, ySpot);
const nSpotsV2 = new Set(rows.map((r) => r.spot)).size;
const reconcile = `## 3. Reconciling the bias (lead 0 only, so no lead mix)
Correlation of ln(MOP nowcast ÷ our central) with candidate drivers. Pooled hours (${L0.length} spot-hours from ${perSpot.length} spots; hours are autocorrelated and spots with many hours dominate; depth has only two values and is confounded with region) and, more honestly, at the spot level (${big20.length} spots with at least 20 hours; Pearson r):

| driver | r, pooled hours | r, spot level (n = ${big20.length}) |
|---|---|---|
${preds.slice(0, 2).map(([n, x]) => `| ${n} | ${f2(corr(x, y))} | ${f2(spotCorr(n.startsWith('ln shelter') ? big20.map((r) => Math.log(r.shelter ?? 1)) : big20.map((r) => r.depth ?? 0)))} |`).join('\n')}
| ln direction factor kd | ${f2(corr(preds[2][1], y))} | ${f2(spotCorr(big20.map((r) => Math.log(r.kd || 1))))} |
| ln total ÷ swell Hs (wind-sea share) | ${f2(corr(preds[3][1], y))} | n/a |
| ln offshore swell Hs | ${f2(corr(preds[4][1], y))} | n/a |

The shelter row is constant (the default 1 for every guide-derived profile), so its r is not a measurement.

Median MOP ÷ central by size of the offshore model swell Hs (binned on neither side of the ratio, so no selection effect from the numerator or the denominator):

| offshore swell Hs | n | median MOP ÷ central |
|---|---|---|
${sizeBins.map(([n, fn]) => { const s2 = L0.filter((r) => fn(r.off ?? 0)); return `| ${n} | ${s2.length} | ${f2(med(s2.map((r) => r.mop! / r.central)))} |`; }).join('\n')}

The v2 chain (the live headline's centre is the MOP forecast): MOP nowcast ÷ MOP forecast over the last 24 h, ${v2all.length} points across ${Object.values(v2cmp).filter((a) => a.length).length} points: median ${f2(med(v2all))} (1.00 = unbiased). Limits: these are the past-hour values in the latest forecast file (not lead-verified: they may sit in the run's start or hindcast portion), one day, one run, strongly autocorrelated, at the MOP depth rather than the break. ${nSpotsV2} spots in the backtest use a MOP point, which is the chain the live headline shows there.

Per spot (sorted by MOP ÷ central; "v2 chk" = nowcast ÷ MOP forecast over the past 24 h, 8 values per MOP POINT, repeated for spots that share a point; n < 20 hours rows are shown but excluded from the range and counts below):

| spot | hours | MOP ÷ central | buoy-derived ÷ central | MOP depth m | shelter | mean kd | median central ft | v2 chk (n) |
|---|---|---|---|---|---|---|---|---|
${perSpot.map((r) => `| ${r.id} | ${r.n} | ${f2(r.mop)} | ${f2(r.buoy)} | ${r.depth ?? '?'} | ${r.shelter === 1 ? 'default 1' : r.shelter ?? '?'} | ${f2(r.kd)} | ${f1(r.central)} | ${f2(r.v2)} (${r.v2n}) |`).join('\n')}

**What the numbers say (indicative, not proven; sentences below are generated from the values above).**
- Lead 0 only, so forecast lead is not involved. MOP ÷ central varies by spot from ${f2(big20[0]?.mop ?? NaN)} to ${f2(big20[big20.length - 1]?.mop ?? NaN)} among spots with at least 20 hours (${big20.filter((r) => r.mop < 0.9).length} of ${big20.length} below 0.90, ${big20.filter((r) => r.mop > 1.1).length} above 1.10).
- Spot-level r: depth ${f2(spotCorr(big20.map((r) => r.depth ?? 0)))}, direction factor kd ${f2(spotCorr(big20.map((r) => Math.log(r.kd || 1))))} (n = ${big20.length}, pooled hours show ${f2(corr(preds[1][1], y))} and ${f2(corr(preds[2][1], y))}). Treat as hints: ${big20.length} spots, two depth values confounded with region. Every guide-derived profile uses shelter = 1, so the v1 chain has no island or headland shadowing term; whether that explains the pattern is untested.
- Ocean Beach (spot-2) reads ${f2(perSpot.find((r) => r.id === 'spot-2')?.mop ?? NaN)} here (n = ${perSpot.find((r) => r.id === 'spot-2')?.n}), versus a median 1.06 over 782 hours in T-008 (uncertainty.ts header). Different windows; the difference is unexplained, and the two findings are not reconciled. (OB-BIAS-T076.md compares the breaking height to MOP at 10 m and finds MOP ÷ buoy 0.95; this table compares surf height at 10 m to MOP at 10 m; those are different quantities.)
- The live v2 centre is the MOP forecast, not the v1 chain: the nowcast ran ${f2(med(v2all))} of the past-24 h forecast values (see the limits above; the forward archive will measure this over many days and leads). The MOP nowcast is initialised from buoy observations according to CDIP (see src/services/nearshoreSelect.ts), the forecast from the global wave model.
- Nothing in the estimator was changed on this evidence.
`;

const md = `# Surf-height validation (T-089)

Generated by \`docs/forecast/data/validate-surf-height.ts\` on ${retrieved.slice(0, 16)}Z. Refresh by rerunning it (it also appends today's live v2 headlines to \`validation-archive.jsonl\` and scores matured ones). Context for honesty, not a certification.

**What is scored.** The surf height we show is the nearshore significant wave height at the spot's 10 to 15 m depth (the surf-report convention, T-077) with a range built in \`src/services/uncertainty.ts\`. "Coverage" = how often the observed value fell inside the displayed whole-foot range; low coverage means the range is too narrow, very high coverage with a wide range means it is too wide. "Median abs error" is |observation − central|.

## 1. Backtest: what the models forecast N days ahead, past 14 days (${spots.size} spots with a MOP point and a breaking profile; ${rows.length} spot-hour-lead rows, i.e. ${(rows.length / 4).toFixed(0)} distinct spot-hours each scored at 4 leads; window = last 14 days of the feeds, fewer hours survive the MOP quality filter)
Forecast side: Open-Meteo Marine \`previous_dayN\` fields (what the model said N days earlier for that hour) through our v1 chain (offshore swell carried to 10 m by linear shoaling, total Hs); for leads of 1 day or more only the TOTAL wave height exists in the earlier runs, so the analysis swell is scaled by (total Hs forecast N days earlier ÷ total Hs analysis) (period and direction from the analysis) and the real range for that lead (no model-spread term, so slightly narrower than the app can show). The v2 live headline uses the MOP forecast as its centre; its own history only starts with the forward archive in section 2.

### 1a. Against the CDIP MOP nowcast Hs (a model that assimilates buoys; NOT independent)
${head}
${tableFor(rows, 'mop')}

Only forecast heights of 3 ft or more (${big.length} forecast-hours):

${head}
${tableFor(big, 'mop')}

### 1b. Against the nearest deep-water NDBC buoy carried through the SAME transform to 10 m (the semi-independent comparison; ${buoySpots.size} spots within 250 km of a buoy; ${buoyCounts})
Buoy Hs and peak period go through \`estimateBreaking(...).nearshoreFt\` with the spot's profile (direction BORROWED from the MOP nowcast, since the realtime buoy file has no swell direction, so it is not independent on direction; the nearest-buoy rule ignores island shadowing and swell windows, and 250 km is arbitrary), i.e. the observation is converted to the surf-height convention the same way the forecast is.

${head}
${tableFor(rows, 'buoy')}

### 1c. The surf band (T-118): what the main number now shows, against both observations
The headline range is no longer an uncertainty interval: it is the typical wave (the convention surf height, rounded down to whole feet) up to the sets (about 1.27 times that, a little by beach: point or reef breaks +0.04, a plunging breaker +0.05 or +0.025, a spilling one -0.04), snapped to Surfline's reporting widths (under 2 ft: 1 ft; 2 to 6: 1 to 2; 6 to 10: 2 to 3; 10 to 15: 3; 15 and up: 5). It describes "what you will see", not forecast error, so its coverage of a single observed value is EXPECTED to be lower than the interval's; the forecast uncertainty is the confidence word beside it. The band here uses the v2-style half-width (no offshore step, no model-spread term) for the confidence word, exactly like the live v2 headline. "Inside the band ± 1 ft" is the tolerance of one reporting step.

Against the CDIP MOP nowcast (the model that assimilates buoys; not independent):

${headB}
${tableB(rows, 'mop')}

Against the nearest buoy through the same transform:

${headB}
${tableB(rows, 'buoy')}

Does the confidence word carry information? Observed-inside-band and error by confidence word, against the MOP nowcast (all leads pooled; the word is high up to a half-width of ${CONFIDENCE_HIGH_W.toFixed(2)} (about the first three days of the measured lead table), medium up to ${CONFIDENCE_MEDIUM_W.toFixed(2)}, low beyond; this backtest has no model-spread term, so no row is low because of disagreement):

| confidence | n | inside the band | inside ± 1 ft | median abs error, ft | median rel. error |
|---|---|---|---|---|---|
${byConf(rows, 'mop')}

${confFinding}

Buoy-derived vs MOP-nowcast surf height over the same hours (${both.length} hours): median |ln ratio| = ${f2(q(buoyVsMop, .5))} (about ${pc(Math.exp(q(buoyVsMop, .5)) - 1)}): the two observations themselves differ by that much, so errors smaller than this are not distinguishable.

## 2. Forward archive of the v2 headline (central and range WITHOUT the model-spread term or calibration) against the MOP nowcast: a MOP forecast scored against the MOP nowcast, i.e. the same model family, not reality
This run archived ${archived} new spot-hour-lead entries (the archive file holds ${fs.existsSync(ARCH) ? fs.readFileSync(ARCH, 'utf8').split('\n').filter(Boolean).length : 0} in total) (buckets 0, 1, 3, 5 days, i.e. leads of 0 to 3 h, 18 to 24 h, 66 to 72 h and 114 to 120 h, 3-hourly valid times; one compact line [run hour UTC, spot, valid hour UTC, bucket hours, method, central ft, lo, hi]; the first run for a spot-hour-bucket wins). ${scoredFwd}

## Findings (stated plainly)
${findings}

${reconcile}
## Reading this honestly
- Range design: half-width in ln units by lead (\`LEAD_SKILL\`: ${LEAD_SKILL.map((x) => x.toFixed(2)).join(', ')} for 0 to 7 days) from the deep-water buoy error of the wave MODELS, rounded outward to whole feet. The coverage above is the test of whether that carries over to the transformed nearshore height.
- Fourteen days of the feeds in one season (fewer usable hours, see section 1); the backtest scores the v1 chain, not the live v2 headline (until section 2 matures). The buoy conversion reuses the same transform, so it checks the offshore-forecast error, not the transform's physics (OB-BIAS-T076.md covers that).
- Whole-foot ranges have a 1-ft minimum width, which flatters coverage for very small heights; the 3 ft+ table removes most of that.
`;
fs.writeFileSync(new URL('../VALIDATION.md', import.meta.url), md);
console.log(md);
