/** "How right we've been" (beyond-Surfline step 2): per spot, our surf height against REAL measured waves over the last 7 and 30 days.
 *  The rules are the T-131 harness's (docs/forecast/ACCURACY-VS-BUOYS.md, docs/forecast/data/accuracy-vs-buoys.ts), applied to a rolling window:
 *  - observed = a wave buoy's measured Hs ON the hour (CDIP QC flag 1, or NDBC realtime2), never averaged or filled;
 *  - the buoy qualifies only within 40 km of the spot, with at least 200 measured hours in the window, and only where CDIP's own model (MOP) is
 *    right AT the buoy (bias within 0.5 ft and MAE under 1 ft over at least 200 hours of the window's first 2/3);
 *  - the measured height is carried to the spot's MOP point by MOP's own hourly ratio (point ÷ buoy site): "observation-anchored", model-assisted,
 *    NOT a measurement at the spot, and labelled so wherever it is shown;
 *  - "ours" is what our server SHOWED (the MOP forecast at the spot's point as our cache held it at least 12 h before the hour: the day-before
 *    look). Until that ledger has 3 days of hours at a spot, the spot is `collecting` and carries NO number (data-honesty P0, 2026-11-07: comparing
 *    CDIP's nowcast instead would only restate CDIP's own error at a buoy picked because CDIP matched it);
 *  - only hours AFTER the buoy check's cut are scored, so the hours that picked the buoy never score it.
 *  Pure apart from `runHowRight`, which only calls the `get` it is handed. The Worker runs it once a day (services/forecast-service.mjs `howRightDaily`). */
// ZONE: "how right we've been" is the California buoy/MOP scoring, scored in Pacific days by definition (the Worker's daily capture is on the Pacific evening); it deliberately stays America/Los_Angeles and does not follow a spot's time zone (spec 2026-11-09 C1; lead review).
import {OBSERVING_BUOYS, distanceKm, relationOf, parseCdipSeries, parseNdbcSeries, pairSeries, score, splitByTime, type BuoyRelation, type HourSeries, type ObservingBuoy, type Pair} from './accuracy.ts';
import {pacificDateMs} from '../ocean/time.ts';

/** The harness's thresholds (ACCURACY-VS-BUOYS.md), plus our own for a rolling window. All are our judgement, stated wherever a result is shown. */
export const HOW_RIGHT_RULE = {
  windowDays: 30, shortDays: 7,
  /** (d) anchors only within this distance of the spot (harness ANCHOR_KM). */ anchorKm: 40,
  /** a buoy farther than this is not even named as the nearest */ nearestKm: 80,
  /** harness MIN_OBS_HOURS */ minObsHours: 200,
  /** harness MOP_OK, judged on the window's first 2/3 of paired hours */ mopOk: {bias: 0.5, mae: 1.0, n: 200},
  /** a buoy-site model height below this (ft) makes the ratio meaningless (harness q > 0.15) */ minSiteFt: 0.15,
  /** fewer paired hours than this in a window: no number for that window. The forecast is 3-hourly, so 24 pairs is three days of it. */ minPairs: 24,
  /** "what we showed" = the forecast as our cache held it at least this many hours before the hour */ shownMinLeadH: 12,
  /** forecast hours captured each day (from the capture forward) */ captureAheadH: 48,
} as const;
const HOUR = 3600000, DAY = 86400000;

export const cdipNcssURL = (path: string, fromMs: number, toMs: number) => `https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/${path}?` + new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: new Date(fromMs).toISOString(), time_end: new Date(toMs).toISOString(), accept: 'csv'});
/** MOP nowcast at a point: a spot's alongshore point, or a buoy's MOP_validation point (`BP<id>`). */
export const mopNowcastURL = (id: string, fromMs: number, toMs: number) => cdipNcssURL(`model/${/^BP/.test(id) ? 'MOP_validation' : 'MOP_alongshore'}/${id}_nowcast.nc`, fromMs, toMs);
/** The buoy's measured series for a rolling window: CDIP realtime file, or NDBC realtime2 (its last 45 days), or null when it has no live feed. */
export function buoyLiveURL(x: ObservingBuoy, fromMs: number, toMs: number): string | null {
  return x.realtime === 'cdip' ? cdipNcssURL(`realtime/${x.id}p1_rt.nc`, fromMs, toMs) : x.realtime === 'ndbc' && x.ndbc ? `https://www.ndbc.noaa.gov/data/realtime2/${x.ndbc}.txt` : null;
}
const clip = (s: HourSeries, a: number, b: number): HourSeries => new Map([...s].filter(([t]) => t >= a && t <= b));
const hsOnly = (s: HourSeries) => new Map([...s].map(([t, v]) => [t, v.hs]));

export interface BuoyCheck {id: string; name: string; depthM: number; nObs: number; mop: {n: number; biasFt: number; maeFt: number} | null; right: boolean; why: string; /** first hour NOT used by the check: only hours from here on are scored */ cutAt: string | null}
/** Is a buoy usable as an anchor in this window? The harness rule: enough measured hours, and MOP right at the buoy on the window's FIRST 2/3 of paired hours. */
export function checkBuoy(x: Pick<ObservingBuoy, 'id' | 'name' | 'depthM' | 'mopPoint'>, obs: HourSeries | undefined, site: HourSeries | undefined, rule = HOW_RIGHT_RULE, failed: {obs?: boolean; site?: boolean} = {}): BuoyCheck {
  const base = {id: x.id, name: x.name, depthM: x.depthM, nObs: obs?.size ?? 0, cutAt: null};
  if (failed.obs) return {...base, mop: null, right: false, why: 'its data could not be fetched today'};
  if (!obs || !obs.size) return {...base, mop: null, right: false, why: 'no measured data this month'};
  if (obs.size < rule.minObsHours) return {...base, mop: null, right: false, why: `only ${obs.size} measured hours this month (we need ${rule.minObsHours})`};
  if (x.mopPoint && failed.site) return {...base, mop: null, right: false, why: 'CDIP\'s model at the buoy could not be fetched today'};
  if (!x.mopPoint || !site || !site.size) return {...base, mop: null, right: false, why: 'CDIP has no model check point with data there'};
  const split = splitByTime(pairSeries(obs, hsOnly(site))), fit = score(split.fit), cut = split.cutAt === null ? null : new Date(split.cutAt).toISOString();
  if (!fit || fit.n < rule.mopOk.n) return {...base, mop: fit ? {n: fit.n, biasFt: fit.biasFt, maeFt: fit.maeFt} : null, right: false, why: `too few hours to check CDIP's model there (${fit?.n ?? 0})`};
  const mop = {n: fit.n, biasFt: Math.round(fit.biasFt * 100) / 100, maeFt: Math.round(fit.maeFt * 100) / 100}, right = Math.abs(fit.biasFt) <= rule.mopOk.bias && fit.maeFt <= rule.mopOk.mae;
  return {...base, cutAt: cut, mop, right, why: right ? 'CDIP\'s model matched it this month' : `CDIP's model missed it by ${fit.maeFt.toFixed(1)} ft on average this month`};
}
/** The measured height carried to the spot's point: observed × MOP(point) ÷ MOP(buoy site), same hour only. */
export function anchoredSeries(obs: HourSeries, point: HourSeries, site: HourSeries, rule = HOW_RIGHT_RULE): HourSeries {
  const out: HourSeries = new Map();
  for (const [t, y] of obs) { const p = point.get(t)?.hs, q = site.get(t)?.hs; if (p !== undefined && q !== undefined && q > rule.minSiteFt) out.set(t, {hs: y.hs * p / q}); }
  return out;
}

/** One day's capture of what our server was showing: per MOP point, the forecast file's retrieval time and its hours (ft) from the capture forward. */
export interface ShownCapture {schema: 1; capturedAt: string; points: Record<string, {retrievedAt: string; hs: Record<string, number>}>}
/** Builds a capture from the cached forecast files (`payload` = the CDIP CSV the app reads). Hours from `nowMs` to `nowMs + captureAheadH` only. */
export function captureShown(cached: {mopId: string; value: {payload?: unknown; retrievedAt?: string} | null}[], nowMs: number, rule = HOW_RIGHT_RULE): ShownCapture {
  const points: ShownCapture['points'] = {};
  for (const {mopId, value} of cached) {
    if (!value || typeof value.payload !== 'string' || !Number.isFinite(Date.parse(value.retrievedAt ?? ''))) continue;
    const hs: Record<string, number> = {};
    for (const [t, v] of parseCdipSeries(value.payload)) if (t >= nowMs && t <= nowMs + rule.captureAheadH * HOUR) hs[new Date(t).toISOString()] = Math.round(v.hs * 100) / 100;
    if (Object.keys(hs).length) points[mopId] = {retrievedAt: value.retrievedAt!, hs};
  }
  return {schema: 1, capturedAt: new Date(nowMs).toISOString(), points};
}
/** What we showed for each hour at one point: from the LATEST retrieval made at least `shownMinLeadH` before the hour. */
export function shownSeries(captures: ShownCapture[], mopId: string, rule = HOW_RIGHT_RULE): Map<number, {hs: number; leadH: number}> {
  const out = new Map<number, {hs: number; leadH: number; r: number}>();
  for (const c of captures) {
    const p = c?.points?.[mopId], r = Date.parse(p?.retrievedAt ?? ''); if (!p || !Number.isFinite(r)) continue;
    for (const [iso, hs] of Object.entries(p.hs)) {
      const t = Date.parse(iso), lead = (t - r) / HOUR; if (!Number.isFinite(t) || !Number.isFinite(hs) || lead < rule.shownMinLeadH) continue;
      const old = out.get(t); if (!old || r > old.r) out.set(t, {hs, leadH: lead, r});
    }
  }
  return new Map([...out].map(([t, v]) => [t, {hs: v.hs, leadH: v.leadH}]));
}

export interface HowRightWindow {days: number; n: number; from: string; to: string; biasFt: number; maeFt: number; /** median |ours − measured|: half the hours were closer than this */ typicalFt: number}
export interface HowRightDay {date: string; n: number; measuredFt: number; oursFt: number}
export interface HowRightBuoy {id: string; name: string; km: number; depthM: number; relation: BuoyRelation; mop: {n: number; biasFt: number; maeFt: number}}
export type HowRightSpot =
  /** scored: our day-before forecast against the buoy carried to the point. `d30` = the last 30 days, hours after the buoy check's cut only (`scoredFrom`). */
  | {status: 'ok'; spotId: string; mopId: string; buoy: HowRightBuoy; scoredFrom: string | null; /** the typical lead of our forecast, hours */ leadH: number | null; d7: HowRightWindow | null; d30: HowRightWindow | null; days: HowRightDay[]}
  /** a buoy qualifies, but we have not kept 3 days of our own forecasts here yet: no number */
  | {status: 'collecting'; spotId: string; mopId: string; buoy: HowRightBuoy; have: number; need: number}
  | {status: 'no-buoy'; spotId: string; mopId: string | null; reason: string; nearest: {id: string; name: string; km: number; why: string} | null};
export interface HowRightCard {schema: 1; computedAt: string; from: string; to: string; shownSince: string | null; rule: typeof HOW_RIGHT_RULE; buoys: BuoyCheck[]; spots: Record<string, HowRightSpot>}

const median = (x: number[]) => { const s = [...x].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Bias, MAE and the typical (median absolute) difference over the pairs inside [fromMs, toMs]; null below `minPairs`. Bias = ours − measured. */
export function windowScore(pairs: Pick<Pair, 't' | 'obs' | 'model'>[], fromMs: number, toMs: number, days: number, rule = HOW_RIGHT_RULE): HowRightWindow | null {
  const p = pairs.filter((x) => x.t >= fromMs && x.t <= toMs), s = score(p);
  if (!s || s.n < rule.minPairs) return null;
  return {days, n: s.n, from: new Date(p[0].t).toISOString(), to: new Date(p[p.length - 1].t).toISOString(), biasFt: r2(s.biasFt), maeFt: r2(s.maeFt), typicalFt: r2(median(p.map((x) => Math.abs(x.model - x.obs))))};
}
/** Per Pacific day: the mean measured (carried to the point) and the mean of ours, over that day's paired hours. */
export function dailyMeans(pairs: Pick<Pair, 't' | 'obs' | 'model'>[]): HowRightDay[] {
  const m = new Map<string, {n: number; o: number; y: number}>();
  for (const p of pairs) { const d = pacificDateMs(p.t), a = m.get(d) ?? {n: 0, o: 0, y: 0}; a.n++; a.o += p.obs; a.y += p.model; m.set(d, a); }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([date, a]) => ({date, n: a.n, measuredFt: r2(a.o / a.n), oursFt: r2(a.y / a.n)}));
}

export interface SpotInput {id: string; lat: number; lon: number; mopId: string | null}
export interface BuoyData {buoy: ObservingBuoy; obs: HourSeries; site: HourSeries; check: BuoyCheck}
/** One spot's result. `point` = MOP nowcast at the spot's point (needed to carry the measurement there). */
export function scoreSpot(spot: SpotInput, buoys: BuoyData[], point: HourSeries | null, shown: Map<number, {hs: number; leadH: number}>, nowMs: number, rule = HOW_RIGHT_RULE): HowRightSpot {
  const near = buoys.map((b) => ({b, km: distanceKm(spot.lat, spot.lon, b.buoy.lat, b.buoy.lon)})).filter((x) => x.km <= rule.nearestKm).sort((p, q) => p.km - q.km);
  const noBuoy = (reason: string, n?: {b: BuoyData; km: number}): HowRightSpot => ({status: 'no-buoy', spotId: spot.id, mopId: spot.mopId, reason, nearest: n ? {id: n.b.buoy.id, name: n.b.buoy.name, km: Math.round(n.km), why: n.b.check.why} : null});
  if (!spot.mopId) return noBuoy('this spot has no nearshore model point to carry a measurement to');
  const from = nowMs - rule.windowDays * DAY;
  for (const x of near) {
    if (x.km > rule.anchorKm || !x.b.check.right || !point?.size) continue;
    const anchored = anchoredSeries(x.b.obs, point, x.b.site, rule); if (!anchored.size) continue;
    // only hours after the check's cut: the hours that chose this buoy never score it
    const cut = Date.parse(x.b.check.cutAt ?? ''), start = Number.isFinite(cut) ? Math.max(from, cut) : from;
    const pairs = pairSeries(anchored, new Map([...shown].map(([t, v]) => [t, v.hs])), start, nowMs), recent = pairs.filter((p) => p.t >= nowMs - rule.shortDays * DAY).length;
    const buoy: HowRightBuoy = {id: x.b.buoy.id, name: x.b.buoy.name, km: Math.round(x.km * 10) / 10, depthM: x.b.buoy.depthM, relation: relationOf(x.km, x.b.buoy), mop: x.b.check.mop!};
    if (recent < rule.minPairs) return {status: 'collecting', spotId: spot.id, mopId: spot.mopId, buoy, have: recent, need: rule.minPairs};
    const leads = pairs.map((p) => shown.get(p.t)!.leadH);
    return {status: 'ok', spotId: spot.id, mopId: spot.mopId, buoy, scoredFrom: new Date(start).toISOString(), leadH: leads.length ? Math.round(median(leads)) : null,
      d7: windowScore(pairs, nowMs - rule.shortDays * DAY, nowMs, rule.shortDays, rule), d30: windowScore(pairs, start, nowMs, rule.windowDays, rule), days: dailyMeans(pairs)};
  }
  const first = near[0];
  if (!first) return noBuoy(`no wave buoy with data within ${rule.nearestKm} km`);
  if (first.km > rule.anchorKm) return noBuoy(`nearest is ${first.b.buoy.name}, ${Math.round(first.km)} km away (our limit is ${rule.anchorKm} km)`, first);
  const inReach = near.filter((x) => x.km <= rule.anchorKm);
  if (inReach.some((x) => x.b.check.right)) return noBuoy(point === null ? 'CDIP\'s model at this spot\'s point could not be fetched today' : 'the buoy in reach has no model hours at this spot\'s point to carry its measurement to', first);
  return noBuoy(`nearest is ${first.b.buoy.name} (${Math.round(first.km)} km): ${first.b.check.why}`, first);
}

/** The whole daily computation. `get(url)` returns the response text or null (the Worker counts every call). `captures` = the stored daily
 *  ShownCaptures (any order). Fetches only buoys with a live feed within `nearestKm` of a spot, their MOP check points, and the MOP nowcast at
 *  the points of spots that have a qualifying buoy in reach. */
export async function runHowRight(o: {get: (url: string) => Promise<string | null>; nowMs: number; spots: SpotInput[]; captures: ShownCapture[]; rule?: typeof HOW_RIGHT_RULE}): Promise<HowRightCard> {
  const rule = o.rule ?? HOW_RIGHT_RULE, to = Math.floor(o.nowMs / HOUR) * HOUR, from = to - rule.windowDays * DAY;
  const wanted = OBSERVING_BUOYS.filter((b) => buoyLiveURL(b, from, to) && o.spots.some((s) => distanceKm(s.lat, s.lon, b.lat, b.lon) <= rule.nearestKm));
  const buoys: BuoyData[] = [];
  for (const b of wanted) {
    const u = buoyLiveURL(b, from, to)!, t = await o.get(u), obs = t ? clip(/ndbc\.noaa/.test(u) ? parseNdbcSeries(t) : parseCdipSeries(t), from, to) : new Map();
    const askSite = obs.size >= rule.minObsHours && !!b.mopPoint, st = askSite ? await o.get(mopNowcastURL(b.mopPoint!.id, from, to)) : null, site = st ? clip(parseCdipSeries(st), from, to) : new Map();
    buoys.push({buoy: b, obs, site, check: checkBuoy(b, obs, site, rule, {obs: t === null, site: askSite && st === null})});
  }
  const points = new Map<string, HourSeries | null>(), spots: Record<string, HowRightSpot> = {};
  for (const s of o.spots) {
    const reach = s.mopId && buoys.some((x) => x.check.right && distanceKm(s.lat, s.lon, x.buoy.lat, x.buoy.lon) <= rule.anchorKm);
    if (reach && !points.has(s.mopId!)) { const t = await o.get(mopNowcastURL(s.mopId!, from, to)); points.set(s.mopId!, t ? clip(parseCdipSeries(t), from, to) : null); }
    spots[s.id] = scoreSpot(s, buoys, reach ? points.get(s.mopId!) ?? null : null, s.mopId ? shownSeries(o.captures, s.mopId, rule) : new Map(), to, rule);
  }
  const since = o.captures.map((c) => c?.capturedAt).filter((x) => Number.isFinite(Date.parse(x ?? ''))).sort()[0] ?? null;
  return {schema: 1, computedAt: new Date(o.nowMs).toISOString(), from: new Date(from).toISOString(), to: new Date(to).toISOString(), shownSince: since, rule, buoys: buoys.map((x) => x.check), spots};
}

/* ---------- words (one function for every surface) ---------- */
/** A size difference in the person's units: "0.6 ft" or "0.2 m" (one decimal). */
export const diffText = (ft: number, unit: 'ft' | 'm' = 'ft') => (unit === 'm' ? `${(Math.round(Math.abs(ft) * 0.3048 * 10) / 10).toFixed(1)} m` : `${(Math.round(Math.abs(ft) * 10) / 10).toFixed(1)} ft`);
/** "ran 0.2 ft high" / "ran 0.3 ft low" / "no lean high or low" (|bias| under 0.1 ft). Bias = ours − measured. */
export const leanText = (biasFt: number, unit: 'ft' | 'm' = 'ft') => (diffText(biasFt, unit).startsWith('0.0') ? 'no lean high or low' : `ran ${diffText(biasFt, unit)} ${biasFt > 0 ? 'high' : 'low'}`);
const dayFmt = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric'});
/** "Nov 7" for an instant. */
export const shortDay = (iso: string) => dayFmt.format(new Date(iso));
/** The one line under the spot's surf number, and a fine second line. A number ONLY for a scored spot (status 'ok'). */
export function howRightLine(s: HowRightSpot, shownSince: string | null, unit: 'ft' | 'm' = 'ft'): {text: string; source: string | null; hasNumber: boolean} {
  if (s.status === 'no-buoy') return {text: 'How right we\'ve been: no buoy can check this spot this month.', source: `${s.reason[0].toUpperCase()}${s.reason.slice(1)}.`, hasNumber: false};
  if (s.status === 'collecting') return {text: `How right we've been: starts once we've kept 3 days of our own forecasts (${shownSince ? `kept since ${shortDay(shownSince)}` : 'we start keeping them tonight'}).`, source: null, hasNumber: false};
  const w = s.d7, source = `Buoy height carried to our point ${s.mopId} by CDIP's model.`;
  if (!w) return {text: `Our forecast from the day before vs the ${s.buoy.name} buoy: too few hours this week to say.`, source, hasNumber: false};
  return {text: `Our forecast from the day before vs the ${s.buoy.name} buoy: typical difference ${diffText(w.typicalFt, unit)}, ${leanText(w.biasFt, unit)}.`, source, hasNumber: true};
}
