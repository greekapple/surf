# Phone pass: designed for the phone, not squeezed (2026-11-10)

The user: "the phone version still needs work with overlapping and such, make the functionality and aesthetics much better". Critique: `docs/design/PHONE-CRITIQUE-2026-11-10.md` (design-critic, live screenshots at 390). The verdict is "Partly": it's the desktop layout squeezed down. Deploy is approved as part of the ongoing work once gated. Every honesty label stays; some move (behind a disclosure, or into a chip).

## Fix, in order (the critique's ranking; details and evidence are in the critique)
1. **Spot page: the answer comes first.** The first screen shows the spot name once, then the Call (verdict and window), the surf number and the rating, all above the fold at 390×664. The hero photo shrinks to a strip or moves down. The page header's duplicate spot selector merges with the title.
2. **Map controls give the map back.**
   - The legend collapses to a chip that expands on tap.
   - Attribution becomes an (i) button that opens the credits (still one tap away, as required).
   - The time bar compacts to one row.
   - Floating buttons are grouped.
   - Target: at least 70% of the screen is map on the first view.
3. **Map labels.**
   - Spot pin labels take priority over basemap place names (hide or dim basemap labels near pins, or use a basemap style with fewer labels at these zooms).
   - Zoomed-out region pills fit their content (nothing spills).
   - Coordinate with zoom-groups: check it on that branch.
4. **The zoomed-out map's black ocean behind the legend.** Find out whether it's capture timing or real. If real, fix it (field not drawn, or the ocean background colour).
5. **Hookipa:** the wave drawing overlaps the time and the star. The hero layout keeps them apart at every width.
6. **Chart labels:** no collisions; time axis labels thinned (not "12 AM" seven times); a day boundary marker instead.
7. **Two-column blocks** stack or shrink so values never wrap ("37.4 / mph").
8. **Day strip:** say "est. · high confidence" once per strip, not in every column (keep it accessible).
9. **Copy errors in the board text** ("A 9.2 s", "soft.."): fix them at the source and add a test.
10. **Header:** decongest it (search becomes an icon on phone, opening a full-width search; the status dot goes inside the avatar menu or next to the logo). Remove the stray underline under the avatar on Personal.
11. **Home "This week":** remove the explanatory paragraph (design rules). Put the legend behind an (i).
12. **Quiver:** the board stage scales to the phone width.

## Signature (after 1–12, one at a time)
- **A. Today ribbon.** One compact strip: daylight, surf, wind relative to the beach, and tide, with the best window marked. Every value comes from what the page already shows.
- B. A map bottom sheet whose pin numbers update as you scrub time.
- C. A swipeable big-number hero across favourite spots.

## Acceptance
- Playwright at 390×664 and 390×844, light and dark: no overlapping interactive elements (the overlap probe), no horizontal scroll, and nothing behind the tab bar at the end of a page.
- **Spot page:** the Call and the surf number are visible without scrolling.
- **Map:** at least 70% map on the first view.
- The labels from the critique are all still present somewhere reachable.
- t034 density, journeys, t043, coast-pills, clock-deselect, point-panel-390 and landscape-tap all pass.
- Before/after shots of each screen, looked at.
- design-critic re-critique once at the end.
- data-honesty review for any moved label.

## Owner
product-term, after zoom-groups and on top of it (same screens).
