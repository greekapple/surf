# T-107 handoff (engineering): honest week cells, and why nearby rows said "stale estimate"

Branch `t107-week-honest` (forecast-trust merged, d5da332). tsc clean, 464 tests pass (3 new in `src/tests/t107-week-honest.test.ts`), build OK, t067 ALL PASS.

## 1. Week grid
- New `src/services/weekCell.ts`: `weekCell(dayRange, unit)` returns the cell: `{kind, label, loFt, hiFt, centralFt, spreadLoFt, spreadHiFt, spread, midday}`. The cell is the day's TYPICAL (midday) range, i.e. `dayRange(...).typical`, not the min-of-lo / max-of-hi envelope. `spread` = "ranges 4–22 ft over daylight" (offshore: "... offshore over daylight"), shown in the cell's `title` and the aria text. Offshore-only and no-data states kept (offshore cell shows the midday offshore value, muted; none shows "—").
- `DayTypical` gained **`centralFt`** (the midday hour's central surf height; offshore height for offshore days). **Field for the glyph: `weekCell(c.dr, unit).centralFt`** (also on the span as `data-central-ft`); `typical.hour` and `typical.atIso` are unchanged (product's T-106 reads `c.dr.typical.hour.surf.headline`).
- `WeekGrid.tsx`: only the import, the `wc`/`label`/`aria` lines and the `wk-h` span changed. The row curve (`pts`/`segPaths`) is untouched so product's removal of it merges cleanly; I am NOT removing it.
- Test (Ocean Beach, swell swinging 0.4 to 4 m): the day envelope is wider than the midday estimate and the cell equals the midday range; offshore and none states.
- Browser: Home at 1440: Ocean Beach 8–12, 8–12, 6–10, 9–14, 8–15, 8–16, 9–21; tooltips like "midday 12p; ranges 6–12 ft over daylight". The widest cell (a 12 ft spread) is a big-swell day's own midday estimate. Screenshot scratchpad `t107-home.png`.

## 2. "Stale estimate" on Best right now nearby: a wrong clock, not a different rule
`bestNearbyAt` called `dashCard(s, records, t, ...)` where `t` is the RANKED hour (the top of the current hour, 3 h ahead, or tomorrow 7 AM), and `dashCard` used that same value as the clock for the T-084 freshness rule. With a forecast retrieved 12:08 and "now" taken as 12:00, the retrieval read as >5 min in the future → "stale estimate"; for later hours it read as >2 h old. (It also gave lead time 0 to the uncertainty band for tomorrow's hours.) Fix: `dashCard(spot, records, at, profile, ctx, clockMs = at)`; `bestNearbyAt` passes the real `now` as `clockMs`, so the rule, the rating and the lead time use the real clock while the hour still picks the record. Test: fresh data, `now` and `tomorrow-am` rows are 'model estimate' (fails with "stale estimate" without the fix). Browser at fresh data (header "Model data · 12:19 PM"): the three nearby rows read "model estimate".

## Checks / environment
journeys: 8/8 on the lead's :5180 earlier; on my :5185 journey 7 fails only on the 3D label (this worktree has no `public/media/scale3d-live/*.glb`: they are git-ignored local assets, so the live 3D does not mount here and the old spin view shows). Not caused by this change. I made journey 7 wait up to 20 s for the label (backup `journeys.mjs.pre-t107`).
