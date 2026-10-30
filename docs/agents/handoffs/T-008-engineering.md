# T-008 Engineering handoff: breaking-wave estimate range (data and validation, no UI)

**Branch:** `worktree-engineering` (synced to `3bd3eb3` first)

## What changed
- `src/ocean/breakingEstimate.ts` (new, pure): `estimateBreaking` → `WaveHeightInput {kind:'breaking-estimate', rangeFt, rangeMethod "… unvalidated v1"}` or a refusal code and reason. Kd = sqrt(max(0, cos Δ)), Hb = 0.39·g^0.2·(T·(Hs·Kd·Ksh)²)^0.4, range = Hb × [0.7, 1.4] rounded outward, minimum 2 ft, never below 0.
- `src/ocean/localCalibration.ts`: `breakingProfiles` / `breakingProfile(spotId)`. Only spot-2: faceFactors [0.7, 1.4], window 240–300°, minPeriod 8 s, shelter 1.
- `src/ocean/types.ts`: optional `OceanRecord.faceEstimate` (`{input}` or `{refusal}`); `face` untouched.
- `src/ocean/openMeteo.ts`: attaches `faceEstimate` from primary swell (wind-sea check uses the combined `wave_height`).
- `src/utils/waveHeight.ts`: `canPresentBreakingEstimate` now needs width ≥ 1 ft and a versioned method (`v<number>`). `formatWaveHeight` unchanged, so it still renders unversioned ranges; only the guard is stricter.
- `src/tests/breaking-estimate.test.ts` (8 tests): each refusal, width rules, window wrap, guard, Bolinas and Linda Mar refusing on null orientation.
- `docs/agents/CONTRACTS.md` (breaking-estimate lines), `docs/forecast/T-008-validation.md`, `docs/forecast/data/` (raw NDBC 46026, CDIP MOP SF023 nowcast, `t008-pairs.csv`, `validate-t008.ts`).
- Ratings untouched (`rateOcean` not fed); no `src/features/*` changes.

## Checks (real output)
- `npx tsc --noEmit`: clean. `npm test`: 175 pass, 0 fail. `npm run build`: built.
- `journeys.mjs` on 5185: 8/8 passed, no unexpected browser errors. Dev server stopped. No UI change, so no screenshots.

## Validation (details in `docs/forecast/T-008-validation.md`)
- 1068 paired hours, 2026-09-16 to 2026-10-30; 499 produced an estimate. Bias +1.59 ft, MAE 1.63 ft, range covers MOP Hs 91% overall (79% at ≥16 s, 97% at 10–13 s).
- MOP is modelled nearshore Hs at 10 m, not observed face height. This validates only the offshore-to-nearshore step; the estimate stays unvalidated for face height. The MOP hindcast file returned no data for the window; only the nowcast was used.

## Needs a decision
- Window 240–300°, minPeriod 8 s and Ksh = 1 are my assumptions, not reviewed. 253 of the 364 outside-window refusals are buoy "NW" (315°), which Ocean Beach does receive, so the window is probably too narrow. I did not change it.
- The 0.7 factor makes MOP Hs coverage look good (91%); that does not say the face range is right.
- Open-Meteo hours were not validated (no archive fetched); validation used NDBC swell as the offshore input.

## Incomplete
- No face-height observations, so no empirical 80% interval. No UI. Not merged or pushed.
