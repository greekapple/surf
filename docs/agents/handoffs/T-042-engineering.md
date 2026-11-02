# T-042 Engineering handoff: map field and basemap at every zoom

## What was wrong
The Esri satellite imagery was the only basemap and sat on a hard-coded dark ground (`#0a1c29` in `explore.css` and `--map-ground`), darkened further by a `brightness(.72)` filter. Where imagery tiles are missing at high zoom the dark ground shows. The data field itself was already bilinear-sampled at every zoom (it draws from the 0.5° regional and 2° global grids at every level, clipped to water by the coastline); at Ocean Beach I could not reproduce the field vanishing, so the fix is on the ground/basemap side, and the zoom script now proves both layers at every step.

## What changed
- `src/map/basemap.ts` (new) + `basemapPref.ts` + `basemap.css`: **Light** (Esri Canvas Light Gray, quiet reference labels), **Dark** (Canvas Dark Gray) by theme, **Satellite** as an option. Every layer has `maxNativeZoom: 13` so tiles upscale instead of going blank. The container ground is pale (`#e4eaee`) in the light theme (CSS specificity beats the old `.xleaf` rules; the dim filter is removed for light/dark). Follows live theme changes.
- `ExploreView.tsx` (agreed lines only): the Esri tile block now calls `addBasemap(m)`; cleanup calls `disposeBase()`; plus a dev-only test hook `window.__swelloMap` (one line, `import.meta.env.DEV`).
- `PersonalView.tsx` Appearance: **Map style: Standard / Satellite** (saved in `swello-basemap`, applies next time the map opens). Product's T-043 can add an in-map control using `src/map/basemapPref.ts`.
- Tests: `src/tests/basemap.test.ts` (2). `src/map/field.ts` unchanged.

## Proof
- `t042-zoom.mjs` (zooms 2→14 in 1-step increments at Ocean Beach, hides pins and their labels, samples pixels over open water and over land at every step, checks the container ground and 0 console errors): **ALL PASS in light, dark and satellite**. Example light z14: water rgb(86,187,203) (field), land rgb(237,237,237) (pale basemap), ground rgb(228,234,238). Shots `artifacts/t042/{light,dark,satellite}/z02…z14.png` in the toolkit.
- `t042-style.mjs` ALL PASS at 1440 and 390 (light → light basemap with pale ground; Appearance › Satellite → satellite; Dark + Standard → dark basemap). Shots `artifacts/t042/explore-{1440,390}-{light,satellite}.png`.
- `tsc` clean, 261 tests, build ok, `journeys` 8/8, `t013-overlap` ALL PASS, `t034-density` ALL PASS.

## Limits
- The Esri Canvas styles are free with attribution under Esri's terms like the imagery already used; for a commercial launch the tile provider/licence needs the same review as before (`VITE_MAP_TILE_URL` still swaps the satellite source).
- The side panel, layer popover, legend and timeline are still the old navy panels (product's T-043 scope), so the light map currently carries dark chrome.
