import {zoneOf} from '../../data/zones.ts';

/** 4E coast groups: when zoomed out, each browsing region shows one pill (its best rating at the hour, which spot, and the spread of bands) instead of its pins.
 *  Regions merge into their zone, then a coast, then a seaboard until the pills fit; no two pills overlap. No average is ever computed: an average hides the one spot that works. */

/** Pills replace pins below this zoom (favourites and the focused spot keep their pin). */
export const COAST_MAX_ZOOM = 7;

/** Coasts above the zones (ZONES, north to south), then the seaboards. Our own grouping for the map; every zone belongs to exactly one coast. */
export const COASTS: [string, string[]][] = [
  ['Pacific Northwest', ['Washington Coast', 'Oregon North Coast', 'Oregon South Coast']],
  ['Northern California', ['North Coast', 'Bay Area']],
  ['Central California', ['Santa Cruz & Monterey', 'Central Coast']],
  ['Southern California', ['Southern California']],
  ['Hawaii', ['Hawaii · Kauai & Niihau', 'Hawaii · Oahu', 'Hawaii · Maui, Molokai & Lanai', 'Hawaii · Big Island']],
  ['New England', ['Maine', 'New Hampshire', 'Massachusetts', 'Rhode Island']],
  ['Mid-Atlantic', ['New York', 'New Jersey', 'Delaware', 'Maryland', 'Virginia']],
  ['Southeast', ['North Carolina', 'South Carolina', 'Georgia']],
  ['Florida', ['Florida']],
];
/** The map groups the small islands with their neighbours, by county (Niihau is in Kauai County; Molokai and Lanai are in Maui County): the browsing zone
 *  "Molokai, Lanai, Niihau" spans the chain from Kauai to Maui, so its centre would sit between Oahu and Maui and force all of Hawaii into one pill. Zone chips are unchanged. */
const MAP_ZONE: Record<string, string> = {Kauai: 'Hawaii · Kauai & Niihau', Niihau: 'Hawaii · Kauai & Niihau', Maui: 'Hawaii · Maui, Molokai & Lanai', Molokai: 'Hawaii · Maui, Molokai & Lanai', Lanai: 'Hawaii · Maui, Molokai & Lanai'};
export const mapZoneOf = (region: string) => MAP_ZONE[region] ?? zoneOf(region);
export const SEABOARDS: [string, string[]][] = [
  ['West Coast', ['Pacific Northwest', 'Northern California', 'Central California', 'Southern California']],
  ['Hawaii', ['Hawaii']],
  ['East Coast', ['New England', 'Mid-Atlantic', 'Southeast', 'Florida']],
];

/** A group node id is "<level>:<name>": 0 region, 1 zone, 2 coast, 3 seaboard. */
export type NodeId = string;
export const nodeId = (level: number, name: string): NodeId => `${level}:${name}`;
export const levelOf = (id: NodeId) => Number(id.slice(0, id.indexOf(':')));
export const nameOf = (id: NodeId) => id.slice(id.indexOf(':') + 1);
export function parentOf(id: NodeId): NodeId | null {
  const lv = levelOf(id), n = nameOf(id);
  if (lv === 0) { const z = mapZoneOf(n); return z === 'Other' ? null : nodeId(1, z); }
  const up = lv === 1 ? COASTS : lv === 2 ? SEABOARDS : null;
  const hit = up?.find(([, kids]) => kids.includes(n));
  return hit ? nodeId(lv + 1, hit[0]) : null;
}
export function ancestors(id: NodeId): NodeId[] { const out: NodeId[] = []; for (let p = parentOf(id); p; p = parentOf(p)) out.push(p); return out; }
/** Every node that holds at least one of these spots' regions, with its spot ids. */
export function buildNodes(spots: {id: string; region: string}[]): Map<NodeId, string[]> {
  const out = new Map<NodeId, string[]>();
  for (const s of spots) for (const n of [nodeId(0, s.region), ...ancestors(nodeId(0, s.region))]) { const l = out.get(n); if (l) l.push(s.id); else out.set(n, [s.id]); }
  return out;
}

export type Band = 'good' | 'fair' | 'poor' | 'none';
/** One spot at the selected hour, from the same rating its pin shows. `rank` is the pins' own priority (favourites, popular, original spots), used only to break a tie. */
export interface SpotState {id: string; name: string; loaded: boolean; score: number | null; category: string | null; band: Band; dark: boolean; rank: number}
export interface GroupSummary {
  total: number; loaded: number;
  /** spots per band among the loaded ones; `none` = loaded but not rated at this hour */
  counts: Record<Band, number>;
  /** the highest-scoring rated DAYLIT spot at this hour; only when every rated spot is in the dark, the highest of those (and `allDark`) */
  best: SpotState | null; allDark: boolean;
}
/** Best and spread from the same per-spot ratings the pins show. A dark spot is never the best while a daylit one is rated (after dark is never a surf window).
 *  Ties on score go to the higher pin rank, then the earlier spot. Nothing is averaged. */
export function summarise(states: SpotState[]): GroupSummary {
  const counts: Record<Band, number> = {good: 0, fair: 0, poor: 0, none: 0}; let day: SpotState | null = null, dark: SpotState | null = null, loaded = 0;
  const better = (a: SpotState, b: SpotState | null) => !b || a.score! > b.score! || (a.score === b.score && a.rank > b.rank);
  for (const s of states) {
    if (!s.loaded) continue; loaded++;
    counts[s.score === null ? 'none' : s.band]++;
    if (s.score === null) continue;
    if (s.dark) { if (better(s, dark)) dark = s; } else if (better(s, day)) day = s;
  }
  return {total: states.length, loaded, counts, best: day ?? dark, allDark: !day && !!dark};
}
const BAND_WORD = {good: 'good', fair: 'fair', poor: 'poor', none: 'not rated'} as const;
const BAND_INK = {good: 'green', fair: 'amber', poor: 'red', none: 'grey'} as const;
/** The bar's key, for the pill's tooltip. */
export const BAR_KEY = 'Bar: spots per band, green good, amber fair, red poor, grey not rated, dashed not loaded.';
/** What one pill says. `word` is the pins' rating word (ui/Condition conditionWord); colours are the bands' CSS colours. The aria label spells out each band with its
 *  colour so "2 good" cannot be heard as a count of GOOD-rated spots only ("in the good band"). */
export function pillText(name: string, s: GroupSummary, word: (category: string) => string, color: Record<Band, string>): {html: string; label: string; title: string; color: string} {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]!);
  const unloaded = s.total - s.loaded, partial = s.loaded > 0 && unloaded > 0, w = s.best ? word(s.best.category!) : '';
  const head = s.loaded === 0 ? 'Not loaded yet' : !s.best ? (unloaded ? 'No ratings yet · loading' : 'No ratings this hour') : null;
  const key = s.allDark ? 'After dark ·' : partial ? `Best of ${s.loaded}/${s.total}:` : 'Best:';
  const spread = (['good', 'fair', 'poor', 'none'] as const).filter((b) => s.counts[b]).map((b) => (b === 'none' ? `${s.counts[b]} not rated (${BAND_INK[b]})` : `${s.counts[b]} in the ${BAND_WORD[b]} band (${BAND_INK[b]})`)).concat(unloaded ? [`${unloaded} not loaded`] : []).join(', ');
  const lead = head ? head.toLowerCase() : `${s.allDark ? 'after dark, the highest is' : partial ? `best of the ${s.loaded} loaded of ${s.total}:` : 'best:'} ${w.toLowerCase()} at ${s.best!.name}`;
  const label = `${name}: ${lead}; ${spread}; ${s.total} spot${s.total === 1 ? '' : 's'}. Show this coast.`;
  const seg = (n: number, c: string, cls = '') => (n ? `<i class="${cls}" style="flex-grow:${n};background:${c}"></i>` : '');
  const html = `<b class="xc-name">${esc(name)}</b>`
    + `<span class="xc-best">${head ? `<span class="xc-none">${head}</span>` : `<i class="xc-dot" aria-hidden="true"></i><span class="xc-k">${key}</span> ${esc(w)}<span class="xc-spot"> · ${esc(s.best!.name)}</span>`}</span>`
    + `<span class="xc-bar" aria-hidden="true">${seg(s.counts.good, color.good)}${seg(s.counts.fair, color.fair)}${seg(s.counts.poor, color.poor)}${seg(s.counts.none, color.none)}${seg(unloaded, 'transparent', 'xc-unl')}</span>`
    + `<small class="xc-n">${s.total} spot${s.total === 1 ? '' : 's'}${partial ? ` · ${s.loaded} loaded` : ''}</small>`;
  return {html, label, title: `${label}\n${BAR_KEY}`, color: s.best ? color[s.best.band] : color.none};
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
