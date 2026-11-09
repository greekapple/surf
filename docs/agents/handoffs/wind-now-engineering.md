# Handoff: wind now, Engineering (2026-11-09)
Branch `wind-now-eng`. Spec `docs/specs/2026-11-08-wind-now.md` part 1. Nothing merged or pushed.

## Files
- new: `src/ocean/shoreWind.ts` (pure: registry, URLs, both normalisers, `stationsWithin`), `src/ocean/shoreWind.json` (built), `docs/forecast/data/build-shore-wind.ts`, `src/services/shoreWindNow.ts` (the access function), `src/tests/shore-wind-now.test.ts`, `src/tests/fixtures/shore-wind/*` (real captures).
- edited: `services/forecast-service.mjs` (`shoreWindServiceStations`, one target per station, `target.accept`/`target.headers` support, a shape check for the ASOS feed; no new route: `/api/provider?key=shore-<kind>-<id>`), `src/ocean/server.ts` (browser routes exactly those URLs), and three tests whose target counts moved by +6.

## Spots with a station (7 of 45; rule: nearest within 4 km, mask on both kinds, wind in the last 7 days at build time 2026-11-09)
Mavericks and Montara: HAF airport (2.1 / 3.7 km). Crescent City: CECC1 (0.3 km). Point Arena: ANVC1 Arena Cove (0.1). Moss Landing: MLSC1 (0.2). Black's Beach: LJAC1 (2.5). Imperial Beach: TIXC1 (0.8). Ocean Beach, Linda Mar, Bolinas and the other 35 get none.

## Access function (for WindNow.tsx)
```ts
import {loadShoreWindNow} from '../../services/shoreWindNow';           // from src/features/forecast
loadShoreWindNow(spotId: string, now = Date.now()): Promise<ShoreWindNow | null>   // never throws; 10 min cache per URL
import {shoreAssignmentFor, type ShoreWindNow} from '../../ocean/shoreWind';
shoreAssignmentFor(spotId): ShoreAssignment | null   // sync: null = this spot has no station, so do not mount the line at all
```
`ShoreWindNow` is exactly the spec's interface (mph, gustMph, direction FROM in degrees true). `null` from the loader means: no station, feed down, reading older than 2 h, or no wind speed. Calm is `mph: 0` with `dirDeg: null`, not missing. `observedAt` is UTC ISO: format it in Pacific time in the UI. Kind note: `kind==='asos'` is an airfield; for `ndbc` the station name says what it is ("9419750 - Crescent City, CA" is the CO-OPS tide station).

## Checks
tsc clean. `npm test` 629 tests, 628 pass, 0 fail (1 skipped). `npm run build` ok. New file: 10 tests (both parsers on real fixtures, staleness, selection, spots without a station, the service headers, the access function).

## Live proof (2026-11-09 05:46 UTC, through `loadShoreWindNow`, real feeds)
```
Mavericks     => HAF asos 2.1 km, observedAt 2026-11-09T04:55:00Z, mph 9.2, gust null, dir 350   (NWS 14.76 km/h from 350; the 05:15 report had no wind and was skipped)
Crescent City => CECC1 ndbc 0.3 km, observedAt 05:00Z, mph 0, gust 2.2, dir null   (raw row: "2026 11 09 05 00  MM  0.0  1.0")
Black's Beach => LJAC1 ndbc 2.5 km, 05:00Z, mph 0, gust 2.2, dir null
Ocean Beach   => null (no station)
```

## Weaknesses
1. **The mask does not make every station a beach station.** MLSC1 is Moss Landing South Harbor, TIXC1 the Tijuana River estuary, ANVC1 a sheltered cove, CECC1 the Crescent City harbour tide station: all pass `isEnclosedWater` (the rule you set), but they may read lighter than the open beach. Crescent City tonight reads 0 mph. Decide whether the UI note for `ndbc` says "pier/harbour station" or whether the radius or mask should be tightened; I did not change the rule.
2. **Direction is often null at NDBC tide stations when calm (WDIR = MM)**, so many readings will show speed without a direction. The UI must handle `dirDeg: null`.
3. The registry is a point-in-time build; a station that goes silent later shows as null at runtime (handled), but is only dropped on the next `node docs/forecast/data/build-shore-wind.ts`.
4. I used `observations?limit=6`, not `observations/latest` (KHAF's latest report tonight had no wind at all; it would have hidden a good report 20 minutes older). In dev the browser calls api.weather.gov directly and cannot set the User-Agent; production goes through the Worker, which does.
