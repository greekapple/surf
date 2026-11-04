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

/** The 6 ft scale pole: 1 ft bands, stood on the trough at the rider's own along-crest position, this far out on the flat in front. */
export const POLE = {heightM: 1.8288, bands: 6, radiusM: 0.035, aheadM: 1.2} as const;

/** The board as placed on the water (the model's 6'0" x 19.3"; a quiver board replaces the mesh, the contact points scale with its bounds). */
export const BOARD = {
  lengthM: 1.83, widthM: 0.49,
  /** contact points along the board as fractions of its half length (nose/tail) and half width (rails) */
  endPoint: 0.84, railPoint: 0.9,
  /** rail roll into a turn: tan(roll) = v^2 / (g r), capped, and capped again each step so the buried rail (roll plus the face's
   *  concavity between the rails) never goes deeper than railDepthM */
  rollMaxDeg: 24, railDepthM: 0.09,
  /** nose/tail rocker the ends can bridge on a concave face before the line is lowered */
  rockerM: 0.07,
  /** the centre may lift off a concave section by at most this much (the ends carry the board) */
  bridgeMaxM: 0.06,
  /** critically damped spring rates (rad/s): the surface fit (pitch and roll), the yaw toward the velocity, the rail roll */
  fitW: 2 * Math.PI * 6, yawW: 2 * Math.PI * 6, rollW: 2 * Math.PI * 1.2,
} as const;

/** The line planner: wave-relative (u along the crest from the curl in face heights, negative = ahead on the shoulder; v height on the face). */
export const RIDE = {
  /** the face is rideable up to this slope; the planned v is capped under it (minus a margin) each step */
  slopeCapDeg: 78, capMarginV: 0.04, vMin: 0.06,
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
} as const;

export type Move = 'trim' | 'bottom' | 'top' | 'recover' | 'pump' | 'cutback';
/** One knot of the ride loop: time to reach it from the previous knot (s, at RIDE.refFaceM; the first knot's dt closes the loop from the
 *  last), u, v, the move name, the pose it blends to. */
export interface Knot {dt: number; u: number; v: number; move: Move; pose: PoseName; /** compression target 0 (tall) .. 1 (deep) */ comp: number}
export type PoseName = 'trim' | 'bottom' | 'climb' | 'top' | 'recover' | 'pump';
export interface SkillProfile {
  /** the loop of maneuvers (closed: the last knot flows back into the first) */
  knots: Knot[];
  /** scales the lean and the rail roll (1 = the full carve), the compression depth, the arm abduction (beginners ride arms-out) */
  carve: number; compression: number; armsOutDeg: number;
  /** maneuver cross-fade (ms) into each pose */
  fadeMs: Record<PoseName, number>;
  /** low-frequency balance sway (deg) */
  swayDeg: number;
}
/** Expertise maps onto the app's own levels (UserProfile.skill). Position: Expert tight in the pocket, Intermediate mid-face a moderate
 *  distance out, Beginner out on the shoulder with the simplest moves. The moves are illustration. */
export const SKILLS: Record<Skill, SkillProfile> = {
  Expert: {
    knots: [
      {dt: 0.6, u: -0.75, v: 0.45, move: 'trim', pose: 'trim', comp: 0.45},
      {dt: 0.85, u: -1.05, v: 0.08, move: 'bottom', pose: 'bottom', comp: 1.0},
      {dt: 0.5, u: -0.85, v: 0.45, move: 'bottom', pose: 'climb', comp: 0.55},
      {dt: 0.45, u: -0.55, v: 0.8, move: 'top', pose: 'top', comp: 0.25},
      {dt: 0.5, u: -0.72, v: 0.42, move: 'recover', pose: 'recover', comp: 0.8},
      {dt: 0.6, u: -0.82, v: 0.4, move: 'trim', pose: 'trim', comp: 0.45},
      {dt: 1.1, u: -1.55, v: 0.3, move: 'cutback', pose: 'climb', comp: 0.6},
      {dt: 0.9, u: -0.95, v: 0.58, move: 'cutback', pose: 'top', comp: 0.4},
      {dt: 0.6, u: -0.85, v: 0.35, move: 'pump', pose: 'pump', comp: 0.75},
    ],
    carve: 1, compression: 1, armsOutDeg: 0, fadeMs: {trim: 400, bottom: 280, climb: 300, top: 280, recover: 300, pump: 220}, swayDeg: 0.8,
  },
  Intermediate: {
    knots: [
      {dt: 0.7, u: -1.2, v: 0.42, move: 'trim', pose: 'trim', comp: 0.4},
      {dt: 1.0, u: -1.55, v: 0.12, move: 'bottom', pose: 'bottom', comp: 0.8},
      {dt: 0.6, u: -1.3, v: 0.4, move: 'bottom', pose: 'climb', comp: 0.5},
      {dt: 0.55, u: -1.0, v: 0.7, move: 'top', pose: 'top', comp: 0.3},
      {dt: 0.6, u: -1.15, v: 0.4, move: 'recover', pose: 'recover', comp: 0.65},
      {dt: 0.8, u: -1.3, v: 0.38, move: 'trim', pose: 'trim', comp: 0.4},
      {dt: 1.2, u: -1.9, v: 0.3, move: 'cutback', pose: 'climb', comp: 0.5},
      {dt: 0.9, u: -1.4, v: 0.46, move: 'trim', pose: 'trim', comp: 0.4},
      {dt: 0.7, u: -1.3, v: 0.34, move: 'pump', pose: 'pump', comp: 0.6},
    ],
    carve: 0.7, compression: 0.7, armsOutDeg: 6, fadeMs: {trim: 400, bottom: 320, climb: 320, top: 300, recover: 320, pump: 240}, swayDeg: 1.2,
  },
  Beginner: {
    knots: [
      {dt: 1.0, u: -2.4, v: 0.4, move: 'trim', pose: 'trim', comp: 0.3},
      {dt: 1.4, u: -2.8, v: 0.2, move: 'bottom', pose: 'bottom', comp: 0.5},
      {dt: 1.0, u: -2.55, v: 0.42, move: 'bottom', pose: 'climb', comp: 0.35},
      {dt: 0.9, u: -2.3, v: 0.5, move: 'top', pose: 'trim', comp: 0.3},
      {dt: 1.2, u: -2.45, v: 0.42, move: 'trim', pose: 'trim', comp: 0.3},
      {dt: 1.3, u: -2.7, v: 0.36, move: 'trim', pose: 'pump', comp: 0.35},
    ],
    carve: 0.4, compression: 0.35, armsOutDeg: 18, fadeMs: {trim: 400, bottom: 400, climb: 400, top: 350, recover: 400, pump: 300}, swayDeg: 2.2,
  },
};

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

/** Wave-height style bands (brief part 2): the data shape, filled and wired in the next run. The threshold rule (round the drawn face to
 *  the nearest 0.5 ft before comparing) is fixed here so an hour never flickers between bands. */
export interface StyleBand {id: 'A' | 'B' | 'C'; minFt: number; label: string; lineV: number; pocketFaces: number; aggression: number; compression: number; spray: number; boardFt: [number, number]}
export const BANDS: readonly StyleBand[] = [
  {id: 'A', minFt: 0, label: 'chill, flowing', lineV: 0.55, pocketFaces: 1.0, aggression: 0.3, compression: 0.4, spray: 0.2, boardFt: [5.33, 5.83]},
  {id: 'B', minFt: 4, label: 'aggressive shortboard carving', lineV: 0.45, pocketFaces: 0.6, aggression: 0.9, compression: 0.9, spray: 1.0, boardFt: [5.83, 6.5]},
  {id: 'C', minFt: 10, label: 'big-wave: barrels and straight lines', lineV: 0.6, pocketFaces: 0.8, aggression: 0.6, compression: 0.7, spray: 0.6, boardFt: [6.67, 10]},
];
export const bandFor = (faceFt: number): StyleBand => { const r = Math.round(faceFt * 2) / 2; let b = BANDS[0]; for (const x of BANDS) if (r >= x.minFt) b = x; return b; };
