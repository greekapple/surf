# Quiver survey (2026-11-10)

Read-only look at Quiver (quiversurf.app public pages: home, spot pages Terramar Point and Bandon, features, vs-Surfline, forecast accuracy, cams, roadmap, what's new, tools, pricing, sessions; App Store listing id6759300320, v1.0.6, 10 ratings). No login, no forms, no app download. Discover and Alerts are client-rendered behind sign-in (only "Loading..."), so those are described from the release notes and the App Store text. Descriptions below are paraphrased.

## 1. What Quiver offers

**Product shape.** iPhone app (Android in closed beta) plus an SEO-heavy website. Free tier has 3 favourites; Pro is $4.99/month or $39.99/year with a 14-day trial; a lifetime "founder" tier existed. Coverage claim: 279+ beaches (CA, OR, WA, HI, FL, US East, Texas Gulf, Puerto Rico, Baja). One developer.

**Spot page.** Hero photo, one surf height range (e.g. "2-3 ft"), a five-word verdict scale (EPIC / GOOD / FAIR / RIDEABLE / MEH) with a short verb phrase, an explicit note that the free verdict is generic and not adjusted for skill or boards, best window (time range), primary and secondary swell, wind with shore-relative word (cross-shore, onshore), tide state with next turn, a "confidence" score out of 100, rip-current check, a provenance line (valid time, source updated, computed time, sources), an hourly table every 3 h (surf, verdict, swell, wind, tide, confidence %), "about this spot" text (ideal swell/wind/tide), skill level and break type, user star reviews, a "local intel" tab, crowd level and crowd tips, water-quality status, nearby spots with heights, tide and water-temperature sub-pages, directions, set-alert.

**Personal layer (Pro).** Verdict re-scored for the user's skill and boards; board pick per spot ("grab your 5'8"); "similarity score" comparing today with the user's highest-rated logged sessions; "similarity alerts" pushing when a setup resembles those sessions (now seeded from where the user last surfed); "Week Scout" day strip across saved spots with best windows and confidence bands and a one-tap share of the plan; "Watch" on any forecast window, notifying when it improves, slips or disappears and going quiet after it passes; rule alerts with skip-flat-days; daily morning conditions email (quiet-hours aware); best windows out to 72 h with a plain-language driver line ("swell filling", "wind switching"); windows that deliberately do not move between checks unless the data changed; custom spots (drop a pin, borrows the nearest tracked beach's timeline, labelled uncalibrated).

**Sessions and community.** Session log with board, rating, notes, wave character, automatic tide snapshot, rip notes, photos (moderated before public); offline save that syncs later; friends / nearby feed, invite deep links, follow notifications, block/report; public roadmap with voting; a pixel-art surf game; "beach passport" badges in progress.

**Other.** 106 live cams in 15 states (cam directory and per-spot embed, full-screen mode); toolkit of 8 calculators (tide clock, wave-size converter, offshore-wind checker, dawn-patrol calculator, board-volume calculator, swell-quality explainer, water-quality check, best month); tap-a-stat plain explainers; dozens of landing pages (dawn patrol, sunset, beginner, longboard, least crowded, best time to surf); a "Quiver vs Surfline" page.

**Accuracy stance.** A methodology page that separates offshore Hs from breaking face height, says buoy checks validate only the offshore forecast, and says outright that no same-sample comparison has been done and no accuracy ranking is claimed. Surfer reports are reviewed by operators and do not calibrate forecasts.

**Data sources visible.** Provenance line names CDIP, NOAA NWS, NOAA CO-OPS and Open-Meteo (Bandon: NWS + Open-Meteo, no CDIP). Verification against nearby IOOS/NOAA buoys. Cams: HDOnTap stream for Terramar; the roadmap says spot heroes use "live Surfline cams". Water quality: San Diego County advisories, EPA monitoring stations (CA, HI). Photos: Google (place photos), Openverse, Flickr, Wikimedia, proxied and stored in Supabase storage. Backend: Supabase.

## 2. Side by side

| Area | Quiver | SWELLO | Verdict |
|---|---|---|---|
| Surf height | One range per spot; at Bandon the "surf" (9-10 ft) equals the offshore primary swell (10 ft @ 11 s), i.e. offshore shown as surf size | Labelled model estimate (CDIP MOP / breaking profile), offshore never shown as surf size, method and caveat on screen | SWELLO better |
| Verdict / rating | 5-word scale, generic free, personal in Pro | Rating with explanations, the Call, provisional labels | Comparable; SWELLO explains more |
| Confidence | 98/100 and 91% per hour with no visible basis | Reliability band, How-right accuracy | SWELLO better (honest) |
| Provenance | One line: valid, updated, computed, sources | Sources per number | Both; SWELLO deeper |
| Best window | 72 h, driver line, held stable between checks | Best windows / the Call | SWELLO has; stability rule missing |
| Spot facts | Short ideal-conditions blurb, unsourced crowd text, star reviews | Sourced spot facts with citations | SWELLO better |
| Board pick | Board-aware verdict, one board named | Quiver Board Match with weighted factors | SWELLO better |
| Session log | Board, rating, notes, tide snapshot, photos, offline sync | Journal, photo, "felt right", observation, local-only (works offline already) | Comparable |
| Learning from sessions | "Similarity score" vs best sessions | "Tuned" personal band from felt-right taps | Different; Quiver's similarity view missing in SWELLO |
| Alerts | Rule alerts, window Watch, similarity alerts, push, daily email | Rule alerts evaluated in-app (no push, no service worker), NWS hazard alerts incl. rip-current statements | Missing: Watch a window, delivery when the app is closed |
| Multi-spot week | Week Scout with share | Home week matrix, your-spots dashboard | Has; share missing |
| Custom spots | Pin anywhere, borrowed forecast, labelled uncalibrated | None | Missing |
| Water quality | Clean / advisory / closed per beach (SD County, EPA) | Only as text in sourced spot facts | Missing as live status |
| Cams | 106, includes Surfline and HDOnTap embeds | Owner-permitted cams under the camera rule, honest live/offline | Quiver wider; SWELLO cleaner licensing |
| Map | Swell-field animation (Pro) | Surfline-style map, coast pills, GPU field | SWELLO comparable or better |
| 3D wave size | None | Wave Scale 3D | SWELLO only |
| Community | Feed, crew, invites, reviews, game, badges, roadmap voting | None | Not wanted (see 4) |
| Accuracy | Methodology page, no numbers | How-right with real scores | SWELLO better |

## 3. Shortlist worth adopting (ranked)

1. **"Like your best days" similarity read** (M). SWELLO already collects felt-right taps and rated sessions; showing "today resembles your 3 best sessions at Linda Mar (swell 4-5 ft 13 s W, light E wind, mid tide falling)" turns the journal into a reason to open the app and is the most personal thing Quiver has. Sketch: on log, freeze the forecast/observed conditions (swell height, period, direction, wind vs shore, tide stage) per session; compute a weighted distance from each forecast hour to the user's top-rated sessions at that spot; show the nearest match with n and the matched session dates, hide under 3 rated sessions.
2. **Watch a window, delivered when the app is closed** (L). SWELLO's rule alerts only show inside the app; a surfer needs the ping. Quiver's "watch this window, tell me if it improves, slips or disappears, then go quiet" is the right shape. Sketch: "Watch" button on a best window stores {spot, window, rating}; a Cloudflare Worker cron re-runs the Call hourly and sends Web Push (service worker + VAPID) on a change; expire after the window ends. Ask before any paid push/email service.
3. **Stable best windows** (S). A window that jumps between the evening check and the dawn check erodes trust in the Call. Sketch: in `services/call.ts`, keep the previous window per spot (localStorage) and only replace it when the new best beats it by a margin or the inputs' model run changed; say "unchanged since 9 pm" when held.
4. **Share the plan** (S). Surfers plan with 2-4 friends; a shareable card ("Sat 7-10 am, Linda Mar, Good, 4-5 ft") spreads SWELLO without a social network. Sketch: `navigator.share` with a deep link (`?spot=&t=`) plus a canvas-rendered card carrying the estimate label and sources line; copy-link fallback on desktop.
5. **Custom spot from a pin** (M). Lets users keep a break SWELLO does not list, with SWELLO's honesty as the edge. Sketch: long-press on the Explore map creates a local spot with Open-Meteo offshore and wind at the pin, nearest CO-OPS tide by the existing rule, no surf height (offshore only, "uncalibrated custom spot") until the user sets a facing and swell range.
6. **Live water-quality status** (M). A closure or bacteria advisory changes the go/no-go answer and is public data. Sketch: per-spot status (open / advisory / closed, with date and agency) from California's beach-water advisory feeds (county programs, CA BeachWatch) and EPA BEACON elsewhere; show "no monitoring station" where none; never inferred.

## 4. Do not copy

- **Offshore height as surf size** (Bandon) and an unexplained **confidence out of 100**: both break SWELLO's data-honesty rules.
- **Third-party cam and photo embeds without clear permission** (Surfline cams, Google place photos): conflicts with SWELLO's camera rule and the public-repo licensing limits.
- **Unsourced crowd levels, crowd tips and star reviews with n = 2**: anecdote presented as fact; SWELLO's sourced spot facts are the stronger version.
- **Social feed, crew chat, badges, game, roadmap voting**: needs moderation and accounts, does not answer "is it worth paddling out", and is not where the user wants SWELLO to compete.
- **Calculator / landing-page farm** (dawn patrol, sunset, longboard pages, board-volume calculator): SEO filler; SWELLO already answers these inside the spot view.
- **Paywalling the personal verdict and favourites**: not relevant while SWELLO is private, and the generic-vs-personal split is a pricing device rather than a product improvement.
- **Their accuracy page as a model**: SWELLO's How-right already publishes real scores, which goes further than Quiver's methodology-only page.
