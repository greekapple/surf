# T-023 + T-024 Engineering handoff

**Branch:** `worktree-engineering` (synced with `rebuild/swello-v0.16` first)

## T-023: Quiver form outliving a section change
- **Cause:** `QuiverView` returned the board form whenever `editing` was set, ignoring `section`, so a route change left the form on screen.
- **Fix (`src/features/quiver/QuiverView.tsx`):** the form is tied to the section it opened in. Any `section` change closes it, whatever triggered it (pills, menu, Back); `src/app` is untouched. If fields were edited (any field, the entry path, or the photo scan), the form stays and an "Unsaved changes" confirm appears with **Discard changes** (continue to the new section) and **Keep editing** (navigate back to the section the form was opened in). A pending "Confirm delete" is also reset on a section change. `BoardForm` reports `dirty` through a new `onDirty` prop.
- **My Boards controls checked:** Edit opens the edit form, Cancel returns, Open in Showroom shows Showroom, the Showroom's Board Match button shows Board Match, Delete asks to confirm, Confirm delete removes a board. They already worked; the script now asserts each.
- **Script:** `~/Development/ai-system-setup/playwright-toolkit/swello/t023-quiver.mjs [base]` (default 5185). Uses the section pills when present and history navigation otherwise, so it survives T-022 removing them. It asserts URL, heading and form presence after each click, the dirty confirm (both choices), Browser Back, and the My Boards controls, at 1440 and 390: 23 checks each, all PASS with the fix. Run against the committed `QuiverView.tsx` (fix removed) it FAILED on the form-closed and heading checks, so it does catch the bug; the fix was restored afterwards.

## T-024: `src/services/spotStrip.ts`
- `spotStrip(spots, records, savedIds, now, profile)` returns, in saved order, `{id, name, region, category, heightLabel, heightKind: 'estimate'|'offshore'|'none', validTime, demo}`. Pure; takes records and profile as arguments (no store access).
- Uses the record for the current hour (the earliest at or after the top of the hour); a stale earlier hour is not shown as current. `category` is the rating category (including FLAT/UNRATED); no record gives UNRATED.
- `heightLabel`: "Est. X–Y ft" only when `canPresentBreakingEstimate` passes (formatted by `formatWaveHeight`, so units follow the profile); otherwise "3.9 ft offshore"; "No forecast data" or "No offshore height" when there is nothing. Never a bare height. `demo` is true when the record has no ocean evidence.
- Duplicate and unknown saved ids are dropped.
- `src/tests/spot-strip.test.ts`: 5 tests (estimate present, refused, missing data incl. stale hour, demo spot, order/units).
- Note for product: `records` are `Forecast[]` (e.g. `view.mapRecords`) and `spots` are catalogue spots (`allSpots`).

## Checks (real output)
`tsc` clean; `npm test` 202 pass, 0 fail; `npm run build` built; `journeys.mjs` on 5185: 8/8; `t023-quiver.mjs`: all passed (above). No visual change beyond the confirm box, so no screenshots. Dev server stopped. Not merged or pushed.
