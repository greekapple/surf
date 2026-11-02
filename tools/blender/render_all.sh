#!/bin/bash
# Render every wave-scale band (T-054): 24 orbit frames + poster into public/media/scale3d/<band>/.
# Face = band midpoint in metres (15+ uses 18 ft); curl grows with size (small waves crumble, big ones barrel).
set -u
cd "$(dirname "$0")/../.."
BL=/Applications/Blender.app/Contents/MacOS/Blender
SIZE=${SIZE:-1024x768}; SAMPLES=${SAMPLES:-32}
BANDS=${BANDS:-"4-6:1.52:0.75 1-2:0.46:0.1 2-3:0.76:0.3 3-4:1.07:0.5 6-8:2.13:0.9 8-10:2.74:1.0 10-15:3.81:1.0 15-plus:5.49:1.0"}
for b in $BANDS; do
  IFS=: read -r name face curl <<<"$b"
  out=public/media/scale3d/$name
  mkdir -p "$out"
  start=$(date +%s)
  "$BL" -b --factory-startup --python tools/blender/wave_scene.py -- --face "$face" --curl "$curl" --out "$out" \
    --surfer tools/blender/assets/surfer-v2.glb --size "$SIZE" --samples "$SAMPLES" > "/tmp/swello-render-$name.log" 2>&1
  echo "$name done in $(( $(date +%s) - start ))s, frames: $(ls "$out"/a*.jpg 2>/dev/null | wc -l)"
done
