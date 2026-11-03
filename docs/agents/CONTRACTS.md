# Shared contracts
Read before changing code. Whoever changes one of these updates this file in the same change and
tells the lead, who relays it to affected owners.

## Routing (`src/app/routes.ts`)
- `Area = 'home' | 'forecast' | 'explore' | 'quiver' | 'personal'`: exactly five primary destinations.
- Wave Scale is the Forecast section `wave-scale` (`/forecast/wave-scale`); `/scale…` is redirected by `parseRoute`.
- `navigate(area, section)` / `go` updates URL and state; `?spot=<slug>` carries the selected spot.

## Shared state (`src/app/store` → `useSwello()`)
`spot`, `setSpot`, `spotOptions`, `series` (hourly samples for the spot), `view.selectedTime` / `view.selectTime`,
`view.mapRecords`, `view.ocean` (bundle, loading, error, statuses), `data.state` (profile, boards, favorites,
sessions; persisted to localStorage key `surf-prototype-v1`), `data.favorite(id)`, `live`, `now`.

## Data honesty
- `heightFt` from live providers is **offshore significant wave height**; label it "offshore".
- Breaking-wave (face) values exist only where `forecast.availability.face` is true; otherwise show
  "unavailable" or "illustrative", never a number.
- Nearshore model (CDIP MOP; Ocean Beach `spot-2` SF023 reviewed, and since T-073 the points assigned by the facing-match rule at 39 more spots, each labelled so; the nowcast is fetched for SF023 only) is labelled "Nearshore model Hs at 10 m depth (CDIP MOP SF023)", with its own valid time and location. Since T-077 (user decision "Surfer convention") that same Hs is also the headline surf-height estimate where the spot is on v2, and the panel says so; it is still a model value, not a measurement. It is shown only for the record within 30 min of the selected hour (nowcast window now ±24 h); otherwise say so, never extrapolate. Other spots: "No nearshore model for this spot". Never call it surf, face or breaking height.
- A `breaking-estimate` may be presented only with a range and a method: guard `canPresentBreakingEstimate` in `src/utils/waveHeight.ts` (the kinds are `WaveMeasurementKind`; no parallel type). The guard also requires a range at least 1 ft wide and a versioned method string (contains `v<number>`).
- Surf-height estimate (T-077): the headline height is the common surf-report convention, about the nearshore significant wave height (v2: the CDIP MOP Hs at the point; v1: the offshore swell carried to 10 m by linear shoaling), labelled "Est. X–Y ft surf height · model estimate". The larger breaking height (`HeadlineSurf.breakingFt`) is shown only as a labelled detail ("breaking height about X"). Calibration pairs carry `basis: 'surf-height'`. Where a nearshore record exists for the hour and refuses it (outside the window, short period, no break) the spot shows the labelled offshore height, not a v1 estimate. The ranges' widths come from `src/services/uncertainty.ts`.
- Breaking-wave estimate range (T-008; the legacy range stored on `OceanRecord.faceEstimate`): `OceanRecord.faceEstimate` (`{input}` or `{refusal}`), built by `src/ocean/breakingEstimate.ts` from primary swell and a reviewed per-spot profile in `src/ocean/localCalibration.ts`. It is an unvalidated range (label it an estimate, never measured, never alongside a single "face" number), is separate from the single-valued `face`, and is not an input to ratings. Ocean Beach (`spot-2`) has the reviewed profile. Since T-071 spots whose published spot guides (Surfnerd, Surf-Forecast.com) state a facing and swell range, get a profile built by `src/ocean/spotFactsRules.ts` from `src/ocean/spotFactsSourced.ts` (41 of 45 spots since T-073, provenance 'published guide', generic 8 s minimum period, unvalidated); a spot a source calls sheltered gets shelter 0 (the offshore-swell v1 refuses) and estimates only through its CDIP point inside the open sector a guide lists; a spot whose published working swell lies entirely outside ±60° of its facing (wrap: Mavericks, Rincon) refuses; one facing (Pismo) is derived from CDIP shore normals with provenance 'derived from coastline geometry'; every other spot refuses with a reason (`docs/forecast/ESTIMATE-COVERAGE-T073.md`). MOP points other than Ocean Beach's SF023 (39 spots since T-073) are assigned by a facing-match rule, not by review. A guide-derived estimate must say where its inputs came from (`guideBasis` in `src/services/headlineSurf.ts`). Method and validation limits: `docs/forecast/T-008-validation.md`.
- Every observed or modelled variable shows its own valid/observed time; one shared time only when all values share it. Retrieval time is never shown as model update/issue time. Retrieved records carry `confidence:'Unrated'`, `updatedAt:'Not supplied'`; `'Demo'` is only for the static demo dataset.
- Ratings are provisional and uncalibrated; say so where shown.
- No live camera imagery unless an authorised feed exists.

## Photography (`src/ui/photos.ts`)
Every displayed photo comes from `PHOTOS` and shows photographer and licence. Generic photos say they are not the spot.

## Visual tokens
`src/ui/tokens.css` (global, dark legacy areas) and the `.coast` scope in `src/features/home/home.css`
(light Home). Accent `--signal` (#ff5a1f) is reserved for navigation state and the single key accent.
Type: Archivo variable (width axis for display).
