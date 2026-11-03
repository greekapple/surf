/** wave-v3: the per-bucket break-cycle profile atlas (built by tools/blender/build_atlas.sh, licensed-derived, git-ignored) and the
 *  along-crest maths the live viewer's vertex shader uses, mirrored here on the CPU for the surfer placement, the spray emitters
 *  and tests. Keep `stageAt` / `ampAt` in step with the GLSL in WaveLive.tsx. Metres; y is cross-shore (+ toward the beach),
 *  z is up; along the crest x = 0 is the break point, the shoulder (unbroken, where the surfer rides) is x < 0. */

export interface AtlasMeta {
  band: string; face_m: number; family: string; breaker: 'spilling' | 'plunging'; stages: number; points: number;
  stage_feather: number; stage_pitch: number; stage_land: number; y0_m: number; y1_m: number;
  bed_along_per_m: number; cycle_s: number; break_len_m: number; shoulder_len_m: number; depth_break_m: number;
  celerity_mps: number; peel_speed_mps: number; period_s: number; Lb_m: number;
}
export interface Atlas {meta: AtlasMeta; half: Uint16Array; data: Float32Array}

/** IEEE half -> float. */
export function halfToFloat(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}

export function makeAtlas(meta: AtlasMeta, buf: ArrayBuffer): Atlas {
  const half = new Uint16Array(buf), n = meta.points * meta.stages * 2 * 4;
  if (half.length !== n) throw new Error(`atlas size ${half.length} != ${n}`);
  const data = new Float32Array(n); for (let i = 0; i < n; i++) data[i] = halfToFloat(half[i]);
  return {meta, half, data};
}

export async function loadAtlas(root: string, band: string): Promise<Atlas> {
  const [m, b] = await Promise.all([fetch(root + band + '.json'), fetch(root + band + '.bin')]);
  if (!m.ok || !b.ok) throw new Error('atlas missing');
  return makeAtlas(await m.json() as AtlasMeta, await b.arrayBuffer());
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Sections: the break point surges and the lip throws in pulses that travel down the line; none near the surfer. */
export function sections(m: AtlasMeta, x: number, t: number): number {
  const lam = 0.32 * m.break_len_m, ts = 0.55 * m.cycle_s;
  return 0.45 * Math.sin(2 * Math.PI * (x / lam - t / ts)) * smooth(-0.1 * lam, 0.25 * lam, x) * (1 - smooth(0.55 * m.break_len_m, m.break_len_m, x));
}

/** Fractional stage at along-crest x (and time t). Shoulder: H/depth rises toward 0.78 on the bed slope; past the break the
 *  cycle runs at the peel speed over break_len_m. */
export function stageAt(m: AtlasMeta, x: number, t = 0, withSections = true): number {
  let s: number;
  if (x < 0) {
    const d = m.depth_break_m + m.bed_along_per_m * -x, g = m.depth_break_m / d;
    const g0 = m.depth_break_m / (m.depth_break_m + m.bed_along_per_m * m.shoulder_len_m);
    s = m.stage_pitch * Math.pow(clamp((g - g0) / (1 - g0), 0, 1), 1.6);
  } else s = m.stage_pitch + (m.stages - 1 - m.stage_pitch) * clamp(x / m.break_len_m, 0, 1);
  if (withSections) s += sections(m, x, t);
  return clamp(s, 0, m.stages - 1);
}

/** The strip of crest the wave covers: shoulder end .. past the end of the break cycle. */
export function stripX(m: AtlasMeta): [number, number] {
  return [-(m.shoulder_len_m * 1.35 + 4 * m.face_m), m.break_len_m * 1.45 + 4 * m.face_m];
}

/** Height envelope along the crest: shoaling (Green's law) and a focused peak on the shoulder, the broken water losing height
 *  past the cycle, flat at both strip ends, plus a little irregularity. Never uniform. */
export function ampAt(m: AtlasMeta, x: number): number {
  const [x0, x1] = stripX(m);
  let a: number;
  if (x < 0) {
    const d = m.depth_break_m + m.bed_along_per_m * -x, peak = Math.exp(-((x / (0.55 * m.shoulder_len_m)) ** 2));
    a = Math.pow(m.depth_break_m / d, 0.25) * (0.42 + 0.58 * peak);
  } else a = 1 - 0.35 * smooth(0.5 * m.break_len_m, 1.25 * m.break_len_m, x);
  const w = 1 + 0.05 * Math.sin(x * 0.37 / Math.max(m.face_m, 0.6) + 1.3) + 0.035 * Math.sin(x * 0.91 / Math.max(m.face_m, 0.6) + 4.1);
  return a * w * smooth(x0, x0 + 0.3 * (0 - x0), x) * (1 - smooth(x1 - 0.3 * x1, x1, x));
}

/** Bilinear sample of the atlas like the GPU's linear filter at texel centres: group 0 = (y, z, thin, foam), 1 = (thickness, arc, ny, nz). */
export function sample(a: Atlas, u: number, s: number, group: 0 | 1 = 0): [number, number, number, number] {
  const {points: P, stages: S} = a.meta;
  const fu = clamp(u, 0, 1) * (P - 1), fs = clamp(s, 0, S - 1), i0 = Math.floor(fu), j0 = Math.floor(fs), i1 = Math.min(P - 1, i0 + 1), j1 = Math.min(S - 1, j0 + 1), du = fu - i0, ds = fs - j0;
  const row = (j: number) => (j + group * S) * P * 4, out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = a.data[row(j0) + i0 * 4 + c], v10 = a.data[row(j0) + i1 * 4 + c], v01 = a.data[row(j1) + i0 * 4 + c], v11 = a.data[row(j1) + i1 * 4 + c];
    out[c] = (v00 * (1 - du) + v10 * du) * (1 - ds) + (v01 * (1 - du) + v11 * du) * ds;
  }
  return out;
}

/** The cross-section at x (time t): arrays of (y, z) with the height envelope applied. */
export function profileAt(a: Atlas, x: number, t = 0, n = a.meta.points, withSections = true): {y: number[]; z: number[]; foam: number[]; thin: number[]} {
  const s = stageAt(a.meta, x, t, withSections), amp = ampAt(a.meta, x), y: number[] = [], z: number[] = [], foam: number[] = [], thin: number[] = [];
  for (let i = 0; i < n; i++) { const p = sample(a, i / (n - 1), s); y.push(p[0]); z.push(p[1] * amp); thin.push(p[2]); foam.push(p[3]); }
  return {y, z, foam, thin};
}

/** A point on the open face (beach side of the crest) at `frac` of trough-to-crest height: [y, z, slope radians]. */
export function facePoint(a: Atlas, x: number, frac: number): [number, number, number] {
  const {y, z} = profileAt(a, x, 0, 192, false);
  let ci = 0; for (let i = 1; i < z.length; i++) if (z[i] > z[ci]) ci = i;
  let tro = Infinity; for (let i = ci; i < z.length; i++) tro = Math.min(tro, z[i]);
  const target = tro + frac * (z[ci] - tro);
  let best: [number, number, number] | null = null;
  for (let i = ci; i < z.length - 1; i++) {
    const y0 = y[i], z0 = z[i], y1 = y[i + 1], z1 = z[i + 1];
    if ((z0 - target) * (z1 - target) <= 0 && y1 > y0 && z1 < z0) { const k = (target - z0) / (z1 - z0 + 1e-9); best = [y0 + (y1 - y0) * k, target, Math.atan2(z0 - z1, y1 - y0)]; }
  }
  return best ?? [y[ci] + 0.3 * a.meta.face_m, 0.5 * z[ci], 0.6];
}

/** Where the surfer rides: on the open shoulder just ahead of the pocket, where the face is steep but not yet pitching. */
export function surferX(m: AtlasMeta): number {
  const target = m.breaker === 'spilling' ? 2.7 : 0.72 * m.stage_pitch;
  let lo = -m.shoulder_len_m, hi = 0;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (stageAt(m, mid, 0, false) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
