# T-071 handoff (engineering): estimates from published spot guides

See `docs/forecast/ESTIMATE-COVERAGE-T071.md` for the coverage table, the covered and uncovered lists, the rules and the limits.

- Research: facts for all 45 catalogued spots from Surfnerd and Surf-Forecast.com spot guides (4 research subagents, each fact with page URL and retrieval date; paraphrased, no copied text), in `docs/forecast/data/guide-facts.json` -> `docs/forecast/data/build-guide-facts.ts` -> `src/ocean/spotFactsSourced.ts`.
- Rules: `src/ocean/spotFactsRules.ts` (enablement, ±60° window clamp, MOP facing-match, generic 8 s period). `Sourced<T>` gained `provenance` ('published guide', 'published guide (generic)', 'agency data').
- Wiring: guide facing fills `evidenceSpots[].orientation` where null; `breakingProfiles` gets a profile per enabled spot; `spotProfiles` for all 45; `mopAssignments` gets Linda Mar SM375 (also added to the Worker's `mopServiceIds`).
- Coverage 1 -> 30 of 45 spots with an estimate profile; 26 of 45 had an estimate in the next 72 h on the live check. Rating distribution after: largest category 36.6% (NOT BAD), SOLID 20.7%.
- Tests: 373 pass (new `spot-facts-rules.test.ts`: enablement rules, window clamp incl. wrap, MOP facing-match, generic period, provenance on every entry and derived value, coverage counts; old tests that encoded "only Ocean Beach" updated).
- Browser: journeys 8/8, t045, t047, t055, t065, t067 pass; new `t071-coverage.mjs` passes (Linda Mar, Montara, Moss Landing, Carmel show 7 of 7 day cards as estimates with the Surf card labelled; Stinson Beach and Cowell's stay labelled offshore). Shots in `playwright-toolkit/swello/artifacts/t071/`.
- The review sheet `SPOT-FACTS-REVIEW.md` is regenerated (all 45 spots with citations); its header no longer says nothing is used until approved.
