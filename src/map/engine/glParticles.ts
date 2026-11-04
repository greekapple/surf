// GPU particles for the sea-state field (map-maplibre step 3c): the flow lines on the sea.
//  - State lives in two RGBA32F textures (x, y in mercator units, age, id), advected by a fragment shader that samples the SAME packed grids as the colour pass (ping-pong): nothing is read back to the CPU.
//  - A particle is born only where the model has a real value (never on land, never in the coastal fill), dies when it leaves the model's sea or gets too old, and respawns inside the viewport.
//  - Trails: points are drawn into an offscreen RGBA8 buffer that is faded a little every frame; the buffer is composited onto the map through the same land/sea mask as the colour, so nothing is drawn over land.
//  - Styles: swell and waves are unit-speed lines in the direction the swell travels; wind lines speed up with the wind and are longer-lived. Density follows the screen area and the zoom. Reduced motion draws none.
import {SAMPLER_GLSL, makeProgram} from './glCommon.ts';

export interface ParticleDrawInput {enc: WebGLTexture; encGeo: number[]; fb: WebGLTexture; land: [number, number, number]; sea: [number, number, number]; verts: Float32Array; fbW: number; fbH: number; prevFbo: WebGLFramebuffer | null; prevViewport: Int32Array; zoom: number; cssW: number; cssH: number; opacity: number; wind: boolean}
export interface Particles {ok: boolean; draw(gl: WebGL2RenderingContext, i: ParticleDrawInput): void; reset(): void; dispose(): void}
/** What the field layer exposes to the particles (its current frame's textures and the shared quad). */
export interface ParticleHost {getCur(): {textures: WebGLTexture[]; geo: number[][]; dim: number[][]; blend: boolean; n: number} | null}

const SIZE = 256; // 65,536 particles at most
const MAX_AGE_SWELL = 150, MAX_AGE_WIND = 110;

const QUAD_VS = `#version 300 es
in vec2 a; out vec2 v_uv; void main(){ v_uv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
const ADVECT_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D u_state, u_c0, u_c1; uniform vec4 u_g0, u_d0, u_g1, u_d1; uniform ivec2 u_n; uniform int u_blend;
uniform vec4 u_view; uniform float u_zoom, u_px, u_time, u_maxAge, u_wind; uniform int u_active; in vec2 v_uv; out vec4 o;
${SAMPLER_GLSL}
// PCG integer hash (the sin-based hash it replaces left a lattice of respawn positions: visible rows of dashes at basin zoom)
uint pcg(uint v){ uint st = v * 747796405u + 2891336453u; uint w = ((st >> ((st >> 28u) + 4u)) ^ st) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uint a, uint b){ return float(pcg(a ^ pcg(b + 0x9e3779b9u))) / 4294967295.0; }
vec4 look(vec2 m, out vec4 ok, out float real){ float lat = degrees(atan(sinh(PI * (1.0 - 2.0 * m.y)))), lon = m.x * 360.0 - 180.0; return sampleAll(u_c0, u_c1, u_g0, u_d0, u_g1, u_d1, u_n.x, u_blend > 0, lat, lon, ok, real); }
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy); int id = ip.y * ${SIZE} + ip.x; vec4 s = texelFetch(u_state, ip, 0);
  if (id >= u_active) { o = vec4(s.xy, u_maxAge + 99.0, float(id)); return; }
  vec2 p = s.xy; float age = s.z; vec4 ok; float real; vec4 f = look(p, ok, real);
  bool inView = p.x >= u_view.x && p.x <= u_view.z && p.y >= u_view.y && p.y <= u_view.w;
  bool alive = age <= u_maxAge && ok.x > 0.5 && ok.y > 0.5 && ok.z > 0.5 && g_cov > 0.4 && inView;   // wherever the field is shown (the 1-cell coastal fill included, so streaks run to the coast as the colour does); the sea mask keeps them off land
  if (!alive) {   // (re)spawn on the sea inside the view; if no candidate lands on the sea, stay dead until next frame
    age = u_maxAge + 99.0;
    for (int k = 0; k < 6; k++) {
      uint uid = uint(id), ut = uint(u_time), uk = uint(k); vec2 r = vec2(rnd(uid, ut * 8u + uk), rnd(uid + 104729u, ut * 8u + uk + 4000000u));
      vec2 c = vec2(mix(u_view.x, u_view.z, r.x), mix(u_view.y, u_view.w, r.y)); vec4 ok2; float real2; vec4 f2 = look(c, ok2, real2);
      if (ok2.x > 0.5 && ok2.y > 0.5 && ok2.z > 0.5 && g_cov > 0.6) { p = c; age = rnd(uid + 7u, ut + 99991u) * u_maxAge * 0.6; f = f2; ok = ok2; break; }
    }
    o = vec4(p, age, float(id)); return;
  }
  vec2 vel = vec2(f.y, f.z); float sp = length(vel); vec2 dir = sp > 1e-4 ? vel / sp : vec2(0.0);
  float px = u_wind > 0.5 ? u_px * (0.45 + 1.5 * clamp(f.x / 18.0, 0.0, 1.0)) : u_px;   // wind: faster where it blows harder; waves: one steady speed
  float step = px / (512.0 * exp2(u_zoom));
  o = vec4(p.x + dir.x * step, p.y - dir.y * step, age + 1.0, float(id));
}`;
const DRAW_VS = `#version 300 es
precision highp float; precision highp int; uniform sampler2D u_state; uniform vec4 u_map; uniform float u_size, u_maxAge; out float v_a;
void main(){ ivec2 ip = ivec2(gl_VertexID % ${SIZE}, gl_VertexID / ${SIZE}); vec4 s = texelFetch(u_state, ip, 0);
  float fade = clamp(min(s.z, u_maxAge - s.z) / 14.0, 0.0, 1.0); v_a = (s.z > u_maxAge) ? 0.0 : fade;
  gl_Position = vec4(-1.0 + (s.x - u_map.x) * u_map.z, 1.0 - (s.y - u_map.y) * u_map.w, 0.0, 1.0); gl_PointSize = u_size; }`;
const DRAW_FS = `#version 300 es
precision mediump float; in float v_a; out vec4 o; void main(){ vec2 d = gl_PointCoord - 0.5; if (v_a <= 0.01 || dot(d, d) > 0.25) discard; float a = v_a * 0.8; o = vec4(a, a, a, a); }`;
const FADE_FS = `#version 300 es
precision mediump float; uniform float u_fade; in vec2 v_uv; out vec4 o; void main(){ o = vec4(0.0, 0.0, 0.0, u_fade); }`;
const COMP_FS = `#version 300 es
precision highp float; uniform sampler2D u_trail, u_fb, u_enc; uniform vec3 u_land, u_sea; uniform float u_op; uniform vec4 u_view, u_encGeo; uniform vec2 u_encDim; in vec2 v_uv; out vec4 o;
void main(){ ivec2 ip = ivec2(gl_FragCoord.xy); vec4 t = texelFetch(u_trail, ip, 0); vec4 P = texelFetch(u_fb, ip, 0); vec3 ls = u_sea - u_land; float w = clamp(dot(P.rgb - u_land, ls) / dot(ls, ls), 0.0, 1.0);
  // enclosed waters (bays, harbours, estuaries) carry no streaks, as they carry no colour
  vec2 m = vec2(mix(u_view.x, u_view.z, v_uv.x), mix(u_view.w, u_view.y, v_uv.y)); float lat = degrees(atan(sinh(3.14159265358979 * (1.0 - 2.0 * m.y)))), lon = m.x * 360.0 - 180.0; float lonN = mod(mod(lon + 180.0, 360.0) + 360.0, 360.0) - 180.0, ex = floor((lonN - u_encGeo.z) / u_encGeo.w), ey = floor((lat - u_encGeo.x) / u_encGeo.y);
  if (ex >= 0.0 && ey >= 0.0 && ex < u_encDim.x && ey < u_encDim.y && texelFetch(u_enc, ivec2(int(ex), int(ey)), 0).r > 0.001) w = 0.0;
  o = t * (w * u_op); }`;

export function createParticles(gl: WebGL2RenderingContext, host: ParticleHost): Particles {
  const ok = !!gl.getExtension('EXT_color_buffer_float');
  if (!ok) return {ok: false, draw() {}, reset() {}, dispose() {}};
  const advect = makeProgram(gl, QUAD_VS, ADVECT_FS), drawP = makeProgram(gl, DRAW_VS, DRAW_FS), fadeP = makeProgram(gl, QUAD_VS, FADE_FS), compP = makeProgram(gl, QUAD_VS, COMP_FS);
  const quad = gl.createBuffer()!, vao = gl.createVertexArray()!, emptyVao = gl.createVertexArray()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const mkState = () => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SIZE, SIZE, 0, gl.RGBA, gl.FLOAT, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return {t, f}; };
  const S = [mkState(), mkState()]; let cur = 0;
  const init = new Float32Array(SIZE * SIZE * 4); for (let i = 0; i < SIZE * SIZE; i++) { init[i * 4 + 2] = 1e6; init[i * 4 + 3] = i; } // all dead: the first advect passes respawn them on the sea
  const upload = () => { for (const s of S) { gl.bindTexture(gl.TEXTURE_2D, s.t); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SIZE, SIZE, gl.RGBA, gl.FLOAT, init); } };
  upload();
  let trail: {t: WebGLTexture; f: WebGLFramebuffer; w: number; h: number} | null = null, lastView = '', lastT = 0, time = 0;
  const ensureTrail = (w: number, h: number) => { if (trail && trail.w === w && trail.h === h) return trail; if (trail) { gl.deleteTexture(trail.t); gl.deleteFramebuffer(trail.f); } const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); trail = {t, f, w, h}; return trail; };
  const API: Particles = {
    ok: true,
    reset() { upload(); lastView = ''; },
    draw(g, i) {
      const cur0 = host.getCur(); if (!cur0) return; const now = performance.now(), dt = lastT ? Math.min(3, (now - lastT) / 16.67) : 1; lastT = now; time += 1;
      const V = i.verts, tlx = V[2], tly = V[3], trx = V[6], bly = V[11], u = [tlx, tly, trx, bly]; // viewport in mercator: x from tl to tr, y from tl to bl
      const viewKey = u.map((x) => x.toFixed(6)).join(','), moved = viewKey !== lastView; lastView = viewKey;
      const zoom = i.zoom, density = (i.wind ? 300 : 340) * (zoom + 1 < 4 ? 1.25 : zoom + 1 > 10 ? 1.4 : 1), active = Math.max(800, Math.min(SIZE * SIZE, Math.round((i.cssW * i.cssH) / density))), maxAge = i.wind ? MAX_AGE_WIND : MAX_AGE_SWELL;
      // --- advect (ping-pong) ---
      const next = 1 - cur; g.bindFramebuffer(g.FRAMEBUFFER, S[next].f); g.viewport(0, 0, SIZE, SIZE); g.disable(g.BLEND); g.useProgram(advect); g.bindVertexArray(vao); g.bindBuffer(g.ARRAY_BUFFER, quad);
      const a = g.getAttribLocation(advect, 'a'); g.enableVertexAttribArray(a); g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
      const U = (n: string) => g.getUniformLocation(advect, n), bind = (unit: number, tex: WebGLTexture, n: string) => { g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, tex); g.uniform1i(U(n), unit); };
      bind(0, S[cur].t, 'u_state'); bind(1, cur0.textures[0], 'u_c0'); bind(2, cur0.textures[1] ?? cur0.textures[0], 'u_c1');
      const g4 = (n: string, v: number[] | undefined) => g.uniform4f(U(n), ...((v ?? [0, 1, 0, 1]) as [number, number, number, number]));
      g4('u_g0', cur0.geo[0]); g4('u_d0', cur0.dim[0]); g4('u_g1', cur0.geo[1] ?? cur0.geo[0]); g4('u_d1', cur0.dim[1] ?? cur0.dim[0]); g.uniform2i(U('u_n'), cur0.n, 1); g.uniform1i(U('u_blend'), cur0.blend ? 1 : 0);
      const pad = 0.02 * (1 / 2 ** Math.max(0, zoom)); g.uniform4f(U('u_view'), Math.min(tlx, trx) - pad, Math.min(tly, bly) - pad, Math.max(tlx, trx) + pad, Math.max(tly, bly) + pad);
      g.uniform1f(U('u_zoom'), zoom); g.uniform1f(U('u_px'), (i.wind ? 0.55 : 0.7) * dt); g.uniform1f(U('u_time'), time % 1000); g.uniform1f(U('u_maxAge'), maxAge); g.uniform1f(U('u_wind'), i.wind ? 1 : 0); g.uniform1i(U('u_active'), active);
      g.drawArrays(g.TRIANGLES, 0, 6); cur = next;
      // --- draw the points into the trail buffer (faded each frame; cleared while the view moves: trails do not reproject) ---
      const tr = ensureTrail(i.fbW, i.fbH); g.bindFramebuffer(g.FRAMEBUFFER, tr.f); g.viewport(0, 0, i.fbW, i.fbH); g.enable(g.BLEND);
      if (moved) { g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); } else { g.blendFunc(g.ZERO, g.ONE_MINUS_SRC_ALPHA); g.useProgram(fadeP); g.bindBuffer(g.ARRAY_BUFFER, quad); const fa = g.getAttribLocation(fadeP, 'a'); g.enableVertexAttribArray(fa); g.vertexAttribPointer(fa, 2, g.FLOAT, false, 0, 0); g.uniform1f(g.getUniformLocation(fadeP, 'u_fade'), i.wind ? 0.075 : 0.1); g.drawArrays(g.TRIANGLES, 0, 6); }
      g.useProgram(drawP); g.bindVertexArray(emptyVao); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA); g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, S[cur].t); g.uniform1i(g.getUniformLocation(drawP, 'u_state'), 0);
      g.uniform4f(g.getUniformLocation(drawP, 'u_map'), tlx, tly, 2 / (trx - tlx), 2 / (bly - tly)); g.uniform1f(g.getUniformLocation(drawP, 'u_size'), Math.max(1.5, 1.6 * (g.canvas as HTMLCanvasElement).width / (g.canvas as HTMLCanvasElement).clientWidth)); g.uniform1f(g.getUniformLocation(drawP, 'u_maxAge'), maxAge);
      g.drawArrays(g.POINTS, 0, active);
      // --- composite onto the map through the land/sea mask ---
      g.bindFramebuffer(g.FRAMEBUFFER, i.prevFbo); g.viewport(i.prevViewport[0], i.prevViewport[1], i.prevViewport[2], i.prevViewport[3]); g.useProgram(compP); g.bindVertexArray(vao); g.bindBuffer(g.ARRAY_BUFFER, quad);
      const ca = g.getAttribLocation(compP, 'a'); g.enableVertexAttribArray(ca); g.vertexAttribPointer(ca, 2, g.FLOAT, false, 0, 0);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tr.t); g.uniform1i(g.getUniformLocation(compP, 'u_trail'), 0); g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, i.fb); g.uniform1i(g.getUniformLocation(compP, 'u_fb'), 1); g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, i.enc); g.uniform1i(g.getUniformLocation(compP, 'u_enc'), 2);
      g.uniform4f(g.getUniformLocation(compP, 'u_view'), tlx, tly, trx, bly); g.uniform4f(g.getUniformLocation(compP, 'u_encGeo'), i.encGeo[0], i.encGeo[1], i.encGeo[2], i.encGeo[3]); g.uniform2f(g.getUniformLocation(compP, 'u_encDim'), i.encGeo[4], i.encGeo[5]);
      g.uniform3f(g.getUniformLocation(compP, 'u_land'), ...i.land); g.uniform3f(g.getUniformLocation(compP, 'u_sea'), ...i.sea); g.uniform1f(g.getUniformLocation(compP, 'u_op'), i.opacity);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA); g.colorMask(true, true, true, false); g.drawArrays(g.TRIANGLES, 0, 6); g.colorMask(true, true, true, true); g.bindVertexArray(null);
      g.activeTexture(g.TEXTURE0);
    },
    dispose() { for (const s of S) { gl.deleteTexture(s.t); gl.deleteFramebuffer(s.f); } if (trail) { gl.deleteTexture(trail.t); gl.deleteFramebuffer(trail.f); } for (const p of [advect, drawP, fadeP, compP]) gl.deleteProgram(p); },
  };
  return API;
}
