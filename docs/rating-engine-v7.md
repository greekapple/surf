# v0.7 provisional offshore potential

The real-data adapter now selects a reduced **Provisional** assessment when there is no validated nearshore method. It does not estimate breaking-wave height or use the illustrative demo spot profiles. The preserved SQI/Personal Match and board recommendation engines remain unchanged. All general ratings are independent of profile and boards.

Essential inputs at exactly the selected timestamp: combined offshore Hs, primary swell height/period/from-direction, wind speed/from-direction. Null, nonfinite, physically invalid or mismatched-timestamp inputs return UNRATED (no score), never FLAT. Optional gusts/secondary swell and verified local inputs are explained individually; absence is not silently treated as ideal. No real spot in this release is calibrated.

## Deterministic heuristic, configurable in src/ratings/provisional.ts

All heights below are feet, periods seconds, speed mph. Clamp means restrict to 0–100. This is a product heuristic, not fitted physics or demonstrated forecast accuracy.

- Wave potential (40%): clamp(0.65 × clamp(primaryHeight × 25) + 0.35 × clamp((period − 4) × 10) − max(0, combinedHs − 10) × 8). Rewards moderate offshore energy/period; excessive Hs is penalized. It is not a breaking-height conversion.
- Wind (30%): without verified orientation, clamp(70 − 2 × speed − gust penalty), with no offshore bonus. Gust penalty = 1.5 × max(0, gust − speed − 5), only when gusts are supplied. With verified orientation, the documented existing shore-relative speed coefficients 1.6/4/2.8 for offshore/onshore/cross-shore can apply. All current real orientations remain unknown.
- Offshore organization indicators (30%): clamp(35 + 35 × min(1, primaryHeight² / combinedHs²) + min(30, max(0, period − 6) × 3) − crossing penalty). Zero combined Hs gives ratio zero. Crossing penalty, only if complete secondary swell exists, = min(25, 25 × min(1, secondaryHeight / max(primaryHeight, 0.01)) × angular separation / 180). This is a bulk-model coherence proxy, not observed breaking-wave organization.
- Swell alignment and tide compatibility: explicitly shown, zero weight in this reduced model. Regional tide is not a locally verified surfing preference. These weights do not get silently redistributed; the three-input model is specified separately from the older five-factor SQI.

Round the weighted baseline. Unknown local orientation/exposure caps score at 74 (SOLID). Wave potential below 25 or wind factor below 25 caps score at 39 (WEAK). Zero combined and primary offshore height caps score at 24 (POOR offshore potential), never observational FLAT. Unvalidated potential cannot exceed 94. These unvalidated caps are transparent product rules.

Current real ratings have LIMITED reliability when essential model inputs exist, INSUFFICIENT otherwise. Retrieval freshness, missing issue time and lack of local verification are explained. No confidence percentages. A high score does not imply reliable accuracy or safety. Unknown hazards remain unknown and do not become favorable inputs.

The calibrated path retains v0.6 interaction rules and reliable local Flat evidence requirements. A Calibrated label additionally requires a documented method, locally verified inputs, and a positive validation sample record, in retrieved mode. No current adapter supplies those.

Exact categories retained: POOR 0–24, WEAK 25–39, SURFABLE 40–54, NOT BAD 55–64, SOLID 65–74, GOOD 75–84, FIRING 85–94, EPIC 95–100. Flat is a separate evidence override; Unrated is insufficient data.
