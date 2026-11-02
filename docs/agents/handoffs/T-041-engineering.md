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

## Milestone 3: breaking estimate v2 behind a flag
- `src/ocean/breakingEstimate.ts`: v1 untouched; added `estimateBreakingV2` (CDIP MOP height at depth carried to the break by linear shoaling + Snell refraction on straight contours, breaker index 0.78, same unvalidated 0.7–1.4 face factors, **no manual shelter factor**), `wavenumber`, constants, method string `v2-experimental`. Same refusals as v1 plus `no-break`.
- `src/services/breakingV2.ts`: `breakingV2Enabled()` (**off by default**; on only with localStorage `swello-flag-breaking-v2`=`on` or `VITE_BREAKING_V2=on`) and `mopBreaking()` (only for the spot's reviewed MOP point).
- Surface: when on, the nearshore card adds one line "Experimental, off by default (v2-experimental): Est. X–Y ft at the break … Unvalidated; not used in the rating." Headline heights and ratings are identical on and off (checked).
- Tests: `src/tests/breaking-v2.test.ts` (8: dispersion limits, γ·h at the break, refraction, monotonic, refusals, v1 unchanged, flag semantics). **244 tests pass**, tsc clean, build ok (117 assets).
- Consistency (`docs/forecast/T-041-v2-consistency.md`, `docs/forecast/data/compare-v1-v2.ts`): on 1,068 archived hours v2/v1 median ratio 1.01 (10th–90th 0.88–1.21), ranges overlap 100%. This is **consistency, not validation**. v2 estimates 269 hours v1 refuses because MOP has no swell/wind-sea partition (also a weakness).
- Browser: `t041-flag.mjs` ALL PASS (off: nothing added; on: labelled range; headline text identical; no overflow at 390).

## Milestone 4: Pillar Point and Point Reyes tide stations
- `src/ocean/tideStations.ts` (new): registry of the three CO-OPS stations (San Francisco 9414290, **Pillar Point Harbor 9414131**, **Point Reyes 9415020**; positions from the CO-OPS metadata API), `tideAssignments` (**empty**: a spot uses a new station only after the owner approves it), `nearestTideStations` for the review list. The existing San Francisco rule for SF-area spots is unchanged.
- `src/ocean/noaa.ts`: `tideURL`/`tideExtremaURL` take a station (default SF); normalizers read the station from the URL and label it ("Pillar Point Harbor station 9414131; station tide, not a beach tide"); SF wording is unchanged.
- Server: fixed keys `tides-<id>` / `tide-extrema-<id>` (service targets +4, so they are cached and archived like the rest); only registered stations are proxied, and water level stays SF-only. Pipeline fetches both into `bundle.stationTides`, not displayed anywhere yet.
- Tests: `src/tests/tide-stations.test.ts` (5); target counts in two existing tests updated. **249 tests pass**, tsc clean.
- Browser: `t041-tides.mjs` ALL PASS (both stations answered 200 for hourly and high/low; Ocean Beach tide still "Tide +2.0 ft falling"); `t031-firstview` ALL PASS.
- Nearest stations (for review, M5): Linda Mar → Pillar Point (≈11 km, SF ≈23 km). Bolinas and Point Reyes are both far (≈23–27 km); no pick without review.

## Milestone 5: spot profile schema, registry, and the review list for the user
- `src/ocean/spotProfile.ts` (types per plan §3: `Sourced<T>` = value/status/sources/reviewedBy/reviewedOn/note + **`proposal`**), `profileProblems` (rules enforced by test: a value needs a status above unknown and a source; `owner-reviewed` needs reviewer and date; no `measured`/`validated`; no calibration before validation), `lowestStatus` (a factor may rely only on the lowest status of its fields; unknown = no score).
- `src/ocean/spotProfiles.ts`: registry for the three core spots. **Values only where a published source exists** (Ocean Beach MOP SF023 / orientation 263.49° from CDIP file metadata, Ocean Beach hazards from NPS, Bolinas hazards from Marin County). Everything else is null. Drafts and assumptions live in `proposal`, never in `value` (D-2: unreviewed stays null).
- **`docs/forecast/SPOT-FACTS-REVIEW.md`** (generated by `docs/forecast/data/build-spot-review.ts`; a test fails if it drifts): per spot a table of fact / recorded now / proposed / evidence with citation and quote / tick-box decision; then the MOP candidates (SM375, SM376, MA140 with depth, shore normal, distance) and nearest tide stations per spot, each with a decision box.
- **What the research found (honest):** published agency/peer-reviewed sources give surf-specific facts almost nowhere. Only two things were citable: USGS Hansen et al. 2013 and Barnard et al. 2012 (mobile transverse bar, varying nearshore bathymetry at Ocean Beach), used for a *proposal* "sand bar, mobile" labelled as inference. Swell window, period, size band, tide window and wind tolerance for all three spots have **no acceptable source** (the only places that state them are commercial surf sites, excluded by the plan), so those rows ask for the owner's local knowledge. I did not use or copy any commercial content. A CDFW Duxbury Reef sheet was found but its text could not be read, so it is not cited.
- Existing assumption flagged: the experimental v2 and the live v1 breaking estimate use T-008's Ocean Beach window (normal ±60°) and 8 s minimum; they appear as proposals so the owner can approve or replace them.
- Tests: `src/tests/spot-profiles.test.ts` (6). **255 tests pass**, tsc clean.

## Milestone 6: in-app session log (ground truth, D-3)
- `src/services/sessionLog.ts` (new): validated observation = spot, when surfed (not future, not >1 year), **face height range in feet (trough to crest, never Hawaiian scale)**, wave quality 1–5, optional bar note (≤200 chars). Refuses instead of repairing; malformed stored records are dropped; refused writes are reported. Stored locally (`swello-session-log`), never uploaded. JSON and CSV export (header states the quantity). Tests: `src/tests/session-log.test.ts` (4).
- **Beside each observation the app stores its own numbers for that time**, for later comparison only: the MOP record (id, product, valid time, Hs/Tp/Dp) and, when the logged time is within 90 min of the loaded forecast hour, the headline height *with its label* (e.g. "≈ 5 ft (Offshore significant wave height)") and the app's breaking-estimate range if one existed.
- UI (my T-037 Personal files): the Log form gains "Check the forecast (optional)" (when, smallest/biggest face in your unit, wave quality 1–5, bar note); Data & privacy shows the count, the last five observations with Remove, and Export observations (JSON/CSV). An invalid entry shows its error and logs nothing.
- Review list update (asked by lead): the tide table now states **Linda Mar → Pillar Point Harbor (9414131), 11 km, proposed**; Ocean Beach → San Francisco (existing rule) proposed; Bolinas has no station within 15 km so none is proposed. MOP candidates with depth and normal were already in the sheet.
- Checks: tsc clean, **259 tests pass**, build ok; `t041-sessionlog.mjs` ALL PASS at 390 and 1440 (reversed range refused, valid stored with MOP context, exports, reload, remove); `t034-density` ALL PASS; `t037-flow` ALL PASS; `journeys` 8/8.

## Phase 1 summary
No rating changes, no new accuracy claims. Nothing validated. Open for the user: approve rows in `docs/forecast/SPOT-FACTS-REVIEW.md`; confirm Open-Meteo commercial plan before launch (D-1).
