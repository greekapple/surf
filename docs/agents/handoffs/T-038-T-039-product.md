# T-038 (no AI on condition surfaces) + T-039 Windy teardown — Product handoff (2026-10-31)

Branch `worktree-product`. Commits: 67d9bbe (T-038), then the teardown and this handoff.

## T-038
- **Forecast hero:** the AI loop or still is replaced by `SeaState` (new `src/features/forecast/SeaState.tsx` + `seastate.css`), a backdrop drawn from the selected hour.
  - Swell crests run perpendicular to the primary swell direction, spaced by its period, move the way it travels, and are brighter for bigger swell.
  - A fainter dashed set shows the secondary swell.
  - Wind streaks point along the wind in the wind colour scale, more and faster with speed.
  - Caption: "Drawn from the forecast: swell from S at 11 s, wind from W. North is up."
  - Missing data draws nothing for that layer and the caption says "no … data". Reduced motion holds it still.
  - The rating, labelled height, wind and tide stay in front, as before.
- **Home hero:** the same backdrop for the selected spot's current hour. The caption has no numbers ("Ocean Beach now, drawn from the forecast: swell from S, wind from W."), per Home's no-numbers rule.
- **Forecast wave card:** it was T-033's compact AI band illustration. It is now a drawn staircase of the eight size bands with this hour's band marked, plus the same labelled source line as the Wave Scale page and "Open full scale". The illustrated bands stay on `/forecast/wave-scale` only.
- **Unchanged:** Home spot cards and panels were already real credited CC photos (generic ones say "not this spot"), and Map uses no media.
- **No `ai-*` asset is requested** on Home, Forecast or Map at 1440 or 390, and no "AI-generated" text appears there. The manifest still holds the AI entries for Wave scale and the board room.

### Checks (real output)
- tsc OK · test 226/0 · build OK
- `t038-no-ai.mjs` (new): light 18/18 PASS, dark no failures. At 1440 and 390, Home, Forecast and Map request no `/media/ai/` file, have no AI media node and no AI caption. The heroes carry the drawn caption, and the Home caption has no numbers.
- `t031-firstview.mjs` ALL PASS: its caption check now expects the drawn caption instead of the AI one.
- `t034-density.mjs` ALL PASS, after raising my caption and band labels to 12 px.
- `t030-home.mjs` ALL PASS · `wave-spot.mjs` 14 PASS: the card check is now "no illustration on the forecast card".
- `journeys.mjs` 8/8 · `t022-nav.mjs` ALL PASS
- **Superseded:** `t031-media.mjs` asserts the AI hero and caption on Home and Forecast, which this task removes on purpose. Its condition-surface checks now fail by design and are replaced by `t038-no-ai.mjs`. Retire it or keep only its Wave-scale part.
- Shots: `playwright-toolkit/swello/artifacts/t038/{home,forecast,map}-{1440,390}[-dark].png`

## T-039 Windy
- Captured logged out with Playwright; no bot check was shown and nothing was bypassed. Screenshots and a README are in `~/Development/swello-design-references/18-teardown-2026-10-31/windy/`.
  - Map, waves and swell layers, the spot Waves & Tides panel with its swell rose, the timeline, model picker and Compare forecasts, at 1440 and 390.
- The notes fill only the "## Windy" section of `docs/design/TEARDOWN-2026-10-31.md`, as an anatomy paragraph and a Feature | Verdict | Our version / data table.
- Main takeaways:
  - one shared time scrubber;
  - a legend with its unit on every colour scale;
  - the swell rose at the point;
  - open model comparison used as a confidence signal;
  - computed wave power, labelled.
- Windy's gap: it has no surf height, no rating and no shore relation. It shows the ocean, not the break.
