# T-020 · Photo scan works on a real single-board photo — Product handoff (2026-10-30)

Branch `worktree-product`, from b5cee50. Commits: e0107b7 (tracer and tests) and the UI commit after it. Files: `src/features/quiver/outline.ts`, `src/features/quiver/ScanPanel.tsx`, `src/features/quiver/quiver.css`, `src/tests/board-photo-tracer.test.ts`. `src/utils/boardPhoto.ts` was not needed and is untouched.

## What changed
**Tracer (`outline.ts`)**
- **Horizon-aware background** (lead's approach 2, extended). `findHorizon` finds the strongest colour step down the side border columns. When there is one (a studio sweep, or a wall meeting the floor), the background is modelled as wall and floor planes. Each row is also blended between its own left and right border colours, because a sweep is even across a row but bends and shades down the photo; a side the board touches falls back to its plane. Plain wall and floor planes alone still let the darker floor band through.
- **Backdrop photos only:**
  - Hysteresis recovers shaded parts of a pale board, such as the concaves near the fins.
  - Below the horizon, a taper fitted to the rails just above it limits the nose, so the lit floor around the nose can't join.
  - Top-down floor photos keep the original strict cut; there the weak pixels are the board's own shadow, and the existing shadow tests guard that.
- **Opening:** a small erode-then-dilate drops thin spurs and fins.
- **Crop box** (lead's approach 1): `traceBoardIn(photo, box, maxSide)` cuts the box from the full-resolution photo and averages it down to 520 px, so a narrow box keeps detail. The box border is the background, and the result maps back to photo pixels.
- **New refusals.** These sit after the original checks, so "not long and narrow enough" still comes first:
  - The board runs off the edge of the photo or box.
  - Far too thin: aspect over 7 (even a 10' gun is about 6:1).
  - Uneven outline: the centre line wanders more than 0.10 of the widest half-width, or the rails are jagged beyond 0.08. Measured values: studio board 0.005–0.007 and 0.018–0.019; sliver from a rack box 0.43 and 0.15.

**UI (`ScanPanel.tsx`)**
- The photo shows as soon as it's loaded. Dragging a box on it re-traces inside the box (a tap is ignored). "Clear the box" goes back to the whole photo.
- **Check step:** a successful trace shows "Check the outline", a line on whether the outline is even and symmetric, and the buttons "Use this outline", "Swap nose and tail" and "Clear the box". Nothing goes to the form, so nothing can be saved, until "Use this outline" is pressed; the deck texture is made then.
- **Copy:** the photo guidance now covers standing boards against a plain wall or backdrop. A refusal keeps "Nothing was saved from this photo."
- **390 layout fixes:** the scan grid uses `minmax(0, 1fr)` and the file input can shrink. Both used to overflow the card at 390.

## Acceptance results (real output)
Ground truth for `user-studio-board.jpg`, read by eye from 4× pixel-grid crops (`artifacts/t020/grid-*.png`): tail edge y ≈ 89, nose tip y ≈ 1913, rails at x ≈ 469 and 951 where the board is widest. That gives 1824 × 482 px, an aspect of **3.78**.

| Case | Result | Aspect vs 3.78 |
|---|---|---|
| Studio photo, no box | traced, quality asym 0.005 / rough 0.019 | 3.56 (−5.8%) ✓ |
| Studio photo, box 380–1080 × 40–1973 | traced, quality 0.006 / 0.018 | 3.70 (−2.1%) ✓ |
| Board wall, no box | **refused**: "not long and narrow enough…" ✓ | — |
| Board wall, box around one board (1040–1185 × 315–800) | **refused**: in the app at 1440 "runs off the edge of the photo or the box" (the neighbours touch it); in the 390 run and the harness "far too thin to be a whole board" | — |
| Board wall, two more boxes | refused ("far too thin", "uneven") | — |

The no-box trace is short mostly at the nose tip below the horizon, where the shaded tip is close to the floor colour. The outline flares slightly at the side-fin tips near the tail; that doesn't change the widest point. In the form, 5'10" gives width 20" against about 18.5" from the ground-truth ratio, consistent with the −5.8% aspect.

## Checks
- `npx tsc --noEmit` OK · `npm test` pass 172, fail 0 (5 new in `board-photo-tracer.test.ts`; all existing scan and outline tests unchanged and passing) · `npm run build` OK
- `journeys.mjs http://127.0.0.1:5184`: 8/8 journeys passed; no unexpected browser errors
- `t020-scan.mjs trace`: results as in the table. `t020-scan.mjs ui`: ALL PASS at 1440 and 390 (check step shown, nothing used before confirming, no horizontal overflow, "Use this outline" then saves and stores the outline, studio photo with a box traced, board wall refused, console clean).

## Screenshots (looked at)
`~/Development/ai-system-setup/playwright-toolkit/swello/artifacts/t020/`:
- Overlays: `trace-user-studio-board.png` and `trace-user-studio-board-box380_40_1080_1973.png`
- Refusals: `trace-user-board-wall*.png`
- App flow: `ui-1440-studio-check.png`, `ui-390-studio-box.png`, `ui-1440-wall-box.png`, `ui-390-wall-box.png`
- `cmp-1440.png` and `cmp-390.png` (Quiver vs `00-target/quiver.png`; the list is unchanged)
- `grid-*.png` (ground truth)
- Before-change traces: `artifacts/t020-before/`

## Notes / incomplete
- **Drawing a box is pointer-only.** Keyboard users can still trace the whole photo. A keyboard way to draw a box isn't built.
- **Mobile emulation offset:** with this long form under Playwright's mobile emulation, the DOM reported "Save board" 24 px below where it is drawn, so Playwright's own pre-click check refused. Chrome's native hit-test at the visual centre works, and the script dispatches there (`force: true`). I saw this only in emulation; a 30-second check on a real phone would settle it.
- `t016-quiver.mjs` still expects the old scan text; `t020-scan.mjs` replaces it for the scan. `t020-probe.mjs` is the Save-click diagnostic.
