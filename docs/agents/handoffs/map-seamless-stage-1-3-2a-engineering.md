# Handoff: map-seamless Stages 1, 3 and 2a (engineering)

Branch `map-seamless` (forecast-trust merged). Spec: `docs/specs/2026-11-04-map-seamless.md`, findings `docs/map-findings.md`.

## What changed
- **Stage 1** (`src/map/field.ts`, `mapConfig.ts`, `spatial.ts`): held-frame crossfade controller (`createFieldController`), `onFrame` 'ready' report (`FrameState`, `frameKey`), larger frame caches, idle prefetch, pole clamp / `minZoomFor`. Layer switch field-gap 1,119 ms → 0 ms.
- **Stage 3** (`ramps.ts`, `colorMath.ts`, `mapConfig.scales`): Swello's own fixed ramps per layer, legend ticks from the same config; AA contrast fixes in explore.css. Phone legend: gradient plus 0 / ~10 / last ticks.
- **Legend follows the painted frame** (ExploreView `painted` state from onFrame): label, ramp and units are those of the layer on the canvas; the loading state shows while the new layer is not painted yet.
- **Stage 2a**: native 0.5° global frame (`/api/ocean`, ERDDAP `.dods`, `parseDodsGrid`/`packOceanGrid`, Int16 scaled, 0.6–0.7 MB per field, in-memory cache 30 min, bounded to 24 entries, 3-hourly times within -1/+8 days only, fixed fields only); `loadGlobe` uses it instead of the 2° `/api/globe`; `buildField` takes gridded frames; coastal fill capped at 2 cells (`mapConfig.fill.coastCells`); nest feathered into the global grid (`nestWeight`, 1.5°); enclosed water transparent, hatch and "Not covered" labels removed; no blur on data.
- CONTRACTS.md: section "Map field: what the colour is and is not".

## Files shared with product
`ExploreView.tsx` (controller, prefetch, `painted`, legend, header text "global 0.5°"), `Panels.tsx` (LegendChip ticks, lo/hi only without ticks), `explore.css` (legend ticks, popover/attribution contrast).

## Verification
tsc clean, 516 tests, build OK. Toolkit: t043-map ALL PASS, t115-zoom iphone ALL PASS, t122-stage2a (legend bar both sizes, /api/ocean used, not /api/globe), t123-legend-follows, t124 screenshots (`artifacts/t124/`, 1440 and 390, bay z9 and Pacific z3).

## ERDDAP politeness
One upstream fetch per (field, hour) per 30 min per server instance (in-flight de-duplicated), not per user; the browser may cache 5 min (`max-age=300`). A view needs 2 fields (scalar + direction) per hour, wind 2 more; prefetch adds +3 h, +6 h and the next layer at idle.

## Open
8 PM badge covers attribution (Stage 5, product). Stage 2b pipeline and MapLibre spike next.
