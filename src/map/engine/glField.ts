// The sea-state field on MapLibre, drawn in WebGL (map-maplibre step 3b). One persistent custom layer, added right after the OCEAN polygons (style.ts `swello-field-slot`),
// so every land fill, coastline, road, boundary and label draws ABOVE it.
//
// How the field stays on the sea only: the layer copies the pixels drawn so far (land colour + ocean polygons in the SEA colour), computes per pixel how "sea" it is
// (w = projection of the pixel between the land colour and the sea colour: exact, anti-aliased coast included) and repaints exactly those pixels: framebuffer - w*sea + w*colour.
// No raster land mask, no second coastline; bays the model does not resolve ("enclosed waters") and cells without a model value keep the sea colour.
//
// The shader samples the SAME grids as the pin label (src/map/fieldData.ts `sampleAll`: bilinear, any empty corner = empty, the regional nest feathered into the global grid) and
// the SAME ramp lookup table (src/map/ramps.ts `colorLut`, 512 steps, nearest), so the colour under the pin is the colour of the value the label reads.
import type maplibregl from 'maplibre-gl';
import {mapConfig} from '../mapConfig.ts';
import {colorLut, LUT_STEPS, breakpointsNative, nativeMax, scaleKeyOf, type Theme} from '../ramps.ts';
import {enclosedGrid} from '../enclosed.ts';
import type {Field} from '../fieldData.ts';
import type {FieldController, FieldOpts, FrameState} from '../field.ts';
import {frameKey} from '../field.ts';
import {FIELD_SLOT_ID, palette} from './style.ts';
import {SAMPLER_GLSL, makeProgram} from './glCommon.ts';
import {sampleAll as sampleAllFields, isRealCell} from '../fieldData.ts';
import {createParticles, type Particles} from './glParticles.ts';

export type GLFieldController = FieldController & {setTheme?(t: Theme): void};
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

const VS = `#version 300 es
in vec2 a_clip; in vec2 a_merc; out vec2 v_merc; void main(){ v_merc = a_merc; gl_Position = vec4(a_clip, 0.0, 1.0); }`;


const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D u_fb, u_enc, u_c0, u_c1, u_p0, u_p1, u_lutC, u_lutP;
uniform vec3 u_land, u_sea; uniform vec2 u_px;
uniform vec4 u_cg0, u_cd0, u_cg1, u_cd1, u_pg0, u_pd0, u_pg1, u_pd1; uniform ivec2 u_n; uniform ivec2 u_blend; uniform vec4 u_lohi; // lohi = (loC, hiC, loP, hiP)
uniform vec4 u_encGeo; uniform vec2 u_encDim; uniform float u_mix; uniform float u_pass; uniform vec2 u_has; // has = (cur frame, prev frame)
in vec2 v_merc; out vec4 o;
${SAMPLER_GLSL}
vec3 lut(sampler2D l, float v, float lo, float hi){ float i = clamp(floor((v - lo) / (hi - lo) * ${LUT_STEPS - 1}.0 + 0.5), 0.0, ${LUT_STEPS - 1}.0); return texelFetch(l, ivec2(int(i), 0), 0).rgb; }
void main(){
  vec4 P = texelFetch(u_fb, ivec2(gl_FragCoord.xy), 0); vec3 ls = u_sea - u_land; float w = clamp(dot(P.rgb - u_land, ls) / dot(ls, ls), 0.0, 1.0);
  if (w < 0.004) discard;
  if (u_pass < 0.5) { o = vec4(w * u_sea, 0.0); return; }           // pass A (reverse subtract): remove the sea colour the polygons drew
  float lat = degrees(atan(sinh(PI * (1.0 - 2.0 * v_merc.y)))), lon = v_merc.x * 360.0 - 180.0;
  vec3 cC = u_sea, cP = u_sea; float ok, real; vec4 okv;
  // enclosed waters (bays, harbours, estuaries): no model value, keep the sea colour
  float lonN = mod(mod(lon + 180.0, 360.0) + 360.0, 360.0) - 180.0, ex = floor((lonN - u_encGeo.z) / u_encGeo.w), ey = floor((lat - u_encGeo.x) / u_encGeo.y);
  bool encl = ex >= 0.0 && ey >= 0.0 && ex < u_encDim.x && ey < u_encDim.y && texelFetch(u_enc, ivec2(int(ex), int(ey)), 0).r > 0.001; // the grid holds 0/1 as bytes, i.e. 1/255 once normalised
  if (!encl) {
    if (u_has.x > 0.5) { vec4 s = sampleAll(u_c0, u_c1, u_cg0, u_cd0, u_cg1, u_cd1, u_n.x, u_blend.x > 0, lat, lon, okv, real); if (okv.x > 0.5) cC = mix(u_sea, lut(u_lutC, s.x, u_lohi.x, u_lohi.y), smoothstep(0.35, 0.85, g_cov)); }
    if (u_has.y > 0.5 && u_mix < 0.999) { vec4 s = sampleAll(u_p0, u_p1, u_pg0, u_pd0, u_pg1, u_pd1, u_n.y, u_blend.y > 0, lat, lon, okv, real); if (okv.x > 0.5) cP = mix(u_sea, lut(u_lutP, s.x, u_lohi.z, u_lohi.w), smoothstep(0.35, 0.85, g_cov)); }
  }
  o = vec4(w * mix(cP, cC, u_mix), 0.0);                            // pass B (add)
}`;

/** One frame on the GPU: up to two grids (regional nest + global), each an RGBA32F texture (val, u, v, flags), plus the layer's ramp. */
export interface GLFrame {textures: WebGLTexture[]; geo: [number, number, number, number][]; dim: [number, number, number, number][]; blend: boolean; n: number; lut: WebGLTexture; lo: number; hi: number; layer: string; validAt: string; source: string; key: string; fields: Field[]; scaleKey: string | null}
function frameFrom(gl: WebGL2RenderingContext, fields: Field[], theme: Theme): GLFrame {
  const textures: WebGLTexture[] = [], geo: GLFrame['geo'] = [], dim: GLFrame['dim'] = [];
  for (const f of fields.slice(0, 2)) {
    const W = f.lons.length, H = f.lats.length, buf = new Float32Array(W * H * 4);
    // The coastal fill is painted ONE cell deep only (the model's own sea cells reach the shoreline within a cell; the second fill cell would colour marshes and salt ponds well inland): a filled cell is painted only next to a real model cell.
    const nearReal = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; let xx = x + dx; if (f.wrap) xx = (xx + W) % W; else if (xx < 0 || xx >= W) continue; if (f.real[yy * W + xx]) return true; } return false; };
    for (let k = 0; k < W * H; k++) { const v = f.val[k], u = f.u[k], w = f.v[k], show = f.real[k] === 1 || nearReal(k % W, Math.floor(k / W)); buf[k * 4] = Number.isNaN(v) ? 0 : v; buf[k * 4 + 1] = Number.isNaN(u) ? 0 : u; buf[k * 4 + 2] = Number.isNaN(w) ? 0 : w; buf[k * 4 + 3] = show ? (Number.isNaN(v) ? 0 : 1) | (Number.isNaN(u) ? 0 : 2) | (Number.isNaN(w) ? 0 : 4) | (f.real[k] ? 8 : 0) : 0; }
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, buf);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.push(t); geo.push([f.lats[0], (f.lats[H - 1] - f.lats[0]) / (H - 1), f.lons[0], (f.lons[W - 1] - f.lons[0]) / (W - 1)]); dim.push([W, H, f.wrap ? 1 : 0, mapConfig.fill.nestFeatherDeg]);
  }
  const f0 = fields[0], key = scaleKeyOf(f0.layer), lut = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, lut); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, LUT_STEPS, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, key ? colorLut(key, theme) : new Uint8Array(LUT_STEPS * 3)); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return {textures, geo, dim, blend: fields.length > 1 && !f0.wrap, n: textures.length, lut, lo: key ? breakpointsNative(key)[0] : 0, hi: key ? nativeMax(key) : 1, layer: f0.layer, validAt: f0.validAt, source: f0.source, key: frameKey(f0), fields, scaleKey: key};
}
const freeFrame = (gl: WebGL2RenderingContext, f: GLFrame | null) => { if (!f) return; f.textures.forEach((t) => gl.deleteTexture(t)); gl.deleteTexture(f.lut); };

class FieldLayer implements maplibregl.CustomLayerInterface {
  id = 'swello-field'; type = 'custom' as const; renderingMode = '2d' as const;
  cur: GLFrame | null = null; prev: GLFrame | null = null; mix = 1; heat = true; flow = false; arrows = false; reduced = false;
  private arrowProg: WebGLProgram | null = null; private arrowBuf: WebGLBuffer | null = null; arrowKey = ''; private arrowN = 0;
  onRendered: (() => void) | null = null; particles: Particles | null = null;
  private gl!: WebGL2RenderingContext; private map!: maplibregl.Map; private prog!: WebGLProgram; private quad!: WebGLBuffer; private vao!: WebGLVertexArrayObject;
  private fb!: WebGLTexture; private fbW = 0; private fbH = 0; private enc!: WebGLTexture; private dummy!: WebGLTexture; private encGeo = [0, 0, 0, 1, 0, 0];
  constructor(private theme: () => Theme, private el: HTMLElement) {}
  onAdd(map: maplibregl.Map, gl0: WebGLRenderingContext | WebGL2RenderingContext) {
    const gl = (this.gl = gl0 as WebGL2RenderingContext); this.map = map;
    if (!gl.getExtension('EXT_color_buffer_float')) { /* float render targets are only needed by the particles; they check it themselves */ }
    this.prog = makeProgram(gl, VS, FS); this.quad = gl.createBuffer()!; this.vao = gl.createVertexArray()!;
    this.fb = gl.createTexture()!; this.enc = gl.createTexture()!; this.dummy = gl.createTexture()!;
    const e = enclosedGrid(); this.encGeo = [e.lat0, e.step, e.lon0, e.step, e.w, e.h];
    gl.bindTexture(gl.TEXTURE_2D, this.enc); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, e.w, e.h, 0, gl.RED, gl.UNSIGNED_BYTE, e.grid); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    for (const t of [this.enc, this.dummy, this.fb]) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
    gl.bindTexture(gl.TEXTURE_2D, this.dummy); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(4));
    this.particles = createParticles(gl, this);
  }
  onRemove(_m: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext) { const g = gl as WebGL2RenderingContext; freeFrame(g, this.cur); freeFrame(g, this.prev); this.particles?.dispose(); g.deleteProgram(this.prog); }
  setFrame(f: GLFrame | null) { freeFrame(this.gl, this.prev); this.prev = this.cur; this.cur = f; this.mix = 0; this.particles?.reset(); }
  render(gl0: WebGLRenderingContext | WebGL2RenderingContext, _args: maplibregl.CustomRenderMethodInput) {
    const gl = gl0 as WebGL2RenderingContext, cv = gl.canvas as HTMLCanvasElement, W = cv.width, H = cv.height;
    const drawColour = this.heat && (this.cur || this.prev), drawParticles = this.flow && !this.reduced && this.cur && this.particles?.ok;
    if (!drawColour && !drawParticles && !(this.arrows && this.cur)) { this.onRendered?.(); this.onRendered = null; return; }
    const pal = palette(this.theme(), true), land = hex(pal.land), sea = hex(pal.sea);
    const prevViewport = gl.getParameter(gl.VIEWPORT) as Int32Array, prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    // 1. copy what is drawn so far (land colour + ocean polygons): the sea mask comes from it
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fb);
    if (W !== this.fbW || H !== this.fbH) { gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 0, 0, W, H, 0); this.fbW = W; this.fbH = H; } else gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, W, H);
    // 2. the viewport's corners in mercator units (no rotation, no pitch: linear across the screen)
    const m = this.map, c = (x: number, y: number) => { const l = m.unproject([x, y]); const s = Math.sin((l.lat * Math.PI) / 180); return [(l.lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)]; };
    const w = cv.clientWidth, h = cv.clientHeight, tl = c(0, 0), tr = c(w, 0), bl = c(0, h), br = c(w, h);
    const verts = new Float32Array([-1, 1, ...tl, 1, 1, ...tr, -1, -1, ...bl, 1, 1, ...tr, 1, -1, ...br, -1, -1, ...bl]);
    if (drawColour) {
      gl.useProgram(this.prog); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
      const ac = gl.getAttribLocation(this.prog, 'a_clip'), am = gl.getAttribLocation(this.prog, 'a_merc'); gl.enableVertexAttribArray(ac); gl.vertexAttribPointer(ac, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(am); gl.vertexAttribPointer(am, 2, gl.FLOAT, false, 16, 8);
      const U = (n: string) => gl.getUniformLocation(this.prog, n), cur = this.cur, prev = this.prev;
      const bind = (unit: number, tex: WebGLTexture | null, name: string) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex ?? this.dummy); gl.uniform1i(U(name), unit); };
      bind(0, this.fb, 'u_fb'); bind(1, this.enc, 'u_enc');
      bind(2, cur?.textures[0] ?? null, 'u_c0'); bind(3, cur?.textures[1] ?? cur?.textures[0] ?? null, 'u_c1'); bind(4, cur?.lut ?? null, 'u_lutC');
      bind(5, prev?.textures[0] ?? null, 'u_p0'); bind(6, prev?.textures[1] ?? prev?.textures[0] ?? null, 'u_p1'); bind(7, prev?.lut ?? null, 'u_lutP');
      const g4 = (n: string, v: number[] | undefined) => gl.uniform4f(U(n), ...((v ?? [0, 1, 0, 1]) as [number, number, number, number]));
      g4('u_cg0', cur?.geo[0]); g4('u_cd0', cur?.dim[0]); g4('u_cg1', cur?.geo[1] ?? cur?.geo[0]); g4('u_cd1', cur?.dim[1] ?? cur?.dim[0]);
      g4('u_pg0', prev?.geo[0]); g4('u_pd0', prev?.dim[0]); g4('u_pg1', prev?.geo[1] ?? prev?.geo[0]); g4('u_pd1', prev?.dim[1] ?? prev?.dim[0]);
      gl.uniform2i(U('u_n'), cur?.n ?? 1, prev?.n ?? 1); gl.uniform2i(U('u_blend'), cur?.blend ? 1 : 0, prev?.blend ? 1 : 0);
      gl.uniform4f(U('u_lohi'), cur?.lo ?? 0, cur?.hi ?? 1, prev?.lo ?? 0, prev?.hi ?? 1); gl.uniform3f(U('u_land'), ...land); gl.uniform3f(U('u_sea'), ...sea); gl.uniform2f(U('u_px'), W, H);
      gl.uniform4f(U('u_encGeo'), this.encGeo[0], this.encGeo[1], this.encGeo[2], this.encGeo[3]); gl.uniform2f(U('u_encDim'), this.encGeo[4], this.encGeo[5]);
      gl.uniform1f(U('u_mix'), this.mix); gl.uniform2f(U('u_has'), cur ? 1 : 0, prev ? 1 : 0);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.STENCIL_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.colorMask(true, true, true, false);
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT); gl.uniform1f(U('u_pass'), 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.blendEquation(gl.FUNC_ADD); gl.uniform1f(U('u_pass'), 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.colorMask(true, true, true, true); gl.bindVertexArray(null);
    }
    if (drawParticles) { this.map.triggerRepaint(); }
    if (drawParticles) this.particles!.draw(gl, {enc: this.enc, encGeo: this.encGeo, fb: this.fb, land, sea, verts, fbW: W, fbH: H, prevFbo, prevViewport, zoom: this.map.getZoom(), cssW: w, cssH: h, opacity: this.mix, wind: this.cur!.layer === 'WIND'});
    if (this.arrows && this.cur) this.drawArrows(gl, w, h, cv);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]); gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo); gl.activeTexture(gl.TEXTURE0); gl.blendEquation(gl.FUNC_ADD);
    this.onRendered?.(); this.onRendered = null;
  }
  /** Static direction arrows on a 56 px grid (the Leaflet layer's look: a 18 px shaft with a head), only where the model has a real value on the sea. Geometry is rebuilt when the view or the frame changes. */
  private drawArrows(gl: WebGL2RenderingContext, w: number, h: number, cv: HTMLCanvasElement) {
    const cur = this.cur!, m = this.map, c = m.getCenter(), key = `${cur.key}|${c.lng.toFixed(5)},${c.lat.toFixed(5)},${m.getZoom().toFixed(3)},${w}x${h}`;
    if (!this.arrowProg) { this.arrowProg = makeProgram(gl, '#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }', '#version 300 es\nprecision mediump float; uniform float u_a; out vec4 o; void main(){ o = vec4(u_a, u_a, u_a, u_a); }'); this.arrowBuf = gl.createBuffer(); }
    if (key !== this.arrowKey) {
      this.arrowKey = key; const out: number[] = [], hw = 0.7, X = (x: number) => (x / w) * 2 - 1, Y = (y: number) => 1 - (y / h) * 2;
      const seg = (x0: number, y0: number, x1: number, y1: number) => { const dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy) || 1, nx = (-dy / n) * hw, ny = (dx / n) * hw; out.push(X(x0 + nx), Y(y0 + ny), X(x0 - nx), Y(y0 - ny), X(x1 + nx), Y(y1 + ny), X(x1 + nx), Y(y1 + ny), X(x0 - nx), Y(y0 - ny), X(x1 - nx), Y(y1 - ny)); };
      for (let y = 30; y < h; y += 56) for (let x = 30; x < w; x += 56) {
        const ll = m.unproject([x, y]), uu = sampleAllFields(cur.fields, 'u', ll.lat, ll.lng), vv = sampleAllFields(cur.fields, 'v', ll.lat, ll.lng);
        if (Number.isNaN(uu) || Number.isNaN(vv) || Math.hypot(uu, vv) === 0 || !cur.fields.some((f) => isRealCell(f, ll.lat, ll.lng))) continue;
        const n = Math.hypot(uu, vv), dx = uu / n, dy = -vv / n, L2 = 9;
        seg(x - dx * L2, y - dy * L2, x + dx * L2, y + dy * L2); seg(x + dx * L2 - dx * 5 - dy * 4, y + dy * L2 - dy * 5 + dx * 4, x + dx * L2, y + dy * L2); seg(x + dx * L2, y + dy * L2, x + dx * L2 - dx * 5 + dy * 4, y + dy * L2 - dy * 5 - dx * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW); this.arrowN = out.length / 2;
    }
    if (!this.arrowN) return;
    gl.useProgram(this.arrowProg); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuf); const a = gl.getAttribLocation(this.arrowProg!, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(this.arrowProg!, 'u_a'), 0.85 * this.mix); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.colorMask(true, true, true, false); gl.drawArrays(gl.TRIANGLES, 0, this.arrowN); gl.colorMask(true, true, true, true); gl.bindVertexArray(null); void cv;
  }
  getCur() { return this.cur; }
}

export function createGLFieldController(map: maplibregl.Map, el: HTMLElement): GLFieldController {
  let theme: Theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', alive = true, layer: FieldLayer | null = null, anim = 0, ready: Omit<Extract<FrameState, {state: 'ready'}>, 'state'> | null = null;
  const setHeat = (on: boolean) => { try { el.dataset.heat = on ? 'on' : 'off'; } catch { /* removed */ } };
  const ensure = () => { if (layer) return layer; layer = new FieldLayer(() => theme, el); const add = () => { if (!alive || !layer) return; try { map.addLayer(layer, map.getLayer(FIELD_SLOT_ID) ? FIELD_SLOT_ID : undefined); } catch { /* style not ready */ } }; if (map.getLayer(FIELD_SLOT_ID)) add(); else map.once('style.load', add); return layer; };
  const animate = (ms: number) => { cancelAnimationFrame(anim); const t0 = performance.now(), step = (t: number) => { if (!alive || !layer) return; const k = ms <= 0 ? 1 : Math.min(1, (t - t0) / ms); layer.mix = k; map.triggerRepaint(); if (k < 1) anim = requestAnimationFrame(step); else { freeFrame((layer as unknown as {gl: WebGL2RenderingContext}).gl, layer.prev); layer.prev = null; } }; anim = requestAnimationFrame(step); };
  const ctl: GLFieldController = {
    update(fields: Field[], opts: FieldOpts & {onFrame?: (s: FrameState) => void}) {
      if (!alive || !fields.length) return;
      const l = ensure(), gl = () => (l as unknown as {gl?: WebGL2RenderingContext}).gl;
      const apply = () => {
        const g = gl(); if (!g) { map.once('render', apply); return; }
        setHeat(opts.heat); l.heat = opts.heat; l.flow = opts.flow; l.arrows = opts.arrows; l.arrowKey = ''; l.reduced = opts.reducedMotion;
        const fr = frameFrom(g, fields, theme), first = !l.cur && !l.prev; l.setFrame(fr);
        ready = {key: fr.key, validAt: fr.validAt, source: fr.source};
        l.onRendered = () => { if (alive) opts.onFrame?.({state: 'ready', ...ready!}); };
        animate(first ? 0 : mapConfig.crossfadeMs); map.triggerRepaint();
      };
      apply();
    },
    clear() { if (!layer) { setHeat(false); return; } setHeat(false); layer.heat = false; layer.flow = false; layer.arrows = false; layer.setFrame(null); layer.mix = 1; freeFrame((layer as unknown as {gl: WebGL2RenderingContext}).gl, layer.prev); layer.prev = null; map.triggerRepaint(); },
    dispose() { alive = false; cancelAnimationFrame(anim); if (layer && map.getLayer(layer.id)) map.removeLayer(layer.id); layer = null; },
    count: () => (layer ? (layer.cur ? 1 : 0) + (layer.prev ? 1 : 0) : 0),
    setTheme(t: Theme) { theme = t; const l = layer; if (l?.cur) { const g = (l as unknown as {gl: WebGL2RenderingContext}).gl; const f = frameFrom(g, l.cur.fields, t); freeFrame(g, l.cur); l.cur = f; map.triggerRepaint(); } },
  };
  return ctl;
}
