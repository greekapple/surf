// T-131 phase 2: our surf heights against REAL observations (wave buoys), per spot. Public data only, no keys.
// Run: node --experimental-strip-types docs/forecast/data/accuracy-vs-buoys.ts [--archive 2025-11-01T00:00:00Z/2026-05-01T00:00:00Z] [--recent 2026-10-07T00:00:00Z/2026-11-06T00:00:00Z] [--out docs/forecast/ACCURACY-VS-BUOYS.md]
// Two windows: ARCHIVE (CDIP's QC'd `_historic` buoy files, 6 winter-spring months, so a factor can be fitted and tested) and RECENT (the last 30 days of
// realtime buoy files). For each spot: the nearest OBSERVING buoy with data in that window (src/services/accuracy.ts; metadata read from each buoy's
// CDIP/NDBC file), and for the same hours
//   (a) our v1 estimate at the spot (Open-Meteo Marine hours for the window through the app's own normaliser and headlineSurf),
//   (b) CDIP MOP at the spot's assigned point (the NOWCAST file: MOP driven by measured offshore buoy spectra; the app's forward MOP forecast has no
//       public archive, so this is an upper bound on what the MOP headline achieved),
//   (c) MOP at the BUOY's own site (CDIP MOP_validation BP<id> nowcast): the clean model-vs-observation check.
// The buoy is not at the spot, so (a) and (b) mix model error with the real difference between two places. Hence also
//   (d) the observation carried to the spot's MOP point by MOP's own hourly ratio point ÷ buoy site ("observation-anchored": model-assisted, NOT a
//       measurement at the spot), only where (c) shows MOP is right at that buoy in that window.
// Held-out rule (CORRECTION_RULE): a per-spot factor is fitted on the first 2/3 of the ARCHIVE hours, reported on the last 1/3, and then applied
// unchanged to the RECENT window (a second, later, held-out test).
// Writes the markdown report (keeping anything after the `<!-- notes -->` marker) and docs/forecast/data/accuracy-vs-buoys.json for the step-2 scorecard.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {allSpots} from '../../../src/data/catalog.ts';
import {assignmentFor} from '../../../src/ocean/mop.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {marineURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {headlineSurf} from '../../../src/services/headlineSurf.ts';
import {OBSERVING_BUOYS, NEARSHORE_MAX_DEPTH_M, nearestBuoy, distanceKm, buoyFeedURL, parseCdipSeries, parseNdbcSeries, pairSeries, score, regimesCovered, trialCorrection, sameWaveClimate, CORRECTION_RULE, checkBins, SIZE_BINS, BIN_RULE, binLabel, splitByTime, type BinCheck,
  type HourSeries, type ObservingBuoy, type Score, type Pair, type CorrectionTrial} from '../../../src/services/accuracy.ts';

const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const HOUR = 3600000, range = (s: string) => s.split('/').map((x) => Math.floor(Date.parse(x) / HOUR) * HOUR) as [number, number];
const WIN = {archive: range(arg('--archive', '2025-11-01T00:00:00Z/2026-05-01T00:00:00Z')), recent: range(arg('--recent', '2026-10-07T00:00:00Z/2026-11-06T00:00:00Z'))};
const OUT = arg('--out', 'docs/forecast/ACCURACY-VS-BUOYS.md'), JSON_OUT = 'docs/forecast/data/accuracy-vs-buoys.json';
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z'), day = (t: number) => iso(t).slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Optional download cache for re-runs (ACC_CACHE=<dir>): the same public responses, stored verbatim; never committed. */
const CACHE = process.env.ACC_CACHE ?? null, cacheFile = (u: string) => `${CACHE}/${createHash('sha1').update(u).digest('hex')}.txt`;
async function get(u: string, tries = 3): Promise<string | null> {
  if (CACHE && fs.existsSync(cacheFile(u))) return fs.readFileSync(cacheFile(u), 'utf8');
  for (let i = 0; i < tries; i++) { try { const r = await fetch(u, {signal: AbortSignal.timeout(120000)}); if (r.ok) { const t = await r.text(); if (CACHE) { fs.mkdirSync(CACHE, {recursive: true}); fs.writeFileSync(cacheFile(u), t); } return t; } if (r.status === 404 || r.status === 400) return null; } catch { /* retry */ } await sleep(2000 * (i + 1)); }
  return null;
}
const ncss = (path: string, [s, e]: [number, number]) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/${path}?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: iso(s), time_end: iso(e), accept: 'csv'});
const mopNowcastURL = (id: string, w: [number, number]) => ncss(`model/${/^BP/.test(id) ? 'MOP_validation' : 'MOP_alongshore'}/${id}_nowcast.nc`, w);
const clip = (s: HourSeries, [a, b]: [number, number]) => new Map([...s].filter(([t]) => t >= a && t <= b));
const hsOnly = (s: HourSeries) => new Map([...s].map(([t, v]) => [t, v.hs]));
/** MOP is "right at the buoy" in a window when its bias is within 0.5 ft and its MAE under 1 ft over at least 200 hours (our threshold). */
const MOP_OK = {bias: 0.5, mae: 1.0, n: 200}, MIN_OBS_HOURS = 200;

type Win = 'archive' | 'recent';
interface BuoyRow {buoy: ObservingBuoy; nObs: number; c: Score | null; cPairs: Pair[]; bpKm: number | null; ok: boolean}
/** (d) is built only from a buoy within this distance of the spot (our judgement: beyond it MOP's own transfer does all the work). */
const ANCHOR_KM = 40;
interface SpotRow {id: string; name: string; mopId: string | null; buoy: ObservingBuoy | null; km: number | null; relation: string | null; a: Score | null; b: Score | null; d: Score | null; dApp: Score | null; anchor: {id: string; km: number} | null; mm: Score | null; ratio: number | null; regimes: string; anchorPairs: Map<string, {raw: OffPair[]; app: Pair[]; km: number}>; bPairs: Pair[]}
type OffPair = Pair & {off: number};
const mopCache = new Map<string, HourSeries>();

async function runWindow(win: Win) {
  const w = WIN[win], obs = new Map<string, HourSeries>(), bp = new Map<string, HourSeries>();
  for (const x of OBSERVING_BUOYS) {
    const u = buoyFeedURL(x, win, iso(w[0]), iso(w[1])); if (!u) continue;
    const t = await get(u); const s = t ? clip(/ndbc\.noaa/.test(u) ? parseNdbcSeries(t) : parseCdipSeries(t), w) : new Map(); if (s.size < MIN_OBS_HOURS) { console.log(`${win} buoy ${x.id}: ${s.size} h, skipped`); continue; }
    obs.set(x.id, s);
    if (x.mopPoint) { const m = await get(mopNowcastURL(x.mopPoint.id, w)); bp.set(x.id, m ? clip(parseCdipSeries(m), w) : new Map()); }
    console.log(`${win} buoy ${x.id} ${x.name}: ${s.size} obs h, BP ${bp.get(x.id)?.size ?? '-'} h`);
  }
  const withData = OBSERVING_BUOYS.filter((x) => obs.has(x.id));
  const buoyRows: BuoyRow[] = withData.map((x) => {
    // "MOP right here" is judged on the FIRST 2/3 of the window's hours only (the fit hours), so the held-out hours never decide which anchors are used
    const cPairs = pairSeries(obs.get(x.id)!, hsOnly(bp.get(x.id) ?? new Map())), c = score(cPairs), cf = score(splitByTime(cPairs).fit);
    return {buoy: x, nObs: obs.get(x.id)!.size, c, cPairs, bpKm: x.mopPoint ? distanceKm(x.lat, x.lon, x.mopPoint.lat, x.mopPoint.lon) : null, ok: !!cf && cf.n >= MOP_OK.n && Math.abs(cf.biasFt) <= MOP_OK.bias && cf.maeFt <= MOP_OK.mae};
  });
  const ok = (id: string) => buoyRows.find((r) => r.buoy.id === id)?.ok ?? false;
  const spotRows: SpotRow[] = [];
  for (const spot of allSpots) {
    const ev = evidenceSpot(spot.id), a = assignmentFor(spot.id), near = nearestBuoy(ev.latitude, ev.longitude, withData);
    const key = `${win}|${a?.mopId}`; if (a && !mopCache.has(key)) { const t = await get(mopNowcastURL(a.mopId, w)); mopCache.set(key, t ? clip(parseCdipSeries(t), w) : new Map()); }
    const sp = a ? mopCache.get(key)! : new Map<number, {hs: number}>();
    // v1 at the spot: Open-Meteo Marine hours for the window (archived best-match runs), through the app's own chain
    const span = win === 'recent' ? `forecast_days=1&past_days=${Math.min(92, Math.ceil((Date.now() - w[0]) / 86400000) + 1)}` : `start_date=${day(w[0])}&end_date=${day(w[1])}`;
    // v = v1 BEFORE any buoy-transfer correction (what the method itself says); vApp = what the app shows now (with the T-131 correction where one exists)
    const t = await get(marineURL(ev).replace('forecast_days=7', span)), v = new Map<number, number>(), vApp = new Map<number, number>(), off = new Map<number, number>();
    if (t) for (const r of normalizeOpenMeteo(ev, JSON.parse(t), null, iso(w[1]))) {
      const ts = Date.parse(r.timestamp); if (ts < w[0] || ts > w[1]) continue;
      const h = headlineSurf(spot.id, toLegacy(r), {bundle: null, nowMs: ts, observations: [], felt: [], spread: null}) as any;
      if (h.kind === 'estimate' && h.method === 'v1' && Number.isFinite(h.centralFt)) { const fe = r.faceEstimate as any; vApp.set(ts, h.centralFt); v.set(ts, fe?.transfer ? fe.transfer.uncorrectedFt : h.centralFt); if (Number.isFinite(r.offshore.value)) off.set(ts, r.offshore.value!); }
    }
    await sleep(300);
    const mm = score([...v].flatMap(([ts, x]) => (sp.has(ts) ? [{obs: sp.get(ts)!.hs, model: x}] : [])));
    // (d) anchors: every buoy within ANCHOR_KM where MOP is right at the buoy in this window; the table shows the nearest one
    const anchorPairs = new Map<string, {raw: OffPair[]; app: Pair[]; km: number}>();
    for (const x of withData) {
      const km = distanceKm(ev.latitude, ev.longitude, x.lat, x.lon); if (km > ANCHOR_KM || !ok(x.id) || !a) continue;
      const o = obs.get(x.id)!, bps = bp.get(x.id)!, anchored: HourSeries = new Map();
      for (const [ts, y] of o) { const p = sp.get(ts)?.hs, q = bps.get(ts)?.hs; if (p !== undefined && q !== undefined && q > 0.15) anchored.set(ts, {hs: y.hs * p / q, tp: y.tp, dp: y.dp}); }
      anchorPairs.set(x.id, {raw: pairSeries(anchored, v).flatMap((p) => (off.has(p.t) ? [{...p, off: off.get(p.t)!}] : [])), app: pairSeries(anchored, vApp), km});
    }
    const anchor = [...anchorPairs].filter(([, p]) => p.raw.length).sort((p, q) => p[1].km - q[1].km)[0] ?? null;
    if (!near) { spotRows.push({id: spot.id, name: spot.name, mopId: a?.mopId ?? null, buoy: null, km: null, relation: null, a: null, b: null, d: null, dApp: null, anchor: null, mm, ratio: null, regimes: '–', anchorPairs, bPairs: []}); continue; }
    const o = obs.get(near.buoy.id)!, bps = bp.get(near.buoy.id) ?? new Map(), aP = pairSeries(o, v), bP = pairSeries(o, hsOnly(sp));
    const ratios = [...sp].flatMap(([ts, x]) => (bps.get(ts)?.hs ? [x.hs / bps.get(ts)!.hs] : [])).sort((p, q) => p - q);
    spotRows.push({id: spot.id, name: spot.name, mopId: a?.mopId ?? null, buoy: near.buoy, km: near.km, relation: near.relation, a: score(aP), b: score(bP), d: anchor ? score(anchor[1].raw) : null, dApp: anchor ? score(anchor[1].app) : null,
      anchor: anchor ? {id: anchor[0], km: anchor[1].km} : null, mm, ratio: ratios.length ? ratios[ratios.length >> 1] : null, regimes: regimeText(bP.length ? bP : aP), anchorPairs, bPairs: bP});
  }
  return {buoyRows, spotRows};
}
const regimeText = (p: Pair[]) => regimesCovered(p).map((r) => `${r.regime} ${r.n}`).join(', ') || '–';

const archive = await runWindow('archive'), recent = await runWindow('recent');

// ---------- held-out trials: fit on the first 2/3 of the archive, report on the last 1/3, then apply unchanged to the recent window ----------
/** The recent window confirms a factor when it has at least this many anchored hours and the factor does not make its MAE worse. */
const RECENT_MIN = 50;
interface Trial {spot: SpotRow; what: string; t: CorrectionTrial; recentAnchor: string | null; recentBefore: Score | null; recentAfter: Score | null; bins: BinCheck[] | null; verdict: 'supported' | 'archive only' | 'contradicted' | 'not supported'}
const trials: Trial[] = [];
for (const s of archive.spotRows) {
  const r = recent.spotRows.find((x) => x.id === s.id)!;
  const add = (what: string, arch: Pair[], rec: Pair[], recentAnchor: string | null) => {
    const t = trialCorrection(arch), recentBefore = score(rec), recentAfter = t.ratio && t.after ? score(rec.map((p) => ({obs: p.obs, model: p.model * t.ratio!}))) : null;
    // size bins (v1 trials only: they carry the offshore Hs): the factor is kept only in bins where it holds on held-out hours and the later window
    const bins = t.accepted && t.ratio && arch.every((p) => 'off' in p) ? checkBins(splitByTime(arch as OffPair[]).test, rec as OffPair[], t.ratio) : null;
    const v0 = !t.accepted ? 'not supported' : !recentBefore || recentBefore.n < RECENT_MIN || !recentAfter ? 'archive only' : recentAfter.maeFt <= recentBefore.maeFt ? 'supported' : 'contradicted';
    const verdict = v0 === 'supported' && bins && !bins.some((b) => b.holds) ? 'not supported' : v0;
    trials.push({spot: s, what, t, recentAnchor, recentBefore, recentAfter, bins, verdict});
  };
  if (s.anchor) {
    const same = r.anchorPairs.get(s.anchor.id), recentAnchor = same?.raw.length ? s.anchor.id : r.anchor?.id ?? null;
    add(`v1 vs (d), anchor ${s.anchor.id}`, s.anchorPairs.get(s.anchor.id)!.raw, recentAnchor ? r.anchorPairs.get(recentAnchor)!.raw : [], recentAnchor);
  }
  if (s.relation === 'co-located' && sameWaveClimate(s.ratio) && s.bPairs.length) add('MOP point vs buoy', s.bPairs, r.buoy?.id === s.buoy?.id ? r.bPairs : [], r.buoy?.id === s.buoy?.id ? s.buoy!.id : null);
}

// ---------- report ----------
const f1 = (n?: number | null) => (n === undefined || n === null || !Number.isFinite(n) ? '–' : n.toFixed(1));
const f2 = (n?: number | null) => (n === undefined || n === null || !Number.isFinite(n) ? '–' : n.toFixed(2));
const sgn = (n?: number | null) => (n === undefined || n === null || !Number.isFinite(n) ? '–' : (n >= 0 ? '+' : '') + n.toFixed(1));
const cell = (s: Score | null) => (s ? `${s.n} | ${sgn(s.biasFt)} | ${f1(s.maeFt)}` : '0 | – | –');
const buoyTable = (rows: BuoyRow[]) => rows.map((r) => `| ${r.buoy.id}${r.buoy.ndbc ? ` (NDBC ${r.buoy.ndbc})` : ''} | ${r.buoy.name} | ${r.buoy.lat.toFixed(4)}, ${r.buoy.lon.toFixed(4)} | ${r.buoy.depthM} m | ${r.buoy.mopPoint ? `${r.buoy.mopPoint.id}, ${r.bpKm!.toFixed(1)} km` : '–'} | ${r.nObs} | ${cell(r.c)} | ${r.c ? f2(r.c.medianRatio) : '–'} | ${regimeText(r.cPairs)} | ${r.ok ? '**yes**' : r.c ? 'no' : 'no QC-good MOP hours'} |`).join('\n');
const dApp = (r: SpotRow) => (r.dApp && r.d && Math.abs(r.dApp.meanModelFt - r.d.meanModelFt) > 1e-9 ? `${sgn(r.dApp.biasFt)} / ${f1(r.dApp.maeFt)}` : 'same');
const spotTable = (rows: SpotRow[]) => rows.map((r) => `| ${r.name} | ${r.mopId ?? '–'} | ${r.buoy ? `${r.buoy.id} ${r.buoy.name} (${r.buoy.depthM} m)` : 'none with data within 80 km'} | ${f1(r.km)} | ${r.relation ?? '–'} | ${cell(r.a)} | ${cell(r.b)} | ${f2(r.ratio)} | ${r.anchor ? `${r.anchor.id} (${r.anchor.km.toFixed(0)} km)` : '–'} | ${cell(r.d)} | ${r.d ? dApp(r) : '–'} | ${r.mm ? `${r.mm.n} | ${sgn(r.mm.biasFt)}` : '0 | –'} | ${r.regimes} |`).join('\n');
const trialTable = trials.map(({spot, what, t, recentAnchor, recentBefore, recentAfter, verdict}) => `| ${spot.name} | ${what} | ${t.fit?.n ?? 0} | ${t.before?.n ?? 0} | ${f2(t.ratio)} | ${t.before ? `${sgn(t.before.biasFt)} / ${f1(t.before.maeFt)}` : '–'} | ${t.after ? `${sgn(t.after.biasFt)} / ${f1(t.after.maeFt)}` : '–'} | ${recentBefore ? `${recentAnchor}, ${recentBefore.n} h: ${sgn(recentBefore.biasFt)} / ${f1(recentBefore.maeFt)}` : '–'} | ${recentAfter ? `${sgn(recentAfter.biasFt)} / ${f1(recentAfter.maeFt)}` : '–'} | ${verdict === 'supported' ? '**supported**' : verdict}: ${t.reason} |`).join('\n');
// section 4 bins by the OBSERVED height at the buoy (not by MOP's own value, which would bias the ratio toward the model's errors)
const binCell = (r: BuoyRow, [a, b]: [number, number]) => { const x = r.cPairs.filter((p) => p.obs >= a && p.obs < b).map((p) => p.obs / p.model).sort((u, v) => u - v); return x.length >= 12 ? `${x[x.length >> 1].toFixed(2)} (${x.length} h)` : `– (${x.length} h)`; };
const binTable = archive.buoyRows.filter((r) => r.c).map((r) => `| ${r.buoy.id} ${r.buoy.name} | ${r.buoy.depthM} m | ${SIZE_BINS.map((bn) => binCell(r, bn)).join(' | ')} |`).join('\n');
const sizeTable = trials.filter((x) => x.bins).flatMap(({spot, t, bins}) => bins!.map((b) => `| ${spot.name} | ×${f2(t.ratio)} | ${binLabel(b.bin)} | ${b.n} | ${b.before ? `${sgn(b.before.biasFt)} / ${f1(b.before.maeFt)}` : '–'} | ${b.after ? `${sgn(b.after.biasFt)} / ${f1(b.after.maeFt)}` : '–'} | ${b.recentN} | ${b.recentBefore ? `${sgn(b.recentBefore.biasFt)} / ${f1(b.recentBefore.maeFt)}` : '–'} | ${b.recentAfter ? `${sgn(b.recentAfter.biasFt)} / ${f1(b.recentAfter.maeFt)}` : '–'} | ${b.holds ? '**factor applies**' : `no factor: ${b.reason}`} |`)).join('\n');
const head1 =`| buoy | name | position | depth | MOP check point, distance from buoy | observed hours | n | MOP bias, ft | MOP MAE, ft | median obs ÷ MOP | regimes covered | MOP right here? |\n|---|---|---|---|---|---|---|---|---|---|---|---|`;
const head2 = `| spot | MOP point | nearest buoy with data | km | relation | (a) n | (a) v1 bias | (a) v1 MAE | (b) n | (b) MOP bias | (b) MOP MAE | MOP point ÷ buoy site | (d) anchor buoy | (d) n | (d) v1 bias | (d) v1 MAE | (d) as the app shows v1 now: bias / MAE | v1 vs MOP n | v1 − MOP | regimes covered |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`;
const md = `# Accuracy against real buoys (T-131 phase 2)

Generated ${new Date().toISOString().slice(0, 16)}Z by \`docs/forecast/data/accuracy-vs-buoys.ts\`. Reproduce: \`node --experimental-strip-types docs/forecast/data/accuracy-vs-buoys.ts --archive ${iso(WIN.archive[0])}/${iso(WIN.archive[1])} --recent ${iso(WIN.recent[0])}/${iso(WIN.recent[1])}\`. Rules and thresholds: \`src/services/accuracy.ts\`. Findings and decisions: the notes at the end.

Windows: **archive** ${day(WIN.archive[0])} to ${day(WIN.archive[1])} (CDIP's quality-controlled \`_historic\` buoy files; 6 winter-spring months) and **recent** ${day(WIN.recent[0])} to ${day(WIN.recent[1])} (CDIP realtime files, NDBC realtime2 for Point Sur). A buoy needs at least ${MIN_OBS_HOURS} observed hours in a window to be used; each spot uses the nearest such buoy, preferring a nearshore one within 40 km.

**What each number is.**
- **Observed** = a wave buoy's measured significant height (Hs): CDIP file (primary QC flag 1) or NDBC realtime2, the sample ON the hour only (no averaging, no filling, nothing interpolated).
- **(a) v1** = **model estimate**: our offshore-swell estimate at the spot (Open-Meteo Marine hours for the window, i.e. each hour's own short-range model run, through the app's normaliser and \`headlineSurf\`; v1 refuses out-of-window or short-period hours, so it has fewer hours).
- **(b) MOP point** = **model**: CDIP MOP nowcast at the spot's assigned point (MOP driven by measured offshore buoy spectra; the app shows MOP's forward forecast, which has no public archive, so this is an upper bound on what the MOP headline achieved).
- **(c) MOP at the buoy** = **model**: CDIP's MOP_validation point for that buoy (\`BP<id>\`), the clean model-vs-observation check.
- **(d) observation-anchored** = **our correction of an observation, model-assisted**: the buoy's observed Hs × MOP's own hourly ratio (spot point ÷ buoy site). Used only where (c) shows MOP is right at that buoy in that window (|bias| ≤ ${MOP_OK.bias} ft, MAE ≤ ${MOP_OK.mae} ft, at least ${MOP_OK.n} hours: our threshold). Not a measurement at the spot.
- Bias = mean(model − observed) in ft: **positive means the model reads high**. MAE = mean absolute error, ft. Regimes = observed peak direction (S < 225°, W 225–292.5°, NW ≥ 292.5°) and period (short < 10 s, mid 10–14 s, long ≥ 14 s); regimes with at least 12 hours shown.
- Buoy relation (our judgement): **co-located** = nearshore buoy (≤ ${NEARSHORE_MAX_DEPTH_M} m) within 5 km; **nearby** = nearshore within 25 km; **regional** = farther or deep water. A buoy-vs-spot gap at a nearby or regional buoy is partly a real difference between two places; the "MOP point ÷ buoy site" column says how large MOP thinks that difference is (1.00 = the same).

## 1. MOP against the buoys themselves (c)

### Archive window
${head1}
${buoyTable(archive.buoyRows)}

### Recent window
${head1}
${buoyTable(recent.buoyRows)}

## 2. Per spot: our numbers against the nearest observing buoy

Columns: (a) v1 vs observed; (b) MOP at the spot's point vs observed; MOP's own median ratio spot point ÷ buoy site; (d) v1 vs the observation-anchored height at the spot's point, built from the nearest buoy within ${ANCHOR_KM} km where MOP is right (which can differ from the nearest buoy); then the same for v1 as the app shows it now (with the T-131 buoy-transfer factor where one is applied: "same" = no factor at this spot; the archive figure includes the hours the factor was fitted on, section 3 has the held-out numbers); v1 − MOP over the same hours (model vs model, for comparison with SPOT-HEIGHTS-WEEK.md). (a), (d) and v1 − MOP use v1 BEFORE any factor.

### Archive window
${head2}
${spotTable(archive.spotRows)}

### Recent window
${head2}
${spotTable(recent.spotRows)}

## 3. Held-out trials of a per-spot factor

Fit on the first 2/3 of the archive hours (median observed ÷ model), reported on the last 1/3 of the archive, then applied unchanged to the recent window (same anchor buoy when it has recent data, else the recent window's own anchor, named). Verdict: **supported** = clears the rule on the archive held-out hours AND does not worsen the recent window's MAE (at least ${RECENT_MIN} recent hours); **archive only** = clears the rule but the recent window has too few anchored hours to confirm; **contradicted** = clears the archive rule but makes the recent window worse; **not supported** = does not clear the rule. Rule (\`CORRECTION_RULE\`, our judgement): at least ${CORRECTION_RULE.minFit} fit and ${CORRECTION_RULE.minTest} held-out hours, at least ${CORRECTION_RULE.minRegimes} swell regimes in the fit window, a factor at least ${CORRECTION_RULE.minRatioOffset * 100}% from 1, and a held-out MAE that improves by at least ${CORRECTION_RULE.minGain * 100}% and ${CORRECTION_RULE.minGainFt} ft. "MOP point vs buoy" is tried only at a co-located buoy that MOP says sees the same waves (point ÷ buoy site 0.9–1.1). Clearing the rule is evidence; what the app does with it is in the notes.

| spot | what is corrected | fit n | held-out n | factor | archive held-out bias / MAE before, ft | after, ft | recent n: bias / MAE before | recent after | outcome |
|---|---|---|---|---|---|---|---|---|---|
${trialTable}

### 3b. Each supported factor by wave size

Held-out archive hours and the later window, binned by the OFFSHORE total Hs at the spot's marine point (Open-Meteo, the height v1 starts from, so the app can pick the bin at run time). Bias / MAE in ft, v1 before and after the factor, against the observation-anchored height. Rule (\`BIN_RULE\`): the factor is applied only in a bin with at least ${BIN_RULE.minN} held-out hours whose MAE gets smaller and whose later-window MAE (when it has ${BIN_RULE.minN} hours or more) does not get worse; in every other bin v1 is shown uncorrected.

| spot | factor | offshore Hs bin | held-out n | before | after | later n | before | after | outcome |
|---|---|---|---|---|---|---|---|---|---|
${sizeTable}

## 4. MOP at the buoy by wave height (archive window)

Median observed ÷ MOP at the buoy's own site, binned by the OBSERVED height at the buoy (a bin needs 12 hours). A ratio falling below 1 as the waves grow means the buoy measured less than the model in big surf: at a shallow site this is consistent with waves breaking before the buoy (MOP propagates swell linearly and has no surf-zone breaking), though other explanations are not ruled out.

| buoy | depth | under 4 ft | 4–8 ft | 8–12 ft | 12 ft and up |
|---|---|---|---|---|---|
${binTable}
`;
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '', notes = prev.includes('<!-- notes -->') ? '\n' + prev.slice(prev.indexOf('<!-- notes -->')) : '';
fs.writeFileSync(OUT, md + notes);
const slim = (s: Score | null) => (s ? {n: s.n, biasFt: +s.biasFt.toFixed(2), maeFt: +s.maeFt.toFixed(2), meanObsFt: +s.meanObsFt.toFixed(2), meanModelFt: +s.meanModelFt.toFixed(2), medianRatio: +s.medianRatio.toFixed(3)} : null);
const winJson = (x: typeof archive, w: [number, number]) => ({start: iso(w[0]), end: iso(w[1]), buoys: x.buoyRows.map((r) => ({id: r.buoy.id, name: r.buoy.name, depthM: r.buoy.depthM, mopPoint: r.buoy.mopPoint?.id ?? null, mopAtBuoy: slim(r.c), mopRightHere: r.ok})),
  spots: x.spotRows.map((r) => ({id: r.id, mopId: r.mopId, buoy: r.buoy?.id ?? null, km: r.km === null ? null : +r.km.toFixed(1), relation: r.relation, v1VsObs: slim(r.a), mopVsObs: slim(r.b), anchor: r.anchor?.id ?? null, v1VsAnchored: slim(r.d), appV1VsAnchored: slim(r.dApp), v1MinusMop: slim(r.mm), mopPointOverBuoySite: r.ratio === null ? null : +r.ratio.toFixed(3)}))});
fs.writeFileSync(JSON_OUT, JSON.stringify({generatedAt: new Date().toISOString(), note: 'Generated by docs/forecast/data/accuracy-vs-buoys.ts. Observed = buoy Hs; v1 and MOP are model estimates; anchored = observation carried to the spot point by MOP (model-assisted). Bias = model - observed, ft.',
  archive: winJson(archive, WIN.archive), recent: winJson(recent, WIN.recent),
  trials: trials.map(({spot, what, t, recentAnchor, recentBefore, recentAfter, verdict, bins}) => ({spot: spot.id, what, factor: t.ratio === null ? null : +t.ratio.toFixed(3), cutAt: t.cutAt === null ? null : iso(t.cutAt),
    firstHour: t.fit && (spot.anchorPairs.get(spot.anchor?.id ?? '')?.raw[0]?.t) ? iso(spot.anchorPairs.get(spot.anchor!.id)!.raw[0].t) : null, lastHour: spot.anchor ? iso(spot.anchorPairs.get(spot.anchor.id)!.raw.at(-1)!.t) : null,
    bins: bins && bins.map((b) => ({fromFt: b.bin[0], toFt: b.bin[1] === Infinity ? null : b.bin[1], n: b.n, before: slim(b.before), after: slim(b.after), recentN: b.recentN, recentBefore: slim(b.recentBefore), recentAfter: slim(b.recentAfter), holds: b.holds, reason: b.reason})), fit: slim(t.fit), heldOutBefore: slim(t.before), heldOutAfter: slim(t.after), recentAnchor, recentBefore: slim(recentBefore), recentAfter: slim(recentAfter), clearsRule: t.accepted, verdict, reason: t.reason}))}, null, 1) + '\n');
console.log(`wrote ${OUT} and ${JSON_OUT}`);
