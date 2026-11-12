# wave-clean: the 3D wave's cross-sections drawn from scratch

Files: `clean-curves.json` (the data), `clean_source.py` (the design that writes it, and `CleanSource`, the drop-in source), output
`public/media/scale3d-clean/` (git-ignored for now, see the end). Viewer: `/forecast/wave-scale?...&atlas=clean`; the default is unchanged.

## Clean-room statement

The only licensed input to SWELLO's 3D wave was the three cross-section curves (hump, mid, barrel) that `wave_atlas.Source` samples from
the TurboSquid 1773957 mesh and that `proc_source.py` reads as splines traced from it (`tools/blender/assets/turbosquid-1773957/proc-curves.json`).
Everything downstream (`wave_atlas.stage_curves`: lip thickening, the throw, the ballistic fall, the foam ball, resampling, physics,
meta) is SWELLO's own code.

These curves were drawn without that input. While designing them, nothing under `tools/blender/assets/**` was opened, read, printed,
plotted or diffed, and neither was the shape data in `public/media/scale3d-atlas/` or `public/media/scale3d-proc/` (`.bin`/`.json`).
Only code that consumes the curves was read, to learn the contract. The rendered default and proc waves were seen only as finished
screenshots of the app (the side-by-side comparison), after the curves were designed and while they were being tuned.
The curves come from the formulas and verbal descriptions below and from tuning against the built clean atlas, the screenshots, and
cavity measurements taken on the clean atlas.

## The contract (from `wave_atlas.py` / `proc_source.py`)

- Three 16-point clamped uniform cubic B-splines, sampled at the same 82 stations. `chain(c)` blends control points linearly
  hump -> mid (c 0 .. 0.5) -> mid -> barrel (c 0.5 .. 1), so control point i plays the same role in all three.
- (y, z) normalised: trough-to-crest 1 (after blending), still water 0, y cross-shore (+ toward the beach), ordered sea -> beach, the
  crest near y = 0.
- These are crest-local shapes: `broaden_back` stretches the back seaward to 0.2 L_b (it assumes a source back of ~0.48 H), `wy` widens
  the small bands, `thicken_lip` / `throw_lip` / `fall_lip` turn the barrel row into the thrown, falling, landing tube, and
  `relax_face` caps the shoulder's face at 72 degrees. Scale (face height in metres) is applied downstream, so the face-height bands
  do not depend on these curves.

## Derivation

Units: the wave's trough-to-crest height H = 1. Each shape is a chain of 16 landmarks at fixed parameter values
`S = [0, .10, .22, .33, .40, .46, .515, .57, .625, .68, .735, .79, .845, .90, .95, 1]` (the same s in all three shapes: sea end,
two back points, crest at .33, nine front/curl points, trough, beach end). A cubic Hermite (Catmull-Rom tangents) runs
through them, and a least-squares fit gives the 16 B-spline control points (end points pinned). Most of the parameter goes to
the front (s .33 .. .90), because the curl needs the spline's resolution. The blend then moves every landmark in a straight line:
the hump's upper front face becomes the mid's vertical nose and then the barrel's lip, and the lower front face becomes the
barrel's inner wall.

**One short back for all three.** `broaden_back` expects a source back of ~0.48 H and stretches it by sb = 3..14 at the base.
The first draft used a 1.55 H back. That back took most of the atlas's 96 profile samples, leaving ~11 for the whole
crest-to-trough curl, and the test's face checks failed on the coarse curl. So every shape reaches still water at y = -0.8 and
rises through (-0.50, 0.25) and (-0.25, 0.68) to the crest at (0, 1).

**Hump (c = 0): a solitary-wave crest.** `z = sech^2(y / lam)` (the Boussinesq/KdV solitary wave; Munk 1949 used it for waves
near breaking), with no trough. Theory gives `lam = sqrt(4 h^3 / 3 H) = 1.67 H` at the breaking limit H/h = 0.78
(McCowan 1894). That is the far-field width; the pipeline adds the back length and the small-wave width itself. So the crest
region is drawn with `lam = 0.55 H` on the front (55 deg maximum slope; still water by y ~ 1.75) and `lam = 0.40 H` on the
back (still water by y = -0.8, before `broaden_back`). Each side is offset so it reaches 0 at its end. The result is rounded
and nearly symmetric.

**Mid (c = 0.5): steepened, leaning forward, starting to curl.** From the computed overturning sequence of Longuet-Higgins &
Cokelet (1976) and Peregrine's (1983) review "Breaking waves on beaches", as described in words:
- as a wave approaches overturning, the back keeps a moderate slope;
- the crest's highest point moves forward;
- the front face turns vertical high on the crest, then begins to overhang under a rounded nose;
- below that, the face is steep but not vertical.

Drawn as: a rounded nose, (0.13, 0.975), (0.215, 0.92) and (0.255, 0.85), turns the front vertical from z ~ 0.85 to 0.62
at y ~ 0.25, with a slight overhang (each landmark down to 0.72 H sits 0.005 H behind the one above). Below that it eases
to ~55-60 deg through (0.38, 0.32) and (0.50, 0.17). A shallow trough of 6% of H at y ~ 1.05 is the set-down ahead of a
steep crest.

The nose's five landmarks sit high (0.62-0.92 H) because they become the barrel's tip, underside and roof, so in the blend
they rise only a little. A first draft spread them down the face. They then rose ~0.3 H through the in-between rows and lay
flat on the way, leaving a shelf at ~0.75 H on the shoulder rows that caught the sky as a horizontal line at 12 ft.

**Barrel (c = 1): a plunging crest enclosing a tube.** Peregrine (1983) describes the plunge: the front becomes vertical, a jet
is thrown forward from the crest, falls under gravity and encloses an air tube; the jet is thin compared with the wave. Drawn as:
- the lip leaves the crest forward over (0.24, 0.995) and (0.46, 0.955);
- the tip is at (0.575, 0.85), about 0.57 H ahead of the crest and 0.85 H up;
- the lip is ~0.06-0.1 H thick at the source (`thicken_lip` and the throw's bulge thicken it with size downstream);
- the underside curls back under the tip (0.52, 0.82) to a roof at 0.90 H over (0.38 .. 0.20) H;
- the inner wall drops near-vertically through (0.05, 0.77), (-0.04, 0.53) and (-0.02, 0.28) to the foot at (0.11, 0.055);
- the trough is 6.5% of H at y 0.62.

This is the tube at the pitch, before SWELLO's throw. `throw_lip` / `fall_lip` carry the lip on out and down.

The roof, wall top, tip height and trough depth were last set by a small sweep (2 values each) against
`src/tests/wave-kink.test.ts`, the shared continuity gate. The roof must stay high enough that walking up the face never meets
the falling tip below 0.7 of the crest, the wall top low enough that the shoulder rows do not fold, and the tip low enough that
the board contact reads the open face's side correctly. Two of the 16 combinations pass (the sweep ran before the mid redraw described above; the test still passes after it). The chosen one has neighbours that fail
by a hair (a hump of 0.020-0.021 H against the 0.02 limit, a fold of 0.030-0.036 against 0.03), so the margin is thin.

**Tube proportions (measured on the built clean atlas, plunging rows, in crest heights).** Width is from the inner wall to the lip
tip; height is from the water under the tube to the roof. Literature describes the plunging "vortex" by its length:width ratio:
Longuet-Higgins (1982) proposed a constant ~2.75; Mead & Black (2001, J. Coastal Res. SI 29, 103-130) report a range across surf
breaks, with lower ratios for hollower, more intense tubes. The target was the hollow end, ~1.5-2.
Mead & Black's full text was not available here, so the range is taken from secondary summaries; a later ICCE paper finds the
ratio hard to predict from standard breaker parameters.

| band | pitch row (stage 4) w:h | stage 5 w:h | roof (crest heights) |
|---|---|---|---|
| 3-4 | no tube (the lip never encloses a cavity) | no tube | - |
| 4-6 | 0.92 | 1.17 | 0.76-0.79 |
| 6-8 | 1.29 | 1.52 | 0.92 |
| 8-10 | 1.28 | 1.52 | 0.91 |
| 10-15 | 1.44 | 1.73 | 0.81 |
| 15-plus | 1.41 | 1.77 | 0.77-0.81 |

The 4-6 band's ratio stays low because `throw_lip`'s hollow ramps in there (a cover-up rather than a tube).

## Sources

- Munk, W. H. (1949). The solitary wave theory and its application to surf problems. Ann. N.Y. Acad. Sci. 51, 376-424.
- McCowan, J. (1894). On the highest wave of permanent type. Phil. Mag. 38, 351-358 (H/h = 0.78).
- Longuet-Higgins, M. S. & Cokelet, E. D. (1976). The deformation of steep surface waves on water. I. A numerical method of
  computation. Proc. R. Soc. Lond. A 350, 1-26.
- Peregrine, D. H. (1983). Breaking waves on beaches. Annu. Rev. Fluid Mech. 15, 149-178.
- Longuet-Higgins, M. S. (1982). Parametric solutions for breaking waves. J. Fluid Mech. 121, 403-424.
- Mead, S. & Black, K. (2001). Predicting the breaking intensity of surfing waves. J. Coastal Res. SI 29, 103-130.

## Rebuild

    PY=/Applications/Blender.app/Contents/Resources/5.2/python/bin/python3.13   # or any Python with numpy
    $PY -I tools/blender/clean_source.py curves                                 # design -> clean-curves.json
    $PY -I tools/blender/clean_source.py public/media/scale3d-clean             # clean-curves.json -> the 32 atlas files

## Status of the outputs (lead decides)

The atlas built from these curves has no licensed input, so it could be committed and served from the public build
(`scripts/build-cloudflare.mjs` already lets `media/scale3d-clean/` through; it filters only the licensed folders). For now
`public/media/scale3d-clean/` is git-ignored like the other atlases: only the code, the curves and this document are committed.
Making clean the default would mean committing the 32 files (~18 KB each), dropping the ignore line and pointing `ATLAS_ROOT` at
`media/scale3d-clean/`.
