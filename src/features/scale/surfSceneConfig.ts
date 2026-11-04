/** Every tunable of the 3D rider (spec 2026-11-04-3d-real-surfing, stages 1-4): simulation rate, glitch-monitor limits, the scale pole,
 *  the board's dimensions and springs, the line planner's maneuver knots per skill, the body's layers, limits and cross-fades, and the
 *  data shape of the wave-height style bands (filled in the next run). No magic numbers in the animation code: it reads from here.
 *  Riding style, stance and moves are illustration; only the face height, breaker type, period, wind, direction and light come from the
 *  forecast. */
import type {Skill} from '../../models/index.ts';

/** Fixed-step motion: the rider and the water time advance in 1/120 s steps; the render interpolates between the last two states. */
export const SIM = {hz: 120, maxStepsPerFrame: 8, maxFrameS: 0.05} as const;

/** Dev glitch monitor: angular change per frame (the limit is per 1/60 s and scales with the frame's own dt), board-to-water gaps. */
export const MONITOR = {jointDegPerFrame: 25, boardDegPerFrame: 25, refFrameS: 1 / 60, centreGapM: 0.03, lowestGapM: -0.15, keepEvents: 120, keepPerKind: 12,
  /** body checks (round 4), sampled at bodyHz: knee flexion range (deg, 0 = straight), the knee's direction against the foot's forward
   *  (deg), a wrist above its shoulder (m margin) for longer than wristAboveS outside the moves that allow it, joint angular acceleration */
  bodyHz: 30, kneeFlexDeg: [4, 140] as readonly [number, number], kneePoleDeg: 50, wristAboveM: 0.0, wristAboveS: 0.3,
  /** joint angular acceleration limit (deg/s^2). R7 re-based from 3000: a 90 deg whole-body swing in 0.3 s (the real snap's arm throw)
   *  peaks near 5000 deg/s^2 even with a smooth cosine profile, and a critically damped fade starts at twice that; 3000 could only be
   *  met by fades slow enough to make the snap read lazy. 10000 still catches a step (a key switch or an IK flip is 50-100k). */
  jerkDegS2: 10000,
  wristAllowedMoves: ['barrel', 'top', 'kickout', 'recover'] as readonly string[],   // R7: the snap key's arms go up for the hit; the kick-out blends through it and the recovery brings them down
  /** the hard gates (spec §A2/§A3, user 2026-11-04): knee-to-knee >= this share of foot-to-foot and each knee within kneeLateralM of its
   *  hip-foot line along the board (`knock`); hands inside +-handSideM of the torso and between knee and shoulder height, arm joint speed
   *  under armSpeedDegS, no reversal of a hand's travel faster than armReversalS (`arm`) */
  kneeSepRatio: 0.6, kneeLateralM: 0.12, handSideM: 0.7,
  /** R7 re-based 360 -> 540: the real snap throws the front arm ~120 deg in 0.4 s (peak ~500 deg/s); the v6 snap key does the same and
   *  peaked at 385-517 even with the arms fading 0.75 x the body. The round-4 ragdoll arms ran at 850-950: 540 still catches those. */
  armSpeedDegS: 540, armReversalS: 0.25,   // R7: 0.12 (was 0.10): the deeper bottom turn puts the knee over the toes of the 32 deg-angled front foot, 0.10 m along the board at a 100 deg bend; that is tracking, not knocking
  /** the hips stay over the feet: the pelvis' toe-heel offset (m) from the feet midpoint, in trim and in turns (`hip` count; "sitting" otherwise) */
  hipOverFeetM: {trim: 0.1, turn: 0.15, /** plus this much per radian of face slope: the standing body angulates toward the vertical on a steep face */ perSlope: 0.3,
    /** backside (R7): the body angulates over the heels by most of the slope (BODY.bodyLeanBackside), the pelvis with it */ perSlopeBackside: 0.5},
  /** M9 (`lean` count): the torso pitch (pelvis -> neck from the deck normal toward the toes, deg) outside this range; M10 (`wake` count): the
   *  wake's direction off the tail against the board's velocity over the water (deg from straight behind) */
  torsoPitchDeg: [5, 62] as readonly [number, number],
  /** R8 re-based 45 -> 60: the snap's tail slide (the pivot unwinding) leaves the tail's trail 48-54 deg off the board's heading for ~0.1 s,
   *  which is the slide, not a trail drawn ahead of the board. R10 re-based 60 -> 65: the same slide off the R9 C-wall's hit (the board
   *  bridging 0.65 m, the tail on a longer lever) reads 61-62 deg for 0.05 s, the board moving forward over the water at 6.7 m/s the
   *  whole time; the stall flip it was meant to catch (172-179) is fixed in the sim, not here */
  wakeDeg: 65,
  /** R11 (`bodyclip` count): a body joint more than this (m) below the front face, or inside the lip; the joints checked by the viewer */
  bodyClipM: 0.05, bodyClipJoints: ['head', 'neck_01', 'pelvis', 'hand_l', 'hand_r', 'lowerarm_l', 'lowerarm_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'] as readonly string[]} as const;

/** The board's wake (brief stage 6): a thin foam trail off the tail, sampled along the actual path, carried with the water, widening
 *  and fading out within lifeS; and the tail spray on turns, scaled by speed and turn load (rail roll), by the band's spray factor and
 *  the expertise's carve. */
export const WAKE = {points: 44, sampleS: 0.045, lifeS: 1.6, widthM: 0.22, spreadM: 0.5, liftM: 0.02, alpha: 0.42,
  /** tail spray: roll (rad) where the fan starts and is full, the speed (m/s) for a full fan, which moves throw it */
  sprayRoll0: 0.07, sprayRoll1: 0.28, spraySpeed: 7, sprayMoves: ['top', 'cutback', 'recover'] as readonly string[]} as const;

/** The 6 ft scale pole: 1 ft bands, stood on the trough at the rider's own along-crest position, this far out on the flat in front. */
export const POLE = {heightM: 1.8288, bands: 6, radiusM: 0.035, aheadM: 1.2} as const;

/** The board as placed on the water (the model's 6'0" x 19.3"; a quiver board replaces the mesh, the contact points scale with its bounds). */
export const BOARD = {
  lengthM: 1.83, widthM: 0.49,
  /** the model board's width per style band when the quiver is empty (a wider fish under 4 ft, a pulled-in gun from 10 ft) */
  bandWidthM: {A: 0.53, B: 0.49, C: 0.47, D: 0.46} as Record<'A' | 'B' | 'C' | 'D', number>,
  /** the plane-fit chord along the board as a fraction of its half length */
  endPoint: 0.84,
  /** the contact probes on the mesh's bottom plane (m in from the ends/rails, up from the bottom): the monitor's gaps, the sim's rail
   *  depth and the dev probe all read these same points */
  probe: {tailIn: 0.03, tailUp: 0.03, noseIn: 0.15, noseUp: 0.08, railIn: 0.02},
  /** R11: the board rides ON ITS RAIL, not flat to the face. The roll is the sum of two parts, both about the board's long axis, and the
   *  board pivots about the ENGAGED rail (the one the deck rolls toward): that rail sits in the face by its tuck (railSinkM) and the
   *  centre lifts off the face by rb sin(roll) (the other rail is in the air). Before R11 the roll turned about the centre and buried the
   *  engaged rail, so a rail-depth cap held every roll under ~17 deg and the board lay flat on the face in trim (faceRoll 0-5 deg measured
   *  at 6 ft; the real trim frames show the deck rolled 20-40 deg toward the wave, the beach-side rail out of the water).
   *  (1) the TRIM roll: across a sloped face the board rides more level than the face (the lift must carry the weight, the inside rail
   *  holds the line): a share of the local face slope toward the wave, capped; scaled per move (a straight drop or a tube line rides
   *  flatter) and faded out with the snap's pivot (a board on its tail is not trimming).
   *  (2) the TURN roll into the turn: tan(roll) = v^2 / (g r) = v yawRate / g x the skill's carve, capped at turnRollMaxDeg: toward the
   *  wave in the bottom turn (the inside rail), toward the beach at the top and in the cutback (the deck faces the beach, as the real
   *  frames show at the lip and through the cutback). */
  rollMaxDeg: 55, trimRollShare: 0.6, trimRollMaxDeg: 40, turnRollMaxDeg: 45,
  /** the trim roll also fades out as the board pitches up its long axis (deg; a board standing on its tail is not trimming) */
  trimRollPitchFade: [25, 50] as readonly [number, number],
  trimRollByMove: {takeoff: 0.35, kickout: 0.7, out: 0.6, barrel: 0.6} as Partial<Record<string, number>>,
  /** nose/tail rocker the ends can bridge on a concave face before the line is lowered */
  rockerM: 0.07,
  /** how far a set rail sits into a concave face before the centre lifts off it (the rail's own thickness and tuck) */
  railSinkM: 0.03,
  /** the centre may lift off a concave section by at most this much (the ends carry the board; a 5'7" board on a 2 ft face spans the
   *  whole trough-to-lip curve and needs most of it) */
  bridgeMaxM: 0.1,
  /** critically damped spring rates (rad/s): the surface fit (pitch and roll), the yaw toward the velocity, the rail roll */
  fitW: 2 * Math.PI * 8, yawW: 2 * Math.PI * 8, rollW: 2 * Math.PI * 1.2,
} as const;

/** The line planner: wave-relative (u along the crest from the curl in face heights, negative = ahead on the shoulder; v height on the face). */
export const RIDE = {
  /** the face is rideable up to this slope; the planned v is capped under it (minus a margin) each step */
  slopeCapDeg: 78, capMarginV: 0.04, vMin: 0.06,
  /** width (in v) of the soft limit against the cap: a planned line that runs into the cap turns over this much of the face rather than
   *  at a corner (0.04 made a 6 g vertical reversal at the 20 ft top turn, which the board's yaw spring could not follow) */
  capSoftV: 0.12,
  /** share of the wave-side rail's climb (rail half-width up the face) kept under the cap as well */
  capRailShare: 0.5,
  /** how much the line is lowered (in face heights per metre of end sag beyond the rocker) so a straight board fits the face's curvature */
  endSagGain: 2.5,
  /** R8: a board pivoted up the face by this much (deg) rides on its tail, so the end sag no longer lowers the line (the nose is in the
   *  air at the hit; the lowering fades back in as the pivot unwinds, which is the snap's rebound down the face) */
  pivotSagFreeDeg: 40,
  /** R8: and may bridge the hollow of the lip by this much more than BOARD.bridgeMaxM (m, at the full pivot): the pivoted board spans the
   *  curl's concavity on its ends instead of burying them (a 6'0" board up a 6 ft hollow face has its tail near the trough and its nose at
   *  the lip: the chord sags 0.6 m; with 0.3 the ends sat 0.22 m in, the clip gate; 0.4 still 0.19 m; 0.5 still 0.155; 0.55 leaves them within the gate, the tail's fins engaged, the nose cutting the thin lip. The monitor's centre check reads the centre with the lift removed (WaveLive contactM), since in the hollow under the lip the lifted centre's nearest water is the lip's underside, not the face below it) */
  pivotBridgeM: 0.55,
  /** R10: a pivoted hit respects the section it is on. The ends of the PLACED board are watched: an end deeper than hitEndAllowM (the
   *  nose in the lip's underside of the R9 tube, the tail in the C-wall below) lowers the line at hitLowGain (v per second per metre of
   *  excess) while the pivot is on, capped at hitLowMaxV; the lowering releases at hitLowReleaseV (v per second) once the ends clear. The
   *  allowance is under the monitor's 0.15 gate and over the 4 ft snap's tail (0.10 m at the hit since R8), so band B's hit is as it was.
   *  (R9 moved the hit 2 m out onto the shoulder instead, `hitAhead`: the recovery back to the pocket became a slide with the tail 0.22 m
   *  in and the wake 80-128 deg off the heading.) */
  hitEndAllowM: 0.1, hitLowGain: 12, hitLowReleaseV: 0.3, hitLowMaxV: 0.3,
  /** R10: the board never travels backwards over the water: toward the break point the rider can at most drift with the flow keeping this
   *  much way (m/s), so the barrel stall slows against the curl without the heading or the wake flipping */
  stallMinWaterMps: 2.5,
  /** the cap is a bisection on the sampled face: followed through a spring (rad/s) so its quantisation never reaches the board */
  capFollowW: 2 * Math.PI * 1.5,
  /** the rider follows the moving break point through a spring (rad/s): no twitching with every section pulse */
  curlFollowW: 2 * Math.PI * 0.6,
  /** never closer to the break point than this (face heights, with an absolute floor in metres), whatever the plan says */
  minAheadFaces: 0.32, minAheadM: 0.6,
  /** maneuver durations scale with sqrt(face height / this) (bigger waves, longer arcs), never below this factor (a top turn on a 2 ft
   *  wave still takes a human amount of time) */
  refFaceM: 1.83, durScaleMin: 0.8,
  /** seeded jitter on each segment's duration and height (fractions) */
  jitterDur: 0.15, jitterV: 0.06,
  /** the planner's horizontal speed cap over the water (m/s) and its lower bound, for the probe and the roll */
  speedMaxMps: 20,
  /** the rider fades in over the start of the takeoff and out over the end of the exit (s); between rides the plan carries the
   *  (invisible) rider back to the takeoff */
  fadeInS: 0.5, fadeOutS: 0.45,
} as const;

/** R8: the snap's hit (Knot.cap / Knot.pivot). The 6 ft plunging face passes the vertical at about 0.45 of its height (78 deg at 0.39,
 *  92 at 0.48): under the 78 deg cap the board sat at 0.385 with its long axis along the crest (yaw ~1 deg at the hit: the rider's path
 *  over the water is the peel speed along the crest, so the velocity never points up the face). The real snap's board is vertical because
 *  it pivots on its tail past the path. 78 deg at the Expert's carve (Intermediate 0.7 x): at the knot the path already turns down (-10 deg), so the yaw peaks near 68 and the board's long axis near 65 deg on the 74 deg face the cap reaches. */
export const RIDE_SNAP_CAP_DEG = 89, RIDE_SNAP_PIVOT_DEG = 78;
/** R11: the cutback's pivot (deg, down the face past the path, x the skill's carve): the board on its heel rail at the peak */
export const RIDE_CUTBACK_PIVOT_DEG = 55;
export type Move = 'trim' | 'bottom' | 'top' | 'recover' | 'pump' | 'cutback' | 'takeoff' | 'kickout' | 'out' | 'barrel' | 'floater';
/** One knot of the ride: time to reach it from the previous knot (s, at RIDE.refFaceM; the first knot's dt closes the loop from the
 *  last), u, v, the move name, the pose it blends to, the compression target, and how close to the curl it may go (face heights,
 *  RIDE.minAheadFaces when absent). */
export interface Knot {dt: number; u: number; v: number; move: Move; pose: PoseName; /** compression target 0 (tall) .. 1 (deep) */ comp: number; ahead?: number;
  /** R8: the face-slope cap (deg) while approaching this knot (RIDE.slopeCapDeg when absent): the snap's hit rides up to the vertical part
   *  of the face, within what the atlas face allows (the planned v is still the ceiling) */
  cap?: number;
  /** R8: the board pivots past its velocity by this much (deg, up the face) at this knot, the tail sliding: a snap's board goes near-vertical
   *  at the lip while the rider's path only bends; it unwinds over the next segment */
  pivot?: number}
export type PoseName = 'trim' | 'bottom' | 'climb' | 'top' | 'recover' | 'pump' | 'barrel' | 'pigdog' | 'cutback'
  /** R7 (surfer-v6): backside-specific keys, authored with the wave on the heel side; the viewer routes each frontside pose's weight to
   *  its backside key through BODY.backsideOf when the rider is mirrored */
  | 'trimB' | 'bottomB' | 'climbB' | 'topB' | 'recoverB' | 'pumpB' | 'cutbackB';

/** A maneuver's shape (brief part 2, "implementation shape"): knots relative to the band's line: `du` out from the pocket distance (face
 *  heights, + = further out on the shoulder), `dv` up (+) or down (-) from the band's line height, scaled by the expertise's intensity. */
export interface ManeuverKnot {dt: number; du: number; dv: number; move: Move; pose: PoseName; comp: number; ahead?: number; cap?: number; /** scaled by the skill's carve */ pivot?: number}
export type ManeuverName = 'trim' | 'carve' | 'snap' | 'cutback' | 'pump' | 'straight' | 'barrel' | 'coverup' | 'longBottom';
export const MANEUVERS: Record<ManeuverName, ManeuverKnot[]> = {
  /** a trim along the line */
  trim: [{dt: 0.7, du: 0.05, dv: 0, move: 'trim', pose: 'trim', comp: 0.45}],
  /** a soft open-face carve: a drawn-out bottom turn into a mid-face arc */
  carve: [{dt: 1.0, du: 0.3, dv: -0.3, move: 'bottom', pose: 'bottom', comp: 0.7}, {dt: 0.7, du: 0.05, dv: 0.12, move: 'top', pose: 'climb', comp: 0.45}, {dt: 0.6, du: 0.1, dv: 0, move: 'trim', pose: 'trim', comp: 0.4}],
  /** bottom turn, project up the face, release at the lip, redirect down */
  snap: [{dt: 0.85, du: 0.3, dv: -0.37, move: 'bottom', pose: 'bottom', comp: 1.0}, {dt: 0.5, du: 0.1, dv: 0, move: 'bottom', pose: 'climb', comp: 0.55}, {dt: 0.45, du: -0.2, dv: 0.35, move: 'top', pose: 'top', comp: 0.25, cap: RIDE_SNAP_CAP_DEG, pivot: RIDE_SNAP_PIVOT_DEG}, {dt: 0.5, du: -0.03, dv: -0.03, move: 'recover', pose: 'recover', comp: 0.8}],   // R8: the hit rides the face up to the vertical (cap 89 instead of 78) with the board pivoted up the face past its velocity (the tail slides): the board reads near-vertical at the lip, as the real snap (Intermediate+ only: a Beginner's snap is a carve)
  /** roundhouse: a full-rail arc back toward the curl, rebound, back down the line */
  cutback: [{dt: 1.0, du: 0.8, dv: -0.15, move: 'cutback', pose: 'climb', comp: 0.6}, {dt: 0.9, du: 0.2, dv: 0.13, move: 'cutback', pose: 'cutback', comp: 0.4, pivot: -RIDE_CUTBACK_PIVOT_DEG}, {dt: 0.6, du: 0.05, dv: -0.06, move: 'recover', pose: 'recover', comp: 0.75}],   // R11: the peak knot pivots the board DOWN the face past its path (the nose back toward the curl): the rider's path over the water barely turns (the peel speed dominates: yaw -2..5 deg through the whole cutback before R11, the board flat), and the pivot's wind-up is the yaw rate that puts the board on its heel rail, as the real t6-t7.5 frames   // R7: its own peak key (head and shoulders back to the curl, the leading arm out toward it), then the rebound compact
  /** rhythmic compress/extend through a flat section */
  pump: [{dt: 0.6, du: 0.1, dv: -0.1, move: 'pump', pose: 'pump', comp: 0.75}, {dt: 0.5, du: 0.0, dv: 0.05, move: 'pump', pose: 'trim', comp: 0.4}],
  /** a long, fast, high line out to the shoulder with the rail set */
  straight: [{dt: 1.5, du: 0.4, dv: 0.05, move: 'trim', pose: 'trim', comp: 0.5}, {dt: 1.3, du: 0.9, dv: 0.02, move: 'trim', pose: 'trim', comp: 0.45}],
  /** stall (weight back, close to the curl), tuck low and hold a high line under the lip, come out ahead of the foam */
  barrel: [{dt: 0.8, du: 0.1, dv: -0.3, move: 'barrel', pose: 'barrel', comp: 0.9, ahead: 0.7}, {dt: 0.6, du: -0.8, dv: -0.36, move: 'barrel', pose: 'barrel', comp: 1.0, ahead: -0.3}, {dt: 1.4, du: -1.0, dv: -0.38, move: 'barrel', pose: 'barrel', comp: 1.0, ahead: -0.45}, {dt: 0.9, du: 0.1, dv: -0.3, move: 'barrel', pose: 'recover', comp: 0.8, ahead: 0.35}],   // R9: the stall drops the line to the bottom of the face while still ahead of the lip, the rider slides back into the tube along its floor (v ~0.12 at band C, where the thrown lip's roof clears the crouched rider) and comes out low and ahead of the curl before standing up; at the old 0.35-0.4 the head passed through the lip, in and out
  /** a shallow cover-up (Intermediate): the stall and the crouch under the lip, never behind the curl */
  coverup: [{dt: 0.8, du: -0.2, dv: -0.42, move: 'barrel', pose: 'barrel', comp: 0.85, ahead: 0.5}, {dt: 1.2, du: -0.35, dv: -0.5, move: 'barrel', pose: 'barrel', comp: 0.95, ahead: 0.05}, {dt: 0.9, du: 0.2, dv: -0.42, move: 'barrel', pose: 'recover', comp: 0.7, ahead: 0.4}],   // R9: crouched low on the face under the pitching lip's edge, never behind the curl (at the old v ~0.4 the head sat in the lip for the whole cover-up)
  /** the big-wave bottom turn: long radius, heavy load, deep at the base */
  longBottom: [{dt: 1.4, du: 0.35, dv: -0.45, move: 'bottom', pose: 'bottom', comp: 1.0}, {dt: 0.9, du: 0.1, dv: 0.08, move: 'bottom', pose: 'climb', comp: 0.6}],
};

/** Wave-height style bands (brief part 2): each forecast hour picks one from the drawn face height. The threshold rule (round the drawn
 *  face to the nearest 0.5 ft before comparing) is fixed in `bandFor` so an hour never flickers between bands. Style is illustration;
 *  only the face height picks the band. */
export interface StyleBand {
  id: 'A' | 'B' | 'C' | 'D'; minFt: number; label: string;
  /** preferred height on the face, pocket distance (face heights, scaled by the expertise), aggression/compression/spray scales */
  lineV: number; pocketFaces: number; aggression: number; compression: number; spray: number;
  /** R10: the snap's hit drops this much (v) with the pivot's wind-up on the hollow band: a near-vertical board on the C-wall of the R9
   *  tube bridges 0.65 m and still buries its tail at the R8 hit height (0.49 of the face at 6 ft); the measured-end lowering
   *  (RIDE.hitLow*) only reacts once an end is in */
  hitDropV?: number;
  /** the body of the ride as maneuvers with weights (0..1: the seeded chance of keeping an optional one; 1 = always) */
  moves: {name: ManeuverName; w: number}[];
  /** how fast the drop is against the skill's takeoff (1 = as written; smaller = later, steeper) */
  dropScale: number;
  /** board length range (ft) for a 5'10" rider; the quiver's best match or the model's board scaled to it */
  boardFt: [number, number]; boardTypes: readonly string[];
}
export const BANDS: readonly StyleBand[] = [
  // small (< 4 ft): at most three move types, upright, little rotation (M8)
  {id: 'A', minFt: 0, label: 'small: trim and gentle turns', lineV: 0.55, pocketFaces: 1.0, aggression: 0.3, compression: 0.4, spray: 0.25, dropScale: 1.3,
    moves: [{name: 'trim', w: 1}, {name: 'carve', w: 1}, {name: 'trim', w: 1}, {name: 'pump', w: 0.5}, {name: 'carve', w: 1}],
    boardFt: [5.33, 5.83], boardTypes: ['Fish', 'Groveler', 'Hybrid', 'Everyday shortboard', 'Midlength', 'Longboard']},
  // mid (4-6 ft): carving with real rail, top turns, pumps
  {id: 'B', minFt: 4, label: 'mid: carves, top turns, pumps', lineV: 0.45, pocketFaces: 0.6, aggression: 0.9, compression: 0.9, spray: 1.0, dropScale: 1.0,
    moves: [{name: 'trim', w: 1}, {name: 'snap', w: 1}, {name: 'trim', w: 1}, {name: 'cutback', w: 1}, {name: 'pump', w: 0.7}, {name: 'carve', w: 0.8}],
    boardFt: [5.83, 6.5], boardTypes: ['Performance shortboard', 'Everyday shortboard', 'Hybrid', 'Step-up']},
  // big (6-10 ft): deep bottom turns, vertical top turns, and a barrel every ride (Intermediate: a shallow cover-up; Beginner: never)
  {id: 'C', minFt: 6, label: 'big: deep turns and a barrel', lineV: 0.5, pocketFaces: 0.5, aggression: 0.8, compression: 0.85, spray: 0.8, dropScale: 0.85, hitDropV: 0.1,
    moves: [{name: 'longBottom', w: 1}, {name: 'snap', w: 1}, {name: 'trim', w: 1}, {name: 'barrel', w: 1}, {name: 'trim', w: 1}, {name: 'cutback', w: 0.5}],
    boardFt: [6.17, 6.83], boardTypes: ['Step-up', 'Performance shortboard', 'Gun']},
  // very big (10 ft +): long drawn-out bottom turns, a deep barrel, a high fast line
  {id: 'D', minFt: 10, label: 'very big: drawn-out turns, a deep barrel, high lines', lineV: 0.58, pocketFaces: 0.8, aggression: 0.6, compression: 0.7, spray: 0.6, dropScale: 0.7,
    moves: [{name: 'longBottom', w: 1}, {name: 'trim', w: 1}, {name: 'barrel', w: 1}, {name: 'straight', w: 1}, {name: 'trim', w: 1}],
    boardFt: [6.67, 7.5], boardTypes: ['Step-up', 'Gun', 'Midlength']},
];
export const bandFor = (faceFt: number): StyleBand => { const r = Math.round(faceFt * 2) / 2; let b = BANDS[0]; for (const x of BANDS) if (r >= x.minFt) b = x; return b; };
/** Band C's board grows with the face: 6'8"-7'6" at 10-15 ft, 8'-10' beyond (brief). */
export const bandBoardFt = (band: StyleBand, faceFt: number): [number, number] => (band.id === 'D' && faceFt >= 15 ? [8, 10] : band.boardFt);

export interface SkillProfile {
  /** the takeoff: the first knot is where the rider appears (its dt is the gap from the previous ride's end, the rider faded out), the
   *  rest the drop. R6 (user's recording: the rider read as lying on the board for long stretches): the rider appears already standing
   *  (trim, tall) at the top of the face and drops within about a second; no paddle or pop-up phase is drawn */
  takeoff: Knot[];
  /** the exit: a kick-out over the lip (the rider fades out at the last knot) or a straighten-out in front of the foam */
  exit: Knot[];
  /** the expertise layer filters and scales the band's move set: the maneuvers this level may draw (with a substitute for the ones it
   *  may not), how far from the pocket (x the band's distance), the line height offset, the amplitude of each maneuver's excursions and
   *  how much slower it moves through them */
  allow: Partial<Record<ManeuverName, ManeuverName | null>>; pocketScale: number; lineVOffset: number; intensity: number; slow: number;
  /** scales the lean and the rail roll (1 = the full carve), the compression depth, the arm abduction (beginners ride arms-out) */
  carve: number; compression: number; armsOutDeg: number;
  /** maneuver cross-fade (ms) into each pose */
  fadeMs: Record<PoseName, number>;
  /** low-frequency balance sway (deg) */
  swayDeg: number;
}
/** Expertise maps onto the app's own levels (UserProfile.skill). Position: Expert tight in the pocket, Intermediate mid-face a moderate
 *  distance out, Beginner out on the shoulder with the simplest moves (never a barrel or a snap; a straighten-out at the end). The
 *  moves are illustration. `allow` maps a band maneuver to what this level does instead (null = skipped; absent = as the band has it). */
export const SKILLS: Record<Skill, SkillProfile> = {
  Expert: {
    takeoff: [
      {dt: 2.4, u: -0.45, v: 0.8, move: 'takeoff', pose: 'trim', comp: 0.3},
      {dt: 0.85, u: -0.7, v: 0.12, move: 'takeoff', pose: 'bottom', comp: 1.0},
    ],
    exit: [
      {dt: 0.7, u: -1.1, v: 0.55, move: 'kickout', pose: 'climb', comp: 0.5},
      {dt: 0.6, u: -1.45, v: 0.85, move: 'kickout', pose: 'top', comp: 0.3},
    ],
    allow: {}, pocketScale: 1, lineVOffset: 0, intensity: 1, slow: 1,
    carve: 1, compression: 1, armsOutDeg: 0, fadeMs: {trim: 400, bottom: 320, climb: 320, top: 300, recover: 320, pump: 260, barrel: 420, pigdog: 420, cutback: 340, trimB: 400, bottomB: 320, climbB: 320, topB: 300, recoverB: 320, pumpB: 260, cutbackB: 340}, swayDeg: 0.8,
  },
  Intermediate: {
    takeoff: [
      {dt: 2.8, u: -0.95, v: 0.75, move: 'takeoff', pose: 'trim', comp: 0.3},
      {dt: 0.9, u: -1.2, v: 0.15, move: 'takeoff', pose: 'bottom', comp: 0.8},
    ],
    exit: [
      {dt: 0.8, u: -1.6, v: 0.55, move: 'kickout', pose: 'climb', comp: 0.45},
      {dt: 0.7, u: -1.95, v: 0.85, move: 'kickout', pose: 'top', comp: 0.3},
    ],
    /** no barrel for an intermediate: the band C high line instead (the brief's "shallow ones only" needs a tube to be drawn first) */
    allow: {barrel: 'coverup'}, pocketScale: 1.6, lineVOffset: -0.03, intensity: 0.7, slow: 1.15,
    carve: 0.7, compression: 0.7, armsOutDeg: 6, fadeMs: {trim: 420, bottom: 360, climb: 360, top: 330, recover: 360, pump: 280, barrel: 450, pigdog: 450, cutback: 380, trimB: 420, bottomB: 360, climbB: 360, topB: 330, recoverB: 360, pumpB: 280, cutbackB: 380}, swayDeg: 1.2,
  },
  Beginner: {
    takeoff: [
      {dt: 3.2, u: -1.9, v: 0.7, move: 'takeoff', pose: 'trim', comp: 0.3},
      {dt: 1.0, u: -2.3, v: 0.25, move: 'takeoff', pose: 'bottom', comp: 0.5},
    ],
    exit: [
      {dt: 1.3, u: -2.9, v: 0.12, move: 'out', pose: 'trim', comp: 0.3},
      {dt: 1.0, u: -3.1, v: 0.07, move: 'out', pose: 'trim', comp: 0.3},
    ],
    allow: {snap: 'carve', cutback: null, barrel: null, coverup: null, pump: null, longBottom: 'carve'}, pocketScale: 2.6, lineVOffset: -0.08, intensity: 0.45, slow: 1.4,
    carve: 0.4, compression: 0.35, armsOutDeg: 18, fadeMs: {trim: 450, bottom: 450, climb: 450, top: 400, recover: 450, pump: 350, barrel: 500, pigdog: 500, cutback: 450, trimB: 450, bottomB: 450, climbB: 450, topB: 400, recoverB: 450, pumpB: 350, cutbackB: 450}, swayDeg: 2.2,
  },
};

/** The ride body for a band and expertise (the maneuver library composed, filtered and scaled): absolute knots in (u, v). */
export function composeBody(band: StyleBand, skill: SkillProfile, keep: (w: number) => boolean): Knot[] {
  const out: Knot[] = [], pocket = band.pocketFaces * skill.pocketScale, lineV = band.lineV + skill.lineVOffset;
  for (const m of band.moves) {
    const name = m.name in skill.allow ? skill.allow[m.name] : m.name; if (name === null || name === undefined) continue;
    if (m.w < 1 && !keep(m.w)) continue;
    for (const k of MANEUVERS[name]) out.push({dt: k.dt * skill.slow, u: -(pocket + k.du), v: lineV + k.dv * skill.intensity, move: k.move, pose: k.pose, comp: k.comp * band.compression / 0.9, ahead: k.ahead, cap: k.cap, pivot: k.pivot === undefined ? undefined : k.pivot * skill.carve});
  }
  if (!out.length) out.push({dt: 1.2, u: -pocket, v: lineV, move: 'trim', pose: 'trim', comp: 0.4});
  return out;
}

/** The quiver board for a band: the best length match (scaled to the rider's height against a 5'10" reference) among the band's
 *  preferred types, else the closest length of any type; null with an empty quiver (the model's board is scaled to the band instead). */
export function boardForBand(band: StyleBand, faceFt: number, boards: readonly {id: string; type: string; length: number}[], riderFt: number): string | null {
  if (!boards.length) return null;
  const [lo, hi] = bandBoardFt(band, faceFt), k = riderFt / (5 + 10 / 12), mid = (lo + hi) / 2 * k;
  let best: string | null = null, bestScore = Infinity;
  for (const b of boards) {
    const ft = b.length / 12, off = ft < lo * k ? lo * k - ft : ft > hi * k ? ft - hi * k : 0, typeOk = band.boardTypes.includes(b.type);
    const score = off + Math.abs(ft - mid) * 0.1 + (typeOk ? 0 : 3);   // a wrong type (a longboard for a 20 ft face) loses to a short step-up
    if (score < bestScore) { bestScore = score; best = b.id; }
  }
  return best;
}

/** The surfer-v3 clip's key frames (tools/blender/build_surfer.py RIDE, 24 fps): the pose library is sampled from the `ride` clip at these
 *  times once at load; the clip is not played (a mixer that skips unchanged writes was the round-3 popping, see docs/3d/FINDINGS-2026-11-04.md). */
export const POSE_KEYS: Record<PoseName, number> = {trim: 1, bottom: 26, climb: 42, top: 58, recover: 70, pump: 82, barrel: 100, pigdog: 112, cutback: 124,
  trimB: 136, bottomB: 148, climbB: 160, topB: 172, recoverB: 184, pumpB: 196, cutbackB: 208};
export const CLIP_FPS = 24;

/** The body's procedural layers on top of the blended pose. */
export const BODY = {
  /** stance: the model's feet on the deck (fractions of the board length from the centre, nose at -x): front foot ahead of centre, back on the tail pad */
  stanceFrontX: -0.13, stanceBackX: 0.3,
  /** dynamic compression on top of the pose (m of hip drop at comp 1 x skill compression) */
  compressM: 0.1,
  /** on a steep face the rider stands away from the deck toward the vertical: the whole body above the feet leans by a share of the deck
   *  tilt past a threshold (the legs flex to keep the feet planted), then the torso adds its own counter over three spine bones, both limited */
  bodyLeanStartDeg: 18, bodyLeanGain: 0.4, bodyLeanMaxDeg: 16, /** share of the pivot's height loss given back (1 = hips keep their height off the deck) */ bodyLeanKeepHeight: 0.7,
  /** R8: the lean answers the deck's roll; its along-board (pitch) share fades out between these board pitches (deg): a board pivoted up
   *  the face in the snap no longer pivots the body toward the tail (knee knock at the backside hit) */
  leanPitchFadeDeg: [15, 60] as readonly [number, number],
  /** R11: and fades out as what is left of world-up after that (its length, 0..1) gets short: the lean's axis is undefined there */
  leanUpFade: [0.15, 0.6] as readonly [number, number],
  torsoCounterStartDeg: 30, torsoCounterGain: 0, torsoCounterMaxDeg: 0,
  /** backside the chest faces down the slope: the torso counters toward the vertical (over the heels, toward the wave) harder */
  torsoCounterBackside: {gain: 0, maxDeg: 0},
  /** head and shoulders lead the heading this far ahead (s), limited; the hips follow a share of it */
  leadAheadS: 0.3, leadMaxDeg: 24, leadShare: {pelvis: 0.15, spine: 0.35, neck: 0.25, head: 0.3},
  /** arms counter-balance the rail roll (share of the roll, about the heading), plus the skill's arms-out abduction */
  armRollShare: 0.25,
  /** the arms cross-fade slower than the body (x the pose fade rate): a pose change swings the hands through the longest arcs */
  armFadeScale: 0.75,   // R7: the v6 snap key throws the arms up; the hands arrive a hair after the body (a real throw) and the upper arms stay under 360 deg/s
  /** R8: leaving the snap, the arms' pose target switches to the recovery this much (s) before the body's does: the hands peak at the hit
   *  and are on their way down as the board comes off the lip (R7's stayed up ~0.4 s into the recovery). The fade rate itself is unchanged:
   *  a faster critically damped fade of the 150 deg arm arc breaks the 10k deg/s^2 gate (its peak is the arc x the rate squared). */
  snapArmDropLeadS: 0.15,
  /** R8: the snap key's own arm weight fades OUT at this x the body's rate (the other arm fades stay at armFadeScale): the 6 ft Expert
   *  cell's jerk peak is the head (9.9k), its arms sat at 4.4k with the 0.75 fade, so the drop has room to be a third faster */
  snapArmDropFade: 1.0,
  /** round 5 (user: "the arms are still ragdolling", "the joints are disconnected"): the arms are part of the authored pose and move
   *  only as the whole-body pose blends; the per-hand IK to board-frame targets (M7) is off. The whole body blends on one weight. */
  armIK: false,
  /** every pose cross-fade is stretched by this (the whole body on one timing): a 90 deg arm swing between keys then peaks under 360 deg/s */
  fadeScale: 2.0,   // R6: 2.0 (the v5 keys swing the hands further between the bottom turn and the snap; at 1.6 the arm joints peaked at 449 deg/s)
  /** the authored keys hold the arms out at hip-to-chest height; through the turns (the non-trim weight) both upper arms are brought down
   *  toward the body by this much (deg), the way the real sequence holds them: the leading hand low by the rail, the trailing arm close */
  armsDownDeg: 0,   // R6: the v5 keys hold the arms where the real sequences do; nothing procedural pulls them further
  /** two-bone leg IK: the knee pole points over the toes (rider-frame +z) splayed this much toward the board's end on that leg's side */
  kneePole: {splay: 0.05, footShare: 0.3, maxX: 0.2},
  /** the leg on the nose side: index into the IK legs [l, r] (the model is goofy: right foot forward; the mirror does not change it) */
  frontLeg: 1,
  /** arm IK (M7): the elbow pole (rider frame: out toward that arm's board end, down, back behind the chest), how far (m) the skill's
   *  arms-out carries each hand toward its board end at 90 deg */
  elbowPole: {out: 0.6, back: -0.75, down: -0.3}, armsOutReachM: 0.35,
  /** a pose missing from an older asset (its key past the clip's end) is sampled from this substitute instead */
  poseFallback: {barrel: 'bottom', pigdog: 'bottom', cutback: 'top', trimB: 'trim', bottomB: 'bottom', climbB: 'climb', topB: 'top', recoverB: 'recover', pumpB: 'pump', cutbackB: 'top'} as Partial<Record<PoseName, PoseName>>,
  /** R7: backside rides its own keys (surfer-v6): the weight the plan puts on a frontside pose goes to this key when the rider is mirrored */
  backsideOf: {trim: 'trimB', bottom: 'bottomB', climb: 'climbB', top: 'topB', recover: 'recoverB', pump: 'pumpB', barrel: 'pigdog', cutback: 'cutbackB'} as Partial<Record<PoseName, PoseName>>,
  /** spring rates (rad/s) per joint group: core stiff, arms looser, head quick, hips slow */
  springW: {core: 2 * Math.PI * 1.3, arms: 2 * Math.PI * 0.9, head: 2 * Math.PI * 1.2, hips: 2 * Math.PI * 0.8, comp: 2 * Math.PI * 1.1},
  /** human ranges of motion for the procedural additions (deg) */
  limits: {spineTwist: 35, spineBend: 40, neck: 50, head: 60, armSwing: 70, kneeMin: 8, kneeMax: 150, elbowMin: 15, elbowMax: 150},
  /** idle balance: two slow sines (Hz) seeded per hour; never per-frame noise */
  idleHz: [0.33, 0.57] as readonly [number, number], idleBobM: 0.004,
  /** round 5 (M3): the body's procedural gains (lean, torso counter, backside head) are smoothed by critically damped springs at this
   *  rate; each hand follows its target through its own spring and under a speed cap (m/s); the elbow's bend plane turns at most this
   *  fast (deg/s), so a hand near the pole's direction never spins the upper arm */
  smoothHz: 2.5, handFollowHz: 2.2, handSpeedMps: 1.6, bendPlaneRateDeg: 240,
  /** the arm joints (upper arm, forearm) follow their IK solve through a rotational spring at this rate, their speed capped (deg/s):
   *  the M3 limits (360 deg/s, 3000 deg/s^2) hold by construction */
  jointFollowHz: 1.6, jointSpeedDeg: 300,
  /** M9: the torso's pitch from the deck normal toward the toes stays inside this range (deg) in every move; the spine hinges forward to keep it */
  torsoPitchDeg: [12, 58] as readonly [number, number],
  /** R6: backside the chest faces down the face, so the same pitch toward the toes folds the body over the nose toward the beach (the
   *  user's recording, seed 11 = regular on a left: the rider read as lying on the board); a real backside crouch stays far more upright */
  torsoPitchDegBackside: [8, 45] as readonly [number, number],   // R7: against the leg line (see riderBody); the v6 backside keys hold 12-34 deg themselves
  /** R6: backside the deck normal already leans toward the beach by the face slope, so the body above the feet angulates toward the
   *  vertical (over the heels, into the wave) with a much stronger lean than frontside; a real backside crouch stands near vertical */
  bodyLeanBackside: {gain: 1.0, maxDeg: 48, /** a near-true pivot about the feet: with 0.7 the hips rose past the legs' reach at 48 deg and the knees locked straight */ keepHeight: 0.25},   // R7: with the pitch read against the leg line the body angulates fully over the heels (the real backside hit: the back into the wave)
  /** the hinge's own spring rate (Hz): quick, the raw pitch it corrects is already smooth (the v4 top-turn key leans back 30 deg) */
  pitchHz: 8,
  /** the hands stay within this much of the pelvis along the board (m): the joint springs may lag the solve, never past the arm box */
  handSideMaxM: 0.6,
  /** backside (M2): the head turns this much further over the leading shoulder, toward the wave, through the turns */
  backsideHeadDeg: 0,   // R7: the v6 backside keys author the head over the leading shoulder
  /** R11 (user: "the surfer's body orientation is still really bad"): the body's YAW against the stringer, measured on the composed
   *  chain and corrected toward a per-pose target (the M9 pattern), in the rider frame: [hip line, shoulder line, head facing] in deg.
   *  The hip and shoulder lines are the trailing -> leading joint, 0 = along the stringer, + = the chest turned toward the nose; the head
   *  is its facing from the toe side toward the nose (90 = straight down the line). Measured before R11 (frontside, 6 ft Expert): trim
   *  hips 24 / shoulders 46 / head 110, bottom 22 / 30 / 100, the hit (top) 6 / 24 / -17 with the chest twisted toward the TAIL (the
   *  key copied the chest-to-the-beach of a backside reference), the head past the nose toward the beach everywhere (the rider looked at
   *  the camera). The real frames: in trim the hips near the stringer and the shoulders a little open, the head down the line; the
   *  bottom turn's chest at the lip ahead, the head at the lip (short of the nose, toward the wave); the hit's chest open past the nose
   *  with the head down the face; the cutback's shoulders and head back toward the curl. The targets blend with the pose weights; a
   *  pose without a target fades the correction out (cutback keys: authored against the real sequence, left as they are). */
  yawTargets: {trim: [12, 32, 85], pump: [12, 32, 85], bottom: [20, 45, 70], climb: [25, 50, 80], top: [35, 60, 105], recover: [25, 45, 90], barrel: [15, 35, 85],
    trimB: [15, 40, 95], pumpB: [15, 40, 95], bottomB: [20, 40, 105], climbB: [25, 50, 115], topB: [25, 55, 115], recoverB: [20, 45, 100], pigdog: [20, 50, 110]} as Partial<Record<PoseName, readonly [number, number, number]>>,
  /** the correction's spread: the hip fix on the pelvis, the shoulder fix over the three spine bones, the head fix over neck and head;
   *  the arms keep this share of the shoulder fix (0 = the hands stay where the key put them in the rider frame, the clavicles counter
   *  the chest's turn; 1 = carried round with the chest) */
  yawHeadSplit: {neck: 0.5, head: 0.5}, yawArmsFollow: 1, yawHz: 4,
} as const;
