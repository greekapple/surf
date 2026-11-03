# Home: simple drawn waves, honest week sizes, a cam-ready hero
Status: APPROVED in principle (user, 2026-11-03, in class: "use that spec and improve the 3d but also anything else on the website that you think could use work … the home page … i liked the little depictions of waves that were simple … ultimately the photos will be replaced with real surf cams"). The lead chose the details below. The user reviews the result.

## Context (lead, Home at 1440 and 390 on :5180, 12:08 PM)
- **Hero:** a credited Wikimedia photo of the best-bet spot (Salmon Creek: an empty beach, no surf visible), a greeting and one sentence.
- **Below the hero:**
  - a strip (sunrise, sunset, next tide, water, quiver pick);
  - "This week" (spots × 7 days);
  - "Popular spots" (3 photo cards);
  - "Best right now nearby" (3 rows).
- **Simple drawn waves:**
  - earlier versions had them: T-038's `SeaState` (swell crests from direction and period, wind streaks; deleted in T-048) and the Wave scale Diagram (a simple wave beside a person);
  - today Home has no drawing of a wave at all: only numbers, bars and photos.
- **Cams:** `docs/product/CAMS-PLAN.md`. 6 verified public cam links exist (T-080). The user plans their own cams, so photos are temporary.

## Problems
1. **No wave on the page.** Home is all text, bars and photos of empty beaches. Nothing shows size at a glance, the thing the user liked.
2. **The week sizes are absurdly wide:** "4–22 ft", "6–18 ft", "4–13 ft". `dayRange` (src/services/spotHour.ts:75) takes the lowest low and the highest high over every daylight hour, each already an uncertainty range. The user has said the ranges are far too wide twice.
3. **The hero photo shows no surf.** An empty beach at the best-bet spot says nothing about conditions.
4. **"Stale estimate"** in Best right now nearby, on every row, while the header says "Model data · 12:08 PM". Either the nearby rows use a different freshness path or the label is wrong. Check against the T-084 freshness rule.
5. **Photo cards at 390** rendered as broken-image boxes with alt text in the full-page capture. Check whether it's lazy-loading under full-page capture or real.
6. **Density:** each Popular card has 9 text items. The week grid's faint blue "size curve" is barely visible and unexplained.

## Target
- **A simple drawn wave per spot, from the forecast** (`WaveGlyph`, inline SVG, no AI, no photos):
  - one clean line-drawn wave profile whose face height is drawn to scale against a small person silhouette at the user's height (the same scale rule as the Wave scale Diagram);
  - steepness from the period;
  - a lip or curl only for estimated plunging breaks;
  - quiet colour from the rating.
  - Used:
    - on each Popular/your-spots card (replacing the photo band, or beside the number);
    - in the hero at large size, for the best bet;
    - tiny in each week cell (the day's typical size).
  - Labelled: `aria-label` "drawn to scale: about X ft face beside a 5'10" person", with a visible caption once per page, "Drawn from the forecast · approximate".
- **The hero, cam-ready:** a `MediaSlot` that shows, in order:
  1. a live cam for the spot when one is configured (none yet; the slot reads the cams list from T-080/CAMS-PLAN);
  2. otherwise the large drawn wave on a calm gradient tinted by the time of day.
  - The credited photo moves to the spot page, not Home.
- **Week sizes people can use:** each cell shows the day's typical range (the midday hour's estimate, which `dayRange` already computes as `typical`). The full daylight spread goes in the cell's tooltip/aria ("ranges 4–22 ft over daylight"). The faint curve goes or gets a legend.
- **Popular cards:** name, rating, the number, the glyph, wind and tide on one line, best window. Six items, not nine.

## Constraints
- **Data honesty:**
  - glyph heights come from the same headline (`headlineSurf`) as the number next to them;
  - offshore-only spots get no surf glyph: a flat swell line with "offshore only";
  - no glyph where there's no estimate;
  - captions say "approximate".
- **Function first:** no decoration that isn't data. No AI imagery on Home (the 2026-10-31 rule).
- **Performance:** Home JS must not grow more than 5 KB gzip. Inline SVG, no new dependencies. Keep the T-091/T-097 budgets.
- **Keep:** the greeting, the best-bet sentence, the at-a-glance strip, the week grid structure, the nearby ranking, the 390 tap targets ≥ 44 px, dark mode.

## Owners and level
- **Product** (Level 2, branch `t106-home-waves`): WaveGlyph, the hero MediaSlot, card density, and a check of problem 5. Problems 1, 3, 5 and 6.
- **Engineering** (Level 2, branch `t107-week-honest`): the week cell uses the typical range with the spread in aria/tooltip and tests (problem 2), and finds and fixes the "stale estimate" on nearby (problem 4). Engineering also owns any `dayRange` API change; product consumes it.
- **Lead:** gate, Codex, design-critic pass on the merged Home at 1440 and 390, light and dark.

## Acceptance
- On Home, every spot with an estimate shows a drawn wave whose face-to-person ratio matches the number within 10%. A unit test checks the ratio for 3 sizes.
- No week cell shows a range wider than the midday estimate's own range. A test uses today's Ocean Beach fixture. The spread is in aria.
- The nearby rows say "stale" only when the T-084 rule says so. A test, plus a browser check while data is fresh.
- The hero shows the drawn wave (no cams configured); MediaSlot has a typed cam entry point and a test for the order (cam → drawn).
- 1440 and 390, light and dark: screenshots looked at by the lead; design-critic finds no P0/P1.
- Checks: tsc, tests and build; journeys 8/8; t067, t043, t074, t034 density pass (update intended changes, with backups).
