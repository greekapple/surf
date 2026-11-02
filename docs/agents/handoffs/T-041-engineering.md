# T-041 Engineering handoff: rating v2 Phase 1 (inputs and plumbing)

Branch `worktree-engineering` (synced with `rebuild/swello-v0.16` first). Per plan `docs/forecast/RATING-V2-PLAN.md` §7 Phase 1 and the user's decisions D-1..D-4. **No rating changes, no new accuracy claims.**

## Milestone 1: MOP registry, ingestion, archiving
- `src/ocean/mop.ts` (new): registry of MOP points (measured metadata), **assignments** (only SF023 → Ocean Beach, status `sourced`) and **candidates** (Linda Mar SM375/SM376, Bolinas MA140; not used by the app until the owner reviews them). URL builders for the forecast (3-hourly, ~10 days) and nowcast, DAS URL, `parseMopDas` (issue time, coverage, run start, only if the file states them).
- `scripts/mop-lookup.mjs` (new) + `docs/forecast/data/mop-candidates.json`: measured nearest MOP points per spot, read from each CDIP file. **Correction to the plan:** Linda Mar's nearest points (SM375/376) are **15 m deep, not 10 m**, and their shore normals (320°–350°) differ strongly between neighbours; Bolinas's nearest (MA140…) is 2.8 km away at 15 m with a south-facing normal (~170°). Neither can be assigned without review.
- `src/ocean/nearshore.ts`: normalizer now handles the forecast product too (`product`, `mopId` on each record; QC 1 only; missing values stay null; native provenance kept).
- `src/ocean/pipeline.ts`, `types.ts`: `bundle.mop[<id>]` = forecast records + file issue/coverage times + retrieval time.
- `src/ocean/server.ts` + `services/forecast-service.mjs`: two new fixed server targets per assigned id (`nearshore-<ID>-forecast`, `nearshore-<ID>-das`; 1 h TTL). The service's existing refresh already stores an immutable snapshot of every target per retrieval (`forecast/v10/snapshots/<key>/<retrievedAt>.json`), so **forecasts are archived on the deployed Worker when R2 is bound** (no other change to the service). `mopServiceIds` is kept in sync with the registry by a test.
- `scripts/mop-archive.mjs` (new): local archive of each forecast by its own issue time into `data/archive/mop/<ID>/` (gitignored), for use without R2.
- Tests: `src/tests/mop.test.ts` (new, 7), two existing tests updated for the target count (+2) and a `.das` response in the refresh fixture. `tsc` clean; **233 tests pass**.

## Shared files touched (please confirm)
`services/forecast-service.mjs` (additive: `mopServiceIds`, two targets, `model`/`das` handling), `src/tests/service.test.ts`, `src/tests/v10.test.ts` (count only), `.gitignore` (`/data/archive/`).

## Limits
- Update cadence of the MOP forecast is not stated by CDIP; the card will show the file's own `date_issued`, not an assumed schedule.
- Only SF023 is ingested; the candidates are not (they would be archived the moment the owner approves them).

## Milestone 2: nearshore card on real MOP data
- `src/features/forecast/Nearshore.tsx` (new, mine): `NearshoreCard`. Reads the reviewed assignment, shows Hs at depth, Tp and direction, the point id, depth, **product** (Nowcast for past hours, Forecast for future hours), valid time, the forecast file's own **issue time**, retrieval time, shore normal, "Modeled Hs at depth, not surf height" and the CDIP/USACE acknowledgement. Spots without a reviewed point say so and name the candidates waiting for review (Linda Mar, Bolinas); nothing is substituted.
- `src/services/nearshoreSelect.ts` (new): `pickMop` chooses the record for the selected hour (nowcast within 30 min, forecast within 90 min, no interpolation, refuses outside coverage). Tests in `src/tests/nearshore-select.test.ts`.
- **ForecastView mount (the one change in a shared file):** `src/features/forecast/ForecastView.tsx` line 326, `<Nearshore spot=…>` → `<NearshoreCard spot=…>`, plus one import line (`import {NearshoreCard} from './Nearshore';`). The old in-file `Nearshore` function is now unused; I left it for product/lead to delete with the rest of their ForecastView work.
- Verified: `t041-nearshore.mjs` ALL PASS at 1440 and 390 on live data (Sun now → Nowcast/Forecast labels, day+2 → forecast with issue time, Linda Mar unassigned message, no overflow, no console errors); `t034-density` ALL PASS; tsc clean; 236 tests pass. Shots: toolkit `artifacts/t041/{1440,390}-{ob-now,ob-day2,lindamar}.png`.
