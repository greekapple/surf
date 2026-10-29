# SWELLO product audit: 2026-10-29
Baseline: commit `3d75bfb`, tagged `checkpoint/pre-audit-2026-10-29`. Local dev server, Chrome via Playwright, by the lead (no agents).

## Method
- A crawler (`playwright-toolkit/swello/audit-controls.mjs`) opened all 21 routes at 1440 and 390 px and clicked every visible control: 457 desktop, 466 mobile. For each it recorded whether the URL, visible text or DOM changed, or nothing happened, plus console errors.
- The lead looked at the full-page screenshots and wrote targeted probes for anything where "something changed" might still be wrong.
- **Not exercised:** delete buttons, file import/export, typing into every form field, screen readers, Safari/Firefox, the production build.
- **Evidence:** the PNGs in this folder; the raw logs are `playwright-toolkit/swello/artifacts/audit/w1440|w390/controls.json`.

## What actually works
- Navigation: five areas, sub-tabs, dropdowns, phone tab bar, `?spot=` deep links.
- Home: greeting, favourite cards for the three live spots, surf windows, 24 h chart and week table. Every hour or cell opens Forecast at that hour (verified).
- Forecast: timeline hour selection (click, keyboard, list), day/7-day toggle, nearshore panel (values match CDIP), tide chart, compare table, spot picker.
- Personal: name, units, theme, data-source switch, journal logging, export.
- Quiver: add, edit and delete boards, persisted (journey suite).
- Live point data from Open-Meteo and NOAA tides; the CDIP nearshore nowcast.

## What is simulated or a placeholder
| Item | What it is |
|---|---|
| Demonstration week | Fixed illustrative data behind a switch. Labelled. |
| 4 example boards ("Demo Workshop · Drift (fictional)") | Seed data |
| Board Match | Works only in demo mode; always empty with live data |
| Wave Scale | Illustrative, not linked to the forecast; procedural wave and mannequin |
| Quiver board visuals | 2D SVG outline of a category shape, not 3D and not the user's board |
| Ratings | Provisional, uncalibrated engine |
| Surf camera cards (Forecast, Explore) | "Planned" placeholder |
| 7 of 10 spots in Personal (Stinson, Montara, Mavericks, Steamer Lane, Cowell's, Pleasure Point, Davenport) | Demo-only, no live data |

## Prioritised defects
Severity: **P0** a core feature does not work · **P1** broken or misleading interaction · **P2** visibly weak or unfinished · **P3** polish.

| # | Sev | Area | Defect | Reproduce | Evidence |
|---|---|---|---|---|---|
| 1 | P0 | Explore | Wind and swell layers never render locally. Map shows "Continuous heatmap unavailable". | `/explore/wind`, wait 20 s. Browser calls to `upwell.pfeg.noaa.gov` ERDDAP fail (CORS). | 01 |
| 2 | P0 | Forecast | NOAA buoy 46026 never connects locally; Forecast shows a 9-day-old saved snapshot. | `/forecast` → Sources: NDBC "partial". | 07 |
| 3 | P0 | Architecture | Root cause of 1 and 2: the app has a working server proxy (`/api/grid`, `/api/provider`, mounted in the dev server), but `src/map/spatial.ts:51` and `src/ocean/server.ts` use it only when `PROD` or `VITE_FORECAST_SERVICE=on`. Verified: with the flag on, both layers load NOAA data and the buoy reports "connected", with 0 console errors. The production path is unverified. | Start dev with `VITE_FORECAST_SERVICE=on` | 02 |
| 4 | P0 | Quiver | Board Match is permanently empty with live data; Home's "Board for now" card leads to it. | `/quiver/match` | 03 |
| 5 | P1 | Personal → Home | Saving any of the 7 demo-only spots fails silently: it is not on Home, not in the spot picker, nowhere. | Personal › Saved spots › star Mavericks → Home | 04 |
| 6 | P1 | Home | Photo credit and licence links on favourite cards cannot be clicked (covered by the card button). The attribution is visible, but the licence link is required by CC BY-SA practice. | Click "Radomianin" on a Home card | crawler log |
| 7 | P1 | Forecast | Chart drawing errors (`<path d>` without `M`, negative `<rect>` width). Desktop: select the last day (Wed), then "7 days". Mobile: open Forecast from any Home hour on a later day. The chart recovers after the transition. | as described | 10, crawler log |
| 8 | P1 | Personal | Controls with no effect: "Home region" is stored and never read. "Surfing ability" and "Preferred wave range" only feed Board Match, which never runs live. | Change them; nothing changes anywhere | 09 |
| 9 | P2 | Explore | Even when data loads, the layer is four large 0.5° colour blocks painted over land, with no legend, units, arrows or land mask. The basemap is a road map, not an ocean map. | `/explore/wind` with the flag on | 02 |
| 10 | P2 | Quiver | The showroom is unfinished: the same flat 2D outline as My Boards, no 3D, no rotation, no fins, rails or rocker, mostly empty canvas. | `/quiver/showroom` | 05 |
| 11 | P2 | Wave Scale | The 3D "wave" is a tilted plane with no lip or curl; the surfer is a mannequin; the "6 ft face" marker measures the slope; the scene is dark in both themes. The comparison uses cartoon shapes with large empty areas. | `/forecast/wave-scale` | 06 |
| 12 | P2 | Forecast | Visually weak and long: 2,833 px on desktop, 5,366 px on phone (about 6.4 screens). Many small cards of equal weight; chart labels around 10–11 px; a thin hero strip; an 11-row "Sources & reliability" table on the main page. | `/forecast` | 07, 08 |
| 13 | P2 | Personal | The "Profile" tab shows every Personal section on one long page; the other tabs just filter it. | `/personal` | 09 |
| 14 | P3 | Forecast, Explore | "Surf camera · Planned" placeholder cards take prime space. | — | 01, 07 |
| 15 | P3 | Forecast | The first x-axis label is clipped ("5 PM" → "PM"). | `/forecast` | 10 |

## Problems that block progress
1. **Development and production use different data paths.** Local development, all our QA and every screenshot ran against a degraded app, so Explore was broken in every review without anyone seeing it.
2. **Two spot universes.** Ten demo spots and three live spots are mixed in the same lists (Personal, favourites), which causes defect 5.
3. **Many features depend on a breaking-wave estimate that does not exist** (Board Match, Wave Scale link, face ranges, preferred range, skill matching). In live mode they are switched off, so much of Quiver and Personal does nothing. This needs a product decision (T-008): a clearly labelled interim basis, or hiding these features until a validated estimate exists.
4. **The 3D realism ceiling.** Without models (no Blender) or a much better procedural mesh, Quiver and Wave Scale cannot look convincing.
5. **Our verification measured the wrong thing.** The journey suite and QA checked that controls respond, not that features deliver value, so 8/8 and 72/72 passed alongside defects 1–5.

## Recovery plan
A milestone counts only when you have seen it in the browser and agreed. Each is small, starts from the most serious functional failure, and comes with before and after screenshots of the exact screens.

| # | Milestone | What you will be able to see and do | Verification |
|---|---|---|---|
| R1 | **Live data actually loads locally** (defects 1–3) | Explore wind and swell layers show NOAA data; Forecast's buoy shows "connected" with current values | Turn on the server path in development (`.env.development`); align wind frame times to the model cadence; QA with data-arrival assertions, not just "something changed" |
| R2 | **No silent or dead controls** (defects 4–8) | Demo-only spots clearly marked and not silently saveable in live mode; credit links clickable; no chart errors; Personal fields either do something visible or are removed; Board Match shows a labelled interim view or is hidden (your decision) | Re-run the control crawler: 0 console errors, every control has an expected and checked effect |
| R3 | **Explore map that looks like an ocean map** (9, 14) | Ocean-focused basemap, smooth field clipped to water, legend with units, wind and swell direction arrows, time slider driving it | Side-by-side with your ChatGPT references |
| R4 | **Forecast restructure** (12, 15) | One strong summary, one main chart, secondary detail collapsed; phone page about half its current length | Reference comparison; you review |
| R5 | **Quiver showroom with a real 3D board** (10) | A board generated from its dimensions (outline, rocker, rails, fins), rotatable, lit, inside the showroom | Rendered geometry checked against board photos |
| R6 | **Wave Scale realism** (11) | A breaking-wave mesh with a lip, a proportioned surfer, a measured face line | Needs Blender (your approval to install) or a parametric mesh; compared against reference photos |

R1 and R2 do not depend on the references.

**References (ingested after the audit):** the four 2026-10-28 ChatGPT images are the primary visual direction, catalogued in `~/Development/swello-design-references/CHATGPT-REFERENCES.md`. They call for a dark cinematic UI, serif display type, glass cards over coastal photography, a satellite map with a smooth field and streamlines, a warm architectural showroom, and a 3D wave card inside Forecast. Consequences:
- Default to the dark theme with a new palette; the 2026-10-22 light editorial set becomes the light theme.
- R3 = map from reference D; R4 = Forecast from reference A panel 2; R5 = Quiver from A panel 4; R6 = the wave card in A panel 2.
- A Home revision to match references A, B and C can follow R2.
- Data shown in the references that SWELLO cannot honestly produce (breaking "surf" heights, "Good" ratings presented as fact, LIVE cameras) is reproduced only as layout, with honest labels.
