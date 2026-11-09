# Clocks, phone speed, map deselect, Hawaii, rating check (2026-11-09)

The user, after 384 spots went live (bd3760ae):
- "do that, do all the fixes";
- "the forecast that is selected, such as Ocean Beach, stays there while you zoom out; there needs to be an option where you can unselect and just have nothing selected";
- "make a spec for earlier progressions and then deploy".

"Earlier progressions" means the lead's recommended list:
1. the clock follows the spot;
2. phone speed;
3. a rating check for the new regions;
4. the rest of Hawaii, then Australia;
5. catalogue cleanup.

Deploy approval was given in that message for the batches below that pass the full gate.

## Ground truth
- **Clocks.** The app has one fixed "map clock", `MAP_TIME_ZONE` (America/Los_Angeles; `src/ocean/spotZone.ts:21`). It drives:
  - the top-bar badge "Model data · 1:07 PM PST" (`src/app/Nav.tsx:196-197`), which shows PST even on Pipeline, where the page says HST;
  - the Explore time bar and labels (`ExploreView.tsx:549,720`, `mapTime.ts`);
  - `spotZoneTag` in the Forecast view (`ForecastView.tsx:80`).

  Spot cards already use the spot's own zone (C1).
- **Selection.** The app store always has a selected spot (`view.selected`). On Explore that spot:
  - keeps its label and pin at every zoom (`ExploreView.tsx:304,350`);
  - fills the phone peek sheet;
  - is what the centre button flies to.

  There is no way to have nothing selected.
- **Phone speed.** At 146 spots, Home on a 390-wide screen had 2.6 s of main-thread blocking (TBT), against about 1 s at 59. It has not been measured at 384.
- **Ratings.** `rating-audit.ts` measured how often California ratings say "fair or better" when observed conditions were poor. Its observed surf comes from CDIP MOP, which is California only. Hawaii (44 spots) and the East Coast (238) are rated by the same engine with no such check.
- **Hawaii catalogue.** 152 sourced spots: Oahu 59, Maui 32, Big Island 31, Kauai 20, Molokai 5, Lanai 4, Niihau 1. Of these, 44 Oahu North and South Shore spots are in the app.

## Batch 1: deploy when gated
### 1A. The clock follows the spot you're looking at (product-term)
**The rule.** Every clock label shows the zone of the spot it describes.
- **When a spot is in view** (its Forecast page, or the spot selected on the map), the clock is that spot's zone:
  - the top-bar badge;
  - the Explore time bar, day strip and hour labels;
  - the map's "when" text.
- **When no spot is selected on the map** (see 1B), it is the viewer's own zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- **Home** shows several spots, so it uses the viewer's zone.

**Labels.** A zone abbreviation appears wherever it differs from the viewer's own zone, and always on the map. No label ever shows a time in one zone with another zone's abbreviation.
- **Shared time steps.** The map's time steps are shared UTC instants, so only their labels change, not which hours exist.
- **Day boundaries.** Day boundaries on the strip follow the label zone.

`MAP_TIME_ZONE` stops being a fixed constant. It becomes a hook or selector: the label zone for the current view.

**Acceptance:**
- **Pipeline:** the badge and the map show HST.
- **Cocoa Beach:** they show EST.
- **Ocean Beach:** PST.
- **Map with nothing selected:** the viewer's zone. Tested with the browser in America/Los_Angeles and in Europe/London (Playwright `timezoneId`).
- **Unit tests:** day boundaries for Honolulu and New York on the strip.
- **Existing California output:** unchanged for a Los Angeles viewer. The t043 hour-bubble regex must still pass.

### 1B. Deselect on the map (product-term)
**A map-only focus state.** The app's selected spot stays as it is, so Forecast still opens your last spot. The map gets "no spot focused":
- **Ways to clear it:**
  - a clear (×) control on the selected spot's map card or chip, named "Clear selection";
  - the Esc key;
  - tapping or clicking empty map (not a pin) on desktop.

  On phones, the peek sheet's × clears it.
- **With nothing focused:**
  - no pin is highlighted;
  - the selected spot gets no label priority: labels go to favourites, popular and best-rated, by the same declutter order without "selected";
  - the phone peek sheet shows the spot list (or a "Pick a spot" line), not a spot;
  - the centre button becomes "my location" only;
  - the time labels use the viewer's zone (1A).
- **Picking a pin or a list row** focuses that spot again, as today.
- **The URL** records it (`mapUrl.ts`), so reload keeps "nothing focused".

**Acceptance (Playwright at 1440 and 390):**
- select Ocean Beach → zoom out to z5 → clear → no highlighted pin and no Ocean Beach label at z5 (unless favourited);
- Esc works;
- reload keeps the state;
- picking a pin re-selects;
- a screenshot at each step, looked at.
- **No regressions:** t043, t013 and journeys pass.

### 1C. Phone speed at 384 spots (eng-term)
- **Measure.** Run t091 perf at 390 and 1440 on 384 spots. Record LCP and TBT for Home, Forecast and Explore.
- **Find and fix** the top main-thread costs on Home at 390. Likely candidates, to be confirmed by profile, not assumed:
  - rating or `rateForecast` work for spots not on screen;
  - the week table computing every spot;
  - spot-list or regional work scaling with the catalogue;
  - JSON parse of the full spot set.
- **Target:** 390 Home TBT ≤ 1.0 s (the 59-spot level), with no change to any rating or number shown. Byte-compare a snapshot of rendered ratings for the home spots before and after.
- **Acceptance:** t091 before and after, in the handoff; gates pass.

**Gate and ship.** Batch 1 merges to forecast-trust (product branch first, then engineering).
- **Gate:**
  - tsc, the tests and the build;
  - journeys warm, t043, t062, t104 and t034;
  - t091 last.
- **Reviews:**
  - code-reviewer on 1A, 1B and 1C;
  - data-honesty on 1A, because clock labels are data labels.
- **Ship:**
  - the lead looks at 1440 and 390 screenshots;
  - port and push swello-v0.17;
  - deploy, then verify on production with the Access service token.

## Batch 2: deploy when gated
### 2A. The rest of Hawaii (eng-term, after 1C)
- `add-spots.ts --region hawaii` for the 108 catalogued spots not yet in the app: Maui, Big Island, Kauai, Molokai, Lanai, Niihau, and Oahu East and West.
- **US data applies:**
  - CO-OPS tides by the open-coast rule plus reviewed overrides, with Hawaii stations checked against harbour, bay and estuary exposure (as for the East);
  - NWS HIZ zones;
  - CDIP or NDBC buoys within range, with sheltered ones labelled.
- **Drops.** A spot whose only tide station is closed or inside a harbour, with no open-coast alternative, shows the fallback label. One with no sourced facing is already excluded.
- **Data-honesty review** with 5 random spots fetched against their sources. P0/P1 fixed in one cycle.
- **Expected:** 384 → about 490.

### 2B. Rating check for Hawaii and the East (lead, via an agent; a report, no rating change)
**A buoy-based variant of `rating-audit.ts`.** Where a spot has an open-ocean wave buoy within 40 km on its swell window, and a measured wind (NDBC met or ASOS by the existing 7 km shore rule), compute the same "fair or better while poor" rate as the California audit:
- the forecast-fed rating on Open-Meteo archived hours;
- the observed-fed rating on buoy Hs, period and direction, plus the measured wind.

**Labelling.** Measured buoy Hs is offshore swell, not breaking surf. The report says so, and it does not call it surf height.

**Windows:** the last 30 days and the most recent winter.

**Output:**
- `docs/forecast/RATING-AUDIT-HI-EAST.md` and its JSON: per region, per spot where data exists, the hours used;
- a vault note.

**Calibration.** Any change to the rating engine comes back as a proposal for a separate change. This round changes no rating.

### 2C. Catalogue cleanup (agent; catalogue and vault only)
- **181 rows with no published break type:** look for a second published guide stating it. If found, record it with its source. If not, it stays null (shown as none).
- **41 pins more than 3 km from the coastline map:** re-source the position (OSM, or a guide pin that sits on the coast), or drop the row with the reason.
- **Updates:** the world JSON, the spot notes and World-Coverage-and-Gaps.

## Batch 3: next round (spec only; not this deploy)
**Australia, the first non-US region:**
- wire AODN THREDDS wave buoys (CC BY, keyless) as an observed source, with a data-honesty review;
- the C2 "not available in this region" path for tides and alerts until a public tide source is wired (BoM tide predictions licence to be checked first);
- then add-spots for NSW and Queensland in batches.

It needs its own spec and a check that Open-Meteo's global marine model covers each spot's grid cell (no land cells).

## Owners and order
- **product-term:** 1A, then 1B. One owner, because both touch Explore and Nav.
- **eng-term:** 1C, then 2A.
- **Lead:** reviews, merges, gates and deploys. Runs 2B and 2C as agents in isolated worktrees.
- **Pace:** 2 terminals plus at most 2 agents.

## Level
Level 3: UI behaviour, label correctness, a perf refactor, and new data rows. Deploys are approved by the user for gated batches.
