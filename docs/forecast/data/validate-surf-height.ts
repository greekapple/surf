// T-089: validation harness for the surf height and its range. Refresh: node --experimental-strip-types docs/forecast/data/validate-surf-height.ts [--no-archive]
// 1. BACKTEST (works today): what the wave models forecast N days ahead (Open-Meteo Marine "previous day N" fields) for the past 14 days, carried through our v1 chain (src/ocean/breakingEstimate.ts nearshoreFt) with the real range
//    (src/services/uncertainty.ts, no model-spread term), scored against two observations of the same quantity at the spot's MOP point:
//    (a) CDIP MOP nowcast Hs (a model that assimilates buoys, so NOT independent), and (b) the nearest deep-water NDBC buoy carried through the SAME transform to 10 m (independent).
// 2. FORWARD ARCHIVE: the live v2 headline (central, range, lead) for every v2 spot is appended compactly to docs/forecast/data/validation-archive.jsonl (one line per spot-hour-lead bucket) and scored against the MOP nowcast
//    once the hour has passed, so the live product's own numbers get evidence over time.
// Writes docs/forecast/VALIDATION.md.
import fs from 'node:fs';
import {normalizeNearshore} from '../../../src/ocean/nearshore.ts';
import {mopURL, assignedMopIds, assignmentFor} from '../../../src/ocean/mop.ts';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {marineURL, weatherURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {estimateBreaking} from '../../../src/ocean/breakingEstimate.ts';
import {breakingProfile} from '../../../src/ocean/localCalibration.ts';
import {intervalFor, LEAD_SKILL} from '../../../src/services/uncertainty.ts';
import {headlineSurf} from '../../../src/services/headlineSurf.ts';

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

type Row = {lead: number; spot: string; central: number; lo: number; hi: number; lo2: number; hi2: number; buoyId?: string; mop?: number; buoy?: number};
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
    const bu = bo?.get(vt), rb = bu ? estimateBreaking({swellHsFt: bu.hs * FT, periodS: bu.tp, directionDeg: ob.dp, combinedHsFt: bu.hs * FT, secondaryHsFt: null}, prof, s.orientation) : null;
    rows.push({lead: n, spot: s.id, central: r.nearshoreFt, lo: iv.loFt, hi: iv.hiFt, lo2: iv2.loFt, hi2: iv2.hiFt, mop: ob.hs, ...(rb && rb.ok ? {buoy: rb.nearshoreFt, buoyId: nb.b.id} : {})});
  }
}

const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
function score(rs: Row[], key: 'mop' | 'buoy') {
  const r = rs.filter((x) => typeof x[key] === 'number');
  return {n: r.length, cov2: r.filter((x) => x[key]! >= x.lo2 && x[key]! <= x.hi2).length / Math.max(1, r.length), cov: r.filter((x) => x[key]! >= x.lo && x[key]! <= x.hi).length / Math.max(1, r.length), medAbs: q(r.map((x) => Math.abs(x[key]! - x.central)), .5), medRel: Math.exp(q(r.map((x) => Math.abs(Math.log(x[key]! / x.central))), .5)) - 1, bias: q(r.map((x) => x[key]! / x.central), .5), width: q(r.map((x) => x.hi - x.lo), .5)};
}
const pc = (n: number) => (Number.isFinite(n) ? (100 * n).toFixed(0) + '%' : 'n/a'), f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : 'n/a'), f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a');
const line = (n: number, m: ReturnType<typeof score>) => `| ${n === 0 ? '0' : n + ' (Hs-error only)'} | ${m.n} | ${pc(m.cov)} | ${pc(m.cov2)} | ${f1(m.medAbs)} | ${pc(m.medRel)} | ${f2(m.bias)} | ${f1(m.width)} |`;
const tableFor = (rs: Row[], key: 'mop' | 'buoy') => LEADS.map((n) => line(n, score(rs.filter((x) => x.lead === n), key))).join('\n');
const head = '| lead (days) | n distinct hours | coverage, v1 range (incl. ±17% offshore step) | coverage, v2-style range (no step; what v2 spots show) | median abs error, ft | median rel. error | median obs ÷ central | median range width, ft |\n|---|---|---|---|---|---|---|---|';
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
      seen.add(key); out.push(JSON.stringify([retrieved.slice(0, 13), s.id, new Date(vt).toISOString().slice(0, 13), bucket, 'v2', Math.round(h.centralFt * 10) / 10, h.loFt, h.hiFt])); archived++;
    }
  }
  if (out.length) fs.appendFileSync(ARCH, out.join('\n') + '\n');
}
if (fs.existsSync(ARCH)) {
  const fr: Row[] = [];
  for (const l of fs.readFileSync(ARCH, 'utf8').split('\n').filter(Boolean)) {
    const [, spot, valid, bucket, , c, lo, hi] = JSON.parse(l), a = assignmentFor(spot), vt = Date.parse(valid + ':00:00Z'); if (!a || vt > now - HOUR) continue;
    const ob = nowcast[a.mopId]?.get(vt); if (ob) fr.push({lead: bucket / 24, spot, central: c, lo, hi, mop: ob.hs});
  }
  scoredFwd = fr.length ? `Matured entries so far: ${fr.length}.\n\n${head}\n${LEADS.map((n) => line(n, score(fr.filter((x) => x.lead === n), 'mop'))).join('\n')}` : 'No archived hour has matured yet (the archive starts today; rerun this script daily, entries mature as their hours pass).';
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

Buoy-derived vs MOP-nowcast surf height over the same hours (${both.length} hours): median |ln ratio| = ${f2(q(buoyVsMop, .5))} (about ${pc(Math.exp(q(buoyVsMop, .5)) - 1)}): the two observations themselves differ by that much, so errors smaller than this are not distinguishable.

## 2. Forward archive of the v2 headline (central and range WITHOUT the model-spread term or calibration) against the MOP nowcast: a MOP forecast scored against the MOP nowcast, i.e. the same model family, not reality
This run archived ${archived} new spot-hour-lead entries (buckets 0, 1, 3, 5 days, i.e. leads of 0 to 3 h, 18 to 24 h, 66 to 72 h and 114 to 120 h, 3-hourly valid times; one compact line [run hour UTC, spot, valid hour UTC, bucket hours, method, central ft, lo, hi]; the first run for a spot-hour-bucket wins). ${scoredFwd}

## Findings (stated plainly)
${findings}

## Reading this honestly
- Range design: half-width in ln units by lead (\`LEAD_SKILL\`: ${LEAD_SKILL.map((x) => x.toFixed(2)).join(', ')} for 0 to 7 days) from the deep-water buoy error of the wave MODELS, rounded outward to whole feet. The coverage above is the test of whether that carries over to the transformed nearshore height.
- Fourteen days of the feeds in one season (fewer usable hours, see section 1); the backtest scores the v1 chain, not the live v2 headline (until section 2 matures). The buoy conversion reuses the same transform, so it checks the offshore-forecast error, not the transform's physics (OB-BIAS-T076.md covers that).
- Whole-foot ranges have a 1-ft minimum width, which flatters coverage for very small heights; the 3 ft+ table removes most of that.
`;
fs.writeFileSync(new URL('../VALIDATION.md', import.meta.url), md);
console.log(md);
