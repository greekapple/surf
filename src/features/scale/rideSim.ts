/** The rider's motion, without three.js (spec 2026-11-04-3d-real-surfing, stages 2-4): a line planner in wave-relative coordinates
 *  (u along the crest from the moving curl in face heights, v height on the face), the board placed by the same height function the
 *  shader draws (`waterHeightAt`, the CPU mirror) at its centre, ends and rails, critically damped springs on a fixed 120 Hz step, and
 *  a flat state vector the render interpolates. Seeded from the forecast hour: the same ride every time. Crest frame: x along the crest
 *  (shoulder at -x, break point at 0+), y up, z seaward. Illustration of the hour, never a measurement. */
import type {Skill} from '../../models/index.ts';
import {type Atlas, breakX, faceDistanceAt, facePointInto} from './waveAtlas.ts';
import {BOARD, BODY, type Knot, type Move, type PoseName, RIDE, SIM, SKILLS, type SkillProfile, type StyleBand, bandFor, composeBody} from './surfSceneConfig.ts';

export const G = 9.81;
export const POSES: readonly PoseName[] = ['trim', 'bottom', 'climb', 'top', 'recover', 'pump', 'barrel', 'pigdog', 'cutback', 'trimB', 'bottomB', 'climbB', 'topB', 'recoverB', 'pumpB', 'cutbackB'];
export type Stance = 'regular' | 'goofy';

/** FNV-1a of a string: the forecast hour's seed (spot id + hour). */
export function hashSeed(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
/** mulberry32: a small seeded generator for the plan's jitter and the idle phases. */
export function rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** The stance is not in the profile: a seeded default per spot-hour (recorded assumption; a profile field needs the user's approval). */
export const defaultStance = (seed: number): Stance => (rng(seed ^ 0x5bd1e995)() < 0.5 ? 'regular' : 'goofy');
/** Frontside: the chest faces the wave. The model is goofy frontside on a left; a regular-footer on a left rides backside. */
export const isFrontside = (stance: Stance, dir: 'left' | 'right') => (stance === 'goofy') === (dir === 'left');

export const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** C1 soft max(a, 0) with width k. */
const smax0 = (a: number, k: number) => 0.5 * (a + Math.sqrt(a * a + k * k));

/** A critically damped spring toward a moving target: the closed-form step, stable for any dt. */
export class Spring {
  x = 0; v = 0;
  set(x: number) { this.x = x; this.v = 0; return this; }
  step(target: number, dt: number, w: number) {
    const e = Math.exp(-w * dt), x0 = this.x - target, k = (this.v + w * x0) * dt;
    this.x = (x0 + k) * e + target; this.v = (this.v - k * w) * e; return this.x;
  }
}

/** The ride plan: takeoff, the body of maneuvers, the exit, then (unseen) back to the takeoff: a non-uniform Catmull-Rom spline in
 *  (u, v, comp) over one closed period, seeded jitter. `rideEnd` is the loop time of the exit's last knot (the rider is faded out past it). */
export interface Plan {skill: Skill; profile: SkillProfile; band: StyleBand; knots: Knot[]; times: Float64Array; period: number; rideEnd: number}
/** The band comes from the drawn face height (ft, rounded to 0.5 before the threshold); the expertise filters and scales its moves; the
 *  seed decides the optional maneuvers and jitters every duration and height. */
export function buildPlan(skill: Skill, seed: number, faceM: number): Plan {
  const profile = SKILLS[skill], r = rng(seed), s = Math.max(RIDE.durScaleMin, Math.sqrt(Math.max(0.3, faceM) / RIDE.refFaceM));
  const faceFt = faceM / 0.3048, band = bandFor(faceFt);
  const body = composeBody(band, profile, (w) => r() < w);
  const takeoff = profile.takeoff.map((k, i) => (i === 0 ? k : {...k, dt: k.dt * band.dropScale}));   // the drop: later and steeper on a big wave
  const seq = [...takeoff, ...body, ...profile.exit];
  const knots: Knot[] = seq.map((k) => ({...k, dt: k.dt * s * (1 + RIDE.jitterDur * (2 * r() - 1)), v: clamp(k.v + RIDE.jitterV * (2 * r() - 1), RIDE.vMin, 0.85)}));
  const times = new Float64Array(knots.length); for (let i = 1; i < knots.length; i++) times[i] = times[i - 1] + knots[i].dt;
  return {skill, profile, band, knots, times, period: times[knots.length - 1] + knots[0].dt, rideEnd: times[knots.length - 1]};
}
/** 0..1 visibility at loop time tau: in over the takeoff's start, out over the exit's end, 0 on the way back. */
export function visibilityAt(p: Plan, tau: number): number {
  const P = p.period; let t = tau % P; if (t < 0) t += P;
  const sm = (x: number) => { const k = clamp(x, 0, 1); return k * k * (3 - 2 * k); };
  return sm(t / RIDE.fadeInS) * (1 - sm((t - (p.rideEnd - RIDE.fadeOutS)) / RIDE.fadeOutS));
}
export interface PlanSample {u: number; v: number; comp: number; du: number; dv: number; seg: number; move: Move; pose: PoseName; /** min distance from the curl (face heights), lerped between the knots */ ahead: number;
  /** R8: the slope cap (deg) of the knot being approached, and the board's pivot past its path (deg), smoothstepped from the passed
   *  knot's to the approached knot's (a snap's pivot winds up over the hit segment and unwinds over the recovery) */
  cap: number; pivot: number}
/** The plan at loop time tau (wrapped): position, velocity (per s) and the segment's move and target pose. Hermite with Catmull-Rom tangents. */
export function planAt(p: Plan, tau: number, out: PlanSample): PlanSample {
  const n = p.knots.length, T = p.times, P = p.period; let t = tau % P; if (t < 0) t += P;
  let k = n - 1; for (let i = 0; i < n - 1; i++) if (t < T[i + 1]) { k = i; break; }
  // knot times unrolled around the loop: index -1 is the last knot one period earlier, n is the first knot one period later
  const tAt = (i: number) => (i < 0 ? T[i + n] - P : i >= n ? T[i - n] + P : T[i]);
  const k1 = (k + 1) % n, km = (k + n - 1) % n, kp = (k + 2) % n;
  const t0 = T[k], t1 = tAt(k + 1), tm = tAt(k - 1), tp = tAt(k + 2);
  const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const d00 = (6 * s2 - 6 * s) / h, d10 = (3 * s2 - 4 * s + 1) / h, d01 = (-6 * s2 + 6 * s) / h, d11 = (3 * s2 - 2 * s) / h;
  const K = p.knots, a = K[k], b = K[k1], m = K[km], q = K[kp];
  const ev = (f: (x: Knot) => number, d: boolean) => { const m0 = (f(b) - f(m)) / (t1 - tm), m1 = (f(q) - f(a)) / (tp - t0); return d ? d00 * f(a) + d10 * h * m0 + d01 * f(b) + d11 * h * m1 : h00 * f(a) + h10 * h * m0 + h01 * f(b) + h11 * h * m1; };
  out.u = ev((x) => x.u, false); out.v = ev((x) => x.v, false); out.comp = ev((x) => x.comp, false); out.du = ev((x) => x.u, true); out.dv = ev((x) => x.v, true);
  const aa = a.ahead ?? RIDE.minAheadFaces, ab = b.ahead ?? RIDE.minAheadFaces; out.ahead = aa + (ab - aa) * s;
  out.seg = k; out.move = b.move; out.pose = b.pose;
  const sm = s * s * (3 - 2 * s); out.cap = b.cap ?? RIDE.slopeCapDeg; out.pivot = (a.pivot ?? 0) * (1 - sm) + (b.pivot ?? 0) * sm;
  return out;
}

/** The highest height fraction whose face slope stays under the cap at (x, t): bisection on facePointInto. */
const FP = new Float64Array(4), PN = new Float64Array(4), PT = new Float64Array(4), PW = new Float64Array(4), PB = new Float64Array(4);
export function maxFracAt(atlas: Atlas, x: number, t: number, capRad: number): number {
  let lo = 0.03, hi = 0.95;
  for (let j = 0; j < 10; j++) { const mid = (lo + hi) / 2; facePointInto(atlas, x, mid, t, FP); if (FP[2] <= capRad) lo = mid; else hi = mid; }
  return lo;
}

// state layout (Float64Array): the render interpolates prev -> cur
export const S = {X: 0, Y: 1, Z: 2, FX: 3, FY: 4, FZ: 5, UX: 6, UY: 7, UZ: 8, ROLL: 9, COMP: 10, LEAD: 11, IDLE_A: 12, IDLE_B: 13, T: 14, U: 15, V: 16, XB: 17, SPEED: 18, SEG: 19, VX: 20, YAW: 21, VZ: 22, VY: 23, NX: 24, NY: 25, NZ: 26, BRIDGE: 27, WX: 28, WY: 29, WZ: 30, VIS: 31, W0: 32, /** the arms' own (slower) pose weights */ WA0: 32 + POSES.length} as const;
export const STATE_N = S.WA0 + POSES.length;

/** The rider simulation for one wave: fixed steps, every input continuous, nothing random per step. */
export class RiderSim {
  readonly cur = new Float64Array(STATE_N); readonly prev = new Float64Array(STATE_N);
  plan: Plan; atlas: Atlas; flowX: number; seed: number; stance: Stance; H: number;
  /** R8: set by the viewer with the stance and the wave's direction; the snap's arm drop (the frontside key's throw) only applies frontside */
  frontside = true;
  /** R8: latched through the snap's hit: the snap key's arm weight fades out fast only after a snap, not after the kick-out (which blends through the same key) */
  private snapArmDrop = false;
  boardL: number = BOARD.lengthM; boardW: number = BOARD.widthM; boardBottom = 0;
  private tau = 0; private acc = 0; private started = false;
  private readonly xbS = new Spring(); private readonly capS = new Spring(); private readonly yawS = new Spring(); private readonly rollS = new Spring(); private readonly compS = new Spring(); private readonly leadS = new Spring();
  private readonly fitF = [new Spring(), new Spring(), new Spring()]; private readonly fitU = [new Spring(), new Spring(), new Spring()];
  private readonly wS: Spring[] = POSES.map(() => new Spring()); private readonly waS: Spring[] = POSES.map(() => new Spring());
  private readonly ps: PlanSample = {u: 0, v: 0, comp: 0, du: 0, dv: 0, seg: 0, move: 'trim', pose: 'trim', ahead: RIDE.minAheadFaces, cap: RIDE.slopeCapDeg, pivot: 0};
  /** R8: a second sample a little ahead, for the arms' early drop out of the snap */
  private readonly psArm: PlanSample = {u: 0, v: 0, comp: 0, du: 0, dv: 0, seg: 0, move: 'trim', pose: 'trim', ahead: RIDE.minAheadFaces, cap: RIDE.slopeCapDeg, pivot: 0};
  private readonly idlePhase: [number, number];
  private railMid = 0; private rbEff = BOARD.widthM / 2; private endMeas = 0; private lastSlope = 0.8; private lastHf = 1.5; private endSagExcess = 0; private rx = 0; private ry = 0; private rz = 0;
  readonly stats = {steps: 0, maxFracNow: 1, slopeNow: 0, xbNow: 0, minAheadM: 0, sagNow: 0, endSagNow: 0, pxyNow: 0, pxzNow: 0, railLowNow: 0, endLowNow: 0};
  constructor(atlas: Atlas, skill: Skill, seed: number, flowX: number, stance: Stance | null, t0: number) {
    this.atlas = atlas; this.H = atlas.meta.face_m; this.seed = seed; this.flowX = flowX; this.plan = buildPlan(skill, seed, this.H);
    this.stance = stance ?? defaultStance(seed); const r = rng(seed ^ 0x9e3779b9); this.idlePhase = [r() * 2 * Math.PI, r() * 2 * Math.PI];
    this.cur[S.T] = t0; this.tau = (seed % 1000) / 1000 * this.plan.rideEnd;   // the ride starts at a seeded phase (the first one is already under way)
  }
  /** Replace the wave (an hour change) keeping the loop phase; the springs re-seat on the next step. */
  setWave(atlas: Atlas, flowX: number, skill: Skill, seed: number, stance: Stance | null) {
    const same = skill === this.plan.skill && seed === this.seed;
    this.atlas = atlas; this.H = atlas.meta.face_m; this.flowX = flowX; this.seed = seed;
    if (!same) { this.plan = buildPlan(skill, seed, this.H); this.stance = stance ?? defaultStance(seed); } else if (stance) this.stance = stance;
    this.started = false;
  }
  /** The board mesh's size and where its bottom plane sits below its origin (m, <= 0): the bottom is what rides the face. */
  setBoard(lengthM: number, widthM: number, bottomM = 0) { this.boardL = lengthM; this.boardW = widthM; this.boardBottom = Math.min(0, bottomM); }
  /** Advance by a frame's wall time in fixed steps; returns the interpolation alpha for the render. */
  advance(frameDt: number): number {
    const h = 1 / SIM.hz; this.acc += Math.min(SIM.maxFrameS, frameDt); let n = 0;
    while (this.acc >= h && n < SIM.maxStepsPerFrame) { this.prev.set(this.cur); this.step(h); this.acc -= h; n++; }
    if (n === SIM.maxStepsPerFrame) this.acc = 0;   // a long stall: drop the backlog rather than fast-forward
    return this.acc / h;
  }
  private step(dt: number) {
    const c = this.cur, a = this.atlas, m = a.meta, H = this.H, t = c[S.T] + dt, pr = this.plan.profile;
    c[S.T] = t; this.tau += dt; this.stats.steps++;
    const ps = planAt(this.plan, this.tau, this.ps), u0 = ps.u, seg0 = ps.seg, pose0 = ps.pose, comp0 = ps.comp;
    // the curl: the break point this instant, followed through a spring (the rider does not twitch with every section pulse)
    const xbNow = breakX(m, t); this.stats.xbNow = xbNow;
    if (!this.started) this.xbS.set(xbNow); const xb = this.xbS.step(xbNow, dt, RIDE.curlFollowW);
    // along the crest: never closer to the break point than the minimum (soft), whatever the plan says
    const minAhead = ps.ahead < 0 ? ps.ahead * H : Math.max(ps.ahead * H, RIDE.minAheadM);   // a barrel knot sits BEHIND the break point (inside the tube: negative ahead)
    let x = xb + ps.u * H; x -= smax0(x - (xb - minAhead), 0.25 * minAhead);   // C1 soft limit, no branch
    // on the face: the planned height, kept under the rideable slope cap (soft), the slope at the point
    // the cap keeps the wave-side rail (rb up the face from the centre) under the slope cap too, not just the centre
    const capNow = maxFracAt(a, x, t, ps.cap * Math.PI / 180) - RIDE.capMarginV - RIDE.endSagGain * this.endSagExcess * (1 - Math.min(1, Math.abs(ps.pivot) / RIDE.pivotSagFreeDeg)) / Math.max(0.2, this.lastHf) - RIDE.capRailShare * (0.5 * this.boardW - BOARD.probe.railIn) * Math.sin(this.lastSlope) / Math.max(0.2, this.lastHf); if (!this.started) this.capS.set(capNow); const cap = this.capS.step(capNow, dt, RIDE.capFollowW); this.stats.maxFracNow = cap;
    const v = Math.max(RIDE.vMin, ps.v - smax0(ps.v - cap, RIDE.capSoftV));
    facePointInto(a, x, v, t, FP); const fy = FP[0], slope = FP[2], Hf = Math.max(0.2, FP[3]); this.stats.slopeNow = slope; this.lastSlope = slope; this.lastHf = Hf;
    const z = -fy, y = FP[1];   // the board's bottom centre: this profile point, the one the shader draws
    // velocity (crest frame) from the step; over the water the x flow streams past at flowX
    const vx = this.started ? (x - this.rx) / dt : 0, vy = this.started ? (y - this.ry) / dt : 0, vz = this.started ? (z - this.rz) / dt : 0; this.rx = x; this.ry = y; this.rz = z;   // the point on the face, before any bridge
    // the face's tangent basis at the centre, from short chords ON the face (the same profile the shader draws): L0 along the crest toward
    // the shoulder (down the line), A up the face, N = L0 x A toward the air side (no sign flip past the vertical)
    const ea = BOARD.endPoint * 0.5 * this.boardL, rb = 0.5 * this.boardW - BOARD.probe.railIn, kv = Math.sin(slope) / Hf;   // arc up the face -> height fraction
    const eT = ea, rT = rb;   // the tangent basis from the board's own span (shorter chords amplified the profile's sampling noise: 18 deg board steps)
    facePointInto(a, x - eT, v, t, PN); facePointInto(a, x + eT, v, t, PT); facePointInto(a, x, v + rT * kv, t, PW); facePointInto(a, x, v - rT * kv, t, PB);
    // the water streams past along the face's own x-tangent (the shader offsets its texture along the surface's x lines): dP/dx at fixed v,
    // x component 1. Near the curl the face at a given height bends toward the beach, so this tangent leaves the crest axis by 15-25 deg;
    // taking the flow along the bare axis put a quarter of the "velocity" through the face (run 2's heading error on hollow pocket walls).
    const pxy = (PT[1] - PN[1]) / (2 * eT), pxz = -(PT[0] - PN[0]) / (2 * eT); this.stats.pxyNow = pxy; this.stats.pxzNow = pxz;
    const wx = vx - this.flowX, wy = vy - this.flowX * pxy, wz = vz - this.flowX * pxz, speed = Math.min(RIDE.speedMaxMps, Math.hypot(wx, wy, wz));
    let l0x = -2 * eT, l0y = PN[1] - PT[1], l0z = -(PN[0] - PT[0]), l0n = Math.hypot(l0x, l0y, l0z); l0x /= l0n; l0y /= l0n; l0z /= l0n;
    let a0x = 0, a0y = PW[1] - PB[1], a0z = -(PW[0] - PB[0]), a0n = Math.hypot(a0x, a0y, a0z) || 1; a0x /= a0n; a0y /= a0n; a0z /= a0n;
    let nx = l0y * a0z - l0z * a0y, ny = l0z * a0x - l0x * a0z, nz = l0x * a0y - l0y * a0x, nn0 = Math.hypot(nx, ny, nz) || 1; nx /= nn0; ny /= nn0; nz /= nn0;
    const da = a0x * l0x + a0y * l0y + a0z * l0z; a0x -= da * l0x; a0y -= da * l0y; a0z -= da * l0z; const a0n2 = Math.hypot(a0x, a0y, a0z) || 1; a0x /= a0n2; a0y /= a0n2; a0z /= a0n2;
    // the board's long axis IS the velocity over the water, projected onto the face's tangent plane (the heading check compares exactly these)
    const vn = wx * nx + wy * ny + wz * nz; let tx = wx - vn * nx, ty = wy - vn * ny, tz = wz - vn * nz; const tn = Math.hypot(tx, ty, tz);
    if (!this.started || tn < 0.3) { tx = l0x; ty = l0y; tz = l0z; } else { tx /= tn; ty /= tn; tz /= tn; }
    // the heading in the face plane (for the turn rate and the sag samples): angle from down-the-line toward up-the-face
    const yawT = Math.atan2(tx * a0x + ty * a0y + tz * a0z, tx * l0x + ty * l0y + tz * l0z) + ps.pivot * Math.PI / 180;   // R8: plus the knot's pivot (a snap's board slides its tail up the face past the path)
    if (!this.started) this.yawS.set(yawT);
    const yaw = this.yawS.step(this.yawS.x + wrapPi(yawT - this.yawS.x), dt, BOARD.yawW), yawRate = this.yawS.v;
    // the face's concavity under the board: the ends along the heading and the rails across it, sampled ON the face. The face is a hollow
    // (concave toward the air), so the chord between two contact points sits on the AIR side of the centre's plane: a flat board through
    // the centre has its rails and ends that deep in the water (sag > 0 = buried). Run 2 read the sign the other way (sag was 0 on every
    // concave face), which is why the Expert rails sat 12-16 cm in.
    const ch = Math.cos(yawT), sh = Math.sin(yawT);
    const nx0 = x - ea * ch, nv = v + ea * sh * kv, tx0 = x + ea * ch, tv = v - ea * sh * kv, wx0 = x + rb * sh, wv = v + rb * ch * kv, bx0 = x - rb * sh, bv = v - rb * ch * kv;
    facePointInto(a, nx0, nv, t, PN); facePointInto(a, tx0, tv, t, PT); facePointInto(a, wx0, wv, t, PW); facePointInto(a, bx0, bv, t, PB);
    // the board's plane is the one through its four contact points: it contains the end chord (tail -> nose, the board's axis) and the rail
    // chord, so both rails sit at exactly the rail sag and both ends at the end sag. (Fitting the plane from chords at fixed x and fixed v and
    // then yawing it left the rails 2-4 deg off the yawed chord: one rail 2 cm deeper than the model allowed.)
    let lx = nx0 - tx0, ly = PN[1] - PT[1], lz = -(PN[0] - PT[0]), ln = Math.hypot(lx, ly, lz) || 1; lx /= ln; ly /= ln; lz /= ln;
    let a2x = wx0 - bx0, a2y = PW[1] - PB[1], a2z = -(PW[0] - PB[0]);
    let n2x = ly * a2z - lz * a2y, n2y = lz * a2x - lx * a2z, n2z = lx * a2y - ly * a2x, n2n = Math.hypot(n2x, n2y, n2z) || 1; n2x /= n2n; n2y /= n2n; n2z /= n2n;
    if (n2x * nx + n2y * ny + n2z * nz < 0) { n2x = -n2x; n2y = -n2y; n2z = -n2z; }   // the air side, as the chord basis had it
    if (n2n > 1e-6) { nx = n2x; ny = n2y; nz = n2z; } else { lx = tx; ly = ty; lz = tz; }
    const sagOf = (p: Float64Array, q: Float64Array, px: number, qx: number) => { const mx = (px + qx) / 2 - x, my = (p[1] + q[1]) / 2 - y, mz = -((p[0] + q[0]) / 2) - z; return mx * nx + my * ny + mz * nz; };
    const sagS = sagOf(PW, PB, wx0, bx0), endSagS = sagOf(PN, PT, nx0, tx0); this.stats.sagNow = sagS; this.stats.endSagNow = endSagS;
    const sag = Math.max(0, sagS), endSag = Math.max(0, endSagS);
    // a rigid board rides a concave section on its rails and ends: beyond what the rocker and the rail's own sink absorb, the centre lifts
    // off the face by the rest (a deliberate bridge, reported to the monitor as an allowance; a convex bump is ridden on the centre, the
    // ends in the air, as a real board does) and the line is lowered next step toward a flatter part of the face
    this.endSagExcess = Math.max(0, endSag - BOARD.rockerM); const bridge = Math.min(BOARD.bridgeMaxM + Math.min(1, Math.abs(ps.pivot) / RIDE.pivotSagFreeDeg) * RIDE.pivotBridgeM, Math.max(this.endSagExcess, Math.max(sag, this.started ? this.railMid + this.cur[S.BRIDGE] : 0) - BOARD.railSinkM, this.started ? this.endMeas + this.cur[S.BRIDGE] - BOARD.rockerM : 0));
    // the rail may bank into the turn until it is railDepthM deep: the concavity it already sits in (less the lift) plus rb sin(roll). The
    // depth is the one MEASURED at the rails of the placed board last step (the same faceDistanceAt the monitor reads): the chord model
    // under-read a yawed board's rail by up to a quarter, so the model only seeds the first step
    const railSag = this.started ? this.railMid : Math.max(0, sag - bridge), rbEff = this.started ? this.rbEff : rb;
    const rollCap = Math.min(BOARD.rollMaxDeg * Math.PI / 180, Math.asin(clamp((BOARD.railDepthM - BOARD.railMarginM - railSag) / Math.max(0.05, rbEff), 0, 1)));
    // rail roll into the turn: tan(roll) = v^2/(g r) = v * yawRate / g, scaled by the skill's carve, capped
    const rollT = clamp(Math.atan(speed * yawRate / G) * pr.carve, -rollCap, rollCap);
    if (!this.started) this.rollS.set(rollT); const roll = clamp(this.rollS.step(rollT, dt, BOARD.rollW), -rollCap, rollCap); this.rollS.x = roll;   // the spring may not lag past the cap: the rail depth is the brief's hard limit
    const dl = nx * lx + ny * ly + nz * lz; nx -= dl * lx; ny -= dl * ly; nz -= dl * lz; const nn = Math.hypot(nx, ny, nz); nx /= nn; ny /= nn; nz /= nn;
    if (!this.started) { this.fitF[0].set(lx); this.fitF[1].set(ly); this.fitF[2].set(lz); this.fitU[0].set(nx); this.fitU[1].set(ny); this.fitU[2].set(nz); }
    let Fx = this.fitF[0].step(lx, dt, BOARD.fitW), Fy = this.fitF[1].step(ly, dt, BOARD.fitW), Fz = this.fitF[2].step(lz, dt, BOARD.fitW);
    let Ux = this.fitU[0].step(nx, dt, BOARD.fitW), Uy = this.fitU[1].step(ny, dt, BOARD.fitW), Uz = this.fitU[2].step(nz, dt, BOARD.fitW);
    const fn = Math.hypot(Fx, Fy, Fz); Fx /= fn; Fy /= fn; Fz /= fn;
    const du = Ux * Fx + Uy * Fy + Uz * Fz; Ux -= du * Fx; Uy -= du * Fy; Uz -= du * Fz; const un = Math.hypot(Ux, Uy, Uz); Ux /= un; Uy /= un; Uz /= un;
    // the rail roll: U rotated about F (Rodrigues); a positive yaw rate turns left, so the deck banks toward the left rail (-right = -(F x U))
    const cr = Math.cos(-roll), sr = Math.sin(-roll), kx = Fy * Uz - Fz * Uy, ky = Fz * Ux - Fx * Uz, kz = Fx * Uy - Fy * Ux;   // F x U (right)
    const Rx = Ux * cr + kx * sr, Ry = Uy * cr + ky * sr, Rz = Uz * cr + kz * sr;
    // the placed board's rails against the face (the across axis of the rolled deck, at the bottom plane): their mid depth is the sag the
    // next step's roll cap starts from, their split per sin(roll) the effective rail arm; both smooth, so the cap is too
    { const bxc = x + nx * bridge, byc = y + ny * bridge, bzc = z + nz * bridge, ax = Fy * Rz - Fz * Ry, ay = Fz * Rx - Fx * Rz, az = Fx * Ry - Fy * Rx;   // F x U_rolled: across
      const g1 = faceDistanceAt(a, bxc + rb * ax, byc + rb * ay, bzc + rb * az, t), g2 = faceDistanceAt(a, bxc - rb * ax, byc - rb * ay, bzc - rb * az, t);
      const gH = Math.max(g1, g2), gL = Math.min(g1, g2), sa = Math.abs(Math.sin(roll)); this.railMid = Math.max(0, -(gH + gL) / 2); if (sa > 0.05) this.rbEff = clamp((gH - gL) / (2 * sa), 0.6 * rb, 2 * rb); this.stats.railLowNow = gL;
      // the tail and nose probes too (the monitor's own points): their depth beyond the rocker lifts the centre next step
      const P = BOARD.probe, hl = 0.5 * this.boardL, tdx = hl - P.tailIn, ndx = hl - P.noseIn;   // the nose leads along F, the tail trails
      const gT = faceDistanceAt(a, bxc - tdx * Fx + P.tailUp * Rx, byc - tdx * Fy + P.tailUp * Ry, bzc - tdx * Fz + P.tailUp * Rz, t), gN = faceDistanceAt(a, bxc + ndx * Fx + P.noseUp * Rx, byc + ndx * Fy + P.noseUp * Ry, bzc + ndx * Fz + P.noseUp * Rz, t);
      this.endMeas = Math.max(0, -Math.min(gT, gN)); this.stats.endLowNow = Math.min(gT, gN); }
    // the body: compression (the plan's target plus the turn load), the lead toward the heading ahead, the pose weights with cross-fades
    const compT = clamp(comp0 * pr.compression + 0.5 * Math.min(1, Math.abs(speed * yawRate) / G) * pr.compression, 0, 1);
    if (!this.started) this.compS.set(compT); const comp = this.compS.step(compT, dt, BODY.springW.comp);
    planAt(this.plan, this.tau + BODY.leadAheadS, this.ps);
    const sAlongA = Math.max(0.3, this.flowX - this.ps.du * H), sUpA = this.ps.dv * Hf / Math.sin(Math.max(0.2, slope)), yawA = Math.atan2(sUpA, sAlongA);
    const leadT = clamp(wrapPi(yawA - (yaw - ps.pivot * Math.PI / 180)), -BODY.leadMaxDeg * Math.PI / 180, BODY.leadMaxDeg * Math.PI / 180);   // R8: the lead is against the PATH's heading, not the pivoted board's: the head and shoulders turn with the board through the snap (one piece), and the lead's clamp no longer corners when the pivot winds (13k neck jerk)
    if (!this.started) this.leadS.set(leadT); const lead = this.leadS.step(leadT, dt, BODY.springW.head);
    // R8: out of the snap the arms' target switches to the next pose a little before the body's (the hands peak at the hit, then drop)
    if (pose0 === 'top') this.snapArmDrop = ps.move === 'top';
    let poseArm = pose0; if (pose0 === 'top' && this.snapArmDrop && this.frontside) { planAt(this.plan, this.tau + BODY.snapArmDropLeadS, this.psArm); if (this.psArm.pose !== 'top') poseArm = this.psArm.pose; }
    for (let i = 0; i < POSES.length; i++) {
      const target = POSES[i] === pose0 ? 1 : 0, targetArm = POSES[i] === poseArm ? 1 : 0, w = 4.7 / (pr.fadeMs[POSES[i]] / 1000) / BODY.fadeScale;
      if (!this.started) { this.wS[i].set(target); this.waS[i].set(targetArm); }
      c[S.W0 + i] = this.wS[i].step(target, dt, w); c[S.WA0 + i] = this.waS[i].step(targetArm, dt, w * (POSES[i] === 'top' && targetArm === 0 && this.frontside && this.snapArmDrop ? BODY.snapArmDropFade : BODY.armFadeScale));
    }
    const ph = this.idlePhase, hz1 = BODY.idleHz;
    c[S.IDLE_A] = Math.sin(2 * Math.PI * hz1[0] * t + ph[0]); c[S.IDLE_B] = Math.sin(2 * Math.PI * hz1[1] * t + ph[1]); c[S.VIS] = visibilityAt(this.plan, this.tau);
    const lift = -this.boardBottom;   // the mesh origin sits this far above its bottom plane, along the rolled deck normal
    c[S.X] = x + nx * bridge + Rx * lift; c[S.Y] = y + ny * bridge + Ry * lift; c[S.Z] = z + nz * bridge + Rz * lift; c[S.BRIDGE] = bridge; c[S.FX] = Fx; c[S.FY] = Fy; c[S.FZ] = Fz; c[S.UX] = Rx; c[S.UY] = Ry; c[S.UZ] = Rz; c[S.NX] = Ux; c[S.NY] = Uy; c[S.NZ] = Uz;
    c[S.ROLL] = roll; c[S.COMP] = comp; c[S.LEAD] = lead; c[S.U] = u0; c[S.V] = v; c[S.XB] = xb; c[S.SPEED] = speed; c[S.SEG] = seg0; c[S.VX] = vx; c[S.VY] = vy; c[S.VZ] = vz; c[S.WX] = wx; c[S.WY] = wy; c[S.WZ] = wz; c[S.YAW] = yaw;
    this.stats.minAheadM = xbNow - x;
    if (!this.started) { this.started = true; this.prev.set(c); }
  }
  /** The current segment's move name (for the probe and the monitor). */
  move(): Move { return this.plan.knots[(Math.round(this.cur[S.SEG]) + 1) % this.plan.knots.length].move; }
}

/** Interpolate prev -> cur into `out` (positions, vectors and scalars lerped; the vectors re-normalised by the caller). */
export function lerpState(prev: Float64Array, cur: Float64Array, alpha: number, out: Float64Array) {
  const a = Math.min(1, Math.max(0, alpha)); for (let i = 0; i < STATE_N; i++) out[i] = prev[i] + (cur[i] - prev[i]) * a;
  out[S.SEG] = cur[S.SEG];
}
