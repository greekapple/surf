# Spot-oriented forecast and rating, v2: plan (T-040)

Author: engineering (Sonnet), 2026-10-31. **Plan only. No code until the user approves.**
User brief: "forecasting way more accurate: real ocean and wind data compared to the exact spot and sand bars … the rating spot-oriented, not just swell".

Evidence tags used throughout: **[repo]** read in this repository today · **[live]** checked against the provider today (2026-10-31, queries listed in Appendix A) · **[docs]** stated on the provider's page · **[G]** general knowledge, to be re-checked before it is relied on · **[U]** unknown.

## 0. Summary and decisions needed

1. **The main lever exists and works.** CDIP's MOP (Monitoring and Prediction) system gives **3-hourly, 10-day wave forecasts at 10 m depth for 6,358 alongshore points** on the US West Coast, as the same file type we already read for Ocean Beach (SF023 nowcast). Forecast files are published for *every* point [live]. They take direction and bathymetric refraction into account from a 10 m-depth point, which the Open-Meteo marine grid (about 8 to 25 km) cannot. We only use one nowcast point today, and nothing in the UI reads it (T-004 defect D1).
2. **What it will and will not give us.** It gives a better *nearshore wave height, period and direction at the spot's transect* than regional grids. It does **not** give breaking-wave face height, bar position, or surf quality. Those remain estimates and must stay labelled.
3. **The rating cannot become "accurate" without observations.** Today every weight and cap is a product rule. The plan therefore has two tracks that run in parallel: (A) better inputs this week; (B) start collecting paired observations now, because validation needs weeks of data before any claim can change.
4. **Sandbars cannot be known in real time from free data.** Sections 2.7 and 6 say exactly what exists and what cannot be known. v2 treats bars as an uncertainty widener, not an input.
5. **No spot fact is invented.** Every profile value carries a source and a review status; unknown stays `unknown` (section 3).

Decisions needed from the lead or user (details in section 8):
- **D-1 Licence:** Open-Meteo's free tier is for non-commercial use; "websites or apps that have subscriptions or display advertisements" count as commercial [docs]. If SWELLO will ever be commercial, budget a paid plan or move wind to NOAA directly.
- **D-2 Who reviews spot facts** (the owner? a local surfer?) and what counts as an acceptable source.
- **D-3 Observation protocol:** approve a short in-app session log (face height range and quality, optional bar note) as the validation ground truth. No scraping of commercial surf reports.
- **D-4 Scope of "this week"** (section 7, Phase 1).

## 1. What exists today (built on, not replaced)

| Piece | File | What it does | Status |
|---|---|---|---|
| Offshore swell, wave and SST | `src/ocean/openMeteo.ts` | Open-Meteo Marine per spot, one point about 9 km offshore; primary and secondary swell Hs/Tp/Dp, combined Hs, hourly, 7 days | Live for 45 spots. Regional grid, not nearshore. |
| Wind | same | Open-Meteo Weather at the shore point: 10 m speed, direction, gust, hourly | Live. Model not selectable in code (default "best match"). |
| Nearshore model | `src/ocean/nearshore.ts`, `coastal.ts` | CDIP MOP **SF023 nowcast only** (QC primary = 1), Ocean Beach only; metadata for SM406 (not fetched) | Fetched into `bundle.nearshore`; **not used by any rating or UI**. |
| Tides | `src/ocean/noaa.ts`, `pipeline.ts` | CO-OPS 9414290 (San Francisco) predictions, hi/lo and latest water level; used only for spots "near San Francisco"; other coasts get no tide | Regional reference, labelled. |
| Buoy | `src/ocean/noaa.ts` | NDBC 46026 realtime2 + saved snapshot | Context only. |
| Breaking estimate | `src/ocean/breakingEstimate.ts`, `localCalibration.ts` | v1: Komar–Gaughan breaker height from *offshore* primary swell with Kd = √cos Δ and a fixed shelter factor, times fixed 0.7 to 1.4 face factors; refuses outside a spot window / under a minimum period / wind-sea dominant | **Ocean Beach only**, window 203–323°, minPeriod 8 s, shelter 1 (lead-set). Never fed to ratings (only to Board Match and labelled ranges). |
| Validation of v1 | `docs/forecast/T-008-validation.md`, `docs/forecast/data/` | 1,068 paired hours, estimator vs MOP SF023 Hs: bias +1.38 ft, MAE 1.47 ft, range covers MOP Hs 92% | Validates only offshore→10 m, **not** breaking face. No face observations exist. |
| Rating | `src/ratings/provisional.ts`, `src/ocean/quality.ts`, `src/ratings/engine.ts` | (a) *provisional* offshore potential, capped at SOLID (74) when orientation unknown, never above 94; (b) *evidence* SQI with five factors: swell alignment .25, wind .25, tide .15, size .15, organization .20; (c) `rateQuality` interaction caps (weak potential, poor wind, poor tide, EPIC needs HIGH reliability) | Weights and caps are product rules, not fitted. The evidence SQI cannot score most spots, because `idealSwell`, `tidePreferences`, `faceRange`, `organization` are null. |
| Evidence contract | `src/ocean/calibration.ts`, `src/services/verification.ts` | `SpotCalibration` with null swell windows, wind directions, tide sensitivity; a forecast-vs-observation pairing function (same quantity, ≤ 5 km, ≤ 1 m depth, ≤ 10 min) | Contract exists; **no spot has data in it**. |
| Spot facts | `src/ocean/spots.ts`, `src/data/coast.ts` | Orientation (OB 263.49° from SF023; Bolinas and Linda Mar null), 42 coast rows with an *approximate* `seaward` direction ("the approximate direction the beach faces") and generic defaults | Coast rows are explicitly generic and unreviewed. |

Principle: keep the five-factor structure and the cap logic and the refusal behaviour; change what feeds them, add a per-spot profile, add uncertainty, and stop at the honesty rules in section 6.

## 2. Data sources per input

### 2.1 CDIP MOP nearshore points (the main lever)

| | |
|---|---|
| What | Spectral wave model output at points 100 m apart along the coast, at about 10 m depth. Linear spectral refraction (no breaking, no diffraction), initialised from directional buoys; the forecast version is driven by NOAA WaveWatch III (the forecast dataset's history shows `WW3_forecast.INPUT`, `-h 240`). [docs]/[live] |
| Products | `MOP_alongshore/<ID>_nowcast.nc`, `_forecast.nc`, `_hindcast.nc` exist for all 6,358 IDs [live]. |
| Variables | `waveHs`, `waveTp`, `waveDp`, `waveDm`, `waveTa`, `waveMeanDirection`, full directional spectrum `waveEnergyDensity` with Fourier coefficients `waveA1/B1/A2/B2`, radiation stress `waveSxx/Sxy`, QC flags `waveFlagPrimary/Secondary`, `waveModelInputSource`, `waveModelBinInputCoverage`; metadata `metaWaterDepth`, `metaShoreNormal` [live]. |
| Resolution | Time 3-hourly [live: `time_coverage_resolution PT03H00M`]. Space: 100 m along the coast, **one point per transect at the 10 m contour**, i.e. before the final shoaling/breaking over the bar or reef. |
| Latency / horizon | Forecast runs cover about 10 days; a request for 7 days returned 56 rows at 3-hourly steps [live]. Update cadence not stated on the pages we read **[U]**; it is read from each file's `history` / `time_coverage_end` at ingest. Nowcast is hourly in the file we use today [repo]. |
| Licence | Free over THREDDS; CDIP asks for an acknowledgement ("CDIP is primarily supported by the U.S. Army Corps of Engineers (USACE)"; creator Scripps Institution of Oceanography, UCSD) [live]. No separate machine-readable licence found; **we must show the attribution and not cache-and-resell the data** [G]. Re-check the CDIP data-use page before launch. |
| Verified for our spots today | SF023 (Ocean Beach, 37.748, −122.518, 10 m, normal 263.49°, "shore type 2, complex bathymetry") [docs]. Candidates found by sampling the forecast files [live]: Linda Mar **SM375 (37.599, −122.516)** and **SM380 (37.607, −122.513)**; SM406 (37.635, −122.509) is about 4 km north and stays *unassigned*. Bolinas: **MA145–MA155 (37.883…37.875, −122.673…−122.693)** are the nearest sampled points; the exact transect for the Bolinas break is **[U]** and needs the lookup script in Phase 1. |
| Limits (honest) | (1) Linear refraction: no diffraction around headlands or reefs, no wave–current interaction, no breaking. Sheltering by Duxbury Reef or the Farallones comes only through the bathymetry already in the model [G]. (2) 10 m is not the surf zone: at a beach break the bar, not the 10 m contour, sets where and how waves break. (3) Forecast skill is bounded by the WW3 boundary forecast. (4) Output is Hs/Tp/Dp, not surf height. (5) MOP points for coves and bays (Bolinas, Linda Mar) can sit in different local wave conditions than the beach; each assignment must be reviewed, never "nearest wins" silently. |

### 2.2 Buoys (observations)

| | |
|---|---|
| NDBC | 46026 (SF, about 18 NM west) already read; 46013 and 46214 also respond on `realtime2` today [live: HTTP 200]. Public NOAA data; hourly standard-met text; latest value per variable within 24 h; the app already labels each value with its own time. Free, no key, public domain [G]. Context and *validation* only: offshore buoys are not a spot input. |
| CDIP buoys | The directional buoys that initialise MOP are named per record in `waveModelInputSource`; use that variable, not a remembered list. CDIP observed spectra are the best truth for the offshore→10 m step. |
| Limit | Buoy DPD (dominant period) and Open-Meteo swell period are different statistics (T-004 D4); never mix without a label. |

### 2.3 Tides (CO-OPS)

| | |
|---|---|
| Source | NOAA CO-OPS Data API, `predictions` (hourly and hi/lo) and `water_level` (observed), datum MLLW, JSON. Public domain, free, key-less [G]. Latency: predictions are astronomical (available for the whole horizon); observations about 6-minute data, a few minutes behind [G]. |
| Stations [live] | San Francisco **9414290** (used today), **Pillar Point Harbor 9414131** (37.502, −122.482), **Point Reyes 9415020** (37.994, −122.974), Santa Cruz **9413745** (36.958, −122.017, subordinate station) all return predictions today. |
| Plan | Assign each spot's tide station by distance *and review*, label it as a station ("Pillar Point station, not the beach tide"), and show nothing where no review exists. Today non-SF coasts get *no* tide (`nearSanFrancisco` gate), which is honest but loses information. |
| Limits | Harmonic prediction excludes weather surge; the station is in a harbor or bay, so the tidal *phase and range at the beach* differ by tens of minutes, and local tide response of a break is a profile value, not a station value. |

### 2.4 Wind

| | |
|---|---|
| Primary | Open-Meteo Weather, 10 m wind and gust, hourly. "Best match" combines DWD ICON, NOAA GFS and ECMWF IFS, with **NOAA HRRR added over North America** (highest resolution wins per variable and hour) [docs]; HRRR is 3 km hourly [G]. Licence: data CC BY 4.0; free tier non-commercial only (see D-1) [docs]. |
| Alternative | NOAA HRRR/NAM from NOMADS or AWS Open Data (public domain, GRIB2, need server-side extraction): more control and no commercial restriction, more engineering. Only if D-1 forces it. |
| Observed wind | Coastal NDBC/C-MAN stations and airport METARs nearest each spot, for verification and a nowcast correction; stations to be selected and checked in Phase 2 **[U]**. |
| Limits | 3 km does not resolve cliffs, valleys and gaps; coastal wind at the break routinely differs from the grid cell. 10 m wind over land cells at the shore point may not represent over-water wind. These are real accuracy limits, and the wind factor must carry them. |

### 2.5 Regional wave models (fallback and context)

Open-Meteo Marine is the current offshore source: MFWAM 0.08° (~8 km), ECMWF WAM 9 and 25 km, GFS Wave 0.16/0.25°, DWD models; the page says "accuracy at coastal areas is limited" and warns against coastal navigation use [docs]. It stays as (a) the fallback for spots with no accepted MOP point, (b) the wind-sea/swell split check, (c) secondary swell where MOP flags are poor. NOAA NWPS (SWAN, regional grids, e.g. MTR) is a possible later source for Bolinas-type coves; coverage not verified **[U]**.

### 2.6 Bathymetry (NOAA CUDEM / CRM)

| | |
|---|---|
| CUDEM | NOAA NCEI Continuously Updated DEM, **1/9 arc-second (about 3 m)** bathymetric-topographic tiles in 0.25° tiles, California tiles on NOAA's Office for Coastal Management bucket (2022–2023 versions seen near San Francisco), updated tile by tile; free, US-government data; "not suitable for navigation" [docs]. Vertical datum per tile **[U]** until a California tile's metadata is read. |
| CRM | NCEI Coastal Relief Model, coarser (about 30–90 m) [G]. Fallback only. |
| What it is good for | Static descriptors per spot: depth at fixed distances along the MOP transect, mean slope from 10 m to 2 m, presence of a reef or headland within a few km, the depth gradient that controls the breaker index. These can fill `bottom.bathymetry` and bound the breaker index range. |
| What it is not | It is **a composite of surveys of different dates**; on a sandy coast the surf-zone depths are only as good as the last survey, and bars move at weekly to seasonal scales. CUDEM is **not** a current bar map. |

### 2.7 Sandbars: what exists, and what cannot be known

| Exists | Limit |
|---|---|
| Lidar/sonar surveys folded into CUDEM and USGS/NOAA datasets. | Dated (often years apart); no free operational product gives today's bar position at our spots. |
| Ocean Beach research record: the USGS Coastal Processes Study (2004–2006, Open-File Report 2007-1217) and a Cliff House camera with timestacks, Oct 2004 to Dec 2008; Argus-type video can infer bar position from preferential wave breaking [docs]. | Historic, research-grade, Ocean Beach only; not an operational feed. Sand-management and dredge-disposal projects (NPS, Army Corps) *change* the bar and shoreline **[U: current dates]**. |
| Argus / CoastSnap-style video, public surf cams. | Camera frames are not data we may reuse without permission; none is verified for our spots **[U]**. |
| Satellite imagery (Sentinel-2, 10 m). | Shorelines can be mapped; sandbars rarely resolved; revisit time about 5 days, clouds and fog on this coast. Not an operational bar product **[G]**. |

**Cannot be known:** the current bar position and depth at any beach break; whether a peak is "working" because of the bar; how a storm last week reshaped it. v2's answer: for sand-bottom spots the breaking estimate gets a **wider** range and a "bar state unknown" label, and we collect observations (Section 5) so that, over time, per-spot systematic offsets can be fitted *and shown as an uncertainty, never as knowledge of the bar*.

## 3. Per-spot profile schema

One reviewed record per spot, stored as data (JSON or TS registry next to `localCalibration.ts`), validated by a test. **Every value is `unknown` until a source and a reviewer are recorded.** No value is back-filled from "typical" behaviour.

```ts
type Status = 'unknown' | 'sourced' | 'owner-reviewed' | 'measured' | 'validated';
interface Sourced<T> {
  value: T | null;                 // null = unknown, never a default
  status: Status;
  sources: {url: string; title: string; retrievedOn: string; quote?: string}[];
  reviewedBy?: string; reviewedOn?: string;   // a person/role and a date
  note?: string;
}
interface SpotProfile {
  spotId: string;
  schemaVersion: 1;
  position: {lat: Sourced<number>; lon: Sourced<number>; what: 'beach' | 'takeoff' | 'channel'};
  mop: Sourced<{id: string; lat: number; lon: number; depthM: number; shoreNormalDeg: number; distanceKm: number}>;   // read from the file's metaWaterDepth/metaShoreNormal
  orientation: Sourced<{beachNormalDeg: number}>;
  swellWindow: Sourced<{reference: 'mop10m' | 'offshore'; fromDeg: number; toDeg: number; idealDeg?: number}>;
  periodResponse: Sourced<{minUsefulS: number; idealLowS?: number; idealHighS?: number; maxUsefulS?: number; effects?: string}>;
  sizeBand: Sourced<{kind: 'breaking-face'; minFt: number; idealLowFt: number; idealHighFt: number; maxFt: number}>;
  tideWindow: Sourced<{station: string; datum: 'MLLW'; lowFt?: number; highFt?: number; stage?: ('rising' | 'falling' | 'any')[]; effects?: string}>;
  windTolerance: Sourced<{normalDeg: number; offshoreGoodMph: number; offshorePoorMph: number; crossPoorMph: number; onshorePoorMph: number; localEffects?: string}>;
  bottom: Sourced<{type: 'sand-bar' | 'reef' | 'point' | 'rock' | 'jetty-influenced' | 'mixed';
                   stability: 'mobile' | 'fixed';
                   bathymetry?: {source: 'CUDEM' | 'CRM'; tile: string; surveyYear?: number; depthAtM: Record<string, number>; meanSlope10to2m?: number};
                   barNote?: string}>;
  hazards: Sourced<string[]>;     // already in SpotEvidence; migrated, with sources
  calibration: {status: 'uncalibrated' | 'reviewed' | 'validated'; coefficients: Record<string, number> | null; sampleCount: number; validationRef: string | null};
}
```

Rules:
- A profile's **overall status** is the lowest status among the values a rating factor needs. `unknown` anywhere → that factor returns *no score* (as `evidenceQuality` does today when `idealSwell` is null), not a default.
- Acceptable sources: government/agency pages (NPS, California State Parks, NOAA, CDIP), peer-reviewed or agency reports, and **owner-supplied local knowledge** recorded as `owner-reviewed` with the reviewer and date. Unattributed forum posts and commercial surf-report text are not sources; commercial content is not copied.
- Directions are stored with their `reference` frame (offshore vs MOP 10 m), because MOP's direction is already refracted and differs from an offshore buoy's.

**What can be filled today without inventing anything** [repo + live]:

| Value | Ocean Beach (spot-2) | Linda Mar (spot-3) | Bolinas (spot-0) |
|---|---|---|---|
| position | repo query points (not takeoffs) | repo query point | county sampling point, "not a surveyed surf break" [repo] |
| `mop` | SF023, 10 m, 263.49° (**sourced**, CDIP page) | SM375/SM380 candidates, 10 m depth and normal readable from metadata (**to be reviewed**) | MA145–MA155 candidates (**to be reviewed**; transect for the break unknown) |
| `orientation` | 263.49° (CDIP) | from its reviewed MOP, else unknown | unknown |
| `swellWindow` | **assumption**, not sourced: normal ±60° (lead decision in T-008) | unknown | unknown |
| `periodResponse` | **assumption**: 8 s minimum (lead-set) | unknown | unknown |
| `sizeBand`, `tideWindow`, `windTolerance` | unknown | unknown | unknown |
| `bottom` | CDIP shore type 2 "complex bathymetry" (sourced); sand-bar nature **unreviewed** | unknown | unknown |
| `hazards` | NPS-sourced [repo] | null | county advisory notes [repo] |

The 42 coast rows have only a generic `seaward` direction; they stay `unknown` and unrated beyond the provisional tier until reviewed. The review queue is part of Phase 2.

## 4. How the rating combines the inputs: v2 versus today

### 4.1 Today

`provisionalRating`: offshore potential (height × period), wind (relation only if orientation known), "organization" from combined/primary ratio and period; caps at 74 when local alignment is unknown and at 94 always. `evidenceQuality`: five factors from spot fields that are mostly null. `rateQuality`: caps. Result: the evidence-based SQI returns "insufficient data" for almost every spot, so the rating the app shows is the provisional offshore-potential score (capped at SOLID); the estimate of breaking height is shown but *not used*.

### 4.2 v2: same skeleton, spot-specific inputs, explicit uncertainty

| Factor (weight today) | v2 input | Per-spot parameters | Notes |
|---|---|---|---|
| Swell alignment (.25) | MOP `waveDp` at the transect vs the profile's window in the MOP frame, plus a directional-spread term from `waveA1…B2` | `swellWindow`, `orientation` | Replaces offshore direction vs a guessed ideal. Scores the *refracted* direction. |
| Period response (new split from "organization") | MOP `waveTp` | `periodResponse` | Piecewise score; unknown profile → no score. |
| Size (.15) | **breaking estimate v2** range (below) overlapped with the profile's ideal band | `sizeBand` | Score from range overlap, not a point; wider range lowers confidence. |
| Wind (.25) | HRRR-based speed, gust, direction at the shore point, relation to the *reviewed* normal | `windTolerance` | Today's formula uses fixed coefficients (1.6/4/2.8 per mph); v2 uses per-spot tolerances once reviewed, else today's, labelled generic. |
| Tide (.15) | station water level and trend at the valid time | `tideWindow` | Needs an assigned station; otherwise no score (today's behaviour). |
| Organization (.20) | **From the MOP spectrum:** share of energy in swell bands vs wind-sea, spectral peakedness, directional spread; wind-sea share from the wind | none (derived) | Replaces the ratio proxy. Still an **unvalidated proxy** until observations exist; keep that label. |

**Breaking estimate v2** (extends `breakingEstimate.ts`; v1 stays as the labelled fallback):
1. Input: MOP `Hs`, `Tp`, `Dp` at 10 m. The direction is already refracted; use `Kd` against MOP `shoreNormal`. **Retire the manual `shelter` factor where a reviewed MOP point exists**, since MOP already carries shadowing through bathymetry; keep it where only the regional grid is available.
2. Transform to breaking with a depth-limited breaker height (breaker index γ, a range) instead of a free-standing Komar–Gaughan from offshore.
3. Face-height range uses factors by **bottom type**: wider for mobile sand bars (bar unknown), narrower for fixed reef/point **only after** per-spot validation; until then keep today's 0.7 to 1.4 band.
4. Tide: water level modifies available depth over the bar/reef (profile-dependent); unknown → no tide modification and a note.
5. Output stays `rangeFt` with method `v2` and `canPresentBreakingEstimate`; refusals preserved (outside window, short period, wind-sea dominant, no profile).

**Combination and caps.** Keep the weighted sum over the factors that have scores and the existing interaction caps. Changes:
- Weights are **product rules until fitted** (Section 5); they are listed in the profile output so users see them.
- Cap by profile status instead of the single 74: `unreviewed` ≤ 74 (SOLID), `reviewed` ≤ 84 (GOOD), `validated` uncapped except that EPIC still needs HIGH reliability (unchanged).
- Add a **confidence band** to the output: the score is computed at the low and high ends of the breaking range and the wind and tide uncertainty, giving a category range ("Fair to Good"); the single chip shows the middle, the label shows "Provisional" until validated.
- Reliability (existing `assessReliability`) gains real inputs: lead time from the MOP forecast issue time, data freshness, and the validation record once it exists.

## 5. Validation plan

**Ground truth we can legitimately obtain**

| Quantity | Truth source | What it validates |
|---|---|---|
| Offshore → 10 m step | CDIP buoys and MOP nowcast/hindcast; NDBC | MOP forecast and regional-grid skill (already done once for Open-Meteo vs MOP, T-008) |
| MOP forecast skill | MOP *nowcast* at the same valid time as an earlier forecast, per lead time (0 to 10 days) | Boundary forcing error and lead-time decay. Cheap, automatic, starts the day we archive forecasts. |
| Wind | NDBC/C-MAN/METAR stations near each spot (to be selected) | Wind factor inputs; bias and error vs HRRR/best match, per lead time |
| Tide | CO-OPS observed water level vs prediction | Station residuals (surge) |
| **Breaking face height and quality** | **Observation log** (below) | The only thing that validates the estimate and the rating |

**Observation log (needs D-3).** An in-app session log extension (the Journal already stores spot, time, satisfaction 1 to 5, notes, photo; all local): add *face height range seen*, *quality 1 to 5*, *bar/peak position note (optional)*, *time of observation*. Export to CSV only with the user's explicit action. A researcher/owner can also log from the beach or from a permitted camera on a fixed schedule. Target for a first calibration: **30 to 60 paired observations per spot per season**, spread over tides and swell sizes. Commercial surf reports and cams are not scraped.

**Metrics** (same pairing policy as `verification.ts`: same quantity, ≤ 10 min, location compatibility stated)
- Height: bias, MAE, share of observations inside the stated range (coverage), stratified by lead time (0 to 24 h, 24 to 72 h, 72 h+), period band and tide stage. Report as T-008 did: a table of pairs plus a script (`validate-<task>.ts`).
- Quality: ordinal agreement (within one category), Spearman rank correlation between score and observed quality, and a confusion table; baseline = today's provisional rating, to show v2 is better or not.
- Hold-out by time (fit on one stretch, test on a later one); never evaluate on the fitting data. No season of data → no "validated" claim.
- Calibration changes only through the profile's `calibration` block, with the sample count and period shown in the UI.

**Success criteria (set before looking at data)**: breaking range coverage 70 to 90% on held-out observations, bias within ±1 ft after fitting, and quality within one category at least as often as the baseline. If a criterion is missed, the label does not change and the finding is published as a limitation.

## 6. What stays labelled as unvalidated

- Every breaking-wave height: "Est. X–Y ft at the break · model estimate, not measured", until a spot has validated coverage.
- Every quality rating without a `validated` profile: "Provisional"; the caps in 4.2 apply.
- The **organization** factor (spectral proxy), wind at the break, tide response at the break: unvalidated.
- **Sandbar state**: always "bar state unknown". Never shown as a fact.
- MOP at spots whose assignment was reviewed but where the break sits in a cove, behind a reef, or beyond the 10 m point's representativeness: "nearshore model at the transect, not the break".
- Spot facts with `status` below `owner-reviewed`: not shown as spot facts, and the factor that needs them returns no score.
- Forecast beyond the validated lead time: shown, but marked "beyond validated range" in the reliability line.

## 7. Phased build

**Phase 1: this week, inputs and plumbing (no new claims, nothing becomes "validated")**
1. *MOP map and ingestion.* A script (`scripts/` or `docs/forecast/data/`) computes the nearest MOP IDs per spot by distance and reads `metaWaterDepth`/`metaShoreNormal`; commit the table with a review column, defaulting to unassigned. Extend `nearshore.ts`/`pipeline.ts` to fetch **`_forecast.nc`** for assigned spots (3-hourly, 7 to 10 days, QC flags), cached with the existing ingestion TTL. Start archiving each fetched forecast (issue time, valid time) so lead-time skill can be measured later. About 2 days.
2. *Show it.* The existing "Nearshore model" card reads real data for the assigned spots, labelled "CDIP MOP <ID> · 10 m depth · modelled". About 0.5 day.
3. *Breaking estimate v2 behind a flag.* Add the MOP-driven path to `breakingEstimate.ts`, v1 kept; unit tests for the same edge cases as v1, plus a script that compares v2 and v1 on the 1,068 archived hours (consistency check, not validation). About 1.5 days.
4. *Tide stations.* Add Pillar Point 9414131 and Point Reyes 9415020 as *reviewed-assignable* stations; assign by review, labelled as station tides. About 0.5 day.
5. *Profile schema and registry.* Types, an empty-by-default registry (only the sourced values in section 3), a test that fails if a non-null value has no source, and a one-page review sheet for the owner. About 1 day.
6. *Observation log.* Extend the Journal form and export (local-only), with tests, so that data collection starts now. About 1 day.

Not in Phase 1: any change to the rating, any new accuracy claim.

**Phase 2: next 2 to 3 weeks, spot review and baseline**
- Owner/reviewer fills profiles for 3 to 5 priority spots from cited sources; MOP assignments reviewed for each.
- Wind verification stations chosen; automatic skill reports for MOP forecast vs nowcast and wind vs observations.
- Rating v2 factors (swell alignment, period, size, wind tolerance, tide, spectral organization) behind a flag, using only reviewed profiles; output with confidence bands. Compare to the baseline on the observation log as it grows.

**Phase 3: later (after observations exist)**
- Fit weights and the breaking factors per spot by ordinal regression / quantile fit, held-out by time; publish the validation note; move profiles to `validated` only on pass.
- Bathymetry descriptors from CUDEM (transect depths, slope) in profiles; breaker index range from slope class.
- Optional: a 1-D nearshore transformation along the CUDEM transect, only if it beats the simpler method on held-out data; optional NWPS for coves; optional HRRR direct from NOAA if D-1 requires it.
- Bar-aware uncertainty from history: estimate how often a spot's offset changes across storms, and widen the range accordingly (still not knowledge of the bar).

## 8. Risks and open decisions

| Risk | Mitigation |
|---|---|
| MOP forecast depends on WW3 boundary skill and has no breaking physics | Label it, measure forecast-vs-nowcast skill by lead time, widen ranges |
| Wrong MOP assignment for coves (Bolinas, Linda Mar) makes numbers look precise but wrong | Assignment is a reviewed profile field; unassigned spots keep the regional grid and say so |
| Overclaiming: a better input mistaken for a validated rating | Section 6 labels; caps by profile status; "Provisional" chip; no "accurate" wording until section 5 criteria pass |
| Open-Meteo free tier is non-commercial | D-1: decide now; fall back to NOAA direct (Phase 3) |
| Observations take time and effort | Start the log in Phase 1; low-friction form; accept slow validation rather than invent coverage |
| CDIP availability and format changes (THREDDS) | Keep QC filtering and the "no data" refusal; store raw archives |
| Spot facts are contested locally | Record reviewer and date; show source on request; never silently default |

Open decisions: D-1 to D-4 (section 0); also: which 3 to 5 spots are the priority for review, and whether the owner or an outside local reviewer signs off spot facts.

## Appendix A: verification log (2026-10-31)

- THREDDS catalog `.../cdip/model/MOP_alongshore/catalog.xml`: 6,358 each of `*_nowcast.nc`, `*_forecast.nc`, `*_hindcast.nc`.
- `SF023_forecast.nc` dataset: variables as listed in 2.1; `time_coverage_resolution PT03H00M`, `time_coverage_duration P010DT00H00M`; history "Net_model version 2.1 … WW3_forecast.INPUT … -h 240"; acknowledgment "CDIP is primarily supported by the U.S. Army Corps of Engineers (USACE)".
- NCSS CSV `SF023_forecast.nc?var=waveHs,waveTp,waveDp,waveFlagPrimary` for 2026-10-30 to 2026-11-12: 56 rows, 3-hourly, 2026-10-31T00Z to 2026-11-06T21Z, QC flag 1.
- Forecast files answer for SM406 (37.635, −122.509), MA031 (37.819, −122.518); sampled positions: SM370 (37.590, −122.524), SM375 (37.599, −122.516), SM380 (37.607, −122.513), SM385 (37.607, −122.513), SM390 (37.614, −122.512), SM394 (37.616, −122.512), SM398 (37.628, −122.510), MA040 to MA170 (e.g. MA145 37.883, −122.673; MA155 37.875, −122.693; MA170 37.904, −122.744).
- CO-OPS `mdapi` stations 9414131, 9415020, 9413745, 9414290, 9414750 exist; `predictions` (hilo, MLLW) returned data today for 9414131, 9415020, 9413745.
- NDBC `realtime2` text answers for 46026 (header `WDIR WSPD GST WVHT DPD APD MWD …`), 46013, 46214, 46237, 46012.
- Open-Meteo terms page: free API "less than 10,000 API calls per day, 5,000 per hour and 600 per minute"; commercial = subscriptions, advertising, commercial products; data CC BY 4.0. Marine docs: models and resolutions as in 2.5 and "accuracy at coastal areas is limited". Weather docs: best match adds HRRR over North America.
- CDIP MOP page for SF023: 37.7481, −122.5189, depth 10.00 m, shore normal 263.49°, length 873 m, shore type 2 "complex bathymetry".
- NCEI CUDEM 1/9 arc-second record and the OCM California tile folder; USGS Ocean Beach Coastal Processes Study (OFR 2007-1217) and the Cliff House camera field-activity record.
- **Not verified** (marked [U]/[G] above): MOP forecast update cadence; the CDIP data-use page text; HRRR specifics from NOAA; the California CUDEM datum; the operational status of any Ocean Beach bar monitoring today.
