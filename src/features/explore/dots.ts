import type {HeadlineSurf, HeadlineText} from '../../services/headlineSurf.ts';
import type {Band, GroupSummary} from './coastGroups.ts';

/** map-dots (user, 2026-11-12; spec docs/specs/2026-11-12-map-dots.md): zoomed out the map is a clean field; at coast zoom one small numbered dot per group;
 *  close in one dot per spot. The dot's STYLE says what kind of number it carries, so the map needs no words:
 *  - `est`  solid fill + number: our surf estimate (MOP or v1), the spot page's own range, as its midpoint;
 *  - `nws`  dashed ring + number: the NWS surf forecast (theirs, not ours);
 *  - `off`  hollow ring, no number: offshore height only (never shown as a dot number);
 *  - `snap` striped, no number: the daily forecast (the day's capture), not a live value;
 *  - `none` small grey ring: not loaded yet, or nothing to show this hour.
 *  A saved or stale copy keeps its kind and is drawn faded. This module is pure: ExploreView builds the dots from it, the engine draws them. */
export type DotKind = 'est' | 'nws' | 'off' | 'snap' | 'none';
/** The zoom bands (Leaflet-equivalent zoom, as everywhere at the engine seam): nothing below GROUPS_FROM; group dots up to SPOTS_FROM; spot dots from there;
 *  spot names on the map (where they do not collide) from NAMES_FROM. The selected spot shows from GROUPS_FROM, with its name. */
export const DOT_ZOOM = {groupsFrom: 6, spotsFrom: 8.5, namesFrom: 11} as const;

/** The dot's number from the SAME display string the spot page shows for the hour (headlineText().value), so the two can never disagree:
 *  a range "4–6 ft" gives its midpoint (5), "about 4 ft" gives 4, the NWS "up to 3 ft" gives "≤3", "Flat" gives "<1". Feet are whole numbers,
 *  metres one decimal; under 1 ft (0.3 m) is "<1" ("<.3"). Anything else (Unavailable, a dash) gives null: no number. */
export function dotNumber(value: string, unit: 'ft' | 'm'): string | null {
  const v = value.replace(/\s*≈\s*Hawaiian/, '').trim();
  // a midpoint exactly between two steps rounds DOWN (data-honesty review: "3–4 ft" is 3, never its top), so the dot never reads bigger than the page's range
  const half = (x: number) => Math.ceil(x - 0.5 - 1e-9);
  const fmt = (x: number) => (unit === 'm' ? (x < 0.3 ? '<.3' : x >= 10 ? String(half(x)) : String(half(x * 10) / 10)) : x < 1 ? '<1' : String(half(x)));
  if (/^flat\b/i.test(v)) return unit === 'm' ? '<.3' : '<1';
  let m = /^up to ([\d.]+)\s/.exec(v); if (m) { const f = fmt(Number(m[1])); return f.startsWith('<') ? f : '≤' + f; }
  m = /^about ([\d.]+)\s/.exec(v); if (m) return fmt(Number(m[1]));
  m = /^([\d.]+)–([\d.]+)\s/.exec(v); if (m) return fmt((Number(m[1]) + Number(m[2])) / 2);
  m = /^([\d.]+)\s/.exec(v); if (m) return fmt(Number(m[1]));
  return null;
}

/** What a spot's dot is at the hour: its kind, its number (only for `est` and `nws`) and whether it is a faded (saved, stale) copy. */
export interface DotFace {kind: DotKind; num: string | null; faded: boolean; /** the number with its unit and kind in words, for the tooltip, the list and screen readers */ words: string}
export function dotFace(h: HeadlineSurf | null, t: HeadlineText | null, unit: 'ft' | 'm', o: {loaded: boolean; snap?: boolean; /** the daily forecast's capture time in words */ captured?: string}): DotFace {
  if (o.snap) return {kind: 'snap', num: null, faded: false, words: `daily forecast, not live${o.captured ? ` · captured ${o.captured}` : ''}`};
  if (!h || !t || !o.loaded) return {kind: 'none', num: null, faded: false, words: o.loaded ? 'no surf number this hour' : 'not loaded yet'};
  if (h.kind === 'estimate') { const num = dotNumber(t.value, unit); return num === null ? {kind: 'none', num: null, faded: false, words: 'no surf number this hour'} : {kind: 'est', num, faded: !!h.saved, words: `${t.value} · ${t.tag}`}; }
  if (h.kind === 'official') { const num = dotNumber(t.value, unit); return num === null ? {kind: 'none', num: null, faded: false, words: 'no surf number this hour'} : {kind: 'nws', num, faded: !!h.stale, words: `${t.value} · ${t.tag}`}; }
  if (h.kind === 'offshore') return {kind: 'off', num: null, faded: !!h.saved, words: t.label.replace(/^≈ /, '')};   // "7 ft offshore · not surf size" (+ "· saved copy")
  return {kind: 'none', num: null, faded: false, words: h.kind === 'demonstration' ? 'demonstration · not live' : 'no surf number this hour'};
}
/** The kind in a few words (the group list's source column and the legend). */
export const KIND_WORDS: Record<DotKind, string> = {est: 'our estimate', nws: 'NWS forecast', off: 'offshore only', snap: 'daily forecast', none: 'not loaded'};

/** The swell notch: the bearing the dominant swell comes FROM (degrees, 0 = north), or null when there is no swell partition. */
export function swellFrom(primary: {height: number; direction: number; period: number} | null | undefined): number | null {
  if (!primary || !Number.isFinite(primary.direction) || !Number.isFinite(primary.height) || primary.height <= 0) return null;
  return ((primary.direction % 360) + 360) % 360;
}

/** A group's dot is its best spot's dot (the summary's best: highest rated daylit spot, live before daily forecast), coloured by that spot's band.
 *  With no rated spot it is a grey ring (loading or unrated). Returns the spot id the dot stands for, or null. */
export const groupBest = (s: GroupSummary): string | null => s.best?.id ?? null;

/** The band colours' ink: the number is dark on a light fill and white on a dark one (relative luminance, sRGB). */
export function inkFor(rgb: [number, number, number]): 'dark' | 'light' {
  const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? 'dark' : 'light';
}
export type {Band};
