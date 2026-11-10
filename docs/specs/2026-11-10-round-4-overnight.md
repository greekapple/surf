# Round 4 (overnight 2026-11-09/10): collect data and ratings for every spot, buoy archive, onshore-wind rating cap

The user, before bed: "let's do those next steps and actually start collecting data and ratings for more spots than just our starting 45".

They approved the pending decisions:
- the NDBC `.spec` archive ("archive yes"), both files, with a backfill;
- the onshore-wind rating cap.

Gated batches deploy, as in rounds 1–3. Australia stays with the Fable session (briefing Track 5); its tide choice is still open.

## Ground truth
- **"How right we've been"** (`services/how-right.mjs`, `src/services/howRight.ts`, `howRightSpots.ts`) scores only spots with a CDIP MOP point, which is California's original 45. Every other spot, all 447 of them, says "this spot is not in today's check". It's a daily job: capture what was shown, score it against buoys, write `howright/v1/scorecard.json`.
- **Nothing records what we forecast or rated** for the 447 spots outside MOP coverage. The hot/cold refresh only caches spots that were recently viewed.
- **NDBC deletes realtime `.spec` files after 45 days.** The plan for keeping them is `docs/specs/DRAFT-spec-archive.md`.
- **The split-swell audit** (`docs/forecast/RATING-AUDIT-SPLIT.md`) found that California's "fair or better while poor" comes from the onshore-wind rule: the severe-wind cap only starts at about 19 mph, while the Call's Skip line is at 12 mph.

## 4A. Buoy archive (eng-term)
Build `DRAFT-spec-archive.md` as written:
- **Buoys:** 54, with `.spec` and `.data_spec`, in a second daily cron.
- **Storage:** R2 `archive/ndbc/...`, with a manifest and a cursor.
- **Backfill:** the 45 days NDBC still holds, run on the first deploy.
- **Budget:** the subrequests stay in their own run.

**Acceptance:**
- tests for the key layout, idempotent writes and the cursor;
- a local run against live NDBC for 2 buoys;
- after the deploy, the manifest for today exists in R2 and the backfill cursor advances (read back with wrangler).

## 4B. The onshore-wind rating cap (product-term)
**The rule:** when the measured or forecast onshore wind is over 12 mph (`ONSHORE_BAD_MPH`, the Call's Skip line), the rating caps at 39, the top of "poor". Every other part of the engine is unchanged.

**Acceptance:**
- **Before/after table:** for all 492 spots over the current 7-day forecast, list each changed hour: spot, hour, old score/band, new score/band, wind. No hour may rise. Hours with onshore wind ≤ 12 mph must be byte-identical.
- **Rerun the split audit** (`rating-audit-split.ts`) on the new engine, and report California's "fair or better while poor" before and after.
- **Explanation:** `ratings/explain.ts` says why ("onshore wind over 12 mph: capped at poor").
- **Review:** data-honesty-reviewer, with one cycle.

## 4C. "How right we've been" for every spot (eng-term, after 4A)
**Every day, capture what we showed, for all 492 spots:**
- the Open-Meteo marine forecast at each spot's marine point (Hs, Tp, Dp, plus swell partitions) for the next 48 h;
- the app's rating for each of those hours (same engine as the page).

Store it as `howright/v2/shown/<date>.json`. Spots without a fresh cached copy get one Open-Meteo marine fetch each, about 450 a day. That has to fit the 10k free tier together with the hot/cold refresh: show the sum.

**Score it against observations:**
- **Which buoy:** the nearest open-ocean buoy (NDBC/CDIP, not a sheltered one, the same rules as the context buoys) within 100 km, with the spot's swell window covering the buoy's direction from the spot.
- **What is compared:** the offshore forecast at that buoy's position against the buoy's measured Hs, period and direction, using the split swell where the buoy publishes it.
- **The rating:** the observed-fed rating (split inputs plus the measured shore wind where a shore station exists) against the rating we showed.
- **Windows:** 7 and 30 days, as the archive fills.

**The labels on the spot page** must say exactly what was compared, e.g.:
- "Offshore forecast vs buoy 51201 (Waimea Bay), 18 km: typical error 0.4 m, ran low";
- "Rating vs measured: 6 of 7 days within one band".

**Coverage and gaps:**
- California keeps its MOP-based nearshore check, plus the new offshore line.
- A spot with no eligible buoy says so plainly, and never borrows one.
- The first days show "collecting: N days so far", not a number from one sample.

**Acceptance:**
- unit tests for buoy eligibility, scoring and the "collecting" state;
- the budget sum;
- after the deploy, today's capture exists for all 492 spots in R2;
- data-honesty review, with one cycle.

## 4D. Lead
**Reviews:**
- a code review of 4A and 4C;
- data-honesty reviews of 4B and 4C.

**Every review brief says:** read branches with `git show` and `git diff`, never `git checkout`.

**Before each merge:**
- check that HEAD is forecast-trust;
- then the full gate.

**Deploy and verify:** deploy each gated batch, then verify on production with the scoped Access token.

**Morning report:** `80-Handoffs/2026-11-10-morning-report.md`.

## Level
- 4A and 4C: production infrastructure plus new stored data, within free tiers. Level 3.
- 4B: a rating change, approved by the user. Level 3.
