# T-014 Engineering handoff: Home "Next Best Windows" as time ranges

**Branch:** `worktree-engineering` (base 748d9a8)

## What changed
- `src/services/windows.ts`: new pure `windowRanges(hours, at, min = WINDOW_MIN_SCORE)` returning `{start, end, peak, peakScore, hours}`. `WINDOW_MIN_SCORE = 55` (also now used by `upcomingWindows`, same value as before). Qualifying hours must be exactly 1 h apart; a null or below-band score, or any gap, breaks the range. Input is sorted, duplicate timestamps are ignored, peak is the earliest highest score.
- `src/features/home/HomeView.tsx`: `surfWindows` builds ranges per spot from daylight hours in the next 5 days (a non-daylight hour is a gap, so ranges never span night); the top 4 by peak score are shown soonest first. `Windows` and the spot-card "Best:" line show "10 AM–6 PM" (single hour shows one hour; an end on another day carries its weekday). Click still opens the forecast at the peak hour (`h` = peak). Added one import line.
- `src/tests/windows-range.test.ts`: 7 tests (contiguous, gapped, single hour at threshold, day boundary, null score, unsorted/tie, none).

## Checks (real output)
- `npx tsc --noEmit`: clean.
- `npm test`: 167 pass, 0 fail.
- `npm run build`: built (existing chunk-size warning only).
- `journeys.mjs` on port 5185: 8/8 passed, no unexpected browser errors.
- `home-shots.mjs`: 12/13. FAIL `Forecast menu contains Wave Scale` (nav menu, not touched by this task; not checked against the base commit).

## Browser
Screenshots looked at (1440 and 390, no horizontal overflow): `/private/tmp/claude-501/-Users-milosin-Development-projects-surf/1e94bae3-e93d-4977-acb0-1253741ef4f8/scratchpad/t014/t014-desktop-fold.png` and `.../t014-mobile-full.png` (also `-desktop-full`, `-mobile-fold`).

## Incomplete / notes
- Behaviour change: windows now require score >= 55 (lead decision), so a spot with no qualifying daylight hour shows no window; the panel is hidden if none anywhere. Previously the best daylight hour was shown regardless of score.
- Wide ranges (e.g. 10 AM–6 PM) occur when a whole day rates >= 55; a band narrower than the threshold would need a lead decision.
- The 5-day horizon is now `nowH + 5 days` rather than the first five forecast days.
- `soonest` in HomeView is unused (pre-existing); left alone.
- Dev server stopped, no browsers left open.
