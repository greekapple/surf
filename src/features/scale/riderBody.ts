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
import {POSES, S, Spring} from './rideSim';

const D2R = Math.PI / 180;
/** max(x, 0) with a C1 onset over width w (a corner in a layer's gain is a kink in every joint it drives: the monitor's jerk). */
const smoothOnset = (x: number, w: number) => (x <= 0 ? 0 : x >= w ? x - w / 2 : (x * x) / (2 * w));
interface Bones {all: THREE.Bone[]; parent: Int16Array; byName: Map<string, number>}
/** a two-bone chain plus its calibration from the library's first pose: each bone's own axis and its bend (pole) axis in the bone's local
 *  frame, so the solve builds a full rotation (direction + roll) and never picks an arbitrary roll from a minimal rotation */
interface Chain {a: number; b: number; c: number; axA: THREE.Vector3; plA: THREE.Vector3; axB: THREE.Vector3; plB: THREE.Vector3; lastP: THREE.Vector3; /** round 5: the two joints' local rotations follow the solve through a rotational spring (state + angular velocity, parent frame) */ qA: THREE.Quaternion; wA: THREE.Vector3; qB: THREE.Quaternion; wB: THREE.Vector3}
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
  /** the frame's wall time (s): the body's own springs and rate limits (round 5) step by it */
  dt: number;
  /** 0..1: how far the rider is from trim (the non-trim pose weight), for the backside head-over-the-shoulder */
  turning: number;
}

const blendQ = (lib: Float32Array[], w: Float32Array, k: number, out: Float32Array, o: number, primed: boolean) => {
  let x = 0, y = 0, z = 0, ww = 0, rx = 0, ry = 0, rz = 0, rw = 1;
  if (primed) { rx = out[o]; ry = out[o + 1]; rz = out[o + 2]; rw = out[o + 3]; }   // hemisphere against last frame's result (R7), the first pose on the first frame
  for (let i = 0; i < POSES.length; i++) { const f = lib[i]; let a = f[k * 4], b2 = f[k * 4 + 1], c = f[k * 4 + 2], d = f[k * 4 + 3]; if (i === 0 && !primed) { rx = a; ry = b2; rz = c; rw = d; } if (a * rx + b2 * ry + c * rz + d * rw < 0) { a = -a; b2 = -b2; c = -c; d = -d; } x += w[i] * a; y += w[i] * b2; z += w[i] * c; ww += w[i] * d; }
  const l = Math.hypot(x, y, z, ww) || 1; out[o] = x / l; out[o + 1] = y / l; out[o + 2] = z / l; out[o + 3] = ww / l;
};

export class RiderBody {
  private readonly bones: Bones; private readonly lib: PoseLib;
  private readonly riderM: THREE.Matrix4[]; private readonly local = new THREE.Matrix4();
  private readonly qa = new THREE.Quaternion(); private readonly qb = new THREE.Quaternion(); private readonly qp = new THREE.Quaternion(); private readonly qd = new THREE.Quaternion();
  private readonly va = new THREE.Vector3(); private readonly vLean = new THREE.Vector3(); private readonly vb = new THREE.Vector3(); private readonly vc = new THREE.Vector3(); private readonly vd = new THREE.Vector3(); private readonly ve = new THREE.Vector3(); private readonly pole = new THREE.Vector3(); private readonly tgt = new THREE.Vector3(); private readonly vf = new THREE.Vector3(); private readonly vg = new THREE.Vector3(); private readonly mA = new THREE.Matrix4(); private readonly mB = new THREE.Matrix4();
  private readonly w = new Float32Array(POSES.length); private readonly wa = new Float32Array(POSES.length); private readonly isArm: boolean[];
  readonly ankleT = new Float32Array(6); private readonly footT = new Float32Array(8); readonly footFT = new Float32Array(6); private readonly wristT = new Float32Array(6); private readonly handT = new Float32Array(8);
  /** R16: the deck the feet are planted on. `deckAt` is the DRAWN board's deck height at (x, z) in the rider frame (metres, scaled with
   *  the board), `deckRef` the reference board's the keys were authored on (boardMesh.ts REFERENCE_BOARD, the same deck the Blender
   *  builder planted the soles on): each ankle target moves by the difference under the sole's centre and the sole tilts from the
   *  reference deck's normal to the drawn deck's, so a Quiver board's dome and rocker (or the band-scaled model board) carry the feet.
   *  Both null (or the same function) leaves the keys untouched. */
  deckAt: ((x: number, z: number) => number) | null = null; deckRef: ((x: number, z: number) => number) | null = null;
  /** R16: per foot this frame: the deck shift applied (m) and the sole's tilt (deg), for the probe */ readonly footLift = [0, 0]; readonly footTilt = [0, 0];
  private readonly footAdj = new Float32Array(8); private readonly nRef = new THREE.Vector3(); private readonly nNow = new THREE.Vector3(); private readonly qTilt = new THREE.Quaternion();
  /** R16: the sole points per leg (the lowest vertices of the foot mesh in the bind pose, in the foot bone's and the ball bone's own
   *  frames): each frame the lowest of them is planted BODY.soleGapM over the drawn deck by moving the ankle target, whatever the key's
   *  own height was (the builder plants the lower foot per key; the other floated up to 3 cm) */
  private sole: {foot: Float32Array; ball: Float32Array; ballIdx: number}[] | null = null; private readonly qSole = new THREE.Quaternion(); private readonly vSole = new THREE.Vector3();
  /** the sole's gap over the deck after the plant (m), per foot, for the probe */ readonly soleGap = [0, 0];
  /** the mean of the two feet's lifts this frame (m): the pelvis and the hands move by it, so the body follows its feet to the deck */ plantShift = 0;
  /** R16: the feet on the drawn deck. Per leg: the sole tilts from the reference deck's normal to the drawn deck's under the sole's centre
   *  (~9 cm ahead of the ankle along the foot) and the lowest sole point (the foot's and the ball's, rotated as the foot will be) is put
   *  BODY.soleGapM over deckAt(x, z) by moving the ankle target; the targets go back into ankleT, the foot rotations into footAdj. */
  private plantFeet(all: THREE.Bone[]) {
    let sum = 0;
    for (let k = 0; k < 2; k++) {
      this.tgt.set(this.ankleT[k * 3], this.ankleT[k * 3 + 1], this.ankleT[k * 3 + 2]); this.footLift[k] = 0; this.footTilt[k] = 0;
      for (let q = 0; q < 4; q++) this.footAdj[k * 4 + q] = this.footT[k * 4 + q];
      if (this.deckAt && this.deckRef && this.deckAt !== this.deckRef) {
        const cx = this.tgt.x + 0.09 * this.footFT[k * 3], cz = this.tgt.z + 0.09 * this.footFT[k * 3 + 2], e = 0.01, dA = this.deckAt, dR = this.deckRef;
        this.nRef.set(-(dR(cx + e, cz) - dR(cx - e, cz)) / (2 * e), 1, -(dR(cx, cz + e) - dR(cx, cz - e)) / (2 * e)).normalize();
        this.nNow.set(-(dA(cx + e, cz) - dA(cx - e, cz)) / (2 * e), 1, -(dA(cx, cz + e) - dA(cx, cz - e)) / (2 * e)).normalize();
        this.qTilt.setFromUnitVectors(this.nRef, this.nNow); this.footTilt[k] = 2 * Math.acos(Math.min(1, Math.abs(this.qTilt.w))) / D2R;
        this.qa.set(this.footT[k * 4], this.footT[k * 4 + 1], this.footT[k * 4 + 2], this.footT[k * 4 + 3]); this.qa.premultiply(this.qTilt);
        this.footAdj[k * 4] = this.qa.x; this.footAdj[k * 4 + 1] = this.qa.y; this.footAdj[k * 4 + 2] = this.qa.z; this.footAdj[k * 4 + 3] = this.qa.w;
      }
      if (this.sole && this.deckAt) {
        const S = this.sole[k], dA = this.deckAt, qF = this.qSole.set(this.footAdj[k * 4], this.footAdj[k * 4 + 1], this.footAdj[k * 4 + 2], this.footAdj[k * 4 + 3]), pt = this.vSole; let gap = Infinity;
        for (let i = 0; i < S.foot.length; i += 3) { pt.set(S.foot[i], S.foot[i + 1], S.foot[i + 2]).applyQuaternion(qF).add(this.tgt); const g = pt.y - dA(pt.x, pt.z); if (g < gap) gap = g; }
        if (S.ballIdx >= 0 && S.ball.length) { const bb = all[S.ballIdx]; this.qb.copy(qF).multiply(bb.quaternion); this.vd.copy(bb.position).applyQuaternion(qF).add(this.tgt);
          for (let i = 0; i < S.ball.length; i += 3) { pt.set(S.ball[i], S.ball[i + 1], S.ball[i + 2]).applyQuaternion(this.qb).add(this.vd); const g = pt.y - dA(pt.x, pt.z); if (g < gap) gap = g; } }
        if (gap < Infinity) { const lift = THREE.MathUtils.clamp(BODY.soleGapM - gap, -0.08, 0.08); this.ankleT[k * 3 + 1] += lift; this.footLift[k] = lift; this.soleGap[k] = gap + lift; }
      }
      sum += this.footLift[k];
    }
    this.plantShift = sum / 2;
    for (let k = 0; k < 2; k++) this.wristT[k * 3 + 1] += this.plantShift;   // the hands ride with the body
  }
  setSole(mesh: THREE.SkinnedMesh) {
    const names = mesh.skeleton.bones.map((b) => b.name), si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight'), pos = mesh.geometry.getAttribute('position'), v = new THREE.Vector3(), out: typeof this.sole = [];
    for (const side of ['l', 'r']) {
      const pick = (bone: string): Float32Array => {
        const bi = names.indexOf(bone); if (bi < 0) return new Float32Array(0);
        const toLocal = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[bi], mesh.bindMatrix), cands: {y: number; p: THREE.Vector3}[] = [];
        for (let i = 0; i < pos.count; i++) { let w = 0; for (let q = 0; q < 4; q++) if (si.getComponent(i, q) === bi) w += sw.getComponent(i, q); if (w < 0.5) continue;
          v.fromBufferAttribute(pos, i); const y = v.clone().applyMatrix4(mesh.bindMatrix).y; cands.push({y, p: v.clone().applyMatrix4(toLocal)}); }
        // the sole: every vertex within 12 mm of the foot's lowest point in the bind pose (the heel, the ball, the toes, both edges), at most 240
        cands.sort((a, b) => a.y - b.y); const floor = cands.length ? cands[0].y + 0.012 : 0; let n = 0; while (n < cands.length && n < 240 && cands[n].y <= floor) n++; const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = cands[i].p.x; arr[i * 3 + 1] = cands[i].p.y; arr[i * 3 + 2] = cands[i].p.z; }
        return arr;
      };
      out.push({foot: pick('foot_' + side), ball: pick('ball_' + side), ballIdx: this.bones.byName.get('ball_' + side) ?? -1});
    }
    this.sole = out;
  }
  readonly idx: Record<string, number>;
  private readonly upRoot = new THREE.Vector3(0, 1, 0); private readonly rootInv = new THREE.Quaternion(); private readonly feetMid = new THREE.Vector3(); private readonly feetMidR = new THREE.Vector3(); private readonly qLean = new THREE.Quaternion();
  private readonly legs: Chain[]; private readonly arms: Chain[];
  /** which side of the body (rider z sign) each hand hangs on in the trim key: fixed per arm, so the arms-down rotation never flips sign */
  private readonly armSide = [1, -1];
  /** R7: per pose, the index of its backside key (BODY.backsideOf), -1 when it has none; the plan only ever names frontside poses */
  private readonly backIdx = POSES.map((n) => { const b = BODY.backsideOf[n]; return b ? POSES.indexOf(b) : -1; });
  /** the blended pose's pelvis height (rider frame) before compression, for the probe */
  hipY = 0;
  // round 5 (M3): every procedural gain and each hand target goes through its own critically damped spring, and the hands through a
  // speed cap, so a kink in a layer's input (a clamp reached, a knot change, a key switch) never reaches a joint as a step
  private readonly leanVS = [new Spring(), new Spring(), new Spring()]; private readonly counterS = new Spring(); private readonly headSideS = new Spring(); private readonly pitchS = new Spring();
  /** the torso's pitch this frame (deg, + forward over the toes, from the deck normal), before and after the M9 correction, for the probe */
  torsoPitchDeg = 0; torsoPitchRawDeg = 0;
  /** R11: the head bone's forward (the face) in its own frame, from the bind pose (set by the viewer); the yaw layer needs it */
  headFwd: THREE.Vector3 | null = null;
  /** R11: the yaw corrections applied this frame (deg: hip, shoulders, head) and the raw measurements before them, for the probe */
  readonly yawFixDeg = [0, 0, 0]; readonly yawRawDeg = [0, 0, 0]; leanDeg = 0; leanGateNow = 1;
  /** R12: the head and the neck of the posed body (rider frame, model metres): the roof cap's crown follows the body it actually has */
  readonly headR = new THREE.Vector3(0, 1.36, 0.43); readonly neckR = new THREE.Vector3(0, 1.0, 0.4); posedHead = false;
  /** R12 (BODY.faceClamp): the viewer's probe of a rider-frame point against the water: writes [signed face distance (model m), the face
   *  normal in the rider frame] into `out`; false when there is no water to measure against */
  faceProbe: ((xr: number, yr: number, zr: number, out: Float64Array) => boolean) | null = null;
  private readonly probeOut = new Float64Array(4); private readonly clampVS = [[new Spring(), new Spring(), new Spring()], [new Spring(), new Spring(), new Spring()]];
  /** the clamp's turn applied this frame per arm (deg), for the probe */ readonly clampDeg = [0, 0];
  private readonly yawS = [new Spring(), new Spring(), new Spring()]; private readonly pitchFwd = new THREE.Vector3(0, 0, 1); private readonly pitchAxis = new THREE.Vector3(1, 0, 0);
  private readonly yawT = [0, 0, 0];
  private readonly idxYaw: {thighL: number; thighR: number; armL: number; armR: number; clavL: number; clavR: number};
  private readonly handS = [new Spring(), new Spring(), new Spring(), new Spring(), new Spring(), new Spring()]; private primed = false;
  constructor(bones: Bones, lib: PoseLib) {
    this.bones = bones; this.lib = lib; this.riderM = bones.all.map(() => new THREE.Matrix4());
    const ix = (n: string) => bones.byName.get(n) ?? -1;
    this.idx = {pelvis: ix('pelvis'), s1: ix('spine_01'), s2: ix('spine_02'), s3: ix('spine_03'), neck: ix('neck_01'), head: ix('head'), root: ix('Root')};
    this.idxYaw = {thighL: ix('thigh_l'), thighR: ix('thigh_r'), armL: ix('upperarm_l'), armR: ix('upperarm_r'), clavL: ix('clavicle_l'), clavR: ix('clavicle_r')};
    const chain = (a: string, b: string, c: string): Chain => ({a: ix(a), b: ix(b), c: ix(c), axA: new THREE.Vector3(0, 1, 0), plA: new THREE.Vector3(0, 0, 1), axB: new THREE.Vector3(0, 1, 0), plB: new THREE.Vector3(0, 0, 1), lastP: new THREE.Vector3(0, 0, 1), qA: new THREE.Quaternion(), wA: new THREE.Vector3(), qB: new THREE.Quaternion(), wB: new THREE.Vector3()});
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
    for (let k = 0; k < 2; k++) { const sh = this.riderM[this.arms[k].a]; if (this.arms[k].a >= 0) this.armSide[k] = this.lib.wrist[0][k * 3 + 2] - sh.elements[14] >= 0 ? 1 : -1; }
  }
  /** Pose the skeleton from the interpolated state. `st` is the lerped state vector (weights at S.W0..). The rig's own matrix is set by the caller. */
  pose(st: Float64Array, inp: BodyInput) {
    const {all, parent} = this.bones, lib = this.lib, n = lib.n, w = this.w, wa = this.wa;
    // 1. blend the library (normalised weights; quaternions nlerp'd with a consistent hemisphere). The arms blend on their own slower
    //    weights (S.WA0..): a pose change swings the hands through the longest arcs. Backside rides the pig-dog instead of the crouch.
    const norm = (dst: Float32Array, o: number) => { let sum = 0; for (let i = 0; i < POSES.length; i++) { dst[i] = Math.max(0, st[o + i]); sum += dst[i]; } if (sum < 1e-6) { dst[0] = 1; sum = 1; }
      // backside (mirrored) rides the backside keys: each frontside pose's weight moves to its own backside key (R7; the barrel -> pig-dog since round 4)
      if (inp.mirror < 0) for (let i = 0; i < POSES.length; i++) { const j = this.backIdx[i]; if (j >= 0 && dst[i] > 0) { dst[j] += dst[i]; dst[i] = 0; } }
      for (let i = 0; i < POSES.length; i++) dst[i] /= sum; };
    norm(w, S.W0); norm(wa, S.WA0);
    for (let b = 0; b < n; b++) {
      let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, qw = 0, rx = 0, ry = 0, rz = 0, rw = 1;
      const wb = this.isArm[b] ? wa : w, bone = all[b];
      // the nlerp hemisphere: against LAST FRAME's rotation of this bone once primed (R7: with the first weighted pose as the reference, a
      // reference switch between keys whose arm rotations differ by ~120-180 deg re-signed the sum inconsistently and the upper arm
      // stepped 68 deg in one frame at the end of the snap); the first weighted pose only on the first frame
      let haveRef = this.primed; if (haveRef) { rx = bone.quaternion.x; ry = bone.quaternion.y; rz = bone.quaternion.z; rw = bone.quaternion.w; }
      for (let i = 0; i < POSES.length; i++) { const wi = wb[i]; if (wi <= 0) continue; const d = lib.data[i], o = b * 7;
        px += wi * d[o]; py += wi * d[o + 1]; pz += wi * d[o + 2];
        let x = d[o + 3], y = d[o + 4], z = d[o + 5], ww = d[o + 6]; if (!haveRef) { rx = x; ry = y; rz = z; rw = ww; haveRef = true; }
        if (x * rx + y * ry + z * rz + ww * rw < 0) { x = -x; y = -y; z = -z; ww = -ww; }
        qx += wi * x; qy += wi * y; qz += wi * z; qw += wi * ww; }
      bone.position.set(px, py, pz); bone.quaternion.set(qx, qy, qz, qw).normalize();
    }
    for (let k = 0; k < 6; k++) { let v = 0, h = 0, f = 0; for (let i = 0; i < POSES.length; i++) { v += w[i] * lib.ankle[i][k]; h += wa[i] * lib.wrist[i][k]; f += w[i] * lib.footF[i][k]; } this.ankleT[k] = v; this.wristT[k] = h; this.footFT[k] = f; }
    for (let k = 0; k < 2; k++) { blendQ(lib.footQ, w, k, this.footT, k * 4, this.primed); blendQ(lib.handQ, wa, k, this.handT, k * 4, this.primed); }
    // R16: plant the feet on the drawn deck (the ankle targets and the soles' tilt), then move the BODY with them: the pelvis and the hands
    // shift by the mean lift, so the keys' leg bend and the rider's height over the deck stay as authored (correction cycle 1: with the
    // feet alone pulled 2-4 cm down to a Quiver board's deck the knees and calves dropped into the face and the frontside clip probes doubled)
    this.plantFeet(all);
    // 2. compression and idle bob on the pelvis (along the rider's up, in the Root's frame)
    const I = this.idx, pr = inp.profile;
    if (I.pelvis >= 0) { const pel = all[I.pelvis]; this.hipY = pel.position.dot(this.upRoot); pel.position.addScaledVector(this.upRoot, -(BODY.compressM * inp.comp) + BODY.idleBobM * inp.idleA + this.plantShift); }
    // 3. the chain, parents first, applying each bone's procedural rotation before composing its rider-frame matrix
    // R8: the lean answers the deck's ROLL (across the board). Once the board pitches steeply along its axis (the snap's pivot up the face,
    // |pitch| from 15 to 60 deg, BODY.leanPitchFadeDeg) the along-board share of the tilt is faded out of it: a pivot about the feet
    // toward the tail put the hips 0.6 m behind the feet at the backside hit and the knees 0.2 m off the hip-foot line (knock); a
    // 30-45 fade swung the 48 deg backside lean out in 0.1 s (14k jerk on every bone). The takeoff and the turns (|pitch| under 15) are untouched.
    const upIn = inp.upR, pitchDeg = Math.asin(THREE.MathUtils.clamp(Math.abs(upIn.x), 0, 1)) / D2R, pp = THREE.MathUtils.clamp((pitchDeg - BODY.leanPitchFadeDeg[0]) / (BODY.leanPitchFadeDeg[1] - BODY.leanPitchFadeDeg[0]), 0, 1), pitchShare = pp * pp * (3 - 2 * pp);
    // R11: once the along-board share is taken out, what is left of world-up can be short (the board near vertical AND rolled 40 deg at the
    // hit: the lean's axis then flipped between frames, 25 deg/frame on the thigh and the head); the lean fades out with that length
    const upRem = this.vLean.set(upIn.x * (1 - pitchShare), upIn.y, upIn.z).length(), leanGate = THREE.MathUtils.smoothstep(upRem, BODY.leanUpFade[0], BODY.leanUpFade[1]);
    const up = this.vLean.normalize(), tilt = Math.acos(THREE.MathUtils.clamp(up.y, -1, 1));
    // backside the chest faces down the slope, so the torso counters the deck toward the vertical (over the heels, toward the wave) harder
    const cGain = inp.mirror < 0 ? BODY.torsoCounterBackside.gain : BODY.torsoCounterGain, cMax = inp.mirror < 0 ? BODY.torsoCounterBackside.maxDeg : BODY.torsoCounterMaxDeg;
    const dt = Math.min(0.05, Math.max(1e-4, inp.dt)), wS = 2 * Math.PI * BODY.smoothHz;
    const counterT = THREE.MathUtils.clamp(cGain * smoothOnset(tilt - BODY.torsoCounterStartDeg * D2R, 10 * D2R), 0, cMax * D2R) / 3;
    if (!this.primed) { this.counterS.set(counterT); }
    const counter = this.counterS.step(counterT, dt, wS);
    this.va.set(0, 1, 0).cross(up); const okAxis = this.va.lengthSq() > 1e-8; if (okAxis) this.va.normalize();   // from deck-up toward world-up
    // the body above the feet leans from the deck toward the vertical, pivoting about the feet (the leg IK below keeps the soles planted);
    // the pelvis keeps its height off the deck (a pure pivot lowered the hips by a quarter at 42 deg and folded the knees, round 3)
    // the lean is an angulation of the whole standing body (a skier on a traverse): the knee poles and the hand targets turn with it below,
    // so the legs still bend forward in the body's own frame (a pivot alone left the knees over the toes and the hips behind: a chair)
    const lGain = inp.mirror < 0 ? BODY.bodyLeanBackside.gain : BODY.bodyLeanGain, lMax = inp.mirror < 0 ? BODY.bodyLeanBackside.maxDeg : BODY.bodyLeanMaxDeg;   // backside stands up toward the vertical (R6)
    const leanT = THREE.MathUtils.clamp(lGain * smoothOnset(tilt - BODY.bodyLeanStartDeg * D2R, 8 * D2R), 0, lMax * D2R) * leanGate;
    // R11: the lean is smoothed as a ROTATION VECTOR (axis x angle), not as an angle about this frame's axis: the axis (0,1,0) x up flips
    // from +x to -x the instant world-up's toe-side component crosses zero (the deck rolled through level at the hit) while the angle
    // still lagged in its spring, which moved the pelvis and the neck 11-13 cm in one frame
    const lv = this.leanVS, ax0 = okAxis ? this.va : this.vd.set(0, 0, 0); if (!okAxis) { ax0.set(1, 0, 0); }
    if (!this.primed) { lv[0].set(ax0.x * leanT); lv[1].set(ax0.y * leanT); lv[2].set(ax0.z * leanT); }
    this.vd.set(lv[0].step(ax0.x * leanT, dt, wS), lv[1].step(ax0.y * leanT, dt, wS), lv[2].step(ax0.z * leanT, dt, wS));
    const lean = this.vd.length(); if (lean > 1e-6) this.va.copy(this.vd).multiplyScalar(1 / lean);   // the smoothed axis replaces this frame's
    this.leanDeg = lean / D2R; this.leanGateNow = leanGate;
    // backside (M2): the head looks over the leading shoulder, toward the wave, through the turns (eased by its own spring)
    const headSideT = inp.mirror < 0 ? BODY.backsideHeadDeg * D2R * THREE.MathUtils.clamp(inp.turning, 0, 1) : 0;
    if (!this.primed) this.headSideS.set(headSideT);
    const headSide = this.headSideS.step(headSideT, dt, wS);
    this.feetMidR.set((this.ankleT[0] + this.ankleT[3]) / 2, (this.ankleT[1] + this.ankleT[4]) / 2, (this.ankleT[2] + this.ankleT[5]) / 2);   // feet midpoint, rider frame
    const leanOn = lean > 1e-4; if (leanOn) this.qLean.setFromAxisAngle(this.va, lean); else this.qLean.identity();
    if (leanOn && I.pelvis >= 0) {
      const pel = all[I.pelvis]; this.feetMid.copy(this.feetMidR).applyQuaternion(this.rootInv);   // feet midpoint, Root frame
      this.vd.copy(this.va).applyQuaternion(this.rootInv).normalize(); this.qd.setFromAxisAngle(this.vd, lean);
      const h0 = pel.position.dot(this.upRoot) - this.feetMid.dot(this.upRoot);
      pel.position.sub(this.feetMid).applyQuaternion(this.qd).add(this.feetMid); pel.quaternion.premultiply(this.qd);
      pel.position.addScaledVector(this.upRoot, h0 * (1 - Math.cos(lean)) * (inp.mirror < 0 ? BODY.bodyLeanBackside.keepHeight : BODY.bodyLeanKeepHeight));
    }
    const lead = THREE.MathUtils.clamp(inp.lead, -BODY.leadMaxDeg * D2R, BODY.leadMaxDeg * D2R) * inp.mirror;
    const sway = pr.swayDeg * D2R, armsDown = BODY.armsDownDeg * D2R * THREE.MathUtils.clamp(inp.turning, 0, 1);
    // M9 (user, 2026-11-04: "the model leans his head and back BACK"): the torso never pitches behind the deck normal. A first pass composes
    // the chain as the layers above leave it (the pose, the compression, the lean about the feet, which on backside carries the torso
    // toward the wave = backward) and reads the pelvis -> neck pitch toward the toes; the spine then hinges forward by what is missing
    // (spread over the three spine bones, through a spring), so the shoulders stay over the board however the body angulates.
    for (let b = 0; b < n; b++) this.compose(b, parent[b]);
    let pitchFix = 0;
    if (I.pelvis >= 0 && I.neck >= 0) {
      this.vd.setFromMatrixPosition(this.riderM[I.neck]).sub(this.ve.setFromMatrixPosition(this.riderM[I.pelvis]));
      const range = inp.mirror < 0 ? BODY.torsoPitchDegBackside : BODY.torsoPitchDeg;   // backside: upright (R6)
      // R11: the pitch is read in the CHEST'S OWN facing (the horizontal perpendicular of the shoulder line), not toward the toes: with
      // the shoulders turned toward the nose (the yaw layer below, up to ~60 deg at the hit) a chest pitched 40 deg forward has next to no
      // component toward the toes and read as upright; the hinge turns about the shoulder line for the same reason
      const fw = this.pitchFwd.set(0, 0, 1), YI = this.idxYaw;
      if (YI.armR >= 0 && YI.armL >= 0) { this.vf.setFromMatrixPosition(this.riderM[YI.armR]).sub(this.vg.setFromMatrixPosition(this.riderM[YI.armL])); fw.set(this.vf.z, 0, -this.vf.x); if (fw.lengthSq() < 1e-6) fw.set(0, 0, 1); fw.normalize(); }
      this.pitchAxis.set(fw.z, 0, -fw.x);   // up x facing: a + hinge pitches the chest forward in its facing
      let raw = Math.atan2(this.vd.dot(fw), Math.max(1e-3, this.vd.y)); const lo = range[0] * D2R, hi = range[1] * D2R;
      // R7 backside: the pitch is read against the LEG LINE (feet -> pelvis), not the deck normal: the body angulates over the heels toward
      // the vertical on a steep face (the lean above), and the torso stays flexed forward of the legs, as the real backside sequence
      // shows; against the deck normal that read as "leaning back" and the hinge folded the chest toward the beach (R6's bow)
      if (inp.mirror < 0) { this.vf.setFromMatrixPosition(this.riderM[I.pelvis]).sub(this.feetMidR); raw -= Math.atan2(this.vf.dot(fw), Math.max(1e-3, this.vf.y)); }
      // the counter below also pitches the torso (frontside toward the toes, backside away): count it in the target
      const rawC = raw + counter * 3 * (okAxis ? this.va.x : 0);   // the counter's share about the board axis (signed: + toward the toes)
      const want = rawC < lo ? lo - rawC : rawC > hi ? hi - rawC : 0;
      if (!this.primed) this.pitchS.set(want); pitchFix = this.pitchS.step(want, dt, 2 * Math.PI * BODY.pitchHz);
      this.torsoPitchRawDeg = raw / D2R; this.torsoPitchDeg = (rawC + pitchFix) / D2R;
    }
    // R11: the body's yaw against the stringer (BODY.yawTargets): the hip line, the shoulder line and the head's facing are read off the
    // composed chain (rider frame) and corrected toward the pose-blended targets; each correction is cumulative down the chain (the
    // spine's fix sits on top of the pelvis', the head's on both), through its own spring. A pose without a target fades the fix out.
    const Y = this.idxYaw, fix = this.yawFixDeg, tg = this.yawT; let yawOn = 0; tg[0] = tg[1] = tg[2] = 0;
    for (let i = 0; i < POSES.length; i++) { if (w[i] <= 0) continue; const tt = BODY.yawTargets[POSES[i]]; if (!tt) continue; yawOn += w[i]; tg[0] += w[i] * tt[0]; tg[1] += w[i] * tt[1]; tg[2] += w[i] * tt[2]; }
    if (yawOn > 1e-6) { tg[0] /= yawOn; tg[1] /= yawOn; tg[2] /= yawOn; }
    const lineYaw = (a: number, b: number) => { this.vd.setFromMatrixPosition(this.riderM[a]).sub(this.ve.setFromMatrixPosition(this.riderM[b])); return Math.atan2(-this.vd.z, -this.vd.x) / D2R; };   // trailing (l) -> leading (r)
    const mHip = Y.thighR >= 0 && Y.thighL >= 0 ? lineYaw(Y.thighR, Y.thighL) : NaN, mSh = Y.armR >= 0 && Y.armL >= 0 ? lineYaw(Y.armR, Y.armL) : NaN;
    let mHead = NaN; if (this.headFwd && I.head >= 0) { this.vd.copy(this.headFwd).transformDirection(this.riderM[I.head]); mHead = Math.atan2(-this.vd.x, this.vd.z) / D2R; }
    this.yawRawDeg[0] = mHip; this.yawRawDeg[1] = mSh; this.yawRawDeg[2] = mHead;
    const wY = 2 * Math.PI * BODY.yawHz, wrapD = (d: number) => ((d + 540) % 360) - 180;
    for (let k = 0; k < 3; k++) {
      const m = this.yawRawDeg[k], prior = k === 0 ? 0 : fix[0] + (k === 2 ? fix[1] : 0);   // the fixes already applied above this joint this frame
      const want = Number.isNaN(m) ? 0 : yawOn * wrapD(tg[k] - (m + prior));
      if (!this.primed) this.yawS[k].set(want); fix[k] = this.yawS[k].step(want, dt, wY);
    }
    for (let b = 0; b < n; b++) {
      const par = parent[b];
      // the procedural delta for this bone, as (axis in the rider frame, angle)
      let ang = 0; const ax = this.vb;
      if (b === I.s1 || b === I.s2 || b === I.s3) { if (okAxis && counter > 1e-4) { ax.copy(this.va); ang = counter; } }
      if (ang !== 0) this.applyDelta(b, par, ax, ang);
      if ((b === I.s1 || b === I.s2 || b === I.s3) && Math.abs(pitchFix) > 1e-5) this.applyDelta(b, par, this.vc.copy(this.pitchAxis), pitchFix / 3);   // forward hinge about the shoulder line (R11; was the stringer: y toward z is + about x)
      // R11 yaw fixes: a + yaw about the rider's up turns the chest toward the TAIL, so the fix (+ = toward the nose) is applied negated
      if (b === I.s1 || b === I.s2 || b === I.s3) this.applyDelta(b, par, this.vc.set(0, 1, 0), -fix[1] * D2R / 3);
      if (b === I.s3) this.applyDelta(b, par, this.vc.set(0, 1, 0), lead * BODY.leadShare.spine);
      else if (b === I.neck) this.applyDelta(b, par, this.vc.set(0, 1, 0), THREE.MathUtils.clamp(lead * BODY.leadShare.neck + 0.4 * headSide - fix[2] * D2R * BODY.yawHeadSplit.neck, -BODY.limits.neck * D2R, BODY.limits.neck * D2R));
      else if (b === I.head) this.applyDelta(b, par, this.vc.set(0, 1, 0), THREE.MathUtils.clamp(lead * BODY.leadShare.head + 0.6 * headSide - fix[2] * D2R * BODY.yawHeadSplit.head, -BODY.limits.head * D2R, BODY.limits.head * D2R));
      else if (b === I.pelvis) this.applyDelta(b, par, this.vc.set(0, 1, 0), lead * BODY.leadShare.pelvis - fix[0] * D2R);
      else if (b === Y.clavL || b === Y.clavR) this.applyDelta(b, par, this.vc.set(0, 1, 0), (fix[0] + fix[1]) * D2R * (1 - BODY.yawArmsFollow));   // the arms keep most of their authored rider-frame direction
      else if (b === I.s2) { this.applyDelta(b, par, this.vc.set(1, 0, 0), sway * 0.5 * inp.idleA); this.applyDelta(b, par, this.vc.set(0, 0, 1), sway * 0.5 * inp.idleB); }
      else if (armsDown > 1e-5 && (b === this.arms[0].a || b === this.arms[1].a)) {
        // the upper arm comes down toward the body: a rotation about the board axis in the sense that lowers that arm's hand (its side of the body)
        this.applyDelta(b, par, this.vc.set(1, 0, 0), this.armSide[b === this.arms[0].a ? 0 : 1] * armsDown);
      }
      this.compose(b, par);
    }
    this.armCarry(inp.mirror, dt);
    if (I.head >= 0 && I.neck >= 0) { this.headR.setFromMatrixPosition(this.riderM[I.head]); this.neckR.setFromMatrixPosition(this.riderM[I.neck]); this.posedHead = true; }   // R12: for the roof cap
    // R12: the face clamp (BODY.faceClamp): each arm turned about its shoulder, along the face normal, until the hand and the elbow hold
    // off the face; the turn is a rotation vector through its own spring (continuous through zero, as the lean)
    { const FC = BODY.faceClamp, wC = 2 * Math.PI * FC.hz, out = this.probeOut, Sh = this.va, E = this.vb, Hd = this.vc, ax = this.vd, r = this.ve, nrm = this.vf, cr = this.vg;
      for (let k = 0; k < 2; k++) {
        const L = this.arms[k], cs = this.clampVS[k]; let ang = 0; ax.set(0, 0, 0);
        if (this.faceProbe && L.a >= 0 && L.b >= 0 && L.c >= 0) {
          Sh.setFromMatrixPosition(this.riderM[L.a]); E.setFromMatrixPosition(this.riderM[L.b]); Hd.setFromMatrixPosition(this.riderM[L.c]);
          for (let j = 0; j < 2; j++) {
            const Pt = j === 0 ? Hd : E, hold = j === 0 ? FC.holdM : FC.holdElbowM;
            if (!this.faceProbe(Pt.x, Pt.y, Pt.z, out)) continue;
            const push = smoothOnset(hold - out[0], FC.onsetM); if (push <= 0) continue;
            r.copy(Pt).sub(Sh); nrm.set(out[1], out[2], out[3]); cr.crossVectors(r, nrm); const l = cr.length(), rl = r.length(); if (l < 1e-3 || rl < 1e-2) continue;   // the turn that carries this point along the normal: about r x n, by push / |r x n| (the lever floored at a third of the arm: an arm pointing into the face cannot be turned out of it)
            const a = Math.min(FC.maxDeg * D2R, push / Math.max(l, 0.33 * rl)); if (a > ang) ang = a; ax.addScaledVector(cr, a / l);
          }
          const sl = ax.length(); if (sl > 1e-9) ax.multiplyScalar(1 / sl); else ang = 0;
        }
        if (!this.primed) { cs[0].set(ax.x * ang); cs[1].set(ax.y * ang); cs[2].set(ax.z * ang); }
        const x0 = cs[0].x, y0 = cs[1].x, z0 = cs[2].x;
        ax.set(cs[0].step(ax.x * ang, dt, wC), cs[1].step(ax.y * ang, dt, wC), cs[2].step(ax.z * ang, dt, wC));
        // the turn's rate cap: the rotation vector moves at most rateDeg per second (the springs' states scaled back with it)
        const mv = Math.hypot(ax.x - x0, ax.y - y0, ax.z - z0), lim = FC.rateDeg * D2R * dt;
        if (mv > lim) { const f = lim / mv; ax.set(x0 + (ax.x - x0) * f, y0 + (ax.y - y0) * f, z0 + (ax.z - z0) * f); cs[0].x = ax.x; cs[1].x = ax.y; cs[2].x = ax.z; cs[0].v *= f; cs[1].v *= f; cs[2].v *= f; }
        const a2 = ax.length(); this.clampDeg[k] = a2 / D2R;
        if (a2 > 1e-5) { this.applyDelta(L.a, parent[L.a], ax.multiplyScalar(1 / a2), a2); this.compose(L.a, parent[L.a]); this.compose(L.b, L.a); this.compose(L.c, L.b); }
      } }
    // 4. legs: two-bone IK to the blended ankle targets, the knee pole over that foot's own toes (its forward direction, flattened onto
    //    the deck) splayed a little outward, the soles flat (the foot's rider-frame rotation from the library)
    for (let k = 0; k < 2; k++) {
      this.pole.set(THREE.MathUtils.clamp(BODY.kneePole.footShare * this.footFT[k * 3], -BODY.kneePole.maxX, BODY.kneePole.maxX), 0, Math.max(0.3, this.footFT[k * 3 + 2])); this.pole.normalize(); this.pole.x += BODY.kneePole.splay * (k === BODY.frontLeg ? -1 : 1);
      if (leanOn) this.pole.applyQuaternion(this.qLean);
      this.tgt.set(this.ankleT[k * 3], this.ankleT[k * 3 + 1], this.ankleT[k * 3 + 2]);   // planted by plantFeet (the lift is in ankleT, the sole's tilt in footAdj)
      this.solveChain(this.legs[k], this.tgt, this.pole, this.footAdj, k, BODY.limits.kneeMin, BODY.limits.kneeMax);
    }
    // 5. arms (M7): each hand solved to its blended library position in the rider (board) frame, shifted a little to counter the rail roll
    //    (toward the high rail) and out by the skill's arms-out; the elbow pole down and behind; the hand's rotation from the library
    const rollShift = THREE.MathUtils.clamp(inp.roll * BODY.armRollShare, -0.25, 0.25) * inp.mirror, out = Math.sin(pr.armsOutDeg * D2R) * BODY.armsOutReachM;
    for (let k = 0; k < 2; k++) {
      if (!BODY.armIK) break;   // the arms ride with the torso as authored in the keys (round 5)
      const sx = k === BODY.frontLeg ? -1 : 1;   // the front arm reaches toward the nose
      this.tgt.set(this.wristT[k * 3] + sx * out, this.wristT[k * 3 + 1], this.wristT[k * 3 + 2] - rollShift);
      if (leanOn) this.tgt.sub(this.feetMidR).applyQuaternion(this.qLean).add(this.feetMidR);
      // the hand follows its target through a spring and under a speed cap (M3: a key switch moved the back hand 0.5 m in a few frames)
      const hs = this.handS, o = k * 3, wH = 2 * Math.PI * BODY.handFollowHz, step = BODY.handSpeedMps * dt;
      if (!this.primed) { hs[o].set(this.tgt.x); hs[o + 1].set(this.tgt.y); hs[o + 2].set(this.tgt.z); }
      const x0 = hs[o].x, y0 = hs[o + 1].x, z0 = hs[o + 2].x;
      let nx = hs[o].step(this.tgt.x, dt, wH), ny = hs[o + 1].step(this.tgt.y, dt, wH), nz = hs[o + 2].step(this.tgt.z, dt, wH);
      const mv = Math.hypot(nx - x0, ny - y0, nz - z0);
      if (mv > step) { const f = step / mv; nx = x0 + (nx - x0) * f; ny = y0 + (ny - y0) * f; nz = z0 + (nz - z0) * f; hs[o].x = nx; hs[o + 1].x = ny; hs[o + 2].x = nz; hs[o].v *= f; hs[o + 1].v *= f; hs[o + 2].v *= f; }
      if (I.pelvis >= 0) { const px = this.riderM[I.pelvis].elements[12]; nx = THREE.MathUtils.clamp(nx, px - BODY.handSideMaxM, px + BODY.handSideMaxM); hs[o].x = nx; }
      this.tgt.set(nx, ny, nz);
      this.pole.set(sx * BODY.elbowPole.out, BODY.elbowPole.down, BODY.elbowPole.back);   // out and behind the chest: a hanging hand never lies along the pole
      this.solveChain(this.arms[k], this.tgt, this.pole, this.handT, k, BODY.limits.elbowMin, BODY.limits.elbowMax, BODY.bendPlaneRateDeg * D2R * dt, dt);
    }
    this.primed = true;
  }
  /** 3d-next: the arm carriage (BODY.armCarry): each arm turned from its keyed place toward a designed one in the chest frame, by the
   *  arms' blended carriage weight. No state of its own: everything it reads (the composed chain, the arms' pose weights) is already
   *  continuous, so it cannot step; at weight 0 it leaves the keys exactly as they are. Per frame, for the front (hand_r, the model's
   *  nose-side arm) and the back arm: the designed hand = shoulder + offset (u, up, f); the elbow by a two-bone solve with the bend plane
   *  from the chest-fixed pole; the upper arm turned by the minimal rotation from its keyed direction onto the solved one, then the forearm
   *  likewise, each scaled by the weight (a slerp from identity). The hand keeps its set against the forearm. */
  private readonly cq = new THREE.Quaternion(); private readonly cI = new THREE.Quaternion(); private readonly cS = new THREE.Vector3(); private readonly cE = new THREE.Vector3(); private readonly cH = new THREE.Vector3(); private readonly cT = new THREE.Vector3(); private readonly cP = new THREE.Vector3(); private readonly cU = new THREE.Vector3(); private readonly cUp = new THREE.Vector3(); private readonly cF = new THREE.Vector3(); private readonly cD = new THREE.Vector3(); private readonly cA = new THREE.Vector3(); private readonly cB = new THREE.Vector3(); private readonly cN = new THREE.Vector3(); private readonly cSd = new THREE.Vector3();
  /** the carriage weight applied this frame per arm [back, front] and the elbow it aimed at (deg), for the probe */ readonly carryW = [0, 0]; readonly carryElbow = [0, 0];
  private readonly carryS = [new Spring(), new Spring(), new Spring(), new Spring(), new Spring(), new Spring()]; private readonly carryPrimed = [false, false];
  /** the correction applied to each bone (upper, fore per arm, rider frame) follows its target under an angular speed cap (AC.rateDeg): the keyed arm's own swing and the correction's change of axis added up to 630-840 deg/s on the back forearm at 2 ft (the gate is 540) */
  private readonly carryQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()]; private readonly carryWS = new Spring(); private carryWPrimed = false;
  private carryRate(j: number, dt: number) { const q = this.carryQ[j], tgt = this.cI, ang = q.angleTo(tgt), cap = BODY.armCarry.rateDeg * D2R * dt; if (ang > cap) q.slerp(tgt, cap / ang); else q.copy(tgt); this.cI.copy(q); }
  private armCarry(mirror: number, dt: number) {
    const AC = BODY.armCarry, I = this.idx, Y = this.idxYaw, wa = this.wa, {parent} = this.bones;
    if (I.pelvis < 0 || I.neck < 0 || Y.armL < 0 || Y.armR < 0) return;
    // the blended weight and the turn share (the bottom key) over the arms' own pose weights
    let wT0 = 0, turn = 0; for (let i = 0; i < POSES.length; i++) { const wi = wa[i]; if (wi <= 0) continue; const n = POSES[i], c = AC.weight[n] ?? 0; wT0 += wi * c; if (n === 'bottom' || n === 'bottomB') turn += wi * c;  }
    const tShare = wT0 > 1e-6 ? THREE.MathUtils.clamp(turn / wT0, 0, 1) : 0;
    // the weight itself through a critically damped spring (AC.weightHz): the kick-out's climb -> top handed the carriage back to the keys in ~0.2 s and the back hand reversed twice (8 ft)
    if (!this.carryWPrimed) { this.carryWS.set(wT0); this.carryWPrimed = true; } const wT = THREE.MathUtils.clamp(this.carryWS.step(wT0, dt, 2 * Math.PI * AC.weightHz), 0, 1);
    this.carryW[0] = this.carryW[1] = wT;   // computed even at weight 0, so the target springs below never hold a stale point
    // the chest frame: u back shoulder -> front shoulder (the model's right arm is the front one), up pelvis -> neck, f = up x u (toward the toes when square)
    const U = this.cU.setFromMatrixPosition(this.riderM[Y.armR]).sub(this.cA.setFromMatrixPosition(this.riderM[Y.armL])).normalize();
    const Up = this.cUp.setFromMatrixPosition(this.riderM[I.neck]).sub(this.cB.setFromMatrixPosition(this.riderM[I.pelvis])); Up.addScaledVector(U, -Up.dot(U)).normalize();
    const F = this.cF.crossVectors(Up, U).normalize();
    // the designed hands are read in the rider frame (BODY.armCarry); the heights from the chest and the hip; the poles in the chest frame
    const chestY = I.s3 >= 0 ? this.cN.setFromMatrixPosition(this.riderM[I.s3]).y : this.cN.setFromMatrixPosition(this.riderM[I.neck]).y - 0.2, hipY = this.cSd.setFromMatrixPosition(this.riderM[I.pelvis]).y, hipX = this.cSd.x;   // the designed hand stays within BODY.handSideMaxM of the pelvis along the board (the monitor's arm box is 0.7)
    for (let k = 0; k < 2; k++) {
      const L = this.arms[k]; if (L.a < 0 || L.b < 0 || L.c < 0) continue;
      const front = k === BODY.frontLeg, D = front ? AC.front : AC.back, P0 = front ? AC.poleFront : AC.poleBack;
      const ft = D.trim, fn = D.turn, side = !front && AC.backTurnFaceSide ? mirror : 1;
      const ox = ft[0] + (fn[0] - ft[0]) * tShare, oy = ft[1] + (fn[1] - ft[1]) * tShare, fnz = !front && mirror < 0 ? AC.backTurnDzBackside : fn[2], oz = (ft[2] + (fnz - ft[2]) * tShare) * side, rf = ft[3] + (fn[3] - ft[3]) * tShare;
      const S = this.cS.setFromMatrixPosition(this.riderM[L.a]), E0 = this.cE.setFromMatrixPosition(this.riderM[L.b]), H0 = this.cH.setFromMatrixPosition(this.riderM[L.c]);
      const l1 = E0.distanceTo(S), l2 = H0.distanceTo(E0); if (l1 < 1e-4 || l2 < 1e-4) continue;
      const T = this.cT.set(THREE.MathUtils.clamp(S.x - ox, hipX - BODY.handSideMaxM, hipX + BODY.handSideMaxM), (rf <= 1 ? (1 - rf) * chestY + rf * hipY : S.y) + oy, S.z + oz);   // the rider frame: the nose at -x, the toes at +z
      { const sp = this.carryS, o = k * 3, wF = 2 * Math.PI * AC.followHz, cap = AC.speedMps * dt; if (!this.carryPrimed[k]) { sp[o].set(T.x); sp[o + 1].set(T.y); sp[o + 2].set(T.z); this.carryPrimed[k] = true; }
        const x0 = sp[o].x, y0 = sp[o + 1].x, z0 = sp[o + 2].x; let nx = sp[o].step(T.x, dt, wF), ny = sp[o + 1].step(T.y, dt, wF), nz = sp[o + 2].step(T.z, dt, wF); const mv = Math.hypot(nx - x0, ny - y0, nz - z0);
        if (mv > cap) { const f = cap / mv; nx = x0 + (nx - x0) * f; ny = y0 + (ny - y0) * f; nz = z0 + (nz - z0) * f; sp[o].x = nx; sp[o + 1].x = ny; sp[o + 2].x = nz; sp[o].v *= f; sp[o + 1].v *= f; sp[o + 2].v *= f; }
        T.set(nx, ny, nz); }
      if (wT < 1e-4) continue;
      // the reach within the elbow's range
      const dMin = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(AC.elbowDeg[0] * D2R)), dMax = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(AC.elbowDeg[1] * D2R));
      const Dh = this.cD.copy(T).sub(S); let d = Dh.length(); if (d < 1e-5) continue; Dh.multiplyScalar(1 / d); const dRaw = d; d = THREE.MathUtils.clamp(d, dMin, dMax);   // a target near the shoulder has no stable direction: the carriage fades out under the elbow's closest reach (below) T.copy(S).addScaledVector(Dh, d);
      // the bend plane from the chest-fixed pole (perpendicular to the reach); the elbow on that side
      const Pp = this.cP.set(0, 0, 0).addScaledVector(U, P0[0]).addScaledVector(Up, P0[1]).addScaledVector(F, P0[2]); Pp.addScaledVector(Dh, -Pp.dot(Dh));
      const ppL = Pp.length(); if (ppL < 1e-6) continue; Pp.multiplyScalar(1 / ppL); const wk = wT * THREE.MathUtils.smoothstep(ppL, AC.poleFade[0], AC.poleFade[1]) * THREE.MathUtils.smoothstep(dRaw, 0.5 * dMin, dMin);   // a pole near the reach leaves the plane undefined: the carriage fades out there instead of flipping (the 2 ft takeoff's back forearm stepped 46 deg in a frame with a pole along the reach)
      const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
      this.carryElbow[k] = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1)) / D2R;
      // the upper arm: keyed direction -> solved direction, by the weight
      this.cA.copy(E0).sub(S).normalize(); this.cB.copy(Dh).multiplyScalar(cosA).addScaledVector(Pp, sinA);   // unit
      this.cq.setFromUnitVectors(this.cA, this.cB); this.cI.identity().slerp(this.cq, wk * (1 - THREE.MathUtils.smoothstep(this.cA.angleTo(this.cB), AC.flipFadeRad[0], AC.flipFadeRad[1])));
      this.carryRate(k * 2, dt); this.applyQuat(L.a, parent[L.a], this.cI); this.compose(L.a, parent[L.a]); this.compose(L.b, L.a); this.compose(L.c, L.b);
      // the forearm: from its (moved) keyed direction onto the designed hand, by the weight
      E0.setFromMatrixPosition(this.riderM[L.b]); H0.setFromMatrixPosition(this.riderM[L.c]);
      this.cA.copy(H0).sub(E0).normalize(); this.cB.copy(T).sub(E0); if (this.cB.lengthSq() < 1e-8) continue; this.cB.normalize();
      this.cq.setFromUnitVectors(this.cA, this.cB); this.cI.identity().slerp(this.cq, wk * (1 - THREE.MathUtils.smoothstep(this.cA.angleTo(this.cB), AC.flipFadeRad[0], AC.flipFadeRad[1])));
      this.carryRate(k * 2 + 1, dt); this.applyQuat(L.b, L.a, this.cI); this.compose(L.b, L.a); this.compose(L.c, L.b);
    }
  }
  /** An hour or stance change re-seats the rider: the springs start from the new targets (not a glide from the old ride). */
  reseat() { this.primed = false; this.carryPrimed[0] = this.carryPrimed[1] = false; for (const q of this.carryQ) q.identity(); this.carryWPrimed = false; }
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
  private solveChain(L: Chain, T: THREE.Vector3, poleR: THREE.Vector3, endQ: Float32Array, k: number, minDeg: number, maxDeg: number, maxPlaneRad = Infinity, dt = 0) {
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
    K0.normalize();
    // the bend plane may turn only so fast per frame (round 5): with the hand near the pole's direction the plane spun with every
    // centimetre of hand travel, and the upper arm rolled with it at 850-950 deg/s (the round-4 `arm` count)
    if (maxPlaneRad < Math.PI && this.primed) {
      const prev = this.vf.copy(L.lastP); prev.addScaledVector(tmp, -prev.dot(tmp));
      if (prev.lengthSq() > 1e-6) { prev.normalize(); const c = THREE.MathUtils.clamp(K0.dot(prev), -1, 1), ang = Math.acos(c);
        if (ang > maxPlaneRad) { const s = Math.sin(ang), a = Math.sin(ang - maxPlaneRad) / s, b2 = Math.sin(maxPlaneRad) / s; K0.multiplyScalar(b2).addScaledVector(prev, a).normalize(); } }
    }
    L.lastP.copy(K0);   // p-hat
    const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    // the joint K = H + l1 (cosA d-hat + sinA p-hat); the first bone's full rotation maps its axis to K - H and its bend axis into the plane
    A0.copy(tmp).multiplyScalar(cosA).addScaledVector(K0, sinA);                      // K - H (unit)
    this.setBoneRotation(L.a, parent[L.a], L.axA, L.plA, A0, K0); if (dt > 0) this.jointSpring(L.a, L.qA, L.wA, dt); this.compose(L.a, parent[L.a]); this.compose(L.b, L.a); this.compose(L.c, L.b);
    // the second bone: its axis toward the (clamped) target, its bend axis in the same plane
    K0.setFromMatrixPosition(this.riderM[L.b]); A0.copy(T).sub(K0).normalize();
    this.setBoneRotation(L.b, L.a, L.axB, L.plB, A0, L.lastP); if (dt > 0) this.jointSpring(L.b, L.qB, L.wB, dt); this.compose(L.b, L.a); this.compose(L.c, L.b);
    // the end bone: its rider-frame rotation is the library's (sole on the deck, the hand's set)
    this.qa.set(endQ[k * 4], endQ[k * 4 + 1], endQ[k * 4 + 2], endQ[k * 4 + 3]);
    this.qp.setFromRotationMatrix(this.riderM[L.b]).invert(); this.bones.all[L.c].quaternion.copy(this.qp).multiply(this.qa); this.compose(L.c, L.b);
  }
  /** Round 5 (M3): the joint's local rotation follows the solve through a critically damped rotational spring (state q, angular velocity
   *  w in the parent's frame), its speed capped: a joint can then never step, whatever the hand target or the bend plane did this frame.
   *  The hand bone keeps its rider-frame rotation, so a lagging forearm leaves the hand's set, not its direction. */
  private jointSpring(b: number, q: THREE.Quaternion, w: THREE.Vector3, dt: number) {
    const bone = this.bones.all[b], tgt = bone.quaternion;
    if (!this.primed) { q.copy(tgt); w.set(0, 0, 0); return; }
    // the error as a rotation vector: e = tgt * q^-1 (parent frame), the short way round
    this.qa.copy(q).invert().premultiply(tgt); if (this.qa.w < 0) { this.qa.x = -this.qa.x; this.qa.y = -this.qa.y; this.qa.z = -this.qa.z; this.qa.w = -this.qa.w; }
    const sh = Math.hypot(this.qa.x, this.qa.y, this.qa.z), ang = 2 * Math.atan2(sh, this.qa.w), e = this.vf;
    if (sh > 1e-9) e.set(this.qa.x, this.qa.y, this.qa.z).multiplyScalar(ang / sh); else e.set(0, 0, 0);
    const wj = 2 * Math.PI * BODY.jointFollowHz;
    w.addScaledVector(e, wj * wj * dt); w.multiplyScalar(1 / (1 + 2 * wj * dt));   // implicit damping: stable at any frame rate
    const sp = w.length(), cap = BODY.jointSpeedDeg * D2R; if (sp > cap) w.multiplyScalar(cap / sp);
    const th = w.length() * dt; if (th > 1e-9) { this.qb.setFromAxisAngle(this.vg.copy(w).normalize(), th); q.premultiply(this.qb).normalize(); }
    bone.quaternion.copy(q);
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
