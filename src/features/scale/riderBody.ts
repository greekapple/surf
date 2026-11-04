/** The rider's body (spec 2026-11-04 layer C; round 4 per 2026-11-04-3d-surfer-realism Appendix M): a pose library sampled once from
 *  the v4 clip's keys, blended by the simulation's cross-faded weights (the arms on their own slower weights), then procedural layers in
 *  the rider's own frame (x along the board with the nose at -x, y up, z toward the toe side / the wave on frontside): compression (hip
 *  drop), the body kept up on a steep face (a limited lean about the feet, the hip height preserved), the torso counter spread over three
 *  spine bones, head and shoulders leading the heading with the hips following, low-frequency idle sway; then two-bone IK for the legs
 *  (feet pinned to the deck at the stance, the knee pole over the toes: M1) and for the arms (M7: each hand solved to its library position
 *  in the BOARD frame, so the torso's twist turns the shoulders without swinging the hands; the elbow pole down and back). Every addition
 *  is clamped to a human range. Allocation-free per frame. */
import * as THREE from 'three';
import {BODY, CLIP_FPS, POSE_KEYS, type PoseName, type SkillProfile} from './surfSceneConfig';
import {POSES, S} from './rideSim';

const D2R = Math.PI / 180;
/** max(x, 0) with a C1 onset over width w (a corner in a layer's gain is a kink in every joint it drives: the monitor's jerk). */
const smoothOnset = (x: number, w: number) => (x <= 0 ? 0 : x >= w ? x - w / 2 : (x * x) / (2 * w));
interface Bones {all: THREE.Bone[]; parent: Int16Array; byName: Map<string, number>}
/** a two-bone chain plus its calibration from the library's first pose: each bone's own axis and its bend (pole) axis in the bone's local
 *  frame, so the solve builds a full rotation (direction + roll) and never picks an arbitrary roll from a minimal rotation */
interface Chain {a: number; b: number; c: number; axA: THREE.Vector3; plA: THREE.Vector3; axB: THREE.Vector3; plB: THREE.Vector3; lastP: THREE.Vector3}
export interface PoseLib {
  /** per pose, per bone: position (3) + quaternion (4) */
  data: Float32Array[]; n: number;
  /** per pose: ankle targets and foot rotations in the rider frame for each leg (l, r) */
  ankle: Float32Array[]; footQ: Float32Array[];
  /** per pose: each foot's forward direction (ankle -> ball, rider frame, unit) for the knee pole */
  footF: Float32Array[];
  /** per pose: wrist targets and hand rotations in the rider frame for each arm (l, r) */
  wrist: Float32Array[]; handQ: Float32Array[];
}

/** Sample the clip at each key frame into the library (the mixer is used only here, then discarded). */
export function samplePoses(rig: THREE.Object3D, clip: THREE.AnimationClip): {bones: Bones; lib: PoseLib} {
  const all: THREE.Bone[] = []; rig.traverse((o) => { if ((o as THREE.Bone).isBone) all.push(o as THREE.Bone); });
  const byName = new Map<string, number>(); all.forEach((b, i) => byName.set(b.name, i));
  const parent = new Int16Array(all.length); all.forEach((b, i) => { parent[i] = b.parent && (b.parent as THREE.Bone).isBone ? byName.get(b.parent.name) ?? -1 : -1; });
  const bones: Bones = {all, parent, byName};
  const mixer = new THREE.AnimationMixer(rig); const act = mixer.clipAction(clip); act.play();
  const n = all.length, data: Float32Array[] = [], ankle: Float32Array[] = [], footQ: Float32Array[] = [], footF: Float32Array[] = [], wrist: Float32Array[] = [], handQ: Float32Array[] = [];
  const inv = new THREE.Matrix4(), M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const saved = rig.matrix.clone(), savedAuto = rig.matrixAutoUpdate; rig.matrixAutoUpdate = false; rig.matrix.identity();
  const dur = clip.duration;
  const endPt = (names: readonly [string, string], a: Float32Array, fq: Float32Array) => names.forEach((fn, k) => { const f = all[byName.get(fn)!]; M.multiplyMatrices(inv, f.matrixWorld).decompose(p, q, s); a[k * 3] = p.x; a[k * 3 + 1] = p.y; a[k * 3 + 2] = p.z; fq[k * 4] = q.x; fq[k * 4 + 1] = q.y; fq[k * 4 + 2] = q.z; fq[k * 4 + 3] = q.w; });
  for (const name of POSES) {
    // a key past the clip's end (an older asset without that pose) falls back to its substitute
    let key = POSE_KEYS[name] / CLIP_FPS; if (key > dur + 1e-3) key = POSE_KEYS[BODY.poseFallback[name] ?? 'trim'] / CLIP_FPS;
    mixer.setTime(Math.min(key, dur)); rig.updateMatrixWorld(true); inv.copy(rig.matrixWorld).invert();
    const d = new Float32Array(n * 7);
    all.forEach((b, i) => { d[i * 7] = b.position.x; d[i * 7 + 1] = b.position.y; d[i * 7 + 2] = b.position.z; d[i * 7 + 3] = b.quaternion.x; d[i * 7 + 4] = b.quaternion.y; d[i * 7 + 5] = b.quaternion.z; d[i * 7 + 6] = b.quaternion.w; });
    data.push(d);
    const a = new Float32Array(6), fq = new Float32Array(8), wa = new Float32Array(6), wq = new Float32Array(8), ff = new Float32Array(6), bq = new Float32Array(8);
    endPt(['foot_l', 'foot_r'], a, fq); endPt(['hand_l', 'hand_r'], wa, wq);
    if (byName.has('ball_l') && byName.has('ball_r')) { endPt(['ball_l', 'ball_r'], ff, bq); for (let k = 0; k < 2; k++) { const dx = ff[k * 3] - a[k * 3], dy = ff[k * 3 + 1] - a[k * 3 + 1], dz = ff[k * 3 + 2] - a[k * 3 + 2], l = Math.hypot(dx, dy, dz) || 1; ff[k * 3] = dx / l; ff[k * 3 + 1] = dy / l; ff[k * 3 + 2] = dz / l; } } else for (let k = 0; k < 2; k++) ff[k * 3 + 2] = 1;
    ankle.push(a); footQ.push(fq); footF.push(ff); wrist.push(wa); handQ.push(wq);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(rig); rig.matrix.copy(saved); rig.matrixAutoUpdate = savedAuto;
  return {bones, lib: {data, n, ankle, footQ, footF, wrist, handQ}};
}

/** Per-frame inputs from the interpolated state and the scene. */
export interface BodyInput {
  /** world up expressed in the rider frame (the deck's tilt and roll are in it) */
  upR: THREE.Vector3;
  /** rail roll (rad), heading lead (rad), compression 0..1, idle sines */
  roll: number; lead: number; comp: number; idleA: number; idleB: number;
  /** +1 frontside (the rider frame maps to the world with det +1), -1 backside (mirrored across the board's long axis) */
  mirror: number;
  profile: SkillProfile;
}

const blendQ = (lib: Float32Array[], w: Float32Array, k: number, out: Float32Array, o: number) => {
  let x = 0, y = 0, z = 0, ww = 0, rx = 0, ry = 0, rz = 0, rw = 1;
  for (let i = 0; i < POSES.length; i++) { const f = lib[i]; let a = f[k * 4], b2 = f[k * 4 + 1], c = f[k * 4 + 2], d = f[k * 4 + 3]; if (i === 0) { rx = a; ry = b2; rz = c; rw = d; } if (a * rx + b2 * ry + c * rz + d * rw < 0) { a = -a; b2 = -b2; c = -c; d = -d; } x += w[i] * a; y += w[i] * b2; z += w[i] * c; ww += w[i] * d; }
  const l = Math.hypot(x, y, z, ww) || 1; out[o] = x / l; out[o + 1] = y / l; out[o + 2] = z / l; out[o + 3] = ww / l;
};

export class RiderBody {
  private readonly bones: Bones; private readonly lib: PoseLib;
  private readonly riderM: THREE.Matrix4[]; private readonly local = new THREE.Matrix4();
  private readonly qa = new THREE.Quaternion(); private readonly qb = new THREE.Quaternion(); private readonly qp = new THREE.Quaternion(); private readonly qd = new THREE.Quaternion();
  private readonly va = new THREE.Vector3(); private readonly vb = new THREE.Vector3(); private readonly vc = new THREE.Vector3(); private readonly vd = new THREE.Vector3(); private readonly ve = new THREE.Vector3(); private readonly pole = new THREE.Vector3(); private readonly tgt = new THREE.Vector3(); private readonly vf = new THREE.Vector3(); private readonly vg = new THREE.Vector3(); private readonly mA = new THREE.Matrix4(); private readonly mB = new THREE.Matrix4();
  private readonly w = new Float32Array(POSES.length); private readonly wa = new Float32Array(POSES.length); private readonly isArm: boolean[];
  readonly ankleT = new Float32Array(6); private readonly footT = new Float32Array(8); private readonly footFT = new Float32Array(6); private readonly wristT = new Float32Array(6); private readonly handT = new Float32Array(8);
  readonly idx: Record<string, number>;
  private readonly upRoot = new THREE.Vector3(0, 1, 0); private readonly rootInv = new THREE.Quaternion(); private readonly feetMid = new THREE.Vector3(); private readonly feetMidR = new THREE.Vector3(); private readonly qLean = new THREE.Quaternion();
  private readonly legs: Chain[]; private readonly arms: Chain[];
  private readonly iBarrel = POSES.indexOf('barrel'); private readonly iPig = POSES.indexOf('pigdog');
  /** the blended pose's pelvis height (rider frame) before compression, for the probe */
  hipY = 0;
  constructor(bones: Bones, lib: PoseLib) {
    this.bones = bones; this.lib = lib; this.riderM = bones.all.map(() => new THREE.Matrix4());
    const ix = (n: string) => bones.byName.get(n) ?? -1;
    this.idx = {pelvis: ix('pelvis'), s1: ix('spine_01'), s2: ix('spine_02'), s3: ix('spine_03'), neck: ix('neck_01'), head: ix('head'), root: ix('Root')};
    const chain = (a: string, b: string, c: string): Chain => ({a: ix(a), b: ix(b), c: ix(c), axA: new THREE.Vector3(0, 1, 0), plA: new THREE.Vector3(0, 0, 1), axB: new THREE.Vector3(0, 1, 0), plB: new THREE.Vector3(0, 0, 1), lastP: new THREE.Vector3(0, 0, 1)});
    this.legs = [chain('thigh_l', 'calf_l', 'foot_l'), chain('thigh_r', 'calf_r', 'foot_r')];
    this.arms = [chain('upperarm_l', 'lowerarm_l', 'hand_l'), chain('upperarm_r', 'lowerarm_r', 'hand_r')];
    this.isArm = bones.all.map((b) => /^(clavicle|upperarm|lowerarm|hand)_/.test(b.name));
    // the rider's up in the Root's frame (the Root carries the Blender -> glTF rotation): from the first pose's Root quaternion
    const r = this.idx.root; if (r >= 0) { const d = lib.data[0]; this.rootInv.set(d[r * 7 + 3], d[r * 7 + 4], d[r * 7 + 5], d[r * 7 + 6]).invert(); this.upRoot.set(0, 1, 0).applyQuaternion(this.rootInv); }
    this.calibrate();
  }
  /** From the library's first pose: each chain bone's axis (toward the next joint) and bend axis (the middle joint's offset from the
   *  end-to-end line, the clip's own knee/elbow direction) in that bone's local frame. */
  private calibrate() {
    const {all, parent} = this.bones, d = this.lib.data[0];
    for (let b = 0; b < this.lib.n; b++) { const o = b * 7; all[b].position.set(d[o], d[o + 1], d[o + 2]); all[b].quaternion.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6]); this.compose(b, parent[b]); }
    const H = this.va, K = this.vb, A = this.vc, bend = this.vd, ax = this.ve, R = this.qp;
    for (const L of [...this.legs, ...this.arms]) {
      if (L.a < 0 || L.b < 0 || L.c < 0) continue;
      H.setFromMatrixPosition(this.riderM[L.a]); K.setFromMatrixPosition(this.riderM[L.b]); A.setFromMatrixPosition(this.riderM[L.c]);
      ax.copy(A).sub(H).normalize(); bend.copy(K).sub(H); bend.addScaledVector(ax, -bend.dot(ax)); if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1); bend.normalize();
      R.setFromRotationMatrix(this.riderM[L.a]).invert(); L.axA.copy(K).sub(H).normalize().applyQuaternion(R); L.plA.copy(bend).applyQuaternion(R); L.plA.addScaledVector(L.axA, -L.plA.dot(L.axA)).normalize();
      R.setFromRotationMatrix(this.riderM[L.b]).invert(); L.axB.copy(A).sub(K).normalize().applyQuaternion(R); L.plB.copy(bend).applyQuaternion(R); L.plB.addScaledVector(L.axB, -L.plB.dot(L.axB)).normalize();
      L.lastP.copy(bend);
    }
  }
  /** Pose the skeleton from the interpolated state. `st` is the lerped state vector (weights at S.W0..). The rig's own matrix is set by the caller. */
  pose(st: Float64Array, inp: BodyInput) {
    const {all, parent} = this.bones, lib = this.lib, n = lib.n, w = this.w, wa = this.wa;
    // 1. blend the library (normalised weights; quaternions nlerp'd with a consistent hemisphere). The arms blend on their own slower
    //    weights (S.WA0..): a pose change swings the hands through the longest arcs. Backside rides the pig-dog instead of the crouch.
    const norm = (dst: Float32Array, o: number) => { let sum = 0; for (let i = 0; i < POSES.length; i++) { dst[i] = Math.max(0, st[o + i]); sum += dst[i]; } if (sum < 1e-6) { dst[0] = 1; sum = 1; }
      if (this.iBarrel >= 0 && this.iPig >= 0) { if (inp.mirror < 0) { dst[this.iPig] += dst[this.iBarrel]; dst[this.iBarrel] = 0; } else { dst[this.iBarrel] += dst[this.iPig]; dst[this.iPig] = 0; } }
      for (let i = 0; i < POSES.length; i++) dst[i] /= sum; };
    norm(w, S.W0); norm(wa, S.WA0);
    for (let b = 0; b < n; b++) {
      let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, qw = 0, rx = 0, ry = 0, rz = 0, rw = 1;
      const wb = this.isArm[b] ? wa : w;
      for (let i = 0; i < POSES.length; i++) { const wi = wb[i]; if (wi <= 0) continue; const d = lib.data[i], o = b * 7;
        px += wi * d[o]; py += wi * d[o + 1]; pz += wi * d[o + 2];
        let x = d[o + 3], y = d[o + 4], z = d[o + 5], ww = d[o + 6]; if (qw === 0 && qx === 0 && qy === 0 && qz === 0) { rx = x; ry = y; rz = z; rw = ww; }
        if (x * rx + y * ry + z * rz + ww * rw < 0) { x = -x; y = -y; z = -z; ww = -ww; }
        qx += wi * x; qy += wi * y; qz += wi * z; qw += wi * ww; }
      const bone = all[b]; bone.position.set(px, py, pz); bone.quaternion.set(qx, qy, qz, qw).normalize();
    }
    for (let k = 0; k < 6; k++) { let v = 0, h = 0, f = 0; for (let i = 0; i < POSES.length; i++) { v += w[i] * lib.ankle[i][k]; h += wa[i] * lib.wrist[i][k]; f += w[i] * lib.footF[i][k]; } this.ankleT[k] = v; this.wristT[k] = h; this.footFT[k] = f; }
    for (let k = 0; k < 2; k++) { blendQ(lib.footQ, w, k, this.footT, k * 4); blendQ(lib.handQ, wa, k, this.handT, k * 4); }
    // 2. compression and idle bob on the pelvis (along the rider's up, in the Root's frame)
    const I = this.idx, pr = inp.profile;
    if (I.pelvis >= 0) { const pel = all[I.pelvis]; this.hipY = pel.position.dot(this.upRoot); pel.position.addScaledVector(this.upRoot, -(BODY.compressM * inp.comp) + BODY.idleBobM * inp.idleA); }
    // 3. the chain, parents first, applying each bone's procedural rotation before composing its rider-frame matrix
    const up = inp.upR, tilt = Math.acos(THREE.MathUtils.clamp(up.y, -1, 1));
    // backside the chest faces down the slope, so the torso counters the deck toward the vertical (over the heels, toward the wave) harder
    const cGain = inp.mirror < 0 ? BODY.torsoCounterBackside.gain : BODY.torsoCounterGain, cMax = inp.mirror < 0 ? BODY.torsoCounterBackside.maxDeg : BODY.torsoCounterMaxDeg;
    const counter = THREE.MathUtils.clamp(cGain * smoothOnset(tilt - BODY.torsoCounterStartDeg * D2R, 10 * D2R), 0, cMax * D2R) / 3;
    this.va.set(0, 1, 0).cross(up); const okAxis = this.va.lengthSq() > 1e-8; if (okAxis) this.va.normalize();   // from deck-up toward world-up
    // the body above the feet leans from the deck toward the vertical, pivoting about the feet (the leg IK below keeps the soles planted);
    // the pelvis keeps its height off the deck (a pure pivot lowered the hips by a quarter at 42 deg and folded the knees, round 3)
    // the lean is an angulation of the whole standing body (a skier on a traverse): the knee poles and the hand targets turn with it below,
    // so the legs still bend forward in the body's own frame (a pivot alone left the knees over the toes and the hips behind: a chair)
    const lean = THREE.MathUtils.clamp(BODY.bodyLeanGain * smoothOnset(tilt - BODY.bodyLeanStartDeg * D2R, 8 * D2R), 0, BODY.bodyLeanMaxDeg * D2R);
    this.feetMidR.set((this.ankleT[0] + this.ankleT[3]) / 2, (this.ankleT[1] + this.ankleT[4]) / 2, (this.ankleT[2] + this.ankleT[5]) / 2);   // feet midpoint, rider frame
    const leanOn = okAxis && lean > 1e-4; if (leanOn) this.qLean.setFromAxisAngle(this.va, lean); else this.qLean.identity();
    if (leanOn && I.pelvis >= 0) {
      const pel = all[I.pelvis]; this.feetMid.copy(this.feetMidR).applyQuaternion(this.rootInv);   // feet midpoint, Root frame
      this.vd.copy(this.va).applyQuaternion(this.rootInv).normalize(); this.qd.setFromAxisAngle(this.vd, lean);
      const h0 = pel.position.dot(this.upRoot) - this.feetMid.dot(this.upRoot);
      pel.position.sub(this.feetMid).applyQuaternion(this.qd).add(this.feetMid); pel.quaternion.premultiply(this.qd);
      pel.position.addScaledVector(this.upRoot, h0 * (1 - Math.cos(lean)) * BODY.bodyLeanKeepHeight);
    }
    const lead = THREE.MathUtils.clamp(inp.lead, -BODY.leadMaxDeg * D2R, BODY.leadMaxDeg * D2R) * inp.mirror;
    const sway = pr.swayDeg * D2R;
    for (let b = 0; b < n; b++) {
      const par = parent[b];
      // the procedural delta for this bone, as (axis in the rider frame, angle)
      let ang = 0; const ax = this.vb;
      if (b === I.s1 || b === I.s2 || b === I.s3) { if (okAxis && counter > 1e-4) { ax.copy(this.va); ang = counter; } }
      if (ang !== 0) this.applyDelta(b, par, ax, ang);
      if (b === I.s3) this.applyDelta(b, par, this.vc.set(0, 1, 0), lead * BODY.leadShare.spine);
      else if (b === I.neck) this.applyDelta(b, par, this.vc.set(0, 1, 0), THREE.MathUtils.clamp(lead * BODY.leadShare.neck, -BODY.limits.neck * D2R, BODY.limits.neck * D2R));
      else if (b === I.head) this.applyDelta(b, par, this.vc.set(0, 1, 0), THREE.MathUtils.clamp(lead * BODY.leadShare.head, -BODY.limits.head * D2R, BODY.limits.head * D2R));
      else if (b === I.pelvis) this.applyDelta(b, par, this.vc.set(0, 1, 0), lead * BODY.leadShare.pelvis);
      else if (b === I.s2) { this.applyDelta(b, par, this.vc.set(1, 0, 0), sway * 0.5 * inp.idleA); this.applyDelta(b, par, this.vc.set(0, 0, 1), sway * 0.5 * inp.idleB); }
      this.compose(b, par);
    }
    // 4. legs: two-bone IK to the blended ankle targets, the knee pole over that foot's own toes (its forward direction, flattened onto
    //    the deck) splayed a little outward, the soles flat (the foot's rider-frame rotation from the library)
    for (let k = 0; k < 2; k++) {
      this.pole.set(THREE.MathUtils.clamp(BODY.kneePole.footShare * this.footFT[k * 3], -BODY.kneePole.maxX, BODY.kneePole.maxX), 0, Math.max(0.3, this.footFT[k * 3 + 2])); this.pole.normalize(); this.pole.x += BODY.kneePole.splay * (k === BODY.frontLeg ? -1 : 1);
      if (leanOn) this.pole.applyQuaternion(this.qLean);
      this.tgt.set(this.ankleT[k * 3], this.ankleT[k * 3 + 1], this.ankleT[k * 3 + 2]);
      this.solveChain(this.legs[k], this.tgt, this.pole, this.footT, k, BODY.limits.kneeMin, BODY.limits.kneeMax);
    }
    // 5. arms (M7): each hand solved to its blended library position in the rider (board) frame, shifted a little to counter the rail roll
    //    (toward the high rail) and out by the skill's arms-out; the elbow pole down and behind; the hand's rotation from the library
    const rollShift = THREE.MathUtils.clamp(inp.roll * BODY.armRollShare, -0.25, 0.25) * inp.mirror, out = Math.sin(pr.armsOutDeg * D2R) * BODY.armsOutReachM;
    for (let k = 0; k < 2; k++) {
      const sx = k === BODY.frontLeg ? -1 : 1;   // the front arm reaches toward the nose
      this.tgt.set(this.wristT[k * 3] + sx * out, this.wristT[k * 3 + 1], this.wristT[k * 3 + 2] - rollShift);
      if (leanOn) this.tgt.sub(this.feetMidR).applyQuaternion(this.qLean).add(this.feetMidR);
      this.pole.set(sx * BODY.elbowPole.out, BODY.elbowPole.down, BODY.elbowPole.back);   // out and behind the chest: a hanging hand never lies along the pole
      this.solveChain(this.arms[k], this.tgt, this.pole, this.handT, k, BODY.limits.elbowMin, BODY.limits.elbowMax);
    }
  }
  private compose(b: number, par: number) {
    const bone = this.bones.all[b]; this.local.compose(bone.position, bone.quaternion, bone.scale);
    if (par >= 0) this.riderM[b].multiplyMatrices(this.riderM[par], this.local); else this.riderM[b].copy(this.local);
  }
  /** Rotate bone b about a rider-frame axis through its head (expressed in its parent's frame, premultiplied); the parent's matrix must be current. */
  private applyDelta(b: number, par: number, axisR: THREE.Vector3, ang: number) {
    if (Math.abs(ang) < 1e-6) return;
    const bone = this.bones.all[b];
    if (par >= 0) { this.qp.setFromRotationMatrix(this.riderM[par]).invert(); this.vd.copy(axisR).applyQuaternion(this.qp).normalize(); } else this.vd.copy(axisR);
    this.qd.setFromAxisAngle(this.vd, ang); bone.quaternion.premultiply(this.qd);
  }
  /** Two-bone IK: the chain a -> b -> c (hip/knee/ankle or shoulder/elbow/wrist) reaches target T (rider frame) with the middle joint on the
   *  side of `poleR` (rider frame), the bend within [minDeg, maxDeg]; the end bone takes its rider-frame rotation from `endQ[k]`. */
  private solveChain(L: Chain, T: THREE.Vector3, poleR: THREE.Vector3, endQ: Float32Array, k: number, minDeg: number, maxDeg: number) {
    if (L.a < 0 || L.b < 0 || L.c < 0) return;
    const {parent} = this.bones, H = this.va, K0 = this.vb, A0 = this.vc, tmp = this.ve;
    H.setFromMatrixPosition(this.riderM[L.a]); K0.setFromMatrixPosition(this.riderM[L.b]); A0.setFromMatrixPosition(this.riderM[L.c]);
    const l1 = K0.distanceTo(H), l2 = A0.distanceTo(K0); if (l1 < 1e-4 || l2 < 1e-4) return;
    // the joint's interior angle from the reach, within the human range
    let d = T.distanceTo(H); const dMax = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - minDeg) * D2R)), dMin = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - maxDeg) * D2R));
    d = THREE.MathUtils.clamp(d, dMin, dMax);
    tmp.copy(T).sub(H); const tl = tmp.length(); if (tl < 1e-6) return; tmp.multiplyScalar(1 / tl);   // d-hat
    // the bend plane: the pole made perpendicular to d-hat; near-degenerate (the target along the pole) keeps last frame's plane
    K0.copy(poleR); K0.addScaledVector(tmp, -K0.dot(tmp));
    if (K0.lengthSq() < 0.01) { K0.copy(L.lastP); K0.addScaledVector(tmp, -K0.dot(tmp)); if (K0.lengthSq() < 1e-6) K0.set(0, 0, 1).addScaledVector(tmp, -tmp.z); }
    K0.normalize(); L.lastP.copy(K0);   // p-hat
    const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    // the joint K = H + l1 (cosA d-hat + sinA p-hat); the first bone's full rotation maps its axis to K - H and its bend axis into the plane
    A0.copy(tmp).multiplyScalar(cosA).addScaledVector(K0, sinA);                      // K - H (unit)
    this.setBoneRotation(L.a, parent[L.a], L.axA, L.plA, A0, K0); this.compose(L.a, parent[L.a]); this.compose(L.b, L.a); this.compose(L.c, L.b);
    // the second bone: its axis toward the (clamped) target, its bend axis in the same plane
    K0.setFromMatrixPosition(this.riderM[L.b]); A0.copy(T).sub(K0).normalize();
    this.setBoneRotation(L.b, L.a, L.axB, L.plB, A0, L.lastP); this.compose(L.b, L.a); this.compose(L.c, L.b);
    // the end bone: its rider-frame rotation is the library's (sole on the deck, the hand's set)
    this.qa.set(endQ[k * 4], endQ[k * 4 + 1], endQ[k * 4 + 2], endQ[k * 4 + 3]);
    this.qp.setFromRotationMatrix(this.riderM[L.b]).invert(); this.bones.all[L.c].quaternion.copy(this.qp).multiply(this.qa); this.compose(L.c, L.b);
  }
  /** Set bone b's local quaternion so that, in the rider frame, its local `ax` points along `dir` and its local bend axis `pl` lies along
   *  `bendDir` (both unit; bendDir is made perpendicular to dir). A full rotation, so the roll is continuous. */
  private setBoneRotation(b: number, par: number, ax: THREE.Vector3, pl: THREE.Vector3, dir: THREE.Vector3, bendDir: THREE.Vector3) {
    const m = this.mA, n = this.mB, x = this.vf, y = this.vg;
    y.copy(bendDir).addScaledVector(dir, -bendDir.dot(dir)); if (y.lengthSq() < 1e-8) y.set(0, 0, 1).addScaledVector(dir, -dir.z); y.normalize(); x.crossVectors(dir, y);
    m.makeBasis(dir, y, x);                                   // target basis (columns): axis, bend, their cross
    x.crossVectors(ax, pl); n.makeBasis(ax, pl, x);           // the bone's local basis
    m.multiply(n.transpose());                                // R = target * local^-1
    this.qd.setFromRotationMatrix(m);
    const bone = this.bones.all[b];
    if (par >= 0) { this.qp.setFromRotationMatrix(this.riderM[par]).invert(); bone.quaternion.copy(this.qp).multiply(this.qd); } else bone.quaternion.copy(this.qd);
  }
  /** Premultiply a rider-frame rotation onto bone b (through its parent's frame). */
  private applyQuat(b: number, par: number, qR: THREE.Quaternion) {
    const bone = this.bones.all[b];
    if (par >= 0) { this.qp.setFromRotationMatrix(this.riderM[par]); this.qb.copy(this.qp).invert().multiply(qR).multiply(this.qp); bone.quaternion.premultiply(this.qb); }
    else bone.quaternion.premultiply(qR);
  }
  get boneList() { return this.bones.all; }
}
export const poseIndex = (name: PoseName) => POSES.indexOf(name);
