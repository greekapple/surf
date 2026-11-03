# T-106 (product): Home drawn waves, a cam-ready hero, six-item cards
Branch `t106-home-waves` (from forecast-trust e9b2611, with forecast-trust merged at 62fe1ab, which includes T-107 and the lead's week-grid P1s).
Spec: docs/specs/2026-11-03-home-round.md, problems 1, 3, 5 and 6.

## What changed
- **WaveGlyph** (`services/waveGlyph.ts` pure geometry; `ui/WaveGlyph.tsx` inline SVG):
  - Drawn in the spot page Wave scale card's style (lead's reference): an outer outline at the estimate's high bound (light blue, stroked) and an inner one at its low bound (darker), beside that card's person silhouette at the user's height. No "face" wording.
  - One feet-to-pixels scale for wave and person. Only the width is squeezed to fit, never a height.
  - Steepness comes from the period (6 s gives 0, 16 s gives 1); a curling lip (the Wave scale outline) appears only when the est. breaker type is plunging.
  - Offshore-only gets a flat swell line labelled "offshore only"; no estimate draws nothing.
  - Heights come from the same `headlineSurf` range as the number beside the drawing.
- **Hero** (Welcome.tsx): a media slot.
  - Order: (1) a SWELLO live cam (`OwnCam`/`OWN_CAMS` in data/cams.ts, empty; `heroMediaFor` in home/heroMedia.ts; plays muted inline and falls back to the drawing on error); (2) the bet's wave drawn large on a time-of-day gradient (dawn, day, dusk, night; light and dark).
  - The public T-063/T-080 cams stay links: other owners' cams are never embedded (cams.ts rule).
  - Caption: "Salmon Creek · 1:00 PM · Est. 5–8 ft · you 5'10" (default)" / "Drawn from the forecast · approximate".
  - The credited photo is gone from Home; it is still on the spot page.
- **Cards** (HomeView.tsx): six items: name; rating; drawing beside the number (with its "model estimate" tag); "Wind … · Tide …" on one line; the Call's verdict and window. Region, body words and the photo are gone from the card face (region is still in the aria-label and tooltip). "Next 12 hours" is kept.
- **Week cells**:
  - The faint row curve is removed.
  - Each cell has a tiny glyph drawn as one outline at `wc.centralFt` (lead and engineering: the T-107 midday central value, the same value as the number). Offshore cells get the swell line; '—' cells get none. Stale or saved cells get a muted glyph.
- **CSS**: the old hero photo, card photo and curve rules are removed. The new block is at the end of home.css.

## Problem 5 (390 photo cards as broken images)
A capture artifact, not a real failure.
- `SpotThumb` leaves `src` unset until the card scrolls into view, so a full-page capture without scrolling shows the alt text.
- After scrolling, all four images loaded; no image request failed (probe in the scratchpad, `t106p5.mjs`).
- Moot now: Home has no photos (0 `<img>` on Home).

## Checks
- tsc OK; 469/469 tests (new `wave-glyph.test.ts`):
  - the drawn height-to-person ratio for both bounds at 2–3, 4–6 and 10–15 ft, at 3 box sizes, with and without curl (it is exact, so well inside 10%);
  - the outline really reaches each bound;
  - no estimate → nothing; offshore → swell line; curl only for plunging; steepness;
  - hero order cam → drawn.
- Build OK.
- Home JS: +605 B gzip (index 159,600 → 160,205; base built from forecast-trust in a temporary worktree). CSS −12 B. No new dependencies.
- Browser on :5184 at 1440 and 390, light and dark (`artifacts/t106/home-{1440,390}-{light,dark}[-full].png`):
  - hero shows the drawing, and its range matches the sentence (5–8 vs 5–8);
  - 3/3 cards and 35/35 week cells with a height have drawings;
  - 0 images, no page errors, no overflow.
  - One element under 44 px at 390: the inline "Choose favorite spots" link inside the note sentence (pre-existing inline text link).
- Toolkit:
  - journeys 8/8;
  - t067 ALL PASS and t074 ALL PASS (both updated, backups `*.pre-t106`):
    - t067: the curve check is replaced by "no curve; a tiny drawing in every cell with a height, none in '—' cells";
    - t074: "credited photo or drawn coast" is replaced by "no photo; a cam or the labelled drawing", plus a new check that the drawn range matches the sentence;
  - t034: Home passes; the 3 failures (forecast NWS gap, map legend 11 px, personal gutter) are the same on :5180 (pre-existing);
  - t043-count is a map counter with no pass/fail.

## Not verified
- The dawn, dusk and night hero tints in a browser: I captured at midday only. The CSS is in place for light and dark.
