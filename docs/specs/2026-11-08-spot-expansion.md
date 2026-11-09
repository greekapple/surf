# Spot database expansion (2026-11-08)

User: "making the database of spots way more extensive. Let's expand further down the coast and then start inputting places from an area of your choice. Make a spec for this and deploy when ready."

## Where we are
- 45 spots:
  - 10 Bay Area and Santa Cruz profiles;
  - 35 coast spots from Crescent City to Imperial Beach (`src/data/coast.ts`), about one every 30 km.
- Every spot has:
  - a beach point and a marine point;
  - published-guide facts with citations (`docs/forecast/data/guide-facts.json` → `src/ocean/spotFactsSourced.ts`);
  - CDIP MOP candidates and an assignment by the facing rule (`mopCandidatesSourced.ts`, `mop.ts`);
  - the nearest tide station;
  - its NWS zone;
  - a shore-wind check;
  - the forecast service's fetch targets (`services/forecast-service.mjs`, mirrored and tested).

## Choices (lead)
1. **"Further down the coast" means south along California, filling the gaps** (Santa Cruz to the border). It does not mean Baja. Past Imperial Beach:
   - there is no CDIP MOP (nearshore model);
   - there are no CO-OPS tide predictions in the app's set;
   - there are no NWS zones.

   A Mexican spot would get only offshore model output. Baja waits until there is a source for each of those.
2. **"An area of my choice" means the San Francisco and San Mateo coast,** from Fort Funston to Año Nuevo plus the Marin headlands:
   - It is the user's home water. Linda Mar, Ocean Beach and Montara are the spots they check most.
   - MOP, tides, NWS zones and shore wind all exist there.
   - It has the densest set of named breaks per km on the coast.
3. **Order:**
   - Phase A, this round and deployed: the home area, then Santa Cruz to Big Sur.
   - Phase B, next round: San Luis Obispo to the border.

## Phase A spots (candidates; a spot ships only if its position and facts can be sourced)
- **SF / San Mateo / Marin:**
  - Kelly's Cove (Ocean Beach north);
  - Sloat (Ocean Beach south);
  - Fort Funston;
  - Sharp Park;
  - Rockaway Beach;
  - Pacifica Pier;
  - Princeton Jetty;
  - Half Moon Bay (Francis/Dunes beach);
  - Pescadero State Beach;
  - Pigeon Point;
  - Scott Creek;
  - Rodeo Beach;
  - Muir Beach.
- **Santa Cruz to Big Sur:**
  - Natural Bridges;
  - The Hook;
  - 38th Avenue;
  - Capitola;
  - Marina State Beach;
  - Andrew Molera.

About 19 spots, so 45 → about 64.

Phase B (next round): Cayucos, Shell Beach, Campus Point, Sands, Leadbetter, Hammond's, Emma Wood, Mondos, Silver Strand, Leo Carrillo, Sunset Point, Venice Breakwater, Manhattan Beach, Redondo Breakwater, Bolsa Chica, Newport 54th St, Blackies, Doheny, San Clemente Pier, T-Street, San Onofre, Oceanside Harbor, Tamarack, Ponto, Beacons, Seaside Reef, Torrey Pines, Scripps, Pacific Beach, Sunset Cliffs.

## Change
### Research (product terminal)
For each Phase A candidate:
- **The beach point:** a public map position, OSM or the park/agency page, rounded to 3 decimals.
- **The facing (seaward degrees):** from the guides, otherwise from the coastline.
- **Type:** Beach, Point or Reef.
- **A `guide-facts.json` entry** in the existing schema:
  - 2 public guides where they exist (surfnerd, surf-forecast or similar), with URLs and retrievedOn;
  - each fact attributed to its source.
- **Drop rule:** a candidate whose position can't be sourced is dropped and listed with the reason. Nothing is invented.
- **Restricted beaches:** a spot with an access restriction (Año Nuevo reserve, Pigeon Point light station) carries it in hazards, or is dropped.
- **Output:** `docs/forecast/data/phase-a-spots.json` (rows and sources), plus new entries appended to `guide-facts.json`.

### Pipeline (engineering terminal)
- **Spot rows:** add the researched rows to `COAST_ROWS` and to `coastServiceSpots` in `services/forecast-service.mjs`. The existing test keeps the two equal.
- **Rerun the generated artefacts:**
  - `scripts/mop-scan.mjs` → `mop-candidates-all.json` → `build-mop-candidates.ts` → `mopCandidatesSourced.ts`;
  - `build-guide-facts.ts` → `spotFactsSourced.ts`;
  - MOP assignment by the facing rule (`mop.ts`), and `mopServiceIds`;
  - the slope (`mop-slope*.ts` → `nearshoreSlopeSourced.ts`);
  - tide stations: the nearest CO-OPS (`tideStations.ts` and `tideHiloServiceStationIds`, kept in sync);
  - NWS zones (`nws-zones.ts` → `nwsZones.ts`);
  - shore wind (`build-shore-wind.ts`).
- **Fetch budget:** Open-Meteo's free tier allows 10,000 calls a day.
  - Today each spot costs about 112 calls a day: marine and weather every 30 min, spread every 90 min.
  - At 64 spots that is about 7,200 a day. At Phase B's roughly 95 spots it is about 10,600, over the limit.
  - Retune now:
    - marine every 3 h (the wave models run every 6–12 h);
    - weather every 1 h (HRRR is hourly);
    - spread as it is.
  - That is 48 calls per spot per day: about 3,100 a day at 64 spots and 4,600 at 95.
  - Also check the Cloudflare cron's per-run subrequest slice still covers every target within its TTL.
  - The freshness rule ("2 h", T-084) must still hold for the weather. Marine labels already show the model valid time.
- **Map at about 64 spots:** label collisions and the "top few labelled" rule must hold (t043 map, t013 overlap). Check performance (t091).

### Lead
- **Review:** the rows and facts are spot-checked against their sources (5 at random), and both diffs are reviewed.
- **Merge:** research first, then the pipeline.
- **Gate:** run every check.
- **Data honesty:** a review of the new facts and labels.
- **Look:** the map, the spot list and three new spot pages, at 1440 and 390.
- **Ship:** deploy (the user said "deploy when ready"), then the report.

## Acceptance
- At least 15 new Phase A spots live:
  - each with a sourced position and facts;
  - a MOP assignment or an honest "no matching MOP point";
  - a tide station and an NWS zone;
  - rated by the same engine.
- No invented fact: every guide fact carries its source, and a dropped spot is listed with its reason.
- Open-Meteo calls per day, computed from the targets and their TTLs, are under 5,000 at the new count. Shown in the handoff.
- The map at 1440 and 390 is not more crowded at default zoom: the label rule holds, and t043 and t013 pass.
- tsc, tests, build, journeys, t034, t043, t062 and t104 pass. The deploy is verified on the production URL.

## Level
- Level 2 to 3: new data rows, plus a change to the fetch cadence (production infrastructure, within the free tier).
- The cadence change is covered by the user's "deploy when ready". No money is spent; free tiers only.
