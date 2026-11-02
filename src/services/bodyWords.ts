/** Body-part wave size words (T-046). Heights are FACE heights (trough to crest), never the Hawaiian scale.
 *  Anchors follow the "simplified wave face scale" published by OceanFit (Slade, 2022): 1 ft ankle, 2 knee, 3 waist, 4 chest, 5 head, 6–11 overhead, 12 double overhead.
 *  Thigh (2.5 ft) and shoulder (4.5 ft) are NOT in that source; they are in-between anchors we add so the words step smoothly.
 *  The terms are an informal convention that differs by region and by surfer, so every use is labelled approximate. */
export const BODY_WORD_SOURCES = [
  {title: 'OceanFit, "Wave Height: Is it 5 feet, head-high or overhead?" (Andre Slade, 2022): face-height anchors', url: 'https://oceanfit.com.au/education/wave-height-is-it-5-feet-head-high-or-overhead/'},
  {title: 'University of Hawaiʻi at Mānoa, Exploring Our Fluid Earth, "Weird Science: Communicating Wave Sizes: Local Scale": why local-scale calls differ from face height', url: 'https://www.manoa.hawaii.edu/exploringourfluidearth/physical/waves/wave-and-wave-properties/weird-science-communicating-wave-sizes-local-scale'},
] as const;
export const BODY_WORDS_NOTE = 'Approximate. Body words are an informal convention, here for face height.';

/** [word, anchor ft]; a height takes the word of the nearest anchor below 6 ft, then overhead from 5.5 ft, double overhead from 12 ft. */
const ANCHORS: [string, number][] = [['ankle', 1], ['knee', 2], ['thigh', 2.5], ['waist', 3], ['chest', 4], ['shoulder', 4.5], ['head', 5]];
/** Where the words sit on a drawn scale, in face feet: the source's anchors (overhead starts at 6 ft, double overhead at 12 ft). Thigh and shoulder are our in-between anchors. */
export const BODY_TICKS: readonly (readonly [string, number])[] = [...ANCHORS, ['overhead', 6], ['double overhead', 12]];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Single word for a face height in feet, or null for a missing or negative height. */
export function bodyWord(ft: number | null | undefined): string | null {
  if (!finite(ft) || ft < 0) return null;
  if (ft >= 12) return 'double overhead';
  if (ft >= 5.5) return 'overhead';
  return ANCHORS.reduce((best, a) => (Math.abs(a[1] - ft) < Math.abs(best[1] - ft) ? a : best))[0];
}
/** Words for a range: "waist to chest", or "waist high" when both ends fall in one word. Null if either end is unusable. */
export function bodyWords(loFt: number | null | undefined, hiFt: number | null | undefined): string | null {
  const a = bodyWord(loFt), b = bodyWord(hiFt);
  if (!a || !b || (loFt as number) > (hiFt as number)) return null;
  return a === b ? (a === 'overhead' || a === 'double overhead' ? a : `${a} high`) : `${a} to ${b}`;
}
