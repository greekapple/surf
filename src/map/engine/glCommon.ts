// Shared WebGL2 helpers for the sea-state field and its particles (map-maplibre).
export const SAMPLER_GLSL = `
const float PI = 3.14159265358979;
// geo = (lat0, dlat, lon0, dlon) ; dim = (W, H, wrap, featherDeg). Values: R val, G u, B v, A flags (1 val valid, 2 u valid, 4 v valid, 8 real model value).
float g_cov = 0.0; // coverage (0..1) of the value channel at the last sampleAll: 1 inside the field, falling to 0 over the last cell at a coverage edge
vec4 samp(highp sampler2D t, vec4 g, vec4 d, float lat, float lon, out vec4 ok, out float real, out float cov){
  ok = vec4(0.0); real = 0.0; cov = 0.0; float W = d.x, H = d.y; float latN = g.x + g.y * (H - 1.0), lonN = g.z + g.w * (W - 1.0);
  if (lat < g.x || lat > latN) return vec4(0.0);
  if (d.z > 0.5) lon = mod(mod(lon - g.z, 360.0) + 360.0, 360.0) + g.z; else if (lon < g.z || lon > lonN) return vec4(0.0);
  float gx = (lon - g.z) / g.w, gy = (lat - g.x) / g.y; float fgx = floor(gx);
  int y0 = int(min(H - 2.0, floor(gy))); float fy = gy - float(y0);
  int x0, x1; if (d.z > 0.5) { x0 = int(mod(fgx, W)); x1 = int(mod(fgx + 1.0, W)); } else { x0 = int(min(W - 2.0, fgx)); x1 = x0 + 1; }
  float fx = gx - fgx;
  vec4 a = texelFetch(t, ivec2(x0, y0), 0), b = texelFetch(t, ivec2(x1, y0), 0), c = texelFetch(t, ivec2(x0, y0 + 1), 0), e = texelFetch(t, ivec2(x1, y0 + 1), 0);
  ivec4 fl = ivec4(int(a.a + 0.5), int(b.a + 0.5), int(c.a + 0.5), int(e.a + 0.5));
  vec4 o = vec4(0.0);
  // every channel: bilinear over the VALID corners only (weights renormalised), so a coverage edge is smooth instead of stair-stepped (and the flow reaches the same edge as the colour);
  // inside the field (all four corners valid) this is the plain bilinear the pin label reads. cov = the value channel's valid weight (1 inside, falling to 0 over the last cell).
  vec4 base = vec4((1.0-fx)*(1.0-fy), fx*(1.0-fy), (1.0-fx)*fy, fx*fy);
  for (int k = 0; k < 3; k++) { int bit = 1 << k; vec4 wt = base * vec4((fl.x & bit) != 0 ? 1.0 : 0.0, (fl.y & bit) != 0 ? 1.0 : 0.0, (fl.z & bit) != 0 ? 1.0 : 0.0, (fl.w & bit) != 0 ? 1.0 : 0.0); float ws = wt.x + wt.y + wt.z + wt.w;
    if (ws > 0.02) { o[k] = (a[k]*wt.x + b[k]*wt.y + c[k]*wt.z + e[k]*wt.w) / ws; ok[k] = 1.0; if (k == 0) cov = ws; } }
  int nx = (d.z > 0.5) ? int(mod(floor(gx + 0.5), W)) : int(min(W - 1.0, floor(gx + 0.5))); int ny = int(clamp(floor(gy + 0.5), 0.0, H - 1.0));
  real = (int(texelFetch(t, ivec2(nx, ny), 0).a + 0.5) & 8) != 0 ? 1.0 : 0.0;
  return o;
}
float nestW(vec4 g, vec4 d, float lat, float lon){ float latN = g.x + g.y * (d.y - 1.0), lonN = g.z + g.w * (d.x - 1.0); float dd = min(min(lat - g.x, latN - lat), min(lon - g.z, lonN - lon)); float t = clamp(dd / d.w, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
// the shared sampler (fieldData.ts sampleAll): one grid, or a regional nest (t0, not wrapping) feathered into the global grid (t1), else the first grid with a value
vec4 sampleAll(highp sampler2D t0, highp sampler2D t1, vec4 g0, vec4 d0, vec4 g1, vec4 d1, int n, bool blend, float lat, float lon, out vec4 ok, out float real){
  float r0, r1, c0, c1; vec4 ok0, ok1; vec4 s0 = samp(t0, g0, d0, lat, lon, ok0, r0, c0);
  if (n < 2) { ok = ok0; real = r0; g_cov = c0; return s0; }
  vec4 s1 = samp(t1, g1, d1, lat, lon, ok1, r1, c1);
  if (blend) { float w = nestW(g0, d0, lat, lon); vec4 o = vec4(0.0); ok = vec4(0.0);
    for (int k = 0; k < 3; k++) { if (ok0[k] < 0.5) { ok[k] = ok1[k]; o[k] = s1[k]; } else if (ok1[k] < 0.5) { ok[k] = 1.0; o[k] = s0[k]; } else { ok[k] = 1.0; o[k] = s1[k] + (s0[k] - s1[k]) * w; } }
    real = ok0.x > 0.5 ? r0 : r1; g_cov = ok0.x < 0.5 ? c1 : (ok1.x < 0.5 ? c0 : mix(c1, c0, w)); return o; }
  vec4 o = vec4(0.0); ok = vec4(0.0); for (int k = 0; k < 3; k++) { if (ok0[k] > 0.5) { ok[k] = 1.0; o[k] = s0[k]; } else { ok[k] = ok1[k]; o[k] = s1[k]; } }
  real = ok0.x > 0.5 ? r0 : r1; g_cov = ok0.x > 0.5 ? c0 : c1; return o;
}`;

export const compile = (gl: WebGL2RenderingContext, type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader'); return s; };
export const makeProgram = (gl: WebGL2RenderingContext, vs: string, fs: string) => { const p = gl.createProgram()!; gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link'); return p; };

