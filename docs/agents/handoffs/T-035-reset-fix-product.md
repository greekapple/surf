# T-035 regression: "Reset returns to the start view" — Product handoff (2026-11-01)

Branch `worktree-product`, merged `rebuild/swello-v0.16` (00bd9a1) first.

## Cause: the camera, not the test
- **Symptom.** After Reset, the camera radius and elevation matched the start view exactly, but the azimuth stopped about 3.4° short. At 1440 that is [37.24, 74.4, 74.19] against the start [41.29, 75, 71.51].
- **Why.** OrbitControls damping (factor 0.08) keeps a decaying rotation delta after a drag. The render loop calls `controls.update()` after the Reset tween writes the camera, so that leftover drag rotation was still being applied during and after the glide.
  - At 60 fps it decays to almost nothing before the tween ends.
  - At about 15 fps, when the machine is busy, around 3° remains. That is why it passed at merge and fails on a loaded lead.
- **Reproduced.** I added an optional switch to the test, `T035_CPU=6`, which throttles the CPU through CDP. With it and without the fix, the test gives [37.02, 74.36, 74.32] at 1440 and [52.06, 97.8, 101.38] at 390, essentially the lead's numbers.

## Fix
`src/features/quiver/studio.ts`: a new private method `still()` drops the orbit inertia. It turns damping off, runs one update, and turns damping back on. It is called at the start of `glide()` and `snapFrame()`, so presets, Reset and framing land exactly where they were aimed. Drag feel is unchanged.

## Checks (real output, against 5184 = my branch with lead merged)
- t035-board-room ×3 unthrottled: 29/29 each. Reset lands exactly on the start view: 1440 [41.29, 75, 71.51], 390 [56.98, 97.8, 98.69].
- t035-board-room with `T035_CPU=6`, ×2: 29/29 each.
- t025-quiver: 27 PASS, 0 FAIL. tsc OK. npm test 226/0.
- Not run against 5180: that server serves the lead's tree, which does not have this fix yet. Rerun there after merging.

## t031-media retired
It only checked the AI hero video and caption on Home and Forecast, and had no Wave-scale checks to keep. I moved it to `playwright-toolkit/swello/retired/` with a README noting the reason, rather than deleting it, because the toolkit is not under git. `t038-no-ai.mjs` replaces it. Older handoffs still mention it as history.
