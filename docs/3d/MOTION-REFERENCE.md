# Surfer motion reference (round 4, 2026-11-04, Fable)

The reference study behind spec `docs/specs/2026-11-04-3d-surfer-realism.md` §A1 and its Appendix M. Angles were read off the frames
listed below (a protractor on the still, so ±8° at best) and cross-checked against coaching text. The images themselves stay in the session
scratchpad (`wave/refs-motion/`, `wave/refs-surfer/`, `wave/realism/refsheet.png`): third-party frames, never committed. True Surf is a
benchmark for animation quality only; nothing of it is copied.

Conventions (as in Appendix M): knee flexion 0 = straight; hip flexion 0 = upright; torso pitch = forward lean from vertical; the board frame
x = nose, y = up off the deck, z = toe side. Our model is goofy (right foot and right arm forward); the viewer mirrors it for backside.

## Sources
| Id | What | Where | Licence / use |
|---|---|---|---|
| TS-B3 | True Surf gameplay, 0:03: a low, compressed bottom turn, arms low and forward | https://www.youtube.com/watch?v=dtyDBMdLJwM (frame `truesurf-B-03s-*.png`) | comparison only |
| TS-B6 | True Surf, 0:06: the lip throwing a curtain, the tube forming | same video (`truesurf-B-06s-*.png`) | comparison only |
| TS-B12 | True Surf, 0:12: rider tucked deep inside the tube, side view | same video (`truesurf-B-12s-*.png`) | comparison only |
| TS-B15 | True Surf, 0:15: coming out of the barrel, standing taller | same video (`truesurf-B-15s-*.png`) | comparison only |
| TS-A12 | True Surf "WSL perfect 10 Pipeline", 0:12: the empty tube from the side | https://www.youtube.com/watch?v=1YDP5gGO72U (`truesurf-A-12s-*.png`) | comparison only |
| TS-A16 | True Surf Pipeline, 0:16: rider deep in the tube | same video (`truesurf-A-16s-*.png`) | comparison only |
| R-BT | Jeff Rowley, Jaws, bottom turn at the foot of a 15 m face | https://commons.wikimedia.org/wiki/File:Jeff_Rowley_Big_Wave_Surfer_Bottom_turn_Photo_Jaws_Peahi_by_Xvolution_Media_-_Flickr_-_Jeff_Rowley_Big_Wave_Surfer.jpg | CC BY 2.0 |
| R-CB | USFWS frontside cutback | https://commons.wikimedia.org/wiki/File:Surfer_maneuvers_a_front_side_cutback_to_generate_more_speed_on_a_wave.jpg | public domain |
| R-SN | Santa Cruz snap (top turn) | https://commons.wikimedia.org/wiki/File:Surfer_in_california_2.JPG | CC BY-SA 3.0 |
| R-TR | Newport trim (Unsplash) | https://commons.wikimedia.org/wiki/File:Riding_the_rolling_wave_(Unsplash).jpg | CC0 |
| R-TI | Santa Cruz trim under the lip | https://commons.wikimedia.org/wiki/File:California_surfer_inside_wave.jpg | CC BY-SA 3.0 |
| C-CE | Rapture Camps, "Compression and extension" | https://www.rapturecamps.com/learn-to-surf/surf-maneuvers/compression-and-extension | coaching text |
| C-BT | OMBE, "How to bottom turn" | https://www.ombe.co/guides/bottom-turn-surfing | coaching text |
| C-LIP | Surf Simply, "3 ways to hit the lip" | https://surfsimply.com/magazine/3-ways-to-hit-the-lip | coaching text |
| C-PD | Carve, "Backhand barrel riding" (pig-dog) | https://www.carvemag.com/?p=10722 | coaching text |
| C-PD2 | Stab, "Your backside tuberiding is likely all wrong" (Jordy Smith) | https://stabmag.com/style/technique-your-backside-tuberiding-is-likely-all-wrong/ | coaching text |
| C-BR | Rapture Camps, "Barrel riding basics"; Hawaiian South Shore "Riding the barrel" | https://www.rapturecamps.com/blog/barrel-riding-basics · https://www.hawaiiansouthshore.com/blogs/the-ultimate-surfers-how-to-guide/how-to-surf-better-part-5-of-9-riding-the-barrel | coaching text |
| P-JB | "A qualitative analysis to determine the critical features of a frontside bottom turn in professional surfing" (199 turns, J-Bay 2017) | abstract via library index (full text not reached) | qualitative only |

Searched and not found: a peer-reviewed table of knee/hip angles per manoeuvre. A 2025 scoping review of surfing biomechanics notes the
research is "limited in volume" (repositorio.ulisboa.pt). The Lisbon coaching dissertation on the bottom turn defines knee and hip
flexion-extension as observation items without numeric thresholds. So the numbers below are frame readings plus coaching rules of thumb.

## Reference sheet per move (what the frames show; the numbers we key to)
| Move | Frames | Knees (front / back) | Hips / torso | Arms | Head | Timing |
|---|---|---|---|---|---|---|
| Takeoff / pop-up | TS-B3 (just after), C-BT | 60–75 / 70–85 on the drop, extending to trim | hips 40–50°, torso 25–35° fwd, weight centred then back | both forward-low for balance, hands at hip to chest height, never above the shoulders | down the line | 0.6–1.0 s (beginner 1.2–1.6 s, a knee down first) |
| Trim | R-TR, R-TI, TS-B15 | 35–50 / 45–60 | hips 20–30°, torso 10–20° fwd | front hand low in front over the front foot, back hand low behind the hip; elbows 20–40° | level, 20–40° ahead of travel | continuous; ±5° knee micro-flex at 0.5–1.5 Hz |
| Bottom turn (frontside) | TS-B3, R-BT, C-BT | 75–90 / 85–100 at the apex | hips 50–65°, torso 30–40° into the face, leaning in up to ~45° on a big wave | front arm pointing down the line at or below shoulder height; back hand low by the hip, may skim the water (C-BT "bring your inside hand lower") | at the lip target, turning 0.2 s before the hips | 0.6–1.0 s; deepest compression at the apex (C-CE "compress at the base, extend through the arc") |
| Bottom turn (backside) | C-BT (backside notes) | same | the back to the wave, shoulders open to the face, "shoulders square" | front arm leads over the toe rail toward the wave, back hand low near the heel rail | over the leading shoulder | same |
| Top turn / snap | R-SN, R-CB, C-LIP | 30–45 extended, then 50–65 recompressing | torso twisted toward the beach 45–60°; weight on the tail ("80% from the back foot", C-LIP) | front arm sweeps from up-the-face to down-the-line at about shoulder height (the one brief rise; C-LIP's "throws" are fast, not held); back arm low | at the landing | 0.4–0.7 s |
| Cutback | R-CB | 50–70 | torso rotates 120–180° toward the curl over 1.0–1.6 s; R-CB shows the trailing arm thrown wide at shoulder height, not above it | front arm leads around at chest height, back arm low/wide | leading toward the curl | 1.0–1.6 s, a 0.2 s compress on the rebound |
| Pump | R-TR between turns | 45 ± 15 at 1.2–2 Hz | hips ± 10°, weight forward on the down-pump | quiet, ≤ 10 cm counter-move | down the line | rhythmic |
| Barrel stance, frontside crouch | TS-B12, TS-A16, C-BR | 90–110 / 100–120 | hips 70–90°, torso 35–55° and compact ("bend at the knees, not the waist") | front arm low and forward toward the exit ("a sensor"); back hand drags the face to stall (≤ 1.5 s) | up, eyes on the exit, head ducked under the lip | 0.8–3 s inside |
| Barrel stance, backside pig-dog | C-PD, C-PD2 | front 80–100 / back 100–130 (the back knee dropped) | twisted to face the exit, shoulders as square to the wave as comfortable | leading hand down on the toe-side rail (C-PD "grab the rail"); Jordy Smith: the leading arm reaches forward "never placed into the wall", "lower in the wall, not necessarily up high"; back arm low | over the leading shoulder, eyes on the exit | same |
| Kick-out | TS-B15 | 25–40 rising | torso upright | arms relax down | over the shoulder | 0.5–0.8 s |

## Where the frames disagree with Appendix M (and what we did)
- **Cutback arm height.** R-CB (a real cutback) has the trailing arm at shoulder height, fully extended sideways, hand roughly level with the
  head; Appendix M keeps the back arm "low". We keep the back arm low (the gate: wrists below the shoulders) and let only the front arm lead at
  chest height; the wide trailing arm would trip the arm gate and the user's complaint, so the "wrong" is on purpose.
- **Trim knee angle.** The coaching rule "knees past 90° on every major compression" (C-CE) applies to turns, not trim; R-TR and TS-B15 show
  soft knees of ~40°. We use 45° (spec 35–55°).
- **Stance width.** M1 says 45–55 cm; R-TR, R-SN and TS-B3 all read nearer 60–70 cm ankle to ankle for a ~1.75 m rider (the back foot over
  the fins, the front foot just ahead of centre on a 6'0"). We use 0.70 m (front foot at −0.08 L, back at +0.30 L) and note it as a deviation.
- **Pig-dog hands.** Carve (older) has the trailing hand on the rail and the leading arm reaching back into the face; Stab/Jordy Smith (newer)
  has the leading arm forward as a guide and no wall arm. Appendix M says the leading hand grabs the toe-side rail. We follow M (rail grab with
  the leading hand), the back arm low: both readable from the side and inside the arm gate.
- **Front-arm rise in the snap.** C-LIP's "wrap" throws the leading arm "up to 12 o'clock"; M allows shoulder height for ≤ 0.3 s. We cap at
  shoulder height (the gate) and never hold it.

## Timing read from the True Surf clip (dtyDBMdLJwM, 0:00–0:16)
0:00 takeoff and first bottom turn → 0:03 apex of the compressed bottom turn (arms low, forward) → 0:06 the lip throws, the rider stalls high
→ 0:08–0:14 inside (crouched, the board flat, the head under the lip) → 0:15 standing taller on the exit. Transitions are 0.3–0.6 s, there is no
held pose; the head barely moves against the horizon while the board and hips do the turning. That is the smoothness bar for M3.

## How the keys map to the clip (`tools/blender/build_surfer.py` POSES, 24 fps)
trim f1 · bottom f26 · climb f42 · top f58 · recover f70 · pump f82 · barrel (frontside crouch) f100 · pigdog f112 · trim f124. The viewer
samples these keys once (`POSE_KEYS`) and blends them with the simulation's cross-fades; the board is flat in every key.
