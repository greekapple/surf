# Map zoom: one GPU canvas like Windy, so zooming never pops, stretches or goes grey
Status: **APPROVED** (user 2026-11-04: "yes to all": MapLibre becomes the default with `?engine=leaflet` kept one release; the 0.25° R2 data after this lands; particles respawn and fade on big zooms) (user 2026-11-04: "the map still has that zooming issue, it simply doesn't look good, it needs to be reworked; what is it in Windy that makes it so seamless? reverse engineer that locally and make a spec").

## Context
- Two engines behind one seam (`src/map/engine/`):
  - **Leaflet is the default.** It draws the field as a 2D canvas for one view (`src/map/field.ts`) over Esri raster tiles, and zooms by CSS-scaling that picture plus the tiles, then redraws at `zoomend`.
  - **MapLibre sits behind `?engine=maplibre`.** One WebGL canvas holds the vector basemap plus the field as a shader layer (`glField.ts`) and GPU particles (`glParticles.ts`); the data grids live on the GPU as textures and are re-sampled every frame.
- The night of 2026-11-04 patched Leaflet's zoom: the target view is drawn at `zoomanim`, plus a world tile layer. map-zoom-jump passed 21 of 24 cases on each engine. The flip to MapLibre is waiting on the user (comparison sheet `artifacts/t141/sheet.html`).
- **Data:** WW3 0.5° California plus the global grid from NOAA ERDDAP through `/api/ocean` and `/api/globe`, cached in memory and in HTTP for 5 min only.
  - The GFS-Wave 0.25° packed-PNG pipeline (`docs/map-pipeline.md`) is built and waiting on the user's R2 bucket.

## What Windy actually does (observed 2026-11-04 in Chrome on windy.com, DOM, network and filmed frames; behaviour only, no Windy code copied)
1. **One WebGL2 canvas for everything:** `maplibregl-canvas`, WebGL2, at device pixel ratio 2.
   - Basemap, weather colours, particles and labels are drawn in that one canvas.
   - Leaflet survives only as a shell for markers. Its tile pane is empty.
   - Every frame of a zoom is a fresh render of the whole scene at that exact zoom. Nothing is ever a stretched bitmap.
2. **Weather data as coarse, pre-made data tiles,** decoded and interpolated on the GPU.
   - Waves come from `ims.windy.com/im/v3.0/forecast/ecmwf-wam/<run>/<valid>/wm_grid_257/<z>/<x>/<y>/waves-surface.png`: 257 px tiles, i.e. 256 plus a 1 px overlap so bilinear interpolation is continuous across tile edges.
   - **At map zoom 7 the whole view came from ONE data tile at data zoom 3.**
3. **The data zoom is capped and decoupled from the map zoom.**
   - Zooming in from map zoom 3 to 8 to 15 made **0 new data requests**. The same textures are simply sampled finer, so nothing loads, swaps or fades while zooming in.
   - Zooming out from 7 to 3 fetched the data-zoom-2 tiles, while the zoom-3 tiles kept drawing their part. Coverage never drops.
4. **Basemap:** raster land tiles (`grayland`, `darkmap-retina`) and a separate label tile layer, all drawn in the GL canvas with MapLibre's parent/child tile fallback. A missing tile shows its parent, never grey.
5. **Particles:** during a big zoom they briefly stretch or bunch (Windy is not perfect either: about 300 ms of a particle rectangle on zoom-out, streaks blown up on zoom-in). They fade and respawn over the new view within about half a second.
6. **Instant first paint:** the field shows at once from CDN-cached tiles.

**In one sentence:** Windy is seamless because the field is never a picture. It is data on the GPU, drawn fresh every frame at the current zoom, from a small tile set that already covers the view at any zoom.

## Problems (what the user sees; filmed 2026-11-04, 3-level wheel zoom out and back at Ocean Beach, frames in scratchpad `map/zoom-rework/`)
1. **Leaflet (default), zoom out:** the coloured sea pulls away from the coast and leaves a dark grey band along the shore for about 0.5 s (`leaflet/025-510.jpg`). Grey tile blocks show at the top of the map.
2. **Leaflet, zoom in:** the basemap's raster place names are scaled up to about 8× into giant blurred text ("San Francisco", "Sacramento") until the new tiles arrive (`sheet-leaflet-in.png`, row 3).
3. **Leaflet:** the field visibly fades and re-saturates after each zoom (redraw plus crossfade at `zoomend`), so every zoom "pops".
4. **MapLibre, zoom out:** the wind and swell particles collapse into a dense white square over the old view and hang there for about 1.3 s (`maplibre/058-973.jpg`; Windy's equivalent lasts about 0.3 s and is faint).
5. **Both engines, first open:** the sea is uncoloured grey for about 10 s ("Loading model…") while ERDDAP answers. Windy colours at once.
6. **Both engines:** the global field is coarse and blurry next to Windy's when zoomed in. This is data resolution, not zoom, and is fixed only by the GFS-Wave 0.25° pipeline (the user's R2 step).

## Target
- Zoom (wheel, trackpad, pinch, double-click, buttons, fly-to; 1 to 6 levels) shows, at every frame:
  - a fully coloured sea to the coastline;
  - crisp labels at their normal size;
  - no grey or missing tiles;
  - no fade or pop at the end;
  - particles that never bunch for more than about 250 ms.
- **Reference:** Windy at the same view and speed (the films above). Match or beat it frame by frame.
- **First paint:** the coloured field within 1 s on a repeat visit and within 3 s on a cold one. The picture shown is labelled with its real valid time (never a fake "now").

## Constraints
- **Data honesty unchanged:**
  - the same model values and the same `sampleField` reader for the pin;
  - no invented coastal fill (2 cells max, never read);
  - enclosed waters blank;
  - a cached frame shows its own valid time and source, and is replaced when fresher data lands.
- **Engine switch:** the user decides it (night-plan rule). This spec recommends it (open question 1).
- **No new paid services.** The R2 bucket for the 0.25° data is the user's step (cents a month, already approved in principle). OpenFreeMap tiles stay free.
- **Performance:** 60 fps during zoom at 1440 and at 390 with 4× CPU throttle; 0 long tasks over 50 ms; the map route at most +10 KB gzipped beyond today's MapLibre build.
- **Keep:**
  - the Windy height colours;
  - the legend wording ("Offshore wave height · not surf size");
  - pins, chips, card, "Spots in view" and cam badges;
  - URL state;
  - the reduced-motion behaviour (no particles).

## Approach
1. **Make MapLibre the only drawing path (the Windy architecture).** It is already built, measured at 60 fps with 0 long tasks, and passes map-verify 1–10.
   - Flip the default (`flag.ts`); keep `?engine=leaflet` as a fallback for one release, then delete the Leaflet painter.
   - Leaflet cannot get there: it zooms by CSS-scaling bitmaps (problems 1–3), and patching that is what the last three rounds did.
2. **Particles on big zooms (problem 4):** when the zoom changes by more than about 0.3 levels within a gesture:
   - fade the trail buffer out over 120 ms;
   - respawn particles uniformly over the new viewport with staggered ages;
   - fade back in after the gesture settles (`glParticles.ts`: a respawn-all uniform plus a trail-clear).
3. **Basemap tiles during zoom-out (the MapLibre known limit, 1–2 frames):**
   - keep the world-sea polygon;
   - add tile over-fetch of one parent level, with a slightly larger `maxTileCacheSize`;
   - preload the zoom-3 world tiles at start, as Windy does.
4. **First paint (problem 5):**
   - persist the last globe and regional frames in IndexedDB (keyed by field and valid time) and draw them at once, labelled with their own time;
   - add a stale-while-revalidate Cache-Control on `/api/globe` and `/api/ocean` (frames are fixed per valid time, so long max-age is honest).
   - When the 0.25° pipeline goes live, its packed PNGs on R2/CDN are Windy's data-tile model.
5. **Data tiles (later, only with the pipeline):** cut the 0.25° global frame into a small pyramid of 257 px overlap tiles (data zoom 0–3, capped), sampled in the existing shader. Not needed for seamless zoom today, since the whole grid already fits one texture; it's for resolution and load size.

**Rejected:**
- **More Leaflet patches:** a CSS-scaled bitmap can't be seamless, and three rounds already went to this.
- **Copying Windy's client code:** proprietary; we match its technique (one GL canvas, GPU-sampled data, capped data zoom), not its code.
- **Raster label tiles like Windy:** our vector labels are already crisper.

## Owners and level
- **Level 3:** the engine default changes the whole map. A plan plus user approval, then one implementation owner.
- **Engineering, branch `map-zoom-rework`:**
  - (a) particle respawn on zoom;
  - (b) tile over-fetch and preload;
  - (c) IndexedDB frame cache plus Cache-Control;
  - (d) the flip with the `?engine=leaflet` fallback.
  - One commit per item.
- **Product:** the first-paint label ("Showing 9 AM model run from cache · updating…"), the Explore pins on the flipped engine, and the 390 sheet.
- **Lead:**
  - films the same 3-level zoom out and in at Ocean Beach, plus 6 levels over the open Pacific, on ours vs Windy;
  - looks at the frames at 1440 and 390, light and dark;
  - merges only when the films match.

## Acceptance
1. **Zoom films** (`_zoomfilm`-style CDP screencast, every painted frame) on the default engine:
   - 3 and 6 levels, out and in, at the coast and the open ocean, 1440 and 390, light and dark;
   - 0 frames with an uncoloured coastal band;
   - 0 frames with a label scaled more than 1.5× its settled size;
   - 0 grey tiles;
   - particle clump (a white-pixel density more than 3× the view median in any 64 px cell) for no more than 250 ms.
2. **Toolkit checks:**
   - `map-zoom-jump.mjs` 24/24 on the default engine;
   - t136/t137 green;
   - map-verify 1–10;
   - journeys 8/8;
   - t043.
3. **First paint:** a repeat visit shows a coloured field within 1 s (Playwright timing), labelled with its valid time. Cold visit within 3 s, or the "Loading model…" state.
4. **Performance:** 60 fps and 0 long tasks during zoom (1440; 390 at 4× throttle). Bundle within budget.
5. **Side-by-side sheet,** ours vs Windy at the same 6 frames of the same zoom, which the lead reviews before merge.

## Open questions (the user's)
1. **Make MapLibre the default map now?** Recommended: **yes**, with `?engine=leaflet` kept for one release. It's the same technique Windy uses, and the only way the Leaflet problems go away.
2. **Turn on the 0.25° data** (create the Cloudflare R2 bucket and add the two GitHub secrets per `docs/map-pipeline.md`)? Recommended: **yes, after this lands.** It fixes the blurry field and the slow first paint for good.
3. **Particles during a zoom:** hide them while zooming (calmest), or keep them moving and respawn (Windy-like)? Recommended: **respawn**, faded, as in Approach 2.
