# Quiver: four real reference boards in place of the fictional demos
Status: **APPROVED** (user 2026-11-05: the shortboard is the "Sharp Eye Inferno 72, carbon version"; "everything else is fine"). Owner: one implementation agent (not Fable, to save credits), branch `quiver-real-boards` from forecast-trust. The lead merges.

## The boards (replacing `src/data/demo.ts` demo-fish/short/long/step)
| id | Name on card | Model | Size | Tail, fins | Reference photos (scratchpad only) |
|---|---|---|---|---|---|
| demo-short | Everyday shortboard | Sharp Eye Inferno 72, C1 Carbon | 5'10" × 19¼" × 2⅝", 29.4 L | squash, thruster | `inferno/` deck, bottom, rail, 3 angles |
| demo-fish | Small-day fish | Firewire Seaside (Helium) | 5'11" × 22¾" × 2¾" | swallow, quad | `seaside/` deck, bottom, tail, spec card |
| demo-long | Soft-top cruiser | Wavestorm 8' Classic | 8'0" × 22½" × 3¼", 86 L | round, thruster, soft-top | `wavestorm/` deck + bottom + side profile per shot |
| demo-step | Bigger-day option | Pyzel Ghost | 6'6" × 20½" × 3", 40.1 L | squash, thruster | `ghost/` deck, bottom, tail, spec card |

Folder: `/private/tmp/claude-501/-Users-milosin-Development-projects-surf/250e1e66-bb9b-4659-a5ff-86bd5a0084e7/scratchpad/quiver-src/`.

Sources:
- Inferno 72 C1 Carbon: theboardlab.com.au, sharpeyesurfboards.com.au;
- Seaside: cleanlinesurf.com;
- Wavestorm: ridershack.com, costco.co.uk;
- Ghost: cleanlinesurf.com.

The Seaside's volume isn't published for 5'11" Helium: leave it unset (or as the retailer's stated figure if found), never invented.

## What to build
1. **Outlines from the photos:**
   - Trace each board's planshape from its top-down deck photo with the existing photo path (`src/features/quiver/traced.ts`, `cutout.ts`, `outline.ts`), scaled to the published length and width.
   - Commit only the resulting numeric outline (half-width samples), as data. **Never commit the photos** (the public repo; product photos are third-party).
2. **Shape params into `buildBoard`** (R16, `src/features/scale/boardMesh.ts`):
   - tail, fins (quad for the Seaside), thickness;
   - the rocker from the Wavestorm's side profile (measured), category typical for the others;
   - a soft-top flag for the Wavestorm: a matte foam deck, a slick bottom, rounded fat rails, no stringer and no glossy resin.
   Fields from the photos get `source: 'photo'`; the rest `default`.
3. **Looks** (`looks.ts`):
   - colours in the spirit of each board: the Inferno's carbon (a dark woven deck look, procedural); the Seaside white; the Wavestorm blue stripes on white with its blue bottom; the Ghost white;
   - **no logos, no brand graphics, no text** copied.
4. **Cards:**
   - the real model name and the size;
   - a line: "Modelled from published specs and product photos · approximate";
   - the old "(fictional)" wording goes;
   - the Board Match and wave-range logic keeps working with the new numbers;
   - migrate saved demo boards (same ids).
5. **The 3D wave:** the demo shortboard (Inferno) is the default board in the wave scene if the current default is a demo board. The rider's 3 mm foot plant must still hold on each board.

## Rules
- Data honesty: no invented specs; unknown = blank/"typical". Never present the model as an exact replica.
- No licensed or downloaded images or meshes committed. The photos are for tracing, locally.
- Free ports (not 5180); stop servers; local commits only; never `git branch -D`.

## Acceptance
- Quiver showroom shots (1440 and 390, every view: ¾, deck, bottom, rail, tail, nose) for all four boards, next to the reference photos (a side-by-side sheet in the scratchpad `quiver-src/compare/`).
- tsc, tests (plus tests for the four boards' params) and build; journeys; t104/t062 (the wave's default board).
- A short note in the task board entry.
