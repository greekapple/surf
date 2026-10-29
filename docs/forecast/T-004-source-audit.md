# T-004: Forecast source audit and spot profiles
Author: `architect` (Sonnet, read-only), 2026-10-29. Saved by the lead. Based on reading the code, not on running the app or fetching live data.
Lead spot-checked D1 (no UI consumer of `bundle.nearshore`) and D2 (`confidence:'Demo'` in `src/ocean/bridge.ts:5`): both confirmed.
Tags: **[R]** sourced in repo · **[G]** general knowledge, needs verification · **[U]** unknown.

## 1. Sources
| Provider / ID | Variables and definition | Time | Relation to the spots | App label |
|---|---|---|---|---|
| Open-Meteo Marine, per-spot point: OB 37.75,-122.6 · Bolinas 37.88,-122.73 · Linda Mar 37.60,-122.57 [R `src/ocean/spots.ts:5-7`] | `wave_height`, `swell_wave_*`, `secondary_swell_wave_*`, SST [R `openMeteo.ts:2`]. Metres converted to ft. `wave_height` = combined model Hs [G]; swell period is a partition mean, not Tp [G]. | Hourly valid time, UTC. No issue/run time; retrieval time recorded [R `:20`]. | Points ~5–7 km offshore of each beach. Grid cell and land-masking [U]. | "Offshore significant wave height" [R `src/map/model.ts:24`]. Good. |
| Open-Meteo Weather: OB 37.759,-122.51 · Bolinas 37.908,-122.682 · LM 37.600,-122.5 | Wind 10 m speed, direction, gust (mph) | Hourly UTC | Shore point, different grid from marine [R `spots.ts:2`] | Joined to marine by exact UTC key [R `openMeteo.ts:17-18`] |
| NOAA NDBC 46026 [R `noaa.ts:3`] | WVHT (spectral Hs), DPD (dominant ≈ Tp), MWD (direction at dominant period) [G] | Observation time UTC; latest non-missing value per variable within 24 h [R `:24`] | ~18 NM west of SF, "regional context only" [R `:25`] | "Observation · NOAA NDBC 46026" [R `ForecastView.tsx:80`] |
| NOAA CO-OPS 9414290 predictions (MLLW, ft) [R `noaa.ts:4`] | Astronomical tide | UTC valid time | One SF station for all spots, labelled regional [R `:7`]. Station is inside the Golden Gate [G]; outer-coast timing differs. | "Regional tide". Honest. |
| CO-OPS 9414290 water level, latest [R `noaa.ts:4`] | Observed level, ft MLLW | Latest observation | Same station | "San Francisco gauge, not the selected beach" [R `:17`] |
| CDIP MOP SF023 nowcast [R `nearshore.ts:3`] | `waveHs` m, `waveTp` s, `waveDp` °T; only QC = 1 kept [R `:12`] | UTC, now ±24 h, nowcast only | Ocean Beach only: 37.748,-122.519, 10 m depth, shore normal 263.49° [R `spots.ts:5`, `coastal.ts:3`] | **Never displayed (D1)** |
| CDIP SM406 Pacifica | Metadata only: 37.636,-122.510, 15 m, normal 270; "not assigned to Linda Mar" [R `coastal.ts:5`] | not fetched | ~4 km north of Linda Mar | — |
| Bolinas nearshore | None. NWPS MTR named, coverage unverified [R `coastal.ts:4`] | — | — | — |

### Defects
- **D1:** CDIP SF023 is fetched into `bundle.nearshore` [R `pipeline.ts:26`] but nothing in the UI reads it. The best nearshore data is unused.
- **D2:** `toLegacy` hard-codes `confidence:'Demo'` and sets `updatedAt` to the retrieval time [R `src/ocean/bridge.ts:5`].
- **D3:** Forecast prints up to five buoy values with one `validAt`, taken from the first value [R `ForecastView.tsx:81`]; each variable has its own time [R `noaa.ts:24`].
- **D4:** Buoy DPD and the Open-Meteo swell period are different statistics. Never compare or average them without a label. No code does this yet.
- **D5:** Two orientation tables. OB 263.49 in `spots.ts`, Bolinas and Linda Mar `null`, while the demo data uses unsourced seaward/idealDirection values (OB 270/285, Bolinas 220/225, LM 250/250) [R `demo.ts:4-5`]. The live wind relation uses `evidenceSpots.orientation` [R `ratings/provisional.ts:26`]; the demo path uses `seaward` [R `recommendation/sqi.ts:10`].
- **D6:** Demo exposure, tides, period range and wind tolerance are arbitrary; safe only while `illustrative`.
- **D7:** Demo `face = base × exposure` [R `demo.ts:15`] must never reach retrieved mode. It is guarded by `availability.face` [R `bridge.ts:5`, `useForecast.ts:29-30`]; Open-Meteo sets face absent. Good.

## 2. Spot profiles
No spot has a verified swell window, tide preference or wind preference; those fields are null [R `src/ocean/calibration.ts:9`].

| | Ocean Beach (spot-2) | Bolinas (spot-0) | Linda Mar (spot-3) |
|---|---|---|---|
| Location | 37.759,-122.51 [R] | 37.908,-122.682, county water-quality point, not a surveyed break [R] | 37.600,-122.5, Pacifica State Beach [R] |
| Beach normal | 263.49° at SF023 [R] | Unknown; to be measured | Unknown; SM406 (north) is 270 [R], not assigned |
| Nearshore model | SF023 [R] | None | None (SM406 candidate) |
| Swell window and shadowing | Open W–NW; Farallones shadow part; bar refraction [G/U] | Faces S–SW in a bay; Point Reyes and Duxbury Reef shelter it from NW; mainly S–SW swell [G] | Cove facing W–SW; Pedro Point shadows the south end [G/U] |
| Tide | Regional station only [R]; local preference [U] | Lagoon-channel flow may matter [G/U] | [U] |
| Wind | Relation to the normal computed [R] | [U] | [U] |
| Hazards in code | Expert; NPS-sourced [R] | County bluff and contamination notes [R] | null [R] |

## 3. Breaking-wave estimate
- **Defensible now:** Ocean Beach only, CDIP SF023 shown as **nearshore-model** Hs/Tp/Dp at 10 m depth. This is not a breaking estimate, and no conversion exists [R `coastal.ts:3`, `calibration.ts:5`].
- **Bolinas and Linda Mar:** no defensible number.
- **Shoaling/refraction formula:** would need a depth profile, bar state and breaker index, none of which are in the repo. It could only ship as an "illustrative" range. Not recommended without paired observations.
- **Validation before any breaking number:** at least one season of paired observations (surf reports or camera face heights) against SF023 and the buoy, per spot: bias, RMSE, lead-time error, out-of-sample. Currently `sampleCount` is 0 [R `localCalibration.ts:4`].

### Proposed contract
```ts
type WaveKind = 'offshore-model' | 'nearshore-model' | 'observation' | 'breaking-estimate' | 'illustrative';
interface WaveReading {
  kind: WaveKind; source: string;
  location: {lat: number; lon: number; depthM?: number; label: string};
  validTime: string; timing: 'valid' | 'observed';
  stat: 'Hs' | 'Hmax' | 'face';
  period?: {value: number; type: 'Tp' | 'Tm' | 'swell-mean'};
  value: number | null; unit: 'ft' | 'm';
  method?: string;                                        // required for breaking-estimate
  uncertainty?: {lowFt: number; highFt: number; basis: string}; // required for breaking-estimate
  validation?: {sampleCount: number; biasFt: number; rmseFt: number; period: string};
  reason?: string;                                        // required when value is null
}
```
A type guard rejects `breaking-estimate` without `validation` and `uncertainty`. Reconcile with `WaveMeasurementKind` (`src/utils/waveHeight.ts:5`) and `MeasurementKind` (`src/services/verification.ts:1`) rather than duplicating them.

### Label policy
- Offshore Hs: "Offshore model wave height (not surf height)".
- CDIP: "Nearshore model Hs at 10 m depth, Ocean Beach only".
- Buoy: "Observed offshore", with its own timestamp.
- With no estimate: "No breaking-wave estimate available. Not validated."
- Never use "surf", "face" or "X ft waves" for the first three. Rating tier stays "Provisional" until validated [R `ratings/engine.ts:36`].

## 4. Plan
1. **User decision:** nearshore-model only at Ocean Beach, or fund validation with observations; choose the surf-report data source.
2. **Types:** add `WaveReading` in `src/ocean/types.ts`, reconcile with `waveHeight.ts`, update CONTRACTS.md. Accept when tsc passes and a test blocks an unvalidated breaking estimate.
3. **Fix D2 and D3** (`bridge.ts:5`, `ForecastView.tsx:81`). Accept when retrieved data is not labelled Demo and each buoy value shows its own time.
4. **Show CDIP SF023** for Ocean Beach beside the offshore model and the buoy, with locations and times. Accept on a browser check at 1440 and 390.
5. **One sourced spot-profile table;** retire the duplicate orientations (D5). Needs measured normals from the user or a survey.
6. **Validation harness** through `src/services/verification.ts` (bias, RMSE). The breaking estimate is enabled only after review. Needs a user decision on data and thresholds.
