# T-018 Engineering handoff: show the breaking-wave estimate (UI) + Wave Scale tie-in

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first)

## What changed
- `src/features/forecast/estimate.ts` (new): `faceEstimateView(forecast, profile)` returns `{state:'range', rangeFt, midFt, text}`, `{state:'none', reason}`, or `null` for demonstration data with no ocean evidence. Uses `canPresentBreakingEstimate` and `formatWaveHeight`, so units and the guard are the shared ones.
- `ForecastView.tsx` Readout: new "Surf (breaking)" block after Offshore: "Est. 3–7 ft" with "model estimate, not measured · unvalidated". A refusing spot shows "No estimate"; the reason shows on hover and keyboard focus (focusable, `data-tip`, aria-label). Offshore stays as is, labelled "Offshore · Model Hs, not surf size". The row is now 7 columns on desktop; the 3-column breakpoint dividers were re-ordered.
- `src/features/scale/ScaleView.tsx`: with an estimate, Wave Scale opens at the range midpoint (rounded to 0.5, clamped 2–20), with an "Estimate" chip, the range, "not measured, unvalidated", and the offshore height. Reset button reads "Reset to estimate midpoint". Without an estimate it opens at offshore Hs as before ("Illustrative").
- `MiniScale.tsx` (not in the brief, same family): with an estimate and no demonstration face, starts at the midpoint, slider locked, "Estimate" chip.
- `HomeView.tsx`: hero stat line gains "Est. 3–7 ft · At the break, unvalidated" (only when an estimate exists), and spot cards gain "Est. 3–7 ft at the break · unvalidated". `home.css`: card line style, and a tighter hero-stats rule so five stats stay on one line at desktop.
- `src/tests/t018-estimate-view.test.ts`: 4 tests (range and midpoint, metres via the shared formatter, refusal and failed guard, no-evidence cases).

## Board Match wording (acceptance 4)
No UI surface currently renders `evidenceMatch` reasons or `scoreBoard` factor text (grep of `src/features`, `src/app`, `src/ui`, `src/services`), so nothing needed changing here. The unvalidated wording is already in the strings (T-017); product wires them when it adds the surface. Note that Ocean Beach would still show no match for the reasons in the T-017 handoff.

## Checks (real output)
- `tsc` clean; `npm test` 191 pass, 0 fail; `npm run build` built; `journeys.mjs` on 5185: 8/8, no unexpected browser errors.
- wave-spot (copy pointed at 5185, since the original hardcodes 5180): 8/8 PASS. `wave-spot.mjs` was **not** changed. Its expected start is the offshore number, which is still correct for live data, where Ocean Beach currently refuses. (With an estimate the viewer would open at the midpoint; the script's text check would still pass because the panel also states the offshore height.)

## Browser evidence, and an important caveat
- Live Ocean Beach is refused right now: swell from S 197°, outside the 203–323° window, and a reading with wind sea larger than the swell. So the live app shows "No estimate" for it.
- To see the range UI I used Playwright to rewrite the Ocean Beach provider response only in the test browser (swell direction 270°, combined height = swell × 1.05). These screenshots show the layout with an estimate; the numbers (Est. 3–7 ft, midpoint 5 ft) come from that fixture, not real conditions.
- Screenshots (looked at): `/private/tmp/claude-501/-Users-milosin-Development-projects-surf/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t018/` `forecast-desktop.png`, `forecast-mobile.png`, `scale-desktop.png`, `scale-mobile.png`, `home-desktop.png`, `home-mobile.png`, `refusal-hover.png` (Trestles tooltip: "Beach orientation is not established for this spot."). Forecast desktop compared with `00-target/forecast.png`: the "Surf (breaking)" slot sits in the same place as the target's "Surf (breaking) 4–6 ft"; no horizontal overflow at 1440 or 390.

## Notes and open points
- The Forecast page's separate "Wave scale (3D)" card (the photo with the 6 ft slider) is not tied to the estimate or offshore; I did not change it. Worth a look by product.
- Hovering the refusal tooltip overlaps the day strip briefly; it is a transient overlay.
- Dev server stopped; temporary scripts removed from the toolkit folder. Not merged or pushed.
