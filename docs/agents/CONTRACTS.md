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
- Nearshore model (CDIP MOP SF023, Ocean Beach `spot-2` only) is labelled "Nearshore model Hs at 10 m depth (CDIP MOP SF023), not surf height", with its own valid time and location. It is shown only for the record within 30 min of the selected hour (nowcast window now ±24 h); otherwise say so, never extrapolate. Other spots: "No nearshore model for this spot". Never call it surf, face or breaking height.
- A `breaking-estimate` may be presented only with a range and a method: guard `canPresentBreakingEstimate` in `src/utils/waveHeight.ts` (the kinds are `WaveMeasurementKind`; no parallel type). The guard also requires a range at least 1 ft wide and a versioned method string (contains `v<number>`).
- Breaking-wave estimate range (T-008, data only, no UI yet): `OceanRecord.faceEstimate` (`{input}` or `{refusal}`), built by `src/ocean/breakingEstimate.ts` from primary swell and a reviewed per-spot profile in `src/ocean/localCalibration.ts`. It is an unvalidated range (label it an estimate, never measured, never alongside a single "face" number), is separate from the single-valued `face`, and is not an input to ratings. Ocean Beach (`spot-2`) has the reviewed profile. Since T-071 spots whose published spot guides (Surfnerd, Surf-Forecast.com) state a facing and swell range, and that no source calls sheltered, get a profile built by `src/ocean/spotFactsRules.ts` from `src/ocean/spotFactsSourced.ts` (31 of 45 spots, provenance 'published guide', generic 8 s minimum period, unvalidated); every other spot refuses with a reason. Linda Mar's MOP point SM375 is assigned by a facing-match rule, not by review. A guide-derived estimate must say where its inputs came from (`guideBasis` in `src/services/headlineSurf.ts`). Method and validation limits: `docs/forecast/T-008-validation.md`.
- Every observed or modelled variable shows its own valid/observed time; one shared time only when all values share it. Retrieval time is never shown as model update/issue time. Retrieved records carry `confidence:'Unrated'`, `updatedAt:'Not supplied'`; `'Demo'` is only for the static demo dataset.
- Ratings are provisional and uncalibrated; say so where shown.
- No live camera imagery unless an authorised feed exists.

## Photography (`src/ui/photos.ts`)
Every displayed photo comes from `PHOTOS` and shows photographer and licence. Generic photos say they are not the spot.

## Visual tokens
`src/ui/tokens.css` (global, dark legacy areas) and the `.coast` scope in `src/features/home/home.css`
(light Home). Accent `--signal` (#ff5a1f) is reserved for navigation state and the single key accent.
Type: Archivo variable (width axis for display).
