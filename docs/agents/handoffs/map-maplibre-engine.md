# Handoff: map-maplibre (engineering part, steps 1 and 3)

Branch `map-maplibre` (cut from forecast-trust). Architecture: `docs/map-engine.md`.

Done: `MapEngine` seam + engine flag + Leaflet adapter (no behaviour change); MapLibre engine (camera, events, markers, branded OpenFreeMap light/dark style, `window.__xmap`); GL field layer (sea mask from the drawn pixels, shared sampler and LUT, crossfade, onFrame, theme); GPU particles with trails; static arrows.
Verified: tsc clean, 525 tests (map-engine-style +5), build OK; harness checks t128 (seam, both engines), t129 (style), t130 (field shots), t131 (blank-frame + fps/long tasks, desktop and phone 4× CPU: all pass), t132 (colour equals label value), t133 (arrows).
Not done (not mine): ExploreView on the seam, popups/picker/markers via addMarker, chrome/theme check on MapLibre, map-verify 1–10 on both engines (joint run when ExploreView uses the engine).
Open: tuning of particle look vs the Leaflet strokes; no-WebGL2 fallback is the Leaflet engine (flag); OpenFreeMap is a third-party tile host (Protomaps PMTiles on the R2 bucket is the self-hosted option, ask before spend).
