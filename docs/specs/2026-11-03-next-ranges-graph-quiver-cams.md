# Next after the 3D: Surfline-width ranges, undulating graph lines, quiver, then cams on Home
Status: **APPROVED in direction** (user, 2026-11-03 ~15:10, directly: "use surfline for reference … a little differentiated … beach oriented … i meant the lines that undulate similar to surflines not the depiction of the wave to surfer comparison … fix those issues after the 3d works well"). Open question 1 is answered (use Surfline's width, by beach). Open question 2 (quiver) is still open. Order (user): **the 3D works well → ranges and graph → quiver → cams**. Cams come "once I like the product a little bit more".

## 1. Surf-height ranges: as narrow as Surfline's, per spot
**Context.**
- Today's range is an uncertainty interval (T-073/T-078: measured model skill vs buoys, model spread, lead time), rounded outward.
- The median width is 3 ft: about 2 ft up to a 5 ft surf height, and 3–5 ft above that (docs/forecast/RANGE-T078.md).
- Validation: the range contains the MOP nowcast about 78% of the time and the buoy-derived value 74% (T-089).
- The user: still "much too wide". Use Surfline as the reference for width; keep our ratings and heights a little differentiated, ideally by beach.

**Target widths** (Surfline's reporting convention, the reference the user named):

| Surf height | Width |
|---|---|
| under 2 ft | 1 ft (e.g. "1–2") |
| 2–6 ft | 1–2 ft (e.g. "3–4", "4–6") |
| 6–10 ft | 2–3 ft (e.g. "6–8", "8–10") |
| 10–15 ft | 3 ft |
| 15 ft and up | 5 ft |

**The honesty problem and the approach (recommended).** Surfline's range isn't a confidence interval. It's a "what you'll see" band: average waves to the sets. Narrowing our uncertainty interval to that width would make it claim a precision we haven't measured. So the range changes meaning, and says so:
- **The range becomes the surf band:**
  - low = the typical wave (≈ the convention surf height, per spot);
  - high = the sets (≈ the bigger waves, H1/10 ≈ 1.27 × Hs, by spot exposure and breaker type);
  - snapped to the width table.
  - Per-spot "beach-oriented" differentiation comes from each spot's own MOP point, facing/exposure and breaker type (all already in the data), plus a per-spot bias correction where the validation archive supports one.
- **Uncertainty moves to one visible confidence word next to the number:** "high / medium / low confidence", from today's interval width and lead time. The full interval stays in "Why" and the tooltip.
- **Tests:**
  - widths follow the table;
  - lo ≤ centre ≤ hi;
  - the confidence word follows the old interval;
  - every surface (Home, the week grid, cards, the spot page, Compare, Find Spots) uses the same band.
- **Validation re-run** (T-089 harness): report how often the measured nowcast falls inside the new band and inside the band ± one step. Expect a lower coverage than 78%; that's why the confidence word exists. The user sees the number.
- **Owner:** engineering. Level 3 (it changes the meaning of the main number); data-honesty review required.

## 2. Undulating lines like Surfline's (forecast graph AND Home)
**Context.**
- T-109 replaced the spot graph's barcode with one estimate band plus a median line.
- The user means Surfline-style undulating lines: smooth curves of surf height and of each swell over the days. They do NOT mean the wave-next-to-a-person drawings.
- The lead misread "the little depictions of waves that were simple" as the wave-to-person glyph. T-106 removed the week grid's faint undulating size line (the likely original) and added glyphs in its place.

**Home (new):**
- Bring back an undulating size line in each week-grid row: a smooth curve through the days' midday sizes (T-107's `centralFt`), clearly visible and with a legend.
- Give each spot card a small undulating 7-day surf-height line (sparkline) in place of the wave-to-person glyph.
- The large drawn wave in the hero stays as the cam fallback (§4) until cams exist.
- The tiny glyphs in the week cells are removed (the line replaces them).

**Target.**
- **The Surf tab:** a smooth curve (monotone cubic, no overshoot) for the new surf band's top and bottom, with a soft fill between, coloured by the rating along the bottom edge.
- **The Swell tab:** one smooth undulating line per swell component (primary, secondary, wind swell) with its period and direction markers every 6 h, in distinct, accessible colours.
- Day separators, a "now" line, and night shading kept. 390 readable.
- No new dependency (hand-rolled SVG path smoothing).

**Owner:** product (UI) with engineering's band from §1. Level 2. Done after the 3D works well (user's order).

## 3. Quiver (after 1 and 2)
The user named it next in line but gave no detail. Proposed scope, for the user to confirm or replace: the Board Match explanation in plain words, the board look editor, and the board picks agreeing with the new bands. **Open question 2.**

## 4. Cams behind the forecast on Home (last)
**Target.**
- Home's hero (T-106's MediaSlot already puts an own cam first): the #1 recommended spot's cam plays behind the greeting and forecast, dimmed for legibility, with the drawn wave as the fallback. Later, every spot card gets its cam.
- **Constraints:**
  - only cams we're allowed to show: the user's own cams (CAMS-PLAN.md) or a provider's embeddable feed with written permission;
  - public cam pages stay links (T-080: never embed someone else's player);
  - no autoplay on cellular without consent;
  - the label says whose cam it is and when the frame is from.
- **Owner:** engineering and product, after the user's own cams exist. Level 3 (third-party terms).

## Owners and order
- Fable finishes the 3D: the top-turn pose and the user's feedback on the round-3 clip.
- Engineering: §1, then product: §2.
- §3 after the user confirms its scope.
- §4 when the cams exist.

## Acceptance
- §1: every surface shows the same band; widths match the table (unit test); a confidence word everywhere the band shows; a validation report with the new coverage; a data-honesty review with no P0/P1.
- §2: smooth lines at 1440/390, light and dark; the swell lines match the Swell table values at the sampled hours (test); no overshoot below 0.
- Checks: tsc, tests and build; journeys (after the Open-Meteo reset).

## Open questions (yours)
1. ~~What the range means~~: answered. Use Surfline's widths and make them beach-oriented. The lead implements it as "typical to sets" with a confidence word, which keeps it honest.
2. **Quiver scope:** what should change in the quiver? Default if you don't say: Board Match explained in plain words, and picks that agree with the new bands.
