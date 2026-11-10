# Onshore-wind rating cap: what changed (4B, 2026-11-10)

**The rule** (spec `docs/specs/2026-11-10-round-4-overnight.md` 4B, approved by the user): when onshore wind is over 12 mph (`ONSHORE_BAD_MPH`, the Call's Skip line), the rating stops at 39, the top of "poor" (WEAK). It is one more ceiling in `windCeilings` (`src/ratings/windRules.ts`, id `onshore-strong`): it only lowers a score, it is listed in the rating's constraints and ceilings, and `ratings/explain.ts` says "onshore wind over 12 mph: capped at poor". Nothing else in the engine changed.

## Every spot-hour of the 7-day forecast, before and after

`docs/forecast/data/onshore-cap-change.ts`: Open-Meteo marine + wind for all 492 spots fetched once (982 requests, 0 failed; inputs fixed at 2026-11-10T07:11Z), then every hour from one hour before that to seven days after was rated with the old engine (a checkout of forecast-trust) and with this branch, on the same saved inputs. The dump keeps a SHA-1 of the whole rating object per hour.

| | |
|---|---|
| spot-hours rated | 79,212 (492 spots) |
| hours with onshore wind over 12 mph | 3,406 |
| of those, already at 39 or below (unchanged, byte-identical) | 2,925 |
| **changed hours** | **481**, at 62 spots |
| band moves | fair → poor 479; good → poor 2 (Moss Landing and Marina State Beach, Thu Nov 12 1 PM, 65 SOLID, onshore 12.5 / 12.8 mph) |
| hours that rose | **0** |
| hours without onshore wind over 12 mph whose score or word changed | **0** (of 75,806) |
| of those, same score and word but a different rating object | 78, all cross-shore over 8 mph at 64: with the review fix below they record only the binding ceiling (cross-shore, NOT BAD) instead of that and the wider-range one (SOLID). Before that fix, all 75,806 were byte-identical. |

Changed hours by region: San Mateo 84, Santa Cruz 68, San Diego 46, San Francisco 46, Marin 45, San Luis Obispo 30, Kauai 28, Monterey 28, Los Angeles 24, Del Norte 23, Orange County 22, Maui 12, Ventura 8, Sonoma 7, Santa Barbara 4, Big Island 2, Curry 2, Big Sur 1, Humboldt 1. No US East or Oahu hour changed in this window (none was rated 40 or above with forecast onshore wind over 12 mph).

## The split audit, rerun on the new engine

`rating-audit-split.ts` run twice on one download cache: once in a checkout of forecast-trust (it reproduces the committed `RATING-AUDIT-SPLIT.md` California numbers exactly) and once on this branch. `RATING-AUDIT-SPLIT.md` itself is left as the 3D report; the new run's report is not committed.

**California, "fair or better while observed poor"** (159 observed-poor hours, recent window 2026-10-07 to 2026-11-06):

| | before | after |
|---|---|---|
| **the app (forecast-fed)** | **45.9%** | **39.0%** |
| observed-fed, split swell | 47.8% | 0.0% † |
| observed-fed, bulk Hs (old method) | 78.0% | 0.0% † |
| by region, the app: San Mateo / Los Angeles / San Diego | 83.3% / 33.7% / 55.7% | 33.3% / 33.7% / 47.5% |
| "observed poor while rated fair+", the app | 5.6% (73/1294) | 4.9% (62/1278) |

**† Read the observed-fed rows with care.** Every California observed-poor hour in this window is poor because of observed onshore wind over 12 mph (size 0, onshore 159), the same line the cap now uses. The observed-fed rating is fed that same observed wind, so it cannot be fair or better on those hours: 0.0% follows from the definition and does not measure skill. **The app's number is the meaningful one:** 45.9% → 39.0%. The remaining 39% are hours when the shore station measured onshore wind over 12 mph but the forecast wind was not over 12 mph onshore: a wind-forecast miss the cap cannot fix. Hawaii + East: 298 observed-poor hours, 13 poor on size and 285 on observed onshore wind over 12 mph. The app 8.1% → 8.1%; observed-fed split 2.0% → 0.3%, bulk 53.0% → 1.3%. The observed-fed drop is again mostly by construction (the 285 onshore hours); what remains comes from the 13 size-poor hours.

## Review fixes (data-honesty round 1)

- **Only the binding ceiling is recorded.** Ceilings apply lowest first, and one is recorded only if it lowers the score, so a 39 hour no longer also says "stops at SOLID". The explanation ends with the binding one.
- **The wind line.** Where the cap holds the rating: "Onshore 14.0 mph: over 12.0 mph, so the rating is capped at poor (see Rating ceiling)." The tick shows the wind as poor (display only, no score change). Where it does not hold (a demonstration rating from `rateQuality`, which has no wind ceilings), the earlier sentence stays.
- **Units and rounding.** The spot page and the Call give wind in the person's unit (`utils/units` `wind`, one decimal), so 12.3 mph no longer reads "12 mph". The ceiling reason rounds up (12.04 reads 12.1) and names the source: 12 mph is our own line, the top of Beaufort force 3 (8–12 mph, "crests begin to break", NWS). **Known gap:** that reason is built in the engine with no profile, so it is always in mph.

## Every changed hour

Spot time; old and new score with the engine's word and the band (good / fair / poor); wind is the forecast 10 m wind and where it comes from.

| Spot | Region | Hour (spot time) | Old | New | Wind (mph, from °) |
|---|---|---|---|---|---|
| Ocean Beach | San Francisco | Fri, Nov 13, 9 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.6 from 237° |
| Ocean Beach | San Francisco | Sat, Nov 14, 9 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 261° |
| Ocean Beach | San Francisco | Sat, Nov 14, 10 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 266° |
| Ocean Beach | San Francisco | Sat, Nov 14, 11 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 260° |
| Ocean Beach | San Francisco | Sat, Nov 14, 12 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 253° |
| Ocean Beach | San Francisco | Sat, Nov 14, 1 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 253° |
| Ocean Beach | San Francisco | Sat, Nov 14, 2 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 253° |
| Ocean Beach | San Francisco | Mon, Nov 16, 1 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Ocean Beach | San Francisco | Mon, Nov 16, 2 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Ocean Beach | San Francisco | Mon, Nov 16, 3 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 262° |
| Ocean Beach | San Francisco | Mon, Nov 16, 4 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 262° |
| Ocean Beach | San Francisco | Mon, Nov 16, 5 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 262° |
| Ocean Beach | San Francisco | Mon, Nov 16, 6 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Ocean Beach | San Francisco | Mon, Nov 16, 7 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 258° |
| Ocean Beach | San Francisco | Mon, Nov 16, 8 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.9 from 256° |
| Ocean Beach | San Francisco | Mon, Nov 16, 9 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 252° |
| Ocean Beach | San Francisco | Mon, Nov 16, 10 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Bolinas | Marin | Sun, Nov 15, 10 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 164° |
| Bolinas | Marin | Sun, Nov 15, 11 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.2 from 172° |
| Bolinas | Marin | Sun, Nov 15, 12 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.1 from 178° |
| Stinson Beach | Marin | Fri, Nov 13, 5 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 181° |
| Stinson Beach | Marin | Fri, Nov 13, 6 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 189° |
| Stinson Beach | Marin | Fri, Nov 13, 7 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.5 from 207° |
| Stinson Beach | Marin | Sat, Nov 14, 11 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.6 from 258° |
| Stinson Beach | Marin | Sat, Nov 14, 12 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 252° |
| Stinson Beach | Marin | Sat, Nov 14, 1 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 252° |
| Stinson Beach | Marin | Sat, Nov 14, 2 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 250° |
| Stinson Beach | Marin | Sun, Nov 15, 1 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.7 from 182° |
| Stinson Beach | Marin | Sun, Nov 15, 2 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 18.1 from 181° |
| Stinson Beach | Marin | Sun, Nov 15, 8 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 185° |
| Stinson Beach | Marin | Mon, Nov 16, 3 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.7 from 262° |
| Stinson Beach | Marin | Mon, Nov 16, 4 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 263° |
| Stinson Beach | Marin | Mon, Nov 16, 5 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 264° |
| Stinson Beach | Marin | Mon, Nov 16, 6 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 265° |
| Stinson Beach | Marin | Mon, Nov 16, 7 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.4 from 264° |
| Stinson Beach | Marin | Mon, Nov 16, 8 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 260° |
| Stinson Beach | Marin | Mon, Nov 16, 9 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 254° |
| Stinson Beach | Marin | Mon, Nov 16, 10 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Stinson Beach | Marin | Mon, Nov 16, 2 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 210° |
| Stinson Beach | Marin | Mon, Nov 16, 3 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 202° |
| Montara | San Mateo | Sun, Nov 15, 11 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 234° |
| Montara | San Mateo | Mon, Nov 16, 12 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 248° |
| Montara | San Mateo | Mon, Nov 16, 1 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Montara | San Mateo | Mon, Nov 16, 2 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 264° |
| Montara | San Mateo | Mon, Nov 16, 7 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 259° |
| Montara | San Mateo | Mon, Nov 16, 9 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.2 from 252° |
| Montara | San Mateo | Mon, Nov 16, 10 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Mavericks | San Mateo | Thu, Nov 12, 12 PM PST | 64 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 201° |
| Mavericks | San Mateo | Fri, Nov 13, 6 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 183° |
| Mavericks | San Mateo | Fri, Nov 13, 7 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.5 from 198° |
| Mavericks | San Mateo | Fri, Nov 13, 8 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.5 from 205° |
| Mavericks | San Mateo | Sun, Nov 15, 10 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 168° |
| Mavericks | San Mateo | Sun, Nov 15, 11 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.1 from 173° |
| Mavericks | San Mateo | Sun, Nov 15, 12 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.3 from 178° |
| Mavericks | San Mateo | Sun, Nov 15, 1 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 181° |
| Mavericks | San Mateo | Sun, Nov 15, 2 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 180° |
| Mavericks | San Mateo | Sun, Nov 15, 3 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.8 from 177° |
| Mavericks | San Mateo | Sun, Nov 15, 4 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 175° |
| Mavericks | San Mateo | Sun, Nov 15, 5 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.8 from 174° |
| Mavericks | San Mateo | Sun, Nov 15, 9 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.5 from 202° |
| Mavericks | San Mateo | Sun, Nov 15, 10 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 219° |
| Mavericks | San Mateo | Sun, Nov 15, 11 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 234° |
| Steamer Lane | Santa Cruz | Fri, Nov 13, 5 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 175° |
| Steamer Lane | Santa Cruz | Sun, Nov 15, 9 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 178° |
| Steamer Lane | Santa Cruz | Sun, Nov 15, 10 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.6 from 171° |
| Steamer Lane | Santa Cruz | Sun, Nov 15, 11 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 173° |
| Pleasure Point | Santa Cruz | Fri, Nov 13, 5 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 175° |
| Pleasure Point | Santa Cruz | Fri, Nov 13, 9 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.0 from 193° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 1 PM PST | 64 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.4 from 187° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 2 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.3 from 193° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 3 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 199° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 4 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.7 from 202° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 5 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.0 from 202° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 6 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 16.4 from 200° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 7 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.3 from 197° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 8 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.0 from 188° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 9 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 178° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 10 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.6 from 171° |
| Pleasure Point | Santa Cruz | Sun, Nov 15, 11 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 173° |
| Davenport | Santa Cruz | Fri, Nov 13, 8 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.2 from 193° |
| Davenport | Santa Cruz | Fri, Nov 13, 9 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.9 from 208° |
| Davenport | Santa Cruz | Fri, Nov 13, 10 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.7 from 202° |
| Davenport | Santa Cruz | Fri, Nov 13, 11 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 197° |
| Davenport | Santa Cruz | Fri, Nov 13, 8 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.5 from 248° |
| Davenport | Santa Cruz | Fri, Nov 13, 9 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 251° |
| Davenport | Santa Cruz | Sun, Nov 15, 1 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.6 from 187° |
| Davenport | Santa Cruz | Sun, Nov 15, 2 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 190° |
| Davenport | Santa Cruz | Sun, Nov 15, 3 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 190° |
| Davenport | Santa Cruz | Sun, Nov 15, 4 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 190° |
| Davenport | Santa Cruz | Sun, Nov 15, 5 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 191° |
| Davenport | Santa Cruz | Sun, Nov 15, 6 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.1 from 193° |
| Davenport | Santa Cruz | Sun, Nov 15, 7 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.4 from 192° |
| Davenport | Santa Cruz | Sun, Nov 15, 11 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 196° |
| Brookings | Curry | Mon, Nov 9, 11 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 184° |
| Brookings | Curry | Tue, Nov 10, 12 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.2 from 181° |
| Crescent City | Del Norte | Mon, Nov 9, 11 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 180° |
| Crescent City | Del Norte | Tue, Nov 10, 12 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.4 from 180° |
| Crescent City | Del Norte | Tue, Nov 10, 2 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 175° |
| Crescent City | Del Norte | Tue, Nov 10, 10 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 165° |
| Crescent City | Del Norte | Tue, Nov 10, 11 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 169° |
| Crescent City | Del Norte | Tue, Nov 10, 12 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.7 from 174° |
| Crescent City | Del Norte | Tue, Nov 10, 1 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.2 from 171° |
| Crescent City | Del Norte | Tue, Nov 10, 2 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.6 from 167° |
| Crescent City | Del Norte | Tue, Nov 10, 3 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 162° |
| Crescent City | Del Norte | Tue, Nov 10, 8 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.4 from 170° |
| Crescent City | Del Norte | Tue, Nov 10, 9 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.3 from 176° |
| Crescent City | Del Norte | Tue, Nov 10, 10 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.1 from 177° |
| Crescent City | Del Norte | Tue, Nov 10, 11 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.2 from 171° |
| Crescent City | Del Norte | Wed, Nov 11, 1 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 169° |
| Crescent City | Del Norte | Wed, Nov 11, 2 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.1 from 165° |
| Crescent City | Del Norte | Wed, Nov 11, 3 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.8 from 169° |
| Crescent City | Del Norte | Wed, Nov 11, 4 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 161° |
| Crescent City | Del Norte | Wed, Nov 11, 5 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 160° |
| Crescent City | Del Norte | Wed, Nov 11, 7 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.1 from 162° |
| Crescent City | Del Norte | Wed, Nov 11, 8 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 159° |
| Crescent City | Del Norte | Wed, Nov 11, 9 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.9 from 161° |
| Crescent City | Del Norte | Wed, Nov 11, 10 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 163° |
| Crescent City | Del Norte | Wed, Nov 11, 11 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.6 from 167° |
| Moonstone Beach | Humboldt | Thu, Nov 12, 3 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 232° |
| Salmon Creek | Sonoma | Tue, Nov 10, 12 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 300° |
| Salmon Creek | Sonoma | Tue, Nov 10, 1 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 298° |
| Salmon Creek | Sonoma | Tue, Nov 10, 2 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.7 from 293° |
| Salmon Creek | Sonoma | Tue, Nov 10, 3 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.0 from 295° |
| Salmon Creek | Sonoma | Tue, Nov 10, 4 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 302° |
| Salmon Creek | Sonoma | Tue, Nov 10, 5 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.0 from 300° |
| Salmon Creek | Sonoma | Tue, Nov 10, 6 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 302° |
| Dillon Beach | Marin | Tue, Nov 10, 3 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.2 from 280° |
| Dillon Beach | Marin | Fri, Nov 13, 4 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.4 from 230° |
| Rodeo Beach | Marin | Fri, Nov 13, 5 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 181° |
| Rodeo Beach | Marin | Fri, Nov 13, 6 AM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 189° |
| Rodeo Beach | Marin | Fri, Nov 13, 7 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.5 from 207° |
| Rodeo Beach | Marin | Sat, Nov 14, 11 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.6 from 258° |
| Rodeo Beach | Marin | Sat, Nov 14, 12 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 252° |
| Rodeo Beach | Marin | Sat, Nov 14, 1 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 252° |
| Rodeo Beach | Marin | Sat, Nov 14, 2 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 250° |
| Rodeo Beach | Marin | Sun, Nov 15, 1 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.7 from 182° |
| Rodeo Beach | Marin | Sun, Nov 15, 2 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 18.1 from 181° |
| Rodeo Beach | Marin | Sun, Nov 15, 8 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 185° |
| Rodeo Beach | Marin | Mon, Nov 16, 3 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.7 from 262° |
| Rodeo Beach | Marin | Mon, Nov 16, 4 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 263° |
| Rodeo Beach | Marin | Mon, Nov 16, 5 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 264° |
| Rodeo Beach | Marin | Mon, Nov 16, 6 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 265° |
| Rodeo Beach | Marin | Mon, Nov 16, 7 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.4 from 264° |
| Rodeo Beach | Marin | Mon, Nov 16, 8 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 260° |
| Rodeo Beach | Marin | Mon, Nov 16, 9 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 254° |
| Rodeo Beach | Marin | Mon, Nov 16, 10 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Rodeo Beach | Marin | Mon, Nov 16, 2 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.9 from 210° |
| Rodeo Beach | Marin | Mon, Nov 16, 3 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 202° |
| Kelly's Cove | San Francisco | Fri, Nov 13, 9 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.6 from 237° |
| Kelly's Cove | San Francisco | Sat, Nov 14, 9 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 261° |
| Kelly's Cove | San Francisco | Sat, Nov 14, 10 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 266° |
| Kelly's Cove | San Francisco | Sat, Nov 14, 11 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 260° |
| Kelly's Cove | San Francisco | Sat, Nov 14, 12 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 253° |
| Kelly's Cove | San Francisco | Sat, Nov 14, 1 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 253° |
| Kelly's Cove | San Francisco | Sat, Nov 14, 2 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 253° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 1 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 2 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 3 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 262° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 4 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 262° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 5 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 262° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 6 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 7 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 258° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 8 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.9 from 256° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 9 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 252° |
| Kelly's Cove | San Francisco | Mon, Nov 16, 10 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Sloat (Ocean Beach south) | San Francisco | Fri, Nov 13, 9 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.6 from 237° |
| Sloat (Ocean Beach south) | San Francisco | Sat, Nov 14, 2 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 253° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 1 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 2 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 3 AM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 262° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 4 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 262° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 5 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 262° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 6 AM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 7 AM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 258° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 8 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 256° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 9 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.5 from 252° |
| Sloat (Ocean Beach south) | San Francisco | Mon, Nov 16, 10 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Sharp Park | San Mateo | Mon, Nov 16, 1 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Sharp Park | San Mateo | Mon, Nov 16, 2 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Sharp Park | San Mateo | Mon, Nov 16, 3 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 262° |
| Sharp Park | San Mateo | Mon, Nov 16, 4 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 262° |
| Sharp Park | San Mateo | Mon, Nov 16, 5 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 262° |
| Sharp Park | San Mateo | Mon, Nov 16, 6 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Sharp Park | San Mateo | Mon, Nov 16, 7 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 258° |
| Sharp Park | San Mateo | Mon, Nov 16, 8 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 256° |
| Sharp Park | San Mateo | Mon, Nov 16, 9 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.5 from 252° |
| Sharp Park | San Mateo | Mon, Nov 16, 10 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 1 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 2 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 3 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 262° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 4 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 262° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 5 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.2 from 262° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 6 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 7 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 258° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 8 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 256° |
| Rockaway Beach | San Mateo | Mon, Nov 16, 9 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.5 from 252° |
| Princeton Jetty | San Mateo | Thu, Nov 12, 12 PM PST | 64 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 201° |
| Princeton Jetty | San Mateo | Fri, Nov 13, 6 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 183° |
| Princeton Jetty | San Mateo | Fri, Nov 13, 7 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.5 from 198° |
| Princeton Jetty | San Mateo | Fri, Nov 13, 8 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.5 from 205° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 10 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 168° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 11 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.1 from 173° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 12 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 16.3 from 178° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 1 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 181° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 2 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 180° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 3 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.8 from 177° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 4 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 175° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 5 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.8 from 174° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 9 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.5 from 202° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 10 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 219° |
| Princeton Jetty | San Mateo | Sun, Nov 15, 11 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 234° |
| Princeton Jetty | San Mateo | Mon, Nov 16, 10 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Half Moon Bay (Dunes Beach) | San Mateo | Fri, Nov 13, 8 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.5 from 205° |
| Half Moon Bay (Dunes Beach) | San Mateo | Sun, Nov 15, 10 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 219° |
| Half Moon Bay (Dunes Beach) | San Mateo | Sun, Nov 15, 11 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 234° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 12 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 248° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 1 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 259° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 2 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 264° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 3 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 264° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 6 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 262° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 7 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 259° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 9 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.2 from 252° |
| Half Moon Bay (Dunes Beach) | San Mateo | Mon, Nov 16, 10 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 247° |
| Pescadero State Beach | San Mateo | Mon, Nov 16, 1 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.4 from 256° |
| Pigeon Point | San Mateo | Thu, Nov 12, 11 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 175° |
| Pigeon Point | San Mateo | Fri, Nov 13, 5 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.7 from 163° |
| Pigeon Point | San Mateo | Fri, Nov 13, 6 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.5 from 172° |
| Pigeon Point | San Mateo | Fri, Nov 13, 7 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.9 from 189° |
| Pigeon Point | San Mateo | Fri, Nov 13, 8 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.0 from 203° |
| Pigeon Point | San Mateo | Fri, Nov 13, 9 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.7 from 195° |
| Pigeon Point | San Mateo | Fri, Nov 13, 8 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.3 from 241° |
| Pigeon Point | San Mateo | Sun, Nov 15, 11 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 160° |
| Pigeon Point | San Mateo | Sun, Nov 15, 12 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.2 from 170° |
| Pigeon Point | San Mateo | Sun, Nov 15, 1 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.4 from 175° |
| Pigeon Point | San Mateo | Sun, Nov 15, 2 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.7 from 174° |
| Pigeon Point | San Mateo | Sun, Nov 15, 3 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 169° |
| Pigeon Point | San Mateo | Sun, Nov 15, 4 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.8 from 167° |
| Pigeon Point | San Mateo | Sun, Nov 15, 5 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.5 from 169° |
| Pigeon Point | San Mateo | Sun, Nov 15, 6 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 18.7 from 172° |
| Waddell Creek | Santa Cruz | Fri, Nov 13, 10 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.2 from 188° |
| Waddell Creek | Santa Cruz | Fri, Nov 13, 11 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 185° |
| Waddell Creek | Santa Cruz | Fri, Nov 13, 6 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.7 from 248° |
| Waddell Creek | Santa Cruz | Fri, Nov 13, 8 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 243° |
| Scott Creek | Santa Cruz | Fri, Nov 13, 10 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.2 from 188° |
| Scott Creek | Santa Cruz | Fri, Nov 13, 11 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 185° |
| Scott Creek | Santa Cruz | Fri, Nov 13, 8 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 243° |
| Capitola | Santa Cruz | Fri, Nov 13, 5 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 175° |
| Capitola | Santa Cruz | Fri, Nov 13, 9 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.0 from 193° |
| Capitola | Santa Cruz | Sun, Nov 15, 1 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.4 from 187° |
| Capitola | Santa Cruz | Sun, Nov 15, 2 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.3 from 193° |
| Capitola | Santa Cruz | Sun, Nov 15, 3 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 199° |
| Capitola | Santa Cruz | Sun, Nov 15, 4 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.7 from 202° |
| Capitola | Santa Cruz | Sun, Nov 15, 5 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.0 from 202° |
| Capitola | Santa Cruz | Sun, Nov 15, 6 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 16.4 from 200° |
| Capitola | Santa Cruz | Sun, Nov 15, 7 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 17.3 from 197° |
| Capitola | Santa Cruz | Sun, Nov 15, 8 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.0 from 188° |
| Capitola | Santa Cruz | Sun, Nov 15, 9 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 178° |
| Capitola | Santa Cruz | Sun, Nov 15, 10 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.6 from 171° |
| Capitola | Santa Cruz | Sun, Nov 15, 11 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.8 from 173° |
| Natural Bridges | Santa Cruz | Fri, Nov 13, 6 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.6 from 174° |
| Natural Bridges | Santa Cruz | Fri, Nov 13, 7 AM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.7 from 174° |
| Natural Bridges | Santa Cruz | Fri, Nov 13, 8 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.2 from 193° |
| Natural Bridges | Santa Cruz | Fri, Nov 13, 9 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.9 from 208° |
| Natural Bridges | Santa Cruz | Fri, Nov 13, 10 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.7 from 202° |
| Natural Bridges | Santa Cruz | Fri, Nov 13, 11 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 197° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 1 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.6 from 187° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 2 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 190° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 3 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 190° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 4 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 190° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 5 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 191° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 6 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 16.1 from 193° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 7 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.4 from 192° |
| Natural Bridges | Santa Cruz | Sun, Nov 15, 11 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 196° |
| Manresa | Santa Cruz | Fri, Nov 13, 11 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.1 from 211° |
| Manresa | Santa Cruz | Fri, Nov 13, 7 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.0 from 235° |
| Manresa | Santa Cruz | Fri, Nov 13, 9 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 244° |
| Moss Landing | Monterey | Thu, Nov 12, 1 PM PST | 65 SOLID (good) | 39 WEAK (poor) | onshore 12.5 from 271° |
| Moss Landing | Monterey | Fri, Nov 13, 7 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.7 from 236° |
| Moss Landing | Monterey | Fri, Nov 13, 9 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 238° |
| Moss Landing | Monterey | Fri, Nov 13, 10 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 246° |
| Moss Landing | Monterey | Fri, Nov 13, 11 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 246° |
| Moss Landing | Monterey | Sat, Nov 14, 12 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 249° |
| Moss Landing | Monterey | Sat, Nov 14, 1 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 248° |
| Moss Landing | Monterey | Sat, Nov 14, 2 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.7 from 246° |
| Moss Landing | Monterey | Sat, Nov 14, 3 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 246° |
| Marina State Beach | Monterey | Thu, Nov 12, 1 PM PST | 65 SOLID (good) | 39 WEAK (poor) | onshore 12.8 from 275° |
| Marina State Beach | Monterey | Thu, Nov 12, 3 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.0 from 279° |
| Marina State Beach | Monterey | Fri, Nov 13, 7 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 236° |
| Marina State Beach | Monterey | Fri, Nov 13, 9 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 233° |
| Marina State Beach | Monterey | Fri, Nov 13, 10 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 241° |
| Marina State Beach | Monterey | Fri, Nov 13, 11 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 238° |
| Marina State Beach | Monterey | Sat, Nov 14, 12 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 243° |
| Carmel Beach | Monterey | Thu, Nov 12, 1 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.3 from 205° |
| Carmel Beach | Monterey | Thu, Nov 12, 3 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 207° |
| Carmel Beach | Monterey | Fri, Nov 13, 10 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.2 from 230° |
| Andrew Molera | Monterey | Thu, Nov 12, 11 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 165° |
| Andrew Molera | Monterey | Thu, Nov 12, 1 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 181° |
| Andrew Molera | Monterey | Fri, Nov 13, 12 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 181° |
| Andrew Molera | Monterey | Fri, Nov 13, 1 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.9 from 180° |
| Andrew Molera | Monterey | Fri, Nov 13, 2 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 176° |
| Andrew Molera | Monterey | Fri, Nov 13, 3 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.7 from 178° |
| Andrew Molera | Monterey | Fri, Nov 13, 4 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 177° |
| Andrew Molera | Monterey | Fri, Nov 13, 5 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.2 from 167° |
| Andrew Molera | Monterey | Sun, Nov 15, 10 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 159° |
| Sand Dollar | Big Sur | Fri, Nov 13, 11 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 269° |
| Cayucos | San Luis Obispo | Fri, Nov 13, 1 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.7 from 232° |
| Cayucos | San Luis Obispo | Fri, Nov 13, 2 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 231° |
| Cayucos | San Luis Obispo | Fri, Nov 13, 3 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 217° |
| Cayucos | San Luis Obispo | Fri, Nov 13, 4 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.2 from 211° |
| Cayucos | San Luis Obispo | Fri, Nov 13, 5 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.1 from 205° |
| Cayucos | San Luis Obispo | Fri, Nov 13, 6 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 18.3 from 202° |
| Morro Rock | San Luis Obispo | Fri, Nov 13, 1 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.4 from 226° |
| Morro Rock | San Luis Obispo | Fri, Nov 13, 2 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.9 from 230° |
| Morro Rock | San Luis Obispo | Fri, Nov 13, 11 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.5 from 260° |
| Morro Rock | San Luis Obispo | Sat, Nov 14, 12 AM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.2 from 267° |
| Morro Rock | San Luis Obispo | Sat, Nov 14, 1 AM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.7 from 278° |
| Morro Rock | San Luis Obispo | Sat, Nov 14, 2 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 279° |
| Shell Beach | San Luis Obispo | Fri, Nov 13, 1 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 222° |
| Shell Beach | San Luis Obispo | Fri, Nov 13, 2 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 229° |
| Shell Beach | San Luis Obispo | Fri, Nov 13, 5 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 209° |
| Shell Beach | San Luis Obispo | Fri, Nov 13, 6 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.7 from 203° |
| Shell Beach | San Luis Obispo | Fri, Nov 13, 7 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.4 from 202° |
| Shell Beach | San Luis Obispo | Fri, Nov 13, 11 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 268° |
| Shell Beach | San Luis Obispo | Sat, Nov 14, 12 AM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 259° |
| Pismo Beach Pier | San Luis Obispo | Thu, Nov 12, 12 PM PST | 64 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 236° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 12 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.0 from 235° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 1 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 228° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 2 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.6 from 230° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 3 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 229° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 4 PM PST | 64 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 218° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 5 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.2 from 210° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 6 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.2 from 202° |
| Pismo Beach Pier | San Luis Obispo | Fri, Nov 13, 11 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.9 from 268° |
| Pismo Beach Pier | San Luis Obispo | Sat, Nov 14, 12 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.5 from 265° |
| Pismo Beach Pier | San Luis Obispo | Sat, Nov 14, 2 AM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.5 from 284° |
| Jalama | Santa Barbara | Fri, Nov 13, 6 PM PST | 62 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 218° |
| Jalama | Santa Barbara | Fri, Nov 13, 8 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.1 from 203° |
| Jalama | Santa Barbara | Fri, Nov 13, 9 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.1 from 209° |
| Jalama | Santa Barbara | Sat, Nov 14, 12 AM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.9 from 238° |
| Emma Wood | Ventura | Sat, Nov 14, 10 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.1 from 269° |
| Emma Wood | Ventura | Sat, Nov 14, 11 AM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Emma Wood | Ventura | Sat, Nov 14, 12 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.4 from 262° |
| Emma Wood | Ventura | Sat, Nov 14, 1 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 16.4 from 259° |
| Emma Wood | Ventura | Sat, Nov 14, 2 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 17.6 from 258° |
| Emma Wood | Ventura | Sat, Nov 14, 3 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 17.0 from 256° |
| Emma Wood | Ventura | Sat, Nov 14, 4 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 15.3 from 263° |
| County Line | Ventura | Sat, Nov 14, 3 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 225° |
| El Porto | Los Angeles | Sat, Nov 14, 5 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 257° |
| El Porto | Los Angeles | Sat, Nov 14, 6 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 258° |
| El Porto | Los Angeles | Sat, Nov 14, 7 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 258° |
| El Porto | Los Angeles | Sat, Nov 14, 8 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 254° |
| Manhattan Beach | Los Angeles | Sat, Nov 14, 5 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 257° |
| Manhattan Beach | Los Angeles | Sat, Nov 14, 6 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 258° |
| Manhattan Beach | Los Angeles | Sat, Nov 14, 7 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 258° |
| Manhattan Beach | Los Angeles | Sat, Nov 14, 8 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 254° |
| Hermosa Pier | Los Angeles | Sat, Nov 14, 5 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 257° |
| Hermosa Pier | Los Angeles | Sat, Nov 14, 6 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.4 from 258° |
| Hermosa Pier | Los Angeles | Sat, Nov 14, 7 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 258° |
| Hermosa Pier | Los Angeles | Sat, Nov 14, 8 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 254° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 12 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 239° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 4 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 226° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 8 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.4 from 280° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 2 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 18.2 from 274° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 3 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.8 from 273° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 4 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.6 from 271° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 5 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.1 from 268° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 6 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.9 from 266° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 7 PM PST | 53 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.3 from 263° |
| Redondo Breakwater | Los Angeles | Sat, Nov 14, 8 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.9 from 260° |
| Redondo Breakwater | Los Angeles | Mon, Nov 16, 2 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.2 from 253° |
| Redondo Breakwater | Los Angeles | Mon, Nov 16, 3 PM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 267° |
| Bolsa Chica | Orange County | Sat, Nov 14, 1 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.1 from 247° |
| Bolsa Chica | Orange County | Sat, Nov 14, 3 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.0 from 227° |
| Bolsa Chica | Orange County | Sat, Nov 14, 4 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 236° |
| Bolsa Chica | Orange County | Sat, Nov 14, 5 AM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 228° |
| Bolsa Chica | Orange County | Sat, Nov 14, 6 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.0 from 200° |
| Bolsa Chica | Orange County | Sat, Nov 14, 3 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.3 from 266° |
| Bolsa Chica | Orange County | Sat, Nov 14, 4 PM PST | 59 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Bolsa Chica | Orange County | Sat, Nov 14, 5 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 260° |
| Bolsa Chica | Orange County | Sat, Nov 14, 6 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Bolsa Chica | Orange County | Sat, Nov 14, 7 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 260° |
| Bolsa Chica | Orange County | Sat, Nov 14, 8 PM PST | 61 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Huntington Pier | Orange County | Sat, Nov 14, 4 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.5 from 236° |
| Huntington Pier | Orange County | Sat, Nov 14, 5 AM PST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 228° |
| Huntington Pier | Orange County | Sat, Nov 14, 6 AM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.0 from 200° |
| Huntington Pier | Orange County | Sat, Nov 14, 3 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 266° |
| Huntington Pier | Orange County | Sat, Nov 14, 4 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Huntington Pier | Orange County | Sat, Nov 14, 5 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 260° |
| Huntington Pier | Orange County | Sat, Nov 14, 6 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.8 from 261° |
| Huntington Pier | Orange County | Sat, Nov 14, 7 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.4 from 260° |
| Huntington Pier | Orange County | Sat, Nov 14, 8 PM PST | 58 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 258° |
| Salt Creek | Orange County | Sat, Nov 14, 12 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 281° |
| Salt Creek | Orange County | Sat, Nov 14, 1 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 282° |
| Beacons | San Diego | Sat, Nov 14, 1 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 269° |
| Beacons | San Diego | Sat, Nov 14, 2 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 280° |
| Beacons | San Diego | Sat, Nov 14, 3 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 291° |
| Swami’s | San Diego | Sat, Nov 14, 1 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 272° |
| Swami’s | San Diego | Sat, Nov 14, 2 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 280° |
| Cardiff Reef | San Diego | Sat, Nov 14, 1 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 272° |
| Cardiff Reef | San Diego | Sat, Nov 14, 2 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 280° |
| Seaside Reef | San Diego | Sat, Nov 14, 1 PM PST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 272° |
| Seaside Reef | San Diego | Sat, Nov 14, 2 PM PST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 280° |
| Torrey Pines | San Diego | Sat, Nov 14, 1 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 272° |
| Torrey Pines | San Diego | Sat, Nov 14, 2 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 280° |
| Windansea | San Diego | Sat, Nov 14, 4 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 241° |
| Windansea | San Diego | Sat, Nov 14, 11 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.1 from 250° |
| Windansea | San Diego | Sat, Nov 14, 12 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 289° |
| Windansea | San Diego | Sat, Nov 14, 2 PM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.7 from 280° |
| Pacific Beach | San Diego | Sat, Nov 14, 3 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.5 from 249° |
| Pacific Beach | San Diego | Sat, Nov 14, 4 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.2 from 246° |
| Pacific Beach | San Diego | Sat, Nov 14, 5 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.6 from 240° |
| Pacific Beach | San Diego | Sat, Nov 14, 6 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 242° |
| Pacific Beach | San Diego | Sat, Nov 14, 7 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 232° |
| Pacific Beach | San Diego | Sat, Nov 14, 8 AM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.7 from 224° |
| Pacific Beach | San Diego | Sat, Nov 14, 9 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 222° |
| Pacific Beach | San Diego | Sat, Nov 14, 10 AM PST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.3 from 226° |
| Pacific Beach | San Diego | Sat, Nov 14, 3 PM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 285° |
| Ocean Beach (San Diego) | San Diego | Sat, Nov 14, 3 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.5 from 249° |
| Ocean Beach (San Diego) | San Diego | Sat, Nov 14, 12 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.1 from 288° |
| Ocean Beach (San Diego) | San Diego | Sat, Nov 14, 1 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.3 from 274° |
| Ocean Beach (San Diego) | San Diego | Sat, Nov 14, 2 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 279° |
| Ocean Beach (San Diego) | San Diego | Sat, Nov 14, 3 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 285° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 3 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.5 from 249° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 4 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.2 from 246° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 5 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.6 from 240° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 6 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 242° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 7 AM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.6 from 232° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 10 AM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.3 from 226° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 11 AM PST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 17.7 from 247° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 12 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.1 from 288° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 1 PM PST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.3 from 274° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 2 PM PST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.3 from 279° |
| Sunset Cliffs | San Diego | Sat, Nov 14, 3 PM PST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 285° |
| Imperial Beach | San Diego | Sat, Nov 14, 4 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.3 from 248° |
| Imperial Beach | San Diego | Sat, Nov 14, 5 AM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 12.5 from 243° |
| Imperial Beach | San Diego | Sat, Nov 14, 11 AM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 16.2 from 233° |
| Imperial Beach | San Diego | Sat, Nov 14, 12 PM PST | 55 NOT BAD (fair) | 39 WEAK (poor) | onshore 13.6 from 261° |
| Imperial Beach | San Diego | Sat, Nov 14, 1 PM PST | 52 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 276° |
| Imperial Beach | San Diego | Sat, Nov 14, 2 PM PST | 56 NOT BAD (fair) | 39 WEAK (poor) | onshore 14.1 from 275° |
| Unreals | Kauai | Wed, Nov 11, 12 PM HST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 65° |
| Unreals | Kauai | Wed, Nov 11, 1 PM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 66° |
| Unreals | Kauai | Wed, Nov 11, 3 PM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 63° |
| Unreals | Kauai | Wed, Nov 11, 4 PM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 61° |
| Unreals | Kauai | Wed, Nov 11, 5 PM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 61° |
| Unreals | Kauai | Wed, Nov 11, 6 PM HST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 61° |
| Unreals | Kauai | Wed, Nov 11, 7 PM HST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 58° |
| Unreals | Kauai | Thu, Nov 12, 3 AM HST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.4 from 66° |
| Unreals | Kauai | Thu, Nov 12, 4 AM HST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 63° |
| Unreals | Kauai | Thu, Nov 12, 5 AM HST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 57° |
| Unreals | Kauai | Thu, Nov 12, 6 AM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 55° |
| Unreals | Kauai | Thu, Nov 12, 7 AM HST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 56° |
| Unreals | Kauai | Thu, Nov 12, 8 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.3 from 58° |
| Anahola Bay | Kauai | Wed, Nov 11, 12 PM HST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 65° |
| Anahola Bay | Kauai | Wed, Nov 11, 1 PM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.3 from 66° |
| Anahola Bay | Kauai | Wed, Nov 11, 3 PM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.5 from 63° |
| Anahola Bay | Kauai | Wed, Nov 11, 4 PM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.8 from 61° |
| Anahola Bay | Kauai | Wed, Nov 11, 5 PM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 61° |
| Anahola Bay | Kauai | Wed, Nov 11, 6 PM HST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 61° |
| Anahola Bay | Kauai | Wed, Nov 11, 7 PM HST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 58° |
| Anahola Bay | Kauai | Thu, Nov 12, 3 AM HST | 50 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.4 from 66° |
| Anahola Bay | Kauai | Thu, Nov 12, 4 AM HST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 63° |
| Anahola Bay | Kauai | Thu, Nov 12, 5 AM HST | 46 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.9 from 57° |
| Anahola Bay | Kauai | Thu, Nov 12, 6 AM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.0 from 55° |
| Anahola Bay | Kauai | Thu, Nov 12, 7 AM HST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 14.6 from 56° |
| Anahola Bay | Kauai | Thu, Nov 12, 8 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 15.3 from 58° |
| Kealia | Kauai | Fri, Nov 13, 12 AM HST | 41 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 71° |
| Kealia | Kauai | Fri, Nov 13, 5 AM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.1 from 76° |
| Waihee | Maui | Sat, Nov 14, 7 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 63° |
| Waihee | Maui | Sat, Nov 14, 8 AM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 62° |
| Waihee | Maui | Mon, Nov 16, 7 AM HST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 72° |
| Waihee | Maui | Mon, Nov 16, 8 AM HST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 71° |
| Waihee | Maui | Mon, Nov 16, 9 AM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 71° |
| Waihee | Maui | Mon, Nov 16, 10 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 71° |
| Waiehu | Maui | Sat, Nov 14, 7 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.0 from 63° |
| Waiehu | Maui | Sat, Nov 14, 8 AM HST | 43 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.4 from 62° |
| Waiehu | Maui | Mon, Nov 16, 7 AM HST | 49 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.3 from 72° |
| Waiehu | Maui | Mon, Nov 16, 8 AM HST | 47 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.9 from 71° |
| Waiehu | Maui | Mon, Nov 16, 9 AM HST | 44 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.2 from 71° |
| Waiehu | Maui | Mon, Nov 16, 10 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 13.7 from 71° |
| Kapoho Bay | Big Island | Fri, Nov 13, 2 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.8 from 48° |
| Kapoho Bay | Big Island | Fri, Nov 13, 3 AM HST | 40 SURFABLE (fair) | 39 WEAK (poor) | onshore 12.6 from 51° |
