import L from 'leaflet';
import type {SpatialFrame} from './spatial';
import coast from './coast.json';
import globeLand from './land-globe.json';

/** Display ramps (T-115, user decision 2026-11-04: Windy's colours, see colors.ts mapColor). The field and its legend read the same function over the same range. */
export {legendModel, scaleKeyOf} from './ramps';
import {colorLut, lutIndex, scaleKeyOf, type Theme} from './ramps';

import {isEnclosedWater} from './enclosed';
import {mapConfig} from './mapConfig';
import {sampleAllSoft, coverageAlpha, buildField, sampleAll as sampleAllFields, sampleField as sampleFieldBase, layerOfFrame, type Field, type FieldLayer, type PointValue} from './fieldData';
export {buildField, layerOfFrame, type Field, type FieldLayer, type PointValue};

const rings = (coast as {rings: number[][][]}).rings;
const world = (globeLand as {rings: {b: number[]; r: number[][]}[]}).rings;
/** Even-odd point-in-polygon over the repo's own coastlines: the detailed California coast, then the simplified world (T-117: a tap on land has no sea value). */
const inRing = (r: number[][], lat: number, lon: number) => { let c = false; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const [x1, y1] = r[i], [x2, y2] = r[k]; if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) c = !c; } return c; };
export function isLandPoint(lat: number, lon: number): boolean {
  let c = false; for (const r of rings) if (inRing(r, lat, lon)) c = !c;
  if (c) return true; c = false;
  for (const {b: [x0, y0, x1, y1], r} of world) if (lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1 && inRing(r, lat, lon)) c = !c;
  return c;
}
/** T-117 point API: the layer value, direction, layer, valid time and source at a point, sampled exactly as the map paints it. Null on land, enclosed water ("Not covered") or outside the grid. */
export const sampleField = (fields: Field[], lat: number, lon: number): PointValue | null => sampleFieldBase(fields, lat, lon, isLandPoint);
/** Fills land: the detailed California coast, then the simplified world (only rings in view). Separate fills so overlaps never cancel. */
function fillLand(ctx: CanvasRenderingContext2D, toC: (lat: number, lon: number) => {x: number; y: number}, b: L.LatLngBounds) {
  const trace = (r: number[][], dLon = 0) => r.forEach(([lon, lat], i) => { const p = toC(lat, lon + dLon); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
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
export function attachFieldLayer(map: L.Map, fields: Field[], opts: FieldOpts & {/** Start fully transparent: the controller fades it in once it has been drawn. */ startHidden?: boolean}) {
  const field = fields[0], ALPHA = Math.max(opts.opacity, FIELD_ALPHA);

  const sampleAll = (k: 'val' | 'u' | 'v', lat: number, lon: number) => sampleAllFields(fields, k, lat, lon); // the one shared sampler (fieldData.ts): the point label reads the same values
  for (const [name, z] of [['field', 420], ['flow', 430]] as const) if (!map.getPane(name)) { const p = map.createPane(name); p.style.zIndex = String(z); p.style.pointerEvents = 'none'; }
  const mk = (pane: string) => { const c = document.createElement('canvas'); c.className = `xfield-${pane}`; c.setAttribute('aria-hidden', 'true'); c.style.position = 'absolute'; if (opts.startHidden) c.style.opacity = '0'; map.getPane(pane)!.append(c); return c; };
  const heat = mk('field'), flow = mk('flow'), mask = document.createElement('canvas');
  const scaleKey = scaleKeyOf(field.layer), themeNow = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); // ONE fixed scale per layer (mapConfig.scales); never rescaled by zoom
  let raf = 0, moving = false, parts: {x: number; y: number; age: number}[] = [], land = new Uint8ClampedArray(0), lw = 0, lh = 0, lm = 1; // lm: the land mask's scale (half resolution on a big padded canvas)
  const size = () => map.getSize();
  // T-115: the heat canvas is drawn PADDED (PAD = half the viewport on every side, so a one-level zoom-out, the wheel and the +/- buttons, is covered edge to edge) so a pan or a zoom-out shows field, not an unpainted edge, and it carries Leaflet's zoom-animated class:
  // during a zoom it is CSS-transformed with the map's own animation (zoomanim, the same pattern as L.ImageOverlay and L.Canvas), so it never disappears and the basemap's grey tile grid never shows through.
  const PAD = 0.5; let padX = 0, padY = 0, heatBounds: L.LatLngBounds = map.getBounds();
  heat.classList.add('leaflet-zoom-animated');
  // The painter can draw for the CURRENT view or for a TARGET view (zoom, centre): at Leaflet's `zoomanim` the new frame is drawn for where the zoom will end and animated into place by the same
  // layer-bounds maths, so a zoom jump of any size shows the new, correctly scaled frame from the first animation frame: no floating old rectangle, no grey sea, no double image (map review).
  let view: {zoom: number; center: L.LatLng} | null = null, target: {zoom: number; center: L.LatLng} | null = null; // target = the view the current canvas was drawn for
  const c2ll = (x: number, y: number) => { if (!view) return map.containerPointToLatLng([x, y]); const s = size(), o = map.project(view.center, view.zoom).subtract(s.divideBy(2)); return map.unproject(o.add([x, y]), view.zoom); };
  const ll2c = (lat: number, lon: number) => { if (!view) return map.latLngToContainerPoint([lat, lon]); const s = size(); return map.project([lat, lon], view.zoom).subtract(map.project(view.center, view.zoom)).add(s.divideBy(2)); };
  const place = (c: HTMLCanvasElement, dpr: number, padded = false) => {
    const s = size(), px = padded ? Math.round(s.x * PAD) : 0, py = padded ? Math.round(s.y * PAD) : 0, cw = s.x + 2 * px, ch = s.y + 2 * py;
    c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); c.style.width = cw + 'px'; c.style.height = ch + 'px';
    if (!view) L.DomUtil.setPosition(c, map.containerPointToLayerPoint([-px, -py]));
    if (padded) { padX = px; padY = py; heatBounds = L.latLngBounds(c2ll(-px, -py), c2ll(s.x + px, s.y + py)); }
  };
  const drawHeat = () => {
    const t0 = performance.now();
    place(heat, 1, true); const s = size(), ctx = heat.getContext('2d')!, W = s.x + 2 * padX, H = s.y + 2 * padY;
    ctx.setTransform(1, 0, 0, 1, padX, padY); // from here on every coordinate is a container point, as before; the canvas just extends past the viewport
    ctx.clearRect(-padX, -padY, W, H);
    // Land mask at screen resolution (also used to keep particles at sea).
    lm = W * H > 2.5e6 ? 0.5 : 1; mask.width = Math.round(W * lm); mask.height = Math.round(H * lm); const m = mask.getContext('2d', {willReadFrequently: true})!; m.setTransform(lm, 0, 0, lm, padX * lm, padY * lm); m.fillStyle = '#000'; fillLand(m, ll2c, heatBounds);
    lw = mask.width; lh = mask.height; land = m.getImageData(0, 0, lw, lh).data;
    if (opts.heat) {
      const step = W * H > 2.5e6 ? 6 : 4, w = Math.ceil(W / step), h = Math.ceil(H / step), img = new ImageData(w, h);
      const lon = Array.from({length: w}, (_, i) => c2ll(i * step - padX, 0).lng), lat = Array.from({length: h}, (_, j) => c2ll(0, j * step - padY).lat);
      // Colour lookup table (256 steps over the range) and an inland skip: a cell whose own pixel and its four neighbours 3 cells away are all land is never painted (the land trim removes it anyway),
      // so most of an inland viewport costs five mask reads instead of a grid sample. Cells near the coast are still sampled, so the colour reaches the shoreline.
      const lut = scaleKey ? colorLut(scaleKey, themeNow()) : new Uint8Array(512 * 3);
      const isLand = (x: number, y: number) => { const xi = Math.max(0, Math.min(lw - 1, (x * lm) | 0)), yi = Math.max(0, Math.min(lh - 1, (y * lm) | 0)); return land[(yi * lw + xi) * 4 + 3] > 0; }, R = 3 * step;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const cx = i * step, cy = j * step; if (isLand(cx, cy) && isLand(cx + R, cy) && isLand(cx - R, cy) && isLand(cx, cy + R) && isLand(cx, cy - R)) continue;
        if (isEnclosedWater(lat[j], lon[i])) continue; // enclosed water (bays, harbours, estuaries): no model value there, so it stays TRANSPARENT: no invented colour, no hatch (Stage 2a, user: "never the hatch")
        const sv = sampleAllSoft(fields, lat[j], lon[i]); if (Number.isNaN(sv.v)) continue; // soft coverage: a coverage edge fades over one cell instead of stepping in 0.5 degree squares
        const q = scaleKey ? lutIndex(scaleKey, sv.v) : 0, r = lut[q], g = lut[q + 1], b = lut[q + 2], k = (j * w + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.round(255 * ALPHA * coverageAlpha(sv.cov));
      }
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d')!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(tmp, -padX, -padY, w * step, h * step); ctx.filter = 'none';
    }
    if (opts.arrows) {
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
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; fillLand(ctx, ll2c, heatBounds);
    // The 1:10m coastline plus the blur leave a thin fringe of colour on the land edge: trim a 2 px band along the coast as well (T-092).
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); for (const r of rings) r.forEach(([lon, lat], i) => { const p = ll2c(lat, lon); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // Arrows were trimmed with the field; that is intended (sea state only).
    heat.dataset.drawMs = (performance.now() - t0).toFixed(1); // QA: the redraw cost of the last zoom/pan (t115-zoom.mjs)
  };
  const onLand = (x: number, y: number) => { const xi = ((x + padX) * lm) | 0, yi = ((y + padY) * lm) | 0; return xi < 0 || yi < 0 || xi >= lw || yi >= lh || land[(yi * lw + xi) * 4 + 3] > 0; };
  const wind = field.unit === 'm/s', LIFE = 150, DASH = 6;
  const spawn = () => { const s = size(); return {x: Math.random() * s.x, y: Math.random() * s.y, age: Math.random() * (wind ? 80 : LIFE)}; };
  const animate = !opts.reducedMotion && opts.flow, still = opts.reducedMotion && opts.flow; // reduced motion: the same marks, frozen (no drift, no trails)
  /** Windy's two particle looks (T-117): the waves, swell and period layers show SHORT WHITE DASHES drifting slowly with the wave direction (no trails, fading in and out); wind shows STREAMLINES (trails). */
  const resetFlow = () => {
    place(flow, Math.min(2, window.devicePixelRatio || 1));
    const s = size(); parts = Array.from({length: Math.round(wind ? Math.min(2200, (s.x * s.y) / 480) : Math.min(1400, (s.x * s.y) / 1200))}, spawn);
    if (still) drawStill();
  };
  const drawStill = () => {
    const ctx = flow.getContext('2d')!, dpr = flow.width / size().x; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size().x, size().y);
    ctx.strokeStyle = 'rgb(255 255 255 / 0.72)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
    for (const p of parts) {
      const ll = map.containerPointToLatLng([p.x, p.y]), uu = sampleAll('u', ll.lat, ll.lng), vv = sampleAll('v', ll.lat, ll.lng); if (Number.isNaN(uu) || Number.isNaN(vv) || onLand(p.x, p.y)) continue;
      const n = Math.hypot(uu, vv); if (!n) continue; const len = wind ? Math.min(18, 4 + n * 1.1) : DASH; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (uu / n) * len, p.y - (vv / n) * len);
    }
    ctx.stroke();
  };
  const scale = wind ? 0.16 : 0.35; // px per frame: wind streamlines travel with the wind speed; wave dashes only drift
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (moving || document.hidden) return;
    const ctx = flow.getContext('2d')!, dpr = flow.width / size().x;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!wind) { // dashes: no trails; four alpha buckets so a frame is four strokes, not hundreds
      ctx.clearRect(0, 0, size().x, size().y); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], ll = map.containerPointToLatLng([p.x, p.y]), uu = sampleAll('u', ll.lat, ll.lng), vv = sampleAll('v', ll.lat, ll.lng);
        if (Number.isNaN(uu) || Number.isNaN(vv) || p.age++ > LIFE || onLand(p.x, p.y)) { parts[i] = spawn(); parts[i].age = 0; continue; }
        const n = Math.hypot(uu, vv) || 1, dx = uu / n, dy = -vv / n, a = Math.sin((Math.PI * p.age) / LIFE), path = paths[Math.max(0, Math.min(3, Math.floor(a * 4)))];
        path.moveTo(p.x, p.y); path.lineTo(p.x + dx * DASH, p.y + dy * DASH); p.x += dx * scale; p.y += dy * scale;
      }
      paths.forEach((path, b) => { ctx.strokeStyle = `rgb(255 255 255 / ${0.25 + b * 0.18})`; ctx.stroke(path); });
      return;
    }
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
  /** The canvas drawn at zoomanim IS the settled view when zoom and centre agree (a few metres at most): then only its size and place are fixed, no second draw. */
  const atTarget = () => !!target && Math.abs(target.zoom - map.getZoom()) < 1e-6 && Math.abs(target.center.lat - map.getCenter().lat) < 2e-5 && Math.abs(target.center.lng - map.getCenter().lng) < 2e-5;
  const redraw = () => {
    if (atTarget()) { // the frame drawn at zoomanim IS this view: just put it at its final scale and place (no second draw)
      const s = size(); heat.style.width = s.x + 2 * padX + 'px'; heat.style.height = s.y + 2 * padY + 'px'; L.DomUtil.setPosition(heat, map.containerPointToLayerPoint([-padX, -padY]));
    } else drawHeat();
    target = null; if (animate || still) resetFlow();
  };
  // Zoom (map review): at `zoomanim` the frame is drawn for the TARGET view and animated into place with the layer-bounds maths L.ImageOverlay and L.Canvas use. The first animation frame already shows the new
  // frame at the right scale, so a 1-to-6-level jump never shows a floating old rectangle, grey sea or two images; zoomend only fixes its final size and position. Particles pause for the movement and resume after.
  const zoomAnim = (e: L.ZoomAnimEvent) => {
    const t0 = performance.now(); view = {zoom: e.zoom, center: e.center};
    try {
      drawHeat(); const scale = map.getZoomScale(e.zoom, map.getZoom()), off = (map as unknown as {_latLngBoundsToNewLayerBounds(b: L.LatLngBounds, z: number, c: L.LatLng): L.Bounds})._latLngBoundsToNewLayerBounds(heatBounds, e.zoom, e.center).min;
      const s = size(); heat.style.width = (s.x + 2 * padX) / scale + 'px'; heat.style.height = (s.y + 2 * padY) / scale + 'px'; if (off) L.DomUtil.setTransform(heat, off, scale); target = {zoom: e.zoom, center: e.center};
    } finally { view = null; }
    heat.dataset.zoomDrawMs = (performance.now() - t0).toFixed(1);
  };
  const start = () => { moving = true; flow.getContext('2d')?.clearRect(0, 0, flow.width, flow.height); };
  let pending = 0;
  const end = () => { if (target) { /* a zoom just ended: put the frame in its final place in this same task, never a frame later (the pane resets at zoomend, so a stale transform would show displaced for a frame) */ cancelAnimationFrame(pending); pending = 0; moving = false; redraw(); return; } if (atTarget()) { cancelAnimationFrame(pending); pending = 0; moving = false; redraw(); return; } /* the frame for this view is already drawn: fix its place in the same task as zoomend (no frame with the stale transform) */ if (pending) return; pending = requestAnimationFrame(() => { pending = 0; moving = false; redraw(); }); }; // moveend and zoomend arrive together: one redraw per frame
  map.on('movestart zoomstart', start); map.on('zoomanim', zoomAnim as L.LeafletEventHandlerFn); map.on('moveend zoomend resize', end);
  const themeWatch = new MutationObserver(() => end()); themeWatch.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']}); // the ramp's lightness is tuned per theme: redraw when it flips
  redraw(); if (animate) raf = requestAnimationFrame(tick);
  const dispose = () => { themeWatch.disconnect(); cancelAnimationFrame(raf); cancelAnimationFrame(pending); map.off('movestart zoomstart', start); map.off('zoomanim', zoomAnim as L.LeafletEventHandlerFn); map.off('moveend zoomend resize', end); heat.remove(); flow.remove(); };
  return {dispose, heat, flow};
}

/** Compatibility wrapper: attach and return the disposer. */
export const attachField = (map: L.Map, fields: Field[], opts: FieldOpts) => attachFieldLayer(map, fields, opts).dispose;

/** Held-frame swap (map-seamless Stage 1). One controller per map keeps the CURRENT field on screen while a new one is prepared: `update` draws the new field into its own transparent canvases, then, once drawn,
 *  fades it in over `crossfadeMs` while the previous one fades out and is disposed. A layer or hour change therefore never shows an empty overlay; `update` with no fields keeps what is on screen (a frame still loading);
 *  `clear` fades the field out (the layer has no field, or the sea colour is off). The container's `data-heat` flag (the basemap's dark-grey switch) follows the controller, not each attachment. */
/** What the controller reports to the view (map-seamless Stage 1, agreed with product): fetching stays in `useSpatial`/`useGlobe`, so `loading` and `failed` are derived there; the field reports only when a new frame has actually been PAINTED. key = `${layer}|${validAt}`. */
export type FrameState =
  | {state: 'loading'; key: string; sinceMs: number}
  | {state: 'ready'; key: string; validAt: string; source: string}
  | {state: 'failed'; key: string; error: string; heldValidAt: string | null};
export const frameKey = (f: Pick<Field, 'layer' | 'validAt'>) => `${f.layer}|${f.validAt}`;
export interface FieldController {update(fields: Field[], opts: FieldOpts & {onFrame?: (s: FrameState) => void}): void; clear(): void; dispose(): void; /** QA: how many field layers exist right now (2 during a crossfade). */ count(): number}
export function createFieldController(map: L.Map, fadeMs: number = mapConfig.crossfadeMs): FieldController {
  let layers: {dispose: () => void; heat: HTMLCanvasElement; flow: HTMLCanvasElement; timer?: number}[] = [], alive = true, ready: {key: string; validAt: string; source: string} | null = null;
  const setHeat = (on: boolean) => { try { map.getContainer().dataset.heat = on ? 'on' : 'off'; } catch { /* map removed */ } };
  const opacity = (l: {heat: HTMLCanvasElement; flow: HTMLCanvasElement}, v: string) => { for (const c of [l.heat, l.flow]) { c.style.transition = `opacity ${fadeMs}ms ease`; c.style.opacity = v; } };
  // Layers that are fading out stay TRACKED until they are disposed (their canvases, listeners and particles live fadeMs + 40 ms longer): they count toward the two-layer limit and dispose() cleans them up.
  const fading = new Set<(typeof layers)[number]>();
  const kill = (l: (typeof layers)[number]) => { layers = layers.filter((x) => x !== l); fading.delete(l); window.clearTimeout(l.timer); try { l.dispose(); } catch { /* gone */ } };
  const retire = (l: (typeof layers)[number], immediate = false) => { layers = layers.filter((x) => x !== l); if (immediate) { kill(l); return; } fading.add(l); opacity(l, '0'); l.timer = window.setTimeout(() => kill(l), fadeMs + 40); };
  return {
    update(fields, opts) {
      if (!alive || !fields.length) return;
      // never more than two layers drawn in total (visible or still fading): the oldest goes at once
      while (layers.length + fading.size >= 2) kill(fading.size ? fading.values().next().value! : layers[0]);
      const next = attachFieldLayer(map, fields, {...opts, startHidden: layers.length > 0}); setHeat(opts.heat);
      const old = layers.slice(); layers.push(next), ready = {key: frameKey(fields[0]), validAt: fields[0].validAt, source: fields[0].source};
      const announce = () => { if (alive && layers.includes(next)) opts.onFrame?.({state: 'ready', ...ready!}); };
      if (!old.length) { announce(); return; } // first field: appears at once (nothing to hold)
      requestAnimationFrame(() => { if (!alive || !layers.includes(next)) return; opacity(next, '1'); old.forEach((l) => retire(l)); announce(); });
    },
    clear() { setHeat(false); layers.slice().forEach((l) => retire(l)); },
    dispose() { alive = false; setHeat(false); [...layers, ...fading].forEach(kill); layers = []; fading.clear(); },
    count: () => layers.length + fading.size,
  };
}
