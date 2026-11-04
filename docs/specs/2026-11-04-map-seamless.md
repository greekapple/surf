# Map: as seamless as Windy; fix glitches and colour problems (user brief, 2026-11-04)
Status: **APPROVED, queued** (user: "when finished with all tasks you see fit, complete these map improvements"). Starts after the running work: T-118 surf band, T-119 lines, Fable's 3D round 2.

## Repo mapping (lead)
- **Map today:**
  - Leaflet with Esri raster tiles (`src/map/basemap.ts`) and a canvas heat field + flow canvas (`src/map/field.ts`, `fieldData.ts`, `colors.ts`);
  - the WW3 (NOAA ERDDAP) California 0.5° grid + global 2° grid; GFS wind;
  - the T-092 enclosed-water mask with the "Not covered" hatch;
  - T-115/T-117: Windy wave/wind ramps, opaque field, grey land basemap, zoom transform, point API `sampleField`, Windy-like chrome (`src/features/explore/*`).
- **The "0–30+ vs 0–13+" legend** is T-115's fixed coastal (0–4 m) vs basin (0–9 m) domain switch by zoom. The brief calls it a bug: one absolute scale per layer.
- **Colour direction:** this brief (newer) says Swello's own surf-first ramps with fixed breakpoints, "not a Windy copy". The 2026-11-04 earlier instruction was "same colors as Windy". **User decision (2026-11-04): Swello's own surf scale.** Follow this brief's Stage 3: own ramps with the surf breakpoints, readable in grayscale and for colorblind users, one fixed absolute scale per layer. This replaces the Windy ramps from T-115/T-117; update the RULES.md map note accordingly.
- **Gates the brief sets for the user:**
  - a library migration (Leaflet → MapLibre GL) needs a written case and the user's OK first;
  - a higher-resolution data source and a tiled pre-processing pipeline is a written proposal, not implemented without OK (backend, possible cost).
- **Repo rules:** public repo; nothing licensed; Open-Meteo/ERDDAP quota (light QA); data honesty (offshore height, not surf size; coastal fill documented and limited to the model's own neighbours; no invented data).

## Owners
- **Engineering:** findings note, rendering (GPU field, worker decode, cache and prefetch), colour scales, land mask and coastal fill, nest blend, coverage, particles, timeline interpolation, performance.
- **Product:** persistent map and URL state, crossfades and loading UI, legend, popover contrast, spot declutter, point picker, search merge, mobile layout, the Playwright verification script.
- **Lead:** gate per stage, before/after per comparison row, side-by-side with Windy.
- **Level 3–4:** architecture and data source, so the findings note and the MapLibre/data proposals go to the user before those steps.

## The brief (verbatim)

# Task: Make the Swello map as seamless as Windy, and fix its glitches and color problems

## Context
Swello is a premium surf forecasting app. The **Map** tab (`/explore`, `/explore/swell`, `/explore/wind`, …) shows forecast layers on a world map:

- layers: Waves, Swell, Wind, Period, plus "More layers…";
- spot markers;
- a spot popup card;
- a timeline across the bottom;
- a legend.

Data is WW3 from NOAA ERDDAP for waves and GFS for wind. The map shows "California 0.5° + global 2°" data on Esri raster tiles.

I recorded Swello and **Windy.com** side by side. Windy is the benchmark for **feel and function**: smoothness, crispness, continuity, no flashing, readable colors. **Don't clone Windy.** Swello is surf- and swell-first, keeps its own visual identity, and doesn't need Windy's 40 weather layers. But panning, zooming, switching layers, scrubbing time and reading values should feel just as seamless.

The bar: a surfer opens the map, swipes around the Pacific, zooms into their coast, switches from Waves to Period to Wind, scrubs to Saturday, and never sees anything flash, blur, pop, stretch, go blank, or change meaning.

---

## What I see: Swello vs Windy

| Area | Swello today | Windy (the benchmark) |
|---|---|---|
| **Data resolution** | Coarse 2° global grid, heavily blurred. Large blotchy "lava-lamp" circles, especially the round red blobs in the Southern Ocean. No fine structure. | High-resolution field with smooth interpolation. Storm structure, fronts and gradients are crisp at every zoom. |
| **Coverage** | Data stops in a hard, blurred horizontal band around 60–65°N and 60°S. Above it is a flat dark-gray strip. The North Atlantic and Arctic are blank. | Covers every ocean up to the real sea-ice edge. Ice is shown as its own pale fill, not a cut-off. |
| **Regional nest seam** | The California 0.5° nest shows up as a **visible rectangle** with hard edges and different colors from the global field around it (clearly visible when zoomed out over the West Coast, and as a stray cyan strip over North America mid-pan). | No seams between data sources. |
| **Coastline** | Colors fade out fuzzily before the coast, leaving gaps, or bleed onto land. SF Bay and the Delta show a **gray checkerboard / hatch pattern**. Near Monterey a blue blob ends in a soft edge. | Colors run right up to a crisp coastline, including bays and inlets. Land is a clean, flat fill. |
| **Color scale** | The legend **rescales with zoom**: "0–30+ ft" zoomed out, "0–13+ ft" zoomed in. The same wave height changes color as you zoom. Most surfable sizes (3–10 ft) collapse into one band of magenta, so detail disappears. The low-end cyan reads like ice or no-data. | Fixed, absolute scale per layer. The gradient is ordered, readable and consistent at every zoom. The legend has clear tick values (ft 1.6 / 3.3 / 5 / 6.6 / 20 / 30). |
| **Map labels** | When zooming, labels like "San Francisco", "Sacramento", "Fresno" and "Carson City" blow up into **huge, blurry, doubled ghost text** (raster tiles from two zoom levels stretched on top of each other). | Labels, borders and coastlines stay crisp and sit **above** the data layer at every zoom. |
| **Particles** | Short, sparse white dashes that look static and chaotic, with random-looking directions in the Southern Ocean and no sense of flow. Density doesn't adapt to zoom. | Dense, smooth, continuously flowing streaks with fading trails that follow the field. Density adapts to zoom and keeps animating while you pan. |
| **Layer switching** | Each layer is a separate route, so switching remounts the map. Seen in the recording: a full white "Loading Map…" page; the basemap with no data; a light-gray screen with **no basemap at all**, only spot dots and a "Loading model…" pill; then the data pops in. | The basemap never disappears. The old layer stays until the new one is ready, then crossfades. No full-page loading state. |
| **Pan/zoom** | Data tiles draw partially mid-pan: strips of overlay, empty regions, then pop-in. You can pan or zoom out far enough to see a dark-gray band past the poles. | Continuous at 60 fps with nothing missing mid-gesture. Vertical bounds are clamped so you never see past the map. |
| **Spot markers** | Many unlabeled white dots stack along the coast. Labels collide ("Bolinas" overlaps "Stinson Beach"). The popup sits on top of other labels. | Clean decluttering: labels only where they fit, with priority given to important items. |
| **Point values** | A "Point forecast at map centre" toggle hidden in More layers. | Tap anywhere for a draggable picker showing the value of the current layer ("Wind 14 kt E"). |
| **Theme** | In light mode the "More layers…" popover has nearly invisible labels: white text on white for "Sea colour", "Particles animation", "Swell direction arrows". Overlay colors aren't adjusted for light vs dark basemap. | Consistent contrast throughout. |
| **Small UI bugs** | The "7 PM" timeline badge covers the attribution text bottom-left. There are two "Search spots" fields at once (top nav and map). | n/a |
| **Extras** | n/a | 3D globe mode; the timeline interpolates smoothly between hours; the map position is stored in the URL. |

Things Swello already does well that must be kept and improved, not replaced:
- the spot popup card (photo, size range, "Waist to overhead", wind and onshore/offshore, "Open forecast");
- the surf-first layer set;
- the model badge in the timeline ("WW3 · NOAA ERDDAP");
- the "Offshore wave height · not surf size" honesty label;
- the "Dark at this hour · not rated" note;
- the overall minimal look.

---

## Ground rules
- **Investigate first.** Read the map code end to end and write a short findings note (PR description or `docs/map-findings.md`) covering:
  - the map library and version (Leaflet? MapLibre? something else?) and how the basemap is loaded;
  - how forecast data is fetched, decoded, gridded and drawn (canvas? WebGL? image overlay?);
  - how the color scale and legend are computed (find out why the max changes with zoom);
  - how particles work;
  - how routing and layer switching work (find out why switching remounts or reloads);
  - how the California nest and the global grid are combined;
  - how spot markers and labels render;
  - a root cause for **every glitch in the table above**, plus your staged plan.
- **Iterate, don't restart.** Keep the existing app structure, components and design language. If the current map library genuinely can't do what's below, write up why and **stop and ask me before migrating**. Raster-only Leaflet blocks crisp vector labels and GPU particles; MapLibre GL with a custom WebGL layer would fix that. Bring me the case before switching.
- **Git:** feature branch, small staged commits with clear messages, no squashing or force-pushing, and the app works after every stage.
- **Config:** color scales, breakpoints, particle settings, cache sizes and zoom thresholds all live in one config module (`mapConfig`), not scattered through components.
- **Performance targets:**
  - 60 fps pan, zoom and particle animation on a mid-range laptop; 30+ fps on a recent phone;
  - no long tasks over 50 ms on the main thread during interaction;
  - decode data off the main thread (Web Worker) and do color mapping on the GPU.
- **Data honesty:** keep the "approximate / model estimate / not surf size" labeling. Never invent data to fill gaps. Gap-filling near coastlines (below) must stay within the model's own nearby values and be documented.

---

## Stage 1: Fix the blank screens and flashing (layer switching, loading, routing)
- **The map instance must never unmount** when switching layers, changing the forecast hour, or moving between `/explore` sub-routes:
  - layer is state;
  - update the URL with `history.replaceState`/router shallow navigation, not a remount;
  - no full-page "Loading Map…" except on first app load, and even then show the basemap as early as possible.
- **The basemap is always visible.** Never show the empty light-gray screen. Basemap tiles load independently of forecast data.
- **Layer and time changes keep the previous frame on screen** until the next one is fully decoded and uploaded, then **crossfade** over about 200–300 ms. Never show an empty or partial overlay.
- **Loading indicator:** a small, unobtrusive one (a thin progress line, or the existing "Loading model…" pill), never a blocking overlay. If data takes over 5 s, show a non-blocking retry. If it fails, keep the last good frame and show a clear error.
- **URL state like Windy's:** store layer, lat, lon, zoom, forecast time and selected spot in the URL, so reload and share restore the exact view without flashing.
- **Caching and prefetch:**
  - cache decoded data per (layer, model run, forecast hour, tile/region) in memory (LRU) and in IndexedDB or the HTTP cache;
  - prefetch the neighboring forecast hours and the next likely layer in the background when idle.

## Stage 2: Data rendering (resolution, coverage, seams, coastline)

### Rendering approach
- Draw scalar fields (wave height, swell height, period, wind speed) on the **GPU**:
  - upload the data grid as a float texture, or a 16-bit/RGB-packed PNG texture if float isn't supported;
  - sample it with **bilinear interpolation** (bicubic if affordable) in the fragment shader;
  - map value to color through a **1D color-ramp texture**.
- This replaces the CSS/canvas blur that causes the lava-lamp blobs. No blur filters on data, ever.
- Reproject correctly to Web Mercator in the shader so latitude bands don't stretch, and handle the antimeridian and world copies seamlessly.

### Resolution
- The global 2° grid is too coarse for a premium product. **Evaluate higher-resolution global wave data** and report options with resolution, update cadence, latency, licensing and cost before switching. For example:
  - NOAA GFS-Wave (WW3) global 0.25° (or 0.16°) from NOMADS/ERDDAP;
  - ECMWF open-data wave fields;
  - anything else that's better.
- Whatever we use, consider pre-processing into **tiled, zoom-levelled data textures** on our side (a small pipeline/cron that pulls each model run and writes compact tiles to storage/CDN), instead of the client hitting ERDDAP per view. Plan it and flag it to me; this is a backend decision.

### Coverage
- Show data wherever the model has ocean values, all the way to the sea-ice edge.
- Remove the hard horizontal cut-offs at about 60–65°N and 60°S. If a source truly ends at a latitude, fade out over the source's real boundary cells, not a blurred horizontal band.
- Show sea ice as its own subtle pale fill if we have an ice mask; otherwise transparent so the basemap shows.
- No dark-gray band past the poles. Clamp vertical pan to the map extent, and set min zoom so the world fills the viewport width without wasted space.

### Nest seam (California 0.5° + global 2°)
- Blend the regional nest into the global field with a **feathered transition** a few cells wide at its boundary.
- Both sources must use the **same units, the same color scale, and matching valid times**. If their values disagree a lot at the boundary, log it and taper the difference across the feather instead of showing a step.
- The rectangle must be invisible at every zoom.

### Coastline and land mask
- Use a **high-resolution land mask** (vector coastline, e.g. OSM land polygons or Natural Earth 10m at low zoom and finer coastline at high zoom), applied in the shader or as a stencil, so data ends at a **crisp coastline** at every zoom.
- Model cells next to the coast are often NaN or land. Fill **only** those coastal cells by extrapolating from the nearest valid ocean neighbors (nearest-neighbor or a short diffusion fill, limited to a few cells) so colors reach the shoreline without gaps. Document how many cells and from where.
- Bays and inland water (SF Bay, the Delta, estuaries): either show the extrapolated value with lower opacity, or leave them transparent. **Never** show the checkerboard/hatch pattern.

### Labels on top
- Put basemap **labels, borders and coastlines above the data layer**, using a separate reference/labels layer, so ocean data never hides place names and the coast always reads.
- **Fix the giant blurry ghost labels.**
  - Best: switch the basemap to **vector tiles** (Esri vector basemap, MapTiler, OpenFreeMap or similar; check licensing) so labels stay crisp during zoom.
  - If staying on raster: set up tile zoom transitions correctly (keep parent tiles only until children load, fade children in, never scale labels across more than one zoom level, and never draw two label zoom levels on top of each other).
- The basemap should have a **light** and a **dark** variant tuned for the data overlay: muted land, quiet labels, and a neutral land color that can't be confused with any color in the data ramps.

## Stage 3: Color scales and legend (fix the color problems)

### Hard rule
**Every layer has one fixed, absolute color scale.** It never rescales with zoom, viewport, region or time. Remove whatever computes the legend max from the visible data. "0–30+" vs "0–13+" depending on zoom is the bug.

### Design
- Swello's own identity, not a Windy copy, but just as readable:
  - perceptually ordered (lightness changes steadily, so it still reads in grayscale and for colorblind users);
  - no hue that clashes with land gray or the ice fill;
  - the low end must not read as "no data".
- Run each ramp through a colorblind simulation (deuteranopia, protanopia) and a grayscale check, and include the screenshots in the PR.
- **Surf-meaningful breakpoints.** Put the most color resolution where surfers care. Suggested starting points (tune in config):
  - **Wave / swell height (ft):** 0, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30+. The 2–10 ft range must have clearly distinct steps instead of collapsing into one magenta band.
  - **Period (s):** 4, 6, 8, 10, 12, 14, 16, 18, 20+. Long-period groundswell (14 s+) should stand out clearly from short-period wind swell (under 9 s).
  - **Wind speed:** a calm-to-strong ramp (kt and mph both supported) with emphasis on 0–25 kt.
- Each layer gets its own ramp so users can tell at a glance which layer they're on, but all ramps share the same design language.
- **Theme-aware:** tune overlay opacity and ramp lightness for the light and dark basemaps so the data has the same perceived strength in both.

### Legend
- Readable and properly sized, with **tick labels at the breakpoints**, units (with an ft/m and kt/mph toggle tied to user preferences), and the model and valid-time label.
- Hovering or tapping a position on the legend highlights that value range on the map (nice-to-have).
- The legend must match the shader ramp exactly: generate both from the same config.

### Fix the light-mode popover
The "More layers…" panel labels are invisible in light mode. Fix the contrast to WCAG AA in both themes, and check every map control (layer buttons, zoom, favorites, search, timeline) in both themes.

## Stage 4: Particles and direction (flow you can feel)
- Rebuild particles as a **GPU particle system** (WebGL), advected through the u/v vector field with bilinear sampling:
  - fading trails (ping-pong framebuffer with alpha decay);
  - speed proportional to magnitude;
  - particles age and respawn at random positions so the field never empties or clumps.
- **Density adapts to zoom and screen area**, so particles stay roughly constant on screen at every zoom.
- **Keep animating while panning and zooming.** Re-seed in screen space without a visible pop when the view changes; the animation should never reset or freeze mid-gesture.
- **Never on land:** use the same land mask.
- **Surf-first styling. Different layers move differently:**
  - **Wind:** fast, thin, short streaks.
  - **Swell / waves:** slower, longer, smoother strokes that move in the **swell direction**, with speed tied to period. It should feel like swell lines marching across the ocean, not wind.
  - **Optional "swell direction arrows" mode** (the existing toggle): evenly spaced arrows on a screen-space grid, sized by height and rotated by direction, as a calmer alternative.
- Fix the random-looking directions in the Southern Ocean. Verify the u/v components and the direction convention ("from" vs "to"; degrees vs radians; meteorological vs oceanographic). One wrong sign makes the whole field look chaotic.
- Respect `prefers-reduced-motion`: particles off by default when it's set.

## Stage 5: Time and timeline
- **Scrubbing is instant:** frames for neighboring hours are prefetched, and dragging the timeline updates the map every frame with no flashing.
- **Temporal interpolation:** between forecast steps (e.g. 3-hourly data), blend the two textures in the shader by the fractional hour so playback is smooth, like Windy. The particle field interpolates too.
- **Play** runs at a steady pace and never stalls waiting on a fetch: buffer ahead, and pause gracefully with a small indicator if the network can't keep up.
- Hour ticks and day labels stay readable. Show the current-time marker and the model run time.
- Fix the "7 PM" badge covering the attribution. Move the attribution or give it its own space so neither is covered.
- Keep the "Dark at this hour · not rated" note and the model badge.

## Stage 6: Spots, picker and interaction
- **Spot markers:**
  - declutter with collision detection;
  - cluster or thin at low zoom (show only favorites and top spots);
  - show labels only where they fit, prioritized as: selected spot > favorites > popular spots > others;
  - no overlapping labels, and the popup never sits on top of other labels (hide labels under the popup, or offset it).
- Markers can show a small surf-quality color or rating dot as a subtle Swello touch, once the forecast supports it.
- **Point picker, like Windy's:** tap or click anywhere on the ocean to drop a small draggable picker showing:
  - the current layer's value at that point and time;
  - for wave and swell: height, period and direction;
  - for wind: speed, direction and gust if available.

  This replaces or complements the hidden "Point forecast at map centre" toggle. Values come from the same interpolated field the shader draws, so they always match the colors.
- **Search:** merge or reconcile the duplicate "Search spots" inputs (top nav vs map). There should be one clear search on the map view. Picking a result flies to the spot smoothly with an animated camera move.
- **Gestures:** smooth inertial pan, pinch zoom on touch, scroll-wheel and trackpad zoom with no jumpiness, double-tap zoom, and keyboard arrows and +/- for accessibility.
- **Mobile layout:** the layer picker becomes a bottom sheet, controls stay out of thumb conflicts, and the timeline works with touch scrubbing.

## Stage 7 (stretch, only after everything above is solid): 3D globe
- An optional 3D globe view like Windy's (MapLibre globe projection or equivalent), with the same data textures and particles. Behind a toggle; never the default if it costs performance on mobile.

---

## Suggested commit plan
1. Findings note, debug overlay (fps, frame time, tile/data cache hits, current model run and valid time).
2. Persistent map instance, no remounts on layer, time or route changes; URL state.
3. Crossfading frame swaps, non-blocking loading, caching and prefetch.
4. GPU scalar rendering with bilinear sampling and a ramp texture (removes the blur blobs).
5. Fixed absolute color scales, new ramps and legend; light/dark tuning; popover contrast fix.
6. Land mask, coastal fill, removal of the bay hatch; labels above data.
7. Basemap label fix (vector tiles, or corrected raster transitions).
8. Coverage to the ice edge, pole clamping, nest blending.
9. GPU particles (wind and swell styles) and direction-convention fix.
10. Timeline interpolation, prefetch and playback.
11. Spot declutter, point picker, search and gestures, mobile layout.
12. Performance pass and quality tiers.
13. (Stretch) Globe.

Plus a separate written proposal (not implemented without my OK) for the higher-resolution data source and the tiled pre-processing pipeline.

---

## Verification (required)
Write a **Playwright script** that drives the map and captures screenshots and frame timing for each scenario. Run it before and after each major stage and include the before/after images in the PR.

1. **Layer switching:** Waves → Swell → Wind → Period → Waves, at global, ocean-basin and coastal zoom. No blank or white screen, no missing basemap, no "Loading Map…" page, and a smooth crossfade every time.
2. **Pan sweep:** across the Pacific, over the antimeridian, and up to the North Atlantic above 60°N. Then down to the Southern Ocean. No partial overlays mid-pan, no hard latitude cut-offs, no dark band past the poles.
3. **Zoom sweep into the coast:** global down to San Francisco / Stinson Beach / Monterey. Labels stay crisp (no ghost text), data meets the coastline cleanly, SF Bay shows no hatch, the California nest has no visible edge.
4. **Color consistency:** pick a fixed ocean point with a known value and screenshot it at three zoom levels. The pixel color is the same (within interpolation tolerance) and the legend never changes.
5. **Timeline:** scrub across all days and play through 48 hours. No flashes, smooth interpolation, and the model badge and valid time update correctly.
6. **Particles:** 10 s of recording while panning and zooming for both wind and swell. Continuous motion, sensible directions, no particles on land, no resets.
7. **Spots:** coastal California at several zooms. No overlapping labels, the popup doesn't cover labels, the picker values match the colors under it.
8. **Themes:** run everything in light and dark. Every control and popover passes WCAG AA contrast.
9. **Performance:** fps and long-task counts on desktop and on a throttled mobile viewport (4× CPU slowdown, iPhone-sized). Hit the targets above, or say clearly where and why you didn't.
10. **Side-by-side:** for the same view and time, capture Windy's waves layer next to Swello's. The goal isn't identical colors; it's comparable crispness, coverage and smoothness. Call out anywhere we're still clearly behind.

## When you're done, report back with
- each stage's changes and commit hashes;
- the root cause of each original glitch;
- before/after screenshots for every row of the comparison table;
- performance numbers;
- the data-source / pipeline proposal;
- open questions or anything you weren't sure about.
