# T-065 (product): forecast trust, screen side

Spec: `docs/specs/2026-11-02-forecast-trust.md` (approved). Branch `worktree-product`: I merged forecast-trust 19a9de8, then engineering's T-064 6167b18. The commits are 3998e61 (the UI on a stub), the photo pass, and f96676e (switch to the T-064 services and fixes).

## What's on screen
- **Seam.** `src/features/forecast/trustApi.ts` re-exports the T-064 services (call, daylight, surfSeries, feltRight, nwsAlerts, boardPeriod). I built against a stub with the same signatures and then switched to the real services; the stub is gone.
- **Spot page** (`ForecastView.tsx`, new `Trust.tsx` and `trust.css`):
  - **The Call** sits under the photo band: verdict dot + word (Go / Worth a look / Skip / Dark), the window ("· next window 6 AM–2 PM tomorrow" after dark), and the first "why" sentence. Tapping it shows every reason and the basis line.
  - **Daylight row:** first light, sunrise, sunset, last light for the selected day.
  - **NWS banner:** only when `alertsFor` returns an active alert. It quotes the event, from/until and the source link, adds "for the nearby coast" when the zone is borrowed, and shows nothing when the feed fails. It is live today for Ocean Beach (Beach Hazards Statement).
  - **One big height:** the SURF estimate + body words. The SURF card has one source line ("model estimate …"), and its offshore line is gone.
  - **Graph:** the Surf tab plots the surf-estimate band (one bar per hour from low to high, as in Surfline 07), with offshore Hs as a thin grey line. The legend says "Surf estimate (range) · Offshore Hs". Night is shaded, and the tooltip and slider text lead with the surf estimate.
  - **Day strip:** dark AM/PM segments are drawn as night. The day ranges keep engineering's dayRange.
  - **Sources & data:** one collapsed section holding the nearshore model, the buoys and the sources table.
  - **Rating card:** reads "Not rated" after dark (the Call says Dark). With T-064's night-aware rating, no dark hour is rated.
  - **Phone (390):** the Surf card is full width ("Felt right?" on one line), wind and tide follow, then rating/water, scale and swell. The first screen holds the name, the Call, daylight, the surf estimate, the wind relation and the tide trend, even with an active alert (the banner is one line on phones).
- **"Felt right?"** (Too low / Right / Too high) sits in the SURF card beside "What did you see?". One tap stores it through `logFeltRight` with the same env as observations; the pressed state comes back for today via `feltRightFor`.
- **Board Match:**
  - **Spot page row:** "Ride your <board> (<len> <type>): it suits a–b ft, N s period suits it. Wave shape unknown." from `rankBoards` (sizeFit + periodFit). There is no row when nothing is recommendable, and the apology is gone.
  - **`/quiver/match`:** with an estimate, it ranks every board on size + period, with the one-line shape note. With offshore height only, it shows a short "needs a surf estimate" message. Wave character is weighed only when known (demo week).
  - **My Boards and the board room:** the match line is now size + period.
  - Every "needs the wave's character" paragraph is gone.
- **Home and nearby:** every card and row shows the compact call (verdict + window). Spots without an estimate show the muted "Surf est. unavailable · offshore 7 ft", never a big offshore number.
- **Photo pass:** the Ocean Beach header is now "Fog clearing at Ocean Beach" (Brocken Inaglory, CC BY-SA 3.0), with lines of surf instead of the beach walker. Linda Mar is "Sunset Surfer in Pacifica" (Dave Fayram, CC BY-SA 2.0), a surfer walking into the surf instead of the parking lot. Both were already licensed and credited in `src/ui/photos.ts`; I only changed the order. No new assets.

## Checks (5184, against the real T-064 logic)
- tsc OK; unit tests 348/348; build OK.
- **New `t065-trust.mjs`, 50/0 at 1440 and 390:**
  - the Call (verdict, why, tap shows reasons and basis); daylight;
  - exactly one large wave-height number; nearshore and buoys only inside Sources & data; the SURF card without an offshore number; no "wave's character";
  - the Board Match row says "Wave shape unknown"; the graph band with night shading, its selected hour matching SURF, and the legend;
  - the NWS banner only with an alert; the 390 first screen (name, Call, height, wind relation, tide trend, daylight);
  - "Felt right?" in one tap, kept after reload;
  - Home and nearby show the call on every card with no offshore number styled as surf;
  - Board Match ranks on size + period; no overflow; console clean.
- t045 ALL PASS, updated to the spec (backup kept): the Call replaces Rating in the 390 first screen, and the offshore line is no longer required under SURF.
- t047 55/0; t055 11/0; t060 44/0; density ALL PASS; journeys 8/8. Journey 3's readout parser now reads "surf estimate a to b ft" (backup kept).
- **Codex review:** skipped. The ChatGPT plan's usage limit is reached today. Also, `tools/review/codex-review.sh` writes its marker to `.git/codex-usage-limit`, and in a worktree `.git` is a file, so the write fails. It needs `$(git rev-parse --git-common-dir)`.
- **Shots:** `playwright-toolkit/swello/artifacts/t065/` holds before/, after/ ({forecast,home,match}-{1440,390}) and ref/ (Surfline 04 and 07). Quiver spot-page reference: not captured here.

## Open
- The Home 12-hour ribbon treats dark hours as no data, with the plain gap style. It could label them "Dark" (engineering's suggestion). Not done.
- The swell card still shows the offshore swell partitions (heights in small type). I kept them as swell components, as in Surfline 04, not as a second wave-height number.
