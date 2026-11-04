/** The rider's motion, without three.js (spec 2026-11-04-3d-real-surfing, stages 2-4): a line planner in wave-relative coordinates
 *  (u along the crest from the moving curl in face heights, v height on the face), the board placed by the same height function the
 *  shader draws (`waterHeightAt`, the CPU mirror) at its centre, ends and rails, critically damped springs on a fixed 120 Hz step, and
 *  a flat state vector the render interpolates. Seeded from the forecast hour: the same ride every time. Crest frame: x along the crest
 *  (shoulder at -x, break point at 0+), y up, z seaward. Illustration of the hour, never a measurement. */
import type {Skill} from '../../models/index.ts';
import {type Atlas, breakX, facePointInto} from './waveAtlas.ts';
import {BOARD, BODY, type Knot, type Move, type PoseName, RIDE, SIM, SKILLS, type SkillProfile} from './surfSceneConfig.ts';

export const G = 9.81;
export const POSES: readonly PoseName[] = ['trim', 'bottom', 'climb', 'top', 'recover', 'pump'];
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

/** The ride plan: a closed loop of maneuver knots through time, a non-uniform Catmull-Rom spline in (u, v, comp), seeded jitter. */
export interface Plan {skill: Skill; profile: SkillProfile; knots: Knot[]; times: Float64Array; period: number}
export function buildPlan(skill: Skill, seed: number, faceM: number): Plan {
  const profile = SKILLS[skill], r = rng(seed), s = Math.max(RIDE.durScaleMin, Math.sqrt(Math.max(0.3, faceM) / RIDE.refFaceM));
  const knots: Knot[] = profile.knots.map((k) => ({...k, dt: k.dt * s * (1 + RIDE.jitterDur * (2 * r() - 1)), v: clamp(k.v + RIDE.jitterV * (2 * r() - 1), RIDE.vMin, 0.85)}));
  const times = new Float64Array(knots.length); for (let i = 1; i < knots.length; i++) times[i] = times[i - 1] + knots[i].dt;
  return {skill, profile, knots, times, period: times[knots.length - 1] + knots[0].dt};
}
export interface PlanSample {u: number; v: number; comp: number; du: number; dv: number; seg: number; move: Move; pose: PoseName}
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
  out.seg = k; out.move = b.move; out.pose = b.pose; return out;
}

/** The highest height fraction whose face slope stays under the cap at (x, t): bisection on facePointInto. */
const FP = new Float64Array(4), PN = new Float64Array(4), PT = new Float64Array(4), PW = new Float64Array(4), PB = new Float64Array(4);
export function maxFracAt(atlas: Atlas, x: number, t: number, capRad: number): number {
  let lo = 0.03, hi = 0.95;
  for (let j = 0; j < 10; j++) { const mid = (lo + hi) / 2; facePointInto(atlas, x, mid, t, FP); if (FP[2] <= capRad) lo = mid; else hi = mid; }
  return lo;
}

// state layout (Float64Array): the render interpolates prev -> cur
export const S = {X: 0, Y: 1, Z: 2, FX: 3, FY: 4, FZ: 5, UX: 6, UY: 7, UZ: 8, ROLL: 9, COMP: 10, LEAD: 11, IDLE_A: 12, IDLE_B: 13, T: 14, U: 15, V: 16, XB: 17, SPEED: 18, SEG: 19, VX: 20, YAW: 21, VZ: 22, VY: 23, NX: 24, NY: 25, NZ: 26, W0: 27} as const;
export const STATE_N = S.W0 + POSES.length;

/** The rider simulation for one wave: fixed steps, every input continuous, nothing random per step. */
export class RiderSim {
  readonly cur = new Float64Array(STATE_N); readonly prev = new Float64Array(STATE_N);
  plan: Plan; atlas: Atlas; flowX: number; seed: number; stance: Stance; H: number;
  boardL: number = BOARD.lengthM; boardW: number = BOARD.widthM;
  private tau = 0; private acc = 0; private started = false;
  private readonly xbS = new Spring(); private readonly capS = new Spring(); private readonly yawS = new Spring(); private readonly rollS = new Spring(); private readonly compS = new Spring(); private readonly leadS = new Spring();
  private readonly fitF = [new Spring(), new Spring(), new Spring()]; private readonly fitU = [new Spring(), new Spring(), new Spring()];
  private readonly wS: Spring[] = POSES.map(() => new Spring());
  private readonly ps: PlanSample = {u: 0, v: 0, comp: 0, du: 0, dv: 0, seg: 0, move: 'trim', pose: 'trim'};
  private readonly idlePhase: [number, number];
  private capRad = RIDE.slopeCapDeg * Math.PI / 180; private lastSlope = 0.8; private lastHf = 1.5;
  readonly stats = {steps: 0, maxFracNow: 1, slopeNow: 0, xbNow: 0, minAheadM: 0};
  constructor(atlas: Atlas, skill: Skill, seed: number, flowX: number, stance: Stance | null, t0: number) {
    this.atlas = atlas; this.H = atlas.meta.face_m; this.seed = seed; this.flowX = flowX; this.plan = buildPlan(skill, seed, this.H);
    this.stance = stance ?? defaultStance(seed); const r = rng(seed ^ 0x9e3779b9); this.idlePhase = [r() * 2 * Math.PI, r() * 2 * Math.PI];
    this.cur[S.T] = t0; this.tau = (seed % 1000) / 1000 * this.plan.period;   // the loop starts at a seeded phase
  }
  /** Replace the wave (an hour change) keeping the loop phase; the springs re-seat on the next step. */
  setWave(atlas: Atlas, flowX: number, skill: Skill, seed: number, stance: Stance | null) {
    const same = skill === this.plan.skill && seed === this.seed;
    this.atlas = atlas; this.H = atlas.meta.face_m; this.flowX = flowX; this.seed = seed;
    if (!same) { this.plan = buildPlan(skill, seed, this.H); this.stance = stance ?? defaultStance(seed); } else if (stance) this.stance = stance;
    this.started = false;
  }
  setBoard(lengthM: number, widthM: number) { this.boardL = lengthM; this.boardW = widthM; }
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
    const minAhead = Math.max(RIDE.minAheadFaces * H, RIDE.minAheadM);
    let x = xb + ps.u * H; x -= smax0(x - (xb - minAhead), 0.25 * minAhead);   // C1 soft limit, no branch
    // on the face: the planned height, kept under the rideable slope cap (soft), the slope at the point
    // the cap keeps the wave-side rail (rb up the face from the centre) under the slope cap too, not just the centre
    const capNow = maxFracAt(a, x, t, this.capRad) - RIDE.capMarginV - RIDE.capRailShare * BOARD.railPoint * 0.5 * this.boardW * Math.sin(this.lastSlope) / Math.max(0.2, this.lastHf); if (!this.started) this.capS.set(capNow); const cap = this.capS.step(capNow, dt, RIDE.capFollowW); this.stats.maxFracNow = cap;
    const v = Math.max(RIDE.vMin, ps.v - smax0(ps.v - cap, 0.04));
    facePointInto(a, x, v, t, FP); const fy = FP[0], slope = FP[2], Hf = Math.max(0.2, FP[3]); this.stats.slopeNow = slope; this.lastSlope = slope; this.lastHf = Hf;
    const z = -fy, y = FP[1];   // the board's bottom centre: this profile point, the one the shader draws
    // velocity (crest frame) from the step; over the water the x flow streams past at flowX
    const vx = this.started ? (x - c[S.X]) / dt : 0, vy = this.started ? (y - c[S.Y]) / dt : 0, vz = this.started ? (z - c[S.Z]) / dt : 0;
    const wx = vx - this.flowX, speed = Math.min(RIDE.speedMaxMps, Math.hypot(wx, vy, vz));
    // the heading in the face's own plane: angle from "along the crest, down the line" (the shoulder is at -x) toward "up the face"
    const sAlong = Math.max(0.3, -wx), sUp = Math.hypot(vy, vz) * (vy >= 0 ? 1 : -1), yawT = this.started ? Math.atan2(sUp, sAlong) : 0;
    if (!this.started) this.yawS.set(yawT);
    const yaw = this.yawS.step(yawT, dt, BOARD.yawW), yawRate = this.yawS.v;
    // the board on the face: its ends and rails are points ON the face (by along-crest x and height fraction, through the same profile
    // the shader draws), never a column sample that could land on the lip or the back of the wave this close to the crest
    const ch = Math.cos(yaw), sh = Math.sin(yaw), ea = BOARD.endPoint * 0.5 * this.boardL, rb = BOARD.railPoint * 0.5 * this.boardW, kv = Math.sin(slope) / Hf;   // arc up the face -> height fraction
    const nx0 = x - ea * ch, nv = v + ea * sh * kv, tx0 = x + ea * ch, tv = v - ea * sh * kv;                         // nose down the line and up by the heading
    const wx0 = x + rb * sh, wv = v + rb * ch * kv, bx0 = x - rb * sh, bv = v - rb * ch * kv;                          // the wave-side rail and the beach-side rail
    facePointInto(a, nx0, nv, t, PN); facePointInto(a, tx0, tv, t, PT); facePointInto(a, wx0, wv, t, PW); facePointInto(a, bx0, bv, t, PB);
    let lx = nx0 - tx0, ly = PN[1] - PT[1], lz = -(PN[0] - PT[0]), ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
    let ax = wx0 - bx0, ay = PW[1] - PB[1], az = -(PW[0] - PB[0]), an = Math.hypot(ax, ay, az); ax /= an; ay /= an; az /= an;
    // the face's concavity between the rails: how far the chord's midpoint sits inside the face at the centre (the rails of a flat board
    // are that deep already), so the rail roll is capped to keep the buried rail within railDepthM
    const mx = (wx0 + bx0) / 2 - x, my = (PW[1] + PB[1]) / 2 - y, mz = -((PW[0] + PB[0]) / 2) - z, sag = Math.max(0, -(mx * 0 + my * Math.cos(slope) + mz * -Math.sin(slope)));   // along the face normal (toward the beach side), + = chord outside
    const rollCap = Math.min(BOARD.rollMaxDeg * Math.PI / 180, Math.asin(clamp((BOARD.railDepthM - sag) / Math.max(0.05, rb), 0, 1)));
    // rail roll into the turn: tan(roll) = v^2/(g r) = v * yawRate / g, scaled by the skill's carve, capped
    const rollT = clamp(Math.atan(speed * yawRate / G) * pr.carve, -rollCap, rollCap);
    if (!this.started) this.rollS.set(rollT); const roll = this.rollS.step(rollT, dt, BOARD.rollW);
    // the deck normal = long (down the line) x across (up the face): toward the air side of the face, with no sign flip even where the
    // chord between the rails passes the vertical; then made perpendicular to the long axis
    let nx = ly * az - lz * ay, ny = lz * ax - lx * az, nz = lx * ay - ly * ax;
    const dl = nx * lx + ny * ly + nz * lz; nx -= dl * lx; ny -= dl * ly; nz -= dl * lz; const nn = Math.hypot(nx, ny, nz); nx /= nn; ny /= nn; nz /= nn;
    if (!this.started) { this.fitF[0].set(lx); this.fitF[1].set(ly); this.fitF[2].set(lz); this.fitU[0].set(nx); this.fitU[1].set(ny); this.fitU[2].set(nz); }
    let Fx = this.fitF[0].step(lx, dt, BOARD.fitW), Fy = this.fitF[1].step(ly, dt, BOARD.fitW), Fz = this.fitF[2].step(lz, dt, BOARD.fitW);
    let Ux = this.fitU[0].step(nx, dt, BOARD.fitW), Uy = this.fitU[1].step(ny, dt, BOARD.fitW), Uz = this.fitU[2].step(nz, dt, BOARD.fitW);
    const fn = Math.hypot(Fx, Fy, Fz); Fx /= fn; Fy /= fn; Fz /= fn;
    const du = Ux * Fx + Uy * Fy + Uz * Fz; Ux -= du * Fx; Uy -= du * Fy; Uz -= du * Fz; const un = Math.hypot(Ux, Uy, Uz); Ux /= un; Uy /= un; Uz /= un;
    // the rail roll: U rotated about F (Rodrigues); a positive yaw rate turns left, so the deck banks toward the left rail (-right = -(F x U))
    const cr = Math.cos(-roll), sr = Math.sin(-roll), kx = Fy * Uz - Fz * Uy, ky = Fz * Ux - Fx * Uz, kz = Fx * Uy - Fy * Ux;   // F x U (right)
    const Rx = Ux * cr + kx * sr, Ry = Uy * cr + ky * sr, Rz = Uz * cr + kz * sr;
    // the body: compression (the plan's target plus the turn load), the lead toward the heading ahead, the pose weights with cross-fades
    const compT = clamp(comp0 * pr.compression + 0.5 * Math.min(1, Math.abs(speed * yawRate) / G) * pr.compression, 0, 1);
    if (!this.started) this.compS.set(compT); const comp = this.compS.step(compT, dt, BODY.springW.comp);
    planAt(this.plan, this.tau + BODY.leadAheadS, this.ps);
    const sAlongA = Math.max(0.3, this.flowX - this.ps.du * H), sUpA = this.ps.dv * Hf / Math.sin(Math.max(0.2, slope)), yawA = Math.atan2(sUpA, sAlongA);
    const leadT = clamp(wrapPi(yawA - yaw), -BODY.leadMaxDeg * Math.PI / 180, BODY.leadMaxDeg * Math.PI / 180);
    if (!this.started) this.leadS.set(leadT); const lead = this.leadS.step(leadT, dt, BODY.springW.head);
    for (let i = 0; i < POSES.length; i++) { const target = POSES[i] === pose0 ? 1 : 0, w = 4.7 / (pr.fadeMs[POSES[i]] / 1000); if (!this.started) this.wS[i].set(target); c[S.W0 + i] = this.wS[i].step(target, dt, w); }
    const ph = this.idlePhase, hz1 = BODY.idleHz;
    c[S.IDLE_A] = Math.sin(2 * Math.PI * hz1[0] * t + ph[0]); c[S.IDLE_B] = Math.sin(2 * Math.PI * hz1[1] * t + ph[1]);
    c[S.X] = x; c[S.Y] = y; c[S.Z] = z; c[S.FX] = Fx; c[S.FY] = Fy; c[S.FZ] = Fz; c[S.UX] = Rx; c[S.UY] = Ry; c[S.UZ] = Rz; c[S.NX] = Ux; c[S.NY] = Uy; c[S.NZ] = Uz;
    c[S.ROLL] = roll; c[S.COMP] = comp; c[S.LEAD] = lead; c[S.U] = u0; c[S.V] = v; c[S.XB] = xb; c[S.SPEED] = speed; c[S.SEG] = seg0; c[S.VX] = vx; c[S.VY] = vy; c[S.VZ] = vz; c[S.YAW] = yaw;
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
