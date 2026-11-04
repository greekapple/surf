/** Dev-only glitch monitor (spec 2026-11-04, "glitch guard"; round 4 adds the body checks): every frame, the angular change of every
 *  tracked joint and of the board since the last frame, and the board's gap to the water at its centre and at its lowest point. A jump
 *  over the limit (per 1/60 s, scaled by the frame's own dt so a frame-rate hitch is not a glitch) or a board floating or clipping beyond
 *  the limits logs a warning with the maneuver, the time and the joint, and counts. `window.__wave.glitches()` returns the counts so the
 *  toolkit can gate on them.
 *  Body checks (spec 2026-11-04-3d-surfer-realism, verification), sampled on a fixed MONITOR.bodyHz clock so a 200 Hz display does not
 *  turn numerical noise into "jerk": each knee's flexion within the human range and the knee pointing over the toes (the angle between the
 *  knee's offset from the hip-ankle line and the foot's forward direction), the time a wrist spends above its shoulder (the longest run
 *  and the total, outside the moves the spec allows it in), and the peak joint angular acceleration (deg/s^2) with a count of samples
 *  over the limit. Allocation-free per frame. */
import * as THREE from 'three';
import {MONITOR} from './surfSceneConfig';

export interface GlitchEvent {t: number; kind: 'joint' | 'board' | 'float' | 'clip' | 'knee' | 'pole' | 'wrist' | 'jerk' | 'knock' | 'arm' | 'hip' | 'lean' | 'wake' | 'bodyclip'; joint: string; deg: number; gap: number; move: string}
export interface GlitchCounts {
  joint: number; board: number; float: number; clip: number; total: number; frames: number; worstJointDeg: number; worstBoardDeg: number; events: GlitchEvent[];
  /** body checks: counts of bad samples, the measured ranges, the wrist-above-shoulder runs (s) and the jerk peak (deg/s^2) */
  knee: number; pole: number; wrist: number; jerk: number; knock: number; arm: number; hip: number; bodySamples: number;
  /** M9: torso pitch samples outside the range and the measured range (deg, + forward); M10: wake samples pointing off behind and the worst angle */
  lean: number; torsoPitch: [number, number]; wake: number; wakeMaxDeg: number;
  /** R11: body joints inside the wave body (in the water by more than MONITOR.bodyClipM, or inside the lip): bad samples, the deepest (m) and its joint */
  bodyclip: number; bodyClipMin: number; bodyClipJoint: string; /** per move:joint, [bad samples, deepest gap] */ bodyClipBy: Record<string, [number, number]>;
  /** the pelvis' toe-heel offset from the feet midpoint (m, rider frame; + toward the toes): the extremes */
  hipOffMin: number; hipOffMax: number;
  /** the hard gates' measured extremes: min knee-to-knee / foot-to-foot, max knee lateral offset (m), max hand side offset (m), peak arm joint speed (deg/s), fastest hand reversal (s) */
  kneeSepMin: number; kneeLateralMax: number; handSideMax: number; armSpeedPeak: number; armReversalMin: number;
  kneeDeg: [number, number]; kneeDegFront: [number, number]; kneeDegBack: [number, number]; poleMaxDeg: number;
  wristAboveMaxS: number; wristAboveTotalS: number; wristAboveWorldS: number; jerkPeak: number; jerkJoint: string; headYawRangeDeg: number;
}

const D = 180 / Math.PI;
export class GlitchMonitor {
  private objs: THREE.Object3D[] = []; private prevQ: THREE.Quaternion[] = []; private names: string[] = []; private board: THREE.Object3D | null = null;
  private readonly q = new THREE.Quaternion(); private readonly q2 = new THREE.Quaternion(); private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3(); private readonly boardQ = new THREE.Quaternion(); private readonly rigQ = new THREE.Quaternion();
  private primed = false;
  // body-check state (fixed-rate samples)
  private by: Record<string, THREE.Object3D | null> = {};
  private bodyQ: THREE.Quaternion[] = []; private bodyW: Float64Array = new Float64Array(0); private bodyT = -1; private bodyPrimed = 0;
  private readonly a = new THREE.Vector3(); private readonly b = new THREE.Vector3(); private readonly c = new THREE.Vector3(); private readonly d = new THREE.Vector3(); private readonly e = new THREE.Vector3();
  private readonly wristRun = [0, 0]; private wristT = -1;
  private rig: THREE.Object3D | null = null; private readonly rigInv = new THREE.Matrix4(); private slopeRad = 0; private frontside = true;
  private readonly armQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]; private armPrimed = 0;
  private readonly handV = new Float64Array(6); private readonly lastRev = [-1, -1]; private readonly handP = new Float64Array(6);
  private headYawMin = Infinity; private headYawMax = -Infinity;
  readonly counts: GlitchCounts = {joint: 0, board: 0, float: 0, clip: 0, total: 0, frames: 0, worstJointDeg: 0, worstBoardDeg: 0, events: [],
    knee: 0, pole: 0, wrist: 0, jerk: 0, knock: 0, arm: 0, hip: 0, bodySamples: 0, lean: 0, torsoPitch: [Infinity, -Infinity], wake: 0, wakeMaxDeg: 0, bodyclip: 0, bodyClipMin: Infinity, bodyClipJoint: '', bodyClipBy: {}, hipOffMin: Infinity, hipOffMax: -Infinity, kneeSepMin: Infinity, kneeLateralMax: 0, handSideMax: 0, armSpeedPeak: 0, armReversalMin: Infinity, kneeDeg: [Infinity, -Infinity], kneeDegFront: [Infinity, -Infinity], kneeDegBack: [Infinity, -Infinity], poleMaxDeg: 0, wristAboveMaxS: 0, wristAboveTotalS: 0, wristAboveWorldS: 0, jerkPeak: 0, jerkJoint: '', headYawRangeDeg: 0};
  warn = true;
  /** Moves during which a wrist above the shoulder is allowed (the spec: a barrel hand-drag or a big snap). */
  wristAllowed: readonly string[] = MONITOR.wristAllowedMoves;
  /** Track these bones and the board object; call after the skeleton is in the scene. */
  track(bones: THREE.Object3D[], board: THREE.Object3D | null, rig: THREE.Object3D | null = null) {
    this.rig = rig;
    this.objs = bones.slice(); this.prevQ = bones.map(() => new THREE.Quaternion()); this.names = bones.map((b) => b.name); this.board = board; this.primed = false;
    const find = (n: string) => bones.find((b) => b.name === n) ?? null;
    this.by = {thighL: find('thigh_l'), calfL: find('calf_l'), footL: find('foot_l'), ballL: find('ball_l'), thighR: find('thigh_r'), calfR: find('calf_r'), footR: find('foot_r'), ballR: find('ball_r'),
      armL: find('upperarm_l'), handL: find('hand_l'), armR: find('upperarm_r'), handR: find('hand_r'), foreL: find('lowerarm_l'), foreR: find('lowerarm_r'), head: find('head'), spine: find('spine_03'), pelvis: find('pelvis'), neck: find('neck_01')};
    this.bodyQ = bones.map(() => new THREE.Quaternion()); this.bodyW = new Float64Array(bones.length);
    this.reset();
  }
  reset() {
    const c = this.counts; c.joint = c.board = c.float = c.clip = c.total = c.frames = 0; c.worstJointDeg = c.worstBoardDeg = 0; c.events.length = 0; this.primed = false;
    c.knee = c.pole = c.wrist = c.jerk = c.knock = c.arm = c.hip = c.bodySamples = c.lean = c.wake = c.bodyclip = 0; c.torsoPitch = [Infinity, -Infinity]; c.wakeMaxDeg = 0; c.bodyClipMin = Infinity; c.bodyClipJoint = ''; c.bodyClipBy = {}; c.hipOffMin = Infinity; c.hipOffMax = -Infinity; c.kneeSepMin = Infinity; c.kneeLateralMax = c.handSideMax = c.armSpeedPeak = 0; c.armReversalMin = Infinity; this.armQ.forEach((q) => q.identity()); this.armPrimed = 0; this.handV.fill(0); this.lastRev[0] = this.lastRev[1] = -1; c.kneeDeg = [Infinity, -Infinity]; c.kneeDegFront = [Infinity, -Infinity]; c.kneeDegBack = [Infinity, -Infinity]; c.poleMaxDeg = 0; c.wristAboveMaxS = c.wristAboveTotalS = c.wristAboveWorldS = 0; c.jerkPeak = 0; c.jerkJoint = ''; c.headYawRangeDeg = 0;
    this.bodyT = -1; this.bodyPrimed = 0; this.wristRun[0] = this.wristRun[1] = 0; this.wristT = -1; this.headYawMin = Infinity; this.headYawMax = -Infinity;
  }
  /** One frame: world matrices must be current. `frontFoot` names the leg on the nose side ('r' for the goofy model frontside; the mirror
   *  does not change it). Returns the number of new warnings. */
  sample(dt: number, t: number, move: string, centreGap: number, lowGap: number, frontFoot: 'l' | 'r' = 'r', slopeRad = 0, frontside = true): number {
    this.slopeRad = slopeRad; this.frontside = frontside;
    const c = this.counts, scale = Math.max(1, dt / MONITOR.refFrameS), limitJ = MONITOR.jointDegPerFrame * scale, limitB = MONITOR.boardDegPerFrame * scale; let n = 0;
    const emit = (kind: GlitchEvent['kind'], joint: string, deg: number, gap: number) => {
      c[kind]++; c.total++; n++;
      if (c.events.length < MONITOR.keepEvents && c[kind] <= MONITOR.keepPerKind) c.events.push({t: Math.round(t * 1000) / 1000, kind, joint, deg: Math.round(deg * 10) / 10, gap: Math.round(gap * 1000) / 1000, move});
      if (this.warn) console.warn(`[wave glitch] ${kind} ${joint} ${kind === 'joint' || kind === 'board' ? deg.toFixed(1) + ' deg/frame' : kind === 'float' || kind === 'clip' ? gap.toFixed(3) + ' m' : deg.toFixed(1)} during ${move} at t=${t.toFixed(3)} s`);
    };
    for (let i = 0; i < this.objs.length; i++) {
      this.objs[i].matrixWorld.decompose(this.p, this.q, this.s);
      if (this.primed) { const d = 2 * Math.acos(Math.min(1, Math.abs(this.q.dot(this.prevQ[i])))) * D; if (d > c.worstJointDeg) c.worstJointDeg = d; if (d > limitJ) emit('joint', this.names[i], d, centreGap); }
      this.prevQ[i].copy(this.q);
    }
    if (this.board) {
      this.board.matrixWorld.decompose(this.p, this.q, this.s);
      if (this.primed) { const d = 2 * Math.acos(Math.min(1, Math.abs(this.q.dot(this.boardQ)))) * D; if (d > c.worstBoardDeg) c.worstBoardDeg = d; if (d > limitB) emit('board', 'board', d, centreGap); }
      this.boardQ.copy(this.q);
    }
    if (this.primed) {
      if (centreGap > MONITOR.centreGapM) emit('float', 'board', 0, centreGap);
      else if (centreGap < -MONITOR.centreGapM || lowGap < MONITOR.lowestGapM) emit('clip', 'board', 0, Math.min(centreGap, lowGap));
      c.frames++;
    }
    this.primed = true;
    // the body checks on their own clock
    if (this.bodyT < 0 || t - this.bodyT >= 1 / MONITOR.bodyHz) { const h = this.bodyT < 0 ? 0 : t - this.bodyT; this.bodyT = t; n += this.bodySample(h, t, move, frontFoot, emit); }
    return n;
  }
  /** R11 (spec item 4): a body joint inside the wave body. The viewer calls this on the body clock with each joint's signed distance to the
   *  front face (m, - = in the water) and whether the point is inside the water at all (the profile-crossing parity, which also catches the
   *  inside of the lip, where the face distance is positive). Counted when wet by more than MONITOR.bodyClipM below the face, or wet anywhere
   *  past the face (the lip). The hands in the barrel may drag the face (the spec's hand drag). */
  bodyClipSample(t: number, move: string, joint: string, gap: number, wet: boolean) {
    const c = this.counts; if (!wet) return; if (gap < c.bodyClipMin) { c.bodyClipMin = gap; c.bodyClipJoint = joint; }
    if (move === 'barrel' && joint.startsWith('hand')) return;
    if (gap < -MONITOR.bodyClipM || gap > 0) { c.bodyclip++; c.total++; const key = move + ':' + joint, e = c.bodyClipBy[key] ?? (c.bodyClipBy[key] = [0, Infinity]); e[0]++; if (gap < e[1]) e[1] = Math.round(gap * 1000) / 1000; if (c.events.length < MONITOR.keepEvents && c.bodyclip <= MONITOR.keepPerKind) c.events.push({t: Math.round(t * 1000) / 1000, kind: 'bodyclip', joint, deg: 0, gap: Math.round(gap * 1000) / 1000, move}); if (this.warn) console.warn(`[wave glitch] bodyclip ${joint} ${gap.toFixed(3)} m during ${move} at t=${t.toFixed(3)} s`); }
  }
  /** the body-clock tick the viewer should sample the joints on (true once per MONITOR.bodyHz period) */
  bodyTick(t: number): boolean { return this.bodyClipT < 0 || t - this.bodyClipT >= 1 / MONITOR.bodyHz ? (this.bodyClipT = t, true) : false; }
  private bodyClipT = -1;
  /** M10: the wake's first segment (tail -> the previous sample, crest frame) against the board's velocity over the water: it must point
   *  behind (within MONITOR.wakeDeg of straight back). Called by the viewer when it has both. */
  wakeSample(t: number, move: string, dx: number, dz: number, vx: number, vz: number) {
    const c = this.counts, l = Math.hypot(dx, dz), v = Math.hypot(vx, vz); if (l < 0.05 || v < 0.5) return;
    const ang = Math.acos(THREE.MathUtils.clamp(-(dx * vx + dz * vz) / (l * v), -1, 1)) * D;   // 0 = straight behind
    if (ang > c.wakeMaxDeg) c.wakeMaxDeg = ang;
    if (ang > MONITOR.wakeDeg) { c.wake++; c.total++; if (c.events.length < MONITOR.keepEvents && c.wake <= MONITOR.keepPerKind) c.events.push({t: Math.round(t * 1000) / 1000, kind: 'wake', joint: 'wake', deg: Math.round(ang * 10) / 10, gap: 0, move}); if (this.warn) console.warn(`[wave glitch] wake ${ang.toFixed(0)} deg off behind during ${move} at t=${t.toFixed(3)} s`); }
  }
  private bodySample(h: number, t: number, move: string, frontFoot: 'l' | 'r', emit: (kind: GlitchEvent['kind'], joint: string, deg: number, gap: number) => void): number {
    const c = this.counts, B = this.by; let n = 0; c.bodySamples++;
    const pos = (o: THREE.Object3D | null, v: THREE.Vector3) => { if (!o) return false; v.setFromMatrixPosition(o.matrixWorld); return true; };
    // knees: flexion = 180 - the interior angle at the knee; the pole error = angle between the knee's offset from the hip-ankle line and the foot's forward direction
    for (const side of ['L', 'R'] as const) {
      const isFront = (side === 'R') === (frontFoot === 'r');
      if (!pos(B['thigh' + side], this.a) || !pos(B['calf' + side], this.b) || !pos(B['foot' + side], this.c)) continue;
      this.d.copy(this.a).sub(this.b); this.e.copy(this.c).sub(this.b);   // knee -> hip, knee -> ankle
      const flex = 180 - Math.acos(THREE.MathUtils.clamp(this.d.dot(this.e) / (this.d.length() * this.e.length() || 1), -1, 1)) * D;
      const r = isFront ? c.kneeDegFront : c.kneeDegBack; r[0] = Math.min(r[0], flex); r[1] = Math.max(r[1], flex); c.kneeDeg[0] = Math.min(c.kneeDeg[0], flex); c.kneeDeg[1] = Math.max(c.kneeDeg[1], flex);
      if (flex < MONITOR.kneeFlexDeg[0] || flex > MONITOR.kneeFlexDeg[1]) { emit('knee', 'knee_' + side.toLowerCase(), flex, 0); n++; }
      // over the toes: the knee's perpendicular offset from the hip-ankle line vs the foot's forward (foot -> ball)
      if (pos(B['ball' + side], this.e)) {
        this.d.copy(this.c).sub(this.a).normalize();                                   // hip -> ankle
        this.b.sub(this.a); this.b.addScaledVector(this.d, -this.b.dot(this.d));        // knee offset, perpendicular
        this.e.sub(this.c); this.e.addScaledVector(this.d, -this.e.dot(this.d));        // foot forward, perpendicular
        // R7: with the body angulated over the heels (backside, 48 deg) the hip-ankle line runs nearly along the foot, the foot's perpendicular
        // part shrinks to a few cm of noise and the angle against it is meaningless (it read 60-174 deg with the knee plainly over the
        // toes); the check needs at least 10 cm of foot direction across the leg line (the foot is ~0.18 m long: a leg line within ~35 deg
        // of the foot skips it, as the back leg's does at 48 deg of angulation). The knee-separation and lateral gates still watch knocking.
        if (this.b.lengthSq() > 1e-4 && this.e.lengthSq() > 0.01) {
          const pole = Math.acos(THREE.MathUtils.clamp(this.b.dot(this.e) / (this.b.length() * this.e.length()), -1, 1)) * D;
          if (pole > c.poleMaxDeg) c.poleMaxDeg = pole;
          if (pole > MONITOR.kneePoleDeg && flex > 25) { emit('pole', 'knee_' + side.toLowerCase(), pole, 0); n++; }   // a nearly straight leg has no meaningful knee direction
        }
      }
    }
    // HARD GATES (spec section A2/A3), in the rider frame (x along the board, the nose at -x; y up off the deck; z the toe side)
    if (this.rig) {
      this.rigInv.copy(this.rig.matrixWorld).invert();
      const rp = (o: THREE.Object3D | null, v: THREE.Vector3) => { if (!o) return false; v.setFromMatrixPosition(o.matrixWorld).applyMatrix4(this.rigInv); return true; };
      // knees: knee-to-knee against foot-to-foot, and each knee's offset from its hip-foot line along the board
      if (rp(B.calfL, this.a) && rp(B.calfR, this.b) && rp(B.footL, this.c) && rp(B.footR, this.d)) {
        const kk = this.a.distanceTo(this.b), ff = this.c.distanceTo(this.d), ratio = ff > 1e-3 ? kk / ff : 1;
        if (ratio < c.kneeSepMin) c.kneeSepMin = ratio;
        const bad = ratio < MONITOR.kneeSepRatio ? ratio : 0; let lat = 0;
        for (const side of ['L', 'R'] as const) {
          if (!rp(B['thigh' + side], this.e) || !rp(B['calf' + side], this.a) || !rp(B['foot' + side], this.b)) continue;
          this.b.sub(this.e).normalize(); this.a.sub(this.e); this.a.addScaledVector(this.b, -this.a.dot(this.b));   // the knee's offset from the hip-foot line
          const l = Math.abs(this.a.x); if (l > lat) lat = l;
        }
        if (lat > c.kneeLateralMax) c.kneeLateralMax = lat;
        if (bad || lat > MONITOR.kneeLateralM) { emit('knock', bad ? 'knees' : 'knee_lateral', bad ? ratio : lat, 0); n++; }
      }
      // M9: the torso pitch (pelvis -> neck) toward the toes; never backward. Frontside from the deck normal; backside (R7) from the
      // LEG LINE (feet midpoint -> pelvis): there the whole body angulates over the heels toward the vertical on a steep face (the deck
      // normal leans toward the beach by the face slope), and a torso upright over bent knees is what the real sequence shows, not a fold
      // R11: read in the chest's own facing (the horizontal perpendicular of the shoulder line): the yaw layer turns the shoulders up to
      // ~60 deg toward the nose at the hit, where a chest pitched forward has next to no component toward the toes
      if (rp(B.pelvis, this.a) && rp(B.neck, this.b)) {
        this.b.sub(this.a); this.e.set(0, 0, 1); if (rp(B.armR, this.c) && rp(B.armL, this.d)) { this.c.sub(this.d); this.e.set(this.c.z, 0, -this.c.x); if (this.e.lengthSq() < 1e-6) this.e.set(0, 0, 1); this.e.normalize(); }
        let pitch = Math.atan2(this.b.dot(this.e), Math.max(1e-3, this.b.y)) * D;
        if (!this.frontside && rp(B.footL, this.c) && rp(B.footR, this.d)) { this.c.add(this.d).multiplyScalar(0.5); this.a.sub(this.c); pitch -= Math.atan2(this.a.dot(this.e), Math.max(1e-3, this.a.y)) * D; }
        if (pitch < c.torsoPitch[0]) c.torsoPitch[0] = pitch; if (pitch > c.torsoPitch[1]) c.torsoPitch[1] = pitch;
        if (pitch < MONITOR.torsoPitchDeg[0] || pitch > MONITOR.torsoPitchDeg[1]) { emit('lean', 'torso', pitch, 0); n++; }
      }
      // hips over the feet (no "sitting"): the pelvis' toe-heel offset from the feet midpoint
      if (rp(B.pelvis, this.a) && rp(B.footL, this.b) && rp(B.footR, this.c)) {
        const off = this.a.z - 0.5 * (this.b.z + this.c.z); if (off < c.hipOffMin) c.hipOffMin = off; if (off > c.hipOffMax) c.hipOffMax = off;
        const lim = (move === 'trim' || move === 'pump' ? MONITOR.hipOverFeetM.trim : MONITOR.hipOverFeetM.turn) + (this.frontside ? MONITOR.hipOverFeetM.perSlope : MONITOR.hipOverFeetM.perSlopeBackside) * this.slopeRad;
        if (Math.abs(off) > lim) { emit('hip', 'pelvis', off, 0); n++; }
      }
      // arms: hands inside the box, the arm joints' speed, no fast reversal of a hand's travel
      if (rp(B.pelvis, this.e) && rp(B.spine, this.d)) {
        let shoulderY = this.d.y; if (rp(B.armL, this.c) && rp(B.armR, this.d)) shoulderY = 0.5 * (this.c.y + this.d.y); const kneeY = rp(B.calfR, this.c) ? this.c.y : this.e.y - 0.4;
        for (let k = 0; k < 2; k++) {
          const hand = k === 0 ? B.handL : B.handR; if (!rp(hand, this.a)) continue;
          const side = Math.abs(this.a.x - this.e.x); if (side > c.handSideMax) c.handSideMax = side;
          const boxBad = side > MONITOR.handSideM || (this.a.y < kneeY - 0.1 && move !== 'barrel' && move !== 'bottom' && move !== 'takeoff') || (this.a.y > shoulderY + 0.08 && !this.wristAllowed.includes(move));   // R8: the takeoff's drop blends into the same bottom key (the leading hand to the rail); in the barrel crouch the hands hang below the knees (the back hand drags the face: M2); the bottom turn's leading hand reaches the water (R7); above the shoulders only in the moves the wrist check allows
          // the hand's travel in the rider frame: a reversal is the velocity turning back on itself; two within armReversalS is a flail
          if (h > 0 && this.armPrimed >= 1) {
            const vx = (this.a.x - this.handP[k * 3]) / h, vy = (this.a.y - this.handP[k * 3 + 1]) / h, vz = (this.a.z - this.handP[k * 3 + 2]) / h;
            const dot = vx * this.handV[k * 3] + vy * this.handV[k * 3 + 1] + vz * this.handV[k * 3 + 2], sp = Math.hypot(vx, vy, vz), sp0 = Math.hypot(this.handV[k * 3], this.handV[k * 3 + 1], this.handV[k * 3 + 2]);
            if (dot < 0 && sp > 0.25 && sp0 > 0.25) { if (this.lastRev[k] >= 0) { const gap = t - this.lastRev[k]; if (gap < c.armReversalMin) c.armReversalMin = gap; if (gap < MONITOR.armReversalS) { emit('arm', (k === 0 ? 'hand_l' : 'hand_r') + '_reversal', gap, 0); n++; } } this.lastRev[k] = t; }
            this.handV[k * 3] = vx; this.handV[k * 3 + 1] = vy; this.handV[k * 3 + 2] = vz;
          }
          this.handP[k * 3] = this.a.x; this.handP[k * 3 + 1] = this.a.y; this.handP[k * 3 + 2] = this.a.z;
          if (boxBad) { emit('arm', (k === 0 ? 'hand_l' : 'hand_r') + '_box', side, this.a.y); n++; }
        }
        // joint speed: the upper arm relative to the chest, the forearm relative to the upper arm
        const pairs: [THREE.Object3D | null, THREE.Object3D | null, string][] = [[B.spine, B.armL, 'upperarm_l'], [B.armL, B.foreL, 'lowerarm_l'], [B.spine, B.armR, 'upperarm_r'], [B.armR, B.foreR, 'lowerarm_r']];
        for (let i = 0; i < 4; i++) {
          const [par, ch, name] = pairs[i]; if (!par || !ch) continue;
          par.matrixWorld.decompose(this.p, this.q, this.s); this.q.invert(); ch.matrixWorld.decompose(this.p, this.q2, this.s); this.q.multiply(this.q2);   // child in the parent's frame
          if (h > 0 && this.armPrimed >= 1) { const sp = 2 * Math.acos(Math.min(1, Math.abs(this.q.dot(this.armQ[i])))) * D / h; if (sp > c.armSpeedPeak) c.armSpeedPeak = sp; if (sp > MONITOR.armSpeedDegS) { emit('arm', name + '_speed', sp, 0); n++; } }
          this.armQ[i].copy(this.q);
        }
        if (this.armPrimed < 1) this.armPrimed++;
      }
    }
    // wrists above the shoulders (in the rider frame: up off the deck; a hand low by the hip on the wave side of a steep face is higher in
    // the WORLD than the shoulder, as a real surfer's is, so the world reading is kept as information only): the longest run and the total,
    // outside the allowed moves
    const allowed = this.wristAllowed.includes(move);
    if (this.rig) this.rigInv.copy(this.rig.matrixWorld).invert();
    for (let k = 0; k < 2; k++) {
      const arm = k === 0 ? B.armL : B.armR, hand = k === 0 ? B.handL : B.handR;
      if (!pos(arm, this.a) || !pos(hand, this.b)) continue;
      if (this.b.y > this.a.y + MONITOR.wristAboveM && !allowed) c.wristAboveWorldS += h;
      if (this.rig) { this.a.applyMatrix4(this.rigInv); this.b.applyMatrix4(this.rigInv); }
      const above = this.b.y > this.a.y + MONITOR.wristAboveM && !allowed;
      if (above) { this.wristRun[k] += h; c.wristAboveTotalS += h; if (this.wristRun[k] > c.wristAboveMaxS) c.wristAboveMaxS = this.wristRun[k]; if (this.wristRun[k] > MONITOR.wristAboveS && this.wristRun[k] - h <= MONITOR.wristAboveS) { emit('wrist', k === 0 ? 'hand_l' : 'hand_r', this.wristRun[k], 0); n++; } }
      else this.wristRun[k] = 0;
    }
    // jerk: angular acceleration of every tracked joint from three fixed-rate samples
    // (round 5: in the RIG's frame, so the board's own pitch, roll and yaw over the face are not counted as every joint's jerk)
    if (this.rig) { this.rigInv.copy(this.rig.matrixWorld).invert(); this.rigInv.decompose(this.p, this.rigQ, this.s); }   // decompose: the rig carries the rider's scale (and a mirror on a right)
    if (h > 0) for (let i = 0; i < this.objs.length; i++) {
      this.objs[i].matrixWorld.decompose(this.p, this.q, this.s); if (this.rig) this.q.premultiply(this.rigQ);
      const w = 2 * Math.acos(Math.min(1, Math.abs(this.q.dot(this.bodyQ[i])))) * D / h;   // deg/s over the last window
      if (this.bodyPrimed >= 2) { const acc = Math.abs(w - this.bodyW[i]) / h; if (acc > c.jerkPeak) { c.jerkPeak = acc; c.jerkJoint = this.names[i]; } if (acc > MONITOR.jerkDegS2) { emit('jerk', this.names[i], acc, 0); n++; } }
      this.bodyW[i] = w; this.bodyQ[i].copy(this.q);
    } else for (let i = 0; i < this.objs.length; i++) { this.objs[i].matrixWorld.decompose(this.p, this.q, this.s); if (this.rig) this.q.premultiply(this.rigQ); this.bodyQ[i].copy(this.q); }
    if (this.bodyPrimed < 2) this.bodyPrimed++;
    // head stability: the range of the head's yaw relative to the chest (spine_03)
    if (B.head && B.spine) {
      B.spine.matrixWorld.decompose(this.p, this.q, this.s); this.q.invert(); B.head.matrixWorld.decompose(this.p, this.q2, this.s); this.q.multiply(this.q2);
      this.a.set(0, 0, 1).applyQuaternion(this.q); const yaw = Math.atan2(this.a.x, this.a.z) * D;
      this.headYawMin = Math.min(this.headYawMin, yaw); this.headYawMax = Math.max(this.headYawMax, yaw); c.headYawRangeDeg = this.headYawMax - this.headYawMin;
    }
    return n;
  }
}
