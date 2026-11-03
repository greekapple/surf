# T-095 (product): fit wording, night landing, 390 sweep

Branch `worktree-product` (forecast-trust merged first).

## 1. Fit wording
- **Labels:** `sizeFit` (`src/features/quiver/fit.ts`) now says "Surf above its range" / "Surf below its range" / "In its range" / "Edge of its range". That covers the wall, the phone strip, the showroom rail and fit line, and the Board Match ranking.
- **Board Match sentence:** now names the surf, e.g. "est. 7–10 ft at Ocean Beach is above its range" (was "bigger than its range for est. …").
- **Home's quiver pick:** has no fit label ("Small-day fish suits 1–5 ft"), so nothing to change there. Compare boards shows specs only.
- **Test:** `src/tests/fit-words.test.ts`: all four labels, and never "bigger" or "smaller". Verified live on the wall and the Board Match line.

## 2. Night landing (shot after midnight, 00:40 PST)
- **Cause:** at night the Home welcome multiplied a 60% navy over an already scrimmed photo, so it went almost black.
- **Home fix:** the night tint is now a lighter blue cast, plus a scrim only behind the text corner (night and dusk). The photo (beach, hills) is visible again.
- **Spot band fix:** a stronger bottom scrim and full-white small text. On phones there's also a top scrim, since the title sits at the top. The welcome band is excluded from that top scrim.
- **Measured** white-text contrast against the 95th-percentile background behind each text line, with the text hidden:

  | Band | Contrast |
  |---|---|
  | Home 1440 | 8.4:1 |
  | Home 390 | 5.1:1 |
  | Spot 1440, five spots (Linda Mar, Steamer Lane, Ocean Beach, Mavericks, Pleasure Point) | 7.8–10.0:1 |
  | Spot 390, same five spots | 7.1–12.1:1 |

- **Shots:** `artifacts/t095/{before,after}/`.

## 3. 390 sweep (Map, Compare spots, Compare boards, Personal)
Interactive elements under 44 px; inline text links are exempt. 50+ found before, 0 after:
- **Phone header (all screens):** search and theme 40→44, profile height 40→44.
- **Footer links:** Privacy and Terms 44 min.
- **Skip link:** 44.
- **Map spot labels:** a 22 px label gets an invisible 44 px hit pad.
- **Map play button:** the thin timeline's 38 px button gets a 44 px hit area.
- **Board arrows:** 40→44.

Spacing:
- **Compare spots (phone):** names broke one word per line and "Bolinas" ran into "5.8". Rows are now name and height / rating, swell, wind / full-width Forecast and map buttons.
- **Compare boards (phone):** captions are 17 px, and a length never splits ("6′ / 0″").
- **Map and Personal:** no spacing problems found.

## Checks (5184)
tsc OK; unit tests 438/438; build OK; t025 27/0; t047 55/0; t074 28/0; t035 29/0; t043 35/0; t045 54/0; density ALL PASS; journeys 8/8.
