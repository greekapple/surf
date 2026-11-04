# T-117 handoff (engineering): the map field, Windy style: ramps, particles, point values, dark theme

Branch `t117-map-field` (forecast-trust ff93a1d merged). tsc clean, 488 tests (+9: `map-point.test.ts`, extended `map-colors.test.ts`), build OK, t043-map ALL PASS, t115-zoom ALL PASS (desktop, iPhone, Android). Light QA: one load per shot/profile. Shots: `~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t117/{waves,swell,wind,dark,reduced}.png` (toolkit `t117-layers.mjs`).

## Point API (agreed with product through the lead; already announced)
`src/map/field.ts`: `sampleField(fields, lat, lon): PointValue | null`, `PointValue {value, unit 'm'|'s'|'m/s', dirFrom (FROM bearing, 0=N), layer 'WAVES'|'SWELL'|'WIND'|'PERIOD', validAt, source}`. Raw units; the caller converts. Null on land (even-odd point-in-polygon over our own coasts, `isLandPoint`), enclosed water ("Not covered") and outside the grid. Implementation in the leaflet-free `src/map/fieldData.ts` (Field type, buildField, the one shared sampler `sampleAll`, `sampleField`). **The painter and the label share that sampler**; `colorLut/lutIndex` (colors.ts) are shared too, and `map-point.test.ts` pins that the label value's colour equals the painted pixel. A WAVES field has no period; for "12 ft W · 11 s" take the period from a PERIOD frame or the point forecast.

## Ramps, each with its own legend data
- Waves and swell: Windy's wave ramp at the true height (unchanged from T-115 round 2).
- **Wind: Windy's wind ramp at the true speed**, re-sampled from the wind map's legend strip (knots 0, 5, 10, 20, 30, 40, 60; equal spacing between ticks, interpolated in knots): violet-blue → blue → teal → green → olive → rust → magenta → violet → slate. Pinned by tests at each stop.
- **Period: no Windy capture of its legend exists**, so it keeps the wave ramp teal → red across its 6 to 18 s range (an honest fallback, said here and in the code).
- `legendTicks(unit, wide)` (colors.ts) gives each layer its own tick values in native units (m, s, m/s) inside its range; `rampFor(unit, wide)` its gradient. Product's legend can show ticks from these; the current lo/hi chip keeps working.

## Particles (Windy's two looks)
- Waves, swell and period: short white dashes (6 px) drifting slowly with the wave direction, fading in and out, no trails; density about one per 40 px (up to 1400), four alpha buckets so a frame is four strokes. Wind: streamlines (trails), speed from the wind.
- The "particles animation" toggle is the existing `opts.flow`. **Reduced motion = still**: the same marks frozen (dashes, or short streamlines for wind), no drift or trails (the old arrow fallback is gone; `opts.arrows` still draws arrows when asked).
- Frame rate with particles running (idle, 150 frames): 60 fps desktop and 60 fps iPhone at 4x CPU, for waves and wind; zoom 49 to 58 fps (the particles pause during movement).

## Dark theme
`basemap.css`: with the field on, the dark theme gets the same Windy-style grey basemap, darker (charcoal land via a lower brightness filter, ground #3b3b3f, labels brightened). The light theme is unchanged.

## Files
`src/map/colors.ts`, `src/map/field.ts`, new `src/map/fieldData.ts`, `src/map/basemap.css`, tests `map-point.test.ts` and `map-colors.test.ts`; toolkit `t117-layers.mjs`. Nothing in `src/features/explore/` this time. Left: the period layer's own Windy palette (needs a capture), and the thumbnails/legend UI that product owns.
