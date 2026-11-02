# T-047 Engineering handoff: Home as a dashboard of your spots

## What Home is now (`src/features/home/*`)
No hero, no "Hello", no photos, no full-bleed panels. Inter only (theme `--sans`).
1. **"Your spots"** (or "Popular spots, not personalised" with a link to choose favourites): one dense card per saved spot (max 12): name + region; rating word + **5-segment bar**; the **headline surf** from `headlineSurf` (e.g. "4–9 ft", body words "chest to overhead ~", tag "model estimate", and under it "≈ 5 ft offshore · not surf size"); spots without a presentable estimate show the labelled offshore height ("6 ft [offshore]", "offshore · not surf size"); **Wind** (speed, direction, onshore/offshore/unknown), **Tide** (rising/falling + height), **Best today** (best remaining *daylight* window from the existing rating, or "No good daylight window left"). The whole card opens that spot's forecast.
2. **"Best right now nearby"**: spots within 100 km of your first saved spot (or the selected spot), excluding those already shown, rated only (no demonstration or unrated), highest current rating first, with distance, labelled surf and the rating bar.
3. One honest line: ratings are provisional; heights are estimates of the breaking wave or labelled offshore.

## Data layer (`src/services/homeDash.ts`, pure) + tests (`src/tests/home-dash.test.ts`, 7)
`dashCard`, `bestNearby`, `bestWindowToday` (daylight only, civil twilight, existing rating threshold 55), `ratingBars`, `windowLabel`. Uses `headlineSurf` (T-046) and the existing `rateForecast`/`spotReport`; **the surf estimate never feeds the rating or the windows**. **281 tests pass**, tsc clean, build ok.

## Proof
`t047-home.mjs` **ALL PASS** at 1440 and 390, saved and popular: no hero/greeting, a card per spot with name, tagged height, rating bar, wind, tide, best window; no bare number (every height has its tag); one font family (Inter); **1440 height 900 px (one viewport; limit 2)**, 390 about 1,770 px; no overflow; no photo/AI image; tap target ≥ 44; tapping a card opens that spot's forecast; 0 console errors. Shots in the toolkit `artifacts/t047/{1440,390}-{saved,popular}-{fold,full}.png`.

Toolkit scripts updated for the new Home (they asserted the old hero or "no forecast numbers"): `journeys.mjs` (1, 6), `t022-nav.mjs`, `t031-firstview.mjs`, `t034-density.mjs` (`.dc-val` is a card value like a hero number), `t038-no-ai.mjs`. With these, `t031-firstview`, `t022-nav`, density Home pass.

## Honest notes
- **The Ocean Beach range is wide (4–9 ft, "chest to overhead")**: v2's unvalidated 0.7–1.4 face-factor band on a ~6.5 ft central value. It is what the method gives; narrowing it needs validation data (the session log), not a cosmetic change. Where only offshore data is presentable (Linda Mar, Bolinas, most coast spots) the card says so.
- Wind relation reads "unknown" for spots with no reviewed orientation (Linda Mar, Bolinas): honest, and a reason to approve the review list.
- **The saved-spots strip (favbar) under the nav still repeats the same spots with heights** on Home; it is in the shell (not my files). Suggest hiding it on Home now that the dashboard shows them.
- **Journeys 3, 4, 6 and the Explore density rows fail against my branch only because the toolkit already targets product's unmerged T-045/T-043 selectors** (`.sp-grid`, `[data-card]`, Explore callout). journeys.mjs defaults to port 5180 (lead's server); I ran it with 5185 explicitly. Journeys 1, 2, 5, 7, 8 pass, and journey 6 passes up to its Forecast step.
- The Nearshore card still says "Experimental, off by default" for v2 behind the localStorage flag, although the headline now uses v2 by default at Ocean Beach; I left the wording so `t041-flag.mjs` keeps working. Suggest rewording when product touches that card.
