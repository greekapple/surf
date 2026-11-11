# Audit fixes: the recommended set (user approved, 2026-11-10)

The user: "yes do what [you] recommended, do all that". The list and evidence are in `docs/reviews/2026-11-10-audit-summary.md`, with details in the four audit files beside it.

**In scope:** all of A, B1–B8, B10–B16, and the small (S) items in C. B9 folds into the phone pass. D goes to Fable on Wednesday.

**Still with the user, so don't change them:** the font family, the example boards, and backup restore.

## Owners (no two owners touch the same files)
**Agent W1 (worktree `audit-w1`): labels, copy, routes, Home and legal.**
- Data labels:
  - A3: the "no tide station" chart text;
  - A11: ", CA";
  - A12: "face" in Personal;
  - A13: junk swell partitions (hide below the existing noise floor, or label them);
  - A14: the board line vs the Swell card;
  - A15: Home's best bet vs its list vs the hero caption;
  - A16: Malibu's camera block shows a camera twice and says "Live".
- A17: offshore heights styled apart from estimates in the day strip.
- Legal:
  - A9: the Privacy page;
  - A10: the Terms page plus a new Credits page naming every source with its licence and attribution: Open-Meteo CC BY 4.0, NOAA, NWS, CO-OPS, NDBC, CDIP, PacIOOS, USGS, OpenFreeMap/OpenMapTiles/OSM ODbL, the Marine Institute and IMOS when wired, and the YouTube channels.
- Routes:
  - B2: a 404 page, and unknown spot slugs say "Spot not found" with search, never silently Ocean Beach;
  - B3: the 11 slug collisions get unique slugs with the old slug kept as an alias where it was unambiguous.
- B14: the Skip verdict's contrast.
- B15: "After dark" points to tomorrow's answer.
- Copy (C):
  - "(explainRating)";
  - the bare "~";
  - "A 9.2 s";
  - one spelling: US English throughout;
  - per-route document titles with no em dash;
  - the header "You : Personal";
  - the unused font preload;
  - the Home "This week" cells get their unit and kind;
  - the status chip names the limited source;
  - Home "Right now" at night ranks tomorrow morning.

**Agent W2 (worktree `audit-w2`): Quiver, Personal, search, loading states.**
- A5: Board Match penalises distance outside a board's range.
- A6: loading is never reported as "no data" on Quiver, Board Match, Personal or the header search. Each shows a loading state until data has arrived or definitely failed.
- B4: the header-search TypeError (adapters.ts:25).
- B10: the wave scale shows the selected hour while loading, and the 3D stage always has the rider (or says it's loading).
- B11: Add board uses placeholders, not invented values.
- B12: the unit settings reach Quiver, the preference forms, Home's board pick and the legends.
- B16: find and stop the background polling that prevents network idle.
- C items:
  - Favourite spot photos stop implying conditions (use the spot's own credited photo or none);
  - a Showroom skeleton and copy;
  - the settings that contradict each other;
  - list alignment;
  - styled file inputs;
  - Quiver dark-theme leaks.

**eng-term (after the spot batches):**
- A1: the camera age comes from the image's capture time (USGS frame timestamp or EXIF if present, otherwise the observed lag), with a "taken about …" caption, and Offline when it's over 2 h.
- A2: the spot tide card names its station and uses the spot's own picked station, consistent with Home.
- A4: the rating word, the Why text and the day star must agree. Find the source of "Solid" against "only middling".
- A20: the buoy checks: a silent nearby buoy is described as silent, and the check uses the named buoy.
- B7: spot pages outside NorCal load their own data first.

**product-term (after the zoom-groups correction, before the phone pass): the map.**
- A7: no values inside enclosed water.
- A8: the valid time matches the time bar, or is honestly labelled.
- A18: legends name their layer, and Swell says "not surf size".
- A19: the point label and the panel agree.
- B1: region chips work (maplibreEngine.ts:59 maxZoom).
- B5: verify the focused pin is on top after search.
- B6: the black sea / WebGL feedback loop.
- B8: scrub jank.
- B13: the selected day and hour go in the URL, and Compare's hour is stable.
- C map items: the time bubble overlap; poor vs not-rated pins; the source chip flicker.

## Rules
- Each owner: a branch from forecast-trust, one commit per item, tests where behaviour changes, and the gates (tsc, test, build, journeys, plus the toolkit scripts for the area).
- Before and after screenshots at 1440 and 390 for visual items.
- The lead runs a code review and a data-honesty review per branch, with one correction round. Read-only reviews use git show/diff, never checkout.
- Merges in this order: eng batches → W1 → W2 → eng fixes → product map fixes. Then one deploy and a live check.
