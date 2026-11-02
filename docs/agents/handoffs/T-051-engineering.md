# T-051 Engineering handoff: Home and Map, beautiful and interactive

## Home (`src/features/home/*`, `src/services/homeDash.ts`, new `src/ui/SpotThumb.tsx`)
- **Real, credited photo on the card** when the spot has one (Ocean Beach, Linda Mar, Bolinas: the existing licence-cleared CC photos, credit printed on the image as "Photo: <author> · <licence>"). **Spots without a photo get a clean condition-tinted card and no stand-in picture** (no generic or AI image). Rating word in a condition-coloured pill, 5-segment bar, band-coloured top edge, soft hover lift.
- **Interactive 12-hour ribbon:** hover (mouse), focus, or tap "Next 12 hours" opens a mini bar ribbon of the existing rating for each of the next 12 exact hours (bar height and colour = score and band, gaps for hours with no record, never interpolated), with a text equivalent (`role="img"` label listing each hour's word) and a reduced-motion-safe expand.
- **"Best right now nearby" is now an elegant ranked list** (large rank numerals, band-coloured leader, tagged surf, mini rating bar) with a **time switch: Right now / In 3 h / Tomorrow AM** (radio group, arrow keys). "In 3 h" judges each spot at its exact +3 h hour; "Tomorrow AM" judges each spot at its best-rated hour between 6 and 11 AM Pacific tomorrow and says which hour. Ranked by the rating only; unrated and demo spots are left out.
- Data layer: `ribbon12`, `rankHour`, `bestNearbyAt`, `RANK_LABEL` (+3 tests; `home-dash.test.ts` has 10). `SpotThumb` is shared.

## Map
- The spot **callout shows the real photo thumbnail with its credit** at the top (`Callout.tsx` one import and one element; CSS appended to `explore.css`). Spots with no photo show none. Product's T-043 legend, chips and chrome were already light and consistent, so I left them alone rather than restyle over their work.

## Proof
`t047-home.mjs` ALL PASS (updated: photos only where real and credited, no AI imagery, ribbon opens/closes with 12 bars and a text label, ranking switches among the three titles); `t051-map.mjs` ALL PASS at 1440/390 (callout photo + credit); `journeys` 8/8 (on 5185); `t034-density` ALL PASS; `t013-overlap` ALL PASS; `t042-zoom` ALL PASS. tsc clean, **299 tests**, build ok. Shots in the toolkit `artifacts/t047/` (before/after of the same names) and `artifacts/t051/` (`{1440,390}-after-full.png` Home with a ribbon open and "Tomorrow AM"; `{1440,390}-map-callout.png`).

## Notes
- The map callout still prints the older `headline()` (e.g. "5.1 ft offshore · not surf size" at Ocean Beach) while Home and the spot page use the new `headlineSurf` range. Pointing the callout at `headlineSurf` needs the ocean bundle passed into `SpotCallout`; that is in product's Explore files, so I did not do it.
- Ranking "Tomorrow AM" uses each spot's best AM hour, so ties show the earliest 6 AM; this is deliberate and labelled with the hour.
