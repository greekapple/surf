/** Spot search with autofill (spec docs/specs/2026-11-10-map-zoom-groups.md §6): one matcher for the map search and the header search.
 *  Matching ignores case, accents and apostrophes ("hookipa" finds Ho'okipa); a name prefix ranks first, then a word start inside the name ("first point" ->
 *  "Malibu - First Point"), then the region's spots ("oahu" lists the Oahu spots), then names one typo away (queries of 5 letters or more). Among equal matches:
 *  favourites, then recent picks, then the name. Deterministic. The index is built once per spot list; a keystroke is a linear pass over plain strings. */
export interface SearchSpot {id: string; name: string; region: string}
export interface SearchHit {id: string; name: string; region: string; kind: 'prefix' | 'word' | 'region' | 'typo'}

/** Lower case, accents off, apostrophes and okina dropped, anything else that is not a letter or digit a single space. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’‘ʻʼ`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
interface Entry {s: SearchSpot; name: string; words: string[]; region: string; regionWords: string[]; order: number}
const indexes = new WeakMap<readonly SearchSpot[], Entry[]>();
function indexOf(spots: readonly SearchSpot[]): Entry[] {
  let ix = indexes.get(spots);
  if (!ix) { ix = spots.map((s, order) => { const name = fold(s.name), region = fold(s.region); return {s, name, words: name.split(' '), region, regionWords: region.split(' '), order}; }); indexes.set(spots, ix); }
  return ix;
}
/** True when a and b differ by at most one edit (insert, delete, substitute, or swap of two neighbours). */
export function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
const KIND_RANK = {prefix: 0, word: 1, region: 2, typo: 3} as const;
/** Ranked matches for a query. `favorites` and `recents` (most recent first) lift a spot among equal matches. */
export function searchSpots(spots: readonly SearchSpot[], query: string, opts: {favorites?: readonly string[]; recents?: readonly string[]; limit?: number} = {}): SearchHit[] {
  const q = fold(query); if (!q) return [];
  const fav = new Set(opts.favorites ?? []), rec = opts.recents ?? [], qWords = q.split(' '), out: {e: Entry; kind: SearchHit['kind']}[] = [];
  const wordStart = (words: string[], text: string[]) => { // every query word starts a word of the text, in order (the last may be partial)
    let j = 0; for (const w of words) { while (j < text.length && !text[j].startsWith(w)) j++; if (j >= text.length) return false; j++; } return true; };
  for (const e of indexOf(spots)) {
    if (e.name.startsWith(q)) { out.push({e, kind: 'prefix'}); continue; }
    if (wordStart(qWords, e.words)) { out.push({e, kind: 'word'}); continue; }
    if (e.region.startsWith(q) || wordStart(qWords, e.regionWords)) { out.push({e, kind: 'region'}); continue; }
    // one typo, for queries of 5 letters or more: against the name's start of the same length (give or take one), or a whole word of the name
    if (q.length >= 5 && (withinOne(q, e.name.slice(0, q.length)) || withinOne(q, e.name.slice(0, q.length + 1)) || withinOne(q, e.name.slice(0, q.length - 1)) || e.words.some((w) => w.length >= 5 && withinOne(q, w)))) out.push({e, kind: 'typo'});
  }
  const lift = (id: string) => (fav.has(id) ? 0 : 1) * 10 + (rec.includes(id) ? rec.indexOf(id) / 10 : 9);
  out.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || lift(a.e.s.id) - lift(b.e.s.id) || (a.e.name < b.e.name ? -1 : a.e.name > b.e.name ? 1 : a.e.order - b.e.order));
  return out.slice(0, opts.limit ?? 50).map(({e, kind}) => ({id: e.s.id, name: e.s.name, region: e.s.region, kind}));
}
/** The inline completion: the top match's remaining letters after what was typed, when the typed text is a prefix of its name (accents and apostrophes
 *  folded). "Pip" + Pipeline -> "eline"; "hoo" + Ho'okipa -> "kipa". Empty when the top match is not a prefix match. */
export function completion(typed: string, hit: SearchHit | undefined): string {
  if (!hit || hit.kind !== 'prefix') return '';
  const q = fold(typed); if (!q) return '';
  // walk the name, folding as we go, until the folded text covers the query; the rest of the name is the completion
  let acc = '';
  for (let i = 0; i < hit.name.length; i++) {
    acc = fold(hit.name.slice(0, i + 1));
    if (acc.length >= q.length && acc.startsWith(q)) { const rest = hit.name.slice(i + 1); return acc !== q ? '' : /[\s\-–·,.]$/.test(typed) ? rest.replace(/^[\s\-–·,.]+/, '') : rest; }   // typed a space already: no second one
  }
  return '';
}

/** Recent picks: the last 5 spot ids picked from a search, newest first. Stored in this browser only (never uploaded); a blocked or full storage is ignored. */
const RECENT_KEY = 'swello-recent-spots', RECENT_MAX = 5;
export function recentSpots(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_MAX) : []; } catch { return []; }
}
export function rememberSpot(id: string): string[] {
  const next = [id, ...recentSpots().filter((x) => x !== id)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable: recents stay empty */ }
  return next;
}
