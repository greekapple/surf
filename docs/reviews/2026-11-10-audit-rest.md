# Audit: Quiver, Personal, 3D wave scale, nav/search/legal (2026-11-10)

Live site https://swello.surf-prototype.workers.dev (bundle `index-CjGn9xsT.js`), headless Chrome via Playwright, 1440x900 and 390x844, light and dark.
Evidence folder: `/private/tmp/claude-501/audit-rest/` (`shots/` = route crawl, `i-*` / `j-*` = interaction runs, `rv.mjs` = re-verify script, `crawl.json` = console/text per route).
Not repeated here: `docs/design/PHONE-CRITIQUE-2026-11-10.md` items (quiver stage fit line and scale, header crowding, avatar underline, board copy "A 9.2 s" on the spot page) and the known "surfer not deep in the barrel" issue.
Severity: P0 wrong or misleading · P1 broken UX · P2 polish. Effort S/M/L. "Re-verified" = number of separate runs that showed it.

## What works
- Keyboard: "Skip to content" is the first stop. All 21 tab stops on /quiver show a 2–3 px outline, and the "/" shortcut opens search. No horizontal overflow on any route at 390.
- Height entry takes `6'2"` and converts to `188 cm` under metric. The wave scale label follows it ("you 6'2"", "you 188 cm"), and so do Home and the spot page.
- Theme: dark and light both apply on every Personal, Quiver and legal route. No unthemed pages, apart from items 25 and 26.
- No console errors during the route crawl (76 page loads). The only error came from search navigation (item 10).

## Ranked findings

1. **P0 · Loading is reported as "no data" (Quiver, Board Match, Personal, search) · all viewports, both themes.** While the forecast loads, these screens say the data is missing, not that it is still loading:
   - Board Match: "Board Match needs a surf estimate · Live data has offshore wave height only here". It was still showing 6 s after a deep link to `/quiver/match` (desktop and phone).
   - My boards: "No surf estimate here now" and "Board Match: no surf estimate for Ocean Beach at this hour (offshore height only)".
   - Personal: "Recommended board · None suits it · No surf estimate at Ocean Beach".
   - Header search: every row reads "No forecast data", Ocean Beach included. On the phone the same rows read "loading…".

   When the forecast is slow (the header pill read "Loading forecast…" for 20 s or more in some runs), a surfer is told something false about the data. *Evidence:* `j-d-load_quiver_match-800.png`, `-2500.png`, `j-m-load_quiver_match-2500.png`, `i-d-metric_quiver_match.png`, `i-d-metric_personal.png`, `j-m-load_personal-800.png`, `j-d-search-ocean.png`. *Fix:* give the board-fit and search-row code three states (loading / absent / present). Show a skeleton or "loading" while the forecast is pending, and keep "offshore height only" for a forecast that has loaded and really lacks a surf estimate. *Effort:* M. *Re-verified:* 4 runs. It depends on timing: the `rv.mjs` run was fast and ranked the boards at 1.7 s.

2. **P0 · Board Match ranks a small-wave fish second in double-overhead surf · /quiver/match, 1440 and 390.** At an estimated 10–13 ft, the 5'11" fish (range 1–5 ft) is ranked #2. The 8'0" soft-top (0.5–4 ft) is #3, and the 5'10" shortboard (3–8 ft, the closest range) comes last at #4. `src/features/quiver/fit.ts:35` scores every out-of-range board 0 and then adds +1 when the period suits, so the distance from the board's range never counts. All three rows carry "#2, #3, #4" numbering, which reads like a recommendation order. *Evidence:* `shots/light-d-_quiver_match.png`. *Fix:* for out-of-range boards, sort by how far the estimate sits from the range, then by period. Label them "Not for this size" in place of a rank number. *Effort:* S. *Re-verified:* 3 runs, plus the code.

3. **P0 · The Privacy page states things that are not true · /personal/privacy.**
   - It says "Map tiles: Esri basemaps … server.arcgisonline.com". The default map loads `tiles.openfreemap.org` (`src/map/engine/style.ts:9`); Esri is only the satellite option.
   - It says "Live cam links open the camera owner's own page in a new tab; nothing is embedded here". In fact, USGS stills are embedded as `<img>` (`src/features/forecast/LiveCam.tsx:35`), the YouTube iframe API script is loaded (`LiveCam.tsx:15`, which contacts Google), and HDOnTap's player is an iframe after a tap (`LiveCam.tsx:74`).
   - The storage list leaves out IndexedDB `swello-map-frames` (`src/map/frameStore.ts:6`).

   *Evidence:* `j-d-privacy.png` and the source lines above. *Fix:* rewrite "Services the app contacts" so it lists OpenFreeMap, Esri (satellite only), USGS, YouTube/Google, HDOnTap and NWS as they really behave, add `swello-map-frames`, and update the date. *Effort:* S. *Re-verified:* page text plus code.

4. **P0 · Terms are out of date, and sources are not credited · /personal/terms, no credits page.** The Data section says "tides come from one regional station near San Francisco". The app now uses per-spot NOAA stations (Home shows "Pillar Point Harbor station, 11 km") from Washington to Florida and Hawaii. The Attribution section credits only Wikimedia Commons, Natural Earth and Esri. These are not credited anywhere a user can find:
   - Open-Meteo (CC BY 4.0, which requires attribution)
   - NOAA CO-OPS, NDBC, GFS-Wave and NWS
   - CDIP
   - PacIOOS / University of Hawaiʻi
   - USGS (cam stills)
   - OpenFreeMap / OpenMapTiles / OpenStreetMap (ODbL)
   - HDOnTap and YouTube channels
   - the retailer photos behind the example boards

   The footer has no "Sources" or "Credits" link. *Evidence:* `shots/light-m-_personal_terms.png`, `src/ui/Legal.tsx:43-50`. *Fix:* correct the tide sentence, and add a "Data sources & credits" section or page (provider, what it supplies, licence, link) linked from the footer. *Effort:* M. *Re-verified:* 2 viewports.

5. **P0 · Every home region is suffixed ", CA" · /personal (profile card).** Choosing "Oahu North Shore" in Profile › Home region shows "Intermediate · 2–6 ft preferred · Oahu North Shore, CA". `PersonalView.tsx:428` hard-codes `, CA`, but the regions now include Oregon, Washington, Hawaii and the East Coast. *Evidence:* `j-d-region-personal.png`, `j-m-region-personal.png`. *Fix:* use the state from `stateOfZone` or drop the suffix. *Effort:* S. *Re-verified:* desktop and phone.

6. **P0 · Personal calls surf height "face", which contradicts the product's height convention · /personal/preferences, /personal/spots, Personal favourites list.**
   - The Surf preferences field is labelled "Wave range (face, ft)".
   - Favourite spot rows render "`<n> ft face`" (`PersonalView.tsx:235`, `:436`).

   PRODUCT.md and Units both define surf height by the surf-report convention (about the nearshore Hs; "Surf height (as reports quote it)"), and there is no calibrated face estimate. *Evidence:* `shots/light-d-_personal_preferences.png`. *Fix:* use "Surf height" wording that matches Units ("Preferred surf height"), and "est." on the spot rows. *Effort:* S. *Re-verified:* 2 themes.

7. **P1 · Unit settings do not apply everywhere · with Heights = m and Wind = km/h.** These places do not follow the setting:
   - Quiver My boards, Showroom and Board Match keep "est. 10–13 ft at Ocean Beach" and "fish range 1–5 ft".
   - Surf preferences keeps the "Wave range (face, ft)" inputs in feet, while the Personal list shows the same values as "1–2 m". The rounding makes 2–6 ft display as 1–2 m.
   - Home "Your quiver's pick" keeps "suits 3–8 ft".
   - The spot page board line keeps "it suits 5–12 ft".
   - The chart legend keeps "Arrows 0 to 24+ mph".
   - Water stays at 64 °F, and there is no temperature unit setting.

   *Evidence:* `i-d-prefs-metric.png`, `i-d-metric_quiver.png`, `i-d-metric_quiver_showroom.png`, `i-d-metric_.png`, `i-d-metric_forecast.png`. *Fix:* route the board-range, fit and legend text through `heightValue` / `windValue`, store the preference range in one canonical unit and edit it in the user's unit, and add °C. *Effort:* M. *Re-verified:* 1 full metric pass, every screen checked.

8. **P1 · Favourite spots shows misleading stock photos and a 10,700 px page at 390 · /personal/spots.** Gentle or sheltered spots get dramatic barrel photos: Drakes Estero (an estuary), Point Reyes (north) and Pomponio are each shown with a heavy barrel ("Generic photo · Brocken Inaglory"). These are condition-like images on a list that reads as conditions. The page is 40 identical photo cards plus a "Live model data" pill on each, so the phone page runs to 10,721 px. *Evidence:* `shots/light-m-_personal_spots.png`, `crop-spots-top.png`. *Fix:* only use a photo of that actual spot. Otherwise use a ruled list row (name, region, est. height, star), the pattern the critique praises for Personal. *Effort:* M. *Re-verified:* 2 themes at 390.

9. **P1 · There is no 404 page, and unknown spots silently become Ocean Beach.** `/this-does-not-exist` renders Home ("Good evening.") at the bad URL. `/forecast/not-a-spot-slug-xyz` and `/forecast?spot=not-a-real-spot` render the Ocean Beach forecast with no notice, which is wrong data for a mistyped shared link. `/quiver/bogus` renders My boards. `parseRoute` falls back to home for unknown areas. *Evidence:* `shots/light-d-_nonexistent-page.png`; the `nf`, `nf2` and `nf3` checks in the i2 runs. *Fix:* add a "Page not found" view with search. For an unknown spot, show "We don't know that spot" with search rather than a default spot. *Effort:* S. *Re-verified:* desktop and phone.

10. **P1 · JS error when opening a spot from header search · Quiver → search "sloat" → Enter.** Console: `TypeError: Cannot read properties of undefined (reading 'includes') at By (index-CjGn9xsT.js:15:32391)`. That is `src/ratings/adapters.ts:25`, `f.source.includes('Simulation')`, where a forecast sample reaches the rating code without `source`. Loading the same URL directly does not throw. *Evidence:* `rv.mjs` output, `i2-d` logs. *Fix:* guard with `f.source?.includes`, and find the sample that is built without `source` (a cached or partial one from the search pre-load). *Effort:* S. *Re-verified:* 2 of 2 via search, 0 of 1 direct.

11. **P1 · The wave scale shows the wrong hour while the forecast loads · /forecast/wave-scale, 1440 and 390.** For 12–24 s after load, the page header read "Ocean Beach · Fri 9:00 AM", the stage read "Lighting for Fri 9:00 AM", and it drew a flat daylit sea under "Loading the forecast…". The height was "—" with a "none" tag. Local time was Tue 8 PM. The page then jumped to Tue 8:00 PM, at night. *Evidence:* `j-d-scale-t0.png` and `j-d-scale-t4.png`, 12–18 s after load (the "Fri 9:00 AM" reads came from these captures); `j-m-scale-t0.png`. *Fix:* until the forecast arrives, show the current hour and a stage skeleton. Never label a placeholder scene with a forecast time. RULES also bans loading text in place of a skeleton. *Effort:* S. *Re-verified:* desktop and phone, same run. Slow-load dependent.

12. **P1 · Add board pre-fills invented dimensions as real values · /quiver → Add board.** Length 6'0", Width 19 1/4, Thickness 2 1/2, Volume 30 L and Fins Thruster are real input values, not placeholders (`QuiverView.tsx:25`, `emptyForm`). Only Name is required, so typing a name and saving creates a board with made-up numbers, and those numbers then drive Board Match. *Evidence:* `i-d-addboard-form.png`. *Fix:* make them placeholders, require length, and show "volume unknown" when volume is blank. *Effort:* S. *Re-verified:* screenshot plus code.

13. **P2 · The 3D stage often shows no surfer or board · /forecast/wave-scale, 1440, light.** In 3 of about 8 captures taken 6–30 s after load, the stage shows only the wave. The others show the rider. This looks like the camera or loop cycle, and the stage gives no cue that the rider comes round again, so the "you vs the wave" comparison is missing at a glance. The default board also differed between loads ("Bigger-day option" in one, "Everyday shortboard" in another) depending on when the forecast arrived. *Evidence:* `shots/light-d-_forecast_wave-scale.png`, `i-d-metric_forecast_wave-scale.png`, `i-d-scale-fish.png` (no rider) against `i-d-scale-15s.png`, `j-d-scale-fish3s.png` (rider). *Fix:* keep the rider in frame or start the loop on the rider, and fix the default board once the forecast resolves. *Effort:* M. *Re-verified:* flaky.

14. **P2 · The Showroom stage is blank, with no skeleton, for the first seconds · /quiver/showroom, both themes.** At about 1.5 s (after network idle) the stage is an empty grey or charcoal box, while the angle thumbnails already show the board. Console: `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed` on every load. *Evidence:* `shots/light-d-_quiver_showroom.png`, `shots/dark-d-_quiver_showroom.png`, `j-d-showroom-1500.png` against `i-d-metric_quiver_showroom.png`. *Fix:* use a static board render or skeleton until `onReady`, and switch to `PCFShadowMap`. *Effort:* S. *Re-verified:* 3 runs.

15. **P2 · Showroom copy · 1440 and 390.**
   - A raw retailer URL is printed as text ("Specs as listed by the retailer: https://www.cleanlinesurf.com/products/firewire-seaside-helium-5-11-x-22-x-2-…").
   - At 390 the "Example board. Modelled from published specs…" paragraph appears twice.
   - "41.1 L (retailer photo)" is unclear.

   *Evidence:* `shots/dark-m-_quiver_showroom.png`, `shots/light-d-_quiver_showroom.png`. *Fix:* use a "Retailer specs ↗" link, keep one provenance note, and say "41.1 L (read from the stringer photo)". *Effort:* S.

16. **P2 · PRODUCT.md and the app disagree about the demo boards.** PRODUCT.md says "Quiver demo boards are fictional examples". The app shows real retail models (Firewire Seaside Helium, with a retailer link) marked "Example board". *Fix:* update PRODUCT.md, or the board copy, so they match. *Effort:* S.

17. **P2 · Board Match period wording · /quiver/match, /quiver.** The rows read "9 s period: A 9.4 s swell is short…". The label rounds 9.4 down to 9, and there is a capital "A" mid-sentence; the critique's item 9 covered this on the spot page, and it is the same string here. My boards read "10 s period suits it" at 7:59 PM and "9 s" a few minutes later, which is real data drift but looks inconsistent. *Fix:* one period value with one decimal, and sentence case. *Effort:* S.

18. **P2 · Personal settings contradict each other.**
   - The Personal list says "Preferred swell: Not set" while Surf preferences shows a filled-in period of 10–16 s.
   - Surfing ability can be set on both Profile and Surf preferences.
   - Surf preferences says "forecasts are not filtered by them", but Profile says "Ability shapes Board Match and spot suitability".

   *Evidence:* `shots/light-d-_personal.png`, `shots/light-d-_personal_preferences.png`, `shots/light-d-_personal_profile.png`. *Fix:* keep ability in one place, show the defaults as "Not set" placeholders, and make the two notes agree. *Effort:* S.

19. **P2 · Search focus and ordering · header search.**
   - Esc closes the dialog but leaves focus on `<body>`, not on the Search button.
   - Results are grouped by county in an order that ignores the user's area: San Francisco, then New York, then San Luis Obispo, then North Carolina, then San Diego, so "Ocean Beach (San Diego)" comes after New York.
   - At 390 the placeholder is truncated ("Search 726 spots by name or").

   *Evidence:* `j-d-search-ocean.png`, `j-m-search-open.png`, `focusAfterEsc` in the i2 runs. *Fix:* return focus to the trigger, rank by match quality and then distance, and use a short placeholder ("Search spots"). *Effort:* S.

20. **P2 · Every route has the same document title, with an em dash.** "Swello — Surf forecasts & ocean intelligence" on all 19 routes crawled. History, tabs and screen readers can't tell the pages apart, and RULES bans em dashes. *Fix:* use per-route titles ("Board Match · Swello", "Ocean Beach forecast · Swello"). *Effort:* S.

21. **P2 · An unused font is preloaded on every page.** The console warning "dm-serif-display-latin-400.woff2 was preloaded … but not used" appeared on 42 of 76 loads. *Fix:* remove the preload in `index.html` or use the font. *Effort:* S.

22. **P2 · Legal pages are inconsistent.**
   - Privacy and Terms have no "‹ Personal" back link, unlike every other Personal page.
   - The body says "SWELLO" while the UI says "Swello".
   - Privacy points to "Personal › Account", but the page is titled "Data & privacy".
   - The two pages carry different "Last updated" dates (Nov 2 and Oct 29).

   *Fix:* add the back link, use one brand casing, and point to "Personal › Data & privacy". *Effort:* S.

23. **P2 · US/UK spelling is mixed.** "Favorite spots" and "Choose favorite spots" appear alongside "favourites" (backup text, route hint) and "Colour" (Showroom), with "Favourite" in Privacy. *Fix:* pick US English and sweep. *Effort:* S.

24. **P2 · Personal list alignment.** The Privacy and Terms rows have no icon, so their labels start 30 px left of the other rows. At 390, "Recommended board" and "Surf height scale" wrap to two lines. *Evidence:* `shots/light-m-_personal.png`. *Fix:* give those rows an icon or indent them, and shorten the labels ("Board pick", "Scale"). *Effort:* S.

25. **P2 · Form controls are unstyled or misaligned.** Profile photo and the Journal photo use the raw native "Choose File / No file chosen" input. On Profile, the Display name field is 64 px tall next to a 44 px select. The Add-board form uses the native browser validation bubble and has no required marker. *Evidence:* `shots/light-d-_personal_profile.png`, `shots/light-m-_personal_journal.png`, `i-d-addboard-empty-submit.png`. *Fix:* use styled file buttons ("Add photo"), the same field height, and inline errors. *Effort:* S.

26. **P2 · Dark theme leaks · /quiver at 390, /quiver/showroom.** The phone My-boards thumbnail strip stays light beige in dark mode. In the Showroom, the fin-chip glyphs (especially "None") are nearly invisible on dark chips, and the stage's fit line is low contrast. *Evidence:* `shots/dark-m-_quiver.png`, `shots/dark-d-_quiver_showroom.png`. *Fix:* theme the strip background and raise the glyph and fit-line contrast to AA. *Effort:* S.

27. **P2 · The wave-scale descriptor ends in a bare "~" · /forecast/wave-scale.** "overhead to double overhead ~". The "~" is explained only in a `title` tooltip (`ScaleStage.tsx:133`), which touch users and screen readers cannot reach. *Fix:* write "about overhead to double overhead", or add a visible "(approx.)". *Effort:* S.

28. **P2 · Compare boards is thin.** The table covers type, length, width, thickness, volume and fins only; there are no tail, construction or size-range rows. The stage ground (a blue gradient) differs from My boards (beige) and the Showroom (grey). *Evidence:* `shots/light-d-_quiver_compare.png`. *Fix:* add Tail, Construction and "Suits" rows, and use one stage ground across Quiver. *Effort:* S.

29. **P2 · Pages never reach network idle.** 13 of 76 crawl loads timed out after 45 s waiting for network idle (/quiver, /personal/*, /scale, unknown routes), so something keeps requesting in the background on non-forecast pages. There were also 20 aborted `/api/providers?keys=nearshore-…` requests on navigation. *Fix:* check for polling or prefetch on pages that show no forecast. *Effort:* M. *Re-verified:* crawl only. This may partly be the live data load (see items 1 and 11).

## Not checked
- iOS Safari and real touch gestures (stage swipe, the 360° drag).
- The Board scan flow ("Scan a board photo").
- Saving an edited board and deleting one.
- Alerts creation.
- Backup import (none is offered: Data & privacy has export only, so a user cannot restore a backup. Worth a product decision).
- The header search autofill (not live yet, per the brief).
