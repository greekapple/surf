# T-050 Spot page + Quiver, beautiful (product, 2026-11-02 overnight)

Branch `worktree-product`. Commits:
- b4ca300 (spot page);
- the Quiver commit;
- merge 97463be (rebuild incl. T-051/T-052);
- this handoff.

Interaction notes from the user's "more interactive" message are folded in. All motion is ≤ 300 ms, and reduced motion turns it off.

## Spot page
- **Header band.**
  - The spot's own credited photo (`SpotPhoto`, credit visible), 176 px at 1440 and 116 px at 390, under a soft scrim.
  - When a spot has no photo, a plan is drawn from real coastline geometry (Natural Earth 10 m, public domain, credited as approximate): land, sea, the spot and north.
  - The surveyed shore normal appears only where it exists (Ocean Beach). Nothing is invented for other spots.
  - Phones: meta + credit on top; hour, star and Now along the bottom. The name is still sr-only there (T-048).
- **Card language.**
  - One icon set in the card headers.
  - A mini wind compass: the arrow shows where the wind blows; the beach facing is dashed and the offshore half shaded (only when surveyed).
  - A mini swell rose: one arrow per partition, width/length by energy H²·T.
  - The tide mini-curve is kept.
  - "provisional" moved into the RATING footer: the header tag made the phone card overflow the page.
- **Tap to expand.** Rating, Wind, Tide and Swell cards are whole-card buttons (aria-expanded). They open a detail panel under the grid:
  - **Rating:** `explainRating` (T-049). Scored factors ✓/~/✗ with engineering's reasons, then a "Context, not part of the score" section (tide, nearshore when present), then the reliability reasons.
  - **Wind:** a 24 h compass trace of the day. Dots sit where the wind comes from, further out when stronger, coloured by shore relation. Tapping a dot selects that hour.
  - **Tide:** the full day curve (TideDay); tapping it selects an hour.
  - **Swell:** the direction × period rose (PolarSwell).
- **Scrubbing.** Dragging across the 7-day strip with a mouse scrubs days live, and every card follows. Touch keeps native scrolling. The chart already drags.
- **Wave scale panel.** Since the T-052 merge it uses your height from Personal; "(default)" shows only when unset. Shapes animate between hours.
- **Honesty fix.**
  - Live data has no wave character, so `scoreBoard` can't rank boards. The Board Match line used to say "None of your boards suits this size", which was misleading.
  - It now says Board Match also needs the wave's character (peaky, soft, steep), which live data doesn't provide.

## Quiver
- **My Boards as a premium wall.**
  - Every board is at one true scale (the enlarged selection is gone), against a feet ruler whose 0′ is measured from where the boards stand.
  - A near-white wall with panel seams and a floor, so the illustrations' soft backgrounds don't show as boxes; contact shadows; the selected board is lifted and underlined.
  - Each board has a label: name, length · type, and **today's size fit** at the selected spot-hour.
  - Size fit compares the board's own min/max (if recorded), else its category range from `recommendation/board.ts`, with the headline estimate: "In its range", "Edge of its range", "Bigger…", "Smaller…". The range used is in the tooltip. There is no verdict without an estimate.
  - A line on the wall reads "Today's size fit · est. 4–9 ft at Ocean Beach (model estimate)".
  - The overlaid spec card and the desktop thumbnail strip are removed: they repeated the wall and the spec sheet. The strip stays on phones, which show one board at a time.
- **Board Match.**
  - It uses the T-046 headline estimate range (`scoreBoard(..., est)`), like the spot page.
  - When the range exists but the wave character doesn't, the line and the Board Match tab say exactly that instead of "offshore only".
- **Spec sheet** (annotated board): the giant ghost length numerals are gone, the title is 26–34 px Inter, values 22–28 px, labels uppercase 12 px; a soft light-set background.
- **Board room.**
  - A board rail under the stage: outline, name, length and today's fit. Tapping a board brings it onto the stage (`onPick` → the same selection as the rack). The rail swipes on phones.
  - A softer floor gradient behind the 3D stage.
  - Fixed a phone overflow the rail caused (min-width 0 on the show grid).
- **Imagery.** The AI illustrations stay captioned "AI-generated, not your board". No AI image is presented as theirs.

## Checks (5184, after the T-052 merge; real output)
- tsc OK · npm test 305/0 · build OK.
- journeys 8/8 · t045-spot 53/0 · **t050-spot (new) 36/0** · firstview 40/0 · density ALL PASS.
- t035-board-room 29/0 · t025-quiver 27/0 · t023-quiver 52/0 · t043-map 55/0 · t038 16/0 · wave-spot 12/0 · t041 tides 4/0 and flag 5/0.
- **t050-spot** covers:
  - photo band with a visible credit;
  - plan band from Natural Earth for a spot without a photo (Davenport);
  - band ≤ 220/160 px; card icons; minis;
  - the four expand details, with the rating context separated, plus Close;
  - tapping a wind-trace dot selects the hour;
  - day-strip drag scrub;
  - overflow measured against the real viewport; console.
- **Toolkit edits** (backups `*.pre-t050` in the scratchpad):
  - `journeys` 5: rack buttons, wall label, spec sheet;
  - `t025-quiver`: wall label, spec sheet, click on the wall instead of the strip;
  - `t023-quiver`: counts rack slots;
  - `t045-spot`: overflow measured against the configured viewport width. A mobile layout viewport grows with the content, so the old `innerWidth` check missed a 421 px page.
- **Shots:** `playwright-toolkit/swello/artifacts/t050/`.
  - `quiver-{before,after}-{rack,room}-{1440,390}[-full].png`
  - `1440|390-{ocean-beach,davenport}-first.png`
  - `1440|390-detail-{rating,wind,tide,swell}.png`
  - spot shots in `artifacts/t045/t050-*`

## Open
- **Wide estimates:** with v1/v2 ranges as wide as 4–9 ft, most boards read "Edge of its range". That's honest, but it'll be more useful once the estimates tighten.
- **Board Match needs wave character:** the full ranked match stays unavailable on live data until `f.character` exists. That's an engineering data item.
- **Photos:** only Ocean Beach, Bolinas and Linda Mar have their own photos; the others get the drawn plan.
