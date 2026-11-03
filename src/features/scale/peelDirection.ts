/** Which way a spot's waves peel, from the published spot guides (docs/forecast/data/guide-facts.json, field `waveDirection`, sites
 *  Surfnerd and Surf-Forecast.com, retrieved 2026-11-02; the generated src/ocean/spotFactsSourced.ts does not carry that field, so it
 *  is transcribed here). 'both' is the guides' own word or a lagoon/beach with both; a spot the guides do not cover is 'unknown'.
 *  Used only to pick the 3D view's default peel direction; the user can flip it. Not a forecast of today's direction. */
export type PeelDirection = 'left' | 'right' | 'both' | 'unknown';
const GUIDE: Record<string, PeelDirection> = {
  'spot-0': 'both', 'spot-1': 'both', 'spot-2': 'both', 'spot-3': 'both', 'spot-4': 'both', 'spot-5': 'right', 'spot-6': 'right', 'spot-7': 'right', 'spot-8': 'right', 'spot-9': 'left',
  'cs-waddell': 'both', 'cs-manresa': 'both', 'cs-moss-landing': 'both', 'cs-asilomar': 'both', 'cs-carmel': 'both', 'cs-sand-dollar': 'both', 'cs-morro-rock': 'both', 'cs-pismo': 'both',
  'cs-salmon-creek': 'both', 'cs-dillon-beach': 'both', 'cs-point-arena': 'both', 'cs-shelter-cove': 'both', 'cs-north-jetty': 'both', 'cs-moonstone': 'both', 'cs-crescent-city': 'both', 'cs-jalama': 'both',
  'cs-rincon': 'right', 'cs-c-street': 'right', 'cs-county-line': 'both', 'cs-zuma': 'both', 'cs-malibu': 'right', 'cs-topanga': 'right', 'cs-el-porto': 'both', 'cs-hermosa': 'both', 'cs-huntington': 'both',
  'cs-wedge': 'left', 'cs-salt-creek': 'left', 'cs-trestles': 'both', 'cs-oceanside': 'both', 'cs-swamis': 'right', 'cs-cardiff': 'both', 'cs-blacks': 'both', 'cs-windansea': 'both', 'cs-ob-sd': 'both', 'cs-imperial': 'both',
};
export const peelDirectionFor = (spotId: string): PeelDirection => GUIDE[spotId] ?? 'unknown';
/** The default the toggle starts on: the guides' single direction, else a left (the toggle is always shown). */
export const defaultPeel = (d: PeelDirection): 'left' | 'right' => (d === 'right' ? 'right' : 'left');
export const PEEL_NOTE: Record<PeelDirection, string> = {left: 'guides say lefts', right: 'guides say rights', both: 'guides say both', unknown: 'direction not stated by a guide'};
