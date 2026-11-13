# Spec: Forecast page in order of what matters, and map clusters that count spots (user, 2026-11-12)

## The user's words
- "the forecast page… Surfline's is just put together so much better; the information is chronological in order of what actually matters. The people scrolling down are doing more research than the average user. If you open a surf app it's usually a brief check… but that brief casual checker will also have way more accurate data. That's what we sell."
- Map: "the dots are still pretty janky and they show the average surf height rather than Surfline's amount of spots in that dot / how many spots the dot represents."

Reference (looked at Surfline's public pages for structure only; no data, no cameras, nothing copied): spot page order = name and nearby-spot sizes → one compact "current conditions" block (rating, surf height with a body word, wind with onshore/offshore, swells, tide, water temperature and wetsuit, weather) → a one-paragraph summary of today → a 10-day size strip → hourly charts per day → nearby buoys → guide. Map: zoomed out = circles with the NUMBER of spots inside and a ring coloured by conditions; zoomed in = a small pill per spot with the surf range in the rating colour; a list of spots in view.

## A. Forecast page: the brief check first, research below
**Rule:** the first screen answers "should I go, and how big is it right now and this week". Everything a researcher wants is below, in order of how often it's wanted. **Nothing is removed**; it moves. Every data-honesty label stays reachable.

New order (390 and 1440):
1. **Header, compact:** name, region, time and "now", star, Share. The photo band shrinks (phone ~120 px, or a thin strip). The photo credit stays.
2. **Now block** (one compact card; this is where the Call and the key numbers merge):
   - the verdict word and its one-line reason (the Call: "Skip · No window in the next 4 days");
   - the surf number (big) with its kind ("model estimate · high confidence", NWS, offshore) and body word;
   - the rating word and bar;
   - wind with its relation to the beach ("12 mph SSW · onshore");
   - tide now plus the next high or low;
   - the main swell (height, period, direction);
   - water temperature and wetsuit.
   - On a phone it's a 2-column grid, with nothing else on the first screen apart from the warning line below.
3. **NWS warnings: one line** (the most severe), "+N more" opens the rest. Never 4 full-width rows (today at 1440 they take ~220 px).
4. **This week:** the day strip (sizes, ratings, best window), directly after "now".
5. **Today, hour by hour:** the Today ribbon plus the best window.
6. **Camera** snapshot (when the spot has one).
7. **The week's charts** (forecast-charts).
8. **Research, below a clear "More detail" divider, in this order:**
   - How right we've been (detail; the short line stays in the Now block);
   - Wave scale card;
   - rating breakdown and "Why";
   - swell partitions and wind detail cards (the parts of ConditionsGrid not in the Now block);
   - similar sessions, water quality, cam links;
   - Sources & data.
- **No duplicates:** the same number shown twice in different styles goes (the surf number shows once at the top, not again in a card).
- **Acceptance:**
  - a first-screen element count before/after at 390×664 and 1440×900;
  - the brief-check answer (verdict, size, wind, tide, week) visible without scrolling at 390×844;
  - journeys, t034, phone-pass and the data-honesty review pass;
  - screenshots in both themes.

## B. Map: clusters that say how many spots, pills when close
- **Zoomed far out** (whole states): stay clean, as now.
- **Middle zooms: cluster circles.**
  - The number inside is **how many spots** the circle holds.
  - The ring around it is split into segments by the share of its spots at each rating (good / fair / poor / no rating), in the rating colours, so you see "mostly fair, a little good" at a glance. That's our twist: a proportional ring, not one colour.
  - Tapping a cluster zooms to fit its spots.
  - Clusters come from MapLibre's own GeoJSON clustering (supercluster), which merges and splits smoothly as you zoom. Drop our hand-made coast-group stacks.
- **Close in: a pill per spot,** a cluster of one.
  - It shows the surf range in the person's unit ("3–4 ft"), filled with the rating colour.
  - The kind styling stays: dashed outline = NWS, hollow "off" = offshore only (never a size), striped = daily forecast, grey = not loaded.
  - Swell-direction tick as now.
  - Names appear from about z11 where they fit.
- **The selected spot:** its pill is bigger, with its name, at any zoom where it's in view.
- **Not janky:**
  - the dots are drawn by MapLibre layers (no React re-render while panning or zooming);
  - positions stay stable;
  - clusters animate split and merge;
  - no popping on every frame (collision only for names).
  - Scrub the hours with no long tasks over 200 ms from the dots layer.
- **Optional, later:** a "spots in view" list panel on wide screens (we already have "N spots in view"; it could open a list).
- **Acceptance:**
  - at z6, z8, z10 and z12, in SF, SoCal and Hawaii, screenshots and element counts;
  - the cluster number equals the spots inside (a test);
  - ring segment shares equal the ratings (a test);
  - a pill's number equals the spot page's number for the same hour (the existing test, kept);
  - map-dots, phone-map-honesty and audit-map pass (update scripts honestly, keeping .pre backups).
