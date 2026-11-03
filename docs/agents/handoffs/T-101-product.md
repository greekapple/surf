# T-101 (product): no AI wave photo anywhere
Branch `t101-no-ai-photo` from forecast-trust 021b150. Spec: docs/specs/2026-11-03-wave-surfer-follow-up.md (APPROVED, user: "remove it entirely").

## Changes
- `ScaleStage.tsx`: removed the photo block, the `photo` state and the `Media` import. That is the only change in this file; the 3D block and WaveLive are untouched.
- `services/waveScale.ts`: `ScaleBand` has no `media`; `SCALE_CAPTION` was dropped (its only user was the test).
- `ui/mediaModel.ts`: `AI_SCALE_CAPTION` was removed; the generic `AI_CAPTION` is now the only allowed AI caption.
- `public/media/manifest.json`: 8 `ai-scale-*` entries removed (deletions only). `public/media/ai/ai-scale-*` (16 stills and 4 loops) removed with `git rm`.
  - Nothing else used them. `BoardPicture.tsx` and `cutout.ts` refer only to `ai-board-*` (board type art), which stays.
- `public/media/PROMPTS.md`: the table is kept as provenance, with a "Removed 2026-11-03 (T-101)" note.
- `scale.css`: the `.sc-photo*` rules were removed.
- Tests:
  - `wave-scale.test.ts`: the manifest check is replaced by a T-101 guard (no `ai-scale` entries or files, no band `media`, no photo in ScaleStage).
  - `media.test.ts`: the old scale caption is now rejected.

## Checks
- tsc OK; 461 tests pass; build OK.
- Browser on :5184, 1440 and 390, in both 3D and Diagram:
  - no photo or button, no AI text, no `ai-scale` requests;
  - no page errors, no horizontal overflow;
  - 3D canvas renders.
  - Shots: `artifacts/t101/`.
- Toolkit (already updated by engineering for T-101):
  - journeys 8/8 (journey 7: "there is no AI photo");
  - t052 ALL PASS on rerun. The first run printed SOME FAILED; this is the known flaky 15+ ft band check that also fails on :5180.
- Assertions involved: journeys 7 (lines 302–303), t052 line 52 and t033-shots line 23. All three now assert that there is no photo; no further toolkit change is needed.

## Not changed
- `selectScaleBand` notes still say "illustration" ("Smaller than the smallest illustration…"). Only the tests use that function. SpotPage imports it, but grep finds no call.
