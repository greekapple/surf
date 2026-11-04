# Map review: zoom overlay, swell holes, blockiness (user + lead, 2026-11-04 22:40)
Status: **APPROVED: fix now** (user: "it is terrible when you zoom in and out, the colours overlay and look so shit; when you go to the swell reading there's random places that are just not filled with colour … let's review that extensively").

## What the lead saw (Chrome on :5180, Ocean Beach area, 22:40, dark theme)
1. **Default (Leaflet) engine, multi-level zoom-out (one 5-tick wheel):**
   - mid-animation, the field is a small rectangle (the old view) floating in grey, and the rest of the map is grey basemap with checkerboard tile blocks (missing tiles from several zoom levels);
   - it fills in about 1–3 s later.
   - T-115's padding covers only a one-level zoom; trackpads and wheels jump 2–5 levels.
2. **The colour "overlay" while zooming:**
   - the held old frame (scaled) and the new frame crossfade on top of each other, so two different-resolution pictures show at once;
   - on Leaflet the scaled old frame is visibly blurrier and misaligned with the coast until the swap.
3. **Swell layer, both engines: grey holes in open ocean.**
   - Seen: NE Pacific about 44°N 135–140°W (a large hole), off Oregon, Gulf of California, Gulf of Mexico, off the US East Coast, the Labrador Sea, the North Atlantic near Iceland.
   - The holes have hard, blocky, stair-stepped edges, one 0.5° cell per step.
   - The Waves layer at the same time has no holes there, so the model has values; only the swell partition is missing.
4. **Blockiness:** at basin zoom the swell field shows square cell blocks around the holes and in low-swell areas (nearest-looking edges).
5. **MapLibre engine:**
   - Mid-zoom, the basemap briefly switches to the LIGHT style while the theme is dark (one frame light, then dark again), a style or theme flicker on zoom.
   - Particles render as dense short dashes in regular rows (striping) at basin zoom, not flowing streaks.
   - Holes as in 3.

## Required outcome
- **Zoom:**
  - any zoom jump (1–6 levels, wheel, trackpad, pinch, double-click, flyTo) shows a fully covered sea at every animation frame: no rectangle, no grey sea, no checkerboard;
  - no visible double image (the old and new frame never both visible at different scales).
  - Leaflet: render the field over the whole target view at zoomstart (or keep a world-wide low-res base frame always under the detailed one), keep the tile pane's parent tiles (no checkerboard), and fade only between frames of the same zoom.
  - MapLibre: no style or theme change during zoom.
- **Swell holes, data honesty first:**
  - Engineering finds out WHY the swell value is missing in those cells (the WW3 / GFS-Wave partition is NaN where no swell partition exists? the wrong variable? a fill value?), with the dataset documentation cited.
  - If missing means "no swell system here", paint it as the calm end of the swell scale (0 ft swell) and say so in the legend and the pin ("no swell partition: wind sea only").
  - If missing means "no data", show a quiet hatched no-data treatment that reads as intentional, with a legend entry.
  - Never a raw grey hole with blocky edges. Edges are always smooth (bilinear coverage, as on Waves).
- **Blockiness:** no visible 0.5° squares at any zoom on any layer: smooth interpolation everywhere the model has values.
- **Particles (MapLibre):** flowing streaks with trails like Leaflet's look or better; no row striping.
- **Both engines,** since Leaflet is still the default.

## Verification
- **New toolkit check `t136-zoom-jump.mjs`:** for each engine, wheel-zoom in and out by 1, 3 and 5 levels around the coast and the open ocean. Sample frames every 50 ms during the animation. Fail if more than 2% of sea pixels are grey or no-data, or if a frame shows two field images (detected by the edge test around the old view rectangle).
- **New check `t137-swell-coverage.mjs`:** Swell layer at global and basin zoom. Count sea pixels painted vs unpainted; unpainted must be only where the documented no-data rule applies, with smooth edges (no 0.5° steps).
- **map-verify 1–10** on both engines after the fixes.
- The lead's own look on both engines, zooming and switching layers, before it's called fixed.

## User decision (2026-11-04, 22:50): model the map closely on Windy; Windy's colours for wave height
User: "I think we should model it close to Windy … it's beautifully done … use some of its colours, we can keep some, but for wave height let's incorporate that same colour scheme."
- **Waves and Swell (heights):** Windy's wave-height scheme (ft 1.6 teal → 3.3 light blue → 5 blue → 6.6 indigo/violet → 20 magenta-red → 30 salmon/white), as T-115 had it.
  - This replaces Swello's own ramp for HEIGHT layers only (the 2026-11-04 "own surf scale" decision is superseded for heights; update RULES.md and the legend).
  - Keep the fixed absolute scale (no rescaling with zoom).
  - Re-sample the stops from the lead's fresh live captures (scratchpad map/windy-live/waves-z5-1103-22h.jpg, waves-legend-ft.png, swell1-z4-no-holes.jpg): the map overlay colours, not just the muted legend strip.
- **Wind and Period:** keep ours for now (the user: "we can keep some"). Revisit if the user asks.
- **Swell holes, answered by Windy:** Windy's Swell layer has NO holes. Low or absent swell is painted the calm low end (deep blue → teal) of the same ramp (swell1-z4-no-holes.jpg). So for us:
  - where the model has a total sea state but no swell partition, paint the calm end (0 ft);
  - the pin says "no swell partition (wind sea only)";
  - no hatch.
  - The engineer still confirms what the missing value means in the dataset docs.
- **Zoom behaviour to match:** Windy's 5-tick zoom-out keeps the whole sea coloured at every frame, with a smooth continuous field (waves-mid-zoomout-5ticks.jpg). That's the bar for t136.
- **Look and feel to match:** an opaque field, smooth gradients with no visible cells, flat grey land with white labels and thin dark borders, fine white particles at Windy's density.
