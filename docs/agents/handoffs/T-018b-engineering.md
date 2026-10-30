# T-018b Engineering handoff: Forecast "Wave scale (3D)" card follows the estimate

**Branch:** `worktree-engineering`

## What changed (`src/features/forecast/ForecastView.tsx`, `forecast.css` only)
- `WaveCard` now starts at the same value as the 3D page: the model-estimate midpoint (rounded to 0.5, clamped 2–20) with an "Estimate" chip ("Midpoint of the model estimate (3–7 ft), not measured, unvalidated."), else the offshore height with an "Illustrative" chip ("Offshore wave height (3.9 ft); breaking faces can differ."), else the saved preference.
- Dragging the slider relabels it "Illustrative · Adjusted by you; not a forecast." and still saves the preference. The start follows the spot and hour again when they change. Slider aria-label and valuetext say "model estimate midpoint" or "illustrative" accordingly.
- Side mode is unchanged: it renders `MiniScale` (scale folder), which already starts at the estimate midpoint from T-018 but still falls back to the saved preference, not offshore, when there is no estimate. Making that offshore needs a change in `src/features/scale/`; I left it because the brief limited this task to `src/features/forecast/*`.

## Checks (real output)
- `tsc` clean; `npm test` 192 pass, 0 fail; `npm run build` built; `journeys.mjs` on 5185: 8/8.
- Browser at 1440 and 390 (8 PASS, 0 page errors): with an estimate, the card starts at 5 ft with the Estimate chip; live Ocean Beach (refused today) starts at 4 ft (3.9 rounded) labelled Illustrative/offshore; dragging relabels it. The estimate case used the same test-browser provider rewrite as T-018 (swell direction 270°, no wind sea), so 3–7 ft / 5 ft come from that fixture, not real conditions.
- Screenshot looked at: `/private/tmp/claude-501/-Users-milosin-Development-projects-surf/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t018b/card-desktop-estimate.png` (and the offshore and mobile variants in the same folder).

## Notes
- Not merged or pushed; dev server stopped; temporary scripts removed.
