// Sculpted breaking-wave geometry in unit space (face height = 1, z toward shore, y up, x along the crest).
// Three authored cross-sections share one control-point layout and are blended along the crest:
//   whitewater (already broken, x < 0) -> barrel (curling lip over a concave face) -> shoulder (unbroken swell).
import * as THREE from 'three';

export const NZ = 132, NX = 210, XMIN = -21, XMAX = 19;
// z, y, thin (light passes through), foam
type CP = [number, number, number, number];
const BARREL: CP[] = [
  [-11, 0, 0, 0.02], [-6.5, 0.04, 0, 0.02], [-4, 0.2, 0, 0.03], [-2.5, 0.46, 0.05, 0.04], [-1.6, 0.7, 0.2, 0.08], [-1.0, 0.89, 0.45, 0.15],
  [-0.5, 0.98, 0.8, 0.3], [0.0, 1.0, 1, 0.2], [0.45, 0.95, 1, 0.3], [0.8, 0.82, 1, 0.45], [0.97, 0.64, 1, 0.9], [0.93, 0.52, 1, 0.8],
  [0.78, 0.6, 1, 0.3], [0.45, 0.72, 1, 0.12], [0.05, 0.77, 0.9, 0.02], [-0.3, 0.7, 0.55, 0], [-0.52, 0.52, 0.3, 0], [-0.56, 0.32, 0.1, 0],
  [-0.4, 0.15, 0, 0.05], [-0.05, 0.05, 0, 0.15], [0.55, 0.02, 0, 0.3], [1.3, 0.0, 0, 0.38], [2.4, 0, 0, 0.22], [4.2, 0, 0, 0.06], [7, 0, 0, 0.02], [11, 0, 0, 0],
];
const SHOULDER: CP[] = [
  [-11, 0, 0, 0], [-6.5, 0.04, 0, 0], [-4, 0.2, 0, 0], [-2.5, 0.46, 0.05, 0], [-1.6, 0.7, 0.2, 0], [-1.0, 0.89, 0.45, 0],
  [-0.5, 0.98, 0.7, 0.03], [-0.1, 1.0, 0.8, 0.12], [0.25, 0.97, 0.8, 0.08], [0.5, 0.9, 0.7, 0.03], [0.68, 0.8, 0.6, 0], [0.82, 0.7, 0.5, 0],
  [0.95, 0.58, 0.4, 0], [1.1, 0.46, 0.3, 0], [1.3, 0.35, 0.2, 0], [1.55, 0.25, 0.1, 0], [1.85, 0.16, 0, 0], [2.2, 0.09, 0, 0],
  [2.7, 0.05, 0, 0], [3.4, 0.02, 0, 0.03], [4.2, 0.01, 0, 0.04], [5.2, 0, 0, 0.03], [6.5, 0, 0, 0.02], [8, 0, 0, 0], [9.5, 0, 0, 0], [11, 0, 0, 0],
];
const WHITEWATER: CP[] = [
  [-11, 0, 0, 0.1], [-6.5, 0.05, 0, 0.3], [-4, 0.2, 0, 0.7], [-2.6, 0.38, 0, 0.9], [-1.8, 0.5, 0, 1], [-1.2, 0.57, 0, 1],
  [-0.6, 0.6, 0, 1], [-0.1, 0.6, 0, 1], [0.4, 0.57, 0, 1], [0.8, 0.53, 0, 1], [1.2, 0.5, 0, 1], [1.6, 0.46, 0, 1],
  [2.0, 0.42, 0, 1], [2.5, 0.37, 0, 1], [3.0, 0.31, 0, 1], [3.6, 0.25, 0, 1], [4.3, 0.19, 0, 0.95], [5.0, 0.14, 0, 0.9],
  [5.8, 0.09, 0, 0.8], [6.8, 0.05, 0, 0.6], [7.9, 0.02, 0, 0.4], [9, 0.0, 0, 0.25], [10, 0, 0, 0.1], [10.6, 0, 0, 0.05], [10.8, 0, 0, 0], [11, 0, 0, 0],
];
const sampleCP = (cps: CP[]) => {
  const geo = new THREE.CatmullRomCurve3(cps.map(([z, y, t]) => new THREE.Vector3(z, y, t)), false, 'centripetal');
  const fo = new THREE.CatmullRomCurve3(cps.map(([, , , f]) => new THREE.Vector3(f, 0, 0)), false, 'centripetal');
  const out = new Float32Array(NZ * 4), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j < NZ; j++) {
    const u = j / (NZ - 1);
    geo.getPoint(u, a); fo.getPoint(u, b);
    out.set([a.x, Math.max(0, a.y), THREE.MathUtils.clamp(a.z, 0, 1), THREE.MathUtils.clamp(b.x, 0, 1)], j * 4);
  }
  return out;
};
const PB = sampleCP(BARREL), PS = sampleCP(SHOULDER), PW = sampleCP(WHITEWATER);
const sm = THREE.MathUtils.smoothstep;
/** Blend weights along the crest: [whitewater, barrel, shoulder]. */
export const weightsAt = (x: number): [number, number, number] => {
  const w = 1 - sm(x, -9.5, -4.5), s = sm(x, 3.5, 10);
  return [w, Math.max(0, 1 - w - s), s];
};
/** Height envelope along the crest (unit height). Ends sink into the sea. */
export const envAt = (x: number) => (0.72 + 0.28 * Math.exp(-(((x + 1) / 7) ** 2))) * (1 - sm(x, 9, XMAX)) * sm(x, XMIN, XMIN + 7);
const n1 = (x: number) => Math.sin(x * 1.7) * 0.5 + Math.sin(x * 4.1 + 1.3) * 0.3 + Math.sin(x * 9.7 + 0.4) * 0.2;

/** Cross-section at x as NZ x [z, y, thin, foam]. `curl` < 1 flattens the barrel toward a spilling swell (small waves). */
export function profileAt(x: number, curl: number, out: Float32Array = new Float32Array(NZ * 4)) {
  const [ww, wb, wc] = weightsAt(x), bw = wb * curl, sw = wc + wb * (1 - curl), env = envAt(x);
  const scal = 0.1 * n1(x * 0.9);
  for (let j = 0; j < NZ; j++) {
    const k = j * 4, lip = Math.exp(-(((j / (NZ - 1)) - 0.42) ** 2) / 0.012);
    for (let c = 0; c < 4; c++) out[k + c] = PW[k + c] * ww + PB[k + c] * bw + PS[k + c] * sw;
    out[k] += lip * scal * bw;
    out[k + 1] *= env;
    out[k + 3] = Math.min(1, out[k + 3] + (j > NZ * 0.3 && j < NZ * 0.55 ? 0.08 * sw : 0));
  }
  return out;
}

export interface WaveBuild {geo: THREE.BufferGeometry; pos: Float32Array; foam: Float32Array; thin: Float32Array}
export function makeWaveGeometry(): WaveBuild {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(NX * NZ * 3), foam = new Float32Array(NX * NZ), thin = new Float32Array(NX * NZ);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFoam', new THREE.BufferAttribute(foam, 1));
  geo.setAttribute('aThin', new THREE.BufferAttribute(thin, 1));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(NX * NZ * 3), 3));
  const idx: number[] = [];
  for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NZ - 1; j++) { const a = i * NZ + j, b = a + NZ; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  geo.setIndex(idx);
  return {geo, pos, foam, thin};
}
const prof = new Float32Array(NZ * 4);
export function fillWave(b: WaveBuild, curl: number) {
  for (let i = 0; i < NX; i++) {
    const x = XMIN + ((XMAX - XMIN) * i) / (NX - 1), ww = weightsAt(x)[0];
    profileAt(x, curl, prof);
    for (let j = 0; j < NZ; j++) {
      const k = j * 4, v = i * NZ + j;
      // Lumpy whitewater: foam balls rising and falling along the broken section.
      const bump = ww * prof[k + 1] * (0.1 * Math.sin(x * 2.1 + j * 0.31) + 0.07 * Math.sin(x * 5.3 - j * 0.17 + 1)) * Math.min(1, prof[k + 1] * 3);
      b.pos[v * 3] = x; b.pos[v * 3 + 1] = prof[k + 1] + bump; b.pos[v * 3 + 2] = prof[k];
      b.thin[v] = prof[k + 2]; b.foam[v] = prof[k + 3];
    }
  }
  b.geo.attributes.position.needsUpdate = true; b.geo.attributes.aFoam.needsUpdate = true; b.geo.attributes.aThin.needsUpdate = true;
  b.geo.computeVertexNormals();
  b.geo.computeBoundingSphere();
}
