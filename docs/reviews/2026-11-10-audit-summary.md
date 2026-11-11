# Full-app audit: combined list (2026-11-10, live site b681167b)

Sources (full evidence and screenshots in each):
- `2026-11-10-audit-forecast.md`: Home and spot pages, 27 items (F#);
- `2026-11-10-audit-map.md`: map and Explore, 24 items (M#);
- `2026-11-10-audit-rest.md`: Quiver, Personal, 3D, nav and legal, 29 items (R#);
- `2026-11-10-audit-design.md`: visual design, 15 items plus 3 system fixes (D#);
- the lead's own checks (L#).

Duplicates are merged. Items already fixed by work in progress are marked **[in flight]**.

## A. Wrong or misleading data: fix first (recommended: ALL)
| ID | What | Where | Effort |
|---|---|---|---|
| A1 | The camera still can be 2–3 h old but is shown as recent, because USGS posts late and the "10–30 min" claim is false. Judge age by the image's own capture time (or the posted time minus the observed lag), and say "taken about …" | F1 | S |
| A2 | The spot tide card draws the SF regional curve without naming the station. Mavericks and Linda Mar show OB's curve, and Home names a different station | F2 | M |
| A3 | The tide chart says "No tide station near this spot yet" under a card listing that station's tides (Pipeline, Hookipa, Cocoa, …) | F3 | S |
| A4 | Ocean Beach rates "Solid" while its Why says "only middling"; the star and bars contradict "no window" | F4 | M |
| A5 | Board Match ranks a 1–5 ft fish #2 in 10–13 ft surf (fit ignores how far outside its range a board is) | R2 | S |
| A6 | Loading is reported as "no data" ("None suits it", "No forecast data", "No record") on Quiver, Board Match, Personal, search and the map | R1, M6 | M |
| A7 | Map point panel inside SF Bay: "No value here" with wave numbers listed under it | M1 | S |
| A8 | The map's "valid" time is 1–2 h off the time-bar hour, while also saying it's interpolated | M2 | M |
| A9 | Privacy page: wrong map tiles (Esri), "nothing is embedded" (cameras are), and it misses swello-map-frames | R3 | S |
| A10 | Terms: tides "from one SF station" is out of date, and there's no credits page. Open-Meteo (CC BY needs attribution), NOAA, CDIP, PacIOOS, USGS and OSM/OpenFreeMap aren't credited | R4 | S |
| A11 | Every home region is suffixed ", CA" ("Oahu North Shore, CA") | R5 | S |
| A12 | Personal calls surf height "face", which contradicts the product convention | R6 | S |
| A13 | Junk swell partitions shown as swell | F12 | S |
| A14 | The board line contradicts the Swell card | F11 | S |
| A15 | Home's best bet disagrees with Home's own "Best tomorrow morning" list, and the hero caption says 6:00 while the sentence says 6:20 | F9, F19, L1 | S |
| A16 | Malibu's "Cams" block says "Live" and lists one camera twice | F14 | S |
| A17 | Offshore heights look like surf estimates in the day strip (same big numerals) | D2, F22 | S |
| A18 | The Swell, Wind and Period map legends don't name the layer; Swell lacks "not surf size" | M7 | S |
| A19 | The point label and point panel give different heights for the same point and hour | M16 | S |
| A20 | Hookipa says "no buoy within 100 km" though a buoy (Pauwela) exists but is silent; Cowell's checks against a far buoy while naming a near one | F16, F17 | S |

## B. Broken or clearly wrong behaviour (recommended: ALL except B9)
| ID | What | Where | Effort |
|---|---|---|---|
| B1 | Region chips never move the map (NaN error; a one-line fix in fitPoints) | M4 | S |
| B2 | Unknown spots and pages silently show Ocean Beach or Home; there's no 404 | F6, R9, M20 | S |
| B3 | 11 slug collisions make spots unreachable by URL (e.g. s-turns NC vs HI) | F7 | S |
| B4 | A JS error opening a spot from the header search (adapters.ts:25) | R10 | S |
| B5 | After a search, a neighbour's pin covers the chosen spot, so a tap opens the wrong spot **[in flight: zoom-groups §5 puts the focused pin on top; verify]** | M5 | S |
| B6 | The map sea paints black and Hawaii's islands vanish; a WebGL feedback-loop error on every load | M3, design 4 | M |
| B7 | Spot pages outside NorCal take 6–16 s to show the surf number (NorCal batches load first) | F8, M9 | M |
| B8 | Scrubbing the time bar janks | M8 | M |
| B9 | Phone landscape is unusable **[mostly phone-pass]** | M10 | L |
| B10 | The wave scale shows the wrong hour while loading; the 3D stage sometimes shows no surfer | R11, R13 | M |
| B11 | Add board pre-fills invented dimensions as real values | R12 | S |
| B12 | Unit settings (m, km/h) don't reach Quiver, the preference form, Home's board pick or the legend | R7 | M |
| B13 | Selected day and hour aren't in the URL; Compare changes its hour on its own | F20, M15 | S |
| B14 | The "Skip" verdict in the nearby list is near-invisible (contrast 2.0–2.3:1) | F10 | S |
| B15 | "After dark" gives no answer for tomorrow when there's no Go window | F5 | S |
| B16 | Pages never reach network idle (something keeps polling) | R29 | S |

## C. Polish (recommended: the S ones, batched)
- **Copy:**
  - "(explainRating)" code word in the Why (F15);
  - a bare "~" in the wave-scale descriptor (R27);
  - "A 9.2 s" capital mid-sentence (R17);
  - mixed US/UK spelling (R23);
  - the same document title on every route, with an em dash (R20);
  - a stray ":" in the header ("You : Personal") (L2).
- **Unused font preload** on every page (F27, R21, M23).
- **Home "This week" cells:** add the unit and kind (F21).
- **Desktop spot grid:** fill the hole (F23). Cap the letterboxed camera still to its width (F24).
- **Status chip** says "some sources limited" without saying which (F25).
- **Home "Right now" at night:** rank tomorrow AM instead (F26).
- **Phone peek:** cuts off the wind line (M18).
- **Map:** the time bubble overlaps the panel note (M17); poor and unrated pins look alike (M19); the source chip briefly flickers (M21); coast pills truncate with no ellipsis (M11) **[in flight: zoom-groups]**.
- **Map search:** ranking and autofill (M13), and focus after picking (M14) **[in flight: zoom-groups §5–6]**.
- **Quiver and Personal:**
  - Favourite spots: misleading stock photos, and the page is too tall (R8) **[partly fixed by "My spots" paging]**;
  - Showroom: a blank stage at first (R14), plus copy (R15);
  - forms unstyled (R25);
  - dark theme leaks on Quiver (R26);
  - Compare boards is thin (R28);
  - list alignment (R24);
  - the settings contradict each other (R18).

## D. Design system (bigger, recommended for Fable Wednesday Track 4)
Items D1–D15 from the design audit:
- the phone H1 overprints the meta line (D1);
- no real photography (D3);
- map pins share the field's colours, with rainbow layer buttons (D4);
- the accent is Apple blue, not the brand orange (D5);
- 17 type sizes (D6);
- dark-mode contrast for "Weak" and "poor" (D7);
- one dash glyph means two things (D8);
- grid holes and walls of prose (D9);
- the chart legend (D10);
- three segmented-control designs and 10–11 radii (D11);
- page edges differ (D12);
- the phone map legend is clipped (D13);
- the Home stat baseline (D15).

The three system fixes:
1. type tokens;
2. colour roles tested in both themes;
3. five shared components (PageHeader, Hero, Segmented, Meter, StatCell).

## Decisions for the user
1. **Font (D14):** the live font is Inter/Instrument Sans, but PRODUCT.md says Archivo and RULES.md calls Inter an "AI tell". Switch to Archivo, or update the docs?
2. **Demo boards (R16):** PRODUCT.md says the example boards are fictional, but the app shows real retail models (e.g. Firewire Seaside Helium, with a retailer link). Keep the real models, labelled "Example board (retail model)", or make them fictional?
3. **Backup and restore:** Personal has export but no restore. Add it?

## Recommended deploy set (lead)
**Now (one batch, about a day of work across the two terminals):** all of A, B1–B8 and B10–B16, and the S items in C.
- B9 (phone landscape) folds into the phone pass.
- D goes to Fable on Wednesday, after the font decision.
