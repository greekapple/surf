// GLSL for the water, ocean horizon, sky dome and spray. One shared sky function drives the sky dome,
// the water reflection and the horizon haze, so the three always agree.
export const COMMON = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
vec3 skyColor(vec3 d){
  vec3 hor = vec3(0.86, 0.74, 0.66), mid = vec3(0.50, 0.62, 0.78), zen = vec3(0.16, 0.34, 0.62);
  float u = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, u)); c = mix(c, zen, smoothstep(0.2, 0.9, u));
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.72, 0.45) * (pow(s, 6.0) * 0.30 + pow(s, 64.0) * 0.6 + pow(s, 900.0) * 6.0);
  return c;
}
// What the water mirrors: sky above the horizon, dark sea below it (the concave face sees mostly water).
vec3 envColor(vec3 r){ return mix(skyColor(vec3(r.x, max(r.y, 0.0), r.z)), vec3(0.02, 0.07, 0.09), smoothstep(0.03, -0.25, r.y)); }
`;

export const SKY_VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`;
export const SKY_FRAG = /* glsl */ `${COMMON}
varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); vec3 c = skyColor(d);
  float cl = fbm(vec3(d.x / (d.y + 0.35) * 2.2, d.z / (d.y + 0.35) * 2.2, uTime * 0.01)); c = mix(c, vec3(1.0, 0.9, 0.82), smoothstep(0.52, 0.8, cl) * 0.22 * smoothstep(0.0, 0.2, d.y));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const WATER_VERT = /* glsl */ `
attribute float aFoam; attribute float aThin;
varying vec3 vWorld; varying vec3 vObj; varying vec3 vN; varying float vFoam; varying float vThin;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz; vObj = position; vN = normalize(mat3(modelMatrix) * normal / vec3(1.0)); vFoam = aFoam; vThin = aThin;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const WATER_FRAG = /* glsl */ `${COMMON}
uniform float uAnim; uniform float uHaze; uniform float uBump;
varying vec3 vWorld; varying vec3 vObj; varying vec3 vN; varying float vFoam; varying float vThin;
float ripple(vec3 p){ return vnoise(p * 2.3 + vec3(0.0, 0.0, uTime * 0.22 * uAnim)) * 0.6 + vnoise(p * 5.3 - vec3(uTime * 0.3 * uAnim, 0.0, 0.0)) * 0.4; }
void main(){
  vec3 N = normalize(vN);
  vec3 toCam = cameraPosition - vWorld; float dist = length(toCam); vec3 V = toCam / dist;
  if (dot(N, V) < 0.0 && !gl_FrontFacing) N = -N;
  // Gently animated normal. Detail fades with distance so the far sea stays calm and does not shimmer.
  float lod = 1.0 / (1.0 + dist * 0.035);
  vec3 p = vWorld; float e = 0.07, c0 = ripple(p);
  vec3 g = vec3(ripple(p + vec3(e,0,0)) - c0, ripple(p + vec3(0,e,0)) - c0, ripple(p + vec3(0,0,e)) - c0) / e;
  g -= N * dot(g, N);
  float swell = vnoise(vec3(vWorld.x * 0.05, 0.0, vWorld.z * 0.16 + uTime * 0.25 * uAnim)) - 0.5;
  N = normalize(N - g * uBump * lod + vec3(0.0, 0.0, swell * 0.05 * (1.0 - lod * 0.5)) * step(vWorld.y, 0.02));
  vec3 L = normalize(uSun);
  float ndv = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 refl = envColor(R);

  float hgt = clamp(vObj.y, 0.0, 1.2);
  vec3 deep = mix(vec3(0.004, 0.028, 0.040), vec3(0.012, 0.085, 0.100), smoothstep(0.0, 0.8, hgt));
  // Light through the thin lip: turquoise glow strongest when the sun is behind the wave.
  float thin = vThin * smoothstep(0.35, 0.9, hgt);
  float trans = 0.35 + 0.9 * pow(max(dot(V, -L), 0.0), 1.2);
  vec3 body = deep + vec3(0.07, 0.44, 0.34) * thin * trans * 0.55 + vec3(0.14, 0.34, 0.14) * thin * pow(max(dot(V, -L), 0.0), 3.0) * 0.5;
  body *= 0.6 + 0.4 * (0.5 + 0.5 * dot(N, L));
  vec3 col = body * (1.0 - F) + refl * F;
  col += vec3(1.0, 0.8, 0.55) * pow(max(dot(R, L), 0.0), 900.0) * 1.6 * lod;

  // Foam and whitewater: authored amount per vertex, broken up by noise so it reads as bubbly cells.
  float cell = fbm(vWorld * vec3(2.2, 2.2, 2.2) + vec3(0.0, uTime * 0.04 * uAnim, 0.0));
  float fine = vnoise(vWorld * 14.0 + vec3(0.0, uTime * 0.2 * uAnim, 0.0));
  float amt = vFoam * 1.1 + (cell - 0.5) * 1.0 + (fine - 0.5) * 0.35 * vFoam - 0.3;
  float foam = smoothstep(0.34, 0.6, amt);
  vec3 foamCol = vec3(0.95, 0.97, 0.98) * (0.48 + 0.52 * clamp(dot(N, L) * 0.5 + 0.55, 0.0, 1.0)) * mix(0.72, 1.0, fine);
  foamCol = mix(foamCol, foamCol * vec3(0.78, 0.92, 0.95), smoothstep(0.55, 0.3, amt));
  foamCol += vec3(0.1, 0.07, 0.03) * pow(max(dot(-V, L), 0.0), 2.0);
  col = mix(col, foamCol, foam);

  float fogA = 1.0 - exp(-pow(dist * uHaze, 1.35));
  vec3 haze = skyColor(normalize(vec3(-V.x, 0.015, -V.z)));
  col = mix(col, haze, fogA);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const SPRAY_VERT = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uScale;
attribute vec4 aSeed; attribute vec3 aVel; varying float vA;
void main(){
  float t = fract(aSeed.x + uTime * aSeed.y);
  vec3 p = position + aVel * t + vec3(0.0, -0.9 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = smoothstep(0.0, 0.08, t) * (1.0 - t) * aSeed.w;
  gl_PointSize = clamp(aSeed.z * uPx * uScale / -mv.z, 1.0, 14.0);
  gl_Position = projectionMatrix * mv;
}`;
export const SPRAY_FRAG = /* glsl */ `varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), a); }`;
