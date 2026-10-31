# T-034 Engineering handoff: phone density pass + Home filler out

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Touched: `src/features/{home,forecast,scale,personal,explore}/*`, the type scale in `src/ui/app.css` (one `@media (max-width: 430px)` block) and `src/ui/tokens.css` (`--gutter` now `clamp(16px, 2vw, 24px)`), `src/ui/media.css` (captions 12 px, 16 px side padding).

## What changed
- **Home filler deleted:** the scroll-lit "Swello reads swell, wind and tide …" section, its CSS, and its observer code are gone; no replacement. `rg "reads swell" src` is empty.
- **Type scale at ≤ 430 px:** page titles 28 px (`main#main h1`, so every screen follows it), section titles 20–22, body 15–16, labels/captions/credits/chips 12–13, hero numbers 56 (Home "Hello, Milo." and the Forecast height backdrop; both were 58 and 110), spot-card titles 22, Home panel titles 22 (they were ~43).
- **Gutters 16 px everywhere** (token change; media captions and map overlays too).
- **Controls:** every button, select, input, range, radio/tab and summary in `main` is ≥ 44 px tall at 390; icon buttons 44 × 44; 12 px between control groups (Forecast control row, Personal side nav, Compare chips, Find Spots rows, Map HUD, number inputs); no two-line chips or buttons (hour-table buttons are nowrap).
- **Forecast phone:** the "Map" button next to "Now" is hidden at ≤ 430 (the Map tab is one tap away, and it was wrapping the range control onto a second row and pushing the readout down). The first-screen answer is unchanged.
- **Map phone:** HUD controls 44 px, 12 px spacing, attribution and legend given their own bands so the 12 px attribution no longer sits on the time card.
- **Home size:** 390 is now 2.15 viewports (was 3.05) and 1440 is 2.34 (was 2.94).

## Proof: `t034-density.mjs` (new, toolkit)
At 390, over **11 screens**: Home, Forecast, Wave scale, Map, Map Compare, Map Find Spots, Personal (Profile, Spots, Preferences, Journal, Account). Measures, from computed styles and boxes: hero ≤ 56; h1 ≤ 30; h2/h3 ≤ 22; other text ≤ 22 and (outside headline numbers) ≤ 17; minimum 12 px; every text line ≥ 16 px from both edges (text inside horizontal scrollers is exempt); clipped text; tap height ≥ 44 for controls; two-line chips/buttons; ≥ 12 px between neighbouring chip/button controls; ≤ 1 primary action in the first screen; 0 px horizontal overflow.
- **Before:** 558 violations across the screens (`scratchpad/t034/before.txt`). **After:** `ALL PASS` in light and in dark.
- **Honest exemptions in the script** (so the pass is not hollow): segmented groups (`.seg`, tablists, radiogroups, `.fc-jump`, `.xzoom`, `.xtools`, `.xt-step`, `.xt-range`, `.tscroll` hour tables, rails) count as one control; **Leaflet map pins and map attribution are exempt from tap/gap/gutter** (dense geographic markers; 44 px hit areas would overlap) but the attribution is 12 px; visually hidden `.sr` text is ignored; the check for list-row buttons made of several parts (hours, spots) is the tap height only, not the two-line rule.

## Other checks (real output)
`tsc` clean; `npm test` 226 pass, 0 fail; `npm run build` built. `journeys.mjs` **8/8**. `t031-firstview.mjs` light **ALL PASS** (the first-screen answer, wave-scale entry, hero band). `t022-nav` ALL PASS, `t033-shots` ALL PASS, `t031-media` ALL PASS, `wave-spot` 14 PASS, `t030-home` saved and empty ALL PASS (its lit-sentence checks now assert the sentence is **gone**).

## Shots (390, every screen; looked at Home, Forecast, Map, Personal in full)
`/private/tmp/claude-501/-Users-milosin-Development-projects-surf--claude-worktrees-engineering/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t034/`: `before-<screen>-{fold,full}.png` and `after-<screen>-{fold,full}.png` for `home, forecast, wave-scale, map, map-compare, map-find, personal, personal-spots, personal-prefs, personal-journal, personal-account`; dark proof `dark-<screen>-fold.png`.

## Limits
- Only 390 is measured; the rules apply at ≤ 430 px. Tablet widths keep the old scale.
- Quiver (Product's) and the shell header/tab bar are outside this pass; the script measures `main` only.
- Map pins stay at their small visual size (exempt as above); everything else on the map screen is 44 px.
- Not merged or pushed. Dev server on 5185 still running.
