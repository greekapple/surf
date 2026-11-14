# Map (Explore) launch audit, 2026-11-14

Read-only audit of branch `forecast-trust`. Nothing was run except `ls`/`grep`/`du`/`gzip -c` on the local `dist`, and `curl` against public URLs. No browser pass was done; items marked "verify" need one.

## 1. Licensing and terms

| Source | Host | Terms for public commercial use | Shown on map / Credits | Blocker |
|---|---|---|---|---|
| Basemap style, vector tiles, glyphs, sprite | OpenFreeMap (`tiles.openfreemap.org`, `src/map/engine/style.ts:9,62`) | Commercial use allowed, free, no request caps; **attribution required; no SLA** (https://openfreemap.org/) | Map: `.xcredit` plain text "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (`ExploreView.tsx:891`, `style.ts:19`); MapLibre's own linked control hidden (`explore.css:713`). Credits: `Credits.tsx:35` | Credit has **no link** to openstreetmap.org/copyright and no ODbL mention on the map. OSMF guidelines ask for a licence reference that stays findable when collapsed (https://osmfoundation.org/wiki/Licence/Attribution_Guidelines). Phones show it in full at first and collapse it on interaction (`ExploreView.tsx:316`), which the guidelines allow. It is also hidden while a popup is open on phones (`explore.css:406`). |
| Wave frames (GFS-Wave PNGs + manifest) | **GitHub Pages**, `greekapple.github.io/surf` (`.env.production`, workflow `.github/workflows/map-frames.yml` on `surf-history`) | Data: NOAA, public domain. Host: GitHub Pages is **not** allowed as "a free web-hosting service to run your online business" or for "commercial software as a service (SaaS)"; soft limit of **100 GB/month** bandwidth; sites up to 1 GB (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Credits: NOAA NCEP GFS-Wave (`Credits.tsx:25`). **The Privacy page does not list GitHub** as a host the browser contacts (`Legal.tsx:40-44`). | **P0.** Serving a commercial app's data feed is outside Pages' intended use. The URL also exposes the owner's GitHub handle. R2 is already designed and costs $0 (`docs/map-pipeline.md`, steps 1–6). |
| WW3/GFS fallback field | PacIOOS ERDDAP via `/api/ocean` | "may be used and redistributed for free"; no warranty | Credits `Credits.tsx:26-28`; map names it "WW3 fallback (host)" (`ExploreView.tsx:859`) | None |
| Point forecast (sea tap) | Open-Meteo, through the Worker with a paid key | Commercial Standard plan bought (LAUNCH-GATE §1); CC BY 4.0 attribution | Panel names Open-Meteo (`PointPanel.tsx:64`). **Credits still says "Free public API for non-commercial use"** (`Credits.tsx:19`) | P1: wording is out of date |
| Tides / NDBC / NWS | NOAA | Public domain | Credits `:21-24`; panel names the station (`PointPanel.tsx:93`) | None |
| Fallback engine and Satellite basemap | **Esri** `server.arcgisonline.com` (`src/map/basemap.ts:8-14`) | Item metadata: "licensed under the **Esri Master License Agreement**" (ArcGIS item `ed712cb1…`, `10df2279…`, read via `arcgis.com/sharing/rest/content/items/<id>?f=json`). There is no ArcGIS account or key anywhere in the code. | Leaflet attribution control (`leafletEngine.ts:16`); Credits `:37` ("Esri terms of use"). The imagery credit names Maxar, but Esri's own service now credits "Vantor". | **P0** while any user can reach Esri tiles (automatic WebGL/style failure fallback, `ExploreView.tsx:289`). Either get an ArcGIS Location Platform licence or drop Esri. |
| OSM-derived files | `src/data/coastTiles.json` (ODbL; used by the spot-page `CoastTile`, **not the map**), `src/map/enclosed-waters.json` (part OSM, CONTRACTS "Enclosed water") | ODbL: attribute, and offer the derived database under ODbL | The coastTiles header declares ODbL; the tiles credit "© OpenStreetMap contributors" with a link (`CoastTile.tsx:20,34,44`). Credits' OSM row covers only "the default map" | P2: name both derived files on Credits (and that they are ODbL, in the public repo). The repo has no LICENSE file. |
| HDOnTap | `portal.hdontap.com` snapshots | Snapshot terms only (LAUNCH-GATE) | Not loaded by the map. Credits lists it. | None on the map |

## 2. Reliability

- **Frames down or stale:** a run older than 18 h, or a missing manifest, falls back to `/api/ocean` WW3/GFS (`packedFrame.ts:40`, `spatial.ts:158`), labelled "WW3 fallback" (`ExploreView.tsx:859`). Pages caches files for `max-age=600` (curl). GitHub Actions cron has been late by up to 5 h and once skipped a run (workflow header), so this already happens. Single points of failure: GitHub Actions + Pages + PacIOOS.
- **Device cache:** IndexedDB keeps the last 14 frames (`frameStore.ts:6`), used only as the first picture and labelled "cached … · not updated" (`cacheLabel.ts`). Good.
- **OpenFreeMap down:** `loadBaseStyle` throws (`style.ts:63`), and the engine silently falls back to Leaflet + Esri (`ExploreView.tsx:289`). The fallback is **not labelled**, and it brings in the Esri licence issue. OpenFreeMap has no SLA. This is the biggest single point of failure.
- **Open-Meteo down:** the point panel shows its error (`PointPanel.tsx:68`); spots show "Limited: …" (`ExploreView.tsx:852-855`).
- **Offline:** there is no service worker and no offline state on the map. The style fetch fails, then Leaflet, then Esri tiles fail too, so the likely result is a blank map with no message (verify).

## 3. Phone performance (first map open)

Gzipped from local `dist/assets` (14 Nov build): main `index` 485 KB, then for Explore `maplibreEngine` 303 KB, `land-globe` 171 KB (static import in `style.ts:7`), `field` 53 KB, `ExploreView` 41 KB JS + 20 KB CSS. That is **about 590 KB gz of map-only code** on top of the shell. The OpenFreeMap style is 43 KB, plus TileJSON, glyphs, sprite and vector tiles (tile count not measured). Frames are full-globe PNGs: waves f000 0.68 MB, wind 1.16 MB (curl). One layer plus prefetch of +3/+6/+9 h is about 2.7–3.5 MB per session; prefetch is skipped on 2g/3g (`mapConfig.ts`). At about 3 MB a session, the 100 GB Pages limit is about 30k map sessions a month. Toolkit: B8 scrub passes on dev 6/6 (TASK-BOARD:640). The "map usable within 2 s" budget (fable-briefing:107) has **no prod measurement**. Cold Home on prod takes 5.0–5.8 s (TASK-BOARD:641).

## 4. Accessibility

- The map is `role="application"` with an instruction label (`ExploreView.tsx:889`). MapLibre's keyboard pan and zoom apply (verify that focus is visible).
- **Dots and clusters are WebGL symbols** (DOM pins 1236 → 0, TASK-BOARD:604), so they cannot be focused and have no accessible names. The equivalent is the "In view" list with `aria-live` counts (`:759`). Acceptable if the list is easy to find; cluster contents are not reachable without a pointer.
- **The sea-tap point forecast is pointer-only** (engine `click`, `ExploreView.tsx:313`). There is no keyboard route.
- The status chip is a `button` with `aria-live="polite"` (`:946`), so it re-announces on every loading change. Make it a separate live region.
- Colour: dot kinds differ by shape (solid, dashed, hollow; `dots.ts:6-8`), and the ramps rise in lightness (`mapConfig.ts`). Good. The rating band on a dot is colour-only, but its text is in the tooltip and the list.
- Reduced motion is respected for flyTo, pan and particles (`ExploreView.tsx:66,334,590`).

## 5. UX gaps

- **Leaflet fallback:** no clusters (spec `2026-11-12-map-dots.md:37`), different look, no label saying it is a fallback.
- **The Satellite setting is dead on the default engine.** Personal offers it (`PersonalView.tsx:392`), but only `basemap.ts` (Leaflet) reads it. Legal also says Esri is contacted "for the satellite view" (`Legal.tsx:42`).
- **Long source warning on phones:** "Limited: Open-Meteo Marine (stale copy) (40 spots), …" joins every source (`:855`, `mapStatus.ts`), and only the CSS limits its width (`explore.css:931`). It is open in TASK-BOARD:644 ("should collapse to one line").
- **Empty states:** "No surf spot in view: zoom out or pan along the coast." (`:759`). Outside California, only Find Spots says "No surf spot within 75 mi… California for now" (`FindSpots.tsx:90`). The map itself has no "outside coverage" note. Offline: none (see §2).
- **First-time comprehension:** on phones the dot key sits inside the expanded legend chip (`Panels.tsx:81-93,137`), and on desktop behind a small button (`:152`). Solid, dashed and hollow mean nothing until it is opened. There is no first-open hint.

## 6. Data honesty (vs CONTRACTS.md)

These are compliant: legends "Offshore wave/swell height · not surf size" (`legendNames.ts:6-7`, phone chip "offshore · not surf", `Panels.tsx:90`); point panel "Offshore model values at this point, not surf size" (`PointPanel.tsx:93`); hollow dot = offshore, never a number (`dots.ts:8,52`); cached frames carry their own valid time (`cacheLabel.ts`); the fallback model is named; the GFS-Wave swell partition note (`map-pipeline.md`). Gaps: the unlabelled engine fallback; the out-of-date Open-Meteo licence line; and whether faded `est` dots say "saved copy" in their words (`dots.ts:50` uses `t.tag`; verify).

## Prioritised fixes

| # | Fix | Size | Kind |
|---|---|---|---|
| P0-1 | Move frames off GitHub Pages to R2 behind a custom domain (pipeline already designed). Update the Privacy host list. | M | Eng |
| P0-2 | Esri: buy an ArcGIS Location Platform licence or remove Esri (fallback basemap + Satellite). Fix Credits and Legal to match. | M | Eng |
| P0-3 | Map credit: link "OpenStreetMap" to /copyright (and keep it findable when collapsed or under popups) | S | Product |
| P1-1 | OpenFreeMap single point of failure: self-host or mirror the style and tiles (or a paid plan), plus a labelled degraded state | L | Eng |
| P1-2 | Offline / no-network state on the map | S | Product |
| P1-3 | Collapse the phone source warning to one line with details on tap | S | Product |
| P1-4 | Credits: Open-Meteo commercial-plan wording; add GitHub/R2 as frame host; "Last updated" | S | Product |
| P1-5 | Keyboard route to the point forecast and to cluster contents; move `aria-live` off the status button | M | Product |
| P1-6 | Remove or implement the Satellite setting on MapLibre | S | Product |
| P1-7 | Measure the prod map-ready time on a 390 phone profile against the 2 s budget | S | Eng |
| P2-1 | Label the Leaflet fallback ("simplified map") | S | Product |
| P2-2 | First-open dot-key hint; "outside California" note on the map | S | Product |
| P2-3 | Lazy-load `land-globe` (171 KB gz); consider WebP/regional crops for frames | M | Eng |
| P2-4 | Credits rows for coastTiles/enclosed-waters (ODbL); add a repo LICENSE | S | Eng |
| P2-5 | Esri credit "Maxar" → "Vantor" (if Esri is kept) | S | Product |
