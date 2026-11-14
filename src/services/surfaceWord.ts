// forecast-visuals B (user via lead, 2026-11-14): the day card's surface word for the day's best window: Glassy / Clean / Textured / Choppy.
// OUR rule from the model's wind at that hour (speed) and how it meets this beach (offshore / cross-shore / onshore; windRelationship). It is a reading of the
// wind, not an observation of the water; the key says "surface: our rule from the wind". Unknown shore relation (no surveyed facing) or no wind: no word.
export type Surface = 'Glassy' | 'Clean' | 'Textured' | 'Choppy';
/** mph thresholds: under GLASSY_MPH any direction reads glassy; at or above STRONG_MPH any direction reads choppy; offshore stays clean below LIGHT_MPH */
export const SURFACE_RULE = {GLASSY_MPH: 4, LIGHT_MPH: 12, STRONG_MPH: 20, /** light onshore under this is textured, not yet choppy */ ONSHORE_LIGHT_MPH: 8, /** gusts this far above the mean wind take a glassy or clean surface to textured */ GUST_SPREAD_MPH: 10} as const;
export function surfaceWord(mph: number | null | undefined, relation: string | null | undefined, gusts?: number | null): Surface | null {
  if (mph === null || mph === undefined || !Number.isFinite(mph) || mph < 0) return null;
  const rel = /^offshore/i.test(relation ?? '') ? 'off' : /cross/i.test(relation ?? '') ? 'cross' : /onshore/i.test(relation ?? '') ? 'on' : null;
  if (!rel) return null;
  const gusty = gusts !== null && gusts !== undefined && Number.isFinite(gusts) && gusts - mph > SURFACE_RULE.GUST_SPREAD_MPH;
  if (mph >= SURFACE_RULE.STRONG_MPH) return 'Choppy';
  if (mph < SURFACE_RULE.GLASSY_MPH) return gusty ? 'Textured' : 'Glassy';
  if (rel === 'off') return mph < SURFACE_RULE.LIGHT_MPH && !gusty ? 'Clean' : 'Textured';
  if (rel === 'cross') return 'Textured';
  return mph < SURFACE_RULE.ONSHORE_LIGHT_MPH ? 'Textured' : 'Choppy';
}
