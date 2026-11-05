/** R16 (T-134 phase 1): ONE parametric surfboard, `buildBoard(params)`, for the wave scene and the Quiver (spec 2026-11-05-3d-r16-board-feet).
 *  Pure geometry (no three.js): positions, uvs, indices and material groups in the surfer model's board frame (glTF: x along the board,
 *  NOSE AT -X, y up, z across; metres; the bottom's flat spot at y = 0), plus the analytic deck height `deckAt(x, z)` the feet are planted
 *  on (the viewer's leg IK and the Blender builder read the same function: tools/blender/assets/board-deck.json is exported from it).
 *  Every parameter carries a `source` so the user's photographed board (T-136) can replace the reference field by field.
 *  The reference board (REFERENCE_BOARD) is a typical high-performance shortboard, 5'10" x 19 1/4" x 2 3/8" (about 28-29 L), squash
 *  tail, thruster; its outline, rocker, foil and fin numbers are from public spec sheets and dimension charts, cited in
 *  docs/3d/FINDINGS-2026-11-04.md section 18. Before R16 the wave rode a 6'0" board baked into the surfer GLB (build_surfer.py) and the
 *  Quiver deformed five template GLBs: two formulas for one board, no stringer, a flat bottom, plate fins, no wax. */
import type {Surfboard} from '../../models/index';

const IN = 0.0254;
export type BoardSource = 'default' | 'quiver' | 'photo';
export interface Field<T> {value: T; source: BoardSource}
export type RailKind = 'soft' | 'medium' | 'hard';
export type TailKind = 'squash' | 'round' | 'swallow' | 'pin';
export type FinSetup = 'thruster' | 'quad' | 'twin' | 'single' | 'none';
export interface BoardParams {
  /** overall dimensions (m) */
  lengthM: Field<number>; widthM: Field<number>; thicknessM: Field<number>;
  /** the outline: the wide point as a fraction of the length from the nose; the widths 12" from the nose and 12" from the tail and the
   *  tail block, as fractions of the width */
  outline: Field<{wideFromNose: number; noseW12: number; tailW12: number; tailBlock: number}>;
  /** the rocker: the nose and tail lift over the flat (m) and where the flat spot sits (fraction of the length from the tail) */
  rocker: Field<{noseM: number; tailM: number; flatFromTail: number}>;
  /** the foil: the thickness 12" from the nose and 12" from the tail as fractions of the full thickness, the thickest point (fraction from the nose) */
  foil: Field<{nose12: number; tail12: number; peakFromNose: number}>;
  rail: Field<RailKind>; tail: Field<TailKind>; fins: Field<FinSetup>;
  /** the Quiver's traced half-widths (fractions of the length, nose to tail); rescaled so the widest point is the entered width */
  traced?: number[] | null;
  /** a soft-top (foam deck, slick bottom): fat rounded rails, a flat bottom, no stringer; the deck faces are the foam part ('wax' group) */
  softTop?: Field<boolean>;
}
/** What a reference model adds over the category (src/data/referenceBoards.ts): its traced outline, a measured rocker, the soft-top flag. */
export interface ReferenceShape {hw?: number[]; rocker?: {noseIn: number; tailIn: number; flatFromTail: number}; softTop?: boolean}
const F = <T,>(value: T, source: BoardSource = 'default'): Field<T> => ({value, source});

/** The reference board: 5'10" x 19 1/4" x 2 3/8", squash, thruster (FINDINGS section 18 for the sources of every number). */
export const REFERENCE_BOARD: BoardParams = {
  lengthM: F(70 * IN), widthM: F(19.25 * IN), thicknessM: F(2.375 * IN),
  outline: F({wideFromNose: 0.515, noseW12: 0.60, tailW12: 0.76, tailBlock: 0.36}),   // 11 1/2" nose, 14 5/8" tail, 7" block, wide point 1" behind centre
  rocker: F({noseM: 4.9 * IN, tailM: 2.3 * IN, flatFromTail: 0.42}),
  foil: F({nose12: 0.56, tail12: 0.7, peakFromNose: 0.5}),
  rail: F('medium'), tail: F('squash'), fins: F('thruster'),
};

/** Category defaults for a Quiver board (its dimensions are the record's, the rest typical for the type). */
export function boardParamsFor(b: Pick<Surfboard, 'length' | 'width' | 'thickness' | 'type'> & {tail?: string; fins?: string}, traced?: number[] | null, ref?: ReferenceShape | null): BoardParams {
  const type = b.type, longish = type === 'Longboard' || type === 'Funboard' || type === 'Soft-top', fishy = type === 'Fish', mid = type === 'Midlength' || type === 'Hybrid' || type === 'Groveler', gun = type === 'Gun' || type === 'Step-up';
  const tailText = (b.tail ?? '').toLowerCase(), finText = (b.fins ?? '').toLowerCase();
  const tail: TailKind = /swallow|fish/.test(tailText) ? 'swallow' : /pin/.test(tailText) ? 'pin' : /round|thumb|diamond/.test(tailText) ? 'round' : /squash|square/.test(tailText) ? 'squash' : fishy ? 'swallow' : gun ? 'pin' : longish || mid ? 'round' : 'squash';
  const fins: FinSetup = /quad/.test(finText) ? 'quad' : /twin|keel/.test(finText) ? 'twin' : /single/.test(finText) ? 'single' : /thruster|tri|2\s*\+\s*1/.test(finText) ? 'thruster' : fishy ? 'twin' : longish ? 'single' : 'thruster';
  const q = (v: number) => F(v, 'quiver');
  const soft = !!ref?.softTop, own = traced && traced.length > 2 ? traced : null, refHw = !own && ref?.hw && ref.hw.length > 2 ? ref.hw : null;
  const out: BoardParams = {
    lengthM: q((b.length || 70) * IN), widthM: q((b.width || 19.5) * IN), thicknessM: q((b.thickness || 2.4) * IN),
    outline: F(longish ? {wideFromNose: 0.5, noseW12: 0.78, tailW12: 0.7, tailBlock: 0.3} : fishy ? {wideFromNose: 0.47, noseW12: 0.7, tailW12: 0.86, tailBlock: 0.55} : mid ? {wideFromNose: 0.5, noseW12: 0.7, tailW12: 0.72, tailBlock: 0.3} : gun ? {wideFromNose: 0.47, noseW12: 0.5, tailW12: 0.58, tailBlock: 0.1} : REFERENCE_BOARD.outline.value),
    rocker: F(longish ? {noseM: 0.11, tailM: 0.07, flatFromTail: 0.4} : fishy ? {noseM: 0.09, tailM: 0.04, flatFromTail: 0.42} : gun ? {noseM: 0.15, tailM: 0.07, flatFromTail: 0.45} : REFERENCE_BOARD.rocker.value),
    foil: F(longish ? {nose12: 0.72, tail12: 0.72, peakFromNose: 0.48} : REFERENCE_BOARD.foil.value),
    rail: F(longish || fishy ? 'soft' : gun ? 'hard' : 'medium', tailText || finText ? 'quiver' : 'default'), tail: F(tail, tailText ? 'quiver' : 'default'), fins: F(fins, finText ? 'quiver' : 'default'),
    traced: own ?? refHw ?? null,
  };
  // the reference model: the traced deck photo (its outline), the measured rocker and the soft-top build are 'photo' fields; the rest stay as above
  if (refHw) out.outline = F(out.outline.value, 'photo');
  if (ref?.rocker) out.rocker = F({noseM: ref.rocker.noseIn * IN, tailM: ref.rocker.tailIn * IN, flatFromTail: ref.rocker.flatFromTail}, 'photo');
  if (soft) { out.softTop = F(true, 'photo'); out.rail = F('soft', 'photo'); }
  return out;
}

/** Monotone (Fritsch-Carlson) cubic through the points: smooth, no overshoot between them. */
export function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length, d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  return (x: number) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** The board's curves from its params; t runs 0 = tail to 1 = nose. All in metres. */
export interface BoardCurves {
  L: number; W: number; T: number;
  /** half width at t (the outline, before the tip and tail-corner rounding) */ half: (t: number) => number;
  /** the half width the mesh uses at t: the outline with the rounded nose tip and the tail's cut */ halfCut: (t: number) => number;
  rocker: (t: number) => number; thick: (t: number) => number;
  /** the rail apex height (fraction of the thickness) and the bottom edge's exponent at t: soft and round forward, lower and harder toward the tail */
  apex: (t: number) => number; edgeK: (t: number) => number;
  /** the bottom's concave lift at t and q = across / half width (single-to-double) */ concave: (t: number, q: number) => number;
  /** deck height at (x, z), board frame; the rail apex height outside the outline */ deckAt: (x: number, z: number) => number;
  /** bottom height at (x, z) */ bottomAt: (x: number, z: number) => number;
  /** the deck's unit normal at (x, z) into out (3 numbers) */ deckNormalAt: (x: number, z: number, out: Float32Array | number[]) => void;
  /** the swallow's notch depth (m, 0 for other tails) */ notchM: number;
  /** the x range of the wax (the foot zone) and of the tail pad */ waxX: [number, number]; padX: [number, number];
}
const DECK_K = 0.75;
export function boardCurves(p: BoardParams): BoardCurves {
  const L = p.lengthM.value, W = p.widthM.value, T = p.thicknessM.value, k = Math.sqrt(L / 1.778), o = p.outline.value, r = p.rocker.value, f = p.foil.value, tail = p.tail.value;
  const in12 = Math.min(0.3, 12 * IN / L), in6 = in12 / 2;
  // the outline: a monotone cubic through the tail block, 12" and 6" from the tail, the wide point, 12" and 6" from the nose and the tip
  const tailBlock = tail === 'pin' ? Math.min(o.tailBlock, 0.12) : tail === 'round' ? Math.min(o.tailBlock, 0.26) : tail === 'swallow' ? Math.max(o.tailBlock, 0.5) : o.tailBlock;
  const tailW12 = tail === 'pin' ? Math.min(o.tailW12, 0.62) : o.tailW12, wide = 1 - o.wideFromNose;
  const tail6 = tailBlock + (tailW12 - tailBlock) * (tail === 'round' ? 0.62 : tail === 'pin' ? 0.55 : 0.68), nose6 = o.noseW12 * (o.noseW12 > 0.75 ? 0.8 : 0.7);
  let half: (t: number) => number;
  if (p.traced && p.traced.length > 2) {
    const tr = p.traced, mx = Math.max(...tr) || 1, n = tr.length;
    half = (t) => { const fi = Math.min(1, Math.max(0, 1 - t)) * (n - 1), i = Math.min(n - 2, Math.floor(fi)), s = fi - i; return (tr[i] * (1 - s) + tr[i + 1] * s) / mx * 0.5 * W; };
  } else {
    const curve = monotone([0, in6, in12, wide, 1 - in12, 1 - in6, 1], [tailBlock, tail6, tailW12, 1, o.noseW12, nose6, 0.08].map((v) => v * 0.5 * W));
    half = curve;
  }
  // the nose tip rounded (a circle of radius rNose tangent to the outline) and the tail's cut: the squash's corners rounded, the round
  // tail a half circle, the pin to a point, the swallow a block with the notch (the notch is in the x of the tail rings, see buildBoard)
  const rNose = 0.02 * k, hwEnd = half(0), rCorner = tail === 'squash' ? Math.min(0.03 * k, hwEnd * 0.5) : tail === 'swallow' ? Math.min(0.012, hwEnd * 0.3) : tail === 'round' ? hwEnd : Math.min(0.012, hwEnd);
  const halfCut = (t: number) => {
    let h = half(t);
    const dn = (1 - t) * L; if (dn < rNose) h = Math.min(h, Math.sqrt(Math.max(0, 2 * rNose * dn - dn * dn)));
    const dt = t * L; if (dt < rCorner) h = Math.min(h, (tail === 'round' ? 0 : hwEnd - rCorner) + Math.sqrt(Math.max(0, 2 * rCorner * dt - dt * dt)));
    return Math.max(h, 0.003);
  };
  const t0 = r.flatFromTail;
  const rocker = (t: number) => (t >= t0 ? r.noseM * Math.pow((t - t0) / (1 - t0), 2.3) : r.tailM * Math.pow((t0 - t) / t0, 1.9));
  const tp = 1 - f.peakFromNose;
  const thickCurve = monotone([0, in12, tp, 1 - in12, 1], [tail === 'pin' ? 0.2 : 0.3, f.tail12, 1, f.nose12, 0.08]);
  const thick = (t: number) => Math.max(0.004, T * thickCurve(t) * (1 - t < rNose / L ? Math.max(0.3, Math.sqrt(Math.max(0, (1 - t) * L / rNose))) : 1));
  const soft = !!p.softTop?.value, railD = soft ? 0.1 : p.rail.value === 'soft' ? 0.06 : p.rail.value === 'hard' ? -0.05 : 0;   // a soft-top's rails are fatter and rounder still
  const apex = (t: number) => Math.min(0.55, Math.max(0.2, 0.3 + 0.18 * Math.min(1, t / 0.6) + railD));
  const edgeK = (t: number) => 2.2 + 1.6 * Math.max(0, 1 - t / 0.45) - railD * 6;
  // the bottom: a single concave through the middle (deepest just ahead of the fins) running into a shallow double concave at the tail
  const c1 = (t: number) => 0.004 * k * Math.max(0, 1 - Math.pow((t - 0.42) / 0.36, 2)), c2 = (t: number) => 0.0022 * k * Math.max(0, 1 - Math.pow((t - 0.16) / 0.2, 2));
  const concave = (t: number, q: number) => { if (soft) return 0; const aq = Math.min(1, Math.abs(q)); return c1(t) * (1 - aq * aq) + c2(t) * Math.max(0, 1 - Math.pow((aq - 0.5) / 0.45, 2)); };
  const tOf = (x: number) => Math.min(1, Math.max(0, 0.5 - x / L));
  const deckAt = (x: number, z: number) => { const t = tOf(x), hw = halfCut(t), q = Math.min(1, Math.abs(z) / hw), s = Math.sqrt(Math.max(0, 1 - q * q * q * q)), a = apex(t); return rocker(t) + thick(t) * (a + (1 - a) * Math.pow(s, DECK_K)); };
  const bottomAt = (x: number, z: number) => { const t = tOf(x), hw = halfCut(t), q = Math.min(1, Math.abs(z) / hw), s = Math.sqrt(Math.max(0, 1 - q * q * q * q)); return rocker(t) + thick(t) * apex(t) * (1 - Math.pow(s, edgeK(t))) + concave(t, q) * s; };
  const deckNormalAt = (x: number, z: number, out: Float32Array | number[]) => { const e = 0.004, dx = (deckAt(x + e, z) - deckAt(x - e, z)) / (2 * e), dz = (deckAt(x, z + e) - deckAt(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz); out[0] = -dx / l; out[1] = 1 / l; out[2] = -dz / l; };
  const padLen = Math.min(0.44 * k, 0.26 * L), padBack = 0.5 * L - 0.045 * k - (tail === 'swallow' ? 0.03 * k : 0);
  return {L, W, T, half, halfCut, rocker, thick, apex, edgeK, concave, deckAt, bottomAt, deckNormalAt, notchM: tail === 'swallow' ? 0.095 * k : 0, waxX: [-0.42 * L, padBack - padLen], padX: [padBack - padLen, padBack]};
}

export type BoardPart = 'resin' | 'wax' | 'stringer' | 'pad' | 'fin' | 'finbox';
export interface BoardGeometryData {
  positions: Float32Array; uvs: Float32Array; indices: Uint32Array;
  /** material groups: contiguous index ranges per part */ groups: {start: number; count: number; part: BoardPart}[];
  curves: BoardCurves; tris: number;
  bounds: {min: [number, number, number]; max: [number, number, number]};
  /** the hull alone (no fins, pad or stringer): what the sim and the contact probes measure the board by */ hullBounds: {min: [number, number, number]; max: [number, number, number]};
  /** each fin's base centre (board frame) and which side it is on */ fins: {x: number; z: number; side: -1 | 0 | 1}[];
}
export interface BuildOptions {segments?: number; ring?: number; stringer?: boolean; pad?: boolean; fins?: boolean}

/** The board mesh: a lofted hull (rings along the board, Chebyshev-spaced so the nose and tail curves get the vertices, the vertices
 *  pulled toward the rails), a rounded nose, the tail cut per type, a domed deck over a single-to-double concave bottom with tucked
 *  edges, the stringer as a thin ribbon on the deck and the bottom, the tail pad (three pieces, a kick), foiled fins (a flat inside face,
 *  a cambered outside face, fin boxes), faced outward (T-139). About 4.7k triangles at the defaults. */
export function buildBoard(p: BoardParams, opt: BuildOptions = {}): BoardGeometryData {
  const soft = !!p.softTop?.value, c = boardCurves(p), {L, W} = c, ns = opt.segments ?? 64, nr = opt.ring ?? 26, k = Math.sqrt(L / 1.778);
  const pos: number[] = [], uv: number[] = [], parts: Record<BoardPart, number[]> = {resin: [], wax: [], stringer: [], pad: [], fin: [], finbox: []};
  const V = (x: number, y: number, z: number, u = x, v = z) => { pos.push(x, y, z); uv.push(u, v); return pos.length / 3 - 1; };
  const tri = (part: BoardPart, a: number, b: number, d: number) => parts[part].push(a, b, d);
  const quad = (part: BoardPart, a: number, b: number, d: number, e: number) => { tri(part, a, b, d); tri(part, a, d, e); };
  // ---- the hull
  const tAt = (i: number) => 0.5 - 0.5 * Math.cos(Math.PI * i / ns);
  const ringStart: number[] = [], ringX: number[] = [];
  for (let i = 0; i <= ns; i++) {
    const t = tAt(i), hw = c.halfCut(t), th = c.thick(t), zr = c.rocker(t), a0 = c.apex(t), kB = c.edgeK(t), x0 = (0.5 - t) * L;
    ringStart.push(pos.length / 3); ringX.push(x0);
    for (let j = 0; j < nr; j++) {
      const a = 2 * Math.PI * j / nr, cu = Math.cos(a), su = Math.sin(a), q = Math.sqrt(Math.abs(cu)), across = hw * Math.sign(cu) * q, s = Math.sqrt(Math.max(0, 1 - cu * cu));
      const y = su >= 0 ? zr + th * (a0 + (1 - a0) * Math.pow(s, DECK_K)) : zr + th * a0 * (1 - Math.pow(s, kB)) + c.concave(t, q) * s;
      // the swallow: the tail rings shear forward toward the stringer (the notch), deepest at the end ring
      const x = c.notchM > 0 && t * L < c.notchM * 1.4 ? x0 - c.notchM * Math.max(0, 1 - Math.abs(across) / Math.max(hw, 0.01)) * Math.max(0, 1 - t * L / (c.notchM * 1.4)) : x0;
      V(x, y, across);
    }
  }
  const deckFace = (j: number) => (j + 0.5) / nr < 0.5;   // the face between vertex j and j + 1 lies on the deck
  for (let i = 0; i < ns; i++) {
    const xm = (ringX[i] + ringX[i + 1]) / 2, inWax = xm > c.waxX[0] && xm < c.waxX[1];
    for (let j = 0; j < nr; j++) {
      const a = ringStart[i] + j, b = ringStart[i] + (j + 1) % nr, d = a + nr, e = b + nr, part: BoardPart = deckFace(j) && (inWax || soft) ? 'wax' : 'resin';
      tri(part, a, b, d); tri(part, b, e, d);   // outward (the signed volume of the hull reads +, see the test)
    }
  }
  const tailC = V(0.5 * L - c.notchM, c.rocker(0) + c.thick(0) * c.apex(0), 0), noseC = V(-0.5 * L, c.rocker(1) + c.thick(1) * c.apex(1), 0);
  for (let j = 0; j < nr; j++) { tri('resin', tailC, ringStart[0] + j, ringStart[0] + (j + 1) % nr); tri('resin', noseC, ringStart[ns] + (j + 1) % nr, ringStart[ns] + j); }
  const hullEnd = pos.length;
  // ---- the stringer: a 5 mm ribbon 0.4 mm proud of the deck and the bottom, along the centreline
  if (opt.stringer ?? !soft) {   // a soft-top has no visible stringer
    const sw = 0.0025 * k, n = ns, dk: number[] = [], bt: number[] = [];   // the ribbon at the rings' own x (the Quiver's station map keys on x)
    // the ribbon's x follows the tail's own cut: the swallow's rings are sheared forward at the stringer (the notch), so the ribbon is too
    const notchAt = (t: number, x0: number) => (c.notchM > 0 && t * L < c.notchM * 1.4 ? x0 - c.notchM * Math.max(0, 1 - sw / Math.max(c.halfCut(t), 0.01)) * Math.max(0, 1 - t * L / (c.notchM * 1.4)) : x0);
    for (let i = 0; i <= n; i++) { const t = tAt(i), x = notchAt(t, ringX[i]); dk.push(V(x, c.deckAt(x, sw) + 0.0004, -sw), V(x, c.deckAt(x, sw) + 0.0004, sw)); bt.push(V(x, c.bottomAt(x, sw) - 0.0004, -sw), V(x, c.bottomAt(x, sw) - 0.0004, sw)); }
    for (let i = 0; i < n; i++) { quad('stringer', dk[2 * i + 1], dk[2 * i], dk[2 * i + 2], dk[2 * i + 3]); quad('stringer', bt[2 * i], bt[2 * i + 1], bt[2 * i + 3], bt[2 * i + 2]); }
  }
  // ---- the tail pad: three pieces on the deck over the back foot, 4 mm EVA with an arch bar and a kick at the back, the edges down to the deck
  if (opt.pad !== false) {
    const [x0, x1] = c.padX, nx = 14, nz = 8, padH = 0.004, top: number[][] = [], skirt: number[][] = [];
    const padThick = (fx: number, z: number, hw: number) => { const kick = fx > 0.8 ? 0.022 * k * Math.pow((fx - 0.8) / 0.2, 1.4) : 0, arch = Math.max(0, 1 - Math.pow(z / (0.02 * k), 2)) * 0.003 * k * (fx > 0.25 && fx < 0.82 ? 1 : 0), edge = Math.min(1, (hw - Math.abs(z)) / 0.012); return (padH + kick + arch) * Math.max(0.15, edge); };
    for (let i = 0; i <= nx; i++) {
      const fx = i / nx, x = x0 + fx * (x1 - x0), hw = Math.max(0.03, c.halfCut(0.5 - x / L) - 0.014 * k), row: number[] = [], sk: number[] = [];
      for (let j = 0; j <= nz; j++) { const z = -hw + 2 * hw * j / nz, y = c.deckAt(x, z); row.push(V(x, y + padThick(fx, z, hw), z, (x - x0) / (x1 - x0), z / hw)); sk.push(V(x, y + 0.0002, z, (x - x0) / (x1 - x0), z / hw)); }
      top.push(row); skirt.push(sk);
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) quad('pad', top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]);
    for (let i = 0; i < nx; i++) { quad('pad', skirt[i][0], top[i][0], top[i + 1][0], skirt[i + 1][0]); quad('pad', top[i][nz], skirt[i][nz], skirt[i + 1][nz], top[i + 1][nz]); }
    for (let j = 0; j < nz; j++) { quad('pad', top[0][j], skirt[0][j], skirt[0][j + 1], top[0][j + 1]); quad('pad', skirt[nx][j], top[nx][j], top[nx][j + 1], skirt[nx][j + 1]); }
  }
  // ---- the fins: foiled (the side fins flat inside, cambered outside; the centre fin 50/50), toed in and canted, on fin boxes
  const fins: BoardGeometryData['fins'] = [];
  if (opt.fins !== false && p.fins.value !== 'none') {
    const setup = p.fins.value, fb = Math.sqrt(W / (19.25 * IN));
    const fin = (xTrail: number, side: -1 | 0 | 1, base: number, depth: number, toeDeg: number, cantDeg: number, flatInside: boolean) => {
      const t = 0.5 - xTrail / L, zc = side === 0 ? 0 : side * Math.max(0.02, c.halfCut(t) - 1.125 * IN * fb), y0 = c.bottomAt(xTrail, zc) + 0.0008;
      const toe = side * toeDeg * Math.PI / 180, cant = side * cantDeg * Math.PI / 180, ct = Math.cos(toe), st = Math.sin(toe), cc = Math.cos(cant), sc = Math.sin(cant);
      const xTip = 0.66 * base + 0.03 * fb, tipChord = 0.012, tmax = 0.0065 * fb, nv = 6, nu = 8, outer: number[][] = [], inner: number[][] = [];
      // the fin's own frame: lx along the chord (the trailing edge's base at 0), ly down the span, lz the thickness; the cant leans the tip
      // outward (about the chord), the toe turns the leading edge toward the stringer (about the vertical)
      const P = (u: number, d: number, w: number) => { const lx = u - base, ly = -d, lz = w, cy = ly * cc + lz * sc, cz = -ly * sc + lz * cc; return V(xTrail + lx * ct - cz * st, y0 + cy, zc + lx * st + cz * ct, u, d); };
      for (let i = 0; i <= nv; i++) {
        const v = i / nv, le = xTip * Math.pow(v, 1.7), te = base + (xTip + tipChord - base) * Math.pow(v, 1.1), chord = Math.max(0.004, te - le), d = depth * v, rowO: number[] = [], rowI: number[] = [];
        for (let j = 0; j <= nu; j++) {
          const ch = j / nu, u = le + chord * ch, th = tmax * (1 - 0.55 * v) * Math.pow(4 * ch * (1 - ch), 0.65) * Math.min(1, chord / 0.04);
          const wO = (side === 0 ? 0.5 : 1) * th * (side === 0 ? 1 : side), wI = flatInside && side !== 0 ? 0 : -0.5 * th * (side === 0 ? 1 : side);
          rowO.push(P(u, d, wO)); rowI.push(P(u, d, wI));
        }
        outer.push(rowO); inner.push(rowI);
      }
      // winding: the outside face's normal points to +w for side +1 (toward +z, outward) and the inside face's to -w; the test checks the signed volume
      const flip = side === -1;
      for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
        const a = outer[i][j], b = outer[i][j + 1], d = outer[i + 1][j + 1], e = outer[i + 1][j], a2 = inner[i][j], b2 = inner[i][j + 1], d2 = inner[i + 1][j + 1], e2 = inner[i + 1][j];
        if (!flip) { quad('fin', a, e, d, b); quad('fin', a2, b2, d2, e2); } else { quad('fin', a, b, d, e); quad('fin', a2, e2, d2, b2); }
      }
      for (let i = 0; i < nv; i++) { // the leading and trailing edges and the tip
        const a = outer[i][0], e = outer[i + 1][0], a2 = inner[i][0], e2 = inner[i + 1][0], b = outer[i][nu], d = outer[i + 1][nu], b2 = inner[i][nu], d2 = inner[i + 1][nu];
        if (!flip) { quad('fin', a, a2, e2, e); quad('fin', b, d, d2, b2); } else { quad('fin', a, e, e2, a2); quad('fin', b, b2, d2, d); }
      }
      for (let j = 0; j < nu; j++) { // the tip and the base (the base cap sits inside the hull; it closes the fin for the volume check)
        const a = outer[nv][j], b = outer[nv][j + 1], a2 = inner[nv][j], b2 = inner[nv][j + 1], r = outer[0][j], s2 = outer[0][j + 1], r2 = inner[0][j], s3 = inner[0][j + 1];
        if (!flip) { quad('fin', a, a2, b2, b); quad('fin', r, s2, s3, r2); } else { quad('fin', a, b, b2, a2); quad('fin', r, r2, s3, s2); } }
      // the fin box: a dark plate 1 mm proud of the bottom under the base
      const bx0 = xTrail - base - 0.008, bx1 = xTrail + 0.008, bw = 0.011, by = y0 - 0.0008, corners = [[bx0, -bw], [bx1, -bw], [bx1, bw], [bx0, bw]].map(([ux, w]) => { const lx = ux - xTrail; return [xTrail + lx * ct - w * st, zc + lx * st + w * ct] as [number, number]; });
      const bt = corners.map(([x, z]) => V(x, c.bottomAt(x, z) - 0.001, z)), bb = corners.map(([x, z]) => V(x, by + 0.0025, z));
      quad('finbox', bt[0], bt[1], bt[2], bt[3]);   // the plate's underside faces down (-y)
      for (let q = 0; q < 4; q++) { const r2 = (q + 1) % 4; quad('finbox', bt[q], bt[r2], bb[r2], bb[q]); }
      fins.push({x: xTrail - base / 2, z: zc, side});
    };
    const sideBase = 4.33 * IN * fb, sideDepth = 4.53 * IN * fb;
    if (setup === 'thruster' || setup === 'quad') { fin(0.5 * L - 11 * IN * k, 1, sideBase, sideDepth, 2.5, 6, true); fin(0.5 * L - 11 * IN * k, -1, sideBase, sideDepth, 2.5, 6, true); }
    if (setup === 'thruster') fin(0.5 * L - 3.5 * IN * k, 0, 4.37 * IN * fb, 4.47 * IN * fb, 0, 0, false);
    if (setup === 'quad') { fin(0.5 * L - 5.5 * IN * k, 1, sideBase * 0.85, sideDepth * 0.82, 1.5, 4, true); fin(0.5 * L - 5.5 * IN * k, -1, sideBase * 0.85, sideDepth * 0.82, 1.5, 4, true); }
    if (setup === 'twin') { fin(0.5 * L - 8 * IN * k, 1, 5.3 * IN * fb, 5.2 * IN * fb, 2, 4, true); fin(0.5 * L - 8 * IN * k, -1, 5.3 * IN * fb, 5.2 * IN * fb, 2, 4, true); }
    if (setup === 'single') fin(0.5 * L - 5 * IN * k, 0, 7 * IN * fb, 8 * IN * fb, 0, 0, false);
  }
  // ---- assemble: one index buffer with a group per part
  const order: BoardPart[] = ['resin', 'wax', 'stringer', 'pad', 'fin', 'finbox'], groups: BoardGeometryData['groups'] = [];
  let total = 0; for (const part of order) total += parts[part].length;
  const indices = new Uint32Array(total); let at = 0;
  for (const part of order) { const arr = parts[part]; if (!arr.length) continue; indices.set(arr, at); groups.push({start: at, count: arr.length, part}); at += arr.length; }
  const box = (end: number) => { const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < end; i += 3) for (let q = 0; q < 3; q++) { if (pos[i + q] < min[q]) min[q] = pos[i + q]; if (pos[i + q] > max[q]) max[q] = pos[i + q]; } return {min, max}; };
  return {positions: new Float32Array(pos), uvs: new Float32Array(uv), indices, groups, curves: c, tris: total / 3, bounds: box(pos.length), hullBounds: box(hullEnd), fins};
}

/** Signed volume of a closed triangle set (m^3): positive when every triangle faces out (the fin-winding check, T-139). */
export function signedVolume(positions: Float32Array, indices: ArrayLike<number>, start = 0, count = indices.length): number {
  let v = 0;
  for (let i = start; i < start + count; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, d = indices[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2], bx = positions[b], by = positions[b + 1], bz = positions[b + 2], cx = positions[d], cy = positions[d + 1], cz = positions[d + 2];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}
