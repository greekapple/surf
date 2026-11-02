/** T-056 board cutout, edge-aware. The AI illustrations are JPEGs of one board standing on a white seamless (soft vignette, floor shadow).
 *  T-053 turned "whiter than the seamless" into transparency, which erased a white board's lit rail (it is brighter than the backdrop).
 *  Here the board is found as a silhouette instead:
 *   1. the seamless brightness is modelled across the frame (a + b·r², fitted to the border), so every pixel has its own local backdrop;
 *   2. a pixel is "board" when it differs from that backdrop either way (darker shading or a brighter highlight), on a 3×3 average;
 *   3. the board's axis is its stringer (a dark vertical line), else the middle of the detected extents; every row's half-width is the wider of
 *      its two sides (a washed-out rail takes its mirror), smoothed, and kept convex (it grows to the widest row and shrinks after it) so the
 *      floor shadow beside the tail cannot widen it; a swallow tail's notch (axis off the board) stays open;
 *   4. inside the silhouette every pixel is opaque, in its own colour levelled so the backdrop is white; outside is transparent; the boundary is
 *      anti-aliased and drawn as a thin rail line so a white board keeps its outline on a light wall.
 *  The result is cropped to the board (height = the board's length, bottom = the tail). Returns null when no believable board is found. */
export type Cut = {url: string; w: number; h: number};

export function cutBoard(d: Uint8ClampedArray, W: number, H: number, dbg?: Record<string, unknown>): {data: Uint8ClampedArray<ArrayBuffer>; x0: number; y0: number; w: number; h: number} | null {
  const cx = W / 2, cy = H / 2;
  const lum = new Float32Array(W * H);
  for (let i = 0, j = 0; j < W * H; i += 4, j++) lum[j] = (d[i] + d[i + 1] + d[i + 2]) / 3;
  // 1. Backdrop model from the border frame.
  const bw = Math.max(4, Math.round(W * 0.05)), bh = Math.max(4, Math.round(H * 0.04));
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < bw || x >= W - bw || y < bh || y >= H - bh) {
    const r2 = ((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2, l = lum[y * W + x];
    n++; sx += r2; sy += l; sxx += r2 * r2; sxy += r2 * l;
  }
  const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
  const bg = (x: number, y: number) => Math.min(255, Math.max(150, icpt + slope * (((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2)));
  // Noise level of the backdrop (border), for the threshold.
  let dev = 0, dn = 0;
  for (let y = 1; y < H - 1; y += 3) for (let x = 1; x < W - 1; x += 3) if (x < bw || x >= W - bw) { dev += Math.abs(lum[y * W + x] - bg(x, y)); dn++; }
  const T = Math.max(4.5, (dev / Math.max(1, dn)) * 3);
  // 2. Board pixels: |3×3 mean − backdrop| > T.
  const on = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    let s = 0; for (let k = -1; k <= 1; k++) { const o = (y + k) * W + x; s += lum[o - 1] + lum[o] + lum[o + 1]; }
    if (Math.abs(s / 9 - bg(x, y)) > T) on[y * W + x] = 1;
  }
  // 3a. Axis: the stringer (strong dark vertical line in the middle third), else the median midpoint of the row extents.
  const col = new Float64Array(W);
  for (let y = Math.round(H * 0.2); y < H * 0.8; y++) for (let x = 3; x < W - 3; x++) { const o = y * W + x; col[x] += Math.max(0, (lum[o - 3] + lum[o + 3]) / 2 - lum[o]); }
  let peak = 0, ax = -1, mean = 0;
  for (let x = Math.round(W * 0.35); x < W * 0.65; x++) { mean += col[x]; if (col[x] > peak) { peak = col[x]; ax = x; } }
  mean /= W * 0.3;
  // Rails are sharp, the floor shadow and vignette are soft: the extents come from sharp horizontal edges only (on a 3-row average).
  const G = 6, eg = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 2; x < W - 2; x++) {
    const v = (xx: number) => lum[(y - 1) * W + xx] + lum[y * W + xx] + lum[(y + 1) * W + xx];
    if (Math.abs(v(x + 2) - v(x - 2)) / 3 > G) eg[y * W + x] = 1;
  }
  const ext = (y: number): [number, number] | null => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (eg[y * W + x]) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; };
  if (peak < mean * 8) {
    const mids: number[] = [];
    for (let y = Math.round(H * 0.25); y < H * 0.75; y += 4) { const e = ext(y); if (e) mids.push((e[0] + e[1]) / 2); }
    if (!mids.length) return null;
    mids.sort((a, b) => a - b); ax = mids[mids.length >> 1];
  }
  const X = Math.round(ax);
  // 3b. Half-widths per row (the wider side), whether the axis is on the board, and the open gap around the axis when it is not (a notch).
  const half = new Float32Array(H), axisOn = new Uint8Array(H), gap = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const e = ext(y); if (!e) continue;
    half[y] = Math.max(ax - e[0], e[1] - ax);
    let a = 0; for (let k = -2; k <= 2; k++) a += on[y * W + X + k];
    axisOn[y] = a >= 2 ? 1 : 0;
    if (!axisOn[y]) { let g = 1; while (g < half[y] && !eg[y * W + X + g] && !eg[y * W + X - g]) g++; gap[y] = g; }
  }
  // Median over ±3 rows.
  const hm = new Float32Array(H);
  for (let y = 0; y < H; y++) { const w: number[] = []; for (let k = -3; k <= 3; k++) { const yy = y + k; if (yy >= 0 && yy < H) w.push(half[yy]); } w.sort((a, b) => a - b); hm[y] = w[w.length >> 1]; }
  // The board's rows: the longest run of rows with an outline (gaps of up to 3 rows bridged).
  let top = -1, bot = -1, runS = -1, last = -1, best = 0;
  for (let y = 0; y <= H; y++) {
    const ok = y < H && hm[y] > 1.5;
    if (ok) { if (runS < 0 || y - last > 4) runS = y; last = y; if (y - runS > best) { best = y - runS; top = runS; bot = y; } }
  }
  if (top < 0 || bot - top < H * 0.3) return null;
  // Convex outline: grows to the widest row (looked for in the middle of the board), shrinks after it, so nothing outside the rails widens it.
  const L = bot - top;
  let wy = top + Math.round(L * 0.2); for (let y = wy; y <= top + L * 0.8; y++) if (hm[y] > hm[wy]) wy = y;
  for (let y = wy - 1; y >= top; y--) hm[y] = Math.min(hm[y], hm[y + 1]);
  for (let y = wy + 1; y <= bot; y++) hm[y] = Math.min(hm[y], hm[y - 1]);
  const notchFrom = top + L * 0.88, nb = bot;
  if (dbg) Object.assign(dbg, {T, ax, top, bot, wy, half: [...half], hm: [...hm], axisOn: [...axisOn], gap: [...gap]});
  // 4. Compose: opaque inside, anti-aliased edge, thin rail line.
  const x0 = Math.max(0, Math.floor(ax - hm[wy] - 2)), x1 = Math.min(W - 1, Math.ceil(ax + hm[wy] + 2)), w = x1 - x0 + 1, h = nb - top + 1;
  const out = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  for (let y = top; y <= nb; y++) {
    const hw = hm[y], notch = y > notchFrom && !axisOn[y] && gap[y] < hw - 1 ? gap[y] : 0;
    for (let x = x0; x <= x1; x++) {
      const dx = Math.abs(x - ax);
      const cov = Math.min(1, Math.max(0, hw + 0.5 - dx)) * (notch ? Math.min(1, Math.max(0, dx - notch + 0.5)) : 1);
      if (cov <= 0) continue;
      const i = (y * W + x) * 4, o = ((y - top) * w + (x - x0)) * 4, k = 255 / bg(x, y);
      // Rail line: within ~1.2 px of the outline the colour is darkened a little (a drawn edge for a white board on a white wall).
      const edge = Math.max(0, 1.2 - Math.abs(hw - dx)) / 1.2, dark = 1 - 0.22 * edge;
      out[o] = Math.min(255, d[i] * k) * dark; out[o + 1] = Math.min(255, d[i + 1] * k) * dark; out[o + 2] = Math.min(255, d[i + 2] * k) * dark;
      out[o + 3] = Math.round(cov * 255);
    }
  }
  return {data: out, x0, y0: top, w, h};
}

const cuts = new Map<string, Promise<Cut | null>>();
/** Loads the illustration and cuts the board out of it (cached per file). Null if anything fails; the caller keeps the masked JPEG. */
export function cutout(src: string): Promise<Cut | null> {
  let p = cuts.get(src);
  if (!p) {
    p = new Promise<Cut | null>((resolve) => {
      const img = new Image(); img.decoding = 'async';
      img.onload = () => {
        try {
          const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
          const g = c.getContext('2d', {willReadFrequently: true}); if (!g) return resolve(null);
          g.drawImage(img, 0, 0);
          const r = cutBoard(g.getImageData(0, 0, W, H).data, W, H); if (!r) return resolve(null);
          const o = document.createElement('canvas'); o.width = r.w; o.height = r.h;
          o.getContext('2d')!.putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
          resolve({url: o.toDataURL('image/png'), w: r.w, h: r.h});
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cuts.set(src, p);
  }
  return p;
}
