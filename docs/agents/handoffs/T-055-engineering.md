# T-055 handoff (engineering): one source of truth + a believable rating

## What was wrong (found, not guessed)
- The saved-spots strip chip (`spotStrip`) and the day cards (`spotReport.dayHeight`) read the v1 range from the record; the Surf card read `headlineSurf` (v2 at Ocean Beach). That was "4–9 vs 5–11".
- The default hour differed: Home, strip and map used the record at the top of the current hour; the Forecast page (`selectedRecord`, `useForecast`) used the first record at or after *now*, i.e. the next hour. That was "2.1 mph E offshore" vs "1.8 mph NW cross-shore".
- "Every spot Solid": 44 of 45 spots have no surveyed orientation, and the provisional rating capped them at SOLID (74) where they all piled up (76.9% of spot-hours).

## What changed
- `src/services/spotHour.ts` (new): the one selector. `recordAt` (THE hour rule), `windOf`, `tideOf`, `spotHourOf`/`spotHour` (surf headline + rating + wind + tide for a spot/hour), `dayRange` (envelope of the hourly headline over the day's daylight hours, labelled with its basis).
- `spotStrip`, `spotReport` (wind, tide, day heights), `dashCard`, the map callout's `windLine` now all read it. `spotStrip` and `spotReport` take an optional `{bundle}` context; Nav and Home strip pass `view.ocean.bundle`.
- Forecast default hour: `selectedRecord` and `useForecast` use the same top-of-hour rule.
- `src/services/dataPhase.ts` (new): loading / ready / failed. Home shows skeleton cards and a skeleton list while loading; the map callout shows a skeleton block. "No forecast data" and "No good daylight window left" show only after a real failure or when data is ready and the spot has none.
- Rating (RATING-V2-PLAN Phase 1): ceilings in `ratings/windRules.ts` applied in `provisional.ts`; reported as `rating.ceilings` and as a "Rating ceiling" item in `explainRating`. See `docs/forecast/RATING-DISTRIBUTION-T055.md` for the before/after: SOLID-or-better 76.9% → 22.8% over 45 spots x 72 h.

## Verified
- tsc clean; 315 tests pass (10 new in `one-source.test.ts`: strip == Home card == report == Surf-card selector for the same spot/hour, with and without a MOP v2 bundle; hour rule; wind accessor; day range; loading vs failed; ceilings; `explainRating`); `npm run build` ok.
- Browser (5185): `t055-one-source.mjs` ALL PASS at 1440 and 390 (Home range == Forecast Surf card == strip chip, 5–11 ft; wind speed and relation equal; skeletons while data is held 4 s, no "No forecast data"). t047, t045, t043, t034-density ALL PASS. Shots: `playwright-toolkit/swello/artifacts/t055/`.
- journeys: 7 of 8. **Journey 5 (Quiver add/edit/reload) fails after the reload, at the spec-sheet or showroom step** (`locator.innerText` timeout). Add and edit pass. I did not touch `src/features/quiver`; I have not run it on the base branch, so I cannot say it is pre-existing, only that the failing step is in product's files.

## For product (T-056) to wire (I did not touch forecast UI)
- `SpotPage` day cards still compute their own median of hourly bounds. Use `dayRange(spot, records, dateKey, now, profile, {bundle})` from `services/spotHour` so the day card, strip and Surf card come from one engine (label: "Est. 5–12 ft · daylight hours"; `dayRange().basis` says it).
- `SpotPage.surfOf` already goes through `headlineSurf`; swapping it to `spotHourOf` also returns the rating, wind and tide for the same hour.
- Home's `HomeView` and `home.css` got a small skeleton edit (`.dsk`, `.nbsk`) — expect a trivial merge if T-056 edits those files.

## Honest limits
- The new ceilings and the flatter potential curve are product rules, not fitted; nothing validates that the new spread is closer to reality (no rideability observations).
- The wide-range ceiling reads the record's v1 range; at Ocean Beach the displayed v2 range can differ a little from the range that triggered it.
- 44 of 45 spots now top out at NOT BAD while the wind relation is unknown; surveying shore normals (SPOT-FACTS-REVIEW.md) is what lets them rate higher.
