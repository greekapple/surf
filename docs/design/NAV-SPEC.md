# NAV-SPEC: Surfline-led navigation, top bar and concise Home (T-022)

Status: **phase 1 spec for lead review** (2026-10-30). No code yet.
Evidence: `~/Development/swello-design-references/15-surfline-nav/` (README there; third-party, reference only, never shipped), plus the user's own Surfline screenshots in `01-navigation/` and `02-forecast/`.
Limits: Surfline spot pages returned a Cloudflare bot check (HTTP 403), which was not bypassed. The signed-in **Favorites bar** was not captured (no login). Both are described from the user's screenshots and the known product, and marked *unverified* below.

## What the user asked for
Surfline as the baseline for navigation and the top bar, reverse-engineered with our own touches; Apple for restraint. Home = saved spots, **no forecast data**, concise. Every top-level control must change what you see. **No section pills** (the current `SubNav`).

## Pattern table
| Surfline pattern | What it does for the user | SWELLO equivalent | Our twist | Omit |
|---|---|---|---|---|
| **Thin white top bar:** logo · 4–5 text links · wide search · account (`surfline-1440-home.png`) | One glance: where am I, where can I go, find a spot | Bar: **SWELLO** · Forecast · Map · Quiver · search field · Personal (avatar) · theme toggle | Text links like Apple (no chevrons, no icons); the current area is underlined | Get App, Go Premium, Learn, Watch, About (no content behind them) |
| **Cams & Forecasts mega-menu:** Recently visited rail + Continent › Country › Region › Area drill-down (`surfline-1440-menu-cams-forecasts.png`) | Reach any spot in 2–3 clicks without typing | **Forecast** hover panel: left rail = Saved + Recent; main = Region › Spot list (we have one coast: Region › County › Spot) | Each spot row shows its condition colour + labelled height (from `spotStrip`), so the menu is already a mini report | Continent/country levels (one coast); El Niño, WaveFax, Outlooks, Hurricanes (no content) |
| **Maps** link → full-page map (`surfline-1440-menu-maps.png`) | Map-first browsing | **Map** = today's Explore (renamed in the bar; `/explore` keeps working) | Windy-style chrome on the map itself (`windy-1440-map.png`): search + layers + timeline live *on the map*, not in pills | A second map menu |
| **Search overlay:** full width, grouped results (Surf Spots with region, Map Area, News, Travel) (`surfline-1440-search.png`) | Type a name → straight to the spot | Search field in the bar → overlay with **Spots** (name · county · condition colour) and **Regions**; Enter opens the first spot's Forecast | Results show the live condition colour; ↑/↓/Enter; `/` focuses search | News and Travel groups |
| **Favorites bar** (signed in, *not captured*): horizontal strip under the header, one chip per saved spot with name, condition colour bar and height | Your spots at a glance on every page | **Saved-spots strip** under the bar on Home and Forecast: chip = name · condition colour · labelled height (`spotStrip`, e.g. "3–4 ft est." or "4 ft offshore") | Lives on Home and Forecast only, not the map; "Edit" opens Personal › Saved Spots; empty state = "Save a spot" | Any other numbers on Home |
| **Spot page** (user's screenshot `02-forecast/user-surfline-spot-report.jpg`): spot name + stat cards (Surf, Wind, Swell), tide, water, weather, compass; multi-day chart below | Everything about one spot at one moment | Forecast page (already similar). Spot name in the page header with a **spot switcher** (dropdown of saved + nearby) | The switcher replaces the old Forecast sub-pills; Wave Scale stays a link from the forecast's wave card | Ads, sponsor rows, the "ride a performance board" ad slot (our Board Match is real) |
| **Mobile header** (`surfline-390-home.png`): logo, search, Sign In, then the links as a scrolling row | Same choices on a phone | Phone: top bar = logo · search icon · avatar; the existing **bottom tab bar** (Home, Forecast, Map, Quiver, Personal) carries the areas | Bottom tabs instead of a scrolling link row (thumb reach; Apple pattern) | The scrolling text-link row |
| **Apple flyouts** (`apple-1440-flyout-iphone.png`): one large "Explore" column + small secondary columns; a quiet bar | Restraint: few links, big targets, no decoration | Flyouts for **Quiver** (My Boards large; Showroom · Board Match · Compare small) and **Personal** (Profile large; Saved Spots · Preferences · Journal · Account) | Flyout links replace the pills; each one goes to a distinct page | Pills, chevrons on every link, icon soup |

## SWELLO areas mapped
| Area (bar label) | Route | Reached by | Inside the area (replaces pills) |
|---|---|---|---|
| **Home** (logo) | `/` | Logo click; bottom tab on phones | Not in the bar. Concise page (below). |
| **Forecast** | `/forecast?spot=` | Bar link → hover panel (Saved, Recent, Region › County › Spot); search; strip chip | Spot switcher in the page header; Wave Scale via the wave card (`/forecast/wave-scale`, hidden route kept) |
| **Map** | `/explore` (+ `/map` alias) | Bar link | Layer controls on the map (Waves, Swell, Wind). Compare and Find Spots move into the map's side panel tabs, which already exist; old `/explore/compare` and `/explore/discover` stay as deep links |
| **Quiver** | `/quiver` | Bar link → flyout | My Boards · Showroom · Board Match · Compare as flyout links; each renders a different page (T-023 fixes the open-form bug) |
| **Personal** | `/personal` | Avatar → flyout | Profile · Saved Spots · Preferences · Journal · Account |

Home's old sections (`/spots`, `/windows`) redirect to `/` (acceptance 5: old URLs resolve).

## Home (concise)
1. **Hero:** one photograph, "Hello, <name>." serif headline, one line of copy, no numbers.
2. **Saved-spots strip:** chips with name, condition colour and labelled height from `src/services/spotStrip.ts` (T-024). Tap → that spot's Forecast. Nothing else from the forecast.
3. **Entry points:** three large tiles, *Check a spot* (Forecast), *Open the map* (Map), *Your quiver* (Quiver), each with a photo and one line, no data.
4. Footer.

**Removed from Home:** today's bulletin, the next-24 chart, the week matrix, best windows, the almanac, recommendations, the section nav. Target ≤ 2 viewports at 1440 and ≤ 3 at 390 (acceptance 3).

## Behaviour rules
- Every bar link, flyout link and chip **changes the visible content**; the nav script asserts a different main heading or region per click (replaces `sections-distinct`).
- No hover-only paths: flyouts open on click and keyboard too (the existing `AreaMenu` keyboard handling stays).
- One search, everywhere.
- Labels and data stay honest: strip heights are labelled ("est." or "offshore"), never bare; no rating colour without data (grey "No data").

## Out of scope for T-022
Visual polish of the Forecast/Map pages themselves; Quiver internals (T-023); `spotStrip` data (T-024, consumed only).
