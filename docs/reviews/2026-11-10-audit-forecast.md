# Audit: Home and spot pages, 2026-11-10 (live site)

Scope: Home and `/forecast?spot=` pages on https://swello.surf-prototype.workers.dev. The pages were opened headlessly in Chrome on Tue 2026-11-10 between 7:58 and 8:22 PM PST, so every spot was "after dark".
Viewports: 1440×900 and 390×844 (mobile emulation). Themes: light (the default) and dark (`swello-theme=dark`; the app ignores `prefers-color-scheme` by design).
Spots: Ocean Beach, Linda Mar, Rockaway Beach (San Mateo), Mavericks, Cowell's, Malibu (Surfrider), Trestles, Pipeline & Backdoor, Hookipa, Cocoa Beach, Manasquan Inlet and S Turns. The S Turns slug resolves to the Outer Banks spot, not the Hawaiian one (see 7).
Interactions: day strip (Wed, Thu, Sat), Why, star (saved, then reloaded), What did you see?, Graph/Table, Home "Next 12 hours", the nearby tabs, and the Home CTA.
Evidence: scripts and screenshots are in `/private/tmp/claude-501/audit-forecast/`. `full/` holds the light captures, `dark/` the dark ones, `inter/` the interaction runs, and `*.txt` the page text for each capture.
Known issues in `docs/design/PHONE-CRITIQUE-2026-11-10.md` are not repeated here: answer below the fold, Hookipa hero overlap, chart label collisions, two-column wraps, day-strip repetition, the capital "A" and ".." in the board line, the header, and the Home table paragraph.
"Verified ×2" means the item was seen on two separate loads. Flaky items are marked.

Severity: **P0** wrong or misleading data or label · **P1** broken or clearly wrong UX · **P2** polish. Effort: S / M / L.

## Ranked findings

1. **P0 · Cowell's camera: a 2 h 40 min old still is shown as current, and the caption's timing claim is false.** Spot page, 1440 and 390, both themes.
   - At 8:12 PM the USGS frame is stamped "Tue 11/10/2026 17:30 PST". The caption reads "Frame posted 7:13 PM PST (59 min ago); the time stamped on the picture is when USGS took it, usually 10–30 min earlier".
   - The real gap between taking and posting is 1 h 43 min. By the PRODUCT camera rule (a still older than 2 h is Offline) this frame should read Offline. The app only ages the S3 posted time.
   - Evidence: `inter/cowells-cam-1440.png`, `inter/cowells-390-dark-0.png`. Verified ×2 (8:00 and 8:12 PM).
   - Fix: age the frame from its capture time. Read the USGS filename or epoch where available. Otherwise use posted time plus a conservative lag, and stop claiming "10–30 min". Show "Offline · last frame 5:30 PM" past 2 h. Effort S–M.

2. **P0 · The spot-page tide card never names its station. For Linda Mar, Home and the spot page also use different tide sources.** Linda Mar, Mavericks and Ocean Beach, all viewports.
   - The card and its detail say only "NOAA station prediction, not at the beach" and draw the San Francisco regional curve. The Mavericks and Linda Mar curves are identical to Ocean Beach's (0.4 ft rising, 6 PM low).
   - Home, for the same Linda Mar, shows "Next tide high 12:23 AM · Pillar Point Harbor station, 11 km".
   - PRODUCT requires the SF reference to be "labelled so". Pillar Point Harbor is about 1 km from Mavericks.
   - Evidence: `inter/tide-linda-mar-1440.png`, `inter/tide-mavericks-1440.png`, `full/_-1440-light.png`. Verified ×2.
   - Fix: name "San Francisco (9414290), regional reference, N km" on the card and in the detail. Better, use the spot's own nearest open-coast station, as Home and the non-Bay spots already do. Effort S (label) or M (station).

3. **P1 · The tide chart says "No tide station near this spot yet" right under a tide card that lists that station's predictions.** Pipeline (Haleiwa, 9.3 km), Hookipa (Kahului, 12.3 km), Cocoa Beach (Cocoa Beach, 0.1 km), Manasquan Inlet (Belmar, 8.2 km), Trestles (San Clemente, 4.4 km) and Cowell's. All viewports and themes.
   - Evidence: `full/shots/_forecast_spot_pipeline_backdoor-1440-light.png` and `full/shots/_forecast_spot_cocoa_beach-1440-light.png` (bottom chart). The message appears in 15 captures.
   - Fix: plot the station's hi/lo extrema as a curve, which the data already holds. At minimum say "Hourly tide curve only near SF Bay; next tides from <station> above". Effort S (copy) or M (curve).

4. **P1 · The rating and the call contradict each other, and the Why text is false.** Ocean Beach, Wed 11, 7 AM, 1440 and 390.
   - The Rating card says **Solid**, with Swell size good, Wind good and Swell quality good.
   - The call says **Skip**, and its Why ends with "The rating is only middling for this hour."
   - Elsewhere the same week reads green and good: the This week table, Home "Next 12 hours" (green from 4 AM) and the chart's rating lane. The day strip gives a "Best day of the week" star (Sun 15 at OB, Wed 11 at Cocoa). Yet the call says "no window in this forecast".
   - Cause: `call.ts:95` falls back to "only middling" whenever the verdict is not Go and no factor is down. Here the Skip comes from size against skill.
   - Evidence: `inter/ob-wed-why-1440-0.png`, `-1.png`, `inter/home-next12-1440.png`. Verified ×2.
   - Fix: when the size or skill rule drives the verdict, say "Rated solid, but 9–12 ft is above your intermediate range". Make the best-day star and the "no window" copy use the same skill-aware verdict. Effort S.

5. **P1 · "After dark" gives no answer for tomorrow when there is no Go window.** All spots, evening; seen at 8 PM on 8 of 12 spots (OB, Trestles, Malibu, Pipeline, Hookipa, Cocoa, Manasquan, S Turns).
   - The headline reads "After dark · … · no window in this forecast" and "No good window is forecast in the next few days".
   - Tomorrow's actual answer (OB: Skip, 9–12 ft, above your range) is hidden until the user taps a day.
   - "In this forecast" also overclaims: `bestWindowFrom` looks 4 days ahead and the forecast runs 7.
   - This misses the "planning at a desk the evening before" job.
   - Fix: after dark, lead with tomorrow's call, e.g. "Tomorrow: Skip, 9–12 ft, above your range; best Thu 7–10 AM if…". Reword to "no Go window in the next 4 days". Effort M.

6. **P1 · An unknown spot slug silently shows Ocean Beach, and the URL keeps the wrong slug.** `/forecast?spot=malibu` and `?spot=malibu-surfrider-beach` render Ocean Beach with no message (the correct slug is `malibu-surfrider`).
   - Evidence: `full/shots/_forecast_spot_malibu_surfrider_beach-1440-light.png`. s4 run: `h1= Ocean Beach url= /forecast?spot=malibu`. Verified ×2.
   - Fix: show "No spot called 'malibu' · did you mean Malibu (Surfrider)?" using the search index. Never show another spot's forecast under a foreign URL. Effort S.

7. **P1 · Eleven slug collisions make spots unreachable by URL.**
   - The pairs: jones-beach-state-park, lavallette, island-beach-state-park, camp-pendleton (VA/CA), avalon-pier, s-turns (NC/HI), point-dume, haggertys, trails, rockpile (CA/HI), walton-rocks.
   - `spotIdForSlug` takes the first match, so `?spot=s-turns` always opens Outer Banks S Turns and Hawaii's S-Turns cannot be deep-linked or shared. The same applies to Rockpile.
   - Evidence: `inter/s-turns-1440.png`; collision scan over `src/data/coast.ts`.
   - Fix: make slugs unique, e.g. `s-turns-oahu` (or name plus region), keeping the old slug for the first match. Add a uniqueness test. Effort S.

8. **P1 · Spot pages outside NorCal take 6–16 s to show the surf number, because every page loads the NorCal batches first.**
   - Cold load to "What did you see?": Manasquan Inlet 16.4 s, Malibu 12.9 s, Trestles 11.9 s, S Turns 10.3 s, Mavericks 7.4 s, Hookipa 5.9 s, Ocean Beach about 3 s.
   - The request log on Hookipa and Trestles shows `marine-w-usw-doran-beach`, `cs-rodeo-beach`, `pedro-point`, `pomponio`, `waddell`, `three-mile` and the SF nearshore points being fetched before the spot's own region.
   - Evidence: s4/s15 output (request timelines). Mavericks still showed only skeletons after 15 s (`full/shots/_forecast_spot_mavericks-1440-light.png`).
   - Fix: fetch the selected spot (and its comparison set) first. Defer the Home and NorCal batches. Effort M.

9. **P1 · Home's best bet disagrees with Home's own "Best tomorrow morning nearby" list.**
   - The hero says "Linda Mar is your best bet tomorrow, 6:20–11 AM, 6–8 ft". (At 7:58 PM the hero named Sharp Park.)
   - The nearby list (Tomorrow AM) ranks Kelly's Cove #1 (Go, 6:20 AM–1 PM, 6–8 ft). It ranks **Sloat #2 with a Skip verdict**, above Sharp Park #3 (Go). Linda Mar is not in the list at all.
   - Evidence: `inter/home-next12-1440.png`, `dark/shots/_-1440-dark.png`. s6/s7 output. Verified ×2.
   - Fix: rank the list by the same verdict-then-score rule as the best bet, so Skip never sits above Go. Make the hero spot appear as #1, or explain why it differs. Effort S–M.

10. **P1 · The Skip verdict in the nearby list is effectively invisible.** The "Skip" label has a contrast of 2.29:1 in light and 2.03:1 in dark at 12.5 px. The Sloat row looks as if it has no verdict.
    - Evidence: contrast probe (s13); `inter/home-next12-1440.png` row 2. Verified ×2.
    - Fix: use the ink colour for Skip (at least 4.5:1) or the poor rating colour. Effort S.

11. **P1 · The board line contradicts itself and the Swell card.**
    - Linda Mar: "it suits 3–8 ft, 10 s period, A 9.8 s swell is short for this board (it likes 10 s or more)". On the same screen the Swell card shows "10 s".
    - Ocean Beach: "suits 5–12 ft, 9 s period … (it likes 11 s or more)". Mavericks and Pipeline read the same way.
    - Evidence: `inter/wdys-1440.png` (bottom), `dark/shots/_forecast_spot_ocean_beach-1440-dark.png`. Seen on 4 spots.
    - Fix: state one threshold ("needs 11 s+; this swell is 9.4 s"). Round the period the same way as the Swell card, or show a decimal in both. Effort S.

12. **P1 · Junk swell partitions are shown as swell.**
    - Cocoa Beach secondary: "0.1 ft · 1 s · SE 118°".
    - The Manasquan swell chart labels 3 s and 4 s "periods" through the week.
    - A 1 s partition is model noise, and 3–4 s is wind chop, not swell.
    - Evidence: `full/shots/_forecast_spot_cocoa_beach-1440-light.png` (Swell card); `dark/_forecast_spot_cocoa_beach-1440-dark.txt`. Verified ×2 (light and dark loads).
    - Fix: hide partitions under about 0.5 ft or 5 s, or label them "wind chop". Effort S.

13. **P1 (flaky) · Bolinas sometimes loses its MOP estimate and shows offshore only.**
    - First load (7:58 PM): Home Popular, This week ("Marin · offshore only", 6, 6, 7) and the spot showed "Surf est. unavailable · offshore 6 ft".
    - That load logged `FAIL /api/providers?keys=nearshore-MA137-forecast,… net::ERR_ABORTED`.
    - Three later loads show "4–5 ft model estimate".
    - Evidence: `r1/report.json`, `r1/shots/_-1440-light.png` versus `dark/shots/_-1440-dark.png`.
    - Fix: retry an aborted or failed nearshore batch. If it still fails, say "nearshore model not loaded" rather than silently falling back to offshore. Effort S.

14. **P1 · Malibu's "Cams" block overclaims "Live" and lists the same camera twice.**
    - The header card reads "Live cam · Swell Magnet … checked 2026-11-02", but it is a link-only HDOnTap stream with no live status.
    - The first HDOnTap button below it opens the same `stream/190972` URL as the header card.
    - Evidence: `inter/malibu-cams-1440.png`; link dump in the s17 output.
    - Fix: drop "Live" for link-only cams ("Camera · Swell Magnet, opens HDOnTap") and de-duplicate by URL. Effort S.

15. **P2 · The "Why" footnote exposes a code identifier.** "From the surf estimate, the rating (explainRating), wind, daylight …". Seen on OB (Wed), verified ×2. Fix: remove "(explainRating)". Effort S.

16. **P2 · The Hookipa check line claims there is no buoy, but the nearby buoy is just silent.** "No offshore check: no wave buoy within 100 km." NDBC 51205 Pauwela (21.02 N 156.42 W, a few km off Hookipa) exists but has not reported since 2026-10-13. Fix: "Nearest buoy (Pauwela 51205) not reporting since Oct 13". Effort S.

17. **P2 · Cowell's checks against a far buoy while naming a near one.** The offshore check uses buoy 46012 Half Moon Bay at 88 km, while the line above names Monterey Canyon Outer at 23 km. Mavericks uses 46012 at 37 km. Fix: pick the nearest qualifying buoy and say why if a farther one is used. Effort S.

18. **P2 · Wind shows false precision and classifies calm.**
    - Examples: "Wind 0.5 mph W · onshore" (Linda Mar card, Home at 7:58 PM), "1.4 mph · offshore" (Cowell's), "gusts 11.4 mph", "14.3 mph".
    - Fix: round to whole mph. Below about 3 mph say "calm" with no on- or offshore word. Effort S.

19. **P2 · The Home hero caption says the wrong time.** The caption reads "Linda Mar · Tomorrow 6:00 AM · Est. 6–8 ft", while the sentence and CTA say 6:20 AM. Verified ×2. Fix: use the window start (6:20) or "6–11 AM". Effort S.

20. **P2 · The selected day and hour are not in the URL.** Choosing Wed 11 leaves `/forecast?spot=ocean-beach` unchanged; only `&view=table` is persisted. RULES: "URL holds state (deep-link tabs, spot, hour)". Fix: add `&t=<iso hour>`. Effort S.

21. **P2 · The Home "This week" cells carry no unit or kind.** The cells read "12–15", "9–12" with no "ft" and no "est." label, and the offshore-only rows are not marked per cell (`inter/home-390-dark-1.png`). Fix: add "ft" in the header ("Surf est., ft"), and add "offsh." on offshore cells. Effort S.

22. **P2 · The day strip shows estimates and offshore heights at the same size.**
    - Cocoa: "Wed 1–2 ft est." next to "Mon 3 ft offshore". Manasquan: "Wed 1–2 est." next to "Fri 5 ft offshore". The bigger number reads as a bigger day.
    - Fix: set offshore values in a lighter or smaller style with "offsh." beside the number. Effort S.

23. **P2 · Desktop spot grid has a hole.** At 1440 the second card row is Tide | (empty) | Swell | Water, leaving a blank about 290×150 px under Wave scale. Seen on OB, Pipeline and Cocoa (`full/shots/_forecast_spot_ocean_beach-1440-light.png`). Fix: let Tide span two columns or flow Swell left. Effort S.

24. **P2 · The camera still is letterboxed at desktop.** The 500 px still sits in a full-width grey box, and the figcaption is flush-left with no padding (`inter/cowells-cam-1440.png`). Fix: cap the figure width to the image, or use the 2-column card width. Effort S.

25. **P2 · The header status "some sources limited" doesn't say which.** The header shows an amber dot and "Model data · 8:13 PM PST · some sources limited" on Home and Linda Mar, with no indication of which source or what is affected. Fix: name the source in a tooltip or popover ("CDIP nearshore: not loaded"). Effort S.

26. **P2 · Home "Right now" at night ranks dark spots far away.** At 8 PM the list is Laguna Creek 92 km, Russian Rivermouth 94 km and Four Mile 95 km, all "After dark". Fix: after dark, default to Tomorrow AM and grey out Right now / In 3 h. Effort S.

27. **P2 · Every page preloads an unused font.** Console: "The resource …/fonts/dm-serif-display-latin-400.woff2 was preloaded using link preload but not used". Seen on Home and spot pages, both runs. Fix: remove the preload from `index.html`. Effort S.

## Checked and fine
- No uncaught errors or console errors (apart from 27) in any capture, and no horizontal page scroll at 390.
- The star saves, persists over a reload and fills the saved bar ("Linda Mar Est. 6–8 ft").
- What did you see? opens a size scale and an optional quality choice with Cancel.
- Graph/Table toggles, and Table reads 3-hourly rows that agree with the cards.
- Home Popular card numbers match the spot page for the same hour (OB 10–13 ft, wind 9.0 mph W onshore).
- The best-bet window on Home matches the spot page's call (Linda Mar 6:20–11 AM).
- Dark theme: no real text-contrast failures apart from item 10; the hatched cells stay readable.
- The water temperature of 64°F at SF looks wrong for November but is correct: NDBC 46026 WTMP is 18.4 °C and 46237 is 17.1 °C.
- The OB MOP height running at about 1.25× the bar buoy is the documented SF023 behaviour (ACCURACY-VS-BUOYS §2), not a bug.

Not checked: real iOS Safari, daylight-hour behaviour (every spot was after dark), the chart hour scrub by pointer, and the Mon 16 "too far out" to number flip seen once at about 8 PM (likely a new model run moving the horizon, not repeatable).
