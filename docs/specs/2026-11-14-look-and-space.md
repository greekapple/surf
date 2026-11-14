# Look and space — spec (2026-11-14)

User, 2026-11-14: "cross reference Surfline a little bit more for aesthetics … the orange should be replaced with a more pleasing [colour] closer to the palette … so much blank space on the app … I don't want overcrowding, but on Forecast, especially on phone, there are large portions of blank space … do it in the best-looking way according to other great websites and apps."

Status: **draft for the user's review**. Stages A–D need approval before work starts.

## Already done today (live)

| Change | Version | Evidence |
|---|---|---|
| Orange highlight removed; the nav and tab highlight and text selection use SWELLO blue (`--accent`) | 3a6dbf17 | prod at 390 and 1440, PRODUCT.md colour line updated |
| Forecast blank-space pass: phone 3337 → 2641 px (−21%), 1440 −7%, no holes ≥120 px × half-width; double footer clearance fixed app-wide | 8202757c | before/after screenshots, data-honesty review clean |
| Quiver 3D drag steady (negative frame step made the fling grow and reverse) | 3a6dbf17 | drag trace: velocity only decays |

## Surfline cross-reference

**Not yet checked by hand.** Headless browsers get Surfline's bot check, and we don't get around it. The Chrome extension was not connected. The points below are hypotheses until someone looks at the public spot page (no cams; no scraping; look only).

- **Report block:** one compact block up top: condition, height range, a short summary, then a row of small tiles (tide, wind, swell, water), each showing one number and one label.
- **Type:** one large number and few weights. Small headings separated by dividers rather than padding.
- **Days:** one shared timeline (surf, swell, wind, tide on one x-axis); detail sits behind expand or tabs.
- **Colour:** one condition scale used everywhere, lots of neutral grey, accent only on ratings and controls.
- **Do not copy:**
  - their cams;
  - heights that read as measured;
  - hiding that ratings are model output;
  - their palette or condition words;
  - their upsell chrome.

  SWELLO's provenance lines are the differentiator. Make them shorter; never drop them.

## Stages (proposed)

### A. Shorter provenance, same honesty (Forecast)
- Tide source appears once in full (the Tide card). The Now card and the ribbon get a short chip, e.g. "NOAA · 1.8 km · interpolated", that opens the full line.
- The key under the day strip is at most 3 lines at 390 (it is about 6 now).
- The Today ribbon caption is at most 2 lines.
- "How right we've been" in Surf notes is one line plus a Details link.
- **Acceptance:** the data-honesty reviewer is clean; every fact is still reachable in one tap; Forecast at 390 is at least another 10% shorter.

### B. Home
- At 390, Sunrise / Sunset / Next tide / Water become one compact strip or tight 2×2 with each label next to its value. Today it is a loose 2×2 grid.
- Popular spot cards are the same height. Ocean Beach lacks Share, so its row sits higher than the others.
- At 1440, "Best right now nearby" uses the full width (today the right half is empty).
- Close the gap between the hero's button and the wave drawing.
- The closing disclaimer becomes one line.

### C. Personal at 1440
- Two columns: profile and favourites on the left, preferences and units on the right. Today it is one 720 px column with about 700 px of margin.

### D. Look and feel
- **Palette:** fog ground, Pacific ink, SWELLO blue for navigation and links, and the condition colours used only for conditions. Check that red "Skip" doesn't read as an error. A muted condition red, or a neutral "Skip", is the user's call.
- **Type:** tighten to a few sizes and weights; section headings small, separated by dividers rather than padding.
- **Method:** the design-critic agent on 390/1440 light and dark against the references, then one implementation pass.

### E. Surfline look (by hand)
- The user, or Claude through the Chrome extension, opens one public Surfline spot page at phone and desktop width and confirms or corrects the hypotheses above before D starts.

## Gates (every stage)
tsc, npm test, build, journeys 8/8, t034, phone-pass, tide-saved-check, ca-only-check, data-honesty review, a look at 390/1440 light and dark, then deploy and a prod check at both widths.

## Relation to the Fable briefing
Fable's Track 1 (declutter, "day in one sentence") overlaps A and D. Proposal: Fable takes A and D together with Track 1 (same screens, one coherent pass). The product session takes B and C, which are independent layout work. Track 0 (cold load) is mostly answered: the stuck-feed fix took prod cold Home to 3.2–6.5 s in 9 of 9 runs, so Track 0 shrinks to a check plus the remaining under-4 s goal.

## Decisions for the user
1. Approve stages A–D, or reorder them.
2. Fable takes A and D with Track 1, and the product session takes B and C. Yes or no?
3. Red "Skip": keep it, mute it, or make it neutral?
