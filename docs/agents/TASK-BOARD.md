# Task board
> **Progress rule (2026-10-29):** a milestone is done only when the user has seen it working in the browser. Passing builds, tests or agent tasks are not evidence of product quality. Source: `docs/audit/2026-10-29/AUDIT.md`.

## Product backlog (from the 2026-10-29 audit; audit # in brackets)
**Confirmed defects**
| ID | Sev | Defect | Milestone |
|---|---|---|---|
| D-01 | P0 | ~~Explore wind and swell layers never load locally~~ **RESOLVED 2026-10-29 (T-011)**: live via the dev server path; QA verified at 1440 and 390 | R1 |
| D-02 | P0 | ~~NDBC buoy never connects locally~~ **RESOLVED 2026-10-29 (T-011)**: observation 40 min old, no stale snapshot | R1 |
| D-03 | P1 | Saving one of the 7 demo-only spots fails silently [5] | R2 |
| D-04 | P1 | ~~Home card photo credit and licence links cannot be clicked [6]~~ **RESOLVED 2026-10-29**: `.fav-card .shot` no longer `z-index: -1`, so the credit layers above the card button. Evidence: `playwright-toolkit/swello/d04.mjs` 16/16 at 1440 and 390 (baseline 10/16); tsc, 140 tests, build, journeys 8/8, home-shots 13/13 | R2 |
| D-05 | P1 | Forecast chart errors: last day → "7 days"; on mobile, opening a later day from Home [7] | R2 |
| D-06 | P1 | Personal "Home region" stored but never used [8] | R2 |
| D-07 | P3 | Forecast first x-axis label clipped [15] | R4 |

**Incomplete features**
| ID | Feature | State | Milestone |
|---|---|---|---|
| F-01 | Board Match | Always empty with live data; skill and preferred range inert [4,8] | R2 (needs the user's decision) |
| F-02 | Quiver showroom | 2D outline, no 3D, no rotation [10] | R5 |
| F-03 | Wave Scale | Tilted-plane "wave", mannequin, dark in both themes [11] | R6 |
| F-04 | Backup restore | Export exists, no import | later |
| F-05 | Surf cameras | "Planned" placeholders [14] | later (authorised feeds only) |

**Visual quality**
| ID | Problem | Milestone |
|---|---|---|
| V-01 | Explore: blocky 0.5° tiles over land, no legend or arrows, road basemap [9] | R3 |
| V-02 | Forecast: long and dense (5,366 px on phone), small labels [12] | R4 |
| V-03 | Personal: Profile tab shows every section [13] | R2 |
| V-04 | Whole app vs the ChatGPT references: dark cinematic direction not adopted | after R2 (theme decision) |

**Data dependencies**
| ID | Dependency | Blocks |
|---|---|---|
| X-01 | Validated breaking-wave estimate (T-008) | Board Match, Wave Scale link, face ranges |
| X-02 | Measured beach normals for Bolinas and Linda Mar | Spot profiles, wind relation |
| X-03 | Licensed ocean/satellite basemap | R3 |

**Unverified suspicions** (check before relying on them)
- U-01: production `/api/grid` path and Worker deployment never verified.
- U-02: ~~wind frame alignment~~ checked in T-011: the client floors to the 3-hourly step and labels the real valid time; the slider/label mismatch moves to T-012.
- U-03: Explore and Quiver on mobile were only crawled, not looked at closely.
- U-04: `color-mix` fallback untested in Safari; no Safari or Firefox testing at all.
- U-05: what favourites holding demo-only ids do elsewhere (exports, journal).

**Recovery milestones:** R1 live data locally · R2 no silent or dead controls · R3 Explore map · R4 Forecast · R5 Quiver 3D board · R6 Wave Scale. Details in AUDIT.md.

## Remodel 2026-10-29 (user-directed: "fully remodel", reference `~/Downloads/Swello Premium Surf App Showcase.png` + `Premium Surf Forecast Mapping UI Collection.png`)
- R1 `2774c4d`: dark cinematic default theme, DM Serif Display, nav/menus above the map (fixes menus hidden under Leaflet), new full-bleed Explore map (satellite, smooth land-masked field, flow, legend, time player, layers panel), Discover page. Closes the T-012 visual items 1–4 and 7.
- R2 `4b7bbef`: Home full-bleed photo hero + dark sections; Forecast cinematic header, metrics strip, day cards, distinct section pages.
- R3 `185636b` (frontend-engineer, worktree): Personal sidebar with distinct section pages; Quiver card grid, showroom lineup, match, compare.
- Evidence: tsc, npm test 140/140, build; journeys 8/8 (4–6 rewritten for the new pages); `sections-distinct.mjs` 23 routes × 2 widths distinct, no overflow; `menu-over-map.mjs` 5/5.
- Open: V-05 Quiver boards are flat outlines (needs 3D models); T-012 item 5 (frame availability on the slider) not done; Esri imagery is fine for development but needs a licence check before a public launch (X-03).

- Map R2 `2589bd1`: grids cover the California coast (32–42.5°N, 117–127°W, 7 days); 45 live spots; nav click opens menus.
- Nav R3: Forecast menu is a place browser (Region › County › Spot, recent + favourites rail), after studying surfline.com's nav principles (`ai-system-setup/research/surfline-nav/`); spot picker search; tide only near the SF station (fixed 38 chart errors found by `audit-controls.mjs`). Checks: journeys 8/8, nav-click 11/11, mega-menu 5/5, sections-distinct, menu-over-map.
- Next (user's order): typography, lighter theme, interactivity, Quiver 3D board room (Blender + three.js).

## Agent task log
States: BACKLOG → READY → IN PROGRESS → REVIEW → VERIFIED → COMPLETE · BLOCKED

| ID | Objective | Owner | Status | Next handoff |
|---|---|---|---|---|
| T-001 | Home week matrix fits a phone without sideways scrolling | frontend-engineer | COMPLETE | — |
| T-002 | Playwright journey suite (Home → Forecast → Explore → Quiver → Personal → Wave Scale) | qa-tester | COMPLETE | — |
| T-003 | Reference-driven visual rebuild (Phase B) | lead | BLOCKED: references found 2026-10-29 (`swello-design-references/CHATGPT-REFERENCES.md`); waiting on the theme-default decision. Superseded by R3–R6 below | user |
| T-004 | Forecast spot profiles and source audit (OB, Bolinas, Linda Mar) | architect | COMPLETE: `docs/forecast/T-004-source-audit.md` | lead |
| T-007 | Audit plan steps 2–4: `WaveReading` contract, fix D2/D3, show CDIP SF023 at Ocean Beach | frontend-engineer | COMPLETE | — |
| T-008 | Audit plan steps 1, 5, 6: approach, measured beach normals, validation data | user | BLOCKED: needs user decisions and data | lead |
| T-006 | Week section at 820 px tablet width is sparse (QA D2) | frontend-engineer | COMPLETE (with T-005) | — |
| T-010 | Primary nav overflows horizontally at 861–1040 px on every route (QA T-005) | frontend-engineer | COMPLETE (with T-005) | — |
| T-011 | R1: live Explore layers and buoy in local dev (audit D-01, D-02, U-02) | frontend-engineer | COMPLETE | — |
| T-012 | R3: Explore map to reference D: smooth ocean-clipped field, legend, arrows, basemap, slider shows model-frame range and nearest frame, mobile | frontend-engineer | READY | qa-tester, design-critic |
| T-009 | Mobile horizontal overflow: /forecast 477 px, /personal 422 px at a 390 px viewport (since at least 94dcf40; the QA check was blind to it) | frontend-engineer | COMPLETE (with T-005) | — |
| T-005 | Light/dark theme tokens; non-Home areas on the light theme; theme preference | frontend-engineer | COMPLETE | — |

---

## T-001: Home week matrix on phones
- **Objective:** at 390 px, "The week ahead" must read as a whole without the table scrolling sideways.
- **Owner:** frontend-engineer · **Dependencies:** none · **Inputs:** `docs/agents/CONTRACTS.md`; baseline screenshot `ai-system-setup/research/swello-reviews/home-v2/r3-mobile-full.png`
- **Owned files:** `src/features/home/HomeView.tsx` (the `Week` component and its call site only), `src/features/home/home.css` (`.week` rules and the `max-width: 860px` block)
- **Acceptance criteria:**
  1. At 390×844 no element in the week section is wider than the viewport, and the page has no horizontal overflow.
  2. Every spot × day value shown on desktop is still reachable on mobile (spot, day, rating word, time, offshore height).
  3. Each value is a button that sets the spot and time and opens Forecast (same behaviour as desktop), with a descriptive `aria-label`.
  4. The week's overall best hour is still marked.
  5. Desktop 1440 looks and behaves as before (table layout unchanged).
  6. `tsc --noEmit`, `npm test` (130), `npm run build` pass; no new console errors.
- **Status:** COMPLETE · **Outputs:** `handoffs/T-001-frontend.md`, `reviews/T-001-qa.md`, `reviews/T-001-code-review.md`
- **Tests performed:** tsc ✓ · npm test 130/130 ✓ · build ✓ · QA `t001-qa.mjs` at 360/390/820/1440 ✓ · `swello-qa.mjs` 72/72 (exit 0) · `home-shots.mjs` 13/13 · code review APPROVE · **Blockers:** —
- **History:** frontend-engineer implemented it → lead checked the diff and screenshots → qa-tester passed it and found D1 (dots invisible) and a crashing QA script, both regressions from 94dcf40 that the lead fixed → code-reviewer approved (1 medium finding fixed by the lead, 2 low fixed by frontend-engineer in cycle 1) → qa-tester retest passed.

## T-003: Reference-driven rebuild (BLOCKED)
Searched ~/Desktop, ~/Downloads, ~/Documents, ~/Pictures, ~/Development, the vault (excluding 99-Private) for images
newer than 2026-10-28 14:00. Found only screenshots of the old app (Desktop, 3:09–3:10 PM) and of the terminal
(8:55 PM). Needed from the user: the approved SWELLO concept images, or their path.

## T-005: Theme tokens and light theme for every area (includes T-006)
- **Objective:** Forecast, Explore, Quiver, Wave Scale and Personal currently render dark under a light navigation bar. Move every area onto one token system: light theme by default, the existing dark palette kept as `[data-theme="dark"]`, and a user preference (System / Light / Dark).
- **Owner:** frontend-engineer · **Dependencies:** none (T-003 will later refine visuals on top of these tokens) · **Inputs:** CONTRACTS.md; the Home `.coast` palette in `home.css` is the light reference; before screenshots in `playwright-toolkit/swello/artifacts/2026-10-29-04-15/qa/`
- **Owned files:** `src/ui/tokens.css`, `src/ui/app.css`, `src/features/home/home.css` (only to make `.coast` use the shared light tokens, plus T-006), `src/app/App.tsx` / `src/app/Nav.tsx` (only to apply the theme), `src/features/personal/PersonalView.tsx` (the theme control in Preferences), and the hard-coded colours in `src/features/forecast/charts.tsx`, `ForecastView.tsx`, `src/features/scale/*.tsx`, `src/features/quiver/QuiverView.tsx`, `src/features/explore/ExploreView.tsx`.
- **Acceptance criteria:**
  1. Light theme: every route at 1440 and 390 has a light ground, ink text, and no dark panels left over. Charts, compass dials, tide and swell graphics, the map chrome and the 3D viewer frame stay legible (contrast ≥ 4.5:1 for text, ≥ 3:1 for chart lines and marks against their backgrounds).
  2. Dark theme (`data-theme="dark"` on `<html>`) reproduces today's dark look for those areas. The nav stays light-on-light in light mode and switches to dark tokens in dark mode. Home may stay light in both modes (documented).
  3. The Preferences control (System / Light / Dark) applies immediately and persists across reload in localStorage key `swello-theme`, without changing the backup schema. System follows `prefers-color-scheme`.
  4. Rating colours keep their meaning in both themes. Data labels are unchanged.
  5. T-006: at 820 px the Home week cells are not stretched sparse (e.g. three or more columns per spot block between 600 and 860 px).
  6. tsc, `npm test` (130), build pass; `swello-qa.mjs` 72/72; `home-shots.mjs` 13/13; no new console errors.
- **Status:** COMPLETE
- **History:** frontend-engineer implemented it (two self-review rounds) → lead check found pre-existing mobile overflow hidden by the QA method (T-009) → qa-tester fixed the overflow check and passed criteria 1–5, finding the legend, T-010 and contrast issues → lead ran criterion 6 → code-reviewer APPROVE WITH FIXES → frontend-engineer correction cycle 1 plus T-009 and T-010 → qa-tester retest passed (one wording nit) → lead fixed the legend with real colour swatches.
- **Tests:** tsc ✓ · npm test 130/130 · build ✓ · swello-qa 72/72 exit 0 (with the corrected overflow check) · home-shots 13/13 · QA overflow sweep 147/147 at 7 widths · contrast ≥ 4.5:1 for text in both themes (QA measured).

## T-007: Nearshore data at Ocean Beach, honest labels (audit plan steps 2–4)
- **Objective:** show the already-fetched CDIP MOP SF023 nearshore nowcast on Forecast for Ocean Beach, and fix audit defects D2 and D3. No breaking-wave numbers.
- **Owner:** frontend-engineer · **Inputs:** `docs/forecast/T-004-source-audit.md` (sections 1 and 3, label policy), CONTRACTS.md
- **Owned files:** `src/features/forecast/ForecastView.tsx`, `src/ocean/bridge.ts`, `src/models/index.ts` (only the `confidence` field type, if needed), `src/utils/waveHeight.ts`, a new test `src/tests/t007.test.ts`, `docs/agents/CONTRACTS.md` (Data honesty section).
- **Acceptance criteria:**
  1. Forecast for Ocean Beach shows a "Nearshore model" panel: Hs, Tp and direction from `bundle.nearshore` for the record nearest the selected hour, labelled "Nearshore model Hs at 10 m depth (CDIP MOP SF023), not surf height", with its own valid time and location. Outside the nowcast window (now ±24 h) it says so; it never extrapolates. Other spots say "No nearshore model for this spot".
  2. D2: retrieved records are no longer labelled `confidence: 'Demo'`. Retrieval time is not presented as the model update time anywhere in the UI.
  3. D3: each buoy value shows its own observation time (or one shared time only when all values share it).
  4. A tested guard (`src/tests/t007.test.ts`) refuses to present a `breaking-estimate` without a method and a range (reconcile with `WaveMeasurementKind` in `waveHeight.ts`; no parallel type).
  5. CONTRACTS.md data-honesty rules updated (nearshore-model label, per-variable times).
  6. tsc, `npm test` (130 + new), build pass; swello-qa 72/72 exit 0; no new console errors; desktop 1440 and mobile 390 screenshots looked at.
- **Status:** COMPLETE
- **History:** frontend-engineer implemented it → qa-tester found 1 moderate (undated stale buoy times) and 1 minor (demo-mode text) defect → code-reviewer APPROVE WITH FIXES (3 medium, 4 low) → lead decided to enforce the breaking-estimate guard and show the latest nowcast with an explicit label → frontend-engineer correction cycle 1 → qa-tester retest passed (the no-numbers path before the first record is covered by unit tests only).
- **Tests:** tsc ✓ · npm test 135/135 · build ✓ · swello-qa 72/72 exit 0 · values checked against the CDIP CSV by QA.

## T-002: Browser journey suite
- **Objective:** functional end-to-end journeys, separate from screenshot reviews, to run before every commit.
- **Owner:** qa-tester · **Owned files:** `~/Development/ai-system-setup/playwright-toolkit/swello/journeys.mjs` (new) plus a short usage note in `docs/agents/README.md` under "Running the app and tests".
- **Journeys (each is a pass/fail check with a message):**
  1. Home: seed a profile, select a favourite spot card → hero shows that spot.
  2. From that card, open Forecast → URL `?spot=` and the spot picker match.
  3. Change the forecast hour (click and keyboard) → readout time and metrics change, and match the selected hour.
  4. Explore: select the same spot → returning to Forecast keeps the spot.
  5. Quiver: add a board, edit it, reload → changes persist and show in the list and showroom.
  6. Personal: change units (ft→m) and name → Home greeting and heights reflect them after reload.
  7. Forecast › Wave Scale: change controls (height slider, riding/paddling, units) → the readout and the scene state change.
  8. Theme preference persists across reload.
- **Acceptance:** runs headless against the dev server and exits non-zero on any failure; prints a per-journey summary; passes on the current build, or failures are reported as defects with repro. It does not judge visual quality.
- **Status:** COMPLETE. 8/8 in three consecutive QA runs plus one lead run (exit 0, about 40 s). Limits: desktop 1440 only, needs live data, checks not mutation-tested, script lives outside git (playwright-toolkit).

## T-011: Live Explore layers and buoy in local development (R1)
- **Objective:** local dev uses the existing same-origin server path, so regional grids and the NDBC buoy load instead of failing on browser CORS. · **Priority:** P0 · **Owner:** frontend-engineer · **Dependencies:** none
- **Owned files:** `.env.development` (new), `src/map/spatial.ts` and `src/ocean/request.ts` (only if needed for frame-time alignment or error states), `.env.example` comments. Production behaviour must not change.
- **Functional acceptance:**
  1. `/explore/wind` and `/explore/swell` render a model layer with its source and valid-time label within 30 s of load; no "Continuous heatmap unavailable" for the current hour.
  2. Moving the Explore time slider changes the layer to the matching model frame, or says plainly that no frame exists at that time (wind is 3- or 6-hourly). No silent blank map.
  3. Forecast › Sources shows NDBC 46026 **connected** with an observation time under 3 h old; no "saved snapshot, N days old".
  4. Works again after a page reload and after navigating Explore → Forecast → Explore.
  5. Browser CORS errors for ERDDAP and NDBC are gone; no new console errors.
  6. `tsc`, `npm test`, `npm run build` pass; `swello-qa.mjs` 72/72; `journeys.mjs` 8/8.
- **Visual:** design-critic reviews Explore with the layers on, against reference D. Findings are recorded as backlog (V-01), **not** fixed in this task.
- **Status:** COMPLETE (functional). Visual quality is not done; it carries over to T-012.
- **History:** frontend-engineer implemented it → lead checked the diff and restarted the dev server → qa-tester: 4 PASS, 2 PARTIAL (no frames after about Sun 8 PM; wind label lags the slider; 404 console lines) → design-critic: "does not meet the reference" (top 5 → T-012) → code-reviewer: APPROVE WITH FIXES (a 404 could hide the production fallback) → frontend-engineer correction cycle 1 (`code:'no_frame'`, 5 tests) → qa-tester retest passed.
- **Test evidence:** tsc ✓ · npm test 140/140 · build ✓ · swello-qa 72/72 · journeys 8/8 · curl checks of the no-frame and unknown-endpoint responses · 0 CORS errors.
- **Review evidence:** `reviews/T-011-qa.md`, `T-011-code-review.md`, `T-011-design.md`.

## T-012: Explore map (R3), backlog from the T-011 QA and design critique
- **Priority:** P2 visual (V-01) plus UX findings · **Owner:** frontend-engineer · **Inputs:** `reviews/T-011-design.md` (top 5), `reviews/T-011-qa.md` (no model frames beyond about Sun 8 PM, roughly 40% of the 7-day slider; wind frames every 3 h; /api/grid 404 console errors at no-frame positions)
- **Acceptance (draft):**
  1. Smooth field, no visible cell seams, clipped to water.
  2. Legend with units.
  3. Direction arrows.
  4. Muted, licensed basemap that follows the theme.
  5. The slider shows where model frames exist and labels the nearest frame time.
  6. No console errors at no-frame positions (the server answers "no frame" without a network error, or the client avoids requesting it).
  7. Mobile controls ≥44 px.
  8. design-critic verdict at least "Partly", with no item 1–2 remaining.
- **Status:** READY (next milestone after R2 decisions)
