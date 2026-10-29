import L from 'leaflet';
import type {SpatialFrame} from './spatial';
import coast from './coast.json';
import globeLand from './land-globe.json';

/** Display ramp (deep blue → cyan → green → yellow → orange → red), shared by the field and its legend. */
export const RAMP = ['#1b2a7a', '#1f5fbf', '#1fa6d6', '#2fc7a6', '#8fd65a', '#f2d84a', '#f59a32', '#e2502c', '#a3203a'];
/** Value range of the ramp per unit (metres, seconds, metres per second). */
export const RANGE: Record<string, [number, number]> = {m: [0, 4], s: [6, 18], 'm/s': [0, 15], deg: [0, 360]};
/** Wider ramps for the ocean-basin view, where storm seas would otherwise saturate the coastal scale. */
export const RANGE_WIDE: Record<string, [number, number]> = {m: [0, 9], s: [4, 20], 'm/s': [0, 25], deg: [0, 360]};
const rgb = RAMP.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
export function rampColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (rgb.length - 1), i = Math.min(rgb.length - 2, Math.floor(x)), f = x - i;
  return [0, 1, 2].map((k) => Math.round(rgb[i][k] + (rgb[i + 1][k] - rgb[i][k]) * f)) as [number, number, number];
}

/** A regular lat/lon grid built from the provider's cells. Land cells (null) are filled from their nearest
 * sea neighbours so the field reaches the coastline; the land mask then trims it. Display only, never a reading. */
export interface Field {lats: number[]; lons: number[]; val: Float32Array; u: Float32Array; v: Float32Array; unit: SpatialFrame['unit']; filled: number; wrap: boolean}
export function buildField(frame: SpatialFrame, wind: boolean): Field | null {
  const lats = [...new Set(frame.cells.map((c) => c.lat))].sort((a, b) => a - b), lons = [...new Set(frame.cells.map((c) => c.lon))].sort((a, b) => a - b);
  const W = lons.length, H = lats.length;
  if (W < 2 || H < 2) return null;
  const val = new Float32Array(W * H).fill(NaN), u = new Float32Array(W * H).fill(NaN), v = new Float32Array(W * H).fill(NaN);
  for (const c of frame.cells) {
    const k = lats.indexOf(c.lat) * W + lons.indexOf(c.lon);
    if (c.value !== null) val[k] = c.value;
    if (c.direction !== null) {
      // Direction is "from"; particles travel toward direction + 180°.
      const mag = wind ? c.speed ?? 0 : 1, th = (c.direction * Math.PI) / 180;
      u[k] = -Math.sin(th) * mag; v[k] = -Math.cos(th) * mag;
    }
  }
  let filled = 0;
  for (const arr of [val, u, v]) {
    for (let pass = 0; pass < 8; pass++) {
      const next = arr.slice(); let changed = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x; if (!Number.isNaN(arr[k])) continue;
        let s = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = arr[yy * W + xx]; if (!Number.isNaN(q)) { s += q; n++; }
        }
        if (n) { next[k] = s / n; changed++; }
      }
      arr.set(next); if (arr === val) filled += changed;
      if (!changed) break;
    }
  }
  if (val.every((x) => Number.isNaN(x))) return null;
  return {lats, lons, val, u, v, unit: frame.unit, filled, wrap: frame.resolution >= 2}; // coarse frames are global and wrap at the date line
}

/** Bilinear sample; NaN outside the grid. */
function sample(f: Field, arr: Float32Array, lat: number, lon: number) {
  const {lats, lons} = f, W = lons.length, dLon = (lons[W - 1] - lons[0]) / (W - 1);
  if (f.wrap) lon = ((((lon - lons[0]) % 360) + 360) % 360) + lons[0];
  if (lat < lats[0] || lat > lats[lats.length - 1] || lon < lons[0] || (!f.wrap && lon > lons[W - 1])) return NaN;
  const gx = (lon - lons[0]) / dLon, gy = ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (lats.length - 1);
  const x0 = f.wrap ? Math.floor(gx) % W : Math.min(W - 2, Math.floor(gx)), x1 = f.wrap ? (x0 + 1) % W : x0 + 1;
  const y0 = Math.min(lats.length - 2, Math.floor(gy)), fx = gx - Math.floor(gx), fy = gy - y0;
  const a = arr[y0 * W + x0], b = arr[y0 * W + x1], c = arr[(y0 + 1) * W + x0], d = arr[(y0 + 1) * W + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

const rings = (coast as {rings: number[][][]}).rings;
const world = (globeLand as {rings: {b: number[]; r: number[][]}[]}).rings;
/** Fills land: the detailed California coast, then the simplified world (only rings in view). Separate fills so overlaps never cancel. */
function fillLand(ctx: CanvasRenderingContext2D, map: L.Map) {
  const trace = (r: number[][], dLon = 0) => r.forEach(([lon, lat], i) => { const p = map.latLngToContainerPoint([lat, lon + dLon]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.beginPath(); for (const r of rings) trace(r); ctx.fill('evenodd');
  const b = map.getBounds(), w = b.getWest(), e = b.getEast(), sLat = b.getSouth(), nLat = b.getNorth();
  ctx.beginPath();
  for (const shift of [-360, 0, 360]) for (const {b: [x0, y0, x1, y1], r} of world) if (x1 + shift >= w && x0 + shift <= e && y1 >= sLat && y0 <= nLat) trace(r, shift);
  ctx.fill('evenodd');
}

export interface FieldOpts {heat: boolean; flow: boolean; arrows: boolean; opacity: number; reducedMotion: boolean; wide?: boolean}
/** Draws the smooth heatmap, direction arrows and animated flow in two panes under the spot markers. Returns a disposer. */
export function attachField(map: L.Map, fields: Field[], opts: FieldOpts) {
  const field = fields[0];
  /** First field with a value wins: the regional 0.5° grid, then the global 2° grid underneath. */
  const sampleAll = (k: 'val' | 'u' | 'v', lat: number, lon: number) => { for (const f of fields) { const v = sample(f, f[k], lat, lon); if (!Number.isNaN(v)) return v; } return NaN; };
  for (const [name, z] of [['field', 420], ['flow', 430]] as const) if (!map.getPane(name)) { const p = map.createPane(name); p.style.zIndex = String(z); p.style.pointerEvents = 'none'; }
  const mk = (pane: string) => { const c = document.createElement('canvas'); c.className = `xfield-${pane}`; c.setAttribute('aria-hidden', 'true'); c.style.position = 'absolute'; map.getPane(pane)!.append(c); return c; };
  const heat = mk('field'), flow = mk('flow'), mask = document.createElement('canvas');
  const range = (opts.wide ? RANGE_WIDE : RANGE)[field.unit] ?? [0, 1];
  let raf = 0, moving = false, parts: {x: number; y: number; age: number}[] = [], land = new Uint8ClampedArray(0), lw = 0, lh = 0;
  const size = () => map.getSize();
  const place = (c: HTMLCanvasElement, dpr: number) => {
    const s = size(); c.width = Math.round(s.x * dpr); c.height = Math.round(s.y * dpr); c.style.width = s.x + 'px'; c.style.height = s.y + 'px';
    L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
  };
  const drawHeat = () => {
    place(heat, 1); const s = size(), ctx = heat.getContext('2d')!;
    ctx.clearRect(0, 0, s.x, s.y);
    // Land mask at screen resolution (also used to keep particles at sea).
    mask.width = s.x; mask.height = s.y; const m = mask.getContext('2d', {willReadFrequently: true})!; m.fillStyle = '#000'; fillLand(m, map);
    lw = s.x; lh = s.y; land = m.getImageData(0, 0, lw, lh).data;
    if (opts.heat) {
      const step = 4, w = Math.ceil(s.x / step), h = Math.ceil(s.y / step), img = new ImageData(w, h);
      const lon = Array.from({length: w}, (_, i) => map.containerPointToLatLng([i * step, 0]).lng), lat = Array.from({length: h}, (_, j) => map.containerPointToLatLng([0, j * step]).lat);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const val = sampleAll('val', lat[j], lon[i]); if (Number.isNaN(val)) continue;
        const [r, g, b] = rampColor((val - range[0]) / (range[1] - range[0])), k = (j * w + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.round(255 * opts.opacity);
      }
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.filter = 'blur(5px)'; ctx.drawImage(tmp, 0, 0, w * step, h * step); ctx.filter = 'none';
    }
    if (opts.arrows || (opts.flow && opts.reducedMotion)) {
      ctx.strokeStyle = 'rgb(255 255 255 / 0.85)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let y = 30; y < s.y; y += 56) for (let x = 30; x < s.x; x += 56) {
        const ll = map.containerPointToLatLng([x, y]), uu = sampleAll('u', ll.lat, ll.lng), vv = sampleAll('v', ll.lat, ll.lng);
        if (Number.isNaN(uu) || Number.isNaN(vv) || Math.hypot(uu, vv) === 0) continue;
        const n = Math.hypot(uu, vv), dx = uu / n, dy = -vv / n, L2 = 9;
        ctx.moveTo(x - dx * L2, y - dy * L2); ctx.lineTo(x + dx * L2, y + dy * L2);
        ctx.moveTo(x + dx * L2 - dx * 5 - dy * 4, y + dy * L2 - dy * 5 + dx * 4); ctx.lineTo(x + dx * L2, y + dy * L2); ctx.lineTo(x + dx * L2 - dx * 5 + dy * 4, y + dy * L2 - dy * 5 - dx * 4);
      }
      ctx.stroke();
    }
    // Trim everything over land so the coastline in the imagery stays crisp.
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; fillLand(ctx, map); ctx.globalCompositeOperation = 'source-over';
    // Arrows were trimmed with the field; that is intended (sea state only).
  };
  const onLand = (x: number, y: number) => x < 0 || y < 0 || x >= lw || y >= lh || land[((y | 0) * lw + (x | 0)) * 4 + 3] > 0;
  const spawn = () => { const s = size(); return {x: Math.random() * s.x, y: Math.random() * s.y, age: Math.random() * 80}; };
  const animate = !opts.reducedMotion && opts.flow;
  const resetFlow = () => {
    place(flow, Math.min(2, window.devicePixelRatio || 1));
    const s = size(); parts = Array.from({length: Math.round(Math.min(2200, (s.x * s.y) / 480))}, spawn);
  };
  const scale = field.unit === 'm/s' ? 0.16 : 0.7;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (moving || document.hidden) return;
    const ctx = flow.getContext('2d')!, dpr = flow.width / size().x;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = 'rgb(0 0 0 / 0.86)'; ctx.fillRect(0, 0, flow.width, flow.height);
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgb(255 255 255 / 0.62)'; ctx.lineWidth = 1.25; ctx.beginPath();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], ll = map.containerPointToLatLng([p.x, p.y]), uu = sampleAll('u', ll.lat, ll.lng), vv = sampleAll('v', ll.lat, ll.lng);
      if (Number.isNaN(uu) || Number.isNaN(vv) || p.age++ > 60 || onLand(p.x, p.y)) { parts[i] = spawn(); parts[i].age = 0; continue; }
      const nx = p.x + uu * scale, ny = p.y - vv * scale;
      ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); p.x = nx; p.y = ny;
    }
    ctx.stroke();
  };
  const redraw = () => { drawHeat(); if (animate) resetFlow(); };
  const start = () => { moving = true; flow.getContext('2d')?.clearRect(0, 0, flow.width, flow.height); };
  const end = () => { moving = false; heat.style.visibility = ''; redraw(); };
  const hide = () => { heat.style.visibility = 'hidden'; };
  map.on('zoomstart', hide); map.on('movestart zoomstart', start); map.on('moveend zoomend resize', end);
  redraw(); if (animate) raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); map.off('zoomstart', hide); map.off('movestart zoomstart', start); map.off('moveend zoomend resize', end); heat.remove(); flow.remove(); };
}
