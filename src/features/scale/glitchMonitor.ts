/** Dev-only glitch monitor (spec 2026-11-04, "glitch guard"): every frame, the angular change of every tracked joint and of the board
 *  since the last frame, and the board's gap to the water at its centre and at its lowest point. A jump over the limit (per 1/60 s,
 *  scaled by the frame's own dt so a frame-rate hitch is not a glitch) or a board floating or clipping beyond the limits logs a warning
 *  with the maneuver, the time and the joint, and counts. `window.__wave.glitches()` returns the counts so the toolkit can gate on them.
 *  Allocation-free per frame. */
import * as THREE from 'three';
import {MONITOR} from './surfSceneConfig';

export interface GlitchEvent {t: number; kind: 'joint' | 'board' | 'float' | 'clip'; joint: string; deg: number; gap: number; move: string}
export interface GlitchCounts {joint: number; board: number; float: number; clip: number; total: number; frames: number; worstJointDeg: number; worstBoardDeg: number; events: GlitchEvent[]}

export class GlitchMonitor {
  private objs: THREE.Object3D[] = []; private prevQ: THREE.Quaternion[] = []; private names: string[] = []; private board: THREE.Object3D | null = null;
  private readonly q = new THREE.Quaternion(); private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3(); private readonly boardQ = new THREE.Quaternion();
  private primed = false;
  readonly counts: GlitchCounts = {joint: 0, board: 0, float: 0, clip: 0, total: 0, frames: 0, worstJointDeg: 0, worstBoardDeg: 0, events: []};
  warn = true;
  /** Track these bones and the board object; call after the skeleton is in the scene. */
  track(bones: THREE.Object3D[], board: THREE.Object3D | null) {
    this.objs = bones.slice(); this.prevQ = bones.map(() => new THREE.Quaternion()); this.names = bones.map((b) => b.name); this.board = board; this.primed = false; this.reset();
  }
  reset() { const c = this.counts; c.joint = c.board = c.float = c.clip = c.total = c.frames = 0; c.worstJointDeg = c.worstBoardDeg = 0; c.events.length = 0; this.primed = false; }
  /** One frame: world matrices must be current. Returns the number of new warnings. */
  sample(dt: number, t: number, move: string, centreGap: number, lowGap: number): number {
    const c = this.counts, scale = Math.max(1, dt / MONITOR.refFrameS), limitJ = MONITOR.jointDegPerFrame * scale, limitB = MONITOR.boardDegPerFrame * scale; let n = 0;
    const emit = (kind: GlitchEvent['kind'], joint: string, deg: number, gap: number) => {
      c[kind]++; c.total++; n++;
      if (c.events.length < MONITOR.keepEvents) c.events.push({t: Math.round(t * 1000) / 1000, kind, joint, deg: Math.round(deg * 10) / 10, gap: Math.round(gap * 1000) / 1000, move});
      if (this.warn) console.warn(`[wave glitch] ${kind} ${joint} ${kind === 'joint' || kind === 'board' ? deg.toFixed(1) + ' deg/frame' : gap.toFixed(3) + ' m'} during ${move} at t=${t.toFixed(3)} s`);
    };
    for (let i = 0; i < this.objs.length; i++) {
      this.objs[i].matrixWorld.decompose(this.p, this.q, this.s);
      if (this.primed) { const d = 2 * Math.acos(Math.min(1, Math.abs(this.q.dot(this.prevQ[i])))) * 180 / Math.PI; if (d > c.worstJointDeg) c.worstJointDeg = d; if (d > limitJ) emit('joint', this.names[i], d, centreGap); }
      this.prevQ[i].copy(this.q);
    }
    if (this.board) {
      this.board.matrixWorld.decompose(this.p, this.q, this.s);
      if (this.primed) { const d = 2 * Math.acos(Math.min(1, Math.abs(this.q.dot(this.boardQ)))) * 180 / Math.PI; if (d > c.worstBoardDeg) c.worstBoardDeg = d; if (d > limitB) emit('board', 'board', d, centreGap); }
      this.boardQ.copy(this.q);
    }
    if (this.primed) {
      if (centreGap > MONITOR.centreGapM) emit('float', 'board', 0, centreGap);
      else if (centreGap < -MONITOR.centreGapM || lowGap < MONITOR.lowestGapM) emit('clip', 'board', 0, Math.min(centreGap, lowGap));
      c.frames++;
    }
    this.primed = true; return n;
  }
}
