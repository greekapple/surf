# Offshore-only spots: find a real surf height (user request, 2026-11-11)

The user: "let's tackle every spot that just has an offshore dataset and try to find actual surf, possibly using data or reference from other surf forecasts etc. If you can't, leave it like that, it's OK."

**Owner:** eng-term, on branch `offshore-surf` from forecast-trust, after the How-right copy fix and once the Europe rerun is running in the background.
**Level:** 3. It touches the forecast headline, so the data-honesty review is mandatory.

## Why a spot is offshore-only today
The chain is `headlineCore` in `src/services/headlineSurf.ts`:
1. CDIP MOP (California);
2. SWAN (off);
3. the v1 profile estimate;
4. the offshore height labelled "offshore · not surf size".

A spot falls to step 4 when v1 can't be presented (`canPresentBreakingEstimate` false: a profile field is missing, the spot is outside the swell window, or similar), or when it has no estimate input at all.

## Steps
1. **Inventory first, before changing anything.**
   - Write `docs/forecast/OFFSHORE-ONLY.md` plus a JSON listing every spot that shows offshore-only for most daylight hours over the current 7 days, with its region and the exact reason (which input is missing or which rule refuses).
   - Report the counts by reason and region.
2. **Fill missing spot facts with cited sources.** This is the main lever.
   - Where the refusal is a missing or uncertain profile input (shore-normal bearing, exposure or swell window, break type, depth or slope class), research it the usual way:
     - public spot guides (surf-forecast.com and surfnerd pages via curl, for the facts only);
     - the coastline bearing from OSM or OpenFreeMap geometry;
     - NOAA charts or bathymetry for depth.
   - Each value carries its source URL and date in the data file, like the existing spot facts.
   - Never guess a value to unlock an estimate. If the sources disagree or are silent, leave the gap and record why.
3. **Show the NWS surf forecast where it covers the spot.**
   - The NWS Surf Zone Forecast (SRF) is an official, public-domain surf height. It is already captured hourly into R2 (`archive/surf-height/srf/`) and parsed by `services/srf-parse.mjs`.
   - For a spot that is still offshore-only after step 2 and is mapped to an SRF zone in `docs/forecast/data/surf-height-sources.json`, with the facing matched as in srf-compare: the headline becomes a new kind `official`.
     - Example: "NWS surf forecast: 6–8 ft (North-facing shores, Oahu), issued Wed 3:30 PM HST".
     - It is labelled as the NWS's forecast, not ours. It shows its issue time and its valid period (it's a per-period range, not hourly), and it is never mixed into our rating maths.
   - Serving: the Worker serves the latest SRF per zone from R2 through the existing provider path (a new key), with freshness rules: a product older than its next scheduled issue plus 6 h is shown as stale; past its valid periods, nothing is shown.
   - "N feet or less" shows as "up to N ft". Unreadable text means nothing is shown.
4. **SWAN (Hawaii):** stays OFF unless its 7-day buoy check passes. Don't change that here.
5. **Other surf forecasts (Surfline, Magicseaweed, surf-forecast.com numbers):**
   - Use them only as a hand-checked reference for steps 2–3: a spot-check table of our value against theirs for a handful of spots, noted in the doc.
   - Never scrape their forecasts, never display or store their numbers in the app, never copy their spot data wholesale.
   - Spot facts (facing, break type) from public guides are OK, cited, as now. No Surfline cameras in any form.
6. **What can't be solved stays offshore-only, honestly labelled.** Its reason is listed in `OFFSHORE-ONLY.md`. That's acceptable (user).

## Acceptance
- Offshore-only count before and after, by reason and region. Every new estimate or official value can be traced to a cited source or to the SRF product id.
- For spots that gained a v1 estimate, the srf-compare and gauge-compare numbers for those spots, before deploy. If our new estimate is wildly off the NWS (over 2× or under ½ on most zone-days), hold that spot back and say so.
- Unit tests:
  - the new `official` headline kind: labels, staleness, "or less", facing match, no SRF → offshore;
  - every changed profile value carries a source;
  - Hawaii keeps the "not Hawaiian scale" note where it applies to surf height.
- UI: the `official` kind reads clearly at 390 and 1440 on the spot page, Home, the map pill or label, Compare and the share card. Share text: "NWS surf fcst 6–8 ft".
- Gates: tsc, test, build, journeys, plus the toolkit checks for the spot page and map.
- Data-honesty review and one correction round. Then the lead merges and deploys; the user approved this deploy in the request.
