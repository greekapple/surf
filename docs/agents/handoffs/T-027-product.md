# T-027 · Forecast, cinematic and phone-first — Product handoff (2026-10-30)

Branch `worktree-product`. Commits: e907ed8 (chapters), f8e2c37 (merge of `rebuild/swello-v0.16` with fonts + T-028 Media), c50f539 (Media, weights, layout), then this handoff commit.
Files: new `src/features/forecast/Cinematic.tsx`; `src/features/forecast/{ForecastView.tsx, forecast.css}`. No change to `src/ui/app.css`; no new dependencies.

## What changed (reference: video Z9-ik87kGzI frames g362, g345, g372, g395)
1. **Hero** (`CineHero`, 0.88 viewport at 1440 and 390): full-bleed spot photo, dark film; the selected hour's height set huge in `var(--display)` behind the spot name, fading into the water (the "F-22 behind the jet" layering). Under the name: condition chip and the honest label, `Est. X–Y ft at the break · model estimate, not measured` or `X ft offshore · not surf size`; no height → "No wave height for this hour" and no big number. Day and time line; star; meta line (demo mode says so).
2. **"Today at <spot>"** (`TodayAt`): plan view in the centre (shoreline from the surveyed shore normal, primary swell and wind drawn as arrows from their real directions, "not to scale"; no shoreline when the orientation is unknown). Four callouts on hairline leaders, revealed on scroll: Swell (offshore model, height · period, direction, secondary), Wind (speed, direction, shore relation, gust), Tide (SF regional MLLW, height, trend, next extreme from NOAA predictions), Water (sea-surface model °F/°C). Missing values show "—" and "Not in this record". Heading says "Sat 31 at …" when the selected hour is not today. Replaces the old "Conditions" tiles card.
3. **Scroll-lit sentence** (`litSentence` + `LitLine`): one sentence from the selected hour, e.g. "Solid at Ocean Beach today at 6 PM: 4.1 ft offshore, not surf size, with a 13-second S swell, a falling tide and 8.9 mph onshore W wind." Adds "turning <relation> by <hour>" only when a later hour the same day has a different known shore relation. Clauses without data are left out. Numbers never split from units.
4. **Parallax band** "The week ahead." then the existing week: range (7 Days / Day / Hour), Now, Map moved from the hero to the top of the week controls; readout, day cards, chart, wave card, next hours (two columns at desktop), nearby, parts.
- Motion: CSS scroll-driven animations (`view()` / named `--lit` view timeline) inside `@supports`; without support an IntersectionObserver adds `.in` (callouts) and drives the word lighting (scroll listener attached only while on screen). `prefers-reduced-motion`: everything static, all words lit.
- Fonts: only `var(--display)` and `var(--sans)` (lead correction); headline weights 600–700 for Syne.
- Media: hero and band use `<Media>` for spots with their own CC photo; spots with only generic photos keep `SpotPhoto`, whose credit says "Generic photo, not this spot" (Media has no such line). Higgsfield entries will show their forced caption.
- The chapters are a dark film in both themes (white type always on dark photography); the band fades into the page background.

## Checks (real output)
- `npx tsc --noEmit` OK · `npm test` pass 215, fail 0 · `npm run build` built
- `journeys.mjs`: 8/8 (journey 3's metrics snapshot reads `.fc-anno .anno-grid` instead of the removed `.tiles`)
- `t022-nav.mjs`: ALL PASS · `wave-spot.mjs` (now takes a base URL): 8/8 PASS
- `t015-qa.mjs`: ALL PASS; the 390 D-05 step now routes Home → search → Forecast → last day card (Home's week cells were removed in T-022)
- `t027-shots.mjs` (new): 0 px overflow at 1440 and 390; hero 0.88 viewports; console clean with and without reduced motion
- `t027-fallback.mjs` (new): with `animation-timeline` reported unsupported, `.io` mode activates, 7/7 callouts revealed on scroll, sentence lights 3 → 13 → 25 of 25 words. Chrome still applies its native `@supports` CSS, so this verifies the fallback logic and classes, not a browser without scroll-driven animations.
- Tide card sunrise/sunset lines (shared `src/ocean/sun.ts`): ↑ 7:34 AM, ↓ 6:15 PM for Ocean Beach on Oct 30, plausible.

## Review (pr-review-toolkit silent-failure-hunter) and fixes
1. **Critical, fixed:** in demonstration mode the hero labelled the illustrative face height as "offshore · not surf size" (`heightFt` is `face ?? offshore`). Now it says "X ft demonstration face · not live data" and reads offshore Hs from `f.offshore` only. Checked in the browser with `t027-demo.mjs`: hero "5.1 ft demonstration face · not live data", sentence matches, all PASS.
2. **Fixed:** a missing swell period or direction could print "NaN s" or "undefined". Each field is now checked: "period —" / "direction not in record", and the secondary clause drops missing parts.
3. **Fixed:** a tide extreme with no height was skipped, so the following one was shown as next. The first later extreme is now shown, with "(height not in record)" when its height is missing.
4. **Fixed:** Hawaiian scale garbled the big number. It now shows the range only; the unit text sits in the small suffix.
5. **Fixed:** water and gust use finite checks, not truthiness.
Re-run after the fixes: test 215/0, build OK, journeys 8/8, t022-nav ALL PASS, wave-spot 8 PASS, t015-qa ALL PASS, fallback 3 PASS, overflow 0 px at 1440 and 390.

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t027/`:
- Before/after: `side-390-before-after.png`, `side-1440-before-after.png` (raw: `before-*`, `after-*-{first,anno,lit,band,full}[-rm].png`)
- Next to the video frames: `side-hero.png`, `side-anno.png`, `side-lit.png`, `side-band.png`; phone chapters `side-390-chapters.png`
- Fallback: `fallback-390-anno.png`, `fallback-390-lit.png`; tide `1440-tide.png`

## Notes / incomplete
- The cut-corner CTA (g478) was not added: the wave card already has "Open in 3D", and another CTA would repeat it.
- Full-page screenshots show the scroll-revealed chapters dim (they are captured at scroll 0); the per-chapter shots are taken in place.
- Outside my files: with Syne the strip's spot switcher truncates to "Ocean Bea…" at 390 (`SpotStrip` / `app.css`).
