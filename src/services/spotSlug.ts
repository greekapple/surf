import {allSpots as spots} from '../data/catalog.ts';
import {SLUG_ALIASES, canonicalSpotId} from '../data/spotAliases.ts';
import {buildSlugIndex, resolveSlug, toSlug, type SlugMatch} from '../app/slugs.ts';

/** The ONE slug system (audit B3 index in app/slugs.ts + dedupe-pairs aliases). Every live spot has one unique slug; the slug or id of a spot that was MERGED into another resolves to its successor (SLUG_ALIASES / SPOT_ALIASES, applied
 *  first and never equal to a live spot's slug: a test); an old bare shared name stays ambiguous (the chooser). Pure (no React), so it is tested; app/routes.ts re-exports it. */
const slugIndex = buildSlugIndex(spots);
export {toSlug};
export const slugFor = (spotId: string) => slugIndex.slugOf.get(canonicalSpotId(spotId)) ?? toSlug(spotId);
export const matchSpotSlug = (slug: string, available?: (id: string) => boolean): SlugMatch => {
  const s = slug.trim().toLowerCase(), alias = SLUG_ALIASES[s] ?? (canonicalSpotId(slug.trim()) !== slug.trim() ? canonicalSpotId(slug.trim()) : null);
  if (alias && (!available || available(alias))) return {kind: 'spot', id: alias};
  return resolveSlug(slugIndex, slug, available);
};
export const spotIdForSlug = (slug: string | null, available?: (id: string) => boolean): string | null => { if (!slug) return null; const m = matchSpotSlug(slug, available); return m.kind === 'spot' ? m.id : null; };
export const slugIndexForTests = slugIndex;
