# Riding surfer references (2026-11-03, spec `docs/specs/2026-11-03-wave-surfer-follow-up.md`, Track A)

Real photos the `ride` clip's poses are keyed against (`tools/blender/build_surfer.py`, `POSES`). The images live only in the session
scratchpad (`wave/refs-surfer/`), never in the repo: they are third-party photos, used for comparison only. Licences are noted so a
future public reference page knows what it may show.

| Move | File (scratchpad) | Source | Licence | What to match |
|---|---|---|---|---|
| Bottom turn | `refs/blacks-bottom-turn.jpg` | surf photo (Blacks, from the earlier wave-look session) | unknown (comparison only) | Compressed low, hips over the back foot, chest to the wave, the trailing hand dragging the water, the leading arm pointing down the line, the board on its toe rail with the deck toward the face, spray off the tail. |
| Bottom turn (scale) | `refs-surfer/bottom-turn-rowley-jaws.jpg` | https://commons.wikimedia.org/wiki/File:Jeff_Rowley_Big_Wave_Surfer_Bottom_turn_Photo_Jaws_Peahi_by_Xvolution_Media_-_Flickr_-_Jeff_Rowley_Big_Wave_Surfer.jpg (Xvolution Media / Jeff Rowley) | CC BY 2.0 | Rider tiny at the foot of a 15 m face, well ahead of the foam: the line of a ride on a big wave. |
| Top turn / cutback | `refs-surfer/cutback-usfws.jpg` | https://commons.wikimedia.org/wiki/File:Surfer_maneuvers_a_front_side_cutback_to_generate_more_speed_on_a_wave.jpg (Steve Hillebrand, USFWS) | Public domain | Extended on the back leg, the board turned toward the beach on its heel rail, the trailing arm swung high leading the shoulders, the head looking back at the pocket, a fan of spray off the tail. |
| Snap (top turn) | `refs-surfer/snap-santacruz.jpg` | https://commons.wikimedia.org/wiki/File:Surfer_in_california_2.JPG (Brocken Inaglory) | CC BY-SA 3.0 | Knees bent, weight back over the tail, both arms low for balance, the board pivoting under the body; the spray fan is the whole tail throwing water. |
| Trim | `refs-surfer/trim-newport-unsplash.jpg` | https://commons.wikimedia.org/wiki/File:Riding_the_rolling_wave_(Unsplash).jpg (Austin Neill) | CC0 | Mid-height on the face just ahead of the pocket, knees soft, hands low and loose, looking down the line; the board flat on the face, nose slightly down the line. |
| Trim (inside) | `refs-surfer/trim-santacruz-inside.jpg` | https://commons.wikimedia.org/wiki/File:California_surfer_inside_wave.jpg (Brocken Inaglory, edit Kallerna) | CC BY-SA 3.0 | Crouched under the lip, the leading arm out at shoulder height pointing the line, back arm back, the board angled across the face. |
| Top turn (coaching) | `refs-surfer/top-turn-balicamp.jpg` | https://www.balisurfingcamp.com/blog/frontside-top-turn | copyright Bali Surfing Camp (comparison only) | The lift: decompressed on the climb, the trailing arm around, the nose through the lip. |
| Whole ride | `refs/ob-foster-wave.jpg`, `refs-drone/t30-surfer-whitewater-line.jpg` | Ocean Beach photo; WSL Teahupo'o 360 drone (https://www.youtube.com/watch?v=7U177XxGm40) | comparison only | The rider's line relative to the whitewater: always ahead of the foam line, on the open face. |

## Technique notes applied (coaching sources)
- Bottom turn: compress onto the back leg, lean the upper body toward the face, lead with the front arm, trailing hand toward the water for
  rotation; too much front-foot weight stalls the board (Barefoot Surf Travel, Red Bull "how to bottom turn", Ombe).
- Top turn: decompress on the climb, swing the trailing arm to lead head, shoulders and hips into the heel-side carve, then compress and
  shift forward to come back down (Bali Surfing Camp "frontside top turn").

## Pose keys (24 fps, 96-frame loop; round 3, wave-round3)
The board is flat in every key: its heading, pitch and bank come from the viewer's ride line (`WaveLive.tsx` RIDE_WP, the same phases as these
frames), so the poses are the body relative to the deck. Six distinct keys and no holds, so the clip is always moving.

| Frame | Phase | Pose | Hips (height x standing, x toward tail, y toward wave) | What it matches |
|---|---|---|---|---|
| 1 / 97 | 0 | trim | 0.68, +0.14, -0.03 | Newport / Santa Cruz inside: knees soft, lead hand low in front, trailing hand low behind, looking down the line |
| 26 | 0.26 | bottom | 0.52, +0.28, -0.20 | Blacks: deep crouch over the back foot, chest to the face, trailing hand to the water, lead arm pointing the line |
| 42 | 0.43 | climb | 0.66, +0.22, -0.10 | Bali coaching "the lift": extending, shoulders opening toward the beach, lead arm rising |
| 58 | 0.6 | top | 0.74, +0.28, +0.04 | USFWS cutback / Santa Cruz snap: tall over the tail, torso twisted toward the beach, trailing arm swung up and round |
| 70 | 0.72 | recover | 0.55, +0.18, -0.06 | compressed landing, both arms low, head back down the line |
| 82 | 0.84 | pump | 0.60, +0.10, -0.05 | a small compress between trims |

Viewer layers on top of the clip (all on critically damped springs): the head and shoulders lead the heading by 0.2 s, the arms counter the
lean, and on the steepest part of the face the torso counters the deck tilt beyond 42 deg (the board goes near-vertical with the legs, the
body stays up over it).

## Real ride strip
`Surfing contest - oahu hawaii - north shore - oct 2015.ogv` (Wikimedia Commons, CC BY-SA 4.0), frames 2.4 s to 4.9 s at 0.5 s: the
6-frame strip our default view is compared with (scratchpad `wave/round3/strips-ours-vs-real.png`).
