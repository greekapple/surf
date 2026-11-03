# T-066 handoff (engineering)

## 1. Codex P2s on the T-064 merge (fixed, tested)
- (a) `forecastArchive.ts`: snapshots are now APPENDED per spot-hour (at least 30 minutes apart), never overwritten, so a revisit after a session started cannot erase the pre-session prediction. At most 4 are kept per spot-hour: the earliest and the latest ones. Test: archive before the session, revisit after it, and `predictedFor(before the session)` still returns the earlier entry; the cap is respected.
- (b) `calibration.ts` `pairFor`: looks up the archive FIRST (by the hour containing the observation, no current record needed); the current record is required only for the fallback, and only for the same hour. Test: an observation logged three days later with no current records still pairs from the archive (`source 'archived'`); with neither, it stays unpaired.

## 2. Thursday swell drop (Ocean Beach): `docs/forecast/THURSDAY-DIP-T066.md`
Traced with `docs/forecast/data/trace-week.ts` (live Open-Meteo + CDIP MOP SF023 through the app's own `headlineSurf`/`dayRange`). The dip IS in our data: Thursday Nov 5 is the lowest day in offshore Hs (5.7 ft vs 6.5 Wed), primary swell (3.9 vs 6.2 ft), MOP Hs (7.6 vs 10.8 ft, 0.70 of Wed) and the v2 estimate (median central 10.0 vs 13.0 ft, -23%). It is shallower than Surfline's (about -50%) because our sources forecast a smaller drop: a data-source difference, not a day-card bug. Our day card adds about 1 ft by choosing the best-rated hour (3 PM, 7–15 vs 6–13 at 10 AM), by design (T-057). No code change. Two options for the user are in the doc (median-hour day cards; show the offshore-vs-MOP spread). Note the absolute scale also differs (ours about 1.3x Surfline on a normal day, about 2x on Thursday): the v2 factors are unvalidated.

## 3. Checks
tsc, 360 tests, build; journeys 7/8 (journey 3 pending product's graph wiring); t055 and t059 pass.
