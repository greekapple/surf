# Design audit, live site, 2026-11-10

Scope: the live private site (swello.surf-prototype.workers.dev), captured in headless Chrome at 1440x900 and 390x844 (isMobile, DPR 2), in light and dark. Screens: Home, Ocean Beach, Pipeline & Backdoor, Cocoa Beach, Map, Quiver, Personal, Wave scale. Shots are in `/private/tmp/claude-501/audit-design/` and named `<screen>-<d|m>-<theme>-<top|s1..s4>.png`. `s<n>` is one viewport further down. Desktop regions are given in CSS px. Phone regions are in screenshot px (2x). The capture script is `~/Development/ai-system-setup/playwright-toolkit/swello/audit-design-1110.mjs`, and the DOM probe that gives the type, radius and edge counts is `audit-design-1110-probe.mjs` in the same folder.
Judged against: `docs/design/RULES.md`, `PRODUCT.md` (brand commitments), `swello-design-references/00-target/*` and `10-chatgpt-2026-10-28-dark/A-five-page-showcase.png` (composition, photography, hierarchy only), `15-surfline-nav/windy-390-map.png`, `surfline-390-home.png`. This audit builds on `docs/design/PHONE-CRITIQUE-2026-11-10.md` and does not repeat its 12 items. Most of them are still open on the live site: the spot selector row, the qualifier lines, the two-column wraps at 390, the map chrome, the Home paragraph and the card stack.

**Verdict: Partly.** The data and the honesty labels are stronger than Surfline's. The surface around them is not yet a system. The site uses three accent colours, 17 font sizes on one page and 10 or 11 corner radii per page. It has three segmented-control designs and five different left edges, and some heroes have no photograph. A discerning user reads that as "assembled", not "premium". Most of the fixes are token and component work, which lifts every screen at once (see the end).

## The 15 most visible shortcomings (ranked by user impact)

### 1. Long spot names break the phone hero: the H1 overprints the meta line
- **Where:** Spot page, 390, both themes, for any spot whose name wraps (Pipeline & Backdoor).
- **Evidence:** `pipe-m-light-top.png`, x 60–720, y 270–480. "Backdoor" (line 2 of the H1) is drawn over "Oahu North Shore · reef break". The wave illustration runs into "now", and the caption sits under the star.
- **Why it matters:** this is the first thing seen on a famous spot, and it looks broken. Prior item 5 covered the illustration only. This collision is in the type itself.
- **Fix:** lay the hero text out in normal flow (no absolutely positioned meta line), so the block grows with the title. Use `text-wrap: balance` and `font-size: clamp(28px, 7vw, 40px)` on the H1. When there is no photo, drop the illustration from the hero (see 3).
- **Effort:** S

### 2. Offshore heights share the surf number's style in the day strip
- **Where:** Spot page day strip, 1440 and 390, both themes (Cocoa Beach, Pipeline).
- **Evidence:** `cocoa-d-light-s1.png`, x 24–1416, y 205–318. Six of seven days show "<1 ft", "1 ft" or "3 ft" in the same 22 px bold slot as "1–2 ft est.", with "offshore" in 12 px grey below. The same happens on Pipeline Fri and Sat ("9 ft", "8 ft") in `pipe-d-light-s1.png`, y 240–350.
- **Why it matters:** the label is honest, but the hierarchy says these are the same quantity. A thumb-glance at dawn reads "9 ft surf". PRODUCT.md: "offshore height is never presented as surf size."
- **Fix:** offshore days get their own cell variant. Show a large "–" or "no surf est." in the number slot, and "offshore 9 ft" as one 13 px `--dim` line. Do not use the hero numeral style. Also make the confidence hatch visibly different from the "too far out" hatch (both currently use the same diagonal).
- **Effort:** S

### 3. No real photography: a gradient card and a drawn wave stand in for the place, twice per screen
- **Where:** Home hero (all viewports and themes); Pipeline and Cocoa heroes (no photo).
- **Evidence:** `home-d-light-top.png`, x 104–1336, y 84–396 (navy card, 2D wave and grey mannequin). `cocoa-d-light-top.png` / `pipe-d-light-top.png`, y 132–308 (pale blue gradient card and the same wave/figure), with the same diagram again 250 px lower in the Wave scale module (x 400–690, y 560–790). In dark, the Home hero card is navy on navy, so it loses its edge (`home-d-dark-top.png`).
- **Why it matters:** every approved reference (00-target/home.png, forecast.png, the A-showcase) leads with real location photography. PRODUCT.md commits to "authentic, credited location photography". A gradient card with a generic figure is the "artificial placeholder / empty showroom" tell, and showing it twice on one screen reads as filler.
- **Fix:** one Hero component with two variants. (a) A credited photo, as Ocean Beach already does. (b) No photo: a typographic hero set directly on the page ground, with no card, no gradient and no illustration. The spot name and the surf number at display size carry it. The Wave scale module keeps the diagram. On Home, use the best-bet spot's credited photo behind the sentence (`home.png` composition). Source CC photos for the top 40 spots from Wikimedia Commons, with the credit line already in the hero component.
- **Effort:** M (component S, photo sourcing M)

### 4. Map: rating pins use the field's hues; labels have coloured stripes; layer buttons are rainbow orbs
- **Where:** Map, 1440 and 390, both themes.
- **Evidence:** `explore-d-light-top.png` with `crop-explore-pins.png`. Mustard "fair" dots sit on the mustard sea (sampled #e2c02c behind #b8860b = **1.8:1**), and green "good" dots sit on lime (#d4d133 behind #248a3d = **2.7:1**). Every pin label has a 3 px coloured left border. `crop-explore-layers.png`: the Waves, Swell, Wind and Period buttons are conic rainbow gradients.
- **Why it matters:** RULES "Do not" names coloured left stripes (#11), rainbow colouring (#4), harsh gradients (#1) and orbs (#22). More importantly, the rating scale and the height ramp now share yellow and green, so a pin's colour cannot be read against the field. Windy keeps controls monochrome so that the field is the only colour on screen.
- **Fix:** make pins neutral: an ink dot with a white 2 px ring, and the rating as the word in the label ("6–8 ft · Solid"). Remove the stripe. If rating colour must stay, show it as a 6 px dot inside a white label, never on the field. Layer buttons: monochrome icon on `--s1`, and the active layer gets an ink fill plus a 4 px strip of its own ramp under the label.
- **Effort:** M

### 5. The accent colour system is not the brand's: Apple blue everywhere, orange almost nowhere
- **Where:** all screens, both themes.
- **Evidence:** links and actions are #0066cc / #0071e3. In `ob-d-light-top.png` these are "What did you see?" (x 256, y 556), "Which buoy", "Details", "Too low / Right / Too high" (y 874), "Full wave scale" and "Why" (x 1388, y 436). Elsewhere: "Board Match" (`ob-d-light-s1.png`, x 1332, y 245), the Wave scale slider (`scale-d-light-s1.png`, y 553) and the selected-board underline on Quiver. `--signal` orange is used in two rules only: the phone tab bar and the map's "GFS-Wave · NOAA" chip, where a data-source label is coloured like navigation. Desktop nav state is a black underline, and selected chips are black fills.
- **Why it matters:** PRODUCT.md: "one International Orange accent for navigation state and links". Default Apple blue plus black plus orange reads like a UI kit, not a brand. Three different "selected" colours also make state hard to learn.
- **Fix:** add role tokens: `--accent-ink: #b93a0b` (5.35:1 on the fog ground) and `#ff8a5c` in dark (8.0:1), used for links, the active nav and the slider thumb/fill. `--selected` = ink fill for chips and segments. The map source chip goes neutral. Point all 84 `var(--accent…)` uses at the new roles.
- **Effort:** M

### 6. Type scale: 17 sizes on the spot page, much of it below 12 px, and H1s that rank pages backwards
- **Where:** every page, worst on the spot page.
- **Evidence:** DOM probe at 1440. The spot page uses 8, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 17, 19, 22, 24, 26 and 28 px: 134 text nodes at 11.5 px, 99 at 11 px and 2 at 8 px. The CSS source declares 30 distinct sizes, including 9.5, 10.5, 11.5, 12.5, 13.5 and 14.5. The spot H1 is **28 px**, while Quiver, Personal and Wave scale H1s are 32 px and Home is 44 px. Section titles: spot 14/500, Personal 16/600, Home 22/700, Quiver 24/650.
- **Why it matters:** the most important page has the weakest title, and its many small sizes make it look busy. Apple HIG and RULES "hierarchy through size and weight" both need a short, fixed scale. Text under 12 px is hard to read on a phone in a parking lot at dawn.
- **Fix:** seven tokens: `--t-cap 12`, `--t-sm 13`, `--t-body 15`, `--t-lg 17`, `--t-h2 22`, `--t-h1 32`, `--t-display 48`, plus `--t-num 56` for the surf number. Floor at 12 px (chart ticks included). The spot H1 uses `--t-h1` (or the display size in the photo hero). One section-title style everywhere: 17/600.
- **Effort:** M

### 7. Dark mode: "poor" and "Weak" fail contrast, and the meters lose their fill
- **Where:** Spot rating, Home week table, day strip; dark (marks are also weak in light).
- **Evidence:** `pipe-d-dark-top.png`, x 728–860, y 575–615. "Weak" is drawn in `--poor` #50606c on #0a131c = **2.88:1** at 26 px, below AA even for large text. The filled "poor" segments versus empty `--none` = **1.8:1**, so "2 of 5" reads as empty (also `ob-d-dark-s1.png`, Sat 14, x 680–760, y 403). In light, poor (#8e8e93) versus none (#d1d1d6) = 2.1:1.
- **Why it matters:** the rating is the decision. Marks need 3:1 and text needs 4.5:1 (RULES, PRODUCT "WCAG AA").
- **Fix:** always set the rating word in `--text` and carry the colour only in the meter. Dark `--poor: #8796a3` (6.2:1 on the ground, 3.9:1 against none). Light `--poor: #6e6e73` (4.75:1, 3.3:1 against none). Add these pairs to the contrast test.
- **Effort:** S

### 8. One dash glyph means two different things, and the rating has three vocabularies
- **Where:** Home, spot page, map.
- **Evidence:** `home-d-light-top.png`, y 690–840: 3 dashes per day mean AM, midday and PM ratings, read by colour. `home-d-light-s1.png`, y 238–255 and 545–705: 5 dashes mean the rating level, read by fill count. `ob-d-light-top.png`, y 611: 5 dashes, level. `ob-d-light-s1.png`, y 403: 3 dashes, time slots again. Words: overall "Weak / Surfable / Not bad / Solid"; factors "poor / fair / good"; the ranking list says "Go".
- **Why it matters:** RULES: "one condition colour scale used everywhere (same chip, same dot, same words)." A glyph a user cannot learn once is noise, and the user has to work out which reading applies each time.
- **Fix:** a single `<Meter>` with two clearly different forms. `level`: 5 joined segments with a 1 px gap. `slots`: 3 short squares labelled a/m/p on first use, or a tri-colour bar with a different radius. Map the factor words onto the same 5-word overall scale, or show factors as dots only, with no second vocabulary.
- **Effort:** M

### 9. Desktop spot page: the four-column module grid leaves 200 px holes and a wall of prose
- **Where:** Spot page, 1440, both themes.
- **Evidence:** `ob-d-light-top.png`. The Surf column (x 24–370) runs 10 lines to y 880. Rating and Wind end at y ≈ 660, leaving ~200 px of empty ground (x 728–1416, y 660–860) before the next row. The same happens in `cocoa-d-light-top.png` and `pipe-d-light-top.png`.
- **Why it matters:** the reference (00-target/forecast.png) puts Rating · Surf · Swell · Wind · Tide · Water on one aligned 6-cell bar, which you can scan in under a second. Here the numbers sit at different heights and the eye has to hunt.
- **Fix:** row 1 is a single condition bar: label 13 px, value on one shared baseline at `--t-h2`, one qualifier line, 6 equal cells, with rules and no cards. Row 2 holds the details (wave scale diagram, wind dial, tide curve). Move the buoy-validation text ("How right we've been", "Offshore wave height at the buoy…", "Rating vs the rating…") into one full-width "Accuracy" row with a link from the number.
- **Effort:** M

### 10. The spot chart is decoded through a 17-item legend 1,200 px below its top, and the panels are cluttered
- **Where:** Spot page Graph, 1440, light worse than dark.
- **Evidence:** `ob-d-light-s2.png`, y 605–650: a legend of 17 swatches across two lines, after all five panels. y 160–300: period labels on every 6 h step ("10s 9s 10s 9s…", ~28 labels). y 445–460: the wind arrows cycle through blue, olive and red. In light the night bands are mid-grey (#e3e6e7) slabs that turn the plot into a barcode (`ob-d-light-s1.png`, y 515–900).
- **Why it matters:** "weak or flat charts" is not the problem here; the problem is the reading cost. Windy and Surfline label series directly. Prior item 6 covered phone axis collisions only.
- **Fix:** label each series directly at its right end ("Surf est.", "Offshore Hs", "Primary 13 s"). Give each panel a 2–3 item key in its own left gutter. Show period labels only at local peaks and troughs. Use one ink colour for wind arrows (speed already shows in the line). Light-mode night bands at `rgb(14 26 34 / .035)`.
- **Effort:** M

### 11. Three segmented-control designs and 10–11 corner radii per page
- **Where:** Home, Forecast and Wave scale (segments); every page (radii).
- **Evidence:** Home "Right now / In 3 h / Tomorrow AM" (`home-d-light-s1.png`, x 441–725, y 470–512) has a white track, radius 99 and a black thumb. Forecast "Graph | Table" and "7 days | Tue" (`ob-d-light-s1.png`, x 24–302, y 457–495) have a grey track, radius 10 and a white thumb. Wave scale "3D | Diagram" (`scale-d-light-top.png`, x 171–300, y 149–181) has a grey track, radius 99 and a white thumb. Board chips beside it are outlined, with a black fill when selected. Radii measured in the DOM: Home 4, 6, 999, 5, 50%, 16, 10, 2, 14, 99 and 3 px. Spot: 10 values. CSS source: 17 values, against the RULES scale of 4/8/12.
- **Why it matters:** the same control looking different on each page is the clearest "vibe-coded" tell. RULES lists soft or arbitrary radii as #19.
- **Fix:** one `<Segmented>`: `--s2` track, 8 px radius, `--s1` thumb with a 1 px `--line-2` border, 36 px tall on desktop and 44 px on phone. Selected chips use the same thumb style. Replace raw radii with `--r1/--r2/--r3`, plus pill only for true toggles.
- **Effort:** S

### 12. Every page starts at a different left edge and width
- **Where:** all pages, 1440.
- **Evidence:** H1 x positions from the probe: Home 136 (inside the hero card; content 104–1336), spot 44 (content 24–1416), Quiver 24, Personal 360 (720 column), Wave scale 170 (title at 170, 3D stage centred at 300–1140, so the stage and title don't share an edge: `scale-d-light-top.png`).
- **Why it matters:** switching tabs makes the content jump. Premium products (Apple, Surfline) hold one grid.
- **Fix:** a single `--container: 1232px` with a 24 px gutter, and a `--reading: 720px` variant aligned to the same left edge (not centred) for Personal and Wave scale controls. The page title always sits at the container's left.
- **Effort:** S

### 13. Phone map: legend ramp clipped off-screen; dark theme leaves the search white; loading toast covers the chip
- **Where:** Map, 390 (both themes); Map, 1440 dark.
- **Evidence:** `explore-m-dark-top.png`, x 700–780, y 1485–1530: the colour ramp is cut at the screen edge, showing only "0" and "6.6". The label still says "Offshore Hs · not surf" (jargon). `explore-d-dark-top.png`, x 16–316, y 80–124: the search field stays white while the chips below turn black. `explore-m-light-top.png`, x 245–535, y 258–305: the "Loading the forecast…" toast sits on top of the "Ocean Beach ×" chip's close button.
- **Why it matters:** a clipped legend means the map cannot be read. The white field in dark is a theme leak.
- **Fix:** make the legend its own full-width row (ticks 0, 3.3, 6.6, 13, 30+) under the time bar, labelled "Offshore wave height · not surf size". Map search background `var(--s1)`. Toast anchored below the chips row (top: chips bottom + 8 px) or as a skeleton on the pins.
- **Effort:** S

### 14. Type family contradicts both brand docs
- **Where:** global.
- **Evidence:** the probe counts Inter on 163 of 182 text nodes (Home) and 698 of 711 (spot), with Instrument Sans for headings. Archivo, which PRODUCT.md names as "one family", is declared but never used, and Syne is still declared in `src/ui/tokens.css`. RULES' own vibe-coded list names Inter (#10).
- **Why it matters:** the face carries most of the brand when there is no photo. Inter makes the product look like every dashboard.
- **Fix (needs the user's decision, since the type trial on 2026-11-02 picked Instrument Sans + Inter):** either (a) switch `--sans` to Archivo at normal width with `tnum` and `--display` to Archivo at `font-stretch: 118%`, then remove the Inter, Syne and Instrument faces; or (b) keep the trial and update PRODUCT.md and RULES so the docs stop contradicting the product. Option (a) gives the surf number a distinctive expanded numeral.
- **Effort:** S (token) + M (visual QA)

### 15. Home stat strip: values don't share a baseline
- **Where:** Home, 1440 and 390, both themes.
- **Evidence:** `home-d-light-top.png`, y 410–517: "6:45 AM" and "5:04 PM" sit at y 473, "high 12:23 AM" at y 453 (pushed up by its two-line note), and "Everyday shortboard" at y 473 in a heavier weight with an inline note. `home-m-light-top.png`, x 400–750, y 1290–1470: "64°F" is vertically centred while "5:04 PM" is top-aligned.
- **Why it matters:** a misaligned baseline is the kind of thing a picky user notices before reading any number.
- **Fix:** `align-items: start` and a fixed 3-row cell (label 13 px / value 20 px 600 tabular / note 13 px dim), with notes always below the value. Give "Your quiver's pick" the same value style.
- **Effort:** S

## Three cross-cutting system fixes (lift every screen at once)

1. **Type tokens, enforced.** Settle the family (item 14) and define 7 size tokens plus one numeral style (item 6). Add a stylelint rule (`declaration-property-value-allowed-list` for `font-size`, `border-radius`, `font-family`) so that raw px values fail `npm test`. That one change fixes the 30 CSS sizes, the 17 radii and the 4 heading treatments together, and stops them coming back.
2. **Colour roles, contrast-tested in both themes.** Replace `--accent` (Apple blue) with role tokens: `--accent-ink` (orange: links, nav state, slider), `--selected` (ink fill), `--rating-{1..5}` with text and mark variants, and a reserved list of map-field hues that ratings may not use. Extend the existing map contrast test (`t120-contrast-probe.mjs` / `map-ramps.test.ts`) to assert ≥ 4.5:1 for text roles, ≥ 3:1 for marks and between adjacent rating steps, in light and dark. This fixes items 4, 5 and 7, and catches the next dark-mode regression.
3. **Five shared components:** `<PageHeader>` (container edge, H1, meta line, as in items 1 and 12), `<Hero photo|plain>` (items 1 and 3), `<Segmented>` (item 11), `<Meter level|slots>` (item 8) and `<StatCell>` (label, value, note on a fixed baseline, items 9 and 15). Every screen in this audit builds these by hand today, and that is why they drift.

## What works (don't regress)
- Honesty labels sit next to the numbers on every surface ("model estimate", "offshore · not surf size", "NOAA station prediction, not at the beach", "Drawn from the forecast · approximate"), and the photo credit is on the image.
- The Home "This week" table and the Personal ruled list are the right density and pattern: ruled rows, tabular numbers, no cards. Copy them.
- Dark theme charts on the spot page read well: quiet night bands, a clear now-cursor, model-spread dashes.

## Also observed (not ranked)
- First load for Pipeline and Cocoa Beach at 1440 took 23–28 s behind skeletons on three of four runs. Ocean Beach took about 3 s, and the phone re-run took 3–6 s. It may be cold model fetches; worth a timing check, because at dawn that is the first impression.
- Wave scale 3D at 1440, 8 PM: no surfer was in frame at capture time, although the label says "you 5'10"". At 390 the surfer is visible. This may be animation timing.
- The avatar is an orange-to-teal gradient disc (a "harsh gradient" tell). Use a flat `--s3` disc with an ink initial.
- Quiver shows prev/next arrows although all four boards fit on the stage (dead controls at 1440). The warm cream stage (#faf9f6 and beige floor) clashes with the cool fog page; in dark it turns neutral grey rather than navy.

## Not checked
Interaction and motion (press states, the scrub, the view-transition timing). Hover. Real iOS Safari chrome and safe areas. The Hookipa hero (not in scope). Map at intermediate zooms and with other layers. Favourites set on Home. Surfline's own phone and chart pages: the reference captures `17-surfline-charts/*` are Cloudflare bot-check pages, so there is no Surfline chart to compare against.
