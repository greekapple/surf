# Quiver audit (quiver-lock, 2026-11-14)

Scope: `src/features/quiver/*`, `services/quiver.ts`, `boardPeriod.ts`, `skillLevels.ts`, Board Match wherever it is called (Home hero "Take your …", the spot page, Personal, the Quiver). Method: code read, a running dev build at 390 and 1440 in light and dark (screenshots `quiver-audit-shots.mjs`, before-state kept in the session's `wq/qv-audit/`), a fixture matrix on the Board Match function, and public sources for the rules. Findings marked **P0/P1/P2** (P1 = a surfer is misled or blocked; P2 = confusing, slow, unlabelled).

## 1. Every job a surfer does, and how it worked before

| Job | Before | Finding |
|---|---|---|
| Add a board by type, size, volume | One long form; volume **required** (the volume is "usually printed on the stringer") | P2: a surfer who does not know the volume is stuck; no defaults by type; the placeholders are one set for every type |
| Edit | Edit button opens the same form; the Showroom has a second editor made of steppers | P2: two editors for one thing; dimensions "look like controls" even when only reading |
| Remove | Delete lives inside Edit behind a confirmation | OK |
| Empty quiver | "Your quiver is empty" + one button | P2: does not teach what a board gives you |
| Which board for today | A small grey sentence under the spec row; each board repeats the same chip ("Surf above its range" x4) | **P1**: no answer first; the verdict is said four times and never stated once |
| Why | Board Match page (scores, factor bars) | OK, but the labels say "category range" with no source |
| Compare | Compare page and a Compare mode in the 3D stage | P2: two ways; fine once merged |
| What volume suits me | A sentence on the Board Match page, only with a weight set | P2: not shown where a board's volume is shown; no comparison with the board |
| 3D view | 6 fixed angles with a "1 / 6" counter, a 360 auto-spin, hotspots | **P1** (user): "not truly 3D"; a swipe steps the angle; the underside is only reachable by a preset; "little blue things" on a phone |

## 2. What was broken, confusing, slow or unlabelled (390 and 1440, light and dark)

- **P1: the "little blue things" on the phone 3D stage are the four hotspot buttons** (`.br-hot`: fins, tail, nose, rail). They appear for 4 s after any touch on the board (`hot-on`), are 44 px white rings with a dark centre, and are positioned from projected anchors, so on a cropped or tilted board they float under or beside it as unlabeled dots (confirmed by a touch-tap at 390: four 44 px rings at the board's anchors; screenshot `before-hot-390.png`). Fix: hotspots removed; the same facts are in the spec list.
- **P1: the 3D view is a slideshow.** `BoardRoom.onUp` turns any fast horizontal swipe into "next angle"; `touch-action: pan-y` plus a polar clamp (`maxPolarAngle 1.5`) means the underside cannot be reached by dragging; a "1 / 6" counter, an "Angles" tab, six thumbnails and an auto-spin "360" mode present it as steps. Fix: free rotation on both axes with inertia, pinch and wheel zoom, double-tap reset, keyboard, presets as a secondary row.
- **P1: the board is cropped and washed out on a phone** (cream board on a cream set, a wide blurred shadow; the board runs past the left edge at 390).
- **P1: two bars stack over the content at 390** (the sticky "Today / Open Board Match" bar and the floating tab bar): the last spec row ("Thickness", "Volume") sits behind them.
- **P1: a real brand on the example boards** ("Firewire · Seaside (Helium) · Example board (retail model)"). Fixed: generic names, no maker, no model, no retailer links; saved copies migrate.
- **P2: the Quiver is two pages for one thing** ("My boards" and "Showroom": different titles, duplicate name, maker, match line and dimensions).
- **P2: the rack's prev/next arrows show although all boards fit; the selected board is a thin blue underline; four identical fit chips.**
- **P2: Home says "Take your Everyday shortboard" for an example board** as if it were the surfer's. Fixed: it says it is an example and points to Quiver.
- **P2: "your range" / "category range"** is the only hint where a wave range comes from; it is our own rule for the board type and now says so ("our rule for a fish").
- **P2: volume is required**; no estimate; the volume a surfer typed and the volume we computed would look the same. Fixed: optional, estimated from L x W x T by type, saved and shown as an estimate.

## 3. Is Board Match sound?

**Volume.** Our rule is volume = weight x a litres-per-kg factor by level (`skillLevels.ts`): 1.0, 0.8, 0.65, 0.5, 0.45, 0.4, 0.37 for levels 1 to 7. Public figures (they disagree, which is why the rule stays labelled "ours, not fitted to any data"):
- miniwebtool.com surfboard-volume-calculator (retrieved 2026-11-14): beginner 0.60 to 0.65 L/kg, intermediate 0.45 to 0.48, advanced 0.38 to 0.40, expert/pro 0.32 to 0.35; "typical starting values", adjusted by fitness and age.
- totalcalchub.com surfboard-volume-calculator (retrieved 2026-11-14): beginner 0.8 to 1.0, intermediate 0.6 to 0.75, advanced 0.45 to 0.6.
- (search results also showed mundo-surf.com, unisurfity.squarespace.com and others with 0.35 to 0.5 for advanced; the spread across sources is about 2x for beginners.)
Our factors sit inside the union of the two sources for every level (test `volume: Board Match's litres per kg ...`); they lean to the generous (more float) end for levels 1 to 3, which is the safe side for a beginner. Verdict: **sound as a labelled rule of thumb**; the surfer sees "about 38 L suggested (75 kg x 0.5 L/kg at level 4; our rule of thumb)" beside a board's own volume (new, display only; it never changes which board is picked).

**Size range per board type** (`boardRanges`: fish 1 to 5 ft, shortboard 3 to 8, step-up 5 to 12, gun 10 to 25, soft-top 0.5 to 4 ...). Public cross-check: surfscience.com "Choosing a surfboard type based on the waves" (retrieved 2026-11-14): fish "fun on waves 2-4 feet tall", a semi-gun "in 12 foot conditions", a full gun for "20+ feet", "waves 4-7 feet with a medium pitch: you can ride any board"; rapturecamps.com board-type guide: soft-tops and longboards for small waves and learning, guns "for waves well overhead and beyond". Our ranges are wider than those single statements (a fish to 5 ft, a gun from 10 ft) and agree in order and scale. Verdict: **plausible, ours**; each line now says "our rule for a fish" instead of "category range"; a surfer's own range on a board still wins.

**Wave shape and period** (`boardPeriod.ts`): minimum comfortable period per board kind (shortboard 10 s, step-up 11, gun 12, fish/midlength 8, longboard 7) and a "long period is powerful for a small board" note. Already labelled "our own rule of thumb, not a published standard". Wave shape (`character`) only enters the full score when a measured face and a character exist; otherwise Board Match is size + period and says "wave shape unknown". **Sound and honestly labelled.**

**The 7 skill levels.** They reach Board Match three ways: the suggested volume (litres per kg by level), the ability gate (levels 1 to 3 beginner, 4 to 5 intermediate, 6 to 7 expert against each type's minimum in `boardRanges`: groveler, fish, shortboards intermediate; step-up and gun expert), and the Call's own size limits. Finding (fixed): the **size-only path ignored the ability gate**, so a level 2 surfer with a step-up in the quiver could be told "Take your Step-up" on a 10 ft day; the full-score path already applied it. One rule now.

**Finding (fixed): the pick could differ between surfaces.** `scoreBoard` calls a board "eligible" when the surf is within a foot OUTSIDE its range; `boardPickFor` picked it, but Home hid a pick whose surf was not inside or at the edge of the range, while Board Match named it. Now one `suits` rule (inside or at the edge) in both modes, a fixed tie-break (favourite, name, id) so the order of the quiver never changes the answer, and a dead second picker (`SpotPage.bestBoard`) removed. `homeBoardAdvice` and `evidenceMatch` are unused by any screen (tests only) and were left.

**Do the Home pick, the spot page pick and the Call ever disagree for the same hour?** Home, the spot page, Personal and the Quiver all call `boardPickFor(boards, spot, record, now, profile)`, so for the same hour they give the same board (matrix test over 7 levels x 3 weights x 5 wave sizes, plus a source check that no screen ranks boards itself). The **Call** (Go/Skip) does not choose a board: it judges conditions against the surfer's level. They can still say different things for the same hour in a legitimate way: Home may say "Take your fish" for a window the Call rates Skip for the surfer's level; the board line is about the board, the Call about whether to go. Not changed.

## 4. What the fix pass covers
Answer-first verdict band; one Quiver page (read-only specs, steppers only in Edit); true 3D (free drag on both axes, inertia, pinch/wheel zoom, double-tap reset, keyboard, no auto-spin, no counter, no hotspots); generic example boards; Home labels examples; add-board with type defaults, optional volume with an estimate, one-line empty state; the phone page with room for the floating tab bar. See the hand-off for the list of what changed and anything that needs the user's decision.
