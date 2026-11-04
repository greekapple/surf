/** The rider's body (spec 2026-11-04, layer C): a pose library sampled once from the v3 clip's keys, blended by the simulation's
 *  cross-faded weights, then procedural layers in the rider's own frame (x along the board with the nose at -x, y up, z toward the wave):
 *  compression (hip drop), the torso kept up on a steep face (spread over three spine bones, limited), head and shoulders leading the
 *  heading with the hips following, arms counter-balancing the rail roll (and held out by beginners), low-frequency idle sway, then
 *  two-bone leg IK pinning both feet to the deck at the stance positions with the soles flat. Every addition is clamped to a human range.
 *  Allocation-free per frame. */
import * as THREE from 'three';
import {BODY, CLIP_FPS, POSE_KEYS, type PoseName, type SkillProfile} from './surfSceneConfig';
import {POSES, S} from './rideSim';

const D2R = Math.PI / 180;
interface Bones {all: THREE.Bone[]; parent: Int16Array; byName: Map<string, number>}
export interface PoseLib {
  /** per pose, per bone: position (3) + quaternion (4) */
  data: Float32Array[]; n: number;
  /** per pose: ankle targets and foot rotations in the rider frame for each leg (l, r) */
  ankle: Float32Array[]; footQ: Float32Array[];
}

/** Sample the clip at each key frame into the library (the mixer is used only here, then discarded). */
export function samplePoses(rig: THREE.Object3D, clip: THREE.AnimationClip): {bones: Bones; lib: PoseLib} {
  const all: THREE.Bone[] = []; rig.traverse((o) => { if ((o as THREE.Bone).isBone) all.push(o as THREE.Bone); });
  const byName = new Map<string, number>(); all.forEach((b, i) => byName.set(b.name, i));
  const parent = new Int16Array(all.length); all.forEach((b, i) => { parent[i] = b.parent && (b.parent as THREE.Bone).isBone ? byName.get(b.parent.name) ?? -1 : -1; });
  const bones: Bones = {all, parent, byName};
  const mixer = new THREE.AnimationMixer(rig); const act = mixer.clipAction(clip); act.play();
  const n = all.length, data: Float32Array[] = [], ankle: Float32Array[] = [], footQ: Float32Array[] = [];
  const inv = new THREE.Matrix4(), M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const saved = rig.matrix.clone(), savedAuto = rig.matrixAutoUpdate; rig.matrixAutoUpdate = false; rig.matrix.identity();
  for (const name of POSES) {
    mixer.setTime(POSE_KEYS[name] / CLIP_FPS); rig.updateMatrixWorld(true); inv.copy(rig.matrixWorld).invert();
    const d = new Float32Array(n * 7);
    all.forEach((b, i) => { d[i * 7] = b.position.x; d[i * 7 + 1] = b.position.y; d[i * 7 + 2] = b.position.z; d[i * 7 + 3] = b.quaternion.x; d[i * 7 + 4] = b.quaternion.y; d[i * 7 + 5] = b.quaternion.z; d[i * 7 + 6] = b.quaternion.w; });
    data.push(d);
    const a = new Float32Array(6), fq = new Float32Array(8);
    (['foot_l', 'foot_r'] as const).forEach((fn, k) => { const f = all[byName.get(fn)!]; M.multiplyMatrices(inv, f.matrixWorld).decompose(p, q, s); a[k * 3] = p.x; a[k * 3 + 1] = p.y; a[k * 3 + 2] = p.z; fq[k * 4] = q.x; fq[k * 4 + 1] = q.y; fq[k * 4 + 2] = q.z; fq[k * 4 + 3] = q.w; });
    ankle.push(a); footQ.push(fq);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(rig); rig.matrix.copy(saved); rig.matrixAutoUpdate = savedAuto;
  return {bones, lib: {data, n, ankle, footQ}};
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

export class RiderBody {
  private readonly bones: Bones; private readonly lib: PoseLib;
  private readonly riderM: THREE.Matrix4[]; private readonly local = new THREE.Matrix4();
  private readonly qa = new THREE.Quaternion(); private readonly qb = new THREE.Quaternion(); private readonly qp = new THREE.Quaternion(); private readonly qd = new THREE.Quaternion();
  private readonly va = new THREE.Vector3(); private readonly vb = new THREE.Vector3(); private readonly vc = new THREE.Vector3(); private readonly vd = new THREE.Vector3(); private readonly ve = new THREE.Vector3();
  private readonly w = new Float32Array(POSES.length);
  private readonly ankleT = new Float32Array(6); private readonly footT = new Float32Array(8);
  private readonly idx: Record<string, number>;
  private readonly upRoot = new THREE.Vector3(0, 1, 0); private readonly rootInv = new THREE.Quaternion(); private readonly feetMid = new THREE.Vector3();
  private readonly legs: {thigh: number; calf: number; foot: number}[];
  /** the blended pose's pelvis height (rider frame) before compression, for the probe */
  hipY = 0;
  constructor(bones: Bones, lib: PoseLib) {
    this.bones = bones; this.lib = lib; this.riderM = bones.all.map(() => new THREE.Matrix4());
    const ix = (n: string) => bones.byName.get(n) ?? -1;
    this.idx = {pelvis: ix('pelvis'), s1: ix('spine_01'), s2: ix('spine_02'), s3: ix('spine_03'), neck: ix('neck_01'), head: ix('head'), armL: ix('upperarm_l'), armR: ix('upperarm_r'), root: ix('Root')};
    this.legs = [{thigh: ix('thigh_l'), calf: ix('calf_l'), foot: ix('foot_l')}, {thigh: ix('thigh_r'), calf: ix('calf_r'), foot: ix('foot_r')}];
    // the rider's up in the Root's frame (the Root carries the Blender -> glTF rotation): from the first pose's Root quaternion
    const r = this.idx.root; if (r >= 0) { const d = lib.data[0]; this.rootInv.set(d[r * 7 + 3], d[r * 7 + 4], d[r * 7 + 5], d[r * 7 + 6]).invert(); this.upRoot.set(0, 1, 0).applyQuaternion(this.rootInv); }
  }
  /** Pose the skeleton from the interpolated state. `st` is the lerped state vector (weights at S.W0..). The rig's own matrix is set by the caller. */
  pose(st: Float64Array, inp: BodyInput) {
    const {all, parent} = this.bones, lib = this.lib, n = lib.n, w = this.w;
    // 1. blend the library (normalised weights; quaternions nlerp'd with a consistent hemisphere)
    let sum = 0; for (let i = 0; i < POSES.length; i++) { w[i] = Math.max(0, st[S.W0 + i]); sum += w[i]; } if (sum < 1e-6) { w[0] = 1; sum = 1; } for (let i = 0; i < POSES.length; i++) w[i] /= sum;
    for (let b = 0; b < n; b++) {
      let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, qw = 0, rx = 0, ry = 0, rz = 0, rw = 1;
      for (let i = 0; i < POSES.length; i++) { const wi = w[i]; if (wi <= 0) continue; const d = lib.data[i], o = b * 7;
        px += wi * d[o]; py += wi * d[o + 1]; pz += wi * d[o + 2];
        let x = d[o + 3], y = d[o + 4], z = d[o + 5], ww = d[o + 6]; if (qw === 0 && qx === 0 && qy === 0 && qz === 0) { rx = x; ry = y; rz = z; rw = ww; }
        if (x * rx + y * ry + z * rz + ww * rw < 0) { x = -x; y = -y; z = -z; ww = -ww; }
        qx += wi * x; qy += wi * y; qz += wi * z; qw += wi * ww; }
      const bone = all[b]; bone.position.set(px, py, pz); bone.quaternion.set(qx, qy, qz, qw).normalize();
    }
    for (let k = 0; k < 6; k++) { let v = 0; for (let i = 0; i < POSES.length; i++) v += w[i] * lib.ankle[i][k]; this.ankleT[k] = v; }
    for (let k = 0; k < 2; k++) { let x = 0, y = 0, z = 0, ww = 0, rx = 0, ry = 0, rz = 0, rw = 1; for (let i = 0; i < POSES.length; i++) { const f = lib.footQ[i]; let a = f[k * 4], b2 = f[k * 4 + 1], c = f[k * 4 + 2], d = f[k * 4 + 3]; if (i === 0) { rx = a; ry = b2; rz = c; rw = d; } if (a * rx + b2 * ry + c * rz + d * rw < 0) { a = -a; b2 = -b2; c = -c; d = -d; } x += w[i] * a; y += w[i] * b2; z += w[i] * c; ww += w[i] * d; } const l = Math.hypot(x, y, z, ww) || 1; this.footT[k * 4] = x / l; this.footT[k * 4 + 1] = y / l; this.footT[k * 4 + 2] = z / l; this.footT[k * 4 + 3] = ww / l; }
    // 2. compression and idle bob on the pelvis (along the rider's up, in the Root's frame)
    const I = this.idx, pr = inp.profile;
    if (I.pelvis >= 0) { const pel = all[I.pelvis]; this.hipY = pel.position.dot(this.upRoot); pel.position.addScaledVector(this.upRoot, -(BODY.compressM * inp.comp) + BODY.idleBobM * inp.idleA); }
    // 3. the chain, parents first, applying each bone's procedural rotation before composing its rider-frame matrix
    const up = inp.upR, tilt = Math.acos(THREE.MathUtils.clamp(up.y, -1, 1));
    const counter = THREE.MathUtils.clamp(BODY.torsoCounterGain * (tilt - BODY.torsoCounterStartDeg * D2R), 0, BODY.torsoCounterMaxDeg * D2R) / 3;
    this.va.set(0, 1, 0).cross(up); const okAxis = this.va.lengthSq() > 1e-8; if (okAxis) this.va.normalize();   // from deck-up toward world-up
    // the whole body above the feet leans from the deck toward the vertical, pivoting about the feet (the leg IK below keeps the soles planted)
    const lean = THREE.MathUtils.clamp(BODY.bodyLeanGain * (tilt - BODY.bodyLeanStartDeg * D2R), 0, BODY.bodyLeanMaxDeg * D2R);
    if (okAxis && lean > 1e-4 && I.pelvis >= 0) {
      const pel = all[I.pelvis]; this.feetMid.set((this.ankleT[0] + this.ankleT[3]) / 2, (this.ankleT[1] + this.ankleT[4]) / 2, (this.ankleT[2] + this.ankleT[5]) / 2).applyQuaternion(this.rootInv);   // feet midpoint, Root frame
      this.vd.copy(this.va).applyQuaternion(this.rootInv).normalize(); this.qd.setFromAxisAngle(this.vd, lean);
      pel.position.sub(this.feetMid).applyQuaternion(this.qd).add(this.feetMid); pel.quaternion.premultiply(this.qd);
    }
    const lead = THREE.MathUtils.clamp(inp.lead, -BODY.leadMaxDeg * D2R, BODY.leadMaxDeg * D2R) * inp.mirror, rollArm = THREE.MathUtils.clamp(inp.roll * BODY.armRollShare, -BODY.limits.armSwing * D2R, BODY.limits.armSwing * D2R) * inp.mirror;
    const sway = pr.swayDeg * D2R, armsOut = pr.armsOutDeg * D2R;
    for (let b = 0; b < n; b++) {
      const bone = all[b], par = parent[b];
      // the procedural delta for this bone, as (axis in the rider frame, angle)
      let ang = 0; const ax = this.vb;
      if (b === I.s1 || b === I.s2 || b === I.s3) { if (okAxis && counter > 1e-4) { ax.copy(this.va); ang = counter; } }
      if (ang !== 0) this.applyDelta(b, par, ax, ang);
      if (b === I.s3) this.applyDelta(b, par, this.vc.set(0, 1, 0), lead * BODY.leadShare.spine);
      else if (b === I.neck) this.applyDelta(b, par, this.vc.set(0, 1, 0), THREE.MathUtils.clamp(lead * BODY.leadShare.neck, -BODY.limits.neck * D2R, BODY.limits.neck * D2R));
      else if (b === I.head) this.applyDelta(b, par, this.vc.set(0, 1, 0), THREE.MathUtils.clamp(lead * BODY.leadShare.head, -BODY.limits.head * D2R, BODY.limits.head * D2R));
      else if (b === I.pelvis) this.applyDelta(b, par, this.vc.set(0, 1, 0), lead * BODY.leadShare.pelvis);
      else if (b === I.s2) { this.applyDelta(b, par, this.vc.set(1, 0, 0), sway * 0.5 * inp.idleA); this.applyDelta(b, par, this.vc.set(0, 0, 1), sway * 0.5 * inp.idleB); }
      else if (b === I.armL) { this.applyDelta(b, par, this.vc.set(1, 0, 0), rollArm); this.applyDelta(b, par, this.vc.set(0, 0, 1), -armsOut); }
      else if (b === I.armR) { this.applyDelta(b, par, this.vc.set(1, 0, 0), rollArm); this.applyDelta(b, par, this.vc.set(0, 0, 1), armsOut); }
      this.compose(b, par);
    }
    // 4. legs: two-bone IK to the blended ankle targets, the soles flat (the foot's rider-frame rotation from the library)
    for (let k = 0; k < 2; k++) this.solveLeg(this.legs[k], k);
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
  private solveLeg(L: {thigh: number; calf: number; foot: number}, k: number) {
    if (L.thigh < 0 || L.calf < 0 || L.foot < 0) return;
    const {parent} = this.bones, H = this.va, K0 = this.vb, A0 = this.vc, T = this.vd, tmp = this.ve;
    H.setFromMatrixPosition(this.riderM[L.thigh]); K0.setFromMatrixPosition(this.riderM[L.calf]); A0.setFromMatrixPosition(this.riderM[L.foot]);
    T.set(this.ankleT[k * 3], this.ankleT[k * 3 + 1], this.ankleT[k * 3 + 2]);
    const l1 = K0.distanceTo(H), l2 = A0.distanceTo(K0); if (l1 < 1e-4 || l2 < 1e-4) return;
    // knee interior angle from the reach, within the human range
    let d = T.distanceTo(H); const dMax = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - BODY.limits.kneeMin) * D2R)), dMin = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - BODY.limits.kneeMax) * D2R));
    d = THREE.MathUtils.clamp(d, dMin, dMax);
    tmp.copy(T).sub(H); const tl = tmp.length(); if (tl < 1e-6) return; tmp.multiplyScalar(1 / tl);   // d-hat
    // the knee's plane: the current (blended) knee, made perpendicular to d-hat
    K0.sub(H); const along = K0.dot(tmp); K0.addScaledVector(tmp, -along); if (K0.lengthSq() < 1e-8) K0.set(0, 0, 1).addScaledVector(tmp, -tmp.z); K0.normalize();   // p-hat
    const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    // the new knee K = H + l1 (cosA d-hat + sinA p-hat); the thigh turns from its current knee direction to K - H
    A0.copy(tmp).multiplyScalar(cosA).addScaledVector(K0, sinA);                      // K - H (unit)
    tmp.setFromMatrixPosition(this.riderM[L.calf]).sub(H).normalize();                 // current knee direction
    this.qd.setFromUnitVectors(tmp, A0); this.applyQuat(L.thigh, parent[L.thigh], this.qd); this.compose(L.thigh, parent[L.thigh]); this.compose(L.calf, L.thigh); this.compose(L.foot, L.calf);
    // the calf turns so the ankle lands on the target
    K0.setFromMatrixPosition(this.riderM[L.calf]); tmp.setFromMatrixPosition(this.riderM[L.foot]).sub(K0).normalize(); A0.copy(T).sub(K0).normalize();
    this.qd.setFromUnitVectors(tmp, A0); this.applyQuat(L.calf, L.thigh, this.qd); this.compose(L.calf, L.thigh); this.compose(L.foot, L.calf);
    // the foot: its rider-frame rotation is the library's (sole on the deck)
    this.qa.set(this.footT[k * 4], this.footT[k * 4 + 1], this.footT[k * 4 + 2], this.footT[k * 4 + 3]);
    this.qp.setFromRotationMatrix(this.riderM[L.calf]).invert(); this.bones.all[L.foot].quaternion.copy(this.qp).multiply(this.qa); this.compose(L.foot, L.calf);
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
