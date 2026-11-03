# T-082 (product): night fixes on Home, the stale scale card, tide stations everywhere

Branch `worktree-product` (merged forecast-trust first). One commit, local only. No Codex run.

1. **"Best … nearby" at night:** after dark (`isDark` at the reference spot) the toggle opens on **Tomorrow AM**, so the list has rows (5 → now 3 to fit two screens). If someone switches to "Right now" in the dark, it says "It's dark, so nothing is rated right now" with a "See tomorrow morning" link instead of the bare empty message.
2. **Spot-page Wave scale card:**
   - The fixed size-band poster ("8–10 ft wave") is gone, because it didn't match the hour.
   - The card now states what the forecast-driven 3D draws for this hour, with the same numbers as `ScaleStage`/`waveSpec`: the estimate's centre via `faceRange`, e.g. "drawn at 7.5 ft face · surfer 5′9″" (1.75 m in metric), under the caption "3D illustration of this forecast hour · approximate" (`LIVE_CAPTION`).
   - Offshore-only hours: "No breaking-wave estimate · 6.8 ft offshore swell, not surf size". No estimate at all: "No breaking-wave estimate for this hour".
   - The drawn to-scale chart (this hour's range, you and your board) stays as the visual. I didn't edit `src/features/scale/*`; I only import `LIVE_CAPTION`.
3. **"Your spots" cards at night:** when the card's call is Dark, the card shows only "Dark · next window …" (the rating bar with "No rating" and empty dots is hidden). The same applies in the nearby rows.
4. **Tide stations (your addendum):**
   - Every covered spot's nearest NOAA CO-OPS prediction station (reference or subordinate) is now registered. That's 30 new stations from the mdapi list, including Santa Cruz 9413745, Monterey 9413450 and Port San Luis 9412110.
   - They're ingested high/low only (`hiloTideStationIds` and `tideHiloServiceStationIds`, a `tide-extrema-<id>` target each, proxied by key, fetched into `bundle.stationTides`). Subordinate stations have no hourly series; `interval=h` returns "No Predictions data".
   - Home's next tide uses the chosen spot's nearest station by name.
   - **Every one of the 45 spots has a station within 40 km** (farthest: Oceanside → San Clemente TWC0419, 32.8 km), so none genuinely has none.
   - Tests: every covered spot's nearest station within 40 km is ingested; the registry and service agree; high/low only, with no hourly target. t074 now requires the next tide to name its station, never a dash.
   - The existing `extraTideStationIds` (Pillar Point, Point Reyes with hourly) and the reviewed `tideAssignments` (still empty) are unchanged, so no spot's tide card changes.
   - Side effects: the server has 30 more ingestion targets (190 → 220; `service.test`/`v10.test` counts updated). `docs/forecast/SPOT-FACTS-REVIEW.md` was regenerated with its own build script, because it lists registered stations.
5. **Layout:** to keep Home within two screens at 1440 (t047) now that the nearby list has rows at night: week grid 5 rows, nearby 3, welcome band 236 px, gap 24. Home is 1792 px.

## Checks (5184)
- tsc OK; unit tests 424/424; build OK.
- t074 28/0; t045 54/0; t047 55/0 (two checks updated: a card may show "Dark ·" instead of an empty rating bar; the nearby title may be "tomorrow morning" after dark; backup kept); t067 34/0 (rows ≤ 5); density ALL PASS; journeys 8/8.
- Live check: all 32 station high/low requests returned 200; the night nearby list has rows; no card shows both "Dark" and "No rating".
- **Not runnable here:**
  - **t062** waits for `.live.is-live`, but this worktree has no `public/media/scale3d-live/*.glb` (licensed and git-ignored; the main checkout has only `surfer.glb`).
  - **t052** waits for the Wave scale page's drawn `.sc-svg`, which is now hidden behind the default 3D view (a Fable-era change, not from this task).
  - Please run both where the assets are.
- Shots: `playwright-toolkit/swello/artifacts/t082/`.
