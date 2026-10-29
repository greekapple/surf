# Task board
States: BACKLOG → READY → IN PROGRESS → REVIEW → VERIFIED → COMPLETE · BLOCKED

| ID | Objective | Owner | Status | Next handoff |
|---|---|---|---|---|
| T-001 | Home week matrix fits a phone without sideways scrolling | frontend-engineer | COMPLETE | — |
| T-002 | Playwright journey suite (Home → Forecast → Explore → Quiver → Personal → Wave Scale) | qa-tester | COMPLETE | — |
| T-003 | Reference-driven visual rebuild (Phase B) | lead | BLOCKED: approved concept images not found | user |
| T-004 | Forecast spot profiles and source audit (OB, Bolinas, Linda Mar) | architect | COMPLETE: `docs/forecast/T-004-source-audit.md` | lead |
| T-007 | Audit plan steps 2–4: `WaveReading` contract, fix D2/D3, show CDIP SF023 at Ocean Beach | frontend-engineer | COMPLETE | — |
| T-008 | Audit plan steps 1, 5, 6: approach, measured beach normals, validation data | user | BLOCKED: needs user decisions and data | lead |
| T-006 | Week section at 820 px tablet width is sparse (QA D2) | frontend-engineer | COMPLETE (with T-005) | — |
| T-010 | Primary nav overflows horizontally at 861–1040 px on every route (QA T-005) | frontend-engineer | COMPLETE (with T-005) | — |
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
