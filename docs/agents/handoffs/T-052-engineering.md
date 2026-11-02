# T-052 Engineering handoff: Your height + the drawn Wave scale page

## Your height
- `UserProfile.heightIn` (inches, optional; one additive field in `models/index.ts`). **Personal › Surf preferences → "Your height"**: type ft/in (5'10", 5 10, 5ft 10in, 5.5) or cm by the unit preference; saved on blur/Enter; an impossible value (3'4"–7'6" allowed) is refused with a message and not saved; "Use the default" clears it. Pure maths in `src/services/heightMath.ts` (conversions, carry, parsing, `userHeight` with the labelled 5'10" default and a fallback for garbage values).
- Product's `ScalePanel` (SpotPage.tsx, three small edits) and the new page draw you at your height; "(default)" appears only while it is unset, and the text says where to set it.

## Wave scale page (`src/features/scale/ScaleStage.tsx`, `ScaleView.tsx`, `scale.css`; maths in `src/services/scaleMath.ts`)
- **Big SVG, same visual language as the spot page's ScalePanel** (same wave outline, silhouette, tokens): the hour's estimated face range as an outer (high) and inner (low) wave, you at your height, a board from your quiver (picker, remembered), left axis in your unit, **body-word ticks** at the convention's face heights (approximate; thigh/shoulder are our in-between anchors), "about 0.6–1.6× your height", value labels on the wave, text equivalent in the SVG's aria-label. No estimate this hour → only you and the board are drawn and the page says why (offshore shown labelled, not as surf size).
- **Hour scrubber** across the day (slider with `aria-valuetext`, "Play day" button) updates the selected hour and the wave **animates** between hours (tween; instant under reduced motion, where Play is disabled).
- **Band browser** (1–2 … 15+): draws that band ("comparing", illustrative) and auto-rescales the axis; "Back to this hour" restores.
- **AI photo demoted**: hidden by default; "Show example photo (AI illustration)" reveals it with the forced caption. **Spin360 stays** and appears for a band that has 3D frames. The old blob comparison chart and `WaveBands.tsx` are gone.

## Proof
- Unit tests `src/tests/height-scale.test.ts` (6: conversions/carry/rounding, valid range and default fallback, parsing incl. rejections, face range, band ranges and axis, drawing maths). **305 tests pass**, tsc clean, build ok.
- New `t052-scale.mjs` ALL PASS at 1440 and 390 (default labelled; height saved 74 in; impossible value refused; page and spot-page panel use it and drop "(default)"; text equivalent; tagged headline; body ticks; board picker; scrubber changes the hour; band browser draws and restores; AI photo hidden by default and captioned on request; no canvas/overflow).
- Updated for the new page: `wave-spot.mjs`, `t033-shots.mjs`, `t044-spin.mjs` (+ journey 7): all ALL PASS. `journeys` **8/8** (on 5185), `t034-density` ALL PASS, `t037-flow` ALL PASS, `t047-home` ALL PASS.
- Shots (toolkit `artifacts/t052/`): `{1440,390}-page.png` (page with the example photo open); `artifacts/t033/t052-*`.

## Notes
- The page uses the hours of the selected Pacific day for the scrubber; selecting an hour here also selects it on the forecast.
- Body-word tick heights are the convention's absolute face feet, not scaled to your height; the "× your height" line is the personal comparison.
