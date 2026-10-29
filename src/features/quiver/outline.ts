/** Trace a board outline from a top-down photo, in the browser only: threshold, largest blob, main axis, half-widths. */
export const OUTLINES_KEY = 'swello-board-outlines';
export const STATIONS = 40;

/** Half-width at STATIONS stations from nose (0) to tail (1), as a fraction of the board's length. */
export interface Outline {v: 1; hw: number[]}

export type TraceResult =
  | {ok: true; outline: Outline; /** Edge points in image pixels for the overlay: left edge nose to tail, then right edge tail to nose. */ edge: [number, number][]; aspect: number; w: number; h: number}
  | {ok: false; reason: string};

const FAIL = (reason: string): TraceResult => ({ok: false, reason});

/** `rgba` is an RGBA pixel array of size w*h*4. Works in Node and the browser. */
export function traceBoard(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, flip = false): TraceResult {
  const n = w * h;
  if (w < 40 || h < 40 || rgba.length < n * 4) return FAIL('The photo is too small to trace.');
  // Floor colour: median of a 3 px frame around the border.
  const bx: number[][] = [[], [], []];
  const take = (x: number, y: number) => { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) bx[c].push(rgba[i + c]); };
  for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) { take(x, k); take(x, h - 1 - k); }
  for (let y = 0; y < h; y++) for (let k = 0; k < 3; k++) { take(k, y); take(w - 1 - k, y); }
  const bg = bx.map((a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; });
  const dist = new Float32Array(n); let max = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4, d = Math.hypot(rgba[i] - bg[0], rgba[i + 1] - bg[1], rgba[i + 2] - bg[2]);
    dist[p] = d; if (d > max) max = d;
  }
  if (max < 40) return FAIL('The board does not stand out from the floor. Use a floor that contrasts with the board, such as a dark floor for a white board.');
  // Otsu threshold on the colour distance.
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
  // Largest connected blob.
  const label = new Int32Array(n), stack = new Int32Array(n);
  let bestLab = 0, bestSize = 0, lab = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] || dist[s] < cut) continue;
    lab++; let sp = 0, size = 0; stack[sp++] = s; label[s] = lab;
    while (sp) {
      const p = stack[--sp]; size++; const x = p % w, y = (p / w) | 0;
      if (x > 0 && !label[p - 1] && dist[p - 1] >= cut) { label[p - 1] = lab; stack[sp++] = p - 1; }
      if (x < w - 1 && !label[p + 1] && dist[p + 1] >= cut) { label[p + 1] = lab; stack[sp++] = p + 1; }
      if (y > 0 && !label[p - w] && dist[p - w] >= cut) { label[p - w] = lab; stack[sp++] = p - w; }
      if (y < h - 1 && !label[p + w] && dist[p + w] >= cut) { label[p + w] = lab; stack[sp++] = p + w; }
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
  let ax = Math.cos(ang), ay = Math.sin(ang);
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
  if (aspect < 2.2) return FAIL('The shape is not long and narrow enough to be a surfboard. Check the photo shows one whole board from above.');
  if (half.filter((v) => v < maxHalf * 0.04).length > 3) return FAIL('The traced shape has gaps, so part of the board blends into the floor. Try a floor that contrasts more.');
  // Orient: nose first. The narrower end (mean of the outer eighths) is taken as the nose unless flipped.
  const e = Math.floor(STATIONS / 8), avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  let order = half.map((_, k) => k);
  if (avg(half.slice(0, e)) > avg(half.slice(-e))) order = order.reverse();
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
  void ax; void ay;
  return {ok: true, outline: {v: 1, hw}, edge: [...left, ...right.reverse()], aspect, w, h};
}

/** Interpolated half-width fraction at u (0 nose, 1 tail). */
export function halfAt(o: Outline, u: number) {
  const f = Math.min(1, Math.max(0, u)) * (o.hw.length - 1), i = Math.min(o.hw.length - 2, Math.floor(f)), t = f - i;
  return o.hw[i] * (1 - t) + o.hw[i + 1] * t;
}

export const outlineKey = (o: Outline) => o.hw.reduce((s, v) => (s * 31 + Math.round(v * 1e4)) >>> 0, 7).toString(36);

function readAll(): Record<string, unknown> {
  try { const v = JSON.parse(localStorage.getItem(OUTLINES_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function loadOutline(id: string): Outline | null {
  const r = readAll()[id] as {v?: unknown; hw?: unknown} | undefined;
  if (!r || r.v !== 1 || !Array.isArray(r.hw) || r.hw.length !== STATIONS || !r.hw.every((x) => typeof x === 'number' && x >= 0 && x < 0.5)) return null;
  return {v: 1, hw: r.hw as number[]};
}
export function saveOutline(id: string, o: Outline | null) {
  try {
    const all = readAll(); if (o) all[id] = o; else delete all[id];
    localStorage.setItem(OUTLINES_KEY, JSON.stringify(all));
  } catch { /* storage unavailable: the outline stays for this session only */ }
}
