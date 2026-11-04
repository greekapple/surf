import L from 'leaflet';
import type {SpatialFrame} from './spatial';
import coast from './coast.json';
import globeLand from './land-globe.json';
import {isEnclosedWater} from './enclosed';
import {mapColor} from './colors';

/** Display ramps (T-115, user decision 2026-11-04: Windy's colours, see colors.ts mapColor). The field and its legend read the same function over the same range. */
export {RANGE, RANGE_WIDE, rampFor, RAMP} from './colors'; // display ranges and legend ramps live in colors.ts (pure, unit-tested); the field reads the same ones
import {RANGE, RANGE_WIDE} from './colors';

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
function fillLand(ctx: CanvasRenderingContext2D, map: L.Map, b: L.LatLngBounds = map.getBounds()) {
  const trace = (r: number[][], dLon = 0) => r.forEach(([lon, lat], i) => { const p = map.latLngToContainerPoint([lat, lon + dLon]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.beginPath(); for (const r of rings) trace(r); ctx.fill('evenodd');
  const w = b.getWest(), e = b.getEast(), sLat = b.getSouth(), nLat = b.getNorth();
  ctx.beginPath();
  for (const shift of [-360, 0, 360]) for (const {b: [x0, y0, x1, y1], r} of world) if (x1 + shift >= w && x0 + shift <= e && y1 >= sLat && y0 <= nLat) trace(r, shift);
  ctx.fill('evenodd');
}

/** Field opacity (T-115 round 2): Windy paints its ramp fully opaque over the sea on a flat mid-grey land basemap, so the legend colours read true; `opts.opacity` is only a floor. Land is never painted. */
const FIELD_ALPHA = 1;
export interface FieldOpts {heat: boolean; flow: boolean; arrows: boolean; opacity: number; reducedMotion: boolean; wide?: boolean}
/** Draws the smooth heatmap, direction arrows and animated flow in two panes under the spot markers. Returns a disposer. */
export function attachField(map: L.Map, fields: Field[], opts: FieldOpts) {
  const field = fields[0], ALPHA = Math.max(opts.opacity, FIELD_ALPHA);
  map.getContainer().dataset.heat = opts.heat ? 'on' : 'off'; // the basemap swaps to its dark canvas under the field (basemap.ts)
  /** First field with a value wins: the regional 0.5° grid, then the global 2° grid underneath. */
  const sampleAll = (k: 'val' | 'u' | 'v', lat: number, lon: number) => { if (isEnclosedWater(lat, lon)) return NaN; /* T-092: enclosed waters are not covered by the wave-model grid */ for (const f of fields) { const v = sample(f, f[k], lat, lon); if (!Number.isNaN(v)) return v; } return NaN; };
  for (const [name, z] of [['field', 420], ['flow', 430]] as const) if (!map.getPane(name)) { const p = map.createPane(name); p.style.zIndex = String(z); p.style.pointerEvents = 'none'; }
  const mk = (pane: string) => { const c = document.createElement('canvas'); c.className = `xfield-${pane}`; c.setAttribute('aria-hidden', 'true'); c.style.position = 'absolute'; map.getPane(pane)!.append(c); return c; };
  const heat = mk('field'), flow = mk('flow'), mask = document.createElement('canvas');
  const range = (opts.wide ? RANGE_WIDE : RANGE)[field.unit] ?? [0, 1];
  let raf = 0, moving = false, parts: {x: number; y: number; age: number}[] = [], land = new Uint8ClampedArray(0), lw = 0, lh = 0, lm = 1; // lm: the land mask's scale (half resolution on a big padded canvas)
  const size = () => map.getSize();
  // T-115: the heat canvas is drawn PADDED (PAD = half the viewport on every side, so a one-level zoom-out, the wheel and the +/- buttons, is covered edge to edge) so a pan or a zoom-out shows field, not an unpainted edge, and it carries Leaflet's zoom-animated class:
  // during a zoom it is CSS-transformed with the map's own animation (zoomanim, the same pattern as L.ImageOverlay and L.Canvas), so it never disappears and the basemap's grey tile grid never shows through.
  const PAD = 0.5; let padX = 0, padY = 0, heatBounds: L.LatLngBounds = map.getBounds();
  heat.classList.add('leaflet-zoom-animated');
  const place = (c: HTMLCanvasElement, dpr: number, padded = false) => {
    const s = size(), px = padded ? Math.round(s.x * PAD) : 0, py = padded ? Math.round(s.y * PAD) : 0, cw = s.x + 2 * px, ch = s.y + 2 * py;
    c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); c.style.width = cw + 'px'; c.style.height = ch + 'px';
    L.DomUtil.setPosition(c, map.containerPointToLayerPoint([-px, -py]));
    if (padded) { padX = px; padY = py; heatBounds = L.latLngBounds(map.containerPointToLatLng([-px, -py]), map.containerPointToLatLng([s.x + px, s.y + py])); }
  };
  const drawHeat = () => {
    const t0 = performance.now();
    place(heat, 1, true); const s = size(), ctx = heat.getContext('2d')!, W = s.x + 2 * padX, H = s.y + 2 * padY;
    ctx.setTransform(1, 0, 0, 1, padX, padY); // from here on every coordinate is a container point, as before; the canvas just extends past the viewport
    ctx.clearRect(-padX, -padY, W, H);
    // Land mask at screen resolution (also used to keep particles at sea).
    lm = W * H > 2.5e6 ? 0.5 : 1; mask.width = Math.round(W * lm); mask.height = Math.round(H * lm); const m = mask.getContext('2d', {willReadFrequently: true})!; m.setTransform(lm, 0, 0, lm, padX * lm, padY * lm); m.fillStyle = '#000'; fillLand(m, map, heatBounds);
    lw = mask.width; lh = mask.height; land = m.getImageData(0, 0, lw, lh).data;
    const notCovered: {x: number; y: number}[] = [];
    if (opts.heat) {
      const step = W * H > 2.5e6 ? 6 : 4, w = Math.ceil(W / step), h = Math.ceil(H / step), img = new ImageData(w, h);
      const lon = Array.from({length: w}, (_, i) => map.containerPointToLatLng([i * step - padX, 0]).lng), lat = Array.from({length: h}, (_, j) => map.containerPointToLatLng([0, j * step - padY]).lat);
      const encl: number[] = [];
      // Colour lookup table (256 steps over the range) and an inland skip: a cell whose own pixel and its four neighbours 3 cells away are all land is never painted (the land trim removes it anyway),
      // so most of an inland viewport costs five mask reads instead of a grid sample. Cells near the coast are still sampled, so the blur reaches the shoreline as before.
      const lut = new Uint8Array(256 * 3); for (let q = 0; q < 256; q++) { const c = mapColor(range[0] + ((range[1] - range[0]) * q) / 255, field.unit, range[0], range[1]); lut[q * 3] = c[0]; lut[q * 3 + 1] = c[1]; lut[q * 3 + 2] = c[2]; }
      const isLand = (x: number, y: number) => { const xi = Math.max(0, Math.min(lw - 1, (x * lm) | 0)), yi = Math.max(0, Math.min(lh - 1, (y * lm) | 0)); return land[(yi * lw + xi) * 4 + 3] > 0; }, R = 3 * step;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const cx = i * step, cy = j * step; if (isLand(cx, cy) && isLand(cx + R, cy) && isLand(cx - R, cy) && isLand(cx, cy + R) && isLand(cx, cy - R)) continue;
        if (isEnclosedWater(lat[j], lon[i])) { encl.push(i, j); continue; }
        const val = sampleAll('val', lat[j], lon[i]); if (Number.isNaN(val)) continue;
        const q = Math.max(0, Math.min(255, Math.round(((val - range[0]) / (range[1] - range[0] || 1)) * 255))) * 3, r = lut[q], g = lut[q + 1], b = lut[q + 2], k = (j * w + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.round(255 * ALPHA);
      }
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.filter = `blur(${step * 1.25}px)`; ctx.drawImage(tmp, -padX, -padY, w * step, h * step); ctx.filter = 'none';
      // Enclosed waters (bays, harbours) are NOT covered: a light diagonal hatch says so instead of a colour (T-092).
      ctx.fillStyle = 'rgb(215 222 230 / 0.34)'; for (let q = 0; q < encl.length; q += 2) if ((encl[q] + encl[q + 1]) % 2 === 0) ctx.fillRect(encl[q] * step - padX, encl[q + 1] * step - padY, step, step);
      // One quiet "Not covered" label per large enclosed area (bins of 12 x 12 sample cells; a bin needs at least 70 enclosed cells).
      const bins = new Map<string, {n: number; x: number; y: number}>(); for (let q = 0; q < encl.length; q += 2) { if (land[((Math.min(lh - 1, encl[q + 1] * step * lm) | 0) * lw + (Math.min(lw - 1, encl[q] * step * lm) | 0)) * 4 + 3] > 0) continue; /* T-100: no label from cells on land (the shoreline dilation) */ const k = `${Math.floor(encl[q] / 12)}|${Math.floor(encl[q + 1] / 12)}`, b = bins.get(k) ?? {n: 0, x: 0, y: 0}; b.n++; b.x += encl[q]; b.y += encl[q + 1]; bins.set(k, b); }
      for (const b of [...bins.values()].sort((p, q) => q.n - p.n)) { if (b.n < 70) break; const x = (b.x / b.n) * step - padX, y = (b.y / b.n) * step - padY; if (notCovered.some((m) => Math.hypot(m.x - x, m.y - y) < 260)) continue; notCovered.push({x, y}); }
    }
    if (opts.arrows || (opts.flow && opts.reducedMotion)) {
      ctx.strokeStyle = 'rgb(255 255 255 / 0.85)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let y = 30 - padY; y < s.y + padY; y += 56) for (let x = 30 - padX; x < s.x + padX; x += 56) {
        const ll = map.containerPointToLatLng([x, y]), uu = sampleAll('u', ll.lat, ll.lng), vv = sampleAll('v', ll.lat, ll.lng);
        if (Number.isNaN(uu) || Number.isNaN(vv) || Math.hypot(uu, vv) === 0) continue;
        const n = Math.hypot(uu, vv), dx = uu / n, dy = -vv / n, L2 = 9;
        ctx.moveTo(x - dx * L2, y - dy * L2); ctx.lineTo(x + dx * L2, y + dy * L2);
        ctx.moveTo(x + dx * L2 - dx * 5 - dy * 4, y + dy * L2 - dy * 5 + dx * 4); ctx.lineTo(x + dx * L2, y + dy * L2); ctx.lineTo(x + dx * L2 - dx * 5 + dy * 4, y + dy * L2 - dy * 5 - dx * 4);
      }
      ctx.stroke();
    }
    // Trim everything over land so the coastline in the imagery stays crisp.
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; fillLand(ctx, map, heatBounds);
    // The 1:10m coastline plus the blur leave a thin fringe of colour on the land edge: trim a 2 px band along the coast as well (T-092).
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); for (const r of rings) r.forEach(([lon, lat], i) => { const p = map.latLngToContainerPoint([lat, lon]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // Labels last, so the land trim cannot clip them (a white halo keeps them legible over the hatch).
    if (notCovered.length) { ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgb(255 255 255 / 0.85)'; ctx.fillStyle = 'rgb(60 70 80 / 0.9)'; for (const m of notCovered) { ctx.strokeText('Not covered', m.x, m.y); ctx.fillText('Not covered', m.x, m.y); } }
    // Arrows were trimmed with the field; that is intended (sea state only).
    heat.dataset.drawMs = (performance.now() - t0).toFixed(1); // QA: the redraw cost of the last zoom/pan (t115-zoom.mjs)
  };
  const onLand = (x: number, y: number) => { const xi = ((x + padX) * lm) | 0, yi = ((y + padY) * lm) | 0; return xi < 0 || yi < 0 || xi >= lw || yi >= lh || land[(yi * lw + xi) * 4 + 3] > 0; };
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
  // Zoom (T-115): the existing canvas rides Leaflet's zoom animation (transform + scale from the same layer-bounds maths L.Canvas uses) instead of being hidden and redrawn afterwards; the redraw is swapped in
  // at the end in one frame (the resize and the repaint happen in the same task, so there is no blank frame). Particles pause for the movement and resume after the redraw.
  const zoomAnim = (e: L.ZoomAnimEvent) => {
    const scale = map.getZoomScale(e.zoom, map.getZoom()), offset = (map as unknown as {_latLngBoundsToNewLayerBounds(b: L.LatLngBounds, z: number, c: L.LatLng): L.Bounds})._latLngBoundsToNewLayerBounds(heatBounds, e.zoom, e.center).min;
    if (offset) L.DomUtil.setTransform(heat, offset, scale);
  };
  const start = () => { moving = true; flow.getContext('2d')?.clearRect(0, 0, flow.width, flow.height); };
  let pending = 0;
  const end = () => { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; moving = false; redraw(); }); }; // moveend and zoomend arrive together: one redraw per frame
  map.on('movestart zoomstart', start); map.on('zoomanim', zoomAnim as L.LeafletEventHandlerFn); map.on('moveend zoomend resize', end);
  redraw(); if (animate) raf = requestAnimationFrame(tick);
  return () => { map.getContainer().dataset.heat = 'off'; cancelAnimationFrame(raf); cancelAnimationFrame(pending); map.off('movestart zoomstart', start); map.off('zoomanim', zoomAnim as L.LeafletEventHandlerFn); map.off('moveend zoomend resize', end); heat.remove(); flow.remove(); };
}
