# T-115 handoff (engineering): the map field uses Windy's colours, rides the zoom, and works on phones

Branch `t115-map-field` (forecast-trust merged). tsc clean, 483 tests (5 new in `src/tests/map-colors.test.ts`), build OK, t043-map ALL PASS, `t115-zoom.mjs` ALL PASS (desktop, iPhone, Android). QA was light: one page load per profile plus a few baseline/diagnostic loads.

## 1. Windy colours
- Stops sampled from the legend strips of `windy/1440-02-waves-layer.png` (waves and swell share one ramp, legend "ft 1.6 3.3 5 6.6 20 30") and `1440-01-wind-map.png` with a small PNG reader; stored in `src/map/colors.ts` (`WINDY_WAVES_FT`, `WINDY_WIND`), pinned by the tests (exact stops, clamping, interpolation, a 2 to 3 m sea shows a clear gradient, legend == field per unit and view, wind and period ramps).
- Waves/swell: Windy's ramp at the TRUE wave height (their legend is non-linear, so we interpolate in feet between the sampled stops): teal calm, blue, indigo, maroon, red, pale salmon at 30 ft. Wind: Windy's wind ramp; period: the wave ramp across its range. Field opacity stays 0.72, land unpainted, "Not covered" hatch and "Offshore wave height · not surf size" unchanged.
- The legend reads the same function: new `rampFor(unit, wide)` (re-exported from `field.ts`, defined in `colors.ts`). **One line in `src/features/explore/ExploreView.tsx`** (product's T-116 area): `ramp={RAMP}` → `ramp={rampFor((frame ?? gframe)!.unit, wide)}` plus its import, otherwise the legend would show the wave ramp for wind. Expect a trivial merge there.
- `docs/design/RULES.md`: new section "Map colours: Windy's ramp (user decision, 2026-11-04)" replacing the no-rainbow rule for the map's sea-state field only.

## 2. No grey while zooming
`src/map/field.ts`: the heat canvas now carries Leaflet's `leaflet-zoom-animated` class and a `zoomanim` handler (offset from `map._latLngBoundsToNewLayerBounds`, scale from `getZoomScale`, the L.Canvas pattern), so it rides the zoom instead of being hidden (the old `visibility:hidden` on zoomstart was the grey flash). The canvas is drawn padded by 25% of the viewport on every side, so pan or a one-level zoom-out shows field at the edges. The redraw is swapped in at zoomend in one frame (moveend and zoomend now coalesce into a single rAF redraw); particles pause during movement as before.
- Redraw cost cut from ~60 to ~20 ms (desktop) and ~70 to ~30 ms (iPhone, 4x CPU): a 256-step colour lookup table and an inland skip (cells whose own pixel and four neighbours 3 cells away are all land are not sampled; the coast stays sampled so the blur reaches the shoreline). `data-draw-ms` on the canvas shows the last redraw time for QA.
- `t115-zoom.mjs` (toolkit): wheel-zooms out and screenshots DURING the animation, measuring the basemap-grey share over the sea. On the old build (the lead's :5180) one mid-zoom frame was 100% grey; on this branch every frame is 0 to 1%. It runs the phone profiles too.

## 3. Phone
iPhone (390x844, DPR 3, touch) and Android (412x915, DPR 2.6): the field draws with 3 to 5 distinct colour stops over the sea at the default view (purple to indigo to blue), no console errors, canvas backing is 1x CSS (the heat canvas is drawn at DPR 1, so well under the DPR 2 cap; the particle canvas keeps min(2, DPR)), zoom frame rate 56 to 57 fps under 4x CPU (worst frame 67 to 83 ms, the redraw) and 58 to 59 fps at 1440. The colour domain is the fixed Windy range (0 to 4 m coastal, 0 to 9 m basin), not data-fitted: a fixed domain keeps colours comparable across hours and with the legend; at 2 to 3 m it already spans indigo to purple to maroon.
- The "flat blue" was the old pale one-hue ramp, not a draw failure.

## Notes
- Mid-zoom screenshots at the right edge show Leaflet's own unloaded basemap tiles (light blue-grey) beyond the data; that is the basemap loading, not the field.
- At 390 the legend label wraps to three lines ("Offshore / Hs · not / surf") from the T-108 narrow-legend fix; T-116's chrome pass should settle the legend/time-bar layout.
- The `SpatialLayer.ts` raster path is unused by the live map (only `field.ts` renders it); I left it alone.
- Local 502s on `/api/provider` showed up in one console check while the upstream quota is still recovering; not related.

## Files
`src/map/colors.ts`, `src/map/field.ts`, `src/features/explore/ExploreView.tsx` (one line), `docs/design/RULES.md`, `src/tests/map-colors.test.ts`; toolkit `t115-zoom.mjs`.
