# T-111 (product): spot-page hero ready for cams
Branch `t111-spot-hero` from forecast-trust 8dbedf6. Spec: docs/specs/2026-11-03-afternoon.md §1.2. Shots: `artifacts/t111/spot-{ocean-beach,morro-rock,county-line}-{1440,390}-{light,dark}.png`.

## Changes
- **Media slot** (`heroMedia.spotMediaFor`, tested), reusing T-106's order:
  1. a SWELLO own cam (`OWN_CAMS`, none yet; muted inline video that falls back on error);
  2. the spot's credited photo;
  3. the selected hour's wave drawn to scale (WaveGlyph, the same headline as the Surf card, "Drawn from the forecast · approximate");
  4. the coast plan, only when there is nothing to draw.
  - Today 44 of 45 spots have a photo, so the drawing shows only at County Line.
- **The band keeps one height** whatever it shows: 176 px desktop, 144 px at 390 (measured).
  - The name, subtitle, time, star and Map stay.
  - The drawing sits in the open middle on desktop, and left of the star beside the time row on phones, with its caption in full.
- **Cams row:** under the daylight row, for spots with verified public cams (`camsFor`, T-063/T-080 data).
  - Each cam is a link (`a.sp-cam`, new tab, never embedded) showing:
    - "Live cam · <owner>";
    - what the camera shows (for example Morro Bay says it is the harbour side, not the surf);
    - "Run by <operator> · checked <date> · opens their site ↗".
  - The old in-band "Live cam" link is gone, so the band no longer grows a cam row on phones.
  - No row on spots without a cam.
- **WaveGlyph styles** moved from home.css to `src/ui/waveglyph.css`, imported by the component, so the spot page has them when opened directly.

## Checks
- tsc OK; 475/475 tests (new: the spot order cam → photo → drawn → plan; a public cam never becomes hero media; every cam names its owner and check date); build OK.
- journeys 8/8; t063 (cams) ALL PASS; t034 ALL PASS light and dark.
- **Layout shift at 390:** the band adds none. The page's measured shifts are the footer moving as content loads (0.21) and the NWS banner arriving late (0.09 on Ocean Beach). Same values on :5180 (forecast-trust). Not touched here.
