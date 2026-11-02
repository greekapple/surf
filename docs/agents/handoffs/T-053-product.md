# T-053 Quiver wall polish: no halos, matching thumbnails, true scale (product, 2026-11-02 overnight)

Branch `worktree-product` (fast-forwarded from `rebuild/swello-v0.16` first). Files: `src/features/quiver/BoardPicture.tsx`, `Overlay.tsx`, `Rack.tsx`, `quiver.css`.

## 1. Halos: gone, the board illustrations are true cutouts
- **Cause.** The AI JPEGs sit on a white seamless with a grey vignette and floor shadow. The CSS mask plus multiply left a soft grey box, and my T-050 `drop-shadow` on the masked `<img>` drew a shadow of its rectangle.
- **Fix (`cutout()` in `BoardPicture.tsx`):** runs locally in a canvas, once per file and cached; no new assets.
  1. **Vignette-following white point:** fit `background ≈ a + b·r²` to the image's border frame. A single global white point erased the white shortboard; this one keeps it.
  2. **Levels + white-to-alpha:** the seamless becomes transparent, and every rail, stringer and shading line keeps its tone over white.
  3. **Noise floor:** alpha < 0.08 is fully transparent, so the vignette residue can't read as a pale box.
  4. **Crop:** top/bottom where alpha > 0.3, so the picture's height is the board's length and its foot is the tail; sides where alpha > 0.03, so pale rails aren't clipped.
- Until a cutout is ready the slot holds its true size and draws nothing. On any failure it falls back to the old masked JPEG without a drop shadow, so a box never appears.
- The rack's drop shadow is removed; the elliptical contact shadow under the tail grounds the board.
- The wall stays a light gallery wall in dark mode (labels re-inked), because white boards would vanish on a dark wall.
- AI captions are unchanged ("AI-generated, not your board").

## 2. Phone thumbnails match
`Strip` now uses `BoardPicture` (the same cutout as the wall), not the 3D look colour, so the green fish thumbnail matches the green fish on the wall. The board-room rail keeps outlines in the look colour on purpose: there they match the 3D model on the stage.

## 3. Wall scale
- The ruler's 0′ is measured from the selected board's foot, and the tick's 1 px line sits on the tail. It measures −1.0 px: the line is drawn on the tail.
- With the crop, picture height equals board length. On the ruler the 5′10″ fish measures 5.82 ft at 1440 and 5.85 ft at 390 (true 5.83 ft).

## Checks (5184, real output)
- **`t053-wall.mjs` (new) 9/0.** It covers:
  - every wall illustration is a cutout (4/4 at 1440 and 390);
  - **no halo**: wall luminance 10 px beside each board vs plain wall, 0.0/255 darkening;
  - ruler 0′ at the tail (−1.0 px);
  - the 390 strip shows the same cutouts (4/4);
  - no page errors.
- t025-quiver 27/0 · t035-board-room 29/0 · t023-quiver 52/0 · density ALL PASS · journeys 8/8 · tsc OK · npm test 305/0 · build OK.
- **Shots:**
  - `playwright-toolkit/swello/artifacts/t053/{1440,390}-wall.png`, `390-strip.png`, `zoom-shortboard.png`;
  - `artifacts/t050/quiver-t053-{rack,room}-{1440,390}[-full].png`.
