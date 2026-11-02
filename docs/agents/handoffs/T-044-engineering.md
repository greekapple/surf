# T-044 Engineering handoff: Wave scale 3D spin viewer (frames-ready)

## Drop-in contract
Put Blender renders in `public/media/scale3d/<band>/a00.jpg … a23.jpg` plus `poster.jpg`. Nothing else to register. Folder names (from the band ids): `1-2`, `2-3`, `3-4`, `4-6`, `6-8`, `8-10`, `10-15`, `15-plus`. A band switches to the spin viewer as soon as its `poster.jpg` loads as an image; other bands keep today's view. Until the folder exists, nothing changes.

## What was built (my `src/features/scale/*` + `src/services`)
- `src/features/scale/Spin360.tsx` (`<Spin360 frames poster alt still onFail>`): drag or swipe through the frames (one stage width = one full turn; dragging right goes to earlier frames), arrow keys ±1, PageUp/PageDown ±4, Home/End, an "n / 24" counter, a "Drag to rotate" hint on frame 1, all 24 frames preloaded with a "Loading n / 24" status (poster shown meanwhile). Slider semantics (`role="slider"`, value 1–24). `touch-action: pan-y`, so vertical page scroll still works on phones. **Still-only fallback:** a missing/broken frame, `prefers-reduced-motion` or Save-Data shows the poster only (Save-Data/reduced motion offers a "Rotate in 3D" button that loads the frames on request).
- Caption on the viewer, exact: "3D illustration · approximate scale, not current conditions".
- `src/services/scaleFrames.ts` (pure): band→folder, frame paths, poster path, drag and key maths, counter text. Tests `src/tests/scale-frames.test.ts` (5).
- `WaveBands.tsx`: for a band with frames the **AI photo is replaced by the spin viewer** (and its "Play loop" button is hidden); `ScaleView.tsx`: the **2D blob "Wave comparison" chart is hidden for that band** and returns for bands without frames (the `compare` route still shows it). The compact Forecast card is unchanged.
- Render guidance: the stage is 16:9 on desktop and 4:3 on phones and the image is letterboxed (`object-fit: contain`), so 4:3 renders look best on both; keep the same framing across all 24 frames so the rotation stays still.

## Proof
- `t044-spin.mjs` **ALL PASS** (it generates 24 test frames into `public/media/scale3d/4-6`, then deletes them; nothing fake is committed): with no frames the page is unchanged; with frames at 1440 and 390 the viewer replaces the AI photo and chart, counter 1 / 24, caption exact, slider semantics, `touch-action: pan-y`, dragging right a quarter stage goes to frame 19, dragging left goes forward, arrows ±1, End/Home → 24 / 1, shown image is a frame not the poster, other band keeps AI photo + chart, 0 px overflow, a missing frame falls back to the poster and disables the slider, 0 console errors. Shot `artifacts/t044/{1440,390}-spin.png` in the toolkit (placeholder frames, not real renders).
- `tsc` clean, **266 tests**, build ok, `t034-density` ALL PASS, `wave-spot` no FAIL.
- `journeys.mjs`: 7/8 on the last runs. **Journey 4 (Explore) fails because the toolkit script already targets product's T-043 UI ("Show spot list", `.xspotpop`) which is not on my branch**; journey 5 failed once and passed on rerun (flake). Neither touches the scale code.

## Limits
- The build embeds every file under `public/` in the Worker; 24 JPGs × 8 bands will add to the known Worker-size/deploy blocker (U-01), so keep frames small (≈960×720, quality ~75, 40–80 KB each) or serve them from R2.
- Availability is probed by loading `poster.jpg`, so a band is "live" only if its poster exists; frames missing later degrade to the poster.
