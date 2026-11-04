# Spots: every spot shows a surf height, never just the offshore number
Status: **DRAFT, waiting for the user's approval** (user 2026-11-04: "I want every spot that we have so far to have real wave heights, not just offshore estimates").

## Context
- 45 spots (`src/data/catalog.ts`). The headline number is decided in `src/services/headlineSurf.ts`, in this order:
  1. **CDIP MOP nearshore model** (`mop-v2`): the spot's MOP point (a 10 m-depth wave model run per stretch of coast) plus our breaking rules (`breakingV2.ts`).
  2. **v1 estimate** from offshore swell plus the spot's breaking profile (facing, swell window, bottom, shelter; `localCalibration.ts` / `spotFactsSourced.ts`).
  3. Otherwise **"offshore · not surf size"**.
- **Coverage today:**
  - 40 spots have a MOP point and a breaking profile;
  - 1 has a profile only;
  - **4 have neither: Mavericks, Cowell's, Shelter Cove, Rincon.** They can only ever show the offshore number.
- **The T-077 fallback rule:** when the nearshore model has the hour but our rules say the swell can't make surf here (`outside-window`, `short-period`, `no-break`), the spot shows the labelled **offshore** height instead. That's why Bolinas reads "6 ft offshore" on today's NW swell, although the model *has* a nearshore value.

## Problems
1. Four spots never get a surf height.
2. Spots with a nearshore model value still show the offshore number whenever the swell is blocked or too short. This is exactly when the offshore number misleads most: Bolinas shows "6 ft" while its real surf is small.
3. "Real wave heights" in the strict sense means measurements, and almost no spot has a measuring instrument (a few have a nearby CDIP buoy or a nowcast).

## Target
- **Every spot, every forecast hour with data,** shows a **surf height at the spot**: a model estimate, labelled as one, with its method (as today's estimates are), or an honest "Flat · swell blocked here".
- **The offshore number becomes secondary detail,** never the headline.
- **Where a nearby measurement exists** (CDIP nearshore nowcast or buoy), the current hour says "measured nearby" with the source.
- **References:** Surfline shows a surf range at every spot, including "Flat"; CDIP MOP is the same public NOAA/Scripps nearshore model we already use.

## Constraints
- **Data honesty** (`PRODUCT.md`, `docs/agents/CONTRACTS.md`):
  - never call a model estimate "real" or "measured";
  - every number names its method;
  - spot facts (facing, swell window, bottom) come from public sources with citations, never invented;
  - nothing feeds ratings without tests.
- No paid data. CDIP MOP and Open-Meteo are free; the MOP points along the California coast are public.

## Approach
1. **The 4 missing spots (Mavericks, Cowell's, Shelter Cove, Rincon):**
   - research their facing, swell window, bottom and shelter from public sources (surf guides, NOAA charts, CDIP), with citations in `spotFactsSourced.ts`;
   - assign each its nearest valid CDIP MOP point (the California MOP grid covers all four).
2. **Blocked or short-period hours:** replace the "offshore" fallback with the nearshore model's own height at the spot (MOP already includes the blocking and refraction), shown as a small range, e.g. "0–1 ft · swell mostly blocked here". If the model's value is under the flat threshold, show "Flat". The offshore height stays in the detail line.
3. **Measured nearby:** when the CDIP nowcast for the spot's MOP point or a nearby buoy covers the hour, show "measured nearby" on the current hour (the nowcast path already exists in `nearshoreSelect.ts`).
4. **Re-check the 40 + 1 covered spots** against CDIP MOP for a week of hours. Any spot whose estimate is off from MOP by more than 1 ft on average gets its profile reviewed, with sources.

**Rejected:**
- **Scaling the offshore height by a fixed factor per spot:** invented, and wrong on blocked swells.
- **Calling estimates "real":** dishonest.

## Owners and level
- **Level 3:** it changes forecast numbers, though not ratings.
- **Lead:** spot-fact research for the 4 spots, with citations.
- **Engineering** (branch `spot-heights`):
  - MOP assignments;
  - the fallback change;
  - "Flat" and "measured nearby";
  - tests.
- **Product:** the labels on Home, the forecast pages, the map pins and the cards.
- **Review:** `data-honesty-reviewer` before merge.

## Acceptance
1. A script over all 45 spots × the next 7 days: every hour with data shows `estimate` or `flat`. `offshore` as the headline = 0. The 4 new spots are estimated.
2. A Bolinas-style blocked hour shows a small range or "Flat" consistent with MOP's nearshore value (±0.5 ft).
3. Every estimate's method label is present; "measured nearby" appears only when a measurement covers the hour.
4. The week-vs-MOP comparison table for all spots, with outliers reviewed.
5. tsc, tests, build, journeys 8/8, the data-honesty review clean, and 1440/390 shots of Home, a spot page and the map, looked at.

## Open questions (the user's)
1. **Blocked swell:** show the model's small nearshore range (recommended), or just "Flat · blocked"?
2. **Wording:** keep "surf estimate" on the numbers (recommended: honest and short), or a different label?
