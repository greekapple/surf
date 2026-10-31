# T-035 · Quiver board room (Porsche 911 configurator pattern) — Product handoff (2026-10-31)

Branch `worktree-product`. Commits: bc7faaa (board room), then the review fixes and this handoff.
Files: `src/features/quiver/{BoardRoom.tsx (new), studio.ts, looks.ts, QuiverView.tsx, quiver.css}`; removed `src/features/quiver/Showroom.tsx` (replaced; history keeps it). Only `src/features/quiver/*`; no dependencies; `src/ui/app.css` untouched.

## What it does (`/quiver/showroom`)
- **Stage:** one board, large, on a light set (pale wall, soft floor line, brighter floor, contact shadow). Real-time three.js from the board's real numbers and outline: traced, scanned deck photo, or the category shape.
  - Drag to orbit with damping (inertia); keyboard arrows and +/− also work. The board hovers low so the shadow reads as its own.
- **Lighting:** the studio gains a hemisphere fill, a little more environment light and exposure, and a tighter, darker contact shadow.
- **Stage pill** (bottom-left, inside the stage): Angles · Compare · 360° · Reset · Full screen. Full screen is hidden where the browser can't do it (iPhone Safari).
- **Camera presets:** ¾, Deck, Bottom, Rail, Tail, Nose.
  - 1440: a thumbnail strip with drawn angle glyphs under the stage.
  - 390: an "n / 6" counter on the stage with ‹ ›, and a quick sideways flick steps the angle (slow drags still orbit).
- **Hotspots** on the fins, tail, nose and rail. They follow the board every frame, anchored to the mesh's real nose and tail tips, widest rail point and a fin. They hide when the board covers them.
  - Each opens a fact from the saved record: Fins "Twin", Tail "Swallow tail", Nose and rocker, Rails. Missing values say "Not recorded". A draft change adds "Showing …, not saved".
- **Option groups as swatches:**
  - Dimensions (steppers), Fins, Tail, Construction (sets the finish) and Colour.
  - 1440: on the right in a sticky panel. 390: under the pinned stage.
  - Every change updates the model live as a draft. Only "Save to board" writes the record (dimensions, tail, construction, fins text) and the look; Discard restores.
  - Unchanged recorded fins text (e.g. "Twin · FCS II") is kept. Invalid dimensions block Save, with the reason shown.
  - The 3D tail is a width taper over the last 16% of the board, labelled as an approximation.
- **Unsaved drafts:** kept for the browser session when you leave (Edit, Board Match, another board) and labelled "Unsaved changes" when you come back. Save or Discard clears them.
- **Compare:** the selected board and one other (picker; starts with the closest length) side by side at true relative length.
- **Board Match:**
  - 1440: in the panel header.
  - 390: a sticky bar above the tab bar with the line and one action, "Open Board Match", or "Save" when there are unsaved changes.
- **Phone:** the stage stays pinned under the bar while the options scroll. Density (§3) is measured: page title 28, board name 20, section titles 15, swatches 13, notes 12.5, bar 12.5 px.
- **Dark theme:** the panel and controls follow the theme, and the stage stays a lit light set.
- **Kept:** the "Showroom" title (t023), `.qv-showbar` (Edit, Delete, Board Match), and the flat-outline fallback when WebGL fails. The subtitle now says "Inspect and configure one board".

## Checks (real output, final state)
- `npx tsc --noEmit` OK · `npm test` pass 226, fail 0 · `npm run build` built
- `t035-board-room.mjs` (new): 29/29 PASS at 1440 and 390.
  - Drag orbits the camera, and Reset returns.
  - Six thumbnails at 1440; "1 / 6" → "2 / 6" moves the camera at 390.
  - Four hotspots visible, and one opens "Fins Twin".
  - Fins and colour change the model live (fins 2 → 1, deck #1d4a6b → #e8664f), nothing is saved before Save, and Discard restores.
  - Save writes the tail "Pin" to the board record.
  - The draft survives Board Match and back.
  - The phone bar has the Board Match line plus one action, above the tab bar.
  - The stage stays pinned (top 64).
  - Density passes.
  - Compare: 2 boards, screen-height ratio 0.633 vs length ratio 0.648.
  - Overflow 0 and console clean at both sizes.
- `t023-quiver.mjs` all passed. `t025-quiver.mjs` all passed: one selector moved from `.qv-card-spec h2` to `.br-name` because the board room names the board there; the check is unchanged.
- `t032-first.mjs` 14/14 · `journeys.mjs` 8/8 · `t022-nav.mjs` ALL PASS
- Review (pr-review-toolkit silent-failure-hunter): 7 findings, all fixed:
  - fins fact vs stored look;
  - silent draft loss;
  - "Saved" when the look storage failed;
  - 360° pressed while comparing;
  - dead full-screen button on iPhone;
  - Compare picked the most different board;
  - popover Escape, focus and auto-close.

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t035/`:
- Next to Porsche: `side-1440-porsche.png`, `side-1440-hotspot.png`, `side-390-porsche.png`, `side-390-scrolled.png`
- Before/after: `side-1440-before-after.png`, `side-390-before-after.png`
- Compare and dark: `side-compare.png`
- Raw: `after-*`, `before-*`, `t035-*-hotspot.png`, `t035-*-compare.png`

## Notes / incomplete
- The 3D tail options are an approximation (a width taper, no swallow notch); the panel says so.
- The angle thumbnails are drawn glyphs, not rendered snapshots of the board.
- The old showroom CSS (`.qv-bar`, `.qv-steps`, `.qv-pick` …) is now unused but still in quiver.css.
