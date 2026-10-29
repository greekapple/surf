# T-005 / T-006 frontend handoff

## Files changed
- `src/ui/tokens.css`: light palette is the default on `:root` (and `:where(.coast)` so Home stays light under dark); dark palette under `:root[data-theme="dark"], .on-dark`. New chart/surface tokens (`--ch-*`, `--glass`, `--tip-bg`, `--nav-bg`, `--stage-*`, `--map-ground`, `--board-*`, `--wind-darken`, `--good-ink/--fair-ink`, `--none`).
- `src/ui/app.css`: nav overrides removed (nav follows tokens), all hard-coded colours to tokens, `.photo` forces white text on its scrim.
- `src/features/home/home.css`: comment + T-006 (`@media (min-width:601px) and (max-width:860px)` gives `.week tbody tr` 3 columns; 2 below 600).
- `src/app/App.tsx` (calls `useThemeSync`), `src/features/personal/PersonalView.tsx` (Appearance System/Light/Dark `.seg` radiogroup).
- `src/features/forecast/charts.tsx`, `ForecastView.tsx`, `scale/ScaleView.tsx`, `scale/MiniScale.tsx`, `quiver/QuiverView.tsx`, `explore/ExploreView.tsx`: colours to `var(--x)`.
- `index.html`: inline pre-paint script sets `data-theme`; meta theme-color updated.
- OUTSIDE the owned list (flag for lead): NEW `src/ui/theme.ts` (pref store, localStorage `swello-theme` in try/catch, resolve/apply, matchMedia listener); `src/features/forecast/model.ts` one line: `BAND_COLOR` now returns `var(--good|--fair|--poor|--none)` (used by Nav, charts, Explore pins). `src/utils/storage.ts` untouched.

## Approach
Tokens first. `data-theme` is always the resolved value (light/dark); System follows `prefers-color-scheme` live. Charts reference CSS variables, so theme switches need no re-render. Wind arrows/legend use `windInk()` (charts.tsx): the pastel ramp mixed toward black by `--wind-darken` (38% light, 0% dark).
Documented constants: the Three.js scene (scene.ts, not owned) stays dark in both themes, so `.stage3d` has `.on-dark` and its overlays use fixed dark glass; Leaflet tiles and the Explore Hs/wind grid overlay colours are unchanged; Home is light in both themes (Home TONE constants unchanged); photo scrims are dark in both.

## Contrast choices (on white unless noted)
muted #4b5961 7.1:1; dim #5a6770 5.8:1 (4.8 on fog); Hs line #1b6ca8 5.6; primary swell #0e2a47 14; secondary #5b6fb8 4.7; tide #4f6b80 5.6; good mark #1f8a52 4.3 (text variant #17703f 5.9); fair mark #b08a12 3.2 (text #7d5f00 6.3); poor #7d8a92 3.5; accent #c2410c 5.2. Ratios computed by hand from the hex values, not with a tool.

## Results
- tsc --noEmit: clean. npm test: 130/130. npm run build: OK.
- swello-qa.mjs: 72/72, exit 0. home-shots.mjs: 13/13. Console: only known NDBC/ERDDAP CORS errors.
- Theme script (`swello/t005-theme.mjs`): initial light; Dark persists across reload; System follows emulated colour scheme both ways; resolved attr correct.
- T-006: grid columns at 820px = 3, at 500px = 2 (screenshot `swello/artifacts/T-005/week-820.png`).
- Screenshots (playwright-toolkit/swello/artifacts/T-005/): `r1/` and `r2/` (/forecast, /forecast/wave-scale, /explore, /quiver/showroom, /personal/preferences, / at 1440 and 390, light and dark; names `<route>-<theme>-<d|m>.png`), `home/`.

## Review rounds
Round 1 (viewed forecast light/dark, wave-scale, explore, quiver, preferences): Forecast photo header title rendered ink-dark on the photo scrim under the light tokens (fixed: `.photo { color: #fff }`). Nothing else wrong in light; dark matched prior look.
Round 2 (re-shot all, viewed forecast mobile, wave-scale mobile, quiver dark mobile, explore dark, Home dark): no new theme defects. Found `/forecast` at 390 has `documentElement.scrollWidth` 476 in BOTH themes (SVG timeline); not caused by colour changes but I did not verify against the pre-change baseline, and swello-qa still passes.

## Remaining weaknesses / unverified
- I did not look at every one of the 48 screenshots; Preferences/Explore/Quiver mobile light were only spot-checked. The hero title fix was not re-viewed visually (rule applied, round 2 forecast-light-d not opened).
- Contrast values are hand-calculated; no automated axe run.
- 3D viewer is dark in light theme by design (scene.ts not owned); a light scene would need scene.ts changes.
- Wave Scale comparison SVG at 390 has very small labels (pre-existing).
- Possible /forecast 390 horizontal overflow above.

## Correction cycle 1 + T-009 + T-010
### Files changed
- `src/features/forecast/ForecastView.tsx`: swell legend now "Solid: primary · lighter: secondary · ring = period (s) · size = height" (true in both themes; timeline legend swatches already use tokens); 3 `table.cmp` wrapped in `.tscroll`.
- `src/features/personal/PersonalView.tsx`: Appearance radiogroup has `aria-label="Appearance"`, roving tabindex, Arrow keys (wrap) and Home/End move and select, focus follows; Saved spots table wrapped in `.tscroll`.
- `src/features/quiver/QuiverView.tsx`: comparison table wrapped in `.tscroll`.
- `src/features/explore/ExploreView.tsx`: wind arrow uses `windInk` (was 2.56:1); time slider `minWidth:0` (found 16 px overflow at 360 px).
- `src/features/forecast/charts.tsx`: `windInk` falls back to the plain ramp colour when `CSS.supports('color','color-mix(...)')` is false.
- `src/ui/theme.ts`: keep-in-sync comments; `storage` listener (added with the first subscriber, removed with the last) refreshes cache, re-applies theme, notifies. `index.html`: keep-in-sync comment.
- `src/ui/tokens.css`: new `--accent-ink` (#9a3412) and `--bad-ink` (#a52f23) for chip text (dark: same as accent/bad); dark `--dim` #5b6a75 -> #8494a0 (about 5.5:1 on #0c141b). Rating colours untouched.
- `src/ui/app.css`: `.chip.on/.ill` use the ink tokens; `.tscroll` (overflow-x:auto, edge shadows as scroll affordance, focusable region with the global focus ring); T-010 rules inside `@media (max-width:1100px)`: nav gap 12, status badge icon-only (label visually hidden, still read by screen readers), spot region text hidden, nav-end gap 8.
### Cause of T-009
Not the SVG: `table.cmp` (447 px min content on Forecast tables, 393 px on Saved spots) forced the page wide. Tables now scroll inside `.tscroll` (role=region, tabindex 0, aria-label "... (scrolls sideways)"). Timeline SVG was fine and stays interactive.
### Results
- tsc clean; npm test 130/130; build OK; `swello-qa.mjs` 72/72 exit 0 (the 4 overflow checks only appear on failure); `home-shots.mjs t005c` 13/13.
- `swello/t005c.mjs`: 20 routes x widths 360, 390, 861, 900, 1024, 1040, 1440: 0 overflow (scrollWidth vs configured width). Earlier run found Explore +16 at 360 (fixed) and one transient "/" +101 at 1040 that did not reproduce on direct load or in the re-run.
- `swello/t005c-kb.mjs`: Appearance arrows/Home/End select and move focus, only the checked radio has tabindex 0, name "Appearance"; changing the theme in a second tab updates the first.
- Screenshots (playwright-toolkit/swello/artifacts/T-005c/): `_forecast|_personal|_personal_preferences|_-<light|dark>-<360|390|900|1024>.png`, `personal-spots-390.png`, `compare-390.png`; I looked at forecast light 390, personal dark 390, Home light 900, forecast dark 1024, personal spots 390, compare 390.
### Remaining
- Contrast ratios by hand calculation, not re-measured with `t005-qa-contrast.mjs`. The wind-arrow darkening is skipped on browsers without color-mix (lower contrast there).
- At 861-1100 px the status badge is icon-only for sighted users (label only for AT; `title` exists only on the live badge).
- Wide tables rely on edge shadows plus keyboard-focusable region; no explicit "scroll" text hint.
- Not viewed: dark /forecast at 390, compare table scrolled, Explore at 360.
