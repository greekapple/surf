/** Per-route document titles (audit R20): history, tabs and screen readers can tell the pages apart. "Page · Swello", never an em dash (RULES). Pure, for tests. */
export const BRAND = 'Swello';
const SECTION_TITLES: Record<string, Record<string, string>> = {
  explore: {'': 'Ocean map', wind: 'Wind map', swell: 'Swell map', compare: 'Compare spots', discover: 'Find spots'},
  quiver: {'': 'My boards', showroom: 'Showroom', match: 'Board Match', compare: 'Compare boards'},
  personal: {'': 'Personal', spots: 'Favorite spots', preferences: 'Surf preferences', journal: 'Surf journal', account: 'Data & privacy', profile: 'Edit profile',
    units: 'Units', appearance: 'Appearance', privacy: 'Privacy', terms: 'Terms', credits: 'Data sources & credits'},
};
/** `spotName`: the spot in view on Forecast pages. `notFound`: the route or the spot is unknown. */
export function docTitle(area: string, section: string, opts: {spotName?: string | null; notFound?: 'page' | 'spot' | null} = {}): string {
  if (opts.notFound === 'page') return `Page not found · ${BRAND}`;
  if (opts.notFound === 'spot') return `Spot not found · ${BRAND}`;
  if (area === 'home') return `${BRAND} · Surf forecasts and ocean intelligence`;
  if (area === 'forecast') {
    const name = opts.spotName?.trim();
    if (section === 'wave-scale') return `${name ? `Wave scale, ${name}` : 'Wave scale'} · ${BRAND}`;
    return `${name ? `${name} surf forecast` : 'Surf forecast'} · ${BRAND}`;
  }
  const t = SECTION_TITLES[area]?.[section] ?? SECTION_TITLES[area]?.[''];
  return t ? `${t} · ${BRAND}` : BRAND;
}
