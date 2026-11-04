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
export interface Atlas {meta: AtlasMeta; data: Float32Array}

/** The buckets the Blender build writes (tools/blender/wave_atlas.py BANDS): id, face height (band midpoint, m) and the family's own
 *  breaker. The forecast-driven viewer blends the two buckets around the hour's face height; the other breaker is the "-<breaker>" variant. */
export const ATLAS_BANDS: readonly {id: string; faceM: number; breaker: 'spilling' | 'plunging'}[] = [
  {id: '1-2', faceM: 0.46, breaker: 'spilling'}, {id: '2-3', faceM: 0.76, breaker: 'spilling'}, {id: '3-4', faceM: 1.07, breaker: 'plunging'}, {id: '4-6', faceM: 1.52, breaker: 'plunging'},
  {id: '6-8', faceM: 2.13, breaker: 'plunging'}, {id: '8-10', faceM: 2.74, breaker: 'plunging'}, {id: '10-15', faceM: 3.81, breaker: 'plunging'}, {id: '15-plus', faceM: 5.49, breaker: 'plunging'},
];
/** File id of a bucket drawn as a given breaker: the family's own breaker is the plain id, the other one has a suffix. */
export const atlasId = (band: {id: string; breaker: string}, breaker: 'spilling' | 'plunging' | null) => (breaker && breaker !== band.breaker ? `${band.id}-${breaker}` : band.id);
/** The two buckets around a face height and the blend weight toward the upper one (0 at or below the smallest, 1 at or above the largest). */
export function bucketsFor(faceM: number): {lo: number; hi: number; w: number} {
  const B = ATLAS_BANDS;
  if (!(faceM > B[0].faceM)) return {lo: 0, hi: 0, w: 0};
  for (let i = 1; i < B.length; i++) if (faceM <= B[i].faceM) return {lo: i - 1, hi: i, w: (faceM - B[i - 1].faceM) / (B[i].faceM - B[i - 1].faceM)};
  return {lo: B.length - 1, hi: B.length - 1, w: 0};
}
/** The size bucket a face height is drawn nearest to (the poster and the Spin fallback use it); '' for no face. */
export const bucketIdFor = (faceM: number | null) => { if (faceM === null) return ''; const b = bucketsFor(faceM); return ATLAS_BANDS[b.w < 0.5 ? b.lo : b.hi].id; };
const NUM_META: (keyof AtlasMeta)[] = ['face_m', 'stage_feather', 'stage_pitch', 'stage_land', 'y0_m', 'y1_m', 'bed_along_per_m', 'cycle_s', 'break_len_m', 'shoulder_len_m', 'depth_break_m', 'celerity_mps', 'peel_speed_mps', 'period_s', 'Lb_m'];
/** Two buckets mixed: every table value and every numeric parameter lerped (the arc-length resampling means the same u is the same
 *  material point in both, so positions mix without folding). Strings come from the nearer bucket. */
export function blendAtlas(a: Atlas, b: Atlas, w: number): Atlas {
  if (w <= 0 || a === b) return a; if (w >= 1) return b;
  if (a.meta.stages !== b.meta.stages || a.meta.points !== b.meta.points) throw new Error('atlas layouts differ');
  const near = w < 0.5 ? a : b, meta = {...near.meta} as AtlasMeta;
  for (const k of NUM_META) (meta as unknown as Record<string, number>)[k] = (a.meta[k] as number) * (1 - w) + (b.meta[k] as number) * w;
  const data = new Float32Array(a.data.length); for (let i = 0; i < data.length; i++) data[i] = a.data[i] * (1 - w) + b.data[i] * w;
  return {meta, data};
}
/** A bucket scaled by k (for face heights outside the bucket range): every metre-valued table column and parameter times k,
 *  the dimensionless ones (thin, foam, normals, stage indices, speeds and times) kept. */
export function scaleAtlas(a: Atlas, k: number): Atlas {
  if (Math.abs(k - 1) < 1e-6) return a;
  const {stages: S, points: P} = a.meta, data = new Float32Array(a.data.length);
  for (let j = 0; j < 2 * S; j++) for (let i = 0; i < P; i++) {
    const o = (j * P + i) * 4, g = j < S;   // group 0: (y, z, thin, foam); group 1: (thickness, arc, normal_y, normal_z)
    data[o] = a.data[o] * k; data[o + 1] = a.data[o + 1] * k; data[o + 2] = a.data[o + 2]; data[o + 3] = a.data[o + 3];
    if (!g) data[o + 1] = a.data[o + 1] * k;
  }
  const r = Math.sqrt(k), m = {...a.meta, face_m: a.meta.face_m * k, y0_m: a.meta.y0_m * k, y1_m: a.meta.y1_m * k, depth_break_m: a.meta.depth_break_m * k, Lb_m: a.meta.Lb_m * r, celerity_mps: a.meta.celerity_mps * r,
    peel_speed_mps: a.meta.peel_speed_mps * r, break_len_m: a.meta.break_len_m * r, shoulder_len_m: a.meta.shoulder_len_m * r};
  return {meta: m, data};
}
/** The swell period's share (P from the forecast hour, the bucket's own period otherwise): wavelength, break cycle and peel length
 *  follow the period (Lb = T·c, cycle = T·k), so a long-period swell breaks slower and wider than a short one at the same face height. */
export function withPeriod(a: Atlas, periodS: number | null): Atlas {
  if (!periodS || !Number.isFinite(periodS) || periodS < 4 || Math.abs(periodS - a.meta.period_s) < 0.05) return a;
  const r = periodS / a.meta.period_s, meta = {...a.meta, period_s: periodS, Lb_m: a.meta.Lb_m * r, cycle_s: a.meta.cycle_s * r, break_len_m: a.meta.break_len_m * r};
  return {meta, data: a.data};
}

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
  return {meta, data};
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
  return 0.28 * Math.sin(2 * Math.PI * (x / lam - t / ts)) * smooth(-0.1 * lam, 0.25 * lam, x) * (1 - smooth(0.55 * m.break_len_m, m.break_len_m, x));
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
  } else a = 1 - 0.5 * smooth(0.25 * m.break_len_m, 1.05 * m.break_len_m, x);   // S1 (R7): the broken section loses half its height within a break length
  const w = 1 + 0.05 * Math.sin(x * 0.37 / Math.max(m.face_m, 0.6) + 1.3) + 0.035 * Math.sin(x * 0.91 / Math.max(m.face_m, 0.6) + 4.1);
  return a * w * smooth(x0, x0 + 0.3 * (0 - x0), x) * (1 - smooth(x1 - 0.3 * x1, x1, x));
}

/** S1 (R7): the crest is gently curved in plan, the shoulder sweeping seaward away from the peak (refraction over the bar; a ruler-straight
 *  line read as an endless wall): the crest-frame z shift (+ seaward, metres) at along-crest x, 0 at and past the break point, growing as
 *  the square of the distance out along the shoulder to 0.12 x shoulder_len at 1.2 shoulder lengths out, then held. A pure translation
 *  of the profile across the shore: the face height at the rider is untouched. Keep in step with bendZ in the GLSL ALONG block. */
export function bendZ(m: AtlasMeta, x: number): number { const s = clamp(-x / (1.2 * m.shoulder_len_m), 0, 1); return BEND_Z * m.shoulder_len_m * s * s; }
/** R11 (user: "the wave has a weird little curvature that's inaccurate"): R7's plan-view sweep of the shoulder, 0.12 of the shoulder length at
 *  1.2 shoulder lengths out, is reduced to a third: real refraction bends the line gently and only far down the shoulder, never visibly
 *  near the rider. The GLSL copies in WaveLive carry the same constant. */
export const BEND_Z = 0.04;
/** The bend's weight along the profile: full over the wave itself, fading to 0 at both flat tails so the strip's edges (and the sea seam
 *  under them) stay where they are; the tails stretch to take up the shift. Keep in step with bendW in the GLSL ALONG block. */
export function bendW(u: number): number { return smooth(0, 0.3, u) * (1 - smooth(0.9, 1, u)); }

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
  const s = stageAt(a.meta, x, t, withSections), amp = ampAt(a.meta, x), bz = bendZ(a.meta, x), y: number[] = [], z: number[] = [], foam: number[] = [], thin: number[] = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1), p = sample(a, u, s); y.push(p[0] - bz * bendW(u)); z.push(p[1] * amp); thin.push(p[2]); foam.push(p[3]); }   // atlas y is -z: the bend moves the wave seaward
  return {y, z, foam, thin};
}

// scratch profiles for the per-frame callers (facePoint, waterHeightAt): no allocation in the render loop
const SY = new Float64Array(192), SZ = new Float64Array(192);
function profileInto(a: Atlas, x: number, t: number, n: number, withSections: boolean, y: Float64Array, z: Float64Array) {
  const s = stageAt(a.meta, x, t, withSections), amp = ampAt(a.meta, x), bz = bendZ(a.meta, x), {points: P, stages: S} = a.meta;
  const fs = clamp(s, 0, S - 1), j0 = Math.floor(fs), j1 = Math.min(S - 1, j0 + 1), ds = fs - j0, r0 = j0 * P * 4, r1 = j1 * P * 4, d = a.data;
  for (let i = 0; i < n; i++) {
    const uu = i / (n - 1), fu = uu * (P - 1), i0 = Math.floor(fu), i1 = Math.min(P - 1, i0 + 1), du = fu - i0;
    y[i] = (d[r0 + i0 * 4] * (1 - du) + d[r0 + i1 * 4] * du) * (1 - ds) + (d[r1 + i0 * 4] * (1 - du) + d[r1 + i1 * 4] * du) * ds - bz * bendW(uu);
    z[i] = ((d[r0 + i0 * 4 + 1] * (1 - du) + d[r0 + i1 * 4 + 1] * du) * (1 - ds) + (d[r1 + i0 * 4 + 1] * (1 - du) + d[r1 + i1 * 4 + 1] * du) * ds) * amp;
  }
}

/** A point on the open face (beach side of the crest) at `frac` of trough-to-crest height: [y, z, slope radians]. With `t` the
 *  sections pulses are included (the surface the shader draws at that moment). */
export function facePoint(a: Atlas, x: number, frac: number, t: number | null = null): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]; facePointInto(a, x, frac, t, out); return out;
}
/** `facePoint` without allocation: writes [y, z, slope, crest - trough] into `out` (the rider simulation calls it several times per step). */
export function facePointInto(a: Atlas, x: number, frac: number, t: number | null, out: {[i: number]: number}): void {
  const n = 192, y = SY, z = SZ; profileInto(a, x, t ?? 0, n, t !== null, y, z);
  let ci = 0; for (let i = 1; i < n; i++) if (z[i] > z[ci]) ci = i;
  // the front face: from the trough on the beach side (+y) of the crest up to the crest. Walk it upward from the trough and take the first
  // crossing of the target height, so the point is on the face proper, never on the thrown lip above it (which overhangs the same heights).
  const toBeach = y[n - 1] > y[0] ? 1 : -1;
  let ti = ci; for (let i = ci; i >= 0 && i < n; i += toBeach) if (z[i] < z[ti]) ti = i;
  const tro = z[ti], target = tro + Math.min(0.97, Math.max(0.02, frac)) * (z[ci] - tro);
  for (let i = ti; i !== ci; i -= toBeach) {
    const j = i - toBeach, y0 = y[i], z0 = z[i], y1 = y[j], z1 = z[j];   // i: lower, j: the next point up the face
    if ((z0 - target) * (z1 - target) <= 0 && z1 !== z0) {
      // the slope over a few samples either side (one float16 step is too noisy): rise over the run toward the sea
      const lo = Math.max(0, Math.min(n - 1, i + 3 * toBeach)), hi = Math.max(0, Math.min(n - 1, j - 3 * toBeach));
      const k = (target - z0) / (z1 - z0), slope = Math.atan2(z[hi] - z[lo], Math.max(1e-3, (y[lo] - y[hi]) * toBeach));
      out[0] = y0 + (y1 - y0) * k; out[1] = target; out[2] = Math.min(Math.max(slope, 0), Math.PI / 2); out[3] = z[ci] - tro; return;
    }
  }
  out[0] = y[ci] + 0.05 * a.meta.face_m; out[1] = 0.5 * (z[ci] + tro); out[2] = 0.6; out[3] = z[ci] - tro;
}

/** Signed distance (m) from a crest-frame point (x, height yh, z) to the front face of the profile at x (trough to crest, the surface the
 *  rider is on): positive on the beach/air side of the face, negative inside the water. A vertical gap is meaningless on a 70 deg face
 *  and a column sample lands on the lip or the back near the crest; this is what the board's contact is measured by. */
export function faceDistanceAt(a: Atlas, x: number, yh: number, zc: number, t: number): number {
  const n = 192, y = SY, z = SZ, ya = -zc; profileInto(a, x, t, n, true, y, z);
  let ci = 0; for (let i = 1; i < n; i++) if (z[i] > z[ci]) ci = i;
  const toBeach = y[n - 1] > y[0] ? 1 : -1; let ti = ci; for (let i = ci; i >= 0 && i < n; i += toBeach) if (z[i] < z[ti]) ti = i;
  let best = Infinity, sign = 1;
  for (let i = ti; i !== ci; i -= toBeach) {
    const j = i - toBeach, ay = y[i], az = z[i], by = y[j], bz = z[j], ey = by - ay, ez = bz - az, l2 = ey * ey + ez * ez; if (l2 < 1e-10) continue;
    const k = Math.min(1, Math.max(0, ((ya - ay) * ey + (yh - az) * ez) / l2)), py = ay + ey * k, pz = az + ez * k, dy = ya - py, dz = yh - pz, d = Math.hypot(dy, dz);
    if (d < best) { best = d; const nyv = ez * toBeach, nzv = -ey * toBeach; sign = dy * nyv + dz * nzv >= 0 ? 1 : -1; }   // the face normal toward the beach side
  }
  return Number.isFinite(best) ? sign * best : yh;
}

/** The water surface height at crest-frame (x, z) (z = -y_across, the beach at -z) at time t: the lowest crossing of the profile, so under
 *  an overhanging lip it is the face, not the lip. Outside the profile's reach: still water (0). The rider's board is checked against it. */
export function waterHeightAt(a: Atlas, x: number, zc: number, t: number): number {
  const n = 160, y = SY, z = SZ, ya = -zc; profileInto(a, x, t, n, true, y, z);
  let best = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const y0 = y[i], y1 = y[i + 1];
    if ((y0 - ya) * (y1 - ya) <= 0 && y0 !== y1) { const k = (ya - y0) / (y1 - y0); best = Math.min(best, z[i] + (z[i + 1] - z[i]) * k); }
  }
  return Number.isFinite(best) ? best : 0;
}

/** Where the lip is pitching now: the FIRST along-crest x (from the shoulder) where the stage with its travelling pulses reaches
 *  stage_pitch. The pulses make the stage locally non-monotonic past the break point, so a plain bisection landed on any of several
 *  crossings and jumped between them; the first crossing is the section the rider is ahead of. */
export function breakX(m: AtlasMeta, t: number): number {
  const x0 = -m.shoulder_len_m, x1 = 0.6 * m.break_len_m, n = 96; let lo = x0, hi = x1, found = false;
  for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; if (stageAt(m, x, t, true) >= m.stage_pitch) { hi = x; lo = x0 + (x1 - x0) * (i - 1) / n; found = true; break; } }
  if (!found) return x1;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (stageAt(m, mid, t, true) < m.stage_pitch) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Where the surfer rides: on the open shoulder just ahead of the pocket, where the face is steep but not yet pitching. */
export function surferX(m: AtlasMeta): number {
  const target = m.breaker === 'spilling' ? 2.7 : 0.72 * m.stage_pitch;
  let lo = -m.shoulder_len_m, hi = 0;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (stageAt(m, mid, 0, false) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** The water roof above a crest-frame point (x, height yh, z): the lowest profile crossing of the point's cross-shore line that sits above
 *  it (the underside of a thrown lip), as a gap in metres; Infinity with open sky. The barrel check: the rider's head under the lip.
 *  R9: NaN when the point is inside the water (an odd number of crossings above it: in the lip, or in the wave's body behind the face);
 *  before, a head buried in the lip read the lip's top surface as its "roof" and counted as inside the tube. */
export function roofAboveAt(a: Atlas, x: number, yh: number, zc: number, t: number): number {
  const n = 192, y = SY, z = SZ, ya = -zc; profileInto(a, x, t, n, true, y, z);
  let best = Infinity, above = 0;
  for (let i = 0; i < n - 1; i++) {
    const y0 = y[i], y1 = y[i + 1];
    if ((y0 < ya) !== (y1 < ya)) {   // half-open: a vertex exactly on the line counts once, so the parity (air / water) holds
      const k = (ya - y0) / (y1 - y0), zz = z[i] + (z[i + 1] - z[i]) * k;
      if (zz > yh) { above++; if (zz - yh < best) best = zz - yh; }
    }
  }
  return above % 2 === 1 ? NaN : best;
}
