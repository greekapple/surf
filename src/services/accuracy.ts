/** T-131 phase 2: our surf heights against REAL observations (wave buoys). Pure and dependency-free, so the harness
 *  (docs/forecast/data/accuracy-vs-buoys.ts) and, later, the step-2 "how right we've been" scorecard read the same rules.
 *  Every series here is labelled by what it is: `observed` (a buoy's measured Hs), `model` (MOP, v1) or `correction` (ours).
 *  Nothing is interpolated: a model hour is paired only with an observation at the SAME hour. */

/** A wave buoy that MEASURES waves (an observation, not a model). Positions and depths were read on 2026-11-06 from each buoy's own CDIP
 *  file (`metaDeployLatitude`, `metaDeployLongitude`, `metaWaterDepth`, `metaStationName`: the realtime file, or the last deployment in
 *  the `_historic` archive file for a buoy that is no longer in CDIP's realtime catalogue), or from the NDBC station page.
 *  `realtime`: where its last ~35 days are served (CDIP realtime file, NDBC realtime2, or none). `archiveEnd`: the end of its QC'd CDIP
 *  `_historic` file (null = no historic file). `mopPoint` is CDIP's MOP_validation point for this buoy (the MOP model run AT the buoy's
 *  site, `BP<id>`), its position from that file's own geospatial attributes. Earlier deployments sat up to about 2 km from the position
 *  given here (the historic files list each one). */
export interface ObservingBuoy {
  id: string; ndbc: string | null; name: string; lat: number; lon: number; depthM: number;
  realtime: 'cdip' | 'ndbc' | null; archiveEnd: string | null; mopPoint: {id: string; lat: number; lon: number} | null;
}
const b = (id: string, ndbc: string | null, name: string, lat: number, lon: number, depthM: number, bp: [number, number] | null, archiveEnd: string | null, realtime: ObservingBuoy['realtime'] = 'cdip'): ObservingBuoy =>
  ({id, ndbc, name, lat, lon, depthM, realtime, archiveEnd, mopPoint: bp ? {id: `BP${id}`, lat: bp[0], lon: bp[1]} : null});
/** California buoys within reach of a SWELLO spot. Nearshore (45 m or less) first; deep ones are regional context only. */
export const OBSERVING_BUOYS: ObservingBuoy[] = [
  b('142', '46237', 'San Francisco Bar', 37.7881, -122.6325, 16.46, [37.78195, -122.60963], '2026-08-03'),
  b('076', '46215', 'Diablo Canyon', 35.203815, -120.859314, 27.43, [35.2058, -120.85962], '2026-01-07'),
  b('285', '46286', 'Avila Beach Nearshore', 35.16396, -120.73756, 15, [35.16396, -120.73756], null),
  b('103', '46268', 'Topanga Nearshore', 34.02222, -118.57833, 20, [34.02305, -118.5783], '2023-08-29'),
  b('215', '46256', 'Long Beach Channel', 33.7002, -118.2006, 23.25, [33.70033, -118.20067], '2026-06-26'),
  b('284', '46285', 'Capistrano Beach Nearshore', 33.445168, -117.68015, 11.13, [33.44517, -117.68015], null),
  b('264', '46275', 'Red Beach Nearshore', 33.29076, -117.50146, 16.79, [33.28995, -117.50013], '2026-11-03'),
  b('262', '46274', 'Leucadia Nearshore', 33.062077, -117.31407, 17, [33.06207, -117.31407], '2025-05-15'),
  b('153', '46266', 'Del Mar Nearshore', 32.95654, -117.27956, 17, [32.95658, -117.27945], '2025-08-12'),
  b('201', '46254', 'Scripps Nearshore', 32.86785, -117.26667, 41, [32.86872, -117.2664], '2026-10-21'),
  b('158', null, 'Cabrillo Point Nearshore (Monterey Bay)', 36.6263, -121.9071, 17, [36.62626, -121.9071], '2026-04-30', null),
  b('155', '46235', 'Imperial Beach Nearshore', 32.56968, -117.16895, 21, [32.5696, -117.1687], '2026-05-03', null),
  b('156', '46236', 'Monterey Canyon Outer', 36.759167, -121.95028, 133, [36.76134, -121.94718], '2026-08-06'),
  b('168', '46244', 'Humboldt Bay North Spit', 40.896, -124.357, 110, [40.88833, -124.35635], '2026-10-07'),
  b('071', '46218', 'Harvest', 34.4515, -120.78, 550, [34.45892, -120.772], '2026-04-10'),
  b('028', '46221', 'Santa Monica Bay', 33.859932, -118.6411, 387, [33.85429, -118.63251], '2026-05-20'),
  b('094', '46213', 'Cape Mendocino', 40.2915, -124.7475, 346, [40.29353, -124.73895], '2026-05-26'),
  b('222', '46259', 'Santa Lucia Escarpment', 34.774, -121.491, 650, [34.73178, -121.66428], '2024-11-25'),
  b('029', '46214', 'Point Reyes', 37.9415, -123.4645, 600, [37.94598, -123.46945], '2025-10-17'),
  /* Point Sur: not in CDIP's realtime catalogue on 2026-11-06; its NDBC feed (46239) and CDIP archive both stop on 2026-10-25. Depth 366 m (NDBC station page and CDIP historic file). */
  b('157', '46239', 'Point Sur', 36.342, -122.11, 366, [36.34122, -122.10188], '2026-10-25', 'ndbc'),
];
/** Where to read a buoy's measured series: the CDIP realtime file, NDBC realtime2, or the CDIP historic archive. */
export function buoyFeedURL(x: ObservingBuoy, window: 'recent' | 'archive', startIso: string, endIso: string): string | null {
  const q = new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: startIso, time_end: endIso, accept: 'csv'});
  if (window === 'archive') return x.archiveEnd ? `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/archive/${x.id}p1/${x.id}p1_historic.nc?${q}` : null;
  return x.realtime === 'cdip' ? `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/${x.id}p1_rt.nc?${q}` : x.realtime === 'ndbc' && x.ndbc ? `https://www.ndbc.noaa.gov/data/realtime2/${x.ndbc}.txt` : null;
}

/** Nearshore = a buoy in water shallow enough to sit in the same regime as a 10–15 m MOP point; deeper ones are regional context. */
export const NEARSHORE_MAX_DEPTH_M = 45;
export const isNearshoreBuoy = (x: Pick<ObservingBuoy, 'depthM'>) => x.depthM <= NEARSHORE_MAX_DEPTH_M;

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180, h = Math.sin((bLat - aLat) * r / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin((bLon - aLon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
/** How a buoy relates to a spot. `co-located`: nearshore and within 5 km; `nearby`: nearshore and within 25 km; else `regional`. Thresholds are our own judgement, stated wherever a result is shown. */
export type BuoyRelation = 'co-located' | 'nearby' | 'regional';
export function relationOf(km: number, buoy: Pick<ObservingBuoy, 'depthM'>): BuoyRelation {
  return isNearshoreBuoy(buoy) && km <= 5 ? 'co-located' : isNearshoreBuoy(buoy) && km <= 25 ? 'nearby' : 'regional';
}
/** MOP's own median ratio (spot point ÷ buoy site) inside 0.9–1.1: by the nearshore model the two places see about the same waves, so the
 *  buoy can stand in for the spot's point. Outside it, a buoy-vs-point gap is (at least partly) a real difference between two places. */
export const sameWaveClimate = (pointOverBuoySite: number | null) => pointOverBuoySite !== null && pointOverBuoySite >= 0.9 && pointOverBuoySite <= 1.1;
/** The nearest buoy to a point, preferring a nearshore one within `preferKm` over a closer deep one. Null beyond `maxKm`. */
export function nearestBuoy(lat: number, lon: number, buoys: ObservingBuoy[] = OBSERVING_BUOYS, maxKm = 80, preferKm = 40) {
  const all = buoys.map((x) => ({buoy: x, km: distanceKm(lat, lon, x.lat, x.lon)})).filter((x) => x.km <= maxKm).sort((p, q) => p.km - q.km);
  const near = all.find((x) => isNearshoreBuoy(x.buoy) && x.km <= preferKm);
  const pick = near ?? all[0];
  return pick ? {...pick, relation: relationOf(pick.km, pick.buoy)} : null;
}

/** One hourly value. `hs` in feet. */
export interface HourValue {hs: number; tp?: number; dp?: number}
export type HourSeries = Map<number, HourValue>;
const FT = 1 / 0.3048, HOUR = 3600000;
const okNum = (s: string | undefined) => s !== undefined && s.trim() !== '' && Number.isFinite(Number(s));

/** CDIP NCSS point CSV (buoy realtime or MOP file): `time,station,lat,lon,waveHs,waveTp,waveDp,waveFlagPrimary`.
 *  The station name may contain commas, so the numeric columns are read from the END. Only rows ON the hour with primary QC flag 1
 *  (good) are kept: CDIP buoys sample every 30 min and MOP is hourly, so this pairs like with like and never averages or fills. */
export function parseCdipSeries(csv: string): HourSeries {
  const out: HourSeries = new Map(), lines = csv.trim().split(/\r?\n/), head = lines.shift() ?? '';
  if (!/^time,/.test(head) || !head.includes('waveHs[unit="meter"]') || !head.endsWith('waveFlagPrimary')) return out;
  for (const l of lines) {
    const c = l.split(','), n = c.length, t = Date.parse(c[0]);
    if (!Number.isFinite(t) || t % HOUR !== 0 || c[n - 1]?.trim() !== '1' || !okNum(c[n - 4])) continue;
    const hs = Number(c[n - 4]); if (hs < 0 || hs > 30) continue;
    out.set(t, {hs: hs * FT, ...(okNum(c[n - 3]) ? {tp: Number(c[n - 3])} : {}), ...(okNum(c[n - 2]) ? {dp: Number(c[n - 2])} : {})});
  }
  return out;
}
/** NDBC realtime2 standard met text: WVHT (m), DPD (s), MWD (deg). The reading AT the hour only (minute 00), "MM" skipped. */
export function parseNdbcSeries(txt: string): HourSeries {
  const out: HourSeries = new Map(), lines = txt.trim().split(/\r?\n/), head = lines[0]?.replace(/^#/, '').trim().split(/\s+/) ?? [];
  const iH = head.indexOf('WVHT'), iT = head.indexOf('DPD'), iD = head.indexOf('MWD'); if (iH < 0) return out;
  for (const l of lines) {
    if (l.startsWith('#')) continue;
    const c = l.trim().split(/\s+/); if (c.length < head.length || c[4] !== '00' || !okNum(c[iH])) continue;
    const t = Date.UTC(+c[0], +c[1] - 1, +c[2], +c[3]); if (!Number.isFinite(t)) continue;
    out.set(t, {hs: Number(c[iH]) * FT, ...(iT >= 0 && okNum(c[iT]) ? {tp: Number(c[iT])} : {}), ...(iD >= 0 && okNum(c[iD]) ? {dp: Number(c[iD])} : {})});
  }
  return out;
}

/** A matched hour: the observation and a model value for the same hour (the observation's Tp/Dp ride along for regimes). */
export interface Pair {t: number; obs: number; model: number; tp?: number; dp?: number}
export function pairSeries(obs: HourSeries, model: Map<number, number>, from = -Infinity, to = Infinity): Pair[] {
  const out: Pair[] = [];
  for (const [t, o] of obs) { const m = model.get(t); if (t >= from && t <= to && m !== undefined && Number.isFinite(m)) out.push({t, obs: o.hs, model: m, tp: o.tp, dp: o.dp}); }
  return out.sort((p, q) => p.t - q.t);
}

export interface Score {n: number; biasFt: number; maeFt: number; rmseFt: number; meanObsFt: number; meanModelFt: number; medianRatio: number}
const median = (x: number[]) => { const s = [...x].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Bias = mean(model − observed): positive means the model reads HIGH. Null when there is nothing to score. */
export function score(pairs: Pick<Pair, 'obs' | 'model'>[]): Score | null {
  const p = pairs.filter((x) => Number.isFinite(x.obs) && Number.isFinite(x.model)); if (!p.length) return null;
  const e = p.map((x) => x.model - x.obs), mean = (v: number[]) => v.reduce((s, y) => s + y, 0) / v.length;
  return {n: p.length, biasFt: mean(e), maeFt: mean(e.map(Math.abs)), rmseFt: Math.sqrt(mean(e.map((y) => y * y))), meanObsFt: mean(p.map((x) => x.obs)), meanModelFt: mean(p.map((x) => x.model)), medianRatio: median(p.filter((x) => x.model > 0).map((x) => x.obs / x.model))};
}

/** Swell regime of an hour from the OBSERVED peak period and direction: period short (< 10 s), mid (10–14 s) or long (≥ 14 s); direction S (< 225°), W (225–292.5°) or NW (≥ 292.5°). Coarse on purpose: it says which conditions a score covers, nothing more. */
export function regimeOf(tp?: number, dp?: number): string {
  const per = tp === undefined ? '?' : tp < 10 ? 'short' : tp < 14 ? 'mid' : 'long';
  const dir = dp === undefined ? '?' : dp < 225 ? 'S' : dp < 292.5 ? 'W' : 'NW';
  return `${dir} ${per}`;
}
/** Regimes with at least `min` hours, largest first: "W mid 410, NW mid 120". */
export function regimesCovered(pairs: Pick<Pair, 'tp' | 'dp'>[], min = 12): {regime: string; n: number}[] {
  const m = new Map<string, number>(); for (const p of pairs) { const r = regimeOf(p.tp, p.dp); m.set(r, (m.get(r) ?? 0) + 1); }
  return [...m].filter(([, n]) => n >= min).map(([regime, n]) => ({regime, n})).sort((p, q) => q.n - p.n);
}

/** Held-out split by TIME (never shuffled): the first `fitFraction` of the hours to fit, the rest to report on. */
export function splitByTime<T extends {t: number}>(pairs: T[], fitFraction = 2 / 3): {fit: T[]; test: T[]; cutAt: number | null} {
  const s = [...pairs].sort((p, q) => p.t - q.t), k = Math.floor(s.length * fitFraction);
  return {fit: s.slice(0, k), test: s.slice(k), cutAt: s[k]?.t ?? null};
}

/** Size bins (ft) for checking a factor by wave size. Binned by the OFFSHORE total Hs at the spot's marine point (what v1 starts from, so the app can pick the bin at run time), never by a model's own nearshore value. */
export const SIZE_BINS: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, Infinity]];
export const sizeBinOf = (ft: number) => SIZE_BINS.findIndex(([a, b]) => ft >= a && ft < b);
export const binLabel = ([a, b]: [number, number]) => (b === Infinity ? `${a} ft and up` : a === 0 ? `under ${b} ft` : `${a}–${b} ft`);
/** A bin keeps the factor only when its held-out hours (at least `minN`) get a smaller MAE with it, and a later window (when it has at least `minN` hours in the bin) does not get worse. Everywhere else: no factor. */
export const BIN_RULE = {minN: 30} as const;
export interface BinCheck {bin: [number, number]; n: number; before: Score | null; after: Score | null; recentN: number; recentBefore: Score | null; recentAfter: Score | null; holds: boolean; reason: string}
export function checkBins(heldOut: (Pair & {off: number})[], recent: (Pair & {off: number})[], factor: number, rule = BIN_RULE): BinCheck[] {
  return SIZE_BINS.map((bin, i) => {
    const h = heldOut.filter((p) => sizeBinOf(p.off) === i), r = recent.filter((p) => sizeBinOf(p.off) === i);
    const before = score(h), after = score(h.map((p) => ({obs: p.obs, model: p.model * factor}))), rb = score(r), ra = score(r.map((p) => ({obs: p.obs, model: p.model * factor})));
    const why = h.length < rule.minN ? `only ${h.length} held-out hours` : after!.maeFt >= before!.maeFt ? 'held-out MAE not smaller' : r.length >= rule.minN && ra!.maeFt > rb!.maeFt ? 'later window gets worse' : '';
    return {bin, n: h.length, before, after, recentN: r.length, recentBefore: rb, recentAfter: ra, holds: !why, reason: why || 'holds'};
  });
}

/** Our acceptance rule for a per-spot multiplicative correction (judgement, stated in the report): enough hours on both sides, a ratio
 *  far enough from 1 to matter, and a held-out MAE that improves by at least 20% AND 0.3 ft. Anything less is "evidence too thin". */
export const CORRECTION_RULE = {minFit: 200, minTest: 100, minRegimes: 2, minGain: 0.2, minGainFt: 0.3, maxRatio: 3, minRatioOffset: 0.1} as const;
export interface CorrectionTrial {cutAt: number | null; ratio: number | null; fit: Score | null; before: Score | null; after: Score | null; accepted: boolean; reason: string}
/** Fit a multiplicative factor (median observed ÷ model, robust to outliers) on the fit window; report MAE before and after on the held-out window. */
export function trialCorrection(pairs: Pair[], rule = CORRECTION_RULE, fitFraction = 2 / 3): CorrectionTrial {
  const {fit, test, cutAt} = splitByTime(pairs, fitFraction), f = score(fit), before = score(test), base = {cutAt, fit: f, before};
  if (fit.length < rule.minFit || test.length < rule.minTest) return {...base, ratio: null, after: null, accepted: false, reason: `too few hours (fit ${fit.length}, held-out ${test.length}; need ${rule.minFit} and ${rule.minTest})`};
  if (regimesCovered(fit).length < rule.minRegimes) return {...base, ratio: null, after: null, accepted: false, reason: `the fit window covers fewer than ${rule.minRegimes} swell regimes`};
  const ratio = f!.medianRatio;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > rule.maxRatio || ratio < 1 / rule.maxRatio) return {...base, ratio, after: null, accepted: false, reason: 'the fitted ratio is outside a physically plausible range'};
  const after = score(test.map((p) => ({obs: p.obs, model: p.model * ratio})))!;
  const gain = before!.maeFt - after.maeFt;
  if (Math.abs(ratio - 1) < rule.minRatioOffset) return {...base, ratio, after, accepted: false, reason: `the fitted ratio ${ratio.toFixed(2)} is within ${rule.minRatioOffset * 100}% of 1: no correction needed`};
  const accepted = gain >= rule.minGainFt && gain >= rule.minGain * before!.maeFt;
  return {...base, ratio, after, accepted, reason: accepted ? `held-out MAE ${before!.maeFt.toFixed(2)} → ${after.maeFt.toFixed(2)} ft` : `held-out MAE ${before!.maeFt.toFixed(2)} → ${after.maeFt.toFixed(2)} ft does not clear the rule (20% and 0.3 ft)`};
}
