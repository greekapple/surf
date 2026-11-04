# Task board
> **Progress rule (2026-10-29):** a milestone is done only when the user has seen it working in the browser. Passing builds, tests or agent tasks are not evidence of product quality. Source: `docs/audit/2026-10-29/AUDIT.md`.

## Product backlog (from the 2026-10-29 audit; audit # in brackets)
**Confirmed defects**
| ID | Sev | Defect | Milestone |
|---|---|---|---|
| D-01 | P0 | ~~Explore wind and swell layers never load locally~~ **RESOLVED 2026-10-29 (T-011)**: live via the dev server path; QA verified at 1440 and 390 | R1 |
| D-02 | P0 | ~~NDBC buoy never connects locally~~ **RESOLVED 2026-10-29 (T-011)**: observation 40 min old, no stale snapshot | R1 |
| D-03 | P1 | ~~Saving one of the 7 demo-only spots fails silently [5]~~ **NOT REPRODUCIBLE 2026-10-30 (T-019)**: all 45 spots have live evidence; guard test `t019-spots.test.ts` | R2 |
| D-04 | P1 | ~~Home card photo credit and licence links cannot be clicked [6]~~ **RESOLVED 2026-10-29**: `.fav-card .shot` no longer `z-index: -1`, so the credit layers above the card button. Evidence: `playwright-toolkit/swello/d04.mjs` 16/16 at 1440 and 390 (baseline 10/16); tsc, 140 tests, build, journeys 8/8, home-shots 13/13 | R2 |
| D-05 | P1 | ~~Forecast chart errors: last day → "7 days"; on mobile, opening a later day from Home [7]~~ **GUARDED 2026-10-30 (T-015)**: not reproducible; one-point paths and empty areas guarded, `t015-qa.mjs` samples the SVG | R2 |
| D-06 | P1 | ~~Personal "Home region" stored but never used [8]~~ **RESOLVED**: Find Spots uses it (verified T-019); helper text in Personal | R2 |
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

- Round 2026-10-29 (late): Quiver lineup + realism + photo trace (frontend-engineer, worktree); realistic Wave Scale (frontend-engineer, worktree) opened from a spot at its offshore Hs; Find Spots by location/home region and distance bands; Compare in Explore; one-page Forecast; global map layer; light Apple-style theme. Lead fixed two agent misses found by `wave-spot.mjs` (no height in label, disabled Back button). Checks: 146 tests, build, journeys 8/8, wave-spot 8/8, find-spots 4/4.
- Still open: surfer and board in Wave Scale are stylised; showroom resin/fins/reflections; traced boards reuse category rocker; site still reads as AI-generated (user: fix later).

- **Round 2026-10-30 (reference-led remodel), HEAD b9b2f82:** dark cinematic default from the user's reference images, serif headlines, floating nav, shared Condition chip; Home/Forecast/Explore/Personal rebuilt against crops in `swello-design-references/00-target/` with `compare.mjs`; Quiver photographed showroom + photo scan; sculpted surfer; alerts. Checks: 160 tests, build, journeys 8/8, sections-distinct, wave-spot 8/8. **Next actions:** vault `80-Handoffs/2026-10-30-swello-reference-remodel.md`.

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

## Hybrid trial 2026-10-30 (Stage F; mode B, see `HYBRID.md`)
## T-013: Explore marker labels never collide
- **Priority:** P2 (handoff next action 3) · **Owner:** `product` terminal (Opus) · **Branch/worktree:** `worktree-product`, `.claude/worktrees/product` · **Dependencies:** none
- **Owned files:** `src/features/explore/*`, `src/map/*` (no `src/app/`, `src/ui/tokens.css`)
- **Acceptance:** 1. At 1440 and 390, default view and zoomed into the Bay Area/Santa Cruz clusters, no two visible spot labels overlap (measured with bounding boxes in a Playwright script, 0 overlaps). 2. Hidden labels reappear as you zoom in; the selected spot's label always shows. 3. Markers stay clickable and open the same spot as before. 4. No new console errors; journeys 8/8.
- **Verification:** new overlap script `playwright-toolkit/swello/t013-overlap.mjs` (bounding-box overlap count per view), screenshots at 1440/390 compared with `~/Development/swello-design-references/10-chatgpt-2026-10-28-dark/D-explore-map-collection.png` (`compare.mjs`).
- **Status:** READY · **Handoff:** `handoffs/T-013-product.md`

## T-014: Home "Next Best Windows" as time ranges
- **Priority:** P2 (handoff next action 5) · **Owner:** `engineering` terminal (Sonnet) · **Branch/worktree:** `worktree-engineering`, `.claude/worktrees/engineering` · **Dependencies:** none
- **Owned files:** `src/services/windows.ts` (+ a new `src/tests/windows-range.test.ts`), and in `src/features/home/HomeView.tsx` only `surfWindows` / `Windows` and the best-window line on spot cards
- **Acceptance:** 1. A pure function groups consecutive supplied hours at one spot whose rating stays within the window's band (lead decision 2026-10-30: every hour scores ≥55, the existing `upcomingWindows` threshold; consecutive = supplied records exactly 1 h apart) into a range (start, end, peak hour, peak score); gaps in supplied data break the range; no hours are invented. 2. Home shows "11 AM–1 PM" style ranges in the spot's local time; a single qualifying hour shows as one hour. 3. Clicking a window still opens that spot's forecast at the peak hour. 4. Unit tests cover contiguous, gapped, single-hour, day-boundary and missing-rating cases. 5. tsc, npm test, build, journeys 8/8; 1440/390 screenshots of Home looked at.
- **Status:** READY · **Handoff:** `handoffs/T-014-engineering.md`

## Backlog round 2026-10-30 (user's order; mode B, at most two workers busy)
## T-015: Forecast polish + D-05
- **Priority:** P1 · **Owner:** `product` (Opus) · **Branch:** `worktree-product` · **Dependencies:** after T-013 merge
- **Owned files:** `src/features/forecast/*` only
- **Acceptance:** 1. Chart tooltip shows icon rows (swell, wind, tide, rating), each with a labelled value and no unlabelled numbers. 2. Wave-scale control is a horizontal slider that works by drag and keyboard. 3. Period labels are readable at 390 (no clipping or overlap, measured with bounding boxes). 4. D-05: no `<path d>` without `M` and no negative `<rect>` width when choosing the last day then "7 days" (desktop) or opening a later-day hour from Home (390); console clean. 5. tsc, npm test, build, journeys 8/8; 1440/390 compared with `00-target/forecast.png`.
- **Status:** DONE (merged) · **Handoff:** `handoffs/T-015-product.md`

## T-016: Quiver Focus size + real photo scan
- **Priority:** P2 · **Owner:** `product` · **Branch:** `worktree-product` · **Dependencies:** after T-015
- **Owned files:** `src/features/quiver/*`
- **Acceptance:** 1. In Focus at 1440 the board fills ≥60% of the stage height (measured). 2. Photo scan run on `swello-design-references/04-quiver/user-studio-board.jpg` and `user-board-wall.jpg`: the traced outline follows the board (overlay screenshot), and failures are reported honestly. 3. Checks + 1440/390 against `00-target/quiver.png`.
- **Status:** DONE except photo scan (→ T-020) · **Handoff:** `handoffs/T-016-product.md`

## T-017: Board Match (F-01) on the breaking-wave estimate (logic)
- **User decision 2026-10-30:** Board Match may run on the unvalidated estimate range, labelled "based on an unvalidated estimate"; spots without an estimate show no match.
- **Owner:** `engineering` · **Branch:** `worktree-engineering` · **Dependencies:** T-008 merged (done)
- **Owned files:** `src/ocean/match.ts`, `src/recommendation/*`, `src/services/windows.ts`, tests; in `HomeView.tsx` only `surfWindows`
- **Acceptance:** 1. `evidenceMatch` uses `faceEstimate.rangeFt` when `face.value` is null: a range overlapping the preferred min–max counts as in range, and the comfort and skill caps use the range high. The reason text names the estimate as unvalidated. 2. Other missing inputs (character, difficulty, hazards) are still reported honestly; if Ocean Beach lacks them, list exactly which ones, and don't invent them. 3. `scoreBoard` accepts the range the same way. 4. T-014b: a window keeps only hours within 10 points of its peak (and ≥55), and at most 2 windows per spot in the 4 shown. 5. Unit tests cover each case; tsc, test, build, journeys 8/8.
- **Then (product):** show "Est. X–Y ft at the break · model estimate, not measured" on Forecast/Home, plus the Board Match and Wave Scale tie-in. **Status:** DONE (logic T-017; UI T-018, T-018b, T-021)

## Defects D-03, D-06
- D-03 (demo-only spot saves silently) and D-06 (Home region unused; check whether FindSpots already reads it): owner chosen by file ownership at dispatch. **Status:** QUEUED

## T-018: Show the breaking-wave estimate (UI) + Wave Scale tie-in
- **Owner:** `engineering` · **Branch:** `worktree-engineering` · **Dependencies:** T-008, T-017 merged
- **Owned files:** `src/features/forecast/*`, `src/features/scale/*`, `src/features/home/HomeView.tsx` (spot cards and hero stat line only), tests
- **Acceptance:** 1. Forecast stat row gains "Surf (breaking) · Est. X–Y ft" with the sub-label "model estimate, not measured · unvalidated"; spots that refuse show "No estimate" plus the refusal reason on hover/focus. 2. Offshore Hs stays visible and labelled as offshore. 3. Wave Scale opened from a spot with an estimate starts at the range midpoint and labels it "estimate"; otherwise it keeps today's offshore start, labelled. 4. Board Match surfaces show the unvalidated wording when present. 5. Checks + journeys + wave-spot 8/8 + 1440/390 vs `00-target/forecast.png`.
- **Status:** DONE (merged)

## T-019: D-03 + D-06 (queued behind T-018 for engineering)
- **Owned files:** `src/features/personal/*`, `src/features/explore/FindSpots.tsx` (not `ExploreView.tsx`, product), favourites/spot-picker code it leads to; tests
- **Acceptance:** D-03: starring a demo-only spot either works end to end (Home card + picker) or is refused visibly with the reason; no silent failure. D-06: Home region is read somewhere the user can see (FindSpots default, Home ordering) or the control is removed; verify FindSpots first. Checks + journeys.
- **Status:** DONE: D-03 not reproducible (all 45 spots live, guard test); D-06 already used by Find Spots, helper text added

## T-020: Photo scan works on real single-board photos
- **Owner:** `product` · **Owned files:** `src/features/quiver/*`, `src/utils/boardPhoto.ts`, new `src/tests/board-photo-*.test.ts`
- **Acceptance:** optional user crop box + horizon-aware background; `04-quiver/user-studio-board.jpg` traces within 10% length/width ratio (overlay shot); `user-board-wall.jpg` still refused without a box; confirm step before saving; checks + journeys. **Status:** IN PROGRESS

## Round 2026-10-30 (evening): Surfline-led navigation (user direction)
User: "use the references more closely … use already published working websites … surfline as a baseline … reverse engineer the navigation of Surfline with our own cool aspects; Home: saved spots but no forecast data, concise and short; nav and top dashboard similar to Surfline; keep Apple apps/sites in mind." Remove the section pills ("the top dashboard clickable things").

## T-022: Surfline navigation teardown → spec → new nav, top bar, concise Home
- **Owner:** `product` (Opus) · **Branch:** `worktree-product` · **Shared files agreed by lead:** `src/app/App.tsx`, `src/app/Nav.tsx`, `src/app/routes.ts`, `src/ui/app.css`; plus `src/features/home/*`
- **Phase 1 (spec, lead review before code):** Playwright teardown of surfline.com at 1440/390 (home, header, menus, search, favourites bar, a spot page incl. its tabs, mobile nav); 1–2 more sites that do this well (e.g. Windy, Apple Weather/Apple sites for restraint). Screenshots → `~/Development/swello-design-references/15-surfline-nav/` (reference only, not shipped). Spec → `docs/design/NAV-SPEC.md`: Surfline pattern → SWELLO equivalent → what we add/omit.
- **Phase 2 acceptance:** 1. No section pills anywhere; every top-level control changes what you see (script asserts content changes per click). 2. Top bar + favourites strip modelled on Surfline (saved spots: name, condition colour, labelled height; no other forecast data on Home). 3. Home is short (≤ 2 viewports at 1440, ≤ 3 at 390). 4. Search finds a spot and opens its forecast. 5. Old URLs still resolve. 6. tsc/test/build, journeys 8/8 (update journeys only where the UI legitimately moved, say which), sections-distinct replaced by a nav script, 1440/390 side by side with the Surfline shots.
- **Status:** DONE (merged b524fae + lead fix fc4c936: three chart rect widths clamped after t022-nav caught a negative width at 390). Follow-ups: fresh users see an empty strip (consider labelled suggested spots, like Surfline's "Recommended for you"); t015-qa.mjs 390 step targets removed Home hour cells; boards are flat outlines.

## T-023: Quiver section change while the add-board form is open (bug)
- **Owner:** `engineering` · **Owned:** `src/features/quiver/*`, tests · **Repro (lead):** open Add board, click Showroom/Board Match/Compare: URL changes, form stays. **Acceptance:** navigating to any Quiver section closes the form (with unsaved-changes confirm if fields were edited); script proves content changes. **Status:** DONE (merged; t023-quiver.mjs fails without the fix)

## T-024: Saved-spots strip data (for T-022's Home)
- **Owner:** `engineering` · **Owned:** new `src/services/spotStrip.ts` + test · **Acceptance:** pure selector per saved spot → {name, region, category/colour, height label: estimate range if presentable else "X ft offshore", valid time}; never unlabelled height; unit tests. Product consumes it. **Status:** DONE (merged)

- **T-022 decisions (lead, 2026-10-30):** "Map" replaces "Explore" in the bar (/explore kept, /map alias); saved-spots strip under the bar on Home and Forecast; phone keeps bottom tabs. **User:** strip shows condition colour + labelled height (like Surfline Favorites); Home body has no forecast numbers.

## T-025: Quiver My Boards as a showroom rack (vs 00-target/quiver.png)
- **Owner:** `engineering` · **Owned:** `src/features/quiver/*`, tests · **Acceptance:** upright rack + emphasised selection, real spec panel + View in 3D, thumbnail strip with keyboard, 390 swipe view, keyboard path for the scan crop box; t023 still passes; checks + 1440/390 vs target. Existing assets only. **Status:** DONE (merged; boards are flat outlines vs photographed decks: asset decision for the user)

## T-026: Spot-report data (Surfline-style), no UI
- **Owner:** `engineering` · **Owned:** new `src/services/spotReport.ts`, `src/tests/spot-report.test.ts` · **Acceptance:** headline, 7 days AM/PM from supplied hours, swell components, tides, light, all labelled or null; tests incl. DST and missing data. **Status:** DONE (merged; wind sea omitted because the feed has no partition; sunrise maths duplicated from forecast helpers, dedupe later)

## Round 2026-10-30 (night): cinematic pass (user direction)
User: "watch the video … use any reference website similar … i want it to be that level; the website and app still look super bland on phone … if the rest was more interactive and cool the font wouldn't be as detrimental." Reference: YouTube Z9-ik87kGzI ("Claude + Seedance 2.5 = Insane Websites", Aeron Precision demo); lead's frames in the session scratchpad. Patterns to adopt: full-bleed dark hero with giant display type behind the subject; annotated diagram (subject centred, callouts on hairline leaders, revealed on scroll); scroll-lit paragraph (words light up as you scroll); parallax photo/video sections; one idea per screen. **User decisions:** imagery via Higgsfield AI (paid, user connects the MCP; labelled as illustration, never as current conditions); heading font: user picks from 3 rendered options (Michroma / Unbounded / Syne, body Inter), lead swaps `--display` after; start with Forecast.

## T-027: Forecast, cinematic and phone-first
- **Owner:** `product` (Opus) · **Owned:** `src/features/forecast/*` (+ `src/ui/app.css` only for shared motion tokens, agree with lead)
- **Acceptance:** 1. 390 first screen: full-bleed hero (≥ 85svh) with the spot name and the headline height in huge display type layered with the photo; honest labels unchanged ("Est. X–Y ft at the break · model estimate, not measured" or "X ft offshore · not surf size"). 2. "Today at <spot>" annotated section: spot/photo or wave visual centred, ≥ 4 real callouts (swell, wind + shore relation, tide + trend, water) on hairline leaders, each revealed on scroll; data from existing selectors/`spotReport`, nothing invented. 3. One scroll-lit sentence built from real data (e.g. "Solid, falling tide, onshore W wind by 5 PM"), words light up with scroll. 4. Motion: CSS scroll-driven animations with IntersectionObserver fallback; `prefers-reduced-motion` shows final states; no new dependencies. 5. Fonts only via `var(--display)`/`var(--body)` (lead swaps the face later). 6. Day/hour controls, charts and journeys keep working; t015-qa 390 step updated to the new route in. 7. tsc/test/build, journeys 8/8, t022-nav, wave-spot; 1440/390 screenshots before/after next to the video frames; 0 px overflow at 390.
- **Status:** OPEN

## T-028: Labelled media component + AI asset slot (for T-027 and later Home/Quiver)
- **Owner:** `engineering` (Sonnet) · **Owned:** new `src/ui/Media.tsx`, `src/ui/media.css`, `public/media/manifest.json`, `src/tests/media.test.ts`
- **Acceptance:** `<Media id>` renders image or looping muted video from the manifest with poster, lazy load, `prefers-reduced-motion` → poster only, `object-fit` focal point; every entry carries `kind: 'photo'|'ai-illustration'`, credit/licence, and AI entries render a visible "Illustration · AI-generated, not current conditions" caption (test asserts no AI entry without it); manifest falls back to existing CC photos so nothing is blank before Higgsfield assets exist. Then follow-ups: dedupe sunrise maths (spotReport vs forecast helpers), remove unused `.qv-grid` CSS. tsc/test/build.
- **Status:** OPEN

## T-029: Higgsfield imagery (user approved paid credits 2026-10-30)
- **Owner:** lead generates (Higgsfield MCP, user scope `https://mcp.higgsfield.ai/mcp`); `engineering` adds manifest entries + optimised files; `product` places them (T-027 and later Home/Quiver).
- **Look:** moody, near-monochrome cold Pacific (blue-black, fog, white water), matching the dark theme; no surfers' faces, no logos, no text in images; nothing that reads as a specific real spot on a specific day.
- **Shot list (v1):** 1. `ai-forecast-hero` beach-break lines at dusk, head-on, 9:16 + 16:9. 2. `ai-forecast-loop` same scene, 8 s static camera, waves rolling (Seedance). 3. `ai-home-hero` foggy NorCal headland at dawn, 9:16 + 16:9, + 8 s loop. 4. `ai-today-aerial` top-down beach break with swell lines, centred, room for callouts. 5. `ai-board-studio` top-down surfboard on dark concrete, soft studio light, plain background.
- **Honesty:** every asset is `kind: 'ai-illustration'` with the forced caption "Illustration · AI-generated, not current conditions" and a CC photo fallback; alt text says illustration; never paired with a spot name as if it were that spot now. Log prompts, model and credits in `public/media/PROMPTS.md`.
- **Budget:** stop and ask the user before exceeding ~$25 of credits.
- **Status:** OPEN (waiting on the user's MCP sign-in)

## T-030: Home, cinematic and phone-first (user order: Forecast → Home → Quiver → Personal)
- **Owner:** `engineering` · **Owned:** `src/features/home/*` (uses `src/ui/Media.tsx`, `src/services/spotStrip.ts`; no edits to shared files without lead)
- **Acceptance:** 1. 390: hero fills the first screen (≥ 90svh), `<Media>` full-bleed with slow parallax, "Hello." / greeting in huge `var(--display)` 700; one short line; a single primary action. 2. Saved spots as large horizontally swipeable cards (scroll-snap) with spot photo, name, region, condition colour; **no forecast numbers in the Home body** (user rule); tap opens that spot's forecast. Empty state: "Popular spots" clearly labelled as not personalised (no fake favourites). 3. One scroll-lit sentence (words light up on scroll), honest and static (e.g. what Swello is), not forecast data. 4. The three tiles become full-bleed stacked panels (Forecast, Map, Quiver) with parallax image and big type, each a link. 5. CSS scroll-driven animation with IntersectionObserver fallback; `prefers-reduced-motion` = final states; no new dependencies. 6. Home ≤ 4 viewports at 390, ≤ 3 at 1440. 7. tsc/test/build, journeys 8/8 (update only where UI legitimately moved), t022-nav, home-shots; 1440/390 before/after; 0 px overflow.
- **Status:** OPEN

- **T-027 / T-030 status (lead):** both DONE and merged (9c02488, T-030 merge). On lead after both: tsc, 216/216, build, journeys 8/8, t022-nav ALL PASS (Home height budget raised to ≤3 at 1440 / ≤4 at 390 per T-030), wave-spot 8, t030-home ALL PASS, t015-qa ALL PASS ×2 (one earlier flaky fail did not reproduce). T-029 assets committed 9c3afa4 (`public/media/ai/`, log `public/media/PROMPTS.md`, 292 credits).

## T-031: Wire the AI media into Forecast and Home
- **Owner:** `engineering` · **Owned:** `public/media/manifest.json`, `src/ui/Media*`, `src/features/forecast/*`, `src/features/home/*` (product has moved to Quiver)
- **Acceptance:** 1. Manifest entries for every file in `public/media/ai/` (kind `ai-illustration`, forced caption, CC fallback, srcset from the -800/-1400/-2400 files, stills as video posters). 2. Forecast hero: `ai-forecast-loop-tall` (390) / `ai-forecast-hero-wide` + `ai-forecast-loop-wide` when present (1440) for every spot, caption visible, alt says it is a generic AI illustration, not that spot; spot's own real photo, when it has one, stays reachable (e.g. in the band). 3. "Today at" plan view sits over `ai-today-aerial` (dimmed) without hurting callout legibility. 4. Home hero uses `ai-home-loop-*` with `ai-home-hero-*` posters. 5. Videos: muted, playsinline, loop, preload metadata, pause when off-screen, poster only under reduced motion and on Save-Data. 6. Check the built Worker size: if media are embedded, keep them as static assets instead and say what changed. 7. tsc/test/build, journeys, t022-nav, t027/t030 scripts, 0 px overflow, 1440/390 shots.
- **Status:** OPEN

## T-032: Quiver, cinematic (annotated board, like the Aeron jet section)
- **Owner:** `product` · **Owned:** `src/features/quiver/*`
- **Acceptance:** 1. Selected board as the subject on a dark stage (`ai-board-studio` as an AI-labelled studio backdrop/reference only; the user's board is still drawn from its real outline), giant length in `var(--display)` behind it. 2. Callouts on hairline leaders to the real spec values (length, width, thickness, volume, fins/tail when known), revealed on scroll; missing values say so. 3. Rack/thumbnail switching, Add board, View in 3D, scan and Board Match keep working (t023, t025 pass). 4. Motion rules as T-027. 5. tsc/test/build, journeys 8/8, 1440/390 before/after next to frame g345, 0 px overflow.
- **Status:** OPEN

## Function-first rule (user, 2026-10-30, overrides the cinematic briefs where they conflict)
User: "the websites look like they're injecting the Higgsfield to make everything look super cinematic … this still should have a priority of functionality and forecasting." Cinematic treatment is an accent, never the content. Applies to T-031, T-032 and every later screen:
1. **Answer first.** 390×844 Forecast first screen shows, without scrolling: spot name, rating, height with its honest label, wind (speed + shore relation), tide (height + trend) and the start of the day/hour selector. 1440×900 also shows the 7-day strip. Measured by script (bounding boxes inside the first viewport).
2. **Hero is a band, not a page:** ≤ 40svh at 390, ≤ 45vh at 1440 on Forecast; ≤ 55svh on Home, and the first saved/popular spot card starts inside the first 390 viewport.
3. **Data is never hidden behind motion.** All numbers render visible on load; scroll effects may only add emphasis (fade from 60% → 100%, small translate ≤ 12px, ≤ 300 ms). No full-screen chapters: the scroll-lit sentence becomes a one-paragraph summary under the hero; the "The week ahead." parallax band goes; charts and the week start within 1.5 screens at 390.
4. **AI imagery only as hero backdrop** (dimmed, caption kept). No AI image behind data (drop the aerial behind "Today at" and behind the summary). One video per page at most; poster-only on phones if it costs > 1 s of load.
5. **Quiver:** rack, selected board's spec and Board Match visible in the first screen; giant type stays a backdrop.
6. Existing checks plus a "first-viewport content" assertion per page; 1440/390 shots before/after.
- **Theme (user, 2026-10-30):** "a minimalist white would be miles better" than the dark blue. Default is now light (pure white `--bg`), dark only when chosen (commit after 25e5a0c). No section may force the dark palette (`.on-dark`, "dark film" chapters) in the light theme; the only dark area allowed is the photo band itself, under its text scrim.
- **Phone Forecast is one screen (user):** "you shouldn't have to scroll down to … 3D; it should basically all be one screen." The 390 first screen also carries the wave-scale entry (inline mini scale or a button), not only at the bottom.

## T-033: Replace the 3D wave with AI wave-scale imagery (user decision 2026-10-30)
- **User:** the 3D wave/surfer is "horrid … not realistic at all"; chose AI wave-scale clips (budget up to 500 credits). Assets: `public/media/ai/ai-scale-{1-2,2-3,3-4,4-6,6-8,8-10,10-15,15-plus}ft-{1600,900}.jpg` (+ loops for 2–3…6–8 ft when committed); log `public/media/PROMPTS.md`.
- **Owner:** `engineering` after T-031 · **Owned:** `src/features/scale/*`, MiniScale and its callers, manifest entries
- **Acceptance:** 1. Wave Scale and the Forecast wave card show the band image (loop where present) that contains the selected hour's height: the breaking estimate's range when presentable, else offshore Hs, and the label says which ("Est. 4–6 ft at the break" / "4.1 ft offshore, not surf size"); a range spanning two bands picks the band of its midpoint and says so. 2. Caption on every image: "Illustration · AI-generated, approximate scale, not current conditions". 3. The three.js wave is no longer the default view; remove it from the phone path (keep code only if another screen still needs it, say which). 4. The slider/steps still let the user browse all 8 bands. 5. On the phone Forecast the scale is reachable from the first screen (one-screen rule). 6. Unit tests for height→band mapping incl. edges (exactly 2, 3, 4, 6, 8, 10, 15 ft, nulls, demo face). 7. tsc/test/build, journeys (journey 7 "Wave Scale controls" updated if the UI legitimately moved), wave-spot updated, 1440/390 light shots.
- **Status:** OPEN (queued for engineering)

## T-032 addition: realistic board pictures
- Assets `ai-board-{shortboard,fish,midlength,longboard,stepup,softtop}-{1400,700}.jpg`, white seamless, upright. Map by board type (see PROMPTS.md); "Other" keeps the outline. Each is labelled "Illustration of a <type> · AI-generated, not your board"; the user's own board photo (scan) wins when it exists; the real outline and spec values stay the source of truth for callouts.

## Round 2026-10-31: phone density, board room, real 3D (user)
User: "lets make some major improvements; the Porsche configurator is for the board room; the 3D wave-to-surfer comparison — use Unreal Engine if you can." Also (2026-10-30): "many things are crowded and oversized on the phone"; the Home "Swello reads … honest" line is filler; Higgsfield should be used for marketing/ads, sparse in-app. References: `docs/design/REFERENCES-2026-10-31.md`.

## T-034: Phone density pass (all screens) + Home filler out
- **Owner:** `engineering` · **Owned:** `src/features/{home,forecast,scale,personal,explore}/*`; `src/ui/app.css` / `tokens.css` type scale only (agreed by lead)
- **Acceptance:** 1. Remove the Home scroll-lit "Swello reads swell, wind and tide …" sentence entirely (no replacement filler). 2. Type scale at ≤ 430 px per `REFERENCES-2026-10-31.md` §3: body 15–16, labels 12–13, section titles ≤ 22, page titles ≤ 30, the single hero number ≤ 56 (Home "Hello." included). 3. Gutters ≥ 16 px, ≥ 12 px between controls, one primary action per screen; no two-line chips/buttons at 390. 4. New `t034-density.mjs`: at 390 on Home, Forecast, Wave scale, Map, Personal, asserts max computed font-size per role, no text overflow/clipping, no element < 44 px tap height for controls, 0 px horizontal overflow. 5. Function-first assertions (t031-firstview) still pass. 6. tsc/test/build, journeys 8/8, before/after 390 shots of every screen.
- **Status:** OPEN

## T-035: Quiver board room, modelled on the Porsche configurator
- **Owner:** `product` · **Owned:** `src/features/quiver/*` (incl. `studio.ts`)
- **Acceptance:** 1. Board room view: one board large on a light set (white/very light grey floor + wall, soft contact shadow), real-time three.js from the board's real dimensions/outline, drag to orbit, inertia, reset. 2. Stage pill inside the stage: Angles · Compare · 360° · fullscreen; camera presets (deck, bottom, rail, tail, nose, ¾) as a thumbnail strip at 1440 and an "n / 6" counter + swipe at 390. 3. Hotspots on fins, tail, nose, rails open short real facts from the board record ("Twin · FCS II", "Swallow tail"); missing values say "Not recorded". 4. Option groups (Dimensions, Fins, Tail, Construction, Colour) as swatch rows on the right at 1440 / under the pinned stage at 390; changing colour/fins/tail updates the model live and saves to the board only on "Save". 5. Sticky phone bar: Board Match for today's selected spot + one action ("Use for today" or "Open Board Match"). 6. Compare: two boards side by side at true relative length. 7. Light theme first; dark works. 8. Phone density rule applies. 9. t023/t025/t032-first pass; new t035 script (orbit changes the camera, preset jumps, hotspot opens, option change updates the model, 0 overflow); 1440/390 next to the Porsche shots.
- **Status:** OPEN

## T-036: Wave scale in Blender, 360° renders (user decision 2026-10-31)
- **User:** asked for Unreal; chose Blender 360° renders after the trade-off (Unreal: not installed, ~100 GB, Epic account, 32 GB RAM recommended vs this Mac's 8 GB, cannot run in a browser anyway). Blender 5.2.3 LTS at /Applications/Blender.app, driven headless by script.
- **Owner:** lead (spike), then `engineering` wires it into Wave scale.
- **Plan:** 1. Scene per height band: surf-zone wave mesh (face height = band midpoint, true metres), water shader + foam, sky/sun, a to-scale surfer (1.75 m) on a board at the wave's shoulder. 2. Render ~24 orbit angles per band (Eevee, 1280×720 + 640×360), plus a still for phones. 3. App: drag/swipe to spin through the angles (Porsche "n / 24" pattern), band selector unchanged, caption "3D illustration · approximate scale, not current conditions". 4. Scripts and .blend in `tools/blender/` so renders are reproducible.
- **Status:** IN PROGRESS (lead spike)
- **T-034:** DONE (merged; lead checks all pass incl. t034-density 11 screens, journeys 8/8).

## T-037: Personal, Apple-Settings calm (last screen in the user's order)
- **Owner:** `engineering` · **Owned:** `src/features/personal/*`
- **Acceptance:** 1. No horizontally-scrolling section pills (390 shows "Board Pr…" cut off, blue selected pill off-theme): Personal becomes one grouped list like iOS Settings (Profile header → Favourite spots → Surf preferences → Units → Appearance → Data & privacy), each row opening its detail page with a back control; existing /personal/<section> URLs still resolve. 2. Light theme first, function-first (the profile summary and favourites in the first 390 screen), density rule. 3. Everything that works today keeps working (units, theme, favourites, preferences, export/import if present). 4. t034-density passes for Personal; journeys 8/8 (journey 6 "Personal units" updated only if the UI legitimately moved); 1440/390 before/after.
- **Status:** OPEN
- **T-037:** DONE (merged; routes.ts sections/labels accepted by lead; journeys 8/8 ×2).

## Round 2026-10-31 (afternoon): real data, spot-oriented forecasting, competitor teardown (user direction)
User: "we're using Higgsfield in the wrong way: all of the AI-created 'not current conditions' just takes you away from the fact it's literally an app to tell you the current conditions … fully reverse engineer references such as Surfline (and Magicseaweed if an example still exists) and Windy … take the best parts of their functionality … look much better than Surfline aesthetically, be more functional and offer new tools … forecasting way more accurate: real ocean and wind data compared to the exact spot and sand bars … the rating spot-oriented, not just swell … the 3D comparison and the quiver and waves based on your quiver and experience level are the differentiator and must be seamless and beautiful … I like the minimalistic vibe of those; our app still looks so AI." A video on common AI-website problems will follow.

Rules from now on:
1. **No AI imagery on condition surfaces** (Home, Forecast, Map). Real data visuals, real licensed spot photos with credit, or nothing. AI/3D illustration is allowed only inside the comparison tools (Wave scale 3D, board room), labelled.
2. Every feature borrowed from Surfline/MSW/Windy is listed with source, our improvement, and the data it needs (`docs/design/TEARDOWN-2026-10-31.md`).

## T-038: Remove AI imagery from condition surfaces
- **Owner:** `product` · **Owned:** `src/features/{home,forecast}/*`, `public/media/manifest.json` (AI entries stay in the manifest only for scale/board tools)
- **Acceptance:** Home and Forecast heroes use no `ai-*` asset: a real data visual (e.g. live swell/wind/tide state drawn from data) or a credited real photo of that spot; no "Illustration · AI-generated" caption appears on Home/Forecast/Map; function-first + density checks still pass; 1440/390 shots.
- **Status:** OPEN

## T-039: Teardown — Surfline, Magicseaweed (archived), Windy
- **Owners:** lead (Surfline + MSW via the user's Chrome, since Cloudflare blocks headless) · `product` (Windy via Playwright) · output `docs/design/TEARDOWN-2026-10-31.md` + screenshots in `~/Development/swello-design-references/18-teardown-2026-10-31/`
- **Acceptance:** per product: navigation, spot page anatomy, forecast table/graphs, rating model as presented, map layers and time scrubber, cams, alerts/favourites, premium-only features, mobile layout; for each feature: keep / improve / skip, and the data it needs. Third-party screenshots are reference only, never shipped.
- **Status:** OPEN

## T-040: Spot-oriented forecast model v2 (plan first, Level 3)
- **Owner:** `engineering` (plan) → lead review → user approval before code
- **Acceptance (plan doc `docs/forecast/RATING-V2-PLAN.md`):** data sources per input with licence and resolution (CDIP MOP nearshore per-spot points, NDBC/CDIP buoys, NOAA tides/CO-OPS, wind from HRRR/NAM via Open-Meteo or NOAA, bathymetry NOAA CUDEM/CRM, what exists for sandbars and its limits); per-spot profile schema (orientation, swell window, period response, tide window, wind tolerance, bathymetry type, reviewed sources); how the rating combines them; validation plan against observations; what stays labelled as unvalidated. No invented spot facts.
- **Status:** OPEN
- **T-038, T-039 (Windy), T-040 plan:** merged. T-035 Reset regression found by lead after merge → product.
- **User decisions on RATING-V2-PLAN (2026-11-01):** D-1 Open-Meteo free tier for now, NOAA-direct or paid plan before any commercial launch; D-2 engineering drafts spot facts from published sources with citations, **user reviews**; unreviewed values stay null; D-3 in-app session log approved as ground truth (no scraping); D-4 Phase 1 as planned.

## T-041: Rating v2 Phase 1 (per RATING-V2-PLAN.md §Phases "this week")
- **Owner:** `engineering` (UI slices on Forecast coordinated with product: engineering owns `src/ocean/*`, `src/services/*`, new data files; the Forecast nearshore card markup goes through product or a lead-agreed file)
- **Acceptance:** MOP point registry + ingestion with forecast archiving; nearshore card on Forecast showing real MOP data with source/time; breaking estimate v2 behind a flag; Pillar Point / Point Reyes tide stations; spot profile schema + registry with `{value,status,sources,reviewedBy}` and a review list for the user; session log (range, quality 1–5, optional bar note) stored locally; no rating changes, no new accuracy claims. Tests per module; journeys; 1440/390.
- **Status:** OPEN
- **T-041 Phase 1:** DONE (merged; 259 tests, journeys 8/8, t041 scripts pass). Open for the user: `docs/forecast/SPOT-FACTS-REVIEW.md`.

## Round 2026-11-02: Map and Wave scale (user: "no improvement … what happened to reverse engineering … make the map less crowded, Apple's key design ideas, Surfline's minimalism, Windy's map; when zooming in the background goes black, no longer showing the colours")
Lead observations at 1440/390 (light theme): Map is still the dark navy explorer (#0a1c29 ground, navy side panel with photo list, toggle box, legend, timeline, a label on every pin); zooming past z≈12 shows no imagery and no data colour (satellite runs out, field not drawn), only dark ground + particles. Wave scale = AI photo + blob chart; the Blender 3D is not in the app.

## T-042: Map field and basemap at every zoom (engineering)
- **Owned:** `src/map/*` (field.ts, SpatialLayer.ts, colors.ts), basemap setup lines in ExploreView agreed with product
- **Acceptance:** 1. The data colour field is drawn at every zoom 2–14: bilinear-sampled from the model grid (not hidden past its native resolution), clipped to water by the coastline, never a flat dark fill. 2. Basemap: a light, minimal style (Apple Maps / Surfline: pale land, soft water, labels quiet) that keeps working at high zoom (`maxNativeZoom` so tiles upscale instead of going blank); satellite stays an option. 3. No dark ground anywhere in light theme. 4. Script zooms 2→14 in 1-step increments at Ocean Beach and asserts the field and the basemap are both visible at every step (pixel sampling over water and over land), 0 console errors; shots per zoom.
- **Status:** OPEN

## T-043: Map, minimal (product) — Apple Maps + Surfline + Windy patterns from the teardown
- **Owned:** `src/features/explore/*`
- **Acceptance:** 1. Map-first: full-bleed map, one floating search; no permanent side panel at 1440 (a slim sheet that opens on demand, Apple-Maps style); at 390 a bottom sheet with three detents (peek: nearest/selected spot only; half; full list). 2. Labels collide-aware and sparse: show labels for the selected spot and the top-rated few at the current zoom, dots for the rest (Surfline map). 3. One compact layer control (single button → popover), one legend chip with units, one time scrubber (Windy) that hides to a thin bar until touched. 4. Tap a spot → small Apple-style callout card (name, rating, labelled height, wind relation, "Open forecast"), not the full panel. 5. Light theme native: white UI chrome over the map, no navy panels. 6. Function preserved: search, layers, time, Find Spots, Open forecast; journeys and t013 overlap pass. 7. Density rule; 1440/390 next to Surfline/Windy teardown shots; count of on-screen UI elements before/after reported.
- **Status:** OPEN

## T-036 (lead): 3D wave scale into the app — continue; next: foam/spray, surfer on board, 8 bands × 24 angles, then hand to engineering to wire the spin viewer in place of the AI photo + blob chart.

## Round 2026-11-02 (evening): "genuinely better than Surfline" (user: "this still just straight butt")
Lead diagnosis (Forecast 1440 full page 3,690 px, Home): 1. the headline answer is a disclaimer (offshore Hs "not surf size") while Surfline leads with a surf range + body words; 2. the same four facts appear four times (hero, readout row, "Today at" dial, charts); 3. oversized decorative type (80 px spot name, giant grey height, giant grey "Today at…", giant "Hello.") + wide Syne = the "AI website" look; 4. Home has no information.
**User decisions:** headline = estimated surf range (MOP-based v2 where a reviewed point exists, labelled "model estimate", offshore underneath; fallback offshore with its label). Font = Inter only (lead switched `--display` to Inter).

## T-045: Spot page v3, Surfline anatomy done better (product)
- **Owned:** `src/features/forecast/*` (engineering provides the estimate selector, see T-046)
- **Structure (top to bottom, each fact once):** 1. compact header row: spot name (≤ 28 px), region, favourite, spot switcher. 2. **Conditions grid** like Surfline's card grid: SURF (est. range, body words, "model estimate" tag, offshore Hs under it), RATING (word + 5-segment bar + one-line *why*: window/period/wind/tide ticks), WIND (speed, gust, direction, onshore/offshore coloured), SWELL (2–3 partitions: height, period, direction arrow), TIDE (now + trend + mini curve with next extremes), WATER (temp + wetsuit). 3. Board Match line from the user's quiver (our version of Surfline's "Ride an all-rounder"). 4. 7-day strip with AM/mid/PM rating segments + wind arrows (Surfline) and best-window star. 5. Graph/Table toggle: graphs (surf, wind, tide with light times) and a Magicseaweed-style 3-hour table with wind cells coloured by shore relation. 6. Nearshore model + nearby buoys ("now vs forecast"). 7. Sources. Remove: the dark hero band, giant height backdrop, "Today at" dial section, duplicate readout row. Keep the drawn sea state only as a small optional strip (or drop it). 
- **Type:** Inter only; page title ≤ 28, card values 22–28, labels 12–13. No decorative giant type anywhere.
- **Acceptance:** each of the six facts appears in exactly one place above the fold (script asserts no duplicate value blocks); 1440 page height ≤ 2,200 px; 390 first screen = header + SURF + RATING + WIND + TIDE; density, firstview (updated), journeys, t041/t038 pass; 1440/390 side-by-side with `18-teardown-2026-10-31/surfline/04-current-conditions.jpg` and `06/07`.
- **Status:** OPEN

## T-046: Headline surf estimate + body words (engineering)
- **Owned:** `src/ocean/*`, `src/services/*`, tests
- **Acceptance:** a pure selector `headlineSurf(spot, hour)` → `{kind:'estimate', lo, hi, words:'waist to chest', method:'mop-v2'|'v1', label}` or `{kind:'offshore', ft, label:'offshore · not surf size'}`; v2 on by default only where a reviewed MOP point exists (Ocean Beach today), v1 elsewhere if presentable, else offshore; body-word table (ankle/knee/thigh/waist/chest/shoulder/head/overhead/double overhead) by face height, sourced to a common convention and labelled approximate; never feeds the rating; unit tests incl. edges and nulls. Hand the API to product.
- **Status:** OPEN

## T-047: Home = your spots dashboard (engineering, after T-046)
- **Owned:** `src/features/home/*`
- **Acceptance:** no hero, no "Hello."; top: saved spots (or labelled "Popular spots") as a dense list/grid of cards: name, est. surf range + body words, rating bar, wind relation, tide trend, best window today; tap → spot page. Then "Best right now nearby" (ranked by rating, honest). Inter, compact; Home ≤ 2 viewports at 1440. Journeys/density pass; 1440/390 shots.
- **Status:** OPEN

## Overnight queue 2026-11-02 (user asleep; one task each, then stop; no pushes/deploys/installs/paid calls; commit locally only)
### T-048 (product): Wave scale back on the spot page + phone polish
- Owned: `src/features/forecast/*`, `src/features/scale/*` (read-only use of engineering's Spin360)
- 1. A compact "Wave scale" panel next to/below SURF: a to-scale silhouette of the user's height (Personal profile, default 5'10") beside the selected hour's face estimate range (labelled), plus the user's best quiver board length; tap → full Wave scale. No AI imagery. 2. Phone: the spot name appears once (hide the shell switcher's label on the spot page or drop the h1 duplicate — keep one). 3. Remove dead code: unused Cinematic.tsx exports and old `.fc-`/`.cine-` CSS. 4. t045-spot, firstview, density, journeys pass; 1440/390 shots. Then STOP.
### T-049 (engineering): Rating sanity + more buoys
- Owned: `src/ratings/*`, `src/ocean/*`, `src/services/*`, tests
- 1. Rating "why" ticks must not show ✓ Wind when the wind is onshore above a light threshold (state the threshold and source; light onshore ≤ ~5 mph may be "~"). Fix in the factor, not the label; unit tests. No other rating weight changes. 2. Add NDBC 46012 (Half Moon Bay), 46214 (Point Reyes) and CDIP 029 to the "now vs forecast" buoy context with their own timestamps; labelled context, not validation. 3. tsc/tests/build/journeys pass. Then STOP.
### T-036 (lead): render the 4–6 ft band (24 angles) to a review folder; do NOT drop into public/ until the user approves the look.

### Overnight addendum (user, 2026-11-02 late): "make actual improvements, the Quiver could use serious work; I liked having photography or at least design — now it looks like plain information; make it aesthetically pleasing, don't make stuff up; do what you see fit without asking." Workers continue to the next task after each handoff (replaces "then STOP").
Design direction for all three: Surfline's calm data layout **plus** real atmosphere — credited real CC photos of the actual spots (already in the manifest, never AI on condition surfaces), refined type hierarchy (Inter, weights/sizes, tabular numbers), a restrained colour system (one accent, condition colours, soft neutrals), generous but tight spacing, subtle motion (≤ 300 ms), light theme first. Reference the Porsche configurator (light, premium), Apple Weather (data as beautiful visuals), Surfline (density).

### T-050 (product, after T-048): Spot page + Quiver, beautiful
- Spot page: a real credited photo of the spot as a slim header band (≤ 220 px at 1440, ≤ 160 at 390, cover crop, credit visible) with name/region over a soft scrim; no photo → a drawn coastline/plan of the spot from our geometry, not a placeholder. Cards get a refined visual language (consistent icon set, mini visuals: wind compass dial, tide curve, swell arrows sized by energy). Keep every fact once, function-first, density.
- Quiver: make it the best screen in the app. Board room on a beautiful light set (soft floor gradient, contact shadow, studio light), larger board, elegant spec typography, the rack as a premium wall (consistent spacing, labels, length scale), quiver-to-conditions: each board shows today's match at the user's saved/selected spot. No AI board pretending to be the user's.
- t045/t035/t025/t023/density/journeys pass; 1440/390 before/after.

### T-051 (engineering, after T-049): Home + Map, beautiful
- Home cards: credited real spot photo (thumbnail or card top) when the spot has one; clean fallback otherwise; refined hierarchy (big est. range, small labels), condition colour accents; "Best right now nearby" as an elegant ranked list with mini rating bars. Nothing invented.
- Map: a spot callout with the real photo thumbnail + credit; legend and pills polished to the same visual language.
- t047/t043/t042/density/journeys pass; 1440/390 before/after.
- **T-049, T-051, T-048:** merged overnight; lead checks all pass (299 tests, journeys 8/8, density, t045/t047/t051/t043/t038/t022/wave-spot). Callout conflict resolved (headlineSurf + photo thumb).

### T-052 (engineering, overnight): Your height + an interactive Wave scale page
- Owned: `src/features/scale/*`, `src/features/personal/*`, `src/services/*`
- 1. Personal → Surf preferences: "Your height" (ft/in or cm by unit pref), saved; the spot-page scale panel and the Wave scale page use it (drop "(default)" once set). 2. Full Wave scale page rebuilt around the drawn, to-scale comparison (same visual language as product's ScalePanel): big SVG wave at the hour's face range (low/high), you at your height, your chosen board from your quiver (picker), body-word ticks; an hour scrubber across the day that animates the wave; a band browser (1–2 … 15+) to compare. 3. The AI photo becomes a secondary "Example photo (AI illustration)" toggle, never the default; Spin360 stays for when 3D frames exist. 4. Tests for height conversion and scale maths; t033/t044/wave-spot/density/journeys pass; 1440/390 shots. Then STOP.
- **Overnight result (lead, 2026-11-02/03):** merged T-048…T-053; final lead checks all pass (305 tests, journeys 8/8, t045/t047/t050/t051/t052/t053/t025/t035/t023/t043/t038/t022/wave-spot, density). Visible open issue: on the Quiver wall the white "Everyday driver" shortboard cutout loses its left half (white board on near-white wall eaten by the white-to-alpha step) → next product task. Also open for the user: SPOT-FACTS-REVIEW.md, 3D frames in ~/Downloads/swello-3d-review-4-6ft/, height in Personal.

## Round 2026-11-02 (day): team back on; fix discrepancies, Quiver, 3D scale, forecasting, less "AI" (user: "make it look less like AI … more seamless and cool; I'll be here to permit you")
Lead audit (artifacts/audit-1102, 1440/390, 0 overflow, 0 page errors) found:
- D1 **Same number, different values:** Forecast strip chip "Est. 4–9 ft", SURF card "5–11 ft", Mon day card "5–12 ft" for the same spot and hour; Home wind "2.1 mph E offshore" vs Forecast "1.8 mph NW cross-shore".
- D2 Home loading state reads as real data: "No rating / none / No forecast data / No good daylight window left", photos dark.
- D3 Every spot on the map is "Solid"; Ocean Beach 5–11 ft cross-shore = Solid. The rating is not believable.
- D4 Map: two search boxes; "Loading model…" pill stays; phone attribution wraps.
- D5 Forecast 390: SURF title truncated to "S.."; Wave scale card half empty; spot name missing from the photo band.
- D6 Quiver: white shortboard cutout loses half; "Illustration of a fish · AI-generated" label stuck top-left for every board; ruler "4'" under the prev arrow; boards don't stand on 0'; longboard stringer heavy; big empty wall; second giant greyed title below.
- D7 Wave scale is still the 2D drawing; the Blender v2 renders are landing (T-054).
- D8 "AI look": icon + UPPERCASE label + pill on every card, boxes everywhere, many "model estimate" pills, blue link arrows.

### T-054 (lead): 3D wave scale v2 in the app
- Blender v2 (`tools/blender/wave_scene.py`, `render_all.sh`): peeling wave from the licensed cross-sections, true face height, Cycles, surfer in a bottom turn, 24-angle orbit, 8 bands → `public/media/scale3d/<band>/`. Then Spin360 is the default view on the Wave scale page and the spot-page scale card (drawn chart as secondary); labelled "3D illustration · approximate scale".

### T-055 (engineering): One source of truth for every forecast number
- Owned: `src/services/*`, `src/ocean/*`, `src/ratings/*`, Home data, tests.
- Every surface (strip chip, SURF card, day cards, Home card, map callout, scale) gets surf range, wind, tide and rating for a spot/hour from one selector (`headlineSurf` + one wind/tide/rating accessor) and the same hour rule. Day cards = range over that day's daylight hours from the same engine, labelled. Unit tests asserting strip == card == Home for the same spot/hour.
- Home/Map loading: skeletons, never "No forecast data / No good daylight window" until data has actually failed.
- Rating calibration (D3): per RATING-V2-PLAN Phase 1 + backtest. Cross-shore > ~8 mph and "wind unknown" cannot reach the top categories; wide estimate ranges cap confidence. Distribution check over all spots × 72 h: no more than ~25% of spot-hours in the top two categories (state the result). Explain changes in `explainRating`.
- tsc/tests/build/journeys/t047/t045/t043 pass; before/after rating distribution in the handoff.

### T-056 (product): Quiver, properly (D6) + less "AI" (D8) on Forecast/Home
- Owned: `src/features/quiver/*`, `src/features/forecast/*`, `src/features/home/*`, `src/ui/*` CSS.
- Quiver: fix the white shortboard cutout (keep the board's own outline: edge-aware alpha or a drawn outline fallback); all boards stand on 0' at true scale; caption only on the selected board; ruler clear of arrows; balanced wall (boards centred as a group, no dead half); remove the duplicate giant title; premium light set. Board room: board large, spec typography, today's fit.
- De-AI pass (D8): drop the icon + UPPERCASE label pattern for quiet sentence-case labels; one "model estimate" note per page instead of a pill per card; fewer boxed cards (Surfline/Apple Weather: hairlines, grouped rows); text links without arrows; consistent 8-pt spacing. Fix D5 (no truncated titles at 390; name in the photo band).
- Map D4: one search; the loading pill clears; attribution one line on phones.
- t053/t025/t035/t045/t047/t043/density/journeys pass; 1440/390 before/after.

### T-057 (engineering): day cards show a representative range (best/median daylight hour via spotHour), envelope in detail.
### T-058 (product): longboard stringer, map phone pills, Home nearby list row width.
- **T-055/T-056 merged (lead):** 316 tests, journeys 8/8, t053/t025/t035/t045/t047/t043/t055/t054 0 fails, density pass; 3D caption unit fix (spinCaption).
- **T-057/T-058 merged (lead, a4b65e3):** 318 tests, journeys 8/8, t053/t025/t047/t043/t045/t055 0 fails, density pass. Open for the user: day-card typical ranges stay wide (unvalidated 0.7–1.4 face factor) — narrowing needs observations or a user decision.

## User decision 2026-11-02: narrow ranges by calibrating with real observations (not by display tricks)
### T-059 (engineering): observation model on the session log, pairing with spotHour estimates, per-spot robust ratio fit (n ≥ 8), calibrated central + IQR range (≥ ±15%), API for product.
### T-060 (product): 2-tap "What did you see?" on the spot page, observed line + calibration counter, journal list with delete.
- **T-059/T-060 merged (lead, 5491499):** 327 tests, journeys 8/8, t060 0, t059 ALL PASS (test now compares the estimate, not the new observation line), t054 0 (caption regex for ft), t045/t047/t055 0, density pass. Next small: retire the older "Check the forecast" fieldset in Log a session (duplicate path) in favour of the 2-tap report.

## Round 2026-11-02 (evening): forecast trust (spec docs/specs/2026-11-02-forecast-trust.md, APPROVED "yes to all")
Branch `forecast-trust` (from rebuild/swello-v0.16 fddee20). Codex reviews each merge (tools/review/codex-review.sh).
### T-064 (engineering): callFor (Go/Worth a look/Skip/Dark + window + skill-aware why), night-aware rating, surf-band graph series, forecast archive + felt-right signal, NWS alerts service.
### T-065 (product): spot page restructure (the Call, one big number, surf graph, Sources & data collapsed, daylight + night shading), Home calls + comparable numbers, felt-right UI, Board Match on size+period, photo pass, NWS banner.
### wave-v3 (lead): continues on branch wave-v3.

## T-100 (backlog, engineering): Codex P2s from the morning drain (2026-11-03 06:33)
None block use; each is a small correctness gap. Reviews in `docs/reviews/2026-11-03-<sha>.md`.
- a2848f9 `BoardOutline.tsx:19,21`: recorded fins should beat saved cosmetic fins; deck colour should match the showroom's calculation.
- b7dba5e `mopIssue.ts:17`: refresh cached issue metadata when the forecast refreshes.
- 7b9c345 `App.tsx:14-18`: a failed lazy-area import should be retryable (not cached as rejected).
- 047178d `Compare.tsx:25-28`: retry Compare initialisation after forecasts load; `homeDash.ts:103-105`: search today's remaining daylight before moving to tomorrow.
- 595769a `field.ts:119-120`: keep coverage labels off land pixels; `enclosed.ts:9-11`: normalise longitude before the bay-mask lookup.
- 26c1512 `call.ts:34`: tell "too much swell" apart from "too little swell" in the reason.
- T-100 merged f45e916 (engineering 38beca4): 7 of 9 Codex P2s fixed; 1-2 were already fixed by T-098. tsc clean, tests 0 fail, build OK, journeys 8/8, t067 and t052 pass (t052 needed a warm server; cold load under heavy CPU took 8.5 s), Bay label on water at 1440. Guard strict mode now checks tags as well (19 cases).

## T-101/T-102 (wave ride, spec docs/specs/2026-11-03-wave-surfer-follow-up.md, APPROVED): A Fable wave-ride (render polish + riding surfer); B product t101-no-ai-photo; C engineering t102-ride-qa
- T-101 merged af36bcb (product e24b920): AI wave photo removed everywhere. tsc clean, 461 tests, build OK, journeys 8/8, t052 pass (one flaky step, '1440 an impossible height is refused', failed once and passed on rerun: engineering to stabilise). Checked in Chrome: no photo or button, 3D label intact. Open: selectScaleBand notes still say 'illustration' (only tests call it).
- T-103 merged 40473e2 (engineering 79cf931): height field kept its typed text after a save (HeightField was declared inside PersonalView and remounted). tsc, 461 tests, build, journeys 8/8, t103 race 0/20, t052 pass.
- wave-ride merged 9682084 (Fable dc594a4, 9517531, 081716f; user approved 'yes merge') + dbbbb74 (Codex P1: Board is a Group in surfer-v3, so lookups use the union of child meshes; the default-board flow crashed to the fallback). tsc, 461 tests, build, journeys 8/8, t052, t104 default-board PASS, t102 ride checks PASS (contact gate widened to -0.05..0.20 m by lead decision; rails ≤ 15 cm). Real GPU (Chrome, 5180): 60.0 fps, 1% low 56.5. Open (next round): stiff body, top turn is a modest turn (atlas face near-vertical), board a bit thick, upper face lacks texture at default distance.

## T-106/T-107 (Home round, spec docs/specs/2026-11-03-home-round.md): product t106-home-waves (WaveGlyph, cam-ready hero MediaSlot, card density, 390 photos); engineering t107-week-honest (week typical range, nearby 'stale' label). T-105 toolkit motion checks done (engineering).
- T-107 merged 5fc6db9 (engineering caceb65) + lead fix (data-honesty P1s: 'at midday' note, curve from midday sizes, stale mark). 465 tests, journeys 8/8, t067 pass.
- T-106 merged df7d103 (product 2418256): Home waves drawn to scale beside you (hero, cards, week cells), cam-ready hero (own cams first), six-item cards, no photos on Home. 469 tests, build, journeys 8/8, t067/t074 pass, Home +605 B gzip. Lead looked at 1440 and 390. Open: dawn/dusk/night hero tints not captured.
- T-108 merged c3b7e2f (engineering): offshore-only labels, graph, rating factor named 'Offshore swell energy' (kept in the score: a rating-model change is out of scope), map legend 390, est. surf height, Compare surf estimate, one best window, recommended board on the scale card, profile range in the call, surf height scale setting. 471 tests, build, journeys 8/8, t043 pass. t062-live: 4 failures (vertical drag near the polar clamp; flip expectation) predate T-108, caused by the wave-ride camera; sent to Fable round 3.
- T-110 merged ce4aeec (engineering): Compare 'est.' labels (Hawaiian, saved/stale), Home hero caption freshness, Codex queue drained (9682084 P1 already fixed by dbbbb74). 474 tests, build, journeys 8/8, t074 pass.
- T-109 merged a58c6c7 (product 2b5a802; Compare conflict resolved: T-109 layout + T-110 est. cell). 474 tests, build, journeys 8/8, t034 ALL PASS (now run with the tag first and the URL second), t043-map pass. Lead looked at Compare 1440/390 and the OB graph. t023 has 12 old failures (same on :5180 before), open.
- Wave round 3 merged 1406813 (Fable 5f7140d): smooth precomputed ride line, board heading and lean from the path, body springs, tail spray, gentle follow camera, a flat thin 6'0" board (it was rendered vertical), rideable shoulder (atlas rebuilt locally with tools/blender/build_atlas.sh). 474 tests, build, journeys 8/8, t104 pass; t102 contact/rail/ahead/heading/frac/screen pass. Stale gates: t102 'no along-crest reversal' (use v_water_mps > 0), t062 flip (compare signs). Real-GPU fps 60.0 average, 1% low 53.5 under machine load 17–27 (Fable 59.5 idle): re-measure when idle. Open: the top-turn body reads as a layback; upper-face texture; the trough streak.
- T-111 merged 042a5af (product 96f4ac8): spot hero media slot (own cam → photo → drawn wave → coast plan), cams row as labelled links (5 spots have verified cams; OB none). 475 tests, build, journeys 8/8, t063/t034 pass.
- T-112 merged e683649 (engineering a353166): dead-end sweep (23 routes × 2 widths + clicks on 18 pages; no dead ends), one dayText for week cells and day cards (units, Hawaiian), Find Spots shows the surf estimate. 476 tests, build OK. T-113 (toolkit): t102 v_water gate, t062 flip invariant, both pass. Journeys fail only on Open-Meteo 429 (rate limit from the sweep's ~3000 reloads; one direct browser call to marine-api; the page still shows full data): rerun after the reset (midnight UTC).
- T-114 merged 0a06380 (engineering): model spread through the proxy (saved copy on a 429), no direct browser calls to Open-Meteo; lead set the spread TTL to 90 min. 478 tests, build OK. NWS alerts are still called directly from the browser (separate provider).
- T-115 + round 2 merged 15768fb/9247df3 (engineering): Windy colours (user decision), opaque field, grey land basemap, no grey while zooming (t115-zoom 0.0–0.1%), phone-safe canvas. T-116 merged 3cc8ec3 (product): Windy-like chrome, phone peek. 483 tests; t043 pass; lead compared with live Windy side by side. Next: T-117 Windy rebuild (spec §5).
- T-117 engineering part merged 6dd63dd: point API, Windy wind ramp, per-layer legends, dashes and streamlines, dark basemap. 488 tests. Period ramp is a labelled fallback (Windy's period layer couldn't be captured: the URL falls back to wind).
- T-117 merged (engineering 6dd63dd + 37d5075 fix, product cb4ac34): the Windy rebuild of the map. Round layer list, day strip + hour bubble, real source chip, point pin label (field value = painted colour) + hourly panel, search + locate, Windy phone layout, wave dashes and wind streamlines, dark basemap. 488 tests, t043 pass; the lead checked the side-by-sides vs live Windy at 1440 and 390. Journeys still waiting on the Open-Meteo quota. Period ramp is a labelled fallback.
- 3D brief stages 1-4 merged d3df218 (Fable): glitch causes measured and fixed, 120 Hz sim, wave-relative line per skill, board on the face, procedural body (stance, frontside/backside), glitch monitor, scale pole, dev params, surfSceneConfig. 492 tests, build, journeys 8/8, t104, t062 pass. Live OB at Intermediate on a real GPU: 0 glitches over 1447 frames, 144 fps, worst frame 15.6 ms. Open: Expert heading at 12/20 ft, Expert rail burial on concave faces, 2 ft Expert pose; next brief stages 5-10.
