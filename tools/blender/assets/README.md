- `surfer.glb`: to-scale surfer on a shortboard (AI-generated: Higgsfield `image_to_3d` from image job 205398fd, textured + PBR, ~60k tris, 30 credits, 2026-10-31). Raw height 1.85 m incl. board; `wave_scene.py --surfer` rescales to 1.75 m. Illustration only, not a real person.
- `surfer-preview.png`: Eevee render of it.

- `surfer-v2.glb`: MPFB2 human (CC0 output, MakeHuman for Blender), rigged and posed by `build_surfer.py` in a bottom-turn crouch on a procedural 6'0" shortboard, black full wetsuit. True scale (1.75 m standing), nose at -x, facing -y; `wave_scene.py` mirrors it into a regular-foot backside stance. Replaces the AI surfer (which faced the board nose). 2026-11-02.

## Live wave profile atlas (wave-v3)
- `tools/blender/build_atlas.sh` rebuilds every bucket's break-cycle atlas into `public/media/scale3d-atlas/<band>.bin` + `.json` and copies `surfer-v2.glb` to `public/media/scale3d-live/surfer.glb` (both git-ignored). Needs the licensed `turbosquid-1773957/ond2.fbx` and `ond3.fbx` in this folder (or `PROFILES=<dir>`); takes ~20 s. Options: `BANDS=4-6,8-10`, `BREAKER=spilling|plunging` (forces one breaker type for every bucket).
- The atlas is **licensed-derived** (TurboSquid rows HUMP=ond3[125], MID=ond2[70], BARREL=ond2[15]): never commit it. The maths is in `tools/blender/wave_atlas.py`: 12 stages x 96 arc-length points, float16 (y, z, thin, foam) + (thickness, arc, normal), 18 KB per bucket. Per-bucket physics (break at H = 0.78 x depth, bed slope, period, peel angle) is in its `BANDS` table and in each `.json`.
- Without the atlas files the 3D view falls back to the pre-rendered spin (Spin360).
