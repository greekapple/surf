/** One place for the map's tunables (map-seamless brief: "color scales, breakpoints, particle settings, cache sizes and zoom thresholds all live in one config module").
 *  Pure: no Leaflet, no DOM. Colour scales are added in Stage 3 (this file grows). */
export const mapConfig = {
  /** Held-frame swap (Stage 1): the new field is drawn off-screen in its own canvases, then faded in over this long while the old one fades out. */
  crossfadeMs: 250,
  /** Frame caches (decoded frames, in memory): regional frames and the worldwide frames. Prefetch fills them, so they must hold the current hour, its neighbours and the next layer. */
  cache: {regionalFrames: 64, regionalTtlMs: 10 * 60_000, globeFrames: 48, globeTtlMs: 30 * 60_000, /** the Worker answers /api/globe with this Cache-Control max-age (a frame is fixed per field and valid time) */ globeHttpMaxAgeS: 300},
  /** Idle prefetch (Stage 1): after the visible frames have settled, fetch these neighbours one at a time, never on a phone that asked to save data. */
  prefetch: {hoursAhead: [3, 6, 9], hoursBack: [] as number[], nextLayer: true, idleTimeoutMs: 2500, /** do not prefetch on a slow connection */ skipEffectiveTypes: ['slow-2g', '2g', '3g']},
  /** Zoom and bounds (Stage 1): the world must fill the viewport width, and the map may not be dragged past the poles. */
  view: {baseMinZoom: 2, maxZoom: 14, tileSize: 256, maxLat: 85, maxBoundsViscosity: 1, zoomSnap: 0.5},
  /** Level of detail thresholds (zoom). */
  zoom: {far: 9, world: 5},
  /** Stage 2a: the coastal fill paints model-less cells next to the coast from their nearest ocean neighbours, at most this many cells deep (0.5° each at the native grid: 2 = about 110 km), so the colour reaches the shoreline
   *  without inventing a field over land or ice; everything beyond stays empty. The regional nest is blended into the global grid over `nestFeatherDeg` inside its own boundary. */
  fill: {coastCells: 2, nestFeatherDeg: 1.5},
  /** Field opacity over the sea (the basemap under it is a flat mid-grey land); land is never painted. */
  fieldAlpha: 1,
  /** Colour scales (Stage 3, user decision 2026-11-04: Swello's own surf-first ramps, not a copy of any other map). ONE fixed absolute scale per layer: it never depends on zoom, viewport, region or time.
   *  `breakpoints` are in the DISPLAY unit and are spaced evenly along the ramp (so the surfable 2 to 10 ft has as many steps as the rare 15 to 30 ft); values beyond the ends clamp ("30+"). The ramp is built in CIE LCH:
   *  lightness rises steadily from `lMin` (calm, the darkest) to `lMax`, so it reads in greyscale and for colour-blind viewers, the calm end is a saturated dark colour (never pale like ice or "no data"), and each layer has its own hue path. */
  scales: {
    WAVES: {unit: 'm', label: 'Offshore wave height · not surf size', displayUnit: 'ft', perDisplayUnit: 0.3048, breakpoints: [0, 1.6, 3.3, 5, 6.6, 10, 13, 20, 30], /** Swello's own colours in the ORDER of Surfline's wave-height charts (user, 2026-11-06: "I liked Surfline's colors"; supersedes the Windy colours for Waves only; Swell keeps them):
     *  navy, blue, sky, cyan, sea green, lime, yellow, orange, crimson, one stop per breakpoint, joined in RGB. NOT copied from Surfline and NOT yet checked against a capture of their chart (their chart page is behind a bot check
     *  headless): the order and feel come from memory. This table is the one place to retune when the user's phone screenshot arrives (tests: src/tests/map-ramps.test.ts). The same in light and dark. */ stops: ['#22336e', '#2a5cb0', '#2b8bd4', '#24b0c8', '#35bd8a', '#9ccc46', '#f2cb3a', '#ee7a30', '#c8324f'], hues: [[0, 262], [0.14, 236], [0.3, 196], [0.5, 150], [0.7, 106], [0.86, 66], [1, 40]], chroma: 62, light: {light: [22, 92], dark: [28, 92]}},
    SWELL: {unit: 'm', label: 'Swell height · not surf size', displayUnit: 'ft', perDisplayUnit: 0.3048, breakpoints: [0, 1.6, 3.3, 5, 6.6, 10, 13, 20, 30], /** Windy's wave-height colours (user decision 2026-11-04, docs/specs/2026-11-04-map-review.md): one colour per breakpoint, sampled from Windy overlay captures (deep blue, steel blue, blue, indigo, violet, magenta, crimson, salmon, pale salmon) and joined in RGB, evenly spaced like the ticks (Windy's legend: 1.6 / 3.3 / 5 / 6.6 / 20 / 30 ft) */ stops: ['#2646a0', '#327196', '#346496', '#4448a0', '#7a46ae', '#a03787', '#a83870', '#c1645c', '#cda096'], hues: [[0, 292], [0.25, 318], [0.5, 350], [0.7, 378], [0.86, 412], [1, 446]], chroma: 66, light: {light: [22, 92], dark: [28, 92]}},
    PERIOD: {unit: 's', label: 'Wave period (peak)', displayUnit: 's', perDisplayUnit: 1, breakpoints: [4, 6, 8, 10, 12, 14, 16, 18, 20], hues: [[0, 285], [0.35, 258], [0.65, 232], [1, 205]], chroma: 58, light: {light: [22, 92], dark: [28, 92]}},
    WIND: {unit: 'm/s', label: 'Wind speed at 10 m', displayUnit: 'kt', perDisplayUnit: 0.514444, breakpoints: [0, 5, 10, 15, 20, 25, 30, 40, 50], hues: [[0, 262], [0.2, 205], [0.42, 128], [0.6, 82], [0.8, 46], [1, 10]], chroma: 62, light: {light: [22, 90], dark: [28, 90]}},
  },
} as const;
export type ScaleKey = keyof typeof mapConfig.scales;

/** The smallest zoom at which the world is at least as wide as the viewport (no empty strip beside it), on the 0.5 zoomSnap grid, never below the base minimum. */
export function minZoomFor(viewportWidthPx: number, cfg: Pick<typeof mapConfig.view, 'baseMinZoom' | 'tileSize'> = mapConfig.view): number {
  const z = Math.log2(Math.max(1, viewportWidthPx) / cfg.tileSize);
  return Math.max(cfg.baseMinZoom, Math.ceil(z * 2) / 2);
}
