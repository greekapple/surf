import {zoneOf} from '../../data/zones.ts';
import {categoryForScore} from '../../ratings/engine.ts';

/** Map groups by zoom (spec docs/specs/2026-11-10-map-zoom-groups.md; first built as 4E coast groups). Zoomed out, groups of spots show one pill instead of their pins:
 *  far out a seaboard or coast with its spot count only; closer, pills with a reading (a LABELLED average, the best spot and the spread of bands), getting smaller as
 *  you zoom, down to clusters of 10 to 20 nearby spots; close in, the pins. Groups merge into their parent until the pills fit; no two pills overlap. */

/** Pins only from this zoom (the focused spot and favourites keep their pin at every zoom). */
export const COAST_MAX_ZOOM = 10;
/** Below this zoom a pill shows its name and spot count only: no reading ("zoom in for ratings"). */
export const READING_MIN_ZOOM = 5;
/** Clusters: a region with more than CLUSTER_MAX spots is split along the coast into runs of CLUSTER_MIN to CLUSTER_MAX spots. */
export const CLUSTER_MIN = 10, CLUSTER_MAX = 20;

/** Coasts above the zones (ZONES, north to south), then the seaboards. Our own grouping for the map; every zone belongs to exactly one coast. */
export const COASTS: [string, string[]][] = [
  ['Alaska', ['Alaska · Sitka']],
  ['Pacific Northwest', ['Washington Coast', 'Oregon North Coast', 'Oregon South Coast']],
  ['Northern California', ['North Coast', 'Bay Area']],
  ['Central California', ['Santa Cruz & Monterey', 'Central Coast']],
  ['Southern California', ['Southern California']],
  ['Hawaii', ['Hawaii · Kauai & Niihau', 'Hawaii · Oahu', 'Hawaii · Maui, Molokai & Lanai', 'Hawaii · Big Island']],
  ['New England', ['Maine', 'New Hampshire', 'Massachusetts', 'Rhode Island']],
  ['Mid-Atlantic', ['New York', 'New Jersey', 'Delaware', 'Maryland', 'Virginia']],
  ['Southeast', ['North Carolina', 'South Carolina', 'Georgia']],
  ['Florida', ['Florida']],
  ['Gulf Coast', ['Florida Gulf Coast', 'Florida Panhandle', 'Alabama', 'Louisiana', 'Texas']],
  ['Puerto Rico', ['Puerto Rico']],
];
/** The map groups the small islands with their neighbours, by county (Niihau is in Kauai County; Molokai and Lanai are in Maui County): the browsing zone
 *  "Molokai, Lanai, Niihau" spans the chain from Kauai to Maui, so its centre would sit between Oahu and Maui and force all of Hawaii into one pill. Zone chips are unchanged. */
const MAP_ZONE: Record<string, string> = {Kauai: 'Hawaii · Kauai & Niihau', Niihau: 'Hawaii · Kauai & Niihau', Maui: 'Hawaii · Maui, Molokai & Lanai', Molokai: 'Hawaii · Maui, Molokai & Lanai', Lanai: 'Hawaii · Maui, Molokai & Lanai'};
export const mapZoneOf = (region: string) => MAP_ZONE[region] ?? zoneOf(region);
export const SEABOARDS: [string, string[]][] = [
  ['West Coast', ['Alaska', 'Pacific Northwest', 'Northern California', 'Central California', 'Southern California']],
  ['Hawaii', ['Hawaii']],
  ['East Coast', ['New England', 'Mid-Atlantic', 'Southeast', 'Florida', 'Gulf Coast', 'Puerto Rico']],
];

/** A group node id is "<level>:<name>": 0 cluster (a run of spots inside a big region), 1 region, 2 zone, 3 coast, 4 seaboard. */
export type NodeId = string;
export const nodeId = (level: number, name: string): NodeId => `${level}:${name}`;
export const levelOf = (id: NodeId) => Number(id.slice(0, id.indexOf(':')));
export const nameOf = (id: NodeId) => id.slice(id.indexOf(':') + 1);
/** Clusters of the catalogue the nodes were last built from: each cluster's region and display name ("Mavericks to Pigeon Point"). */
const CLUSTER_PARENT = new Map<NodeId, NodeId>(), CLUSTER_NAME = new Map<NodeId, string>(), CLUSTER_ENDS = new Map<NodeId, [string, string, string]>();
/** A cluster's first and last spot names (its name is "<first> to <last>"), for a pill that ellipsises each end on its own; null for other groups. */
export const clusterEnds = (id: NodeId): [string, string, string] | null => CLUSTER_ENDS.get(id) ?? null;
/** The word between a cluster's two end names: "to", unless a name already says "to" ("Longnook to Ballston Beach"), then a dash, so the name never reads as three places. */
export const clusterJoin = (a: string, b: string) => (/\bto\b/i.test(`${a} ${b}`) ? ' – ' : ' to ');
export function parentOf(id: NodeId): NodeId | null {
  const lv = levelOf(id), n = nameOf(id);
  if (lv === 0) return CLUSTER_PARENT.get(id) ?? null;
  if (lv === 1) { const z = mapZoneOf(n); return z === 'Other' ? null : nodeId(2, z); }
  const up = lv === 2 ? COASTS : lv === 3 ? SEABOARDS : null;
  const hit = up?.find(([, kids]) => kids.includes(n));
  return hit ? nodeId(lv + 1, hit[0]) : null;
}
export function ancestors(id: NodeId): NodeId[] { const out: NodeId[] = []; for (let p = parentOf(id); p; p = parentOf(p)) out.push(p); return out; }
/** What a pill is called: a cluster by its first and last spot, an island zone as the islands ("Oahu"), anything else by its own name. */
export const displayName = (id: NodeId) => CLUSTER_NAME.get(id) ?? nameOf(id).replace(/^Hawaii · /, '');

type Pt = {id: string; name: string; latitude: number; longitude: number};
/** The spots of one region in order along the coast: start at the spot farthest from the region's centre (an end of the coast), then always step to the nearest
 *  spot not yet visited; the run is turned so it reads north to south (west to east on an east-west coast). Deterministic: ties go to the smaller id. */
export function coastOrder(spots: Pt[]): Pt[] {
  if (spots.length <= 2) return [...spots].sort((a, b) => b.latitude - a.latitude || a.longitude - b.longitude || (a.id < b.id ? -1 : 1));
  const lat0 = spots.reduce((n, s) => n + s.latitude, 0) / spots.length, k = Math.cos((lat0 * Math.PI) / 180);
  const xy = (s: Pt) => [s.longitude * k, s.latitude], d = (a: Pt, b: Pt) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.hypot(ax - bx, ay - by); };
  const c = {id: '', name: '', latitude: lat0, longitude: spots.reduce((n, s) => n + s.longitude, 0) / spots.length};
  const byId = [...spots].sort((a, b) => (a.id < b.id ? -1 : 1));
  let cur = byId.reduce((m, s) => (d(s, c) > d(m, c) ? s : m), byId[0]);
  const left = new Set(byId.filter((s) => s !== cur)), out = [cur];
  while (left.size) { let next: Pt | null = null; for (const s of left) if (!next || d(cur, s) < d(cur, next)) next = s; left.delete(next!); out.push(next!); cur = next!; }
  // 2-opt on the open path: reverse a stretch whenever that shortens the walk (undoes the jumps back a nearest-neighbour chain can leave), until nothing improves
  twoOpt(out, d);
  const a = out[0], b = out[out.length - 1], flip = Math.abs(a.latitude - b.latitude) >= Math.abs(a.longitude - b.longitude) * k ? b.latitude > a.latitude : b.longitude < a.longitude;
  return flip ? out.reverse() : out;
}
/** Open-path 2-opt: reverse out[i..j] while that shortens the path; deterministic (first improvement, scanned in order). */
export function twoOpt<T>(out: T[], d: (a: T, b: T) => number): T[] {
  const n = out.length, eps = 1e-9;
  for (let improved = true, rounds = 0; improved && rounds < 1000; rounds++) {
    improved = false;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {   // either end may move: reversing a stretch that starts or ends the path changes one edge
      const before = (i > 0 ? d(out[i - 1], out[i]) : 0) + (j + 1 < n ? d(out[j], out[j + 1]) : 0), after = (i > 0 ? d(out[i - 1], out[j]) : 0) + (j + 1 < n ? d(out[i], out[j + 1]) : 0);
      if (after + eps < before) { out.splice(i, j - i + 1, ...out.slice(i, j + 1).reverse()); improved = true; }
    }
  }
  return out;
}
/** Split an ordered run into ceil(n / CLUSTER_MAX) contiguous parts of CLUSTER_MIN..CLUSTER_MAX spots, cutting where the coast has its widest gaps (the sum of the
 *  distances at the cuts is the largest possible). Returns the part sizes. Deterministic. */
export function splitRun(gaps: number[], n: number): number[] {
  const k = Math.ceil(n / CLUSTER_MAX); if (k <= 1) return [n];
  // best[j][i]: the largest gap sum splitting the first i spots into j parts; cut before spot i scores gaps[i] (the distance from spot i-1 to spot i)
  const best: number[][] = Array.from({length: k + 1}, () => Array(n + 1).fill(-Infinity)), from: number[][] = Array.from({length: k + 1}, () => Array(n + 1).fill(-1));
  best[0][0] = 0;
  for (let j = 1; j <= k; j++) for (let i = 1; i <= n; i++) for (let size = CLUSTER_MIN; size <= CLUSTER_MAX && size <= i; size++) {
    const p = i - size; if (best[j - 1][p] === -Infinity) continue;
    const v = best[j - 1][p] + (p > 0 ? gaps[p] : 0);
    if (v > best[j][i] || (v === best[j][i] && p > from[j][i])) { best[j][i] = v; from[j][i] = p; }
  }
  const sizes: number[] = []; let i = n;
  for (let j = k; j >= 1; j--) { const p = from[j][i]; sizes.unshift(i - p); i = p; }
  return sizes;
}
/** Every node that holds at least one of these spots, with its spot ids: clusters (regions over CLUSTER_MAX spots, split along the coast), regions, zones,
 *  coasts, seaboards. Rebuilds the cluster registry, so it follows the catalogue. */
export function buildNodes(spots: (Pt & {region: string})[]): Map<NodeId, string[]> {
  CLUSTER_PARENT.clear(); CLUSTER_NAME.clear(); CLUSTER_ENDS.clear();
  const out = new Map<NodeId, string[]>(), add = (n: NodeId, id: string) => { const l = out.get(n); if (l) l.push(id); else out.set(n, [id]); };
  const byRegion = new Map<string, (Pt & {region: string})[]>();
  for (const s of spots) { const l = byRegion.get(s.region); if (l) l.push(s); else byRegion.set(s.region, [s]); }
  for (const [region, list] of byRegion) {
    const reg = nodeId(1, region);
    for (const s of list) for (const n of [reg, ...ancestors(reg)]) add(n, s.id);
    if (list.length <= CLUSTER_MAX) continue;
    const run = coastOrder(list), lat0 = run[0].latitude, k = Math.cos((lat0 * Math.PI) / 180);
    const gaps = run.map((s, i) => (i ? Math.hypot((s.longitude - run[i - 1].longitude) * k, s.latitude - run[i - 1].latitude) : 0));
    let at = 0;
    splitRun(gaps, run.length).forEach((size, i) => {
      const part = run.slice(at, at + size), id = nodeId(0, `${region} · ${i + 1}`); at += size;
      const a = part[0].name, b = part[part.length - 1].name, join = clusterJoin(a, b);
      CLUSTER_PARENT.set(id, reg); CLUSTER_NAME.set(id, `${a}${join}${b}`); CLUSTER_ENDS.set(id, [a, b, join]);
      out.set(id, part.map((s) => s.id));
    });
  }
  return out;
}
/** The groups the layout starts from: every cluster, and every region that is not split. */
export const leavesOf = (nodes: Map<NodeId, string[]>) => [...nodes.keys()].filter((id) => levelOf(id) === 0 || (levelOf(id) === 1 && ![...CLUSTER_PARENT.values()].includes(id)));

export type Band = 'good' | 'fair' | 'poor' | 'none';
/** One spot at the selected hour, from the same rating its pin shows. `rank` is the pins' own priority (favourites, popular, original spots), used only to break a tie. */
export interface SpotState {id: string; name: string; loaded: boolean; score: number | null; category: string | null; band: Band; dark: boolean; rank: number;
  /** the value comes from the daily forecast (the day's capture, re-rated with the current engine), not from a live record: `loaded` is then false and the pill says so */ snap?: boolean; /** for a daily-forecast value: when its model run was retrieved (ms) */ retrieved?: number}
export interface GroupSummary {
  total: number; loaded: number;
  /** spots whose value is from the daily forecast (not live), and their bands */
  snap: number; snapCounts: Record<Band, number>; /** the oldest and newest model-run retrieval (ms) among the daily-forecast spots, null with none */ snapFrom: number | null; snapTo: number | null;
  /** spots per band among the LIVE loaded ones; `none` = loaded but not rated at this hour */
  counts: Record<Band, number>;
  /** the highest-scoring rated DAYLIT spot at this hour; only when every rated spot is in the dark, the highest of those (and `allDark`) */
  best: SpotState | null; allDark: boolean;
  /** the AVERAGE (user, 2026-11-10): the mean score of the rated, daylit spots at this hour (live and daily-forecast alike), its band, and how many spots it is over */
  avg: {mean: number; n: number; band: Band; category: string; snapN: number} | null;   // category: the engine's word for the ROUNDED mean (SOLID, NOT BAD…); band: its colour; snapN: daily-forecast values in it
}
const BAND_OF: Record<string, Band> = {EPIC: 'good', FIRING: 'good', GOOD: 'good', SOLID: 'good', 'NOT BAD': 'fair', SURFABLE: 'fair', WEAK: 'poor', POOR: 'poor'};
/** A score's band (the pins' bands: SOLID and up good, SURFABLE and NOT BAD fair, below poor), through the engine's own score -> category table. */
export const bandOfScore = (score: number): Band => BAND_OF[categoryForScore(score)] ?? 'none';
/** Average, best and spread from the same per-spot ratings the pins show. A dark spot is never the best while a daylit one is rated (after dark is never a surf
 *  window) and never counts in the average. Ties on score go to the higher pin rank, then the earlier spot. */
export function summarise(states: SpotState[]): GroupSummary {
  const counts: Record<Band, number> = {good: 0, fair: 0, poor: 0, none: 0}, snapCounts: Record<Band, number> = {good: 0, fair: 0, poor: 0, none: 0}; let day: SpotState | null = null, dark: SpotState | null = null, loaded = 0, snap = 0, snapFrom: number | null = null, snapTo: number | null = null, sum = 0, n = 0, snapN = 0;
  // a live value beats a daily-forecast value of the same score (live is what the pins show); then the pins' own rank, then the earlier spot
  const better = (a: SpotState, b: SpotState | null) => !b || a.score! > b.score! || (a.score === b.score && (!!b.snap > !!a.snap || (!!a.snap === !!b.snap && a.rank > b.rank)));
  for (const s of states) {
    if (s.loaded) { loaded++; counts[s.score === null ? 'none' : s.band]++; } else if (s.snap) { snap++; snapCounts[s.score === null ? 'none' : s.band]++; if (typeof s.retrieved === 'number') { snapFrom = snapFrom === null ? s.retrieved : Math.min(snapFrom, s.retrieved); snapTo = snapTo === null ? s.retrieved : Math.max(snapTo, s.retrieved); } } else continue;
    if (s.score === null) continue;
    if (s.dark) { if (better(s, dark)) dark = s; } else { if (better(s, day)) day = s; sum += s.score; n++; if (!s.loaded && s.snap) snapN++; }
  }
  // the average says the engine's own word for its (rounded) score, as a spot would: never a coarser band word that could read better than the best spot
  const avg = n ? (() => { const mean = sum / n, category = categoryForScore(Math.round(mean)); return {mean, n, category, band: BAND_OF[category] ?? 'none' as Band, snapN}; })() : null;
  return {total: states.length, loaded, snap, snapCounts, snapFrom, snapTo, counts, best: day ?? dark, allDark: !day && !!dark, avg};
}
const BAND_WORD = {good: 'good', fair: 'fair', poor: 'poor', none: 'not rated'} as const;
const BAND_INK = {good: 'green', fair: 'amber', poor: 'red', none: 'grey'} as const;
/** The bar's key, for the pill's tooltip. */
export const BAR_KEY = 'Bar: spots per band, green good, amber fair, red poor, grey not rated; striped segments are from the daily forecast, not live; dashed not loaded.';
/** What one pill says. `word` is the pins' rating word (ui/Condition conditionWord); colours are the bands' CSS colours. The aria label spells out each band with its
 *  colour so "2 good" cannot be heard as a count of GOOD-rated spots only ("in the good band"). */
export interface SnapInfo {/** the clock now (ms), for the age of the model run */ nowMs: number; /** a retrieval time in words ("Mon, Nov 9 · 11:40 PM PST") */ fmt: (ms: number) => string}
/** "9 h", "40 min", "2 d": how old a model run is. */
export const ageWords = (nowMs: number, ms: number) => { const h = Math.max(0, nowMs - ms) / 3600000; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`; };
export function pillText(name: string, s: GroupSummary, word: (category: string) => string, color: Record<Band, string>, snapshot?: SnapInfo, loadingSnapshot = false, countOnly = false, ends?: [string, string, string?] | null): {html: string; label: string; title: string; color: string} {
  const escC = (t: string) => t.replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]!), nSpots = `${s.total} spot${s.total === 1 ? '' : 's'}`;
  // far out (a seaboard or a coast): the name and the count, no reading; tapping zooms in
  // a cluster's name keeps its "to" visible: each end takes its own ellipsis
  const nameHtml = ends ? `<b class="xc-name xc-pair"><span class="xc-a">${escC(ends[0])}</span><span class="xc-to">${ends[2] ?? ' to '}</span><span class="xc-b">${escC(ends[1])}</span></b>` : `<b class="xc-name">${escC(name)}</b>`;
  if (countOnly) return {html: `${nameHtml}<span class="xc-best"><span class="xc-none">${nSpots} · zoom in for ratings</span></span>`, label: `${name}: ${nSpots}. Zoom in for ratings.`, title: `${name}: ${nSpots}. Zoom in for ratings.`, color: color.none};
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]!);
  const snap = snapshot ? s.snap : 0, unloaded = s.total - s.loaded - snap, covered = s.loaded + snap, partial = covered > 0 && unloaded > 0, w = s.best ? word(s.best.category!) : '';
  const head = covered === 0 ? (loadingSnapshot ? 'Loading forecast…' : 'Not loaded yet') : !s.best ? (unloaded ? 'No ratings yet · loading' : 'No ratings this hour') : null;
  const fromSnap = !!s.best?.snap && !!snapshot, ageOfBest = fromSnap && typeof s.best!.retrieved === 'number' ? ageWords(snapshot!.nowMs, s.best!.retrieved) : snapshot && s.snapFrom !== null ? ageWords(snapshot.nowMs, s.snapFrom) : '';
  // the age of the best spot's model run is in the visible key, so it is read on the phone too (the counts line is hidden there)
  const runAgeFor = () => (snapshot && s.snapFrom !== null ? ageWords(snapshot.nowMs, s.snapFrom) : '');
  const base = partial ? `Best of ${covered}/${s.total}` : 'Best', fc = ageOfBest ? `forecast ${ageOfBest} old` : 'daily forecast';
  // the key's forecast part is its own span: the phone hides it (the pill is too narrow for "Best, forecast 9 h old: Surfable") and shows the age on a line of its own instead (`xc-age`)
  const kl = (t: string) => `<span class="xc-kl">, ${t}</span>`, keyHtml = s.allDark ? (fromSnap ? `After dark${kl(fc)} ·` : 'After dark ·') : fromSnap ? `${base}${kl(fc)}:` : `${base}:`;
  // the AVERAGE leads, labelled as one; "Avg of n/m" whenever it is not over every spot (unrated, dark, unloaded); the best spot follows so a firing spot is not hidden
  const avgPartial = !!s.avg && s.avg.n < s.total, snapInAvg = !!s.avg && s.avg.snapN > 0 && !!snapshot, avgAge = runAgeFor(), avgWord = s.avg ? word(s.avg.category) : '';
  const avgKey = s.avg ? `Avg${avgPartial ? ` of ${s.avg.n}/${s.total}` : ''}${snapInAvg ? kl(avgAge ? `forecast ${avgAge} old` : 'daily forecast') : ''}:` : '';
  // the phone shows how much of the pill is the daily forecast, and how old (the counts line is hidden there)
  const ageLine = snap ? `<small class="xc-age">striped = ${snap} of ${s.total} forecast${ageOfBest || runAgeFor() ? `, ${ageOfBest || runAgeFor()} old` : ''}</small>` : '';
  const part = (c: Record<Band, number>, kind: string) => (['good', 'fair', 'poor', 'none'] as const).filter((b) => c[b]).map((b) => (b === 'none' ? `${c[b]} not rated (${BAND_INK[b]})` : `${c[b]} ${kind}in the ${BAND_WORD[b]} band (${BAND_INK[b]})`));
  const spread = [...part(s.counts, snap ? 'live, ' : ''), ...(snap ? part(s.snapCounts, 'from the daily forecast, ') : []), ...(unloaded ? [`${unloaded} not loaded`] : [])].join(', ');
  // one source line: which model run, how old, rated with the current rules as of that run, not live, and why it can differ from a pin
  const run = snapshot && s.snapFrom !== null && s.snapTo !== null ? `${snapshot.fmt(s.snapFrom)}${s.snapTo - s.snapFrom >= 60000 ? ` to ${snapshot.fmt(s.snapTo)}` : ''}` : '', runAge = snapshot && s.snapFrom !== null ? ageWords(snapshot.nowMs, s.snapFrom) : '';
  const src = snap && run ? ` Daily forecast: the model run retrieved ${run} (${runAge} old), rated with the current rules as of that run; not live. A pin loads the newest run, so the two can differ.` : '';
  const avgLead = s.avg && !s.allDark ? `average ${avgWord.toLowerCase()}, provisional (the mean score ${Math.round(s.avg.mean)} of 100 over ${s.avg.n} rated daylight spot${s.avg.n === 1 ? '' : 's'} of ${s.total}${snapInAvg ? ', daily-forecast values included' : ''}); ` : '';
  const lead = head ? head.toLowerCase() : avgLead + `${s.allDark ? 'after dark, the highest is' : fromSnap ? `${partial ? `best of the ${covered} covered of ${s.total}` : 'best'}, from the daily forecast (model run ${ageOfBest} old):` : partial ? `best of the ${covered} ${snap ? 'covered' : 'loaded'} of ${s.total}:` : 'best:'} ${w.toLowerCase()} at ${s.best!.name}`;
  const label = `${name}: ${lead}; ${spread}; ${s.total} spot${s.total === 1 ? '' : 's'}.${src} Show this coast.`;
  const seg = (n: number, c: string, cls = '') => (n ? `<i class="${cls}" style="flex-grow:${n};background:${c}"></i>` : '');
  const html = nameHtml
    + `<span class="xc-best">${head ? `<span class="xc-none">${head}</span>` : s.avg && !s.allDark
      ? `<i class="xc-dot" aria-hidden="true"></i><span class="xc-k">${avgKey}</span> ${esc(avgWord)}</span><span class="xc-bestl"><span class="xc-avgbest">best ${esc(w)}${s.best!.snap && snapshot ? `<span class="xc-bsnap"> (forecast${typeof s.best!.retrieved === 'number' ? ` ${ageWords(snapshot.nowMs, s.best!.retrieved)}` : ''})</span>` : ''}</span><span class="xc-spot"> · ${esc(s.best!.name)}</span>`
      : s.allDark
      // after dark: the key on its own line, the highest word and its spot on the next (one line clipped at 1440 with the forecast age in the key)
      ? `<i class="xc-dot" aria-hidden="true"></i><span class="xc-k">${keyHtml.replace(/ ·$/, '')}</span></span><span class="xc-bestl"><span class="xc-avgbest">highest ${esc(w)}</span><span class="xc-spot"> · ${esc(s.best!.name)}</span>`
      : `<i class="xc-dot" aria-hidden="true"></i><span class="xc-k">${keyHtml}</span> ${esc(w)}<span class="xc-spot"> · ${esc(s.best!.name)}</span>`}</span>`
    + `<span class="xc-bar" aria-hidden="true">${seg(s.counts.good, color.good)}${seg(s.counts.fair, color.fair)}${seg(s.counts.poor, color.poor)}${seg(s.counts.none, color.none)}${snap ? seg(s.snapCounts.good, color.good, 'xc-snap') + seg(s.snapCounts.fair, color.fair, 'xc-snap') + seg(s.snapCounts.poor, color.poor, 'xc-snap') + seg(s.snapCounts.none, color.none, 'xc-snap') : ''}${seg(unloaded, 'transparent', 'xc-unl')}</span>`
    + ageLine
    + `<small class="xc-n">${s.total} spot${s.total === 1 ? '' : 's'}${s.loaded && s.loaded < s.total ? ` · ${s.loaded} live` : ''}${snap ? ` · ${snap} forecast, striped` : ''}</small>`;
  return {html, label, title: `${label}\n${BAR_KEY}`, color: s.avg && !s.allDark ? color[s.avg.band] : s.best ? color[s.best.band] : color.none};
}

export interface Rect {left: number; top: number; right: number; bottom: number}
export const overlaps = (a: Rect, b: Rect, gap = 4) => a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
/** How far a pill may slide off its region's centre to clear a neighbour (px), nearest first: down, up, sideways, diagonal. Placement then rejects any nudge that
 *  would lift a pill above one whose region lies north of it, so the map's geography reads the same after the nudge. */
export const MAX_NUDGE = {h: 1.5, w: 0.35};
export function nudges(h: number, w: number): [number, number][] {
  const out: [number, number][] = [[0, 0]], ys = [0.25, 0.5, 0.75, 1, 1.25, 1.5].map((k) => Math.round(h * k)), xs = [0.2, 0.35].map((k) => Math.round(w * k));
  for (const y of ys) out.push([0, y], [0, -y]);
  for (const x of xs) out.push([x, 0], [-x, 0]);
  for (const y of ys.slice(0, 4)) for (const x of xs) out.push([x, y], [-x, y], [x, -y], [-x, -y]);
  return out;
}
const shift = (r: Rect, [dx, dy]: [number, number]): Rect => ({left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy});
/** Which pills to draw, and each one's nudge. Start from the regions and place them north to south, each at the nearest nudge that clears the pills already
 *  placed and, where it can, the pins that stay (`avoid`: the focused spot and favourites): a fixed geographic order, so pills do not jump about when the hour changes. Where one cannot be placed, the
 *  finer of it and the pill in its way (both if equal) is replaced by its parent, which takes the place of all its descendants, and the layout is redone. When nothing
 *  can merge further, the pills are placed in `priority` order (focused, favourites, best rating) and those that still do not fit are not drawn. */
export const TIER = 1e5;
export function layoutPills(leaves: NodeId[], boxFn: (id: NodeId) => Rect | null, priority: (id: NodeId) => number, avoid: Rect[] = [], maxRounds = 64): Map<NodeId, [number, number]> {
  let cur = [...new Set(leaves)];
  const memo = new Map<NodeId, Rect | null>(), box = (id: NodeId) => { if (!memo.has(id)) memo.set(id, boxFn(id)); return memo.get(id)!; };
  const place = (order: NodeId[]) => {
    const placed = new Map<NodeId, [number, number]>(), rects: Rect[] = [], anchors: number[] = [], conflicts: [NodeId, NodeId][] = [];
    for (const id of order) {
      const r = box(id); if (!r) continue;
      const cy = (r.top + r.bottom) / 2, clear = (o: [number, number]) => !rects.some((k) => overlaps(k, shift(r, o)))
        // keep the north-south order: never above a pill whose region is north of this one by more than a few px
        && !anchors.some((a, i) => a < cy - 4 && (rects[i].top + rects[i].bottom) / 2 > cy + o[1]);
      const free = (o: [number, number]) => clear(o) && !avoid.some((k) => overlaps(k, shift(r, o))), ns = nudges(r.bottom - r.top, r.right - r.left);
      const fit = ns.find(free) ?? ns.find(clear);   // over a kept pin only when there is no other room
      if (fit) { placed.set(id, fit); rects.push(shift(r, fit)); anchors.push(cy); continue; }
      // the pill in the way; when none overlaps where it stands (the nudge bounds or the north-south rule ruled every spot out), the nearest placed pill
      const mid = (q: Rect) => [(q.left + q.right) / 2, (q.top + q.bottom) / 2], [mx, my] = mid(r);
      const other = [...placed].find(([k, o]) => overlaps(shift(box(k)!, o), r))?.[0] ?? [...placed.keys()].sort((a, b) => { const [ax, ay] = mid(box(a)!), [bx, by] = mid(box(b)!); return Math.hypot(ax - mx, ay - my) - Math.hypot(bx - mx, by - my); })[0];
      if (other) conflicts.push([id, other]);
    }
    return {placed, conflicts};
  };
  const geo = (ids: NodeId[]) => ids.map((id) => ({id, r: box(id)})).sort((a, b) => (a.r?.top ?? 0) - (b.r?.top ?? 0) || (a.r?.left ?? 0) - (b.r?.left ?? 0) || (a.id < b.id ? -1 : 1)).map((x) => x.id);
  for (let round = 0; round < maxRounds; round++) {
    const {placed, conflicts} = place(geo(cur)), promote = new Set<NodeId>();
    if (!conflicts.length) return placed;
    for (const [a, b] of conflicts) {
      const la = levelOf(a), lb = levelOf(b);
      if (la <= lb && parentOf(a)) promote.add(a);
      if (lb <= la && parentOf(b)) promote.add(b);
    }
    if (!promote.size) break;
    const parents = new Set([...promote].map((p) => parentOf(p)!));
    // a parent replaces every current node under it; a parent that is itself under another promoted parent gives way to that one
    const top = [...parents].filter((p) => !ancestors(p).some((a) => parents.has(a)));
    cur = [...cur.filter((id) => !top.some((p) => id === p || ancestors(id).includes(p))), ...top];
  }
  return place([...cur].sort((a, b) => priority(b) - priority(a) || (a < b ? -1 : 1))).placed;
}
