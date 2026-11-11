/** Spot URL slugs (audit F7 / B3). Every spot gets one unique slug: its name, or, where two spots share a name, the name plus its region
 *  ("s-turns-outer-banks", "s-turns-maui"), plus "-2", "-3" in catalogue order when even that repeats (same name, same region).
 *  The old bare slug ("s-turns") is kept as an alias only where it is unambiguous among the spots the app can show; otherwise it resolves to
 *  the list of candidates, so a shared link never silently opens the wrong spot. Pure, for tests. */
export interface SlugSpot {id: string; name: string; region: string}
export const toSlug = (name: string) => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface SlugIndex {slugOf: Map<string, string>; idOf: Map<string, string>; bare: Map<string, string[]>}
export function buildSlugIndex(spots: readonly SlugSpot[]): SlugIndex {
  const bare = new Map<string, string[]>();
  for (const s of spots) bare.set(toSlug(s.name), [...(bare.get(toSlug(s.name)) ?? []), s.id]);
  const slugOf = new Map<string, string>(), idOf = new Map<string, string>();
  // unique names keep their bare slug (every existing link stays valid); they are claimed first so a qualified slug can never take one
  for (const s of spots) { const b = toSlug(s.name); if (bare.get(b)!.length === 1) { slugOf.set(s.id, b); idOf.set(b, s.id); } }
  for (const s of spots) {
    if (slugOf.has(s.id)) continue;
    const q = toSlug(`${s.name} ${s.region}`);
    let slug = q;
    for (let n = 2; idOf.has(slug); n++) slug = `${q}-${n}`;
    slugOf.set(s.id, slug); idOf.set(slug, s.id);
  }
  return {slugOf, idOf, bare};
}

export type SlugMatch = {kind: 'spot'; id: string} | {kind: 'ambiguous'; ids: string[]} | {kind: 'unknown'};
/** What a URL slug points at. `available`: the spots the app can show now (an old bare slug is an alias when exactly one of them has that name). */
export function resolveSlug(index: SlugIndex, slug: string, available?: (id: string) => boolean): SlugMatch {
  const s = slug.trim().toLowerCase();
  const exact = index.idOf.get(s);
  if (exact && (!available || available(exact))) return {kind: 'spot', id: exact};
  const cands = (index.bare.get(s) ?? []).filter((id) => !available || available(id));
  if (cands.length === 1) return {kind: 'spot', id: cands[0]};
  if (cands.length > 1) return {kind: 'ambiguous', ids: cands};
  // a spot id is also accepted (older links and tools wrote ?spot=spot-2): ids are unique
  if (index.slugOf.has(slug.trim()) && (!available || available(slug.trim()))) return {kind: 'spot', id: slug.trim()};
  return {kind: 'unknown'};
}

/** "Did you mean": spots whose name (or name and region) share words with an unknown slug, best first (most shared words, then the shorter name). */
export function suggestSpots<T extends SlugSpot>(slug: string, spots: readonly T[], limit = 5): T[] {
  const words = toSlug(slug).split('-').filter((w) => w.length > 1);
  if (!words.length) return [];
  const scored = spots.map((s) => {
    const name = toSlug(s.name).split('-'), all = new Set([...name, ...toSlug(s.region).split('-')]);
    return {s, hit: words.filter((w) => all.has(w) || (w.length >= 4 && name.some((n) => n.startsWith(w)))).length, len: s.name.length};
  }).filter((x) => x.hit > 0);
  return scored.sort((a, b) => b.hit - a.hit || a.len - b.len).slice(0, limit).map((x) => x.s);
}
