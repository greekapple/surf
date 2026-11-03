#!/bin/bash
# wave-v3: rebuild the live viewer's per-bucket profile atlases (public/media/scale3d-atlas/<band>.bin + .json) from the licensed
# TurboSquid rows, and put the CC0 surfer where the viewer loads it. Both outputs are git-ignored: the atlas is licensed-derived
# (never commit it), the surfer copy is just a local copy of tools/blender/assets/surfer-v2.glb.
#   PROFILES=<dir with ond2.fbx/ond3.fbx> BANDS=4-6,8-10 BREAKER=plunging tools/blender/build_atlas.sh
set -eu
cd "$(dirname "$0")/../.."
BL=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
PROFILES=${PROFILES:-tools/blender/assets/turbosquid-1773957}
OUT=public/media/scale3d-atlas
mkdir -p "$OUT" public/media/scale3d-live
"$BL" -b --factory-startup --python tools/blender/wave_scene.py -- --profiles "$PROFILES" --atlas "$OUT" \
  ${BANDS:+--bands "$BANDS"} ${BREAKER:+--breaker "$BREAKER"} 2>&1 | grep -E '^ATLAS|Error|Traceback'
cp tools/blender/assets/surfer-v2.glb public/media/scale3d-live/surfer.glb
ls -l "$OUT"
