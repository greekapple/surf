// Shared WebGL2 helpers for the sea-state field and its particles (map-maplibre).
export const SAMPLER_GLSL = `
const float PI = 3.14159265358979;
// geo = (lat0, dlat, lon0, dlon) ; dim = (W, H, wrap, featherDeg). Values: R val, G u, B v, A flags (1 val valid, 2 u valid, 4 v valid, 8 real model value).
float g_cov = 0.0; // coverage (0..1) of the value channel at the last sampleAll: 1 inside the field, falling to 0 over the last cell at a coverage edge
vec4 crw(float t){ float t2 = t * t, t3 = t2 * t; return 0.5 * vec4(-t3 + 2.0 * t2 - t, 3.0 * t3 - 5.0 * t2 + 2.0, -3.0 * t3 + 4.0 * t2 + t, t3 - t2); }
// The ONE field kernel (fieldData.ts sampleSmooth, map-smooth): bicubic Catmull-Rom over the 4x4 cells around the point (interpolating, C1: no creases or diamonds on the grid lines).
// cov = the bilinear weight of the cell's VALID corners (1 inside, falling to 0 over the last cell); a missing stencil sample takes the cell's renormalised bilinear value; the result is clamped to the
// valid samples' range (no overshoot). nch = how many channels to compute (1: the value only, for the colour; 3: value and flow, for the particles).
vec4 samp(highp sampler2D t, vec4 g, vec4 d, float lat, float lon, int nch, out vec4 ok, out float real, out float cov){
  ok = vec4(0.0); real = 0.0; cov = 0.0; float W = d.x, H = d.y; float latN = g.x + g.y * (H - 1.0), lonN = g.z + g.w * (W - 1.0);
  if (lat < g.x || lat > latN) return vec4(0.0);
  bool wrap = d.z > 0.5;
  if (wrap) lon = mod(mod(lon - g.z, 360.0) + 360.0, 360.0) + g.z; else if (lon < g.z || lon > lonN) return vec4(0.0);
  float gx = (lon - g.z) / g.w, gy = (lat - g.x) / g.y;
  float ixf = wrap ? floor(gx) : min(W - 2.0, floor(gx)), iyf = min(H - 2.0, floor(gy)); float fx = gx - ixf, fy = gy - iyf;
  int Wi = int(W), Hi = int(H), ix = int(ixf), iy = int(iyf);
  vec4 V[16]; int F[16];
  for (int j = 0; j < 4; j++) { int yy = clamp(iy - 1 + j, 0, Hi - 1); for (int i = 0; i < 4; i++) { int xx = ix - 1 + i; xx = wrap ? ((xx % Wi) + Wi) % Wi : clamp(xx, 0, Wi - 1); vec4 q = texelFetch(t, ivec2(xx, yy), 0); V[j * 4 + i] = q; F[j * 4 + i] = int(q.a + 0.5); } }
  vec4 wx = crw(fx), wy = crw(fy), bw = vec4((1.0 - fx) * (1.0 - fy), fx * (1.0 - fy), (1.0 - fx) * fy, fx * fy);
  vec4 o = vec4(0.0);
  for (int k = 0; k < 3; k++) { if (k >= nch) break; int bit = 1 << k;
    vec4 m = vec4((F[5] & bit) != 0 ? 1.0 : 0.0, (F[6] & bit) != 0 ? 1.0 : 0.0, (F[9] & bit) != 0 ? 1.0 : 0.0, (F[10] & bit) != 0 ? 1.0 : 0.0), wt = bw * m; float ws = wt.x + wt.y + wt.z + wt.w;
    if (ws <= 0.02) continue;
    float B = (V[5][k] * wt.x + V[6][k] * wt.y + V[9][k] * wt.z + V[10][k] * wt.w) / ws, s = 0.0, lo = 1e30, hi = -1e30;
    for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) { int n = j * 4 + i; float v = B; if ((F[n] & bit) != 0) { v = V[n][k]; lo = min(lo, v); hi = max(hi, v); } s += wx[i] * wy[j] * v; }
    o[k] = clamp(s, lo, hi); ok[k] = 1.0; if (k == 0) cov = ws; }
  int nx = wrap ? int(mod(floor(gx + 0.5), W)) : int(min(W - 1.0, floor(gx + 0.5))); int ny = int(clamp(floor(gy + 0.5), 0.0, H - 1.0));
  real = (int(texelFetch(t, ivec2(nx, ny), 0).a + 0.5) & 8) != 0 ? 1.0 : 0.0;
  return o;
}
// The colour pass's copy of samp for the value alone, on the R32F value texture (an empty cell holds -1e30): the same kernel, a quarter of the memory traffic (map-smooth perf).
float sampV(highp sampler2D t, vec4 g, vec4 d, float lat, float lon, out float ok, out float cov){
  ok = 0.0; cov = 0.0; float W = d.x, H = d.y; float latN = g.x + g.y * (H - 1.0), lonN = g.z + g.w * (W - 1.0);
  if (lat < g.x || lat > latN) return 0.0;
  bool wrap = d.z > 0.5;
  if (wrap) lon = mod(mod(lon - g.z, 360.0) + 360.0, 360.0) + g.z; else if (lon < g.z || lon > lonN) return 0.0;
  float gx = (lon - g.z) / g.w, gy = (lat - g.x) / g.y;
  float ixf = wrap ? floor(gx) : min(W - 2.0, floor(gx)), iyf = min(H - 2.0, floor(gy)); float fx = gx - ixf, fy = gy - iyf;
  int Wi = int(W), Hi = int(H), ix = int(ixf), iy = int(iyf);
  ivec4 xs = ivec4(ix - 1, ix, ix + 1, ix + 2); xs = wrap ? ((xs % Wi) + Wi) % Wi : clamp(xs, 0, Wi - 1); ivec4 ys = clamp(ivec4(iy - 1, iy, iy + 1, iy + 2), 0, Hi - 1);
  vec4 r0 = vec4(texelFetch(t, ivec2(xs.x, ys.x), 0).r, texelFetch(t, ivec2(xs.y, ys.x), 0).r, texelFetch(t, ivec2(xs.z, ys.x), 0).r, texelFetch(t, ivec2(xs.w, ys.x), 0).r);
  vec4 r1 = vec4(texelFetch(t, ivec2(xs.x, ys.y), 0).r, texelFetch(t, ivec2(xs.y, ys.y), 0).r, texelFetch(t, ivec2(xs.z, ys.y), 0).r, texelFetch(t, ivec2(xs.w, ys.y), 0).r);
  vec4 r2 = vec4(texelFetch(t, ivec2(xs.x, ys.z), 0).r, texelFetch(t, ivec2(xs.y, ys.z), 0).r, texelFetch(t, ivec2(xs.z, ys.z), 0).r, texelFetch(t, ivec2(xs.w, ys.z), 0).r);
  vec4 r3 = vec4(texelFetch(t, ivec2(xs.x, ys.w), 0).r, texelFetch(t, ivec2(xs.y, ys.w), 0).r, texelFetch(t, ivec2(xs.z, ys.w), 0).r, texelFetch(t, ivec2(xs.w, ys.w), 0).r);
  vec4 m0 = step(-1e29, r0), m1 = step(-1e29, r1), m2 = step(-1e29, r2), m3 = step(-1e29, r3);
  vec4 bw = vec4((1.0 - fx) * (1.0 - fy), fx * (1.0 - fy), (1.0 - fx) * fy, fx * fy) * vec4(m1.y, m1.z, m2.y, m2.z); float ws = bw.x + bw.y + bw.z + bw.w;
  if (ws <= 0.02) return 0.0;
  float B = dot(bw, vec4(r1.y, r1.z, r2.y, r2.z)) / ws;
  r0 = mix(vec4(B), r0, m0); r1 = mix(vec4(B), r1, m1); r2 = mix(vec4(B), r2, m2); r3 = mix(vec4(B), r3, m3); // a missing sample takes B (B lies inside the valid range, so it never widens the clamp)
  vec4 wx = crw(fx), wy = crw(fy);
  float s = wy.x * dot(wx, r0) + wy.y * dot(wx, r1) + wy.z * dot(wx, r2) + wy.w * dot(wx, r3);
  vec4 lo4 = min(min(r0, r1), min(r2, r3)), hi4 = max(max(r0, r1), max(r2, r3));
  ok = 1.0; cov = ws; return clamp(s, min(min(lo4.x, lo4.y), min(lo4.z, lo4.w)), max(max(hi4.x, hi4.y), max(hi4.z, hi4.w)));
}
float nestW(vec4 g, vec4 d, float lat, float lon){ float latN = g.x + g.y * (d.y - 1.0), lonN = g.z + g.w * (d.x - 1.0); float dd = min(min(lat - g.x, latN - lat), min(lon - g.z, lonN - lon)); float t = clamp(dd / d.w, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
// the shared sampler (fieldData.ts sampleAll): one grid, or a regional nest (t0, not wrapping) feathered into the global grid (t1), else the first grid with a value. Deep inside the nest (weight 1, value there) the global grid is not read.
// sampleAll for the value alone (the colour pass): the same nest/global rule as below.
float sampleAllV(highp sampler2D t0, highp sampler2D t1, vec4 g0, vec4 d0, vec4 g1, vec4 d1, int n, bool blend, float lat, float lon, out float ok){
  float ok0, ok1, c0, c1; float s0 = sampV(t0, g0, d0, lat, lon, ok0, c0);
  if (n < 2) { ok = ok0; g_cov = c0; return s0; }
  float w = blend ? nestW(g0, d0, lat, lon) : 1.0;
  if (ok0 > 0.5 && (!blend || w >= 1.0)) { ok = 1.0; g_cov = c0; return s0; }
  float s1 = sampV(t1, g1, d1, lat, lon, ok1, c1);
  if (ok0 < 0.5) { ok = ok1; g_cov = c1; return s1; }
  if (ok1 < 0.5 || !blend) { ok = 1.0; g_cov = c0; return s0; }
  ok = 1.0; g_cov = mix(c1, c0, w); return s1 + (s0 - s1) * w;
}
vec4 sampleAll(highp sampler2D t0, highp sampler2D t1, vec4 g0, vec4 d0, vec4 g1, vec4 d1, int n, bool blend, float lat, float lon, int nch, out vec4 ok, out float real){
  float r0, r1, c0, c1; vec4 ok0, ok1; vec4 s0 = samp(t0, g0, d0, lat, lon, nch, ok0, r0, c0);
  if (n < 2) { ok = ok0; real = r0; g_cov = c0; return s0; }
  float w = blend ? nestW(g0, d0, lat, lon) : 1.0;
  bool full = ok0.x > 0.5 && (nch < 2 || (ok0.y > 0.5 && ok0.z > 0.5));
  if (full && (!blend || w >= 1.0)) { ok = ok0; real = r0; g_cov = c0; return s0; }
  vec4 s1 = samp(t1, g1, d1, lat, lon, nch, ok1, r1, c1);
  if (blend) { vec4 o = vec4(0.0); ok = vec4(0.0);
    for (int k = 0; k < 3; k++) { if (ok0[k] < 0.5) { ok[k] = ok1[k]; o[k] = s1[k]; } else if (ok1[k] < 0.5) { ok[k] = 1.0; o[k] = s0[k]; } else { ok[k] = 1.0; o[k] = s1[k] + (s0[k] - s1[k]) * w; } }
    real = ok0.x > 0.5 ? r0 : r1; g_cov = ok0.x < 0.5 ? c1 : (ok1.x < 0.5 ? c0 : mix(c1, c0, w)); return o; }
  vec4 o = vec4(0.0); ok = vec4(0.0); for (int k = 0; k < 3; k++) { if (ok0[k] > 0.5) { ok[k] = 1.0; o[k] = s0[k]; } else { ok[k] = ok1[k]; o[k] = s1[k]; } }
  real = ok0.x > 0.5 ? r0 : r1; g_cov = ok0.x > 0.5 ? c0 : c1; return o;
}`;

/** The enclosed-water mask in GLSL (enclosed.ts `enclosedness`): the 0/1 grid (R8, NEAREST) interpolated bilinearly between cell centres; geo = (lat0, step, lon0, step), dim = (w, h). Its 0.5 contour is the edge. */
export const ENC_GLSL = `
float encAt(sampler2D e, ivec2 c, vec2 dim){ return (c.x < 0 || c.y < 0 || c.x >= int(dim.x) || c.y >= int(dim.y)) ? 0.0 : (texelFetch(e, c, 0).r > 0.001 ? 1.0 : 0.0); }
float enclosedness(sampler2D e, vec4 geo, vec2 dim, float lat, float lon){
  float lonN = mod(mod(lon + 180.0, 360.0) + 360.0, 360.0) - 180.0, gx = (lonN - geo.z) / geo.w - 0.5, gy = (lat - geo.x) / geo.y - 0.5;
  if (!(gx > -1.0 && gy > -1.0 && gx < dim.x && gy < dim.y)) return 0.0;
  float i = floor(gx), j = floor(gy), fx = gx - i, fy = gy - j; ivec2 c = ivec2(int(i), int(j));
  return mix(mix(encAt(e, c, dim), encAt(e, c + ivec2(1, 0), dim), fx), mix(encAt(e, c + ivec2(0, 1), dim), encAt(e, c + ivec2(1, 1), dim), fx), fy);
}`;

export const compile = (gl: WebGL2RenderingContext, type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader'); return s; };
export const makeProgram = (gl: WebGL2RenderingContext, vs: string, fs: string) => { const p = gl.createProgram()!; gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link'); return p; };

