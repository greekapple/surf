import {referenceFor} from '../../data/referenceBoards.ts';
/** Trace a board outline from a top-down photo, in the browser only: threshold, largest blob, main axis, half-widths. */
export const OUTLINES_KEY = 'swello-board-outlines';
export const STATIONS = 40;

/** Half-width at STATIONS stations from nose (0) to tail (1), as a fraction of the board's length. */
export interface Outline {v: 1; hw: number[]; /** Deck texture: a downscaled JPEG data URL of the straightened board photo, nose at the left. */ tex?: string}

/** Where the board sits in the photo, in image pixels: the nose point on the centre line, the unit direction nose to tail, the board's length and its widest half-width. */
export interface Frame {ox: number; oy: number; dx: number; dy: number; len: number; half: number}

export type TraceResult =
  | {ok: true; outline: Outline; /** Edge points in image pixels for the overlay: left edge nose to tail, then right edge tail to nose. */ edge: [number, number][]; frame: Frame; aspect: number; w: number; h: number;
     /** Centre-line wander and half-width jaggedness, both as fractions of the widest half-width. */ quality: {asym: number; rough: number}}
  | {ok: false; reason: string};

const FAIL = (reason: string): TraceResult => ({ok: false, reason});


/** The 3 px border frame of a w×h image, optionally only the rows a ≤ y < b. */
function borderPts(w: number, h: number, a = 0, b = h): [number, number][] {
  const P: [number, number][] = [];
  for (let k = 0; k < 3; k++) {
    if (k >= a && k < b) for (let x = 0; x < w; x++) P.push([x, k]);
    if (h - 1 - k >= a && h - 1 - k < b) for (let x = 0; x < w; x++) P.push([x, h - 1 - k]);
  }
  for (let y = Math.max(3, a); y < Math.min(h - 3, b); y++) for (let k = 0; k < 3; k++) P.push([k, y], [w - 1 - k, y]);
  return P;
}

/** Least-squares plane c0 + c1*x + c2*y per colour channel over the given background points, refitted once without outliers. Returns the floor colour at a pixel. */
function fitFloor(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, P: [number, number][] = borderPts(w, h)): (x: number, y: number) => [number, number, number] {
  const coef: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const solve = (use: boolean[]) => {
    for (let c = 0; c < 3; c++) {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
      P.forEach(([x, y], j) => {
        if (!use[j]) return;
        const f = [1, x / w, y / h], v = rgba[(y * w + x) * 4 + c];
        for (let r = 0; r < 3; r++) { B[r] += f[r] * v; for (let q = 0; q < 3; q++) A[r][q] += f[r] * f[q]; }
      });
      // Gaussian elimination on the 3x3 system.
      const M = A.map((row, r) => [...row, B[r]]);
      for (let i = 0; i < 3; i++) {
        let piv = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
        [M[i], M[piv]] = [M[piv], M[i]];
        if (Math.abs(M[i][i]) < 1e-9) { coef[c] = [B[0] / Math.max(1, A[0][0]), 0, 0]; M[0][0] = NaN; break; }
        for (let r = 0; r < 3; r++) if (r !== i) { const k = M[r][i] / M[i][i]; for (let q = i; q < 4; q++) M[r][q] -= k * M[i][q]; }
      }
      if (!Number.isNaN(M[0][0])) coef[c] = [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
    }
  };
  const at = (x: number, y: number) => [0, 1, 2].map((c) => coef[c][0] + coef[c][1] * (x / w) + coef[c][2] * (y / h)) as [number, number, number];
  let use = P.map(() => true);
  solve(use);
  const err = P.map(([x, y]) => { const f = at(x, y), i = (y * w + x) * 4; return Math.hypot(rgba[i] - f[0], rgba[i + 1] - f[1], rgba[i + 2] - f[2]); });
  const sorted = [...err].sort((p, q) => p - q), lim = Math.max(12, sorted[Math.floor(sorted.length * 0.9)] * 1.5);
  use = err.map((e) => e <= lim);
  if (use.filter(Boolean).length > 12) solve(use);
  return at;
}

/** One (2r+1) square morphology pass: dilate (want 1) or erode (want 0). */
function morph(src: Uint8Array, w: number, h: number, r: number, want: 0 | 1): Uint8Array {
  const n = w * h, out = new Uint8Array(n);
  {
    const tmp = new Uint8Array(n);
    // Horizontal then vertical: a pixel becomes `want` if any (dilate) or all (erode, via inverted want) neighbours are.
    const edge = want ? 0 : 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let k = -r; k <= r && !hit; k++) { const xx = x + k, v = xx < 0 || xx >= w ? edge : src[y * w + xx]; if (v === want) hit = 1; }
      tmp[y * w + x] = hit ? want : 1 - want;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = 0;
      for (let k = -r; k <= r && !hit; k++) { const yy = y + k, v = yy < 0 || yy >= h ? edge : tmp[yy * w + x]; if (v === want) hit = 1; }
      out[y * w + x] = hit ? want : 1 - want;
    }
  }
  return out;
}

/** Binary mask of dist >= cut, closed with a (2r+1) square: dilate then erode. */
function close(dist: Float32Array, w: number, h: number, cut: number, r: number): Uint8Array {
  const a = new Uint8Array(w * h);
  for (let p = 0; p < a.length; p++) a[p] = dist[p] >= cut ? 1 : 0;
  return morph(morph(a, w, h, r, 1), w, h, r, 0);
}

/** A user-drawn box around the board, in pixels of the image passed to traceBoard. */
export interface Box {x0: number; y0: number; x1: number; y1: number}

/** Row of a backdrop horizon (a seamless studio sweep, or where a wall meets the floor): the strongest step in the mean colour of
 *  the side border columns, compared over 8 rows above and below. Null when the sides change smoothly. */
export function findHorizon(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): number | null {
  const row = Array.from({length: h}, (_, y) => {
    const c = [0, 0, 0];
    for (const x of [0, 1, 2, w - 3, w - 2, w - 1]) for (let k = 0; k < 3; k++) c[k] += rgba[(y * w + x) * 4 + k] / 6;
    return c;
  });
  const R = 8, mean = (a: number, b: number) => { const c = [0, 0, 0]; for (let y = a; y < b; y++) for (let k = 0; k < 3; k++) c[k] += row[y][k] / (b - a); return c; };
  let best = 0, at = -1;
  for (let y = Math.max(R, Math.round(h * 0.08)); y < Math.min(h - R, Math.round(h * 0.92)); y++) {
    const u = mean(y - R, y), d = mean(y + 1, y + 1 + R), step = Math.hypot(u[0] - d[0], u[1] - d[1], u[2] - d[2]);
    if (step > best) { best = step; at = y; }
  }
  return best >= 6 ? at : null;
}

type RGB = [number, number, number];
/** Background colour model. A plain floor: one plane fitted to the border. A backdrop with a horizon (studio sweep, wall and floor):
 *  wall and floor planes split at the horizon, and each row is blended between its own left and right border colours, because a
 *  sweep is even across a row but bends and shades down the photo. A side the board itself touches falls back to its plane. */
function background(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): {hz: number | null; at: (x: number, y: number) => RGB} {
  const hz = findHorizon(rgba, w, h);
  if (hz === null || hz < 6 || hz > h - 6) return {hz, at: fitFloor(rgba, w, h)};
  const wall = fitFloor(rgba, w, h, borderPts(w, h, 0, hz - 2)), floor = fitFloor(rgba, w, h, borderPts(w, h, hz + 3, h));
  const side = (y: number, xs: number[]): RGB => { const c: RGB = [0, 0, 0]; for (const x of xs) for (let k = 0; k < 3; k++) c[k] += rgba[(y * w + x) * 4 + k] / xs.length; return c; };
  const rows = Array.from({length: h}, (_, y) => {
    const plane = y < hz ? wall : floor;
    return ([[[0, 1, 2], 0], [[w - 3, w - 2, w - 1], w - 1]] as const).map(([xs, x]): RGB => {
      const c = side(y, [...xs]), q = plane(x, y);
      return Math.hypot(c[0] - q[0], c[1] - q[1], c[2] - q[2]) > 28 ? q : c;
    });
  });
  return {hz, at: (x, y) => { const [l, r] = rows[y], t = x / (w - 1); return [l[0] + (r[0] - l[0]) * t, l[1] + (r[1] - l[1]) * t, l[2] + (r[2] - l[2]) * t]; }};
}

/** `rgba` is an RGBA pixel array of size w*h*4. Works in Node and the browser. */
export function traceBoard(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, flip = false): TraceResult {
  const n = w * h;
  if (w < 40 || h < 40 || rgba.length < n * 4) return FAIL('The photo is too small to trace.');
  // Background model: a plane per colour channel fitted to a 3 px frame around the border (robust to a lighting gradient across the
  // floor), split into wall and floor planes when the sides show a backdrop horizon.
  const bg = background(rgba, w, h);
  // Distance to the background. A shadow only darkens it along its own colour direction, so darkening counts 0.4x; any hue change or brightening counts fully.
  const dist = new Float32Array(n); let max = 0;
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
    const i = p * 4, b = bg.at(x, y), bn = Math.hypot(b[0], b[1], b[2]) || 1;
    const dr = rgba[i] - b[0], dg = rgba[i + 1] - b[1], db = rgba[i + 2] - b[2];
    const along = (dr * b[0] + dg * b[1] + db * b[2]) / bn, orth = Math.sqrt(Math.max(0, dr * dr + dg * dg + db * db - along * along));
    const d = Math.hypot(orth, along < 0 ? along * 0.4 : along);
    dist[p] = d; if (d > max) max = d;
  }
  if (max < 40) return FAIL('The board does not stand out from the floor. Use a floor that contrasts with the board, such as a dark floor for a white board.');
  // Otsu threshold on the distance.
  const hist = new Float64Array(256);
  for (let p = 0; p < n; p++) hist[Math.min(255, Math.round((dist[p] / max) * 255))]++;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let wB = 0, sB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = t; }
  }
  const cut = Math.max(0.15, (thr + 1) / 255) * max;
  // Morphological close (dilate then erode) fills pinholes and thin gaps such as a stringer line or glare.
  const rad = Math.max(2, Math.round(Math.min(w, h) * 0.008)), strong = close(dist, w, h, cut, rad);
  // Backdrop photos only (a horizon was found): weaker pixels join when they connect to confident ones and stand above the border's
  // own noise, which recovers shaded parts of a pale board (concaves, the bottom near the fins). A top-down floor photo keeps the
  // strict cut, because there the weak pixels are the board's own shadow.
  const edgeD = borderPts(w, h).map(([x, y]) => dist[y * w + x]).sort((p, q) => p - q);
  const low = Math.min(cut, Math.max(cut * 0.55, edgeD[Math.floor(edgeD.length * 0.9)] * 1.5));
  const weak = close(dist, w, h, low, rad), fg = new Uint8Array(n), grow = new Int32Array(n);
  let gp = 0;
  for (let p = 0; p < n; p++) if (strong[p] && (weak[p] || bg.hz === null)) { fg[p] = 1; if (bg.hz !== null) grow[gp++] = p; }
  while (gp) {
    const p = grow[--gp], x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && q < n && weak[q] && !fg[q]) { fg[q] = 1; grow[gp++] = q; }
  }
  // A board standing on a studio floor only narrows below the horizon (the nose tapers), while the lit floor around it can read as
  // foreground. The rails' taper is fitted (a line per side) over the rows just above the horizon; from 4 rows above it down, each
  // row keeps only what lies inside that taper and inside the row above.
  if (bg.hz !== null && bg.hz > h * 0.3) {
    const y1 = bg.hz - 5, y0 = Math.max(0, y1 - Math.round(h * 0.12)), ys: number[] = [], ls: number[] = [], rs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      let l = -1, r = -1;
      for (let x = 0; x < w; x++) if (fg[y * w + x]) { if (l < 0) l = x; r = x; }
      if (l >= 0) { ys.push(y); ls.push(l); rs.push(r); }
    }
    const line = (v: number[]) => {
      const m = ys.length, my = ys.reduce((a, y) => a + y, 0) / m, mv = v.reduce((a, x) => a + x, 0) / m;
      let sxy = 0, sxx = 0; ys.forEach((y, k) => { sxy += (y - my) * (v[k] - mv); sxx += (y - my) ** 2; });
      const b = sxx ? sxy / sxx : 0; return (y: number) => mv + b * (y - my);
    };
    if (ys.length >= 5) {
      const Lf = line(ls), Rf = line(rs);
      let L = ls[ls.length - 1], R = rs[rs.length - 1];
      for (let y = y1 + 1; y < h; y++) {
        const lo = Math.max(L - 1, Lf(y) - 2), hi = Math.min(R + 1, Rf(y) + 2);
        let nl = w, nr = -1;
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          if (x < lo || x > hi) fg[p] = 0;
          if (fg[p]) { if (x < nl) nl = x; if (x > nr) nr = x; }
        }
        if (nr < 0 || hi < lo) { for (let yy = y; yy < h; yy++) fg.fill(0, yy * w, yy * w + w); break; }
        L = nl; R = nr;
      }
    }
  }
  // Open (erode then dilate) to drop thin spurs and fins that would widen the outline.
  const opened = morph(morph(fg, w, h, Math.max(1, rad - 1), 0), w, h, Math.max(1, rad - 1), 1); fg.set(opened);
  // Largest connected blob.
  const label = new Int32Array(n), stack = new Int32Array(n);
  let bestLab = 0, bestSize = 0, lab = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] || !fg[s]) continue;
    lab++; let sp = 0, size = 0; stack[sp++] = s; label[s] = lab;
    while (sp) {
      const p = stack[--sp]; size++; const x = p % w, y = (p / w) | 0;
      if (x > 0 && !label[p - 1] && fg[p - 1]) { label[p - 1] = lab; stack[sp++] = p - 1; }
      if (x < w - 1 && !label[p + 1] && fg[p + 1]) { label[p + 1] = lab; stack[sp++] = p + 1; }
      if (y > 0 && !label[p - w] && fg[p - w]) { label[p - w] = lab; stack[sp++] = p - w; }
      if (y < h - 1 && !label[p + w] && fg[p + w]) { label[p + w] = lab; stack[sp++] = p + w; }
    }
    if (size > bestSize) { bestSize = size; bestLab = lab; }
  }
  const frac = bestSize / n;
  if (frac < 0.04) return FAIL('No clear board shape was found. Photograph the whole board from directly above on a plain, contrasting floor.');
  if (frac > 0.8) return FAIL('The shape fills almost the whole photo, so the floor could not be separated. Step back so the floor shows around the board.');
  // Main axis by PCA.
  let cx = 0, cy = 0;
  for (let p = 0; p < n; p++) if (label[p] === bestLab) { cx += p % w; cy += (p / w) | 0; }
  cx /= bestSize; cy /= bestSize;
  let sxx = 0, syy = 0, sxy = 0;
  for (let p = 0; p < n; p++) if (label[p] === bestLab) { const dx = (p % w) - cx, dy = ((p / w) | 0) - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ax = Math.cos(ang), ay = Math.sin(ang);
  const px = -ay, py = ax;
  let tMin = Infinity, tMax = -Infinity;
  const T = new Float32Array(n), S = new Float32Array(n);
  for (let p = 0; p < n; p++) if (label[p] === bestLab) {
    const dx = (p % w) - cx, dy = ((p / w) | 0) - cy, t = dx * ax + dy * ay, s = dx * px + dy * py;
    T[p] = t; S[p] = s; if (t < tMin) tMin = t; if (t > tMax) tMax = t;
  }
  const len = tMax - tMin;
  const sMin = new Float32Array(STATIONS).fill(Infinity), sMax = new Float32Array(STATIONS).fill(-Infinity);
  for (let p = 0; p < n; p++) if (label[p] === bestLab) {
    const k = Math.min(STATIONS - 1, Math.floor(((T[p] - tMin) / len) * STATIONS));
    if (S[p] < sMin[k]) sMin[k] = S[p]; if (S[p] > sMax[k]) sMax[k] = S[p];
  }
  const half = Array.from({length: STATIONS}, (_, k) => (sMax[k] > sMin[k] ? (sMax[k] - sMin[k]) / 2 : 0));
  const mid = Array.from({length: STATIONS}, (_, k) => (sMax[k] > sMin[k] ? (sMax[k] + sMin[k]) / 2 : 0));
  const maxHalf = Math.max(...half);
  const aspect = len / (2 * maxHalf);
  // Shape quality. A surfboard is symmetric about its stringer and its rails curve smoothly, so a centre line that wanders or a
  // jagged half-width profile means the trace is following something else (a neighbouring board, a shadow).
  const ok = half.map((_, k) => sMax[k] > sMin[k]), ks = half.map((_, k) => k).filter((k) => ok[k]);
  const mk = ks.reduce((a, k) => a + k, 0) / ks.length, mm = ks.reduce((a, k) => a + mid[k], 0) / ks.length;
  let cKM = 0, cKK = 0; ks.forEach((k) => { cKM += (k - mk) * (mid[k] - mm); cKK += (k - mk) ** 2; });
  const slope = cKK ? cKM / cKK : 0;
  const asym = ks.reduce((a, k) => a + Math.abs(mid[k] - (mm + slope * (k - mk))), 0) / ks.length / (maxHalf || 1);
  const inner = ks.filter((k) => k > 0 && k < STATIONS - 1 && ok[k - 1] && ok[k + 1]);
  const rough = inner.reduce((a, k) => a + Math.abs(half[k - 1] - 2 * half[k] + half[k + 1]), 0) / Math.max(1, inner.length) / (maxHalf || 1);
  const quality = {asym: +asym.toFixed(3), rough: +rough.toFixed(3)};
  if (aspect < 2.2) return FAIL('The shape is not long and narrow enough to be a surfboard. Check the photo shows one whole board from above.');
  if (half.filter((v) => v < maxHalf * 0.04).length > 3) return FAIL('The traced shape has gaps, so part of the board blends into the floor. Try a floor that contrasts more.');
  // Even a 10' gun is about 6:1, so a much thinner shape is a sliver of a board, not a whole one.
  // A board cut off by the edge of the photo or box is not a whole board (and its outline would be clipped).
  let touch = 0;
  for (let x = 0; x < w; x++) touch += +(label[x] === bestLab) + +(label[(h - 1) * w + x] === bestLab);
  for (let y = 1; y < h - 1; y++) touch += +(label[y * w] === bestLab) + +(label[y * w + w - 1] === bestLab);
  if (touch > 3) return FAIL('The board runs off the edge of the photo or the box. Leave some floor or wall showing all the way around it.');
  if (aspect > 7) return FAIL('The traced shape is far too thin to be a whole board, so part of it blends into what is behind it. Draw the box around one whole board, or use a plainer background.');
  if (asym > 0.1 || rough > 0.08) return FAIL('The traced outline is uneven, so it is not following the board edge. Draw the box tightly around one whole board, or use a plainer background.');
  // Orient: nose first. The nose is the pointier end: the one whose tip curve is tighter (radius hw^2 / 2d at stations near each end), unless flipped.
  const tip = (at: (j: number) => number) => [1, 2, 3].reduce((s, j) => s + at(j) ** 2 / (2 * (j + 0.5)), 0);
  let order = half.map((_, k) => k);
  if (tip((j) => half[j]) > tip((j) => half[STATIONS - 1 - j])) order = order.reverse();
  if (flip) order = order.reverse();
  const smoothHalf = order.map((k) => half[k]);
  const sm = smoothHalf.map((v, i, a) => (i === 0 || i === a.length - 1 ? v : (a[i - 1] + 2 * v + a[i + 1]) / 4));
  const hw = sm.map((v) => +(v / len).toFixed(5));
  // Overlay edge points (stations in photo order so they follow the real edge).
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let k = 0; k < STATIONS; k++) {
    if (!(sMax[k] > sMin[k])) continue;
    const t = tMin + ((k + 0.5) / STATIONS) * len;
    left.push([cx + ax * t + px * sMin[k], cy + ay * t + py * sMin[k]]); right.push([cx + ax * t + px * sMax[k], cy + ay * t + py * sMax[k]]);
  }
  // Frame for straightening: nose at the start, centre line through the middle of the traced width.
  const valid = mid.filter((_, k) => sMax[k] > sMin[k]), midS = valid.reduce((a, v) => a + v, 0) / Math.max(1, valid.length);
  const noseAtMin = order[0] < order[order.length - 1], sgn = noseAtMin ? 1 : -1, tNose = noseAtMin ? tMin : tMax;
  const frame: Frame = {ox: cx + ax * tNose + px * midS, oy: cy + ay * tNose + py * midS, dx: ax * sgn, dy: ay * sgn, len, half: maxHalf};
  return {ok: true, outline: {v: 1, hw}, edge: [...left, ...right.reverse()], frame, aspect, w, h, quality};
}

/** Trace only inside a user-drawn box (whole-photo pixels). The box is cut from the full-resolution photo and averaged down to at
 *  most `maxSide` px, so a narrow box keeps detail; its border is the background. Edge and frame come back in whole-photo pixels. */
export function traceBoardIn(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, box: Box, maxSide: number, flip = false): TraceResult {
  const x0 = Math.max(0, Math.floor(Math.min(box.x0, box.x1))), x1 = Math.min(w, Math.ceil(Math.max(box.x0, box.x1)));
  const y0 = Math.max(0, Math.floor(Math.min(box.y0, box.y1))), y1 = Math.min(h, Math.ceil(Math.max(box.y0, box.y1)));
  const k = Math.max(1, Math.max(x1 - x0, y1 - y0) / maxSide), cw = Math.floor((x1 - x0) / k), ch = Math.floor((y1 - y0) / k);
  if (cw < 40 || ch < 40) return FAIL('The box is too small. Draw it around the whole board.');
  const sub = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    // Area average of the source pixels under this output pixel.
    const sx0 = x0 + x * k, sy0 = y0 + y * k, c = [0, 0, 0]; let m = 0;
    for (let sy = Math.floor(sy0); sy < Math.min(y1, Math.ceil(sy0 + k)); sy++) for (let sx = Math.floor(sx0); sx < Math.min(x1, Math.ceil(sx0 + k)); sx++) {
      const i = (sy * w + sx) * 4; c[0] += rgba[i]; c[1] += rgba[i + 1]; c[2] += rgba[i + 2]; m++;
    }
    const o = (y * cw + x) * 4; sub[o] = c[0] / m; sub[o + 1] = c[1] / m; sub[o + 2] = c[2] / m; sub[o + 3] = 255;
  }
  const r = traceBoard(sub, cw, ch, flip);
  if (!r.ok) return r;
  return {...r, edge: r.edge.map(([x, y]) => [x0 + x * k, y0 + y * k]), frame: {...r.frame, ox: x0 + r.frame.ox * k, oy: y0 + r.frame.oy * k, len: r.frame.len * k, half: r.frame.half * k}, w, h};
}

/** Interpolated half-width fraction at u (0 nose, 1 tail). */
export function halfAt(o: Outline, u: number) {
  const f = Math.min(1, Math.max(0, u)) * (o.hw.length - 1), i = Math.min(o.hw.length - 2, Math.floor(f)), t = f - i;
  return o.hw[i] * (1 - t) + o.hw[i + 1] * t;
}

export const outlineKey = (o: Outline) => o.hw.reduce((s, v) => (s * 31 + Math.round(v * 1e4)) >>> 0, 7).toString(36);

/** Max stored size of the deck texture, in characters of the data URL. */
export const TEX_MAX = 300_000;
export const TEX_PREFIX = 'data:image/jpeg;base64,';

/** Width in inches from the traced shape: the photo's length-to-width ratio applied to the entered length. */
export const widthFromTrace = (lengthIn: number, aspect: number) => lengthIn / aspect;

/** Planform area as a fraction of length squared (both halves). */
export const planformArea = (o: Outline) => { let a = 0; for (let i = 0; i < o.hw.length - 1; i++) a += (o.hw[i] + o.hw[i + 1]); return a / (o.hw.length - 1); };

/** Rough volume in litres: planform area times thickness times a foam-profile factor. An estimate only; real volume depends on rocker, rails and bottom contour. */
export function estimateVolume(o: Outline, lengthIn: number, thicknessIn: number) {
  return Math.round(planformArea(o) * lengthIn * lengthIn * thicknessIn * 0.016387 * 0.72 * 10) / 10;
}

/** Straighten and crop the board from the photo: nose at the left, centre line horizontal, bilinear. Returns RGBA pixels. Works in Node and the browser. */
export function straighten(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, f: Frame, outW: number): {data: Uint8ClampedArray; w: number; h: number} {
  const ow = Math.max(16, Math.round(outW)), oh = Math.max(16, Math.round(ow * (2 * f.half) / f.len));
  const out = new Uint8ClampedArray(ow * oh * 4), nx = -f.dy, ny = f.dx;
  for (let r = 0; r < oh; r++) for (let c = 0; c < ow; c++) {
    const t = ((c + 0.5) / ow) * f.len, s = ((r + 0.5) / oh - 0.5) * 2 * f.half;
    const x = Math.min(w - 1.001, Math.max(0, f.ox + f.dx * t + nx * s)), y = Math.min(h - 1.001, Math.max(0, f.oy + f.dy * t + ny * s));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, o = (r * ow + c) * 4;
    for (let k = 0; k < 3; k++) {
      const a = rgba[(y0 * w + x0) * 4 + k], b = rgba[(y0 * w + x0 + 1) * 4 + k], d = rgba[((y0 + 1) * w + x0) * 4 + k], e = rgba[((y0 + 1) * w + x0 + 1) * 4 + k];
      out[o + k] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
    }
    out[o + 3] = 255;
  }
  return {data: out, w: ow, h: oh};
}

/** Scale a frame measured on the traced (small) image to a larger copy of the same photo. */
export const scaleFrame = (f: Frame, k: number): Frame => ({ox: f.ox * k, oy: f.oy * k, dx: f.dx, dy: f.dy, len: f.len * k, half: f.half * k});

function readAll(): Record<string, unknown> {
  try { const v = JSON.parse(localStorage.getItem(OUTLINES_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
/** The outline a board is drawn with on the wall: the person's own traced outline, else an example model's (src/data/referenceBoards.ts). */
export function wallOutline(b: Parameters<typeof referenceFor>[0]): Outline | null {
  return loadOutline(b.id) ?? (() => { const r = referenceFor(b); return r ? {v: 1 as const, hw: r.hw} : null; })();
}
export function loadOutline(id: string): Outline | null {
  const r = readAll()[id] as {v?: unknown; hw?: unknown} | undefined;
  if (!r || r.v !== 1 || !Array.isArray(r.hw) || r.hw.length !== STATIONS || !r.hw.every((x) => typeof x === 'number' && x >= 0 && x < 0.5)) return null;
  const tex = (r as {tex?: unknown}).tex;
  return {v: 1, hw: r.hw as number[], ...(typeof tex === 'string' && tex.startsWith(TEX_PREFIX) && tex.length <= TEX_MAX ? {tex} : {})};
}
/** Returns false when the browser refused the write (private mode, quota); the outline then stays for this session only. */
export function saveOutline(id: string, o: Outline | null): boolean {
  try {
    const all = readAll(); if (o) all[id] = o; else delete all[id];
    localStorage.setItem(OUTLINES_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}
