# T-016 · Quiver Focus size, photo scan, Explore phone labels — Product handoff (2026-10-30)

Branch `worktree-product`, continued from d9b43ca. Dev port 5184. Files: `src/features/quiver/studio.ts`, `src/features/quiver/Showroom.tsx`, `src/features/explore/ExploreView.tsx`, `src/features/explore/explore.css`.

## Part A: Quiver
**Focus size: done.**
- Cause: Focus fitted the board's whole bounding sphere to the narrower field of view (the vertical one on a wide stage). The deck rest pose also laid the board across the stage, so it filled about 41% of the height at rest and 54–67% while spinning.
- Fix (`studio.ts`): Focus now fits the extents the board can actually reach (its length across the frame, at most L·sin(elevation) plus thickness tall) using the existing `fitDist` helper. Deck and bottom now rest nose-away with a 25° twist (`STAND`), so the board reads upright like the reference showroom. Rail, tail and 360 keep their poses. Presets glide to the nearest equivalent rest angle, so the board turns the short way.
- Measured from projected mesh vertices (`Studio.selectedBox()`, read through the dev-only `window.__studio` hook; absent from the build):
  - 1440 at rest (deck pose, reduced motion): **77%** of the 594 px stage, inside the stage.
  - 1440 spinning: 62–84%. While spinning, the board is only its width tall when broadside, so the gate uses the rest pose.
  - 390 at rest: 51%. On the narrow stage the board's length fills the width; reported for information.

**Photo scan: not met, reported as-is (no tuning).**
- `user-studio-board.jpg`: **no outline.** The tracer refuses with "The shape is not long and narrow enough to be a surfboard…" and nothing is saved. The photo is a single board, but it's a studio shot standing against a seamless backdrop with a floor/wall horizon, white on light grey. The tracer is built for a top-down photo on a contrasting floor; its floor model is a plane fitted to the border, which can't model a two-tone backdrop. The failure is the safe kind (refusal, no wrong outline).
- `user-board-wall.jpg`: **no outline**, same message. That's correct: it shows about 30 boards leaning on a rack, not one board from above.
- Screenshots of the alerts: `artifacts/t016/scan-user-studio-board.png` and `scan-user-board-wall.png`. There's no overlay because nothing was traced.
- Decision for lead and user: supporting studio or backdrop photos would need a tracer change (for example a background model that handles a horizon, or a user-placed box). I didn't change the tracer.

**Reference comparison:** `cmp-1440.png` and `cmp-390.png` next to `00-target/quiver.png`. The lineup structure matches the reference (room backdrop, upright boards, spec card over the stage, thumbnail strip). Remaining gaps are outside this task: plain-colour decks without graphics, and 4 boards against about 8.

## Part B: Explore phone labels (done)
- Removed the z<9 rule that hid every non-selected label; `declutter` now decides at every zoom.
- Labels now also avoid the floating panels (side panel, zoom/layers, tools/legend, time card, attribution) and stay inside the map's edges. They used to peek out half-hidden or get cut off at the screen edge.
- Declutter re-runs on `moveend` (panels stay put while the map pans) and when panels open, collapse or switch tabs.
- 390 default view: 6 labels (was 1), none under a panel or cut off. 1440 default view: 10.
- `t013-overlap.mjs` now also covers z7 and z8 (coast view): ALL PASS, 0 overlaps in 22 views, clicking a pin still selects it, no console errors.

## Checks (real output)
- `npx tsc --noEmit`: OK · `npm test`: pass 167, fail 0 · `npm run build`: built; `grep __studio|__xmap dist`: none
- `journeys.mjs http://127.0.0.1:5184`: 8/8 journeys passed; no unexpected browser errors
- `t016-quiver.mjs`: ALL PASS for the gated checks (Focus 77% at rest, console clean); scan results reported above
- `t013-overlap.mjs`: ALL PASS

## Screenshots (looked at)
- `~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t016/`: `1440-focus-reduce.png`, `1440-focus-no-preference.png`, `390-focus-reduce.png`, `scan-*.png`, `cmp-1440.png`, `cmp-390.png`. Before-change shots in `artifacts/t016-before/`.
- `artifacts/t016-explore/`: `390-default.png`, `1440-default.png`, `*-coast-z7/z8.png`.

## Incomplete
- Acceptance 2 (scan outline follows the board) is not met for either photo; see above.
