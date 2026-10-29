# T-011 design critique: Explore with live layers
Reviewer: `design-critic` (Opus, read-only), 2026-10-29. Recorded by the lead. The lead viewed `explore_swell-1440.png` and confirms finding 1.
Screenshots: `~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/critique/T-011/`. Reference: `swello-design-references/10-chatgpt-2026-10-28-dark/D-explore-map-collection.png`.
**Verdict: does not meet the reference direction.** The data is now live, but the presentation is still audit defect 9.

| # | Shortcoming | Evidence | Smallest fix |
|---|---|---|---|
| 1 | The field is 4–6 flat 0.5° squares painted over land | `explore_swell-1440.png`, seams at x≈449 and y≈449; wind block over Point Reyes | Stop drawing `L.rectangle` (`ExploreView.tsx:80`); draw a bilinear-interpolated canvas (`src/map/SpatialLayer.ts`) clipped to an ocean mask; opacity about 0.75 |
| 2 | No legend, units or scale | All captures | Gradient bar with 5–7 ticks from `colorScale`/`legendValue` (`src/map/colors.ts`), titled "Offshore Hs (ft)" or "Wind (mph)" |
| 3 | Road basemap competes with the data; stays bright in dark theme | All captures; `explore_swell-1440-dark.png` | Licensed muted or ocean basemap chosen by theme via `VITE_MAP_TILE_URL`; keep attribution |
| 4 | No direction arrows or streamlines; wind frame time differs from the slider | `explore_wind-1440.png` ("valid Wed 11 PM" vs slider "Thu 29, 1 AM") | Sparse rotated chevrons per cell; the slider label shows the snapped model frame ("nearest model frame: Wed 11 PM") |
| 5 | Mobile is a squeezed desktop page: clipped labels, caption over the map, controls under 44 px, duplicated layer switches | `explore_swell-390.png` | At ≤600 px: map about 70vh, short caption with an info popover, controls ≥44 px, slider hit area 44 px, one layer switch, labels anchored inward |

**What works:** honest labels (offshore Hs, provisional, source, valid time); the camera card promises nothing it can't deliver; the spot side panel hierarchy.
**Not checked:** play animation, other wind frames, dark theme on mobile, text contrast.
