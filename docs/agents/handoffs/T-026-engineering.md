# T-026 Engineering handoff: spot-report data layer (no UI)

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Files: new `src/services/spotReport.ts`, new `src/tests/spot-report.test.ts`; one word changed in `src/services/spotStrip.ts` (`currentRecord` is now exported so both selectors use the same current-hour rule).

## API
`spotReport(spot, records, now, profile, extrema?)` returns:
- `headline`: `{category, heightLabel, heightKind: 'estimate'|'offshore'|'none', wind: {word: "Gentle E", label: "8.0 mph E", relation: "offshore", gustLabel}|null, tide: {state: 'rising'|'falling'|'unknown', heightLabel, note}|null}`. Category and height label come from `spotStrip` (same rules: "Est. X–Y ft" only when `canPresentBreakingEstimate` passes, else "3.9 ft offshore").
- `days[7]` from today's Pacific date: `{date, label, am, pm, heightRange, heightKind, primarySwell}`.
  - `am` / `pm` = `{category|null, hours, basis}`. AM is Pacific hours 6–11, PM 12–17. Category is the rating of the median-scored supplied hour. `basis` says how: "median of 6 hours", "a single hour, not a half-day summary", "no forecast hours" (category null), or notes unrated hours.
  - `heightRange`: "Est. 3–7 ft" (union of presentable estimates over 6 AM–5 PM) else "3.1–3.9 ft offshore", else null. Never unlabelled.
  - `primarySwell`: the primary swell at the supplied hour nearest noon, with that hour's ISO time in `at`; null if none.
- `swells`: current components `{label, heightFt, heightLabel, periodS, dirDeg, dirWord}` for Primary and Secondary, only when supplied. **Wind sea is never listed**: the marine feed supplies only the combined wave height, with no wind-sea height, period or direction, so listing one would be invented.
- `tides`: today's highs and lows `{type, time, localTime, heightLabel}`. Pass NOAA predictions as the optional 5th argument `extrema` (the same `TidePrediction[]` as `view.ocean.bundle.extrema`) to get `source: 'predictions'`. Without them, highs and lows are found in the hourly regional tide values and flagged `source: 'hourly'` with a note that times are to the hour. Null when there is no tide data.
- `light`: first light, sunrise, sunset, last light as `{iso, localTime}` (local Pacific clock); labelled approximate (solar position; first and last light = civil twilight). Computed from the date and spot coordinates, so present even with no records.
- `waterTemp`: "15°F ..."-style label marked as the model's sea surface value, or null. `validTime`: the record used for the headline, or null.

## Why a 5th argument and no imports from `src/features/*`
The brief had four arguments; tides need the NOAA extrema, which are not in the hourly records, so I added the optional fifth. `features/forecast/helpers.ts`, `model.ts` and `Almanac.tsx` use extensionless imports, which the Node test runner cannot load, so the sunrise maths (the same NOAA simplified method, parameterised by zenith angle) is a small copy inside the service; the rest reuses `ratings`, `ocean/time`, `utils` and `spotStrip`.

## Checks (real output)
`tsc` clean; `npm test` 210 pass, 0 fail (8 new); `npm run build` built. No UI, so no browser run.

New tests: full data (every section), missing secondary (and never a wind sea), a day with no hours (null, not filled), a half-day from one hour says so, DST fall-back (25-hour Nov 1: 7 distinct Pacific dates, 6 AM hours and 6 PM hours, sunrise clock moves back one hour), estimate refused versus present, no records at all, and tides (predictions, hourly-derived, none).

## Limits to know
- Half-day category is the median-scored hour, not a mean or a "best hour"; the `basis` string says so.
- Light is approximate (a few minutes), and hourly-derived tide extremes are to the hour.
- Not merged or pushed.
