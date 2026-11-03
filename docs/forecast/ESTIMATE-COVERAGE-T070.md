# Which spots have a surf estimate today, and what unlocks more (T-070)

Counted from the code on 2026-11-02 (`breakingProfiles`, `mopAssignments`, `mopCandidates`, `nearshoreSlopes`, spot `orientation`).

## Today: 1 of 45 spots has a surf estimate

| | Spots | What they show |
|---|---|---|
| **Surf estimate** ("Est. X–Y ft at the break, model estimate") | **Ocean Beach (spot-2)**: v2 from CDIP MOP SF023 where the MOP has the hour, otherwise v1 from the offshore swell | range with body words, labelled unvalidated |
| **Offshore only** ("X ft offshore, not surf size") | the other **44**: Marin 3, San Mateo 3, Santa Cruz 6, Monterey 3, Big Sur 1, San Luis Obispo 2, Santa Barbara 2, Ventura 2, Los Angeles 5, Orange County 4, San Diego 7, Del Norte 1, Humboldt 3, Mendocino 1, Sonoma 1 | labelled offshore height, never styled as surf size |

Two of the 44 are closest to unlocking: **Linda Mar (spot-3)** and **Bolinas (spot-0)** each have MOP candidates (SM375/SM376 and MA140) waiting for the owner's review.

## Why the others have none (what each estimate method needs)

- **v1** (offshore swell, Komar–Gaughan breaker height): a surveyed beach normal (orientation), a swell window, a minimum useful period, a shelter factor and the face factors. Only Ocean Beach has all of them. Of these, only the orientation is a sourced fact (CDIP MOP metadata); the window (normal ±60°), minimum period (8 s) and shelter (1) are lead-set assumptions, and the 0.7–1.4 face factors are unvalidated.
- **v2** (MOP nearshore, linear shoaling and refraction): all of the above except the shelter factor, plus a **reviewed MOP point** for the spot (never "nearest wins": coves and headlands put the nearest point in different wave conditions).
- **Breaker type** additionally needs a defensible slope; only Ocean Beach has one.

## What would unlock estimates for more spots (options for the user; none applied)

1. **Owner review of `docs/forecast/SPOT-FACTS-REVIEW.md`** (Linda Mar, Bolinas, and the MOP candidates). The owner approves or fixes orientation, swell window and minimum period; picking the MOP point unlocks v2 for that spot. Slowest, most trustworthy; two spots per sitting.
2. **A shared rule for the lead-set assumptions** (window = beach normal ±60°, minimum period 8 s, shelter 1) applied to every spot with a surveyed orientation, labelled "assumption" per spot. Fast, but wrong for sheltered or point breaks (the offshore swell reaches them very differently), so the estimates there would be less honest than at a straight beach.
3. **Derive the beach normal from the coastline** (the Natural Earth coast already in the app, the same coarse source as the slope) for beach spots, marked "derived, unreviewed". It supplies the one missing sourced fact for v1 at most spots but not the window, period or shelter, so it only helps together with option 2.
4. **More MOP points.** CDIP MOP covers the whole California coast at about 100 m spacing, so a MOP point exists near every spot; `scripts/mop-lookup.mjs` finds them. The bottleneck is the review per spot, not the data: a rule such as "nearest 10 m point whose shore normal is within 20° of the coastline-derived normal" could propose assignments for the owner to approve in bulk. v2 then covers those spots without a manual shelter factor.
5. **Observations (T-059)** do not unlock estimates by themselves: calibration scales an existing estimate. Spots without one would need option 1–4 first.

Not recommended: v1 with the default assumptions on every spot unreviewed, because point breaks and bay spots would show confident-looking ranges the model cannot support. The honesty rules are unchanged by this report.
