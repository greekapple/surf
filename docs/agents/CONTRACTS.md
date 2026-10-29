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
- Ratings are provisional and uncalibrated; say so where shown.
- No live camera imagery unless an authorised feed exists.

## Photography (`src/ui/photos.ts`)
Every displayed photo comes from `PHOTOS` and shows photographer and licence. Generic photos say they are not the spot.

## Visual tokens
`src/ui/tokens.css` (global, dark legacy areas) and the `.coast` scope in `src/features/home/home.css`
(light Home). Accent `--signal` (#ff5a1f) is reserved for navigation state and the single key accent.
Type: Archivo variable (width axis for display).
