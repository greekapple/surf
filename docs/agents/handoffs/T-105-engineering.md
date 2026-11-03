# T-105 handoff (engineering): motion checks in t102-ride.mjs

Toolkit only (`~/Development/ai-system-setup/playwright-toolkit/swello/t102-ride.mjs`; backup `t102-ride.mjs.pre-motion`). Existing checks kept.

New, per direction (Left and Right), sampling `__wave.rider()` at ~30 Hz over 2 cycles (40 s unless `WAVE_CYCLE_MS`):
- screen step <= 3% of frame width between consecutive samples (steps across a cycle reset are not counted);
- no reversal of the along-crest velocity within a cycle (|dx| < 2 cm per sample treated as noise; a new cycle = x jumping back more than 5 m);
- heading_err_deg <= 15 in >= 95% of samples;
- frac >= 0.15 in >= 80% of samples;
- max frac >= 0.55 over the whole window and in every complete (interior) cycle; a 2-cycle window usually has no interior cycle, so the whole-window max carries it (set WAVE_CYCLE_MS for longer windows).
Needs rider fields `frac`, `heading_err_deg` and `screen: [x, y]` (fractions of the canvas). Any missing field: "SKIP ... need rider fields ..." (current :5180 has none of them, so the live run skips them; the other checks still pass there, fps 5 is SwiftShader).
**Needs from Fable/lead: the `screen` field** (I cannot project the crest-frame x/y/z to the screen without the camera and wave frame).
Verified: `SELFTEST=1 node t102-ride.mjs <base>` runs the analysis on synthetic tracks (a smooth ride passes all five; a jumpy, reversing, misaligned, flat one fails all five). Retries sampling if the dev server hot-reloads mid-run. Not yet run against real fields.
