/** Every tunable of the 3D rider (spec 2026-11-04-3d-real-surfing, stages 1-4): simulation rate, glitch-monitor limits, the scale pole,
 *  the board's dimensions and springs, the line planner's maneuver knots per skill, the body's layers, limits and cross-fades, and the
 *  data shape of the wave-height style bands (filled in the next run). No magic numbers in the animation code: it reads from here.
 *  Riding style, stance and moves are illustration; only the face height, breaker type, period, wind, direction and light come from the
 *  forecast. */
import type {Skill} from '../../models/index.ts';

/** Fixed-step motion: the rider and the water time advance in 1/120 s steps; the render interpolates between the last two states. */
export const SIM = {hz: 120, maxStepsPerFrame: 8, maxFrameS: 0.05} as const;

/** Dev glitch monitor: angular change per frame (the limit is per 1/60 s and scales with the frame's own dt), board-to-water gaps. */
export const MONITOR = {jointDegPerFrame: 25, boardDegPerFrame: 25, refFrameS: 1 / 60, centreGapM: 0.03, lowestGapM: -0.15, keepEvents: 40} as const;

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
  bandWidthM: {A: 0.53, B: 0.49, C: 0.46} as Record<'A' | 'B' | 'C', number>,
  /** the plane-fit chord along the board as a fraction of its half length */
  endPoint: 0.84,
  /** the contact probes on the mesh's bottom plane (m in from the ends/rails, up from the bottom): the monitor's gaps, the sim's rail
   *  depth and the dev probe all read these same points */
  probe: {tailIn: 0.03, tailUp: 0.03, noseIn: 0.15, noseUp: 0.08, railIn: 0.02},
  /** rail roll into a turn: tan(roll) = v^2 / (g r), capped, and capped again each step so the buried rail (roll plus the face's
   *  concavity between the rails) never goes deeper than railDepthM */
  rollMaxDeg: 24, railDepthM: 0.09,
  /** the roll cap aims this much under railDepthM: the depth it works from is last step's measurement */
  railMarginM: 0.02,
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

export type Move = 'trim' | 'bottom' | 'top' | 'recover' | 'pump' | 'cutback' | 'takeoff' | 'kickout' | 'out' | 'barrel' | 'floater';
/** One knot of the ride: time to reach it from the previous knot (s, at RIDE.refFaceM; the first knot's dt closes the loop from the
 *  last), u, v, the move name, the pose it blends to, the compression target, and how close to the curl it may go (face heights,
 *  RIDE.minAheadFaces when absent). */
export interface Knot {dt: number; u: number; v: number; move: Move; pose: PoseName; /** compression target 0 (tall) .. 1 (deep) */ comp: number; ahead?: number}
export type PoseName = 'trim' | 'bottom' | 'climb' | 'top' | 'recover' | 'pump';

/** A maneuver's shape (brief part 2, "implementation shape"): knots relative to the band's line: `du` out from the pocket distance (face
 *  heights, + = further out on the shoulder), `dv` up (+) or down (-) from the band's line height, scaled by the expertise's intensity. */
export interface ManeuverKnot {dt: number; du: number; dv: number; move: Move; pose: PoseName; comp: number; ahead?: number}
export type ManeuverName = 'trim' | 'carve' | 'snap' | 'cutback' | 'pump' | 'straight' | 'barrel' | 'longBottom';
export const MANEUVERS: Record<ManeuverName, ManeuverKnot[]> = {
  /** a trim along the line */
  trim: [{dt: 0.7, du: 0.05, dv: 0, move: 'trim', pose: 'trim', comp: 0.45}],
  /** a soft open-face carve: a drawn-out bottom turn into a mid-face arc */
  carve: [{dt: 1.0, du: 0.3, dv: -0.3, move: 'bottom', pose: 'bottom', comp: 0.7}, {dt: 0.7, du: 0.05, dv: 0.12, move: 'top', pose: 'climb', comp: 0.45}, {dt: 0.6, du: 0.1, dv: 0, move: 'trim', pose: 'trim', comp: 0.4}],
  /** bottom turn, project up the face, release at the lip, redirect down */
  snap: [{dt: 0.85, du: 0.3, dv: -0.37, move: 'bottom', pose: 'bottom', comp: 1.0}, {dt: 0.5, du: 0.1, dv: 0, move: 'bottom', pose: 'climb', comp: 0.55}, {dt: 0.45, du: -0.2, dv: 0.35, move: 'top', pose: 'top', comp: 0.25}, {dt: 0.5, du: -0.03, dv: -0.03, move: 'recover', pose: 'recover', comp: 0.8}],
  /** roundhouse: a full-rail arc back toward the curl, rebound, back down the line */
  cutback: [{dt: 1.1, du: 0.8, dv: -0.15, move: 'cutback', pose: 'climb', comp: 0.6}, {dt: 0.9, du: 0.2, dv: 0.13, move: 'cutback', pose: 'top', comp: 0.4}],
  /** rhythmic compress/extend through a flat section */
  pump: [{dt: 0.6, du: 0.1, dv: -0.1, move: 'pump', pose: 'pump', comp: 0.75}, {dt: 0.5, du: 0.0, dv: 0.05, move: 'pump', pose: 'trim', comp: 0.4}],
  /** a long, fast, high line out to the shoulder with the rail set */
  straight: [{dt: 1.5, du: 0.4, dv: 0.05, move: 'trim', pose: 'trim', comp: 0.5}, {dt: 1.3, du: 0.9, dv: 0.02, move: 'trim', pose: 'trim', comp: 0.45}],
  /** stall (weight back, close to the curl), tuck low and hold a high line under the lip, come out ahead of the foam */
  barrel: [{dt: 0.8, du: -0.15, dv: -0.05, move: 'barrel', pose: 'recover', comp: 0.5, ahead: 0.1}, {dt: 1.3, du: -0.25, dv: 0.02, move: 'barrel', pose: 'bottom', comp: 1.0, ahead: 0.08}, {dt: 0.9, du: 0.25, dv: -0.05, move: 'barrel', pose: 'climb', comp: 0.6, ahead: 0.2}],
  /** the big-wave bottom turn: long radius, heavy load, deep at the base */
  longBottom: [{dt: 1.4, du: 0.35, dv: -0.45, move: 'bottom', pose: 'bottom', comp: 1.0}, {dt: 0.9, du: 0.1, dv: 0.08, move: 'bottom', pose: 'climb', comp: 0.6}],
};

/** Wave-height style bands (brief part 2): each forecast hour picks one from the drawn face height. The threshold rule (round the drawn
 *  face to the nearest 0.5 ft before comparing) is fixed in `bandFor` so an hour never flickers between bands. Style is illustration;
 *  only the face height picks the band. */
export interface StyleBand {
  id: 'A' | 'B' | 'C'; minFt: number; label: string;
  /** preferred height on the face, pocket distance (face heights, scaled by the expertise), aggression/compression/spray scales */
  lineV: number; pocketFaces: number; aggression: number; compression: number; spray: number;
  /** the body of the ride as maneuvers with weights (0..1: the seeded chance of keeping an optional one; 1 = always) */
  moves: {name: ManeuverName; w: number}[];
  /** how fast the drop is against the skill's takeoff (1 = as written; smaller = later, steeper) */
  dropScale: number;
  /** board length range (ft) for a 5'10" rider; the quiver's best match or the model's board scaled to it */
  boardFt: [number, number]; boardTypes: readonly string[];
}
export const BANDS: readonly StyleBand[] = [
  {id: 'A', minFt: 0, label: 'chill, flowing', lineV: 0.55, pocketFaces: 1.0, aggression: 0.3, compression: 0.45, spray: 0.25, dropScale: 1.3,
    moves: [{name: 'trim', w: 1}, {name: 'carve', w: 1}, {name: 'trim', w: 1}, {name: 'cutback', w: 0.7}, {name: 'pump', w: 0.5}, {name: 'carve', w: 1}],
    boardFt: [5.33, 5.83], boardTypes: ['Fish', 'Groveler', 'Hybrid', 'Everyday shortboard', 'Midlength', 'Longboard']},
  {id: 'B', minFt: 4, label: 'aggressive shortboard carving', lineV: 0.45, pocketFaces: 0.6, aggression: 0.9, compression: 0.9, spray: 1.0, dropScale: 1.0,
    moves: [{name: 'trim', w: 1}, {name: 'snap', w: 1}, {name: 'trim', w: 1}, {name: 'cutback', w: 1}, {name: 'pump', w: 0.7}, {name: 'snap', w: 0.8}],
    boardFt: [5.83, 6.5], boardTypes: ['Performance shortboard', 'Everyday shortboard', 'Hybrid', 'Step-up']},
  {id: 'C', minFt: 10, label: 'big-wave: barrels and straight lines', lineV: 0.58, pocketFaces: 0.8, aggression: 0.6, compression: 0.7, spray: 0.6, dropScale: 0.7,
    moves: [{name: 'longBottom', w: 1}, {name: 'trim', w: 1}, {name: 'barrel', w: 0.8}, {name: 'straight', w: 1}, {name: 'trim', w: 1}],   // the stall into the barrel from a trim, not from far out on the shoulder (that raced the rider back at the peel speed)
    boardFt: [6.67, 7.5], boardTypes: ['Step-up', 'Gun', 'Midlength']},
];
export const bandFor = (faceFt: number): StyleBand => { const r = Math.round(faceFt * 2) / 2; let b = BANDS[0]; for (const x of BANDS) if (r >= x.minFt) b = x; return b; };
/** Band C's board grows with the face: 6'8"-7'6" at 10-15 ft, 8'-10' beyond (brief). */
export const bandBoardFt = (band: StyleBand, faceFt: number): [number, number] => (band.id === 'C' && faceFt >= 15 ? [8, 10] : band.boardFt);

export interface SkillProfile {
  /** the takeoff: the first knot is where the rider appears (its dt is the gap from the previous ride's end, the rider faded out), the
   *  rest the drop */
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
      {dt: 2.4, u: -0.45, v: 0.8, move: 'takeoff', pose: 'recover', comp: 0.7},
      {dt: 0.85, u: -0.7, v: 0.12, move: 'takeoff', pose: 'bottom', comp: 1.0},
    ],
    exit: [
      {dt: 0.7, u: -1.1, v: 0.55, move: 'kickout', pose: 'climb', comp: 0.5},
      {dt: 0.6, u: -1.45, v: 0.85, move: 'kickout', pose: 'top', comp: 0.3},
    ],
    allow: {}, pocketScale: 1, lineVOffset: 0, intensity: 1, slow: 1,
    carve: 1, compression: 1, armsOutDeg: 0, fadeMs: {trim: 400, bottom: 280, climb: 300, top: 280, recover: 300, pump: 220}, swayDeg: 0.8,
  },
  Intermediate: {
    takeoff: [
      {dt: 2.8, u: -0.95, v: 0.75, move: 'takeoff', pose: 'recover', comp: 0.6},
      {dt: 1.1, u: -1.2, v: 0.15, move: 'takeoff', pose: 'bottom', comp: 0.8},
    ],
    exit: [
      {dt: 0.8, u: -1.6, v: 0.55, move: 'kickout', pose: 'climb', comp: 0.45},
      {dt: 0.7, u: -1.95, v: 0.85, move: 'kickout', pose: 'top', comp: 0.3},
    ],
    /** no barrel for an intermediate: the band C high line instead (the brief's "shallow ones only" needs a tube to be drawn first) */
    allow: {barrel: 'straight'}, pocketScale: 1.6, lineVOffset: -0.03, intensity: 0.7, slow: 1.15,
    carve: 0.7, compression: 0.7, armsOutDeg: 6, fadeMs: {trim: 400, bottom: 320, climb: 320, top: 300, recover: 320, pump: 240}, swayDeg: 1.2,
  },
  Beginner: {
    takeoff: [
      {dt: 3.2, u: -1.9, v: 0.7, move: 'takeoff', pose: 'recover', comp: 0.45},
      {dt: 1.6, u: -2.3, v: 0.25, move: 'takeoff', pose: 'bottom', comp: 0.5},
    ],
    exit: [
      {dt: 1.3, u: -2.9, v: 0.12, move: 'out', pose: 'trim', comp: 0.3},
      {dt: 1.0, u: -3.1, v: 0.07, move: 'out', pose: 'trim', comp: 0.3},
    ],
    allow: {snap: 'carve', cutback: null, barrel: null, pump: null, longBottom: 'carve'}, pocketScale: 2.6, lineVOffset: -0.08, intensity: 0.45, slow: 1.4,
    carve: 0.4, compression: 0.35, armsOutDeg: 18, fadeMs: {trim: 400, bottom: 400, climb: 400, top: 350, recover: 400, pump: 300}, swayDeg: 2.2,
  },
};

/** The ride body for a band and expertise (the maneuver library composed, filtered and scaled): absolute knots in (u, v). */
export function composeBody(band: StyleBand, skill: SkillProfile, keep: (w: number) => boolean): Knot[] {
  const out: Knot[] = [], pocket = band.pocketFaces * skill.pocketScale, lineV = band.lineV + skill.lineVOffset;
  for (const m of band.moves) {
    const name = m.name in skill.allow ? skill.allow[m.name] : m.name; if (name === null || name === undefined) continue;
    if (m.w < 1 && !keep(m.w)) continue;
    for (const k of MANEUVERS[name]) out.push({dt: k.dt * skill.slow, u: -(pocket + k.du), v: lineV + k.dv * skill.intensity, move: k.move, pose: k.pose, comp: k.comp * band.compression / 0.9, ahead: k.ahead});
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
export const POSE_KEYS: Record<PoseName, number> = {trim: 1, bottom: 26, climb: 42, top: 58, recover: 70, pump: 82};
export const CLIP_FPS = 24;

/** The body's procedural layers on top of the blended pose. */
export const BODY = {
  /** stance: the model's feet on the deck (fractions of the board length from the centre, nose at -x): front foot ahead of centre, back on the tail pad */
  stanceFrontX: -0.13, stanceBackX: 0.3,
  /** dynamic compression on top of the pose (m of hip drop at comp 1 x skill compression) */
  compressM: 0.1,
  /** on a steep face the rider stands away from the deck toward the vertical: the whole body above the feet leans by a share of the deck
   *  tilt past a threshold (the legs flex to keep the feet planted), then the torso adds its own counter over three spine bones, both limited */
  bodyLeanStartDeg: 22, bodyLeanGain: 0.75, bodyLeanMaxDeg: 42,
  torsoCounterStartDeg: 30, torsoCounterGain: 0.5, torsoCounterMaxDeg: 30,
  /** head and shoulders lead the heading this far ahead (s), limited; the hips follow a share of it */
  leadAheadS: 0.3, leadMaxDeg: 30, leadShare: {pelvis: 0.15, spine: 0.35, neck: 0.25, head: 0.4},
  /** arms counter-balance the rail roll (share of the roll, about the heading), plus the skill's arms-out abduction */
  armRollShare: 0.4,
  /** spring rates (rad/s) per joint group: core stiff, arms looser, head quick, hips slow */
  springW: {core: 2 * Math.PI * 1.3, arms: 2 * Math.PI * 0.9, head: 2 * Math.PI * 2.2, hips: 2 * Math.PI * 0.8, comp: 2 * Math.PI * 1.1},
  /** human ranges of motion for the procedural additions (deg) */
  limits: {spineTwist: 35, spineBend: 40, neck: 50, head: 60, armSwing: 70, kneeMin: 8, kneeMax: 150},
  /** idle balance: two slow sines (Hz) seeded per hour; never per-frame noise */
  idleHz: [0.33, 0.57] as readonly [number, number], idleBobM: 0.004,
} as const;
