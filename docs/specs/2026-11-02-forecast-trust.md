# Forecast trust: one answer per spot, a verdict you can act on, and a feedback loop that learns

Status: DRAFT for user approval · 2026-11-02 · author: lead · inputs: lead's critical review (fresh 1440/390 audit at 6:46 PM), Surfline teardown refs (`18-teardown-2026-10-31/surfline/04`, `07`), Quiver (quiversurf.app, reviewed in Chrome 2026-11-02), wave-v3 plan.

## Context
- Spot page (`src/features/forecast/SpotPage.tsx`) and Home (`src/features/home/HomeView.tsx`) read one selector since T-055 (`src/services/spotHour.ts`), with ratings in `src/ratings/*`, estimates in `src/services/headlineSurf.ts`, and observations + calibration from T-059/T-060 (`src/services/calibration.ts`).
- Daylight already exists in `src/ocean/sun.ts` (used for "Best today"), but the page never shows sunrise/sunset or night.
- The main graph plots **offshore Hs** ("not surf size"), not the surf estimate.
- Board Match (`/quiver/match`) shows an empty-state explanation only.
- User direction: keep SWELLO's look and extra features (3D scale, Quiver wall, calibration); be extremely critical; data honesty stays non-negotiable.

## Problems (what a surfer sees today, Ocean Beach, Mon 6:46 PM)
1. **Five heights for one moment:** Surf 6–13 ft, offshore 5.7 ft, nearshore model 7.2 ft, buoy 5.9 ft, graph peaking at 8 ft. No single answer.
2. **The biggest chart contradicts the headline:** it shows offshore Hs while the headline is the surf estimate.
3. **No verdict:** the rating says "Solid" at night with onshore wind, and every nearby spot is "Solid". Nothing says *go or don't*, or *why*, for *me*.
4. **No daylight:** no first light/sunset; night is rated like day.
5. **Ranges too wide to plan:** 6–13 ft headline; day cards 9–19, 12–25 ft.
6. **Report tone:** repeated disclaimers ("provisional", "context, not validation" ×4, "not surf size"), raw transect metadata and a 12-hour-old buoy in the main scroll; a full-width Board Match apology row.
7. **Not comparable across spots:** Home mixes surf estimates (Ocean Beach) with offshore Hs (Linda Mar, all nearby spots).
8. **Board Match is an empty page;** weak header photos (a woman walking on sand; a parking lot).
9. **Feedback is slow:** observing needs a body-word pick. No quick "was this right?" check, and past forecasts aren't saved, so observations can only pair with the current run.

## What to take from Quiver (and what not to)
Quiver is a Next.js app (tan "field guide" look). Its tone and look aren't for us (the user prefers SWELLO's aesthetics). These ideas are worth taking:

| Quiver idea | Why it's good | SWELLO version (honest) |
|---|---|---|
| **The Call:** "MEH · Skip it", "GO EARLY" | One answer you can act on | A verdict line from our own rating + skill + daylight + wind: **Go / Worth a look / Skip / Dark**, with a time ("Go 7–9 AM") |
| **"Why:" in one plain sentence** (skill-aware: "5.2 ft exceeds the beginner safety range…") | Explains the call in human words | The first `explainRating` reason in plain English, using the user's skill from Personal |
| **"Did this forecast feel right? Too low / Right / Too high"** | A 1-tap loop, faster than ours | Add it beside "What did you see?" and feed it into calibration as a weak signal (direction only; counted separately from body-word observations) |
| **Daylight 6:37 AM – 5:12 PM** in current conditions | Basic and missing in ours | First light, sunrise, sunset and last light from `sun.ts`; night shading on all charts; never rate darkness |
| **NWS Beach Hazards / rip-current alert** (official, dated, sourced) | Real safety value, public data | NWS alerts API (`api.weather.gov/alerts/active?zone=…`, public, no key) for the spot's forecast zone: a quiet banner only when an alert is active, linked to the source |
| **Saves forecasts before conditions arrive** (their accuracy page) | Honest validation needs it | Locally store each viewed spot-hour's forecast (value, run time, lead time) so observations and buoy checks pair with what was *predicted*, not re-run data; feeds calibration (T-059) |
| **Session-aware insight** ("your beach likes a dropping tide") | Personal, sticky | Later phase: only from ≥ 8 of the user's own logged sessions/observations, phrased as a pattern with n shown |
| **Set alert** | Reason to come back | Later phase (needs notifications; approval item) |
| Confidence 83/100 | *Don't copy as is* | Theirs looks arbitrary (hourly swings of 40% → 100%). Ours, if any, comes from calibration n and estimate width, labelled with its basis |
| 10-day outlook "6-9ft 16s" | Compact day card with period | Add the dominant period to our day cards; keep our typical-range logic |

Quiver has its own inconsistency (5.2 ft surf vs "~8–9 ft" swell vs 8.3 ft hourly), the same failure as our problem 1. We must beat it, not match it.

## Target (references per problem)
1–2. **One big number:** the surf estimate. Surfline `04-current-conditions`: one height + body words + a small source tag. Main graph = surf estimate band per hour (Surfline `07` bar chart), with offshore Hs as a thin secondary line in the legend. Nearshore model, buoys and transects move into one collapsed **Sources & data** section.
3. **The Call** at the top of the spot page and on every Home card: verdict + best window + one-line why.
4. **Daylight:** sunrise/sunset row; night shaded on charts and day strip; after dark the call reads "Dark · next window 7–9 AM".
5. Ranges: unchanged maths (calibration narrows them honestly); the call and best window carry the decision. Day cards add period.
6. **Tone:** one source line per number; no repeated disclaimers; one "How we estimate" link. Delete the Board Match apology row.
7. **Comparable lists:** every card shows the same kind of number (surf estimate where we have one; otherwise "Surf est. unavailable · offshore 7 ft" in muted text, never a big offshore number styled like surf).
8. **Board Match works on size + period now** ("Your 6'6" step-up suits 6–13 ft; wave shape unknown"), and the empty page goes. Photos: replace weak ones with better CC images, or use the drawn spot map.
9. **1-tap "Felt right?"** + forecast archive.

## Constraints
- Data honesty (PRODUCT.md, CONTRACTS.md): the call is derived only from our data, and its basis is shown on tap. No invented accuracy or confidence. NWS alerts are quoted with source and valid time.
- Function-first: the call, height and wind sit in the first viewport at 390.
- Keep SWELLO's look (Inter, light, hairlines). No Quiver styling.
- No new dependencies. NWS API is public and keyless (needs a User-Agent; generic app name, no personal email). Notifications/alerts are a later approval item.
- wave-v3 (3D) continues separately on its branch; this spec doesn't touch `src/features/scale/*`.

## Approach
- **Engineering (T-064):**
  - `callFor(spot, hour, profile)`: verdict, window, why[], built on `spotHour` + rating + skill + daylight.
  - Night-aware rating: dark → no rating, call "Dark".
  - Surf-band series for the graph.
  - Forecast archive: localStorage ring buffer, ~2 weeks of viewed spot-hours.
  - "Felt right?" signal into calibration.
  - NWS alerts service with zone mapping for our NorCal spots, cached and dated.
  - Unit tests throughout.
- **Product (T-065):**
  - Spot page restructure: the Call header, one number, a graph of surf, Sources & data collapsed, daylight row and night shading.
  - Home: call per card plus comparable numbers.
  - The "Felt right?" UI.
  - Board Match on size + period.
  - Photo pass.
  - The NWS banner.
- **Lead:** spec, merges, all checks, 1440/390 shots against Surfline `04`/`07`, and the user's review. Continue wave-v3 in parallel.
- **Rejected:**
  - Copying Quiver's 0–100 confidence: not computed from anything defensible.
  - Hiding uncertainty: we keep it, but in one place.
  - Server accounts/community features: out of scope, no backend yet.

## Owners & level
Level 3 (forecast semantics + core screens). Branch `forecast-trust` from `rebuild/swello-v0.16`. Commits: one per area (call service, night/daylight, graph series, archive + felt-right, NWS, spot page, Home, Board Match, photos).

## Acceptance
- **Spot page, first viewport at 390:** spot name, the Call (verdict + window), surf estimate + body words, wind relation, tide trend, daylight. Exactly **one** large height number on the page; offshore/nearshore/buoy appear only inside Sources & data.
- **Graph:** the plotted primary series == `headlineSurf` per hour (unit test plus browser check); night bands shaded; the selected hour's value matches the Surf card.
- **Night:** at 6:46 PM in November the call reads "Dark · next window …". No hour after sunset/before first light carries a rating. Test with fixed timestamps.
- **Rating distribution:** across 45 spots × 72 h, daylight hours only, no single category > 50%. Reported before and after.
- **Home and nearby:** every card shows the same height type; tests assert no offshore value is styled as a surf estimate.
- **Felt right:** 1 tap stores a signal paired with the archived forecast for that hour. Calibration counts it separately. t060 extended.
- **NWS:** the banner appears only with an active alert for the spot's zone, quoting the event + valid time + source link. Tested with a recorded fixture; no banner when the feed fails.
- **Board Match:** recommends from size + period with the shape caveat in one line. No empty state when an estimate exists.
- **Checks:** tsc, all unit tests, build, journeys 8/8, t045/t047/t055/t059/t060, density; new t064/t065 browser checks; 1440/390 before/after next to Surfline `04`/`07` and the Quiver spot page.

## Open questions (user)
1. **Verdict words:** Go / Worth a look / Skip / Dark (recommended), or Surfline-style ratings only plus "Best window"?
2. **NWS beach hazard banner:** show it (recommended, official safety info), or leave safety out of the app?
3. **Skill-aware calls** (a beginner gets "Skip" at 6 ft where an advanced surfer gets "Go"): use the Personal skill level (recommended), or one call for everyone?
