# T-117 (product): the Windy rebuild of the map chrome
Branch `t117-map-chrome` from forecast-trust ff93a1d, with engineering's `t117-map-field` (sampleField) merged in. Spec: docs/specs/2026-11-04-map.md §5 (my part: items 4–8). Shots: `artifacts/t117/` (map/pin/panel × 1440/390 × light/dark), plus side-by-sides vs the live Windy frames and the teardown shots: `sbs-1440-light-map`, `sbs-1440-light-point`, `sbs-1440-dark-map`, `sbs-1440-panel`, `sbs-390-light`, `sbs-390-dark`, `sbs-390-panel`.

## What changed
- **Right-edge layers (Windy):**
  - Labelled round thumbnails, each painted with its layer's own scale (`rampFor(unit)`): Waves · Swell · Wind · Period · "More layers…". The active label is lit.
  - "More" holds sea colour on/off, particles animation, swell arrows, the point forecast at the map centre (the keyboard path), and the source note.
  - Phones: one round menu button opens the same list as a sheet. Zoom sits under the list on desktop; there's a round "centre on the selected spot" button.
- **Bottom timeline:** one dark full-width strip.
  - Play on the left, then every forecast day as a segment. The label fits its own width ("Wednesday 4" → "Wed 4" → "Wed" → none) via container queries.
  - The hour sits in a bubble over the playhead. A native range input underneath gives drag, click, arrow keys and screen-reader value.
  - At the right: the **model chip** naming the field's real source ("WW3 · NOAA ERDDAP", "GFS · NOAA ERDDAP" for wind; a press shows the full note), and the **legend chip**, where a tap cycles the unit (ft ↔ m; mph → kn → km/h for wind). The legend keeps "Offshore wave height · not surf size".
  - Phones: the strip, then the dark mark and the legend; no model chip (as Windy).
- **Point tap:**
  - A small dark pin label at the exact point: "Waves · 10.2 ft NW · 12 s / offshore · not surf size", with × and an expand chevron.
  - The value and direction are `sampleField` (the painted colour under the pin).
  - The period comes from the /api/point forecast. A tooltip and the screen-reader text say so.
  - On land or enclosed water: "No value here · land or enclosed water".
  - **Expand** opens the bottom hourly panel (Windy's Waves & Tides), with 3-hour columns from the shared hour:
    - wind as speed-coloured cells with arrows; gusts;
    - waves, swell 1 and swell 2, each with arrows; period;
    - tide: High/Low turns from the nearest NOAA station within 40 km, named, else "no station ≤ 40 km".
  - "Open full forecast" goes to the nearest spot within 60 km (named, with the distance). The footer says offshore model values, not surf size, and gives the tide station's distance.
  - Phones: the same panel as a bottom sheet with a sideways-scrolling table.
- **/api/point:** now also returns wave direction and period, secondary swell, and gusts. They come in the same two Open-Meteo requests (no extra upstream calls), through the server proxy and its existing 30-min cache keyed at 0.1°. That is coarser than the lead's 0.05°, so fewer upstream calls. Test updated.
- **Top left:** a white search box with a locate button. Locate uses geolocation on press; if refused, it centres on the selected spot. Focusing the box shows the region chips and the spot list (a dropdown on desktop, the sheet on phones).
- **Phone layout:** search on top, the map, round floating buttons, the compact strip with the legend under it. The spot sheet appears only once a spot is picked or the search is used, and now has a × to close.
- **Fixes found on the way:** the phone layer sheet opened under the bottom strip (its last row couldn't be tapped), and the hour bubble hid behind the open panel. Both fixed.
- **Reported to engineering via the lead:** `layerOfFrame` tags every height frame as SWELL (frame `variable` is the WW3 dataset name). Product labels from the chosen layer, so the label is right either way.

## Checks
- tsc OK; 487/487 tests; build OK.
- Browser, one load per width and theme (quota): map → tap sea → label → expand → panel at 1440 and 390, light and dark. No overflow, nothing under 44 px on phone, no console errors.
- Keyboard: More → point at map centre → label + panel; the expand toggles by Enter; "Open full forecast · Mavericks · 4 km" → /forecast Mavericks.
- **t043-map ALL PASS**, updated (backup `t043-map.mjs.pre-t117`):
  - chrome: a white search box, with a dark strip and zoom (Windy);
  - time: day strip, bubble and arrow keys instead of the thin bar and card;
  - layers: round thumbnails, the phone menu sheet, and a legend tap cycling the unit;
  - phones start without a spot sheet, and the search opens it at half;
  - the list opens from search focus.
- Journeys not run (Open-Meteo quota).
