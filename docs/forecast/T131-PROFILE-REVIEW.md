# T-131 profile reviews (one change applied, rest draft)

Status: lead decisions 2026-11-04 applied on branch `t131-profile-review`; the data-honesty review runs before merge. Written 2026-11-04.

**Correction to the first draft.** I proposed narrowing the workable window for Moss Landing, Carmel and Linda Mar. That was a misread: the guide-facts `swellWorkable` field I compared is not what the profile uses. The profile window comes from the guide's **exposure** sector (`basis: 'exposure'`, clamped to ±60° of the facing; `spotFactsRules.ts`). Checked with `spotProfile(id).swellWindow`: Moss Landing 225–292.5° (surfnerd SW–WNW), Carmel 202.5–292.5° (SSW–WNW), Linda Mar 270–337.5° (W–NNW). Each already equals the guide's exposure sector, so the narrowing is already in force and the v1-vs-MOP table for the three is **unchanged by construction** (before and after identical: Moss Landing +4.0 ft, Carmel +2.5 ft, Linda Mar +2.0 ft; I did not re-fetch). The window does not explain those gaps.

**Applied (the only change):** Carmel's MOP assignment now carries a sourced caveat (`src/ocean/mop.ts`), shown in the Nearshore footer: surfnerd ([page](https://www.surfnerd.com/surf-forecast/carmel-beach), retrieved 2026-11-04) "The kelp and cove give the beach real shelter"; the point is in 15 m of water, about 1 km out (MO646); the guide does not say whether this shelter reduces wave size, or by how much. No size factor is claimed (the quote sits next to wind wording).

**Flag split (data-honesty review).** The nearshore-only flags are now separate: `hand` = the point was chosen by us (provenance only); `caveated` = the assignment has a caveat; `smaller` = our own stated caveat says the spot is usually smaller or more sheltered than the point (Bolinas and Cowell's only; `smallerThanPoint` on the assignment). "The point was chosen by us" shows only for `hand`; "usually smaller or more sheltered" only for `smaller`. Mavericks' caveat says waves can be *larger*, so it no longer gets the "smaller" phrase.

**Intended effect on confidence:** the T-130 rule is unchanged: a nearshore-only headline is "low" when the point is hand-chosen **or** caveated. For Carmel this means its nearshore-only hours (swell outside its window, or no profile) read "low" because of the caveat, not because we chose the point.

Scope: the 14 spots flagged "> 1 ft" in `docs/forecast/SPOT-HEIGHTS-WEEK.md` (v1 offshore-swell estimate vs CDIP MOP, one week, one swell regime). Five spots first, then seven more at the end (Waddell and Malibu skipped: 1 and 2 hours compared).

Method and limits:
- Sources are the public guide pages (surf-forecast.com, surfnerd.com), each read on **2026-11-04**. Neither guide states a break's own facing in degrees. Facing, workable window and exposure come from the guides' text; a shore normal comes from CDIP.
- NOAA chart, wannasurf and local-knowledge sources were **not** fetched in this batch. Where a proposal rests on geography (headlands, shadowing) and not on a fetched page, it is marked "geography, unsourced" and must not be applied until a source is added.
- The v1-vs-MOP gap is two models disagreeing, not validation. Neither is compared with an observation. The guide size ranges below are guide text, not measurements.
- Surf-forecast and surfnerd pages are third-party and sometimes disagree. Where they do, both are shown.

## 1. Ocean Beach, San Francisco (`spot-2`, MOP SF023, 10 m, normal 263.49°)
Week table: v1 6.3 ft vs MOP 11.1 ft (41 h), v1 − MOP = **−4.8 ft** (v1 reads *lower*).

| Item | guide-facts.json now | Sources, retrieved 2026-11-04 |
|---|---|---|
| Facing | W, 270° | surf-forecast: not stated. surfnerd: window S to N, W best ([surfnerd OB](https://www.surfnerd.com/surf-forecast/ocean-beach)) |
| Workable swell | S to N, W best (180–360°) | surfnerd: "S to N, W best". surf-forecast: ideal swell "from the west" ([surf-forecast OB](https://www.surf-forecast.com/breaks/Ocean-Beach)) |
| Exposure | exposed | surf-forecast: "exposed beach break", "Clean groundswells prevail", some shelter from NW winds only |
| Size | – | surfnerd: 0.9 m (3 ft) to 1.8 m (5.9 ft); "heavy beachbreak" over sand, "Expert" |

Finding: the guides agree with the stored facing and window. They do not explain a 4.8 ft gap. The profile's own swell window (203–323°, offshore frame) and 8 s minimum are the T-008 engineering assumptions, not guide facts; the guide window is wider (S to N).
Decision (lead): **no change and no new caveat.** The headline uses OB's owner-reviewed SF023 point, so v1 reading low only matters as a fallback. Original note: open question for the data-honesty review: the surfnerd size range tops out at 5.9 ft while MOP at 10 m reads about 11 ft this week, which suggests the 10 m point is outside the main break line at OB (wide bar and surf zone). Any change belongs to the height rule, not the profile; propose recording the 10 m point's caveat on the method line, as for Mavericks. No number change proposed.

## 2. Moss Landing (`cs-moss-landing`, MOP MO893, 15.07 m)
Week table: v1 7.1 ft vs MOP 3.1 ft (40 h), v1 − MOP = **+4.0 ft** (v1 reads higher).

| Item | now | Sources |
|---|---|---|
| Facing | W, 270° | surfnerd: "SW - WNW. Faces W" ([surfnerd](https://www.surfnerd.com/surf-forecast/moss-landing-state-beach)) |
| Workable swell | S to N, W best (180–360°) | surfnerd page now shows exposure **SW–WNW**; surf-forecast: ideal from the **northwest**, "quite exposed" ([surf-forecast](https://www.surf-forecast.com/breaks/Moss-Landing)) |
| Size | – | surfnerd: 0.9 m (3 ft) to 5.5 m (18 ft) |
| Shelter | – | neither page states any |

~~Finding: the stored window (180–360°) is wider than the guide's exposure (SW–WNW, about 225–292.5°). The extra S and N-through-NNW sectors let v1 count swell the guide says the beach does not take, which fits v1 reading 4 ft above MOP. Moss Landing sits at the head of Monterey Bay, so NW swell is bent around Point Santa Cruz and attenuated (geography, unsourced).~~ **Superseded (see the correction at the top):** the profile window is already 225–292.5°; the extra-sector explanation does not apply. The bay-shadow remark below stays geography, unsourced.
Outcome: **no change needed.** The profile window is already 225–292.5° (see the correction above), so the gap of +4.0 ft is not a window problem. surf-forecast prefers NW; a bay-shadow cut needs a source (NOAA chart or CDIP refraction note) first.

## 3. Jalama Beach (`cs-jalama`, MOP B1084, 10.01 m)
Week table: v1 6.8 ft vs MOP 3.5 ft (9 h only), v1 − MOP = **+3.3 ft**.

| Item | now | Sources |
|---|---|---|
| Facing | WSW, 247.5° | surfnerd: "SSE - WNW. Faces WSW" ([surfnerd](https://www.surfnerd.com/surf-forecast/jalama-beach-county-park)) |
| Workable swell | S to NW (180–315°) | surf-forecast: best swell "from the southwest", "just as likely from local windswells as from distant groundswells" ([surf-forecast](https://www.surf-forecast.com/breaks/Jalama)) |
| Size | – | surfnerd: 0.6 m (2 ft) to 3 m (9.8 ft) |
| Shelter | – | neither page mentions Point Conception |

Finding: the stored facing and window match surfnerd. Only 9 hours were compared, so the gap is weakly supported. Jalama sits just east of Point Conception, which blocks the far-northwest part of a NW swell (geography, unsourced); the stored upper limit of 315° may be too wide. WNW swell at 2.5 m, 14 s is on the surf-forecast page today.
Proposed change: **hold**, pending a source for the Point Conception shadow (NOAA chart or CDIP point-spread data). If sourced, narrow the upper bound from 315° to about 295°. Meanwhile, state "9 hours compared" beside any figure.

## 4. Carmel Beach (`cs-carmel`, MOP MO646, 15.01 m)
Week table: v1 7.2 ft vs MOP 4.6 ft (7 h; the 49-hour mean is 4.4 ft), v1 − MOP = **+2.5 ft**.

| Item | now | Sources |
|---|---|---|
| Facing | WSW, 247.5° | surfnerd: "SSW to WNW, facing WSW" ([surfnerd](https://www.surfnerd.com/surf-forecast/carmel-beach)) |
| Workable swell | S to N, W best (180–360°) | surfnerd workable "S to N, W best"; exposure SSW–WNW. surf-forecast: ideal from the west ([surf-forecast](https://www.surf-forecast.com/breaks/Carmel-Beach)) |
| Size | – | surfnerd: 0.6 m (2 ft) to 2.4 m (7.9 ft) |
| Shelter | – | surfnerd: "The kelp and cove give the beach real shelter" |

~~Finding: this is the clearest case. surfnerd states shelter in words and caps the usual size at 7.9 ft, while v1 reads 7.2 ft and MOP (a 15 m-deep point about 1 km out) reads 4.4–4.6 ft. The stored workable window (S to N) is wider than the exposure (SSW–WNW), and the cove shelter is not modelled anywhere.~~ **Superseded (see the correction at the top):** the profile window is already SSW–WNW (202.5–292.5°); only the shelter statement and the size comparison stand. Cove shelter is not modelled in the point's number.
Outcome: (a) the window is already SSW–WNW (202.5–292.5°); (b) **applied**: the sourced shelter caveat above (no size factor claimed).

## 5. Linda Mar, Pacifica (`spot-3`, MOP SM375, 15 m)
Week table: v1 7.5 ft vs MOP 5.4 ft (46 h), v1 − MOP = **+2.0 ft**.

| Item | now | Sources |
|---|---|---|
| Facing | NW, 315° | surfnerd: "Faces NW" ([surfnerd](https://surfnerd.com/surf-forecast/lindamar-pacifica)) |
| Workable swell | SW to N (225–360°) | surfnerd exposure "W - WNW. WNW - NNW"; surf-forecast: ideal "from the northwest" ([surf-forecast](https://www.surf-forecast.com/breaks/Linda-Mar-1)) |
| Exposure | "somewhat protected" vs "exposed" | surfnerd: "Somewhat protected from swell and wind"; surf-forecast: "an exposed beach break". Sources disagree |
| Size | – | surfnerd: 0.6 m (2 ft) to 3.7 m (12.1 ft) |

~~Finding: the stored workable window (SW to N) is much wider than surfnerd's exposure (W to NNW, about 270–340°), and the sources disagree on shelter. The profile note already says the narrower surfnerd window is "used", but the stored window is still 225–360°, which does not match. MOP SM375's own normal is not checked here (MOP assignment lists candidates SM375/SM376 at normals 320° vs 339°).~~ **Superseded (see the correction at the top):** the profile window is already W–NNW (270–337.5°). The disagreement between sources on shelter stands. The `swellWorkable` field (225–360°) is not the field the profile uses.
Outcome: **no change needed.** The profile window is already W–NNW (270–337.5°), as the note says. Keep "sources disagree on shelter" (surfnerd "somewhat protected" vs surf-forecast "exposed"); a San Pedro Point shelter needs a source (geography, unsourced).

## Remaining spots (surfnerd and surf-forecast read 2026-11-04; window = what `spotProfile(id).swellWindow` gives now)

| Spot (week diff, hours) | Profile window | Guide text | Finding / proposal |
|---|---|---|---|
| Humboldt North Jetty, v1 − MOP −2.3 ft (16 h) | 292.5–0° | surfnerd "WNW - N. Faces WNW", 2–7.9 ft; [surfnerd](https://www.surfnerd.com/surf-forecast/north-jetty-california). surf-forecast: best from the northwest, "exposed beach/Jetty break", no shelter wording ([surf-forecast](https://www.surf-forecast.com/breaks/North-Jettyat-Eureka)) | Window equals the guide. v1 reads low as at OB. **No change.** |
| Salmon Creek, +1.7 (49 h) | 202.5–315° | surfnerd "SSW - NW. Faces W", 1–9.8 ft ([surfnerd](https://www.surfnerd.com/surf-forecast/salmon-creek)); surf-forecast best from the WSW, exposed ([surf-forecast](https://www.surf-forecast.com/breaks/Salmon-Creek)) | Window equals the guide. **No change.** The gap is not a window effect; surf-forecast's WSW ideal sits inside the window. |
| Dillon Beach, +1.9 (49 h) | 270–315° | surfnerd "W - NW. Faces W", 1–5.9 ft ([surfnerd](https://www.surfnerd.com/surf-forecast/dillon-beach)); surf-forecast best from the west, exposed, no Tomales Bay shelter wording ([surf-forecast](https://www.surf-forecast.com/breaks/Dillon-Beach)) | Window equals the guide. Mean v1 (7.9 ft) is above surfnerd's stated top size (5.9 ft); MOP (5.9 ft) is at it. A guide's range is not a cap, so **no change**; flag for the review. |
| Asilomar, +1.9 (49 h) | 247.5–337.5° | surfnerd "WSW - NNW. Faces WNW", 3–12.1 ft ([surfnerd](https://www.surfnerd.com/surf-forecast/asilomar-state-beach)); surf-forecast: "exposed beach and reef break", best from the west, a reviewer says "not wind protected" ([surf-forecast](https://www.surf-forecast.com/breaks/Asilomar)) | Window equals the guide. **No change.** |
| Morro Rock / Strand, +1.3 (48 h) | 202.5–315° | surfnerd Morro Strand "S - WNW. Faces W", 2.7–7.6 ft in the current windows ([surfnerd](https://www.surfnerd.com/surf-forecast/morro-strand)); surf-forecast best from the northwest, "fairly exposed" ([surf-forecast](https://www.surf-forecast.com/breaks/Morro-Rock)) | Window comes from the surfnerd Morro Bay page (SSW–NW) and the Strand page reads S–WNW; the two pages differ by about 22° at each end. Not worth changing on a 1.3 ft gap. **No change.** |
| Trestles, +1.1 (11 h) | 135–315° | surfnerd Lowers "SE - NW. Faces SSW", 1–12.1 ft; no Channel Islands wording ([surfnerd](https://www.surfnerd.com/surf-forecast/trestles-lowers)); surf-forecast best from the southwest, "beach and reef break" ([surf-forecast](https://www.surf-forecast.com/breaks/Trestles_Lowers)) | The window is 180° wide because it takes surfnerd's exposure sector (SE–NW). guide-facts also holds surfnerd's **workable** sector S–W (180–270°, retrieved 2026-11-02), which is the narrower sourced statement. **Proposal (needs review):** use S–W for this spot, since both guides put the best swell in the southwest and the NW part of the exposure sector is likely screened by the islands (geography, unsourced; not part of the proposal). Only 11 hours compared. |
| Imperial Beach, +1.8 (41 h) | 202.5–315° | surfnerd workable S–NW, W best, 2–10 ft ([surfnerd](https://www.surfnerd.com/surf-forecast/imperial-beach)); surf-forecast best from the southwest, exposed ([surf-forecast](https://www.surf-forecast.com/breaks/Imperial-Beach)) | Window within the guide's. A Point Loma / Coronado Islands shadow is geography, unsourced. **No change.** |

Not reviewed: Waddell Creek (1 hour compared) and Malibu (2 hours): insufficient evidence.

## Cross-cutting observations for the data-honesty review
1. For six of the seven spots reviewed from this table, the profile window already matches the guide's exposure sector, so the v1-vs-MOP gap is not a window problem. The v1 overshoot at the exposed beaches is more likely a feature of the offshore-to-10 m transfer (refraction, bar and surf-zone dissipation), which a guide cannot tell us.
2. Ocean Beach goes the other way (v1 lower than MOP), so a window change would not fix it.
3. Nothing here is verified against an observation (buoy or cam). A later check against a nearby CDIP or NDBC buoy would be stronger than guide text.
