# T-008 Engineering handoff: breaking-wave estimate range (data and validation, no UI)

**Branch:** `worktree-engineering` (synced to `3bd3eb3` first)

## What changed
- `src/ocean/breakingEstimate.ts` (new, pure): `estimateBreaking` → `WaveHeightInput {kind:'breaking-estimate', rangeFt, rangeMethod "… unvalidated v1"}` or a refusal code and reason. Kd = sqrt(max(0, cos Δ)), Hb = 0.39·g^0.2·(T·(Hs·Kd·Ksh)²)^0.4, range = Hb × [0.7, 1.4] rounded outward, minimum 2 ft, never below 0.
- `src/ocean/localCalibration.ts`: `breakingProfiles` / `breakingProfile(spotId)`. Only spot-2: faceFactors [0.7, 1.4], window 203–323° (normal ±60°, lead decision), minPeriod 8 s, shelter 1 (both lead-set, not measured).
- `src/ocean/types.ts`: optional `OceanRecord.faceEstimate` (`{input}` or `{refusal}`); `face` untouched.
- `src/ocean/openMeteo.ts`: attaches `faceEstimate` from primary swell (wind-sea check uses the combined `wave_height`).
- `src/utils/waveHeight.ts`: `canPresentBreakingEstimate` now needs width ≥ 1 ft and a versioned method (`v<number>`). `formatWaveHeight` unchanged, so it still renders unversioned ranges; only the guard is stricter.
- `src/tests/breaking-estimate.test.ts` (8 tests): each refusal, width rules, window wrap, guard, Bolinas and Linda Mar refusing on null orientation.
- `docs/agents/CONTRACTS.md` (breaking-estimate lines), `docs/forecast/T-008-validation.md`, `docs/forecast/data/` (raw NDBC 46026, CDIP MOP SF023 nowcast, `t008-pairs.csv`, `validate-t008.ts`).
- Ratings untouched (`rateOcean` not fed); no `src/features/*` changes.

## Checks (real output)
- `npx tsc --noEmit`: clean. `npm test`: 176 pass, 0 fail. `npm run build`: built.
- `journeys.mjs` on 5185: 8/8 passed, no unexpected browser errors. Dev server stopped. No UI change, so no screenshots.

## Validation (details in `docs/forecast/T-008-validation.md`)
- 1068 paired hours, 2026-09-16 to 2026-10-30; 782 produced an estimate (after correction). See the doc for the table.
- MOP is modelled nearshore Hs at 10 m, not observed face height. This validates only the offshore-to-nearshore step; the estimate stays unvalidated for face height. The MOP hindcast file returned no data for the window; only the nowcast was used.

## Correction cycle 1 (lead review)
- Window set to 203–323°. Re-run: 782 of 1068 hours produce an estimate; bias +1.38 ft, MAE 1.47 ft, coverage 92%. NW 315° hours: n 238, bias +0.87 ft, coverage 94%. New test: 315° gives a range with Kd < 1. tsc clean, 176/176 tests, build OK.
- The 0.7 factor makes MOP Hs coverage look good; that does not say the face range is right.

## Incomplete
- No face-height observations, so no empirical 80% interval. No UI. Not merged or pushed.
