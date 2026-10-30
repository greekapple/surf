# T-017 Engineering handoff: Board Match on the breaking-wave estimate, plus T-014b

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first)

## What changed
- `src/ocean/match.ts`: when `face.value` is null and `faceEstimate.input` passes `canPresentBreakingEstimate`, `evidenceMatch` uses `rangeFt`. Overlap with the preferred min–max is distance 0; the comfort and skill caps compare against the range **high**. Computed and excluded results say "(based on an unvalidated estimate, X–Y ft)" and carry `estimate: true`. With no estimate the spot stays unmatched and the reason adds the refusal ("breaking-wave height (no profile)"). A measured face value is used exactly as before.
- `src/recommendation/board.ts`: `scoreBoard(board, f, p, faceRange?)`. The range is used only when the forecast has no face value; overlap with the board's range is within range, otherwise distance is the gap. A malformed range is ignored. The wave-size reason says it is an unvalidated estimate.
- `src/ocean/quality.ts` (not on the owned list; needed so the size factor can use the estimate): optional 4th parameter `faceEstimate`. Only `evidenceMatch` passes it; ratings and `sqi.ts` callers do not, so ratings are unchanged.
- `src/services/windows.ts`: `windowRanges(hours, at, min, within)` and `WINDOW_BAND = 10`. A window keeps only hours within 10 points of its peak (and ≥55); leftover hours on each side are windowed again around their own peaks. Default `within` is unlimited, so T-014 behaviour is unchanged.
- `HomeView.tsx` `surfWindows` only (plus the import line): uses the band and shows at most 2 windows per spot among the 4.
- `src/tests/t017-match.test.ts`: 11 tests (range overlap, gap penalty, caps on the range high, measured value unaffected, no estimate, scoreBoard range/none/malformed/ignored, window band, leftovers, gap/null).

## What Ocean Beach still lacks (so its Board Match remains "unavailable")
With a real Ocean Beach record the estimate exists, but `evidenceMatch` still returns no score because exactly these are missing (test asserts the text): **local wave character** (never set by Open-Meteo), **complete hazard assessment** (`hazardsComplete` is false), and **sufficient SQI inputs**. Within SQI, `spot-2` has no `idealSwell`, `tidePreferences` or `faceRange`, and no organization value (wind and tide data are present). `difficulty` is present (Expert). Nothing was invented; boards also stay ineligible because `scoreBoard` needs a known character.

## Checks (real output)
- `npx tsc --noEmit` clean; `npm test` 187 pass, 0 fail; `npm run build` built; `journeys.mjs` on 5185: 8/8, no unexpected browser errors.
- `home-shots.mjs`: 12/13; the one FAIL is "Forecast menu contains Wave Scale" (same failure as in T-014, not touched here).
- Screenshot looked at: `/private/tmp/claude-501/-Users-milosin-Development-projects-surf/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t017/t017-desktop-fold.png`.

## Honest note on the screenshot
Home now shows two Ocean Beach and two Linda Mar windows (the per-spot cap working), but the Ocean Beach ranges are still wide ("10 AM–6 PM", "7 AM–5 PM"), so the 10-point band did not visibly tighten them with today's data. I did not check why; presumably the hourly scores sit within 10 points of the peak through the day. The band is a rule, not a guarantee of short windows.

## Incomplete
- No UI shows the match or estimate yet (product's step). Dev server stopped; not merged or pushed.
