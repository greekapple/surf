# T-075 (product): the best bet must be a sized spot

Branch `worktree-product`: I merged forecast-trust (b394837) first. One commit, local only. Codex was not run (the lead runs it at merge).

- **Rule** (`src/features/home/betRank.ts`, pure, unit-tested): only a spot with a surf estimate at its window's first hour can be "your best bet".
  - Candidates rank by sized first, then verdict (Go before Worth a look), then the sooner window.
  - When no candidate is sized, the sentence says so: "No sized forecast nearby tomorrow; Ocean Beach looks best on wind alone, 7–9 AM, light offshore."
- **Next tide:** the chosen spot's nearest CO-OPS station within 40 km (`nearestTideStations`). It's the SF feed for 9414290, otherwise `bundle.stationTides`. Shown as "low 11:30 PM / Pillar Point Harbor station", with distance and "not at the beach" in the title. A dash appears only when no station is within range or none has loaded.
- **Quiver's pick:** follows the estimate as before, so it now always has one when there's a sized best bet.
- **Photo:** SpotBand already uses the manifest's credited photo whenever the chosen spot has one; only Ocean Beach, Bolinas and Linda Mar do. I didn't let photo availability affect the ranking, so the recommendation isn't biased toward photographed spots.
- **Tests:**
  - `src/tests/home-bet.test.ts` (3): a top-rated Go spot without an estimate loses to a Worth-a-look spot with one; Go beats Worth a look, then the sooner window wins; when nothing is sized, the best unsized spot is returned for the honest sentence.
  - t074 checks that a "best bet" sentence always carries a surf estimate (never "estimate unavailable"), and that the next tide names its station or is a dash.
- **Checks (5184):** tsc OK; unit tests 400/400; build OK; t074 28/0; t047 55/0; density ALL PASS; journeys 8/8. Shots: `playwright-toolkit/swello/artifacts/t075/` ("Linda Mar is your best bet tomorrow, 6–10 AM, 4–8 ft and gentle offshore", Pillar Point Harbor tide, Everyday driver).
