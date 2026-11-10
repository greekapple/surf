# DRAFT: nearshore model wiring outside CDIP MOP

Status: draft for the lead, not approved. Source study: [`docs/research/NEARSHORE-MODELS.md`](../research/NEARSHORE-MODELS.md) and [`docs/research/data/nearshore-coverage.csv`](../research/data/nearshore-coverage.csv) (2026-11-10). Nothing here is wired yet.

## Goal
Give spots without a CDIP MOP point a real nearshore model height, used the same way MOP is used today (`src/ocean/mop.ts` → `src/services/headlineSurf.ts` → `src/services/breakingV2.ts`):
- **Phase 1: Hawaii (152 spots) from PacIOOS SWAN** (~500 m, ERDDAP JSON, no decoding).
- **Phase 2: Atlantic, Oregon/Washington and the 13 California spots without MOP from NWS NWPS** (NOMADS; text point files first, GRIB nests second).
- Every value is labelled as a model at a named point, with source, run time and point depth. No value is estimated, interpolated in time, or shifted. A spot with no reviewed point keeps today's behaviour (v1 offshore rule or the labelled offshore height).

## Level and owners
- Level 3: two new external sources, a new Worker reader, new labels, attribution, about 400 spots touched. Data-honesty review required before merge (`data-honesty-reviewer`), then the normal merge gate.
- One implementation owner per phase (engineering). Point selection (step 2) is data work and can run in parallel with the reader.

## Phase 1: PacIOOS SWAN, Hawaii

### 1. Point table (sourced, then reviewed)
- New `src/ocean/nearshorePoints.ts`, generalising `MopAssignment`: `{spotId, source: 'cdip-mop' | 'pacioos-swan' | 'nwps', pointId, lat, lon, depthM, depthSource, shoreNormalDeg, status: 'sourced' | 'owner-reviewed', provenance, caveat?, retrievedOn}`. MOP rows keep working unchanged (adapter, or MOP moves in later; no behaviour change for the 75 MOP spots).
- `pointId` for SWAN = `swan_<island>:<lat>,<lon>` of the cell centre exactly as ERDDAP returns it.
- Generator script (`scripts/nearshore-scan.mjs`, like `scripts/mop-scan.mjs`): for each Hawaii spot, list wet cells within 1.5 km of the pin from the island's `shgt` field, read each cell's depth from `hmrg_bathytopo_50m_mhi` (one ERDDAP request per cell, ≤1/s, cached in `docs/forecast/data/nearshore-candidates.json`), and propose the cell that is (a) seaward of the pin along the spot's facing (`seaward` / breaking-profile facing), (b) 8–20 m deep on the 50 m bathymetry, (c) nearest such cell. If no cell meets (b), propose none and say why; never fall back to a shallower or land-adjacent cell silently.
- Rows land as `status: 'sourced'` with `provenance: "chosen by the depth-and-facing rule from PacIOOS SWAN cells; not reviewed"`. Owner review moves a row to `owner-reviewed`, as for MOP.
- The depth shown is the 50 m bathymetry value at the cell centre, labelled "depth at the point from UH/PacIOOS 50 m bathymetry; the model cell averages about 500 m". Shore normal comes from the spot's breaking profile facing; if the profile has none, the spot gets the point's own height only (no breaking rule), as MOP's refused spots do today.

### 2. Worker reader
- New targets in `services/forecast-service.mjs`, one per distinct point (spots sharing a cell share a key): `nearshore-swan-<island>-<i>-<j>`, ttl 3 h, JSON.
- URL: `https://pae-paha.pacioos.hawaii.edu/erddap/griddap/swan_<island>_lon180.json?shgt[(<now-6h>):1:(last)][0][(<lat>)][(<lon>)],pper[…same…],pdir[…same…]`. Lat/lon are the cell centre, so ERDDAP snaps to that exact cell. About 150 rows × 3 variables per request (~10 KB).
- New-run detection: one request per island to `…/info/swan_<island>/index.json` (or the `time[(last)]` axis) per refresh tick; refetch an island's points only when `time_coverage_end` advances. Record the new `time_coverage_end` as the run marker shown on screen ("PacIOOS SWAN run ending <date>"); PacIOOS publishes no issue time, so do not invent one.
- Budget: ≤ ~150 point requests per new run (fewer after de-duplication), spread over the 5-minute cron within the existing subrequest budget (`worker/cloudflare.mjs` CRON.budget 800). Cold points fetch on demand like other per-spot targets (`hotHours`).
- Parser `normalizeSwanPoint(json, retrievedAt, url, point)` → `NearshoreRecord[]` (existing type in `src/ocean/nearshore.ts`, plus `source` and `pointId`): metres → feet with the existing helpers; NaN rows dropped (never filled); `qualityFlag` 1 only for finite values; `product: 'forecast'` for hours after retrieval, `'model-past'` for earlier hours (SWAN's own past hours are model output, not observations — never call them a nowcast).

### 3. Headline and breaking rule
- `headlineSurf.ts`: where it now asks `assignmentFor(spotId)` (MOP), ask the generalised point table; MOP wins where both exist (no Hawaii overlap today).
- Hour selection: the existing `pickMop` rule (nearest step within half a step; hourly here, so 30 min), no interpolation.
- Breaking rule: `estimateBreakingV2({hsFt, periodS: pper, directionDeg: pdir, depthM, shoreNormalDeg}, breakingProfile(spotId))`, the same call MOP feeds. `method: 'nearshore-v2'` (new enum value) so the intervals and How-right can tell the sources apart. Interval: until calibrated (step 5), use the existing `intervalFor` with the MOP component and say "uncalibrated for this source" in the method line.

### 4. Labels and attribution
- Method line: "Surf height from the PacIOOS SWAN nearshore model at a point <d> m deep, <km> km from the spot (University of Hawaii; model estimate, unvalidated)". Nearshore panel: point position, depth and its source, run marker, and the caveat "a 500 m model cell, not the break".
- Credit line (licence asks for acknowledgement): "Nearshore model: PacIOOS (UH SOEST, NOAA IOOS), SWAN regional wave model".
- Never "measured", never "nowcast", never "at the break".

### 5. Calibration through How-right
- Before any spot score: score the source **at a Hawaii buoy** with the existing harness rule "model right AT the buoy" (bias ≤ 0.5 ft, average miss ≤ 1 ft, ≥ 200 hours over the window's first 2/3). Use the SWAN cell that contains each CDIP Hawaii buoy and the buoy's QC'd hourly Hs (NDBC realtime2 or CDIP). Publish the table in `docs/forecast/HOW-RIGHT.md` before switching spot scores on.
- Spot scores: as today ("our forecast ≥12 h ahead" vs the buoy carried to the point), with the carry factor taken from **the same source's own** ratio (SWAN point ÷ SWAN buoy cell, hourly), exactly as MOP's ratio is used. The data-honesty P0 of 2026-11-07 applies: no nowcast-versus-carried-buoy score.
- Spots whose buoy fails the at-buoy check show "no buoy can check this spot this month" with the reason, as now.

### Acceptance (Phase 1)
- Reader: unit tests on a saved ERDDAP JSON (finite rows kept, NaN dropped, units, times untouched); a test that keys match the point table.
- At least 10 Hawaii spots across 4 islands show a nearshore height with the PacIOOS label, point depth and run marker in a real browser at 1440 and 390; a spot whose scan found no 8–20 m cell shows today's fallback with the reason.
- The at-buoy table exists for every Hawaii CDIP buoy with ≥200 hours, before any spot score is shown.
- Data-honesty review passes.

## Phase 2: NWPS (Atlantic, Oregon/Washington, California without MOP)

### 6. First reader: CG1 point files (no GRIB)
- Rip file `nwps.t{CC}z.5m_cg1_ripprob.{wfo}.txt`: 145 hourly rows per point along the **5 m** depth contour (`Hs`, `pp`, `mwdsn`, rip probability, tide). Reach: 99 of 265 non-Hawaii spots within 500 m, 215 within 1 km.
- Runup file `nwps.t{CC}z.20m_cg1_runup.{wfo}.txt`: shoreline points "projected from the 20m contour" with Hs and peak period. **Before use**, confirm with NWPS/NCO (contact in SCN 26-91) that its Hs is the 20 m-contour value; if confirmed, it is the better input for the breaking rule (known depth 20 m, pre-breaking), and the 5 m value becomes a cross-check only.
- Why not the 5 m value as the headline: at 5 m, larger swells are already depth-limited in SWAN, so the value is not comparable with MOP's 10–15 m point. It may be shown as its own labelled line ("NWPS height at the 5 m depth line").
- Reader: a cron job per WFO per new cycle downloads the file (1–9 MB rip, 0.6–21 MB runup), keeps only the rows for points in the point table, and writes one small JSON per point to R2. Per-cycle volume for the ~19 WFOs with SWELLO spots: ~70 MB rip, more with runup. CPU: parsing a 21 MB text file may exceed the Worker CPU limit; measure, and if it does, use HTTP `Range` reads (fixed-width rows: 93 bytes in the rip file, 322 in runup) from offsets recorded per point when the table was built, re-validated every cycle (MLB has rows of 144–146 per point, so offsets must be checked, not assumed).
- New-cycle detection: list `{region}.YYYYMMDD/{wfo}/` (one request per WFO per hour); cycles are on demand (00/06/12/18, plus odd ones like PQR 14Z), and files land 3.7–7.6 h after cycle time.
- NOMADS over HTTP/2 returned a malformed `content-length` header to curl; test Worker `fetch` against NOMADS first.

### 7. Second reader: GRIB nests via the NOMADS grib filter
- For spots with a nest cell within 500 m (79 non-Hawaii spots), request `filter_{region}nwps.pl` with `var_HTSGW`, `var_PERPW`, `var_DIRPW`, `lev_surface` and a box of a few cells round the chosen point: tested 81,659 bytes for 3 × 145 messages.
- Decoder: hand-written GRIB2 reader for template 3.0 (regular lat/lon), 5.0 (simple packing) and the bitmap; the HFO file checked is `grid_simple`. Refuse (no value) on any other template; NCEP warns content order and scaling can change.
- Grid layouts changed on 2026-11-09 (v1.5). The point table records grid id, Ni/Nj, first/last point and increment; the reader refuses a file whose grid header differs and flags the point for re-selection.

### 8. Point selection, labels, calibration (as Phase 1)
- Same generalised table, `source: 'nwps'`, `pointId: '<wfo>:<cg>:<lat>,<lon>'` or `'<wfo>:5m:<lat>,<lon>'`.
- Depth: 5 or 20 m for the contour files (by definition of the product); for GRIB cells, a sourced bathymetry value (NOAA NCEI Coastal Relief Model; endpoint not yet tested) or no breaking rule.
- Label: "Surf height from the NWS Nearshore Wave Prediction System (WFO <MHX>, run <12Z Nov 10>, <grid / 20 m depth line>), a forecaster-driven model; model estimate, unvalidated". The office and run time are always shown because each WFO drives its own run.
- Calibration: at-buoy check first, using buoys that NWPS itself outputs spectra for (e.g. MHX lists 41025, 41159, 44056, 44095, 44100) and other CDIP/NDBC nearshore buoys chosen by the existing harness rules; then spot scores with the same-source carry ratio.

### Acceptance (Phase 2)
- Same shape as Phase 1, plus: a test that a changed grid header or a missing cycle leaves the previous run labelled with its own run time (or no value after it ages out), never a mixed run.

## Not in scope
- Rip-current probability as a product (it is in the same file; separate decision, with its own honesty review).
- Puerto Rico / USVI (CariCOOS works, no spots yet), Guam, Alaska.
- Replacing MOP anywhere it exists.

## Decisions for the user
- None blocking Phase 1: PacIOOS asks for acknowledgement only. The credit line wording above is the only visible addition.
