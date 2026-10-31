# T-032 · Quiver: annotated board, function-first, white theme, realistic board pictures — Product handoff (2026-10-30)

Branch `worktree-product`. Commits: T-032 (1) annotated stage, (2) function-first, (3) white theme + BoardPicture slot + review fixes, (4) board illustrations + this handoff; merges of `rebuild/swello-v0.16` between them (fonts/Media, function-first rule, minimal white, board pictures 93c8861).
Files: `src/features/quiver/{Stage.tsx (new), BoardPicture.tsx (new), Rack.tsx, QuiverView.tsx, quiver.css}`. No change outside `src/features/quiver`; no dependencies.

## What it does now
- **First screen (390 and 1440, measured):**
  - the rack;
  - the selected board's spec card (length, width, thickness, volume);
  - the thumbnail strip;
  - the Board Match line;
  - View in 3D, Open Board Match, Edit and Delete.
- **Board Match line:** the real `scoreBoard` result for the selected board, e.g. "Board Match at Ocean Beach: 73/100, #3 of 4 · demonstration week · provisional", plus "outside your ability or range" and "limited board data" when they apply. When there is no breaking-wave estimate it says "no recommendation for Ocean Beach. Live data has offshore height only, which is not surf size."
- **Board pictures (lead addition):** `BoardPicture` is the single slot used by the rack and the stage.
  - Order: the person's traced or scanned outline first, then the AI illustration for the board type (your mapping; "Other" keeps the drawn outline), else the category outline.
  - Each picture is sized to the board's real length, so relative lengths in the rack stay true.
  - Labels: alt/title "Illustration of a <type> · AI-generated, not your board", plus a visible caption for the selected board in the rack and under the board on the stage.
  - When pictures show, the rack is a plain white wall: on the rendered room, multiply blending made them look like ghosts. White seamless blends with `mix-blend-mode: multiply` on the stacking element, and the picture edges are masked.
- **Annotated board (below the rack, an accent):** the board centred, its length in giant `var(--display)` type behind it as a backdrop, and six callouts on hairline leaders: Length (+ inches, cm), Width, Thickness, Volume, Fins, Tail. Missing values say "Not recorded". All visible on load; the motion only adds emphasis (0.6 → 1 opacity, 8 px, 300 ms; none with reduced motion). Stage arrows are named "… board, annotated view" so they differ from the rack's.
- **Theme:** light by default (very light grey panel, dark text, hairlines). Dark theme: the stage shows the drawn outline on the AI concrete (cropped to its left third so no AI board shows), with "Concrete behind the board: Illustration · AI-generated, not current conditions". The concrete never sits behind spec text, and it never appears in light theme.

## Checks (real output, final state)
- `npx tsc --noEmit` OK · `npm test` pass 216, fail 0 · `npm run build` built
- `t023-quiver.mjs` and `t025-quiver.mjs` (base 5184): all passed
- `journeys.mjs`: 8/8 · `t022-nav.mjs`: ALL PASS
- `t032-first.mjs` (new): 14/14 PASS at 1440 and 390. Rack, spec values, thumbnails, Board Match line and View in 3D are all inside the first viewport, above the phone tab bar. Callouts have opacity ≥ 0.6 on load. Console clean.
- `t032-demo.mjs` (new): demo mode shows a real score and rank, and the line follows the selected board (2/2 PASS).
- `t032-shots.mjs` (new; light, and dark via `swello-theme`): 0 px overflow at 1440 and 390, console clean, with motion on and with reduced motion.
- Review (silent-failure-hunter) on the stage and slot. Fixed:
  - the missing "limited board data" flag;
  - duplicate arrow names;
  - the length guard;
  - a wrong comment.
  The review found no honesty problem with the picture or the backdrop. The illustration step was added after the review; I checked it in the browser and with the scripts above.

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t032/`:
- `side-390-before-after.png`, `side-1440-before-after.png`
- `side-anno.png` (next to g345)
- `side-light-dark.png`
- Raw: `after-*` (light), `dark-*`, `before-*`, `first-1440.png`, `first-390.png`, `demo-390-quiver.png`

## Notes / incomplete
- The rack shows one visible caption: the selected board's, in the room's top-left. The other pictures carry it in alt/title. A visible caption under every rack picture would not fit beside 50–100 px boards.
- The thumbnails are still drawn outlines in the board's own colour, so a blue fish thumbnail sits next to a green fish illustration.
- The picture backgrounds have a faint grey vignette that shows as a soft halo on the white wall.
- The 3D Showroom is unchanged.
