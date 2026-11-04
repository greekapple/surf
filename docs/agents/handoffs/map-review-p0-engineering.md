# Handoff: map review P0 (engineering), 2026-11-04

Spec: docs/specs/2026-11-04-map-review.md. Branch `map-maplibre`.

## Done
- **Swell holes (both engines): cause found, fixed.** WW3 (`shgt`) and GFS-Wave (`SWELL` partition) leave the swell partition empty (NaN) where the sea is all wind sea: total height equals wind-wave height to the centimetre in those cells (median |Hs − Hs_wind| = 0.000 m over 12,303 WW3 / 51,056 GFS-Wave cells; min real swell 0.05 / 0.03 m, never exactly 0). Not missing data. Swell height is painted 0 ft (calm end) there; pin: "swell: no swell partition: wind sea only"; legend: "0 = no swell (wind sea only)". Server fills in `/api/ocean?field=shgt` (flag `noPartition`), pipeline fills the swell group (manifest `noPartitionIsZero`), `Field.noPartition`, `NO_SWELL_NOTE`. Regional nest not painted over a same-resolution global frame.
- **Windy wave-height colours** (user decision) for Waves and Swell: breakpoints 0 1.6 3.3 5 6.6 10 13 20 30 ft, one explicit RGB stop per breakpoint (`mapConfig.scales.*.stops`), RULES.md updated, tests.
- **Leaflet zoom:** the field is drawn for the TARGET view at `zoomanim` and animated into place (layer-bounds maths), final placement in the zoomend task; a world-wide coarse tile layer (level 3) always under the detailed tiles. Real wheel jumps of 1, 3, 5 levels: no floating rectangle, no grey sea, no double image (t136 6/6 dark and light; product's map-zoom-jump: open-ocean cases pass; coast cases pass except coast-out5 +1.6% over its allowance).
- **MapLibre zoom:** an always-in-memory world-sea polygon (our simplified land rings as holes) paints the sea under the tiles while the map moves below zoom 10 and is hidden at idle; PCG particle spawn replaces the sin hash (the row striping); TileJSON resolved with the style (one fewer round trip). map-zoom-jump on MapLibre: 20 of 24 cases pass (remaining: coast out 1/3/5 transients while the next tile level loads, 1–2 frames, up to +6% over allowance).
- **Blockiness:** soft coverage edges (bilinear over shown corners, renormalised weights, `sampleSoft`/`sampleAllSoft`) for the Leaflet painter, same rule as the GL field.
- Wind legend ticks clean (kt 0 5 10 15 20 25 30 40 50+, whole numbers in mph / km/h).
- New checks (toolkit): t136-zoom-jump.mjs (CDP screencast; `BIGWHEEL=1` for single big wheel events; `DEBUGFRAMES=1`), t137-swell-coverage.mjs (both engines, data and pixel level: green).

## Not done / notes
- The label↔pin overlay failures in map-zoom-jump on Leaflet (popup offset during zoom) are product's popup, not the field.
- The white block near the picker at MapLibre ocean-out5 is the picker's marker element (a white DOM rectangle ~20×12 px at the pin), not the particle framebuffer (the trail buffer is recreated and cleared on every size change).
- MapLibre coast zoom-outs: the periphery revealed by a big jump can show 1–2 frames before the new vector tiles arrive; a bigger fix = tile over-fetch (larger container) or a precise low-zoom ocean layer: not attempted.
