/** wave-v3 P5b: the selected Quiver board as a mesh at its true length, width and thickness, in the surfer model's board frame
 *  (glTF: x along the board, nose at -x; y up; z across). The planshape is the user's traced outline when the Quiver has one,
 *  otherwise the board type's category outline (the same categories as the Quiver's BoardOutline); rocker and foil follow
 *  tools/blender/build_surfer.py. An approximation of the shape, true to the entered dimensions. */
import type {Surfboard} from '../../models/index';

const IN = 0.0254;
/** The surfer model's own board (build_surfer.py): 1.83 m, deck 0.062 m above its lowest point under the feet. */
export const MODEL_DECK_M = 0.062;

/** Category half-width fraction (of the full width) at u: 0 = nose, 1 = tail. */
export function categoryHalf(type: Surfboard['type'], u: number): number {
  const round = type === 'Longboard' || type === 'Funboard' || type === 'Soft-top' ? 0.62 : type === 'Fish' || type === 'Midlength' || type === 'Hybrid' || type === 'Groveler' ? 0.42 : 0.2;
  const tail = type === 'Gun' || type === 'Step-up' ? 0.22 : type === 'Fish' ? 0.68 : 0.5;
  const wide = type === 'Fish' ? 0.55 : type === 'Gun' ? 0.42 : 0.48;
  const x = Math.min(1, Math.max(0, u));
  if (x <= wide) { const t = x / wide; return 0.5 * Math.pow(1 - Math.pow(1 - t, 2), 0.75 - 0.5 * round) * (x < 0.004 ? 0.4 : 1); }
  const t = (x - wide) / (1 - wide); return 0.5 * (1 - (1 - tail) * Math.pow(t, 2.2));
}

export interface BoardShape {length: number; width: number; thickness: number; half: (u: number) => number}
/** `traced`: the Quiver's traced half-widths (fractions of length, nose to tail), rescaled so the widest point is the entered width. */
export function boardShape(b: Pick<Surfboard, 'length' | 'width' | 'thickness' | 'type'>, traced?: number[] | null): BoardShape {
  const L = b.length * IN, W = (b.width || 20) * IN, T = (b.thickness || 2.5) * IN;
  if (traced && traced.length > 2) {
    const mx = Math.max(...traced) || 1, n = traced.length;
    return {length: L, width: W, thickness: T, half: (u) => { const f = Math.min(1, Math.max(0, u)) * (n - 1), i = Math.min(n - 2, Math.floor(f)), t = f - i; return (traced[i] * (1 - t) + traced[i + 1] * t) / mx * 0.5; }};
  }
  return {length: L, width: W, thickness: T, half: (u) => categoryHalf(b.type, u)};
}

/** Positions and indices: rings along the board, a domed deck over a flat bottom with tucked rails, the foil thinning to a few mm at the
 *  nose and tail, and a thruster set (two side fins toed in and canted, a centre fin) standing off the bottom at the tail; the deck under
 *  the feet (mid-board) sits at MODEL_DECK_M. R13 (user: "the board itself needs a rework"): the old foil kept half the thickness at the
 *  tips (a slab with rounded ends) and there were no fins; the shape is still an approximation, true to the entered dimensions. */
export function boardGeometry(s: BoardShape, ns = 64, nr = 20): {positions: Float32Array; indices: number[]; deckMid: number} {
  const {length: L, width: W, thickness: T} = s, k = Math.sqrt(L / 1.83);
  const rocker = (t: number) => (0.11 * Math.max(0, (t - 0.62) / 0.38) ** 2.2 + 0.035 * Math.max(0, (0.25 - t) / 0.25) ** 1.8) * k; // t: 0 tail, 1 nose
  const thick = (t: number) => T * (0.1 + 0.9 * Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.94 + 0.03))) ** 1.15);   // the foil: full in the middle, ~3 mm at the tips
  const deckMid = rocker(0.5) + thick(0.5), lift = MODEL_DECK_M - deckMid, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, x = (0.5 - t) * L, hw = Math.max(s.half(1 - t) * W, 0.004), th = thick(t), zr = rocker(t) + lift;
    for (let j = 0; j < nr; j++) {
      const a = 2 * Math.PI * j / nr, cu = Math.cos(a), su = Math.sin(a);
      // the rail: full (|cos|^0.45) with its apex a little under the deck line; the deck domed, the bottom flat to a tucked edge
      const across = hw * Math.sign(cu) * Math.abs(cu) ** 0.45, up = zr + th * (0.42 + (su > 0 ? 0.58 * su ** 0.9 : -0.42 * Math.abs(su) ** 2.4));
      pos.push(x, up, -across); // Blender (x, y, z) -> glTF (x, z, -y)
    }
  }
  for (let i = 0; i < ns; i++) for (let j = 0; j < nr; j++) { const a = i * nr + j, b = i * nr + (j + 1) % nr, c = a + nr, d = b + nr; idx.push(a, c, b, b, c, d); }
  const tailC = pos.length / 3; pos.push(0.5 * L, rocker(0) + lift + thick(0) * 0.42, 0); const noseC = pos.length / 3; pos.push(-0.5 * L, rocker(1) + lift + thick(1) * 0.42, 0);
  for (let j = 0; j < nr; j++) { idx.push(tailC, (j + 1) % nr, j); idx.push(noseC, ns * nr + j, ns * nr + (j + 1) % nr); }
  // the fins: a thin plate each (two faces 4 mm apart), the profile in the fin's own plane (u along the board toward the tail, d down);
  // the side fins' leading edges 0.3 L from the tail, toed in 3 deg and canted out 6 deg, the centre fin 0.1 L from the tail
  const fin = (xLead: number, z0: number, side: number) => {
    const depth = 0.115 * k, base = 0.11 * k, prof = [[0, 0], [base, 0], [base * 0.95, -depth * 0.45], [base * 0.68, -depth], [base * 0.42, -depth * 0.92], [base * 0.12, -depth * 0.5]];
    const toe = side * 3 * Math.PI / 180, cant = side * 6 * Math.PI / 180, ct = Math.cos(toe), st = Math.sin(toe), cc = Math.cos(cant), sc = Math.sin(cant);
    const t0 = 0.5 - xLead / L, yBase = rocker(t0) + lift + 0.002;   // the bottom at the fin's base (the plate sits in the bottom skin)
    const i0 = pos.length / 3;
    for (const sgn of [-1, 1]) for (const [u, d] of prof) { const zc = sgn * 0.002, dz = d * sc, dy = d * cc; pos.push(xLead + u * ct - zc * st, yBase + dy, z0 - dz + u * st + zc * ct); }
    // R15 (T-139): the profile runs clockwise in the fin's plane (along the base toward the tail, then round the tip), so the fan on the
    // -z plate is wound in profile order and the +z plate's reversed, the strip between them likewise: every triangle faces OUT (the
    // signed volume of each fin reads +3.5e-5 m^3; it read -3.5e-5 with the windings the other way round, the plates and the strip all inward)
    const n = prof.length; for (let q = 1; q + 1 < n; q++) { idx.push(i0, i0 + q, i0 + q + 1); idx.push(i0 + n, i0 + n + q + 1, i0 + n + q); }
    for (let q = 0; q < n; q++) { const a = i0 + q, b = i0 + (q + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  };
  const xSide = 0.5 * L - 0.3 * L, zSide = Math.max(s.half(1 - (0.5 - xSide / L)) * W, 0.02) - 0.035 * k;
  fin(xSide, zSide, 1); fin(xSide, -zSide, -1); fin(0.5 * L - 0.1 * L, 0, 0);
  return {positions: new Float32Array(pos), indices: idx, deckMid: MODEL_DECK_M};
}
