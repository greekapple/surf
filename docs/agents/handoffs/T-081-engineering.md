# T-081 handoff (engineering)
- Board Match (`ocean/match.ts`), the estimate view (`features/forecast/estimate.ts`), the rating's wide-range ceiling (`ratings/provisional.ts`, `windRules.uncertaintyCeiling`) and the observation context now read the convention surf height and its uncertainty (`services/surfRange.ts`), not the legacy breaking range. Ceiling: half-width >= 0.25 (judgement call, about 4 days lead) caps at SOLID; replaces the 4 ft width rule.
- Known limit (documented in CONTRACTS): Match and the estimate view use the record's v1 figure; where MOP data exists the headline uses v2, so they can differ there. Fix later by routing them through `headlineSurf`.
- v1 now starts from TOTAL Hs: MOP/v1 median 1.06 (was 1.16 from the swell partition), p10-p90 0.91-1.28 (n=782), so wStep = 0.1705.
- Hawaiian scale: exact halving of the surf height (units.ts), copy says "about half"; Surfline/secondary sources say half or sometimes two-thirds, so no change to the factor.
- Reviewer: no P0; P1/P2s fixed (rating uses the same v1 interval, constant shared, nowMs parameters, comments, CONTRACTS); dead `rangeCeiling` kept (tested legacy).
- Not done: open P2s in docs/reviews/*.md beyond these; v1-only Match for v2 spots.
- Checks: tsc, 417 tests, build, journeys 8/8, t045/t055/t065/t073/t074 pass.
