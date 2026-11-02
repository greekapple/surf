import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Real-time 3D wave (T-062): the band's exported wave mesh (COLOR_0: r foam, g thin lip, b distance from crest), a custom water shader, a surfer placed with the band's matrix,
 *  animated spray, an endless sea and full orbit control. An illustration at approximate scale, never current conditions. Loaded lazily; Spin360 stays the fallback. */
export const LIVE_ROOT = (import.meta.env.BASE_URL ?? '/') + 'media/scale3d-live/';
export interface BandMeta {surfer_matrix_colmajor: number[]; face_m: number; curl: number; pocket_m: number; broken_m: number; crop_m: number}
/** TODO(quiver hook): the user's selected board replaces the surfer model's board. Pass a function that returns an Object3D built from `boardOutline`
 *  (src/features/quiver) in metres, standing at the surfer's feet; until then the GLB's own board stays. */
export interface LiveBoard {object3d: () => THREE.Object3D | null}

const SUN = new THREE.Vector3(0.15, 0.3, -0.94).normalize();
const HORIZON = new THREE.Color('#f0f2f0'), SKY_TOP = new THREE.Color('#c9dbe8');

const WATER_VS = /* glsl */ `
attribute vec4 color; uniform float uTime; varying vec3 vW; varying vec3 vN; varying vec4 vC;
void main(){ vec3 pos=position; float lump=color.r*color.r; pos.y+=lump*.05*sin(pos.x*3.1+pos.z*2.3+uTime*.6)*sin(pos.x*1.7-pos.z*2.9);
  vec4 w = modelMatrix*vec4(pos,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vC=color; gl_Position=projectionMatrix*viewMatrix*w; }`;
const WATER_FS = /* glsl */ `
precision highp float;
uniform float uTime, uFace; uniform vec3 uSun, uHorizon, uTop, uDeep, uMid, uJade, uFoam, uSea1, uSea2; uniform float uFog;
varying vec3 vW; varying vec3 vN; varying vec4 vC;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
vec3 skyCol(vec3 r){ float h=clamp(r.y,0.,1.); vec3 c=mix(uHorizon,uTop,pow(h,.55)); float s=pow(max(dot(r,uSun),0.),64.); return c+vec3(1.,.93,.8)*s*1.4; }
void main(){
  vec3 V=normalize(cameraPosition-vW); float dist=length(cameraPosition-vW);
  vec3 N0=normalize(vN); float steep=1.-clamp(N0.y,0.,1.); float onFace=smoothstep(.12,.55,steep);
  float depth=clamp(vC.b,0.,1.), thin=clamp(vC.g,0.,1.), foam=clamp(vC.r,0.,1.);
  float h=clamp((vW.y+.1)/max(uFace,.3),0.,1.);
  // directional ripples: 2 octaves of noise at ~0.6-2.5 m, stretched along the flow, weaker on the steep face and with distance
  float t=uTime; vec2 pr=vec2(vW.x*.9+t*.07, vW.z*1.5-t*.11); float e=.35;
  float r0=vnoise(pr), rx=vnoise(pr+vec2(e,0.)), rz=vnoise(pr+vec2(0.,e));
  vec2 pr2=vec2(vW.x*2.1-t*.1, vW.z*2.9+t*.15); float q0=vnoise(pr2), qx=vnoise(pr2+vec2(e,0.)), qz=vnoise(pr2+vec2(0.,e));
  vec2 g=vec2(rx-r0,rz-r0)*.22+vec2(qx-q0,qz-q0)*.1; g*=(1.-.75*onFace)/(1.+dist*.06);
  // streaks running down the face: noise stretched in the vertical
  float st=vnoise(vec2(vW.x*3.2, vW.y*.55+vW.z*.4)); float st2=vnoise(vec2(vW.x*8., vW.y*.9));
  float streak=(st*.7+st2*.3);
  vec3 N=normalize(N0+vec3(g.x,0.,g.y)+vec3((streak-.5)*.07*onFace,0.,0.));
  // foam: lumpy normal where there is foam
  float nz=fbm(vW.xz*1.9+vec2(t*.22,-t*.1)+vW.y*.7);
  N=normalize(N+vec3(vnoise(vW.xz*4.+1.)-.5,0.,vnoise(vW.zx*4.+9.)-.5)*foam*.55);
  float nv=max(dot(N,V),0.); float fres=.04+.96*pow(1.-nv,4.); fres*=mix(1.,.3,onFace*(1.-h)); fres*=mix(1.,1.7,h*onFace); fres=clamp(fres,0.,1.);
  vec3 R=reflect(-V,N); R.y=abs(R.y); vec3 sky=skyCol(R);
  float diff=clamp(dot(N,uSun)*.5+.5,0.,1.);
  float back=smoothstep(-.1,.85,-dot(uSun,V));
  // face: deep blue-teal at the trough, luminous jade toward the crest where the light passes through
  vec3 faceCol=mix(uDeep,uMid,smoothstep(0.,.5,h)); faceCol*=.82+.36*streak;
  float glow=clamp(thin*(.25+.75*back)+smoothstep(.55,1.,h)*.45*(.4+back),0.,1.);
  faceCol=mix(faceCol,uJade*(.7+.3*back),glow*.72);
  vec3 seaCol=mix(uSea1,uSea2,fbm(vW.xz*.12)); seaCol*=.85+.3*diff;
  vec3 col=mix(seaCol,faceCol,onFace); col*=1.+.15*onFace*(1.-h);
  col+=vec3(.75,.95,1.)*pow(max(dot(N,uSun),0.),3.)*.1*(.4+onFace)*(.3+h);
  col=mix(col,sky,fres*.88);
  float spec=pow(max(dot(R,uSun),0.),1600.); col+=vec3(1.,.95,.85)*spec*.7*(1.-.9*onFace);
  // whitewater: bright, broken, lumpy, soft-edged
  float f=smoothstep(.2,.62,foam*1.2+(nz-.5)*.9*clamp(foam*2.,0.,1.));
  f=clamp(f*foam*1.7+foam*foam*.4,0.,1.);
  vec3 fcol=uFoam*(.72+.28*clamp(dot(N,uSun)*.5+.55,0.,1.))*(.9+.2*nz);
  col=mix(col,fcol,f);
  float fog=1.-exp(-pow(dist*uFog,2.)); col=mix(col,uHorizon*.99,clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
}`;
const waterUniforms = () => ({uTime: {value: 0}, uFace: {value: 1.5}, uSea1: {value: new THREE.Color('#1c7c92')}, uSea2: {value: new THREE.Color('#2a93a4')}, uSun: {value: SUN}, uHorizon: {value: HORIZON}, uTop: {value: SKY_TOP}, uDeep: {value: new THREE.Color('#05294a')}, uMid: {value: new THREE.Color('#0f7388')},
  uJade: {value: new THREE.Color('#38d9a0')}, uFoam: {value: new THREE.Color('#f4f8f8')}, uFog: {value: 0.0042}});
const SKY_VS = `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.); gl_Position.z=gl_Position.w; }`;
const SKY_FS = `uniform vec3 uHorizon,uTop,uSun; varying vec3 vD; void main(){ float h=clamp(vD.y,0.,1.); vec3 c=mix(uHorizon,uTop,pow(h,.5)); c+=vec3(1.,.9,.75)*pow(max(dot(vD,uSun),0.),24.)*.5; gl_FragColor=vec4(c,1.); }`;
const SPRAY_VS = `attribute float aSize; attribute float aA; varying float vA; uniform float uScale; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uScale/max(-mv.z,.1),1.,90.); gl_Position=projectionMatrix*mv; }`;
const SPRAY_FS = `varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,0.,d); a*=a; gl_FragColor=vec4(.97,.99,1.,a*vA); }`;

const loader = new GLTFLoader();
const bandCache = new Map<string, Promise<{geom: THREE.BufferGeometry; meta: BandMeta}>>();
let surferCache: Promise<THREE.Group> | null = null;
const loadBand = (id: string) => { let p = bandCache.get(id); if (!p) {
  p = Promise.all([loader.loadAsync(LIVE_ROOT + id + '.glb'), fetch(LIVE_ROOT + id + '.json').then((r) => { if (!r.ok) throw new Error('meta'); return r.json() as Promise<BandMeta>; })]).then(([g, meta]) => {
    let geom: THREE.BufferGeometry | null = null; g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !geom) geom = (o as THREE.Mesh).geometry; });
    if (!geom) throw new Error('no mesh'); return {geom: geom as THREE.BufferGeometry, meta}; });
  p.catch(() => bandCache.delete(id)); bandCache.set(id, p); } return p; };
const loadSurfer = () => (surferCache ??= loader.loadAsync(LIVE_ROOT + 'surfer.glb').then((g) => g.scene).catch((e) => { surferCache = null; throw e; }));

/** The sea around the wave mesh: four quads framing the mesh's own footprint, so the same shader runs everywhere and there is no seam or edge. */
function surroundGeometry(b: THREE.Box3, far = 2600): THREE.BufferGeometry {
  const x0 = b.min.x, x1 = b.max.x, z0 = b.min.z, z1 = b.max.z, F = far, P: number[] = [], quad = (ax: number, az: number, bx: number, bz: number) => { P.push(ax, 0, az, bx, 0, az, bx, 0, bz, ax, 0, az, bx, 0, bz, ax, 0, bz); };
  quad(-F, -F, F, z0); quad(-F, z1, F, F); quad(-F, z0, x0, z1); quad(x1, z0, F, z1);
  const pos = new Float32Array(P), n = pos.length / 3, nrm = new Float32Array(n * 3), col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) nrm[i * 3 + 1] = 1;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  // winding: make every triangle face up
  const idx: number[] = []; for (let i = 0; i < n; i += 3) { const ax = pos[i * 3], az = pos[i * 3 + 2], bx = pos[(i + 1) * 3], bz = pos[(i + 1) * 3 + 2], cx = pos[(i + 2) * 3], cz = pos[(i + 2) * 3 + 2]; const cr = (bx - ax) * (cz - az) - (bz - az) * (cx - ax); idx.push(...(cr < 0 ? [i, i + 1, i + 2] : [i, i + 2, i + 1])); }
  g.setIndex(idx); return g;
}

const N_LIP = 1100, N_MIST = 220, SPRAY_N = N_LIP + N_MIST;
interface Spray {pts: THREE.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; size: Float32Array; alpha: Float32Array; lip: Float32Array; mist: Float32Array; n: number}

export function WaveLive({band, poster, alt, onReady, onFail, board}: {band: string; poster: string; alt: string; onReady?: () => void; onFail?: () => void; board?: LiveBoard | null}) {
  const host = useRef<HTMLDivElement>(null), api = useRef<{setBand: (id: string) => void} | null>(null), cb = useRef({onReady, onFail});
  cb.current = {onReady, onFail};
  const [live, setLive] = useState(false);
  const boardRef = useRef(board); boardRef.current = board; // TODO(quiver hook): apply boardRef.current.object3d() to the surfer when the quiver exposes boardOutline
  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'}); } catch { cb.current.onFail?.(); return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2); renderer.setPixelRatio(dpr); renderer.setClearColor(HORIZON);
    const canvas = renderer.domElement; canvas.className = 'live-canvas'; canvas.setAttribute('aria-hidden', 'true'); el.appendChild(canvas);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 4 / 3, 0.1, 6000);
    const uniforms = waterUniforms(), mat = new THREE.ShaderMaterial({uniforms, vertexShader: WATER_VS, fragmentShader: WATER_FS, side: THREE.DoubleSide});
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 24, 12), new THREE.ShaderMaterial({uniforms: {uHorizon: uniforms.uHorizon, uTop: uniforms.uTop, uSun: uniforms.uSun}, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false}));
    sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
    scene.add(new THREE.HemisphereLight(0xdfeaf2, 0x2b5d70, 1.1)); const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.copy(SUN).multiplyScalar(50); scene.add(sun);
    const group = new THREE.Group(); scene.add(group);
    let waveMesh: THREE.Mesh | null = null, sea: THREE.Mesh | null = null, surfer: THREE.Object3D | null = null, spray: Spray | null = null, current = '', token = 0, disposed = false;
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.minPolarAngle = THREE.MathUtils.degToRad(10); controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
    controls.minDistance = 2.2; controls.maxDistance = 70; controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.9; controls.touches = {ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE};
    const sync = () => { const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)); el.dataset.az = String(Math.round(THREE.MathUtils.radToDeg(s.theta) * 10) / 10); el.dataset.polar = String(Math.round(THREE.MathUtils.radToDeg(s.phi) * 10) / 10); el.dataset.dist = String(Math.round(s.radius * 100) / 100); };
    controls.addEventListener('change', sync);
    const size = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); (spMat.uniforms.uScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))); };
    const spMat = new THREE.ShaderMaterial({uniforms: {uScale: {value: 600}}, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false});
    const ro = new ResizeObserver(size); ro.observe(el);

    const clear = () => { if (waveMesh) { group.remove(waveMesh); waveMesh.geometry.dispose(); /* frees the GPU copy; the parsed data stays cached for a quick switch back */ } if (sea) { group.remove(sea); sea.geometry.dispose(); sea = null; } if (surfer) { group.remove(surfer); surfer = null; } if (spray) { group.remove(spray.pts); spray.pts.geometry.dispose(); spray = null; } };
    const makeSpray = (geom: THREE.BufferGeometry, faceM: number): Spray | null => {
      // Emitters come from the mesh itself: a thin feathering fan where the lip is thin and high, and a low mist cloud on the whitewater.
      const p = geom.getAttribute('position'), c = geom.getAttribute('color'), lip: number[] = [], mist: number[] = [];
      for (let i = 0; i < p.count; i++) { const r = c.getX(i), g = c.getY(i), y = p.getY(i); if (g > 0.4 && y > faceM * 0.62) lip.push(p.getX(i), y, p.getZ(i)); else if (r > 0.5 && y < faceM * 0.45 && y > -0.1) mist.push(p.getX(i), y, p.getZ(i)); }
      if (lip.length < 9 && mist.length < 9) return null;
      const n = SPRAY_N, pos = new Float32Array(n * 3), life = new Float32Array(n), size = new Float32Array(n), alpha = new Float32Array(n), vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) life[i] = Math.random() * 1.4;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1));
      const pts = new THREE.Points(g, spMat); pts.frustumCulled = false; return {pts, pos, vel, life, size, alpha, lip: new Float32Array(lip), mist: new Float32Array(mist), n};
    };
    const stepSpray = (sp: Spray, dt: number, face: number) => {
      for (let i = 0; i < sp.n; i++) {
        const isMist = i >= N_LIP, src = isMist ? sp.mist : sp.lip, m = src.length / 3; if (!m) { sp.alpha[i] = 0; continue; }
        sp.life[i] -= dt;
        if (sp.life[i] <= 0) {
          const k = (Math.random() * m | 0) * 3, j = i * 3, sc = isMist ? 0.9 : 0.12;
          sp.pos[j] = src[k] + (Math.random() - .5) * sc; sp.pos[j + 1] = src[k + 1] + Math.random() * (isMist ? .35 : .05); sp.pos[j + 2] = src[k + 2] + (Math.random() - .5) * sc;
          if (isMist) { sp.vel[j] = (Math.random() - .5) * .25; sp.vel[j + 1] = .08 + Math.random() * .25; sp.vel[j + 2] = (Math.random() - .5) * .25; sp.life[i] = 1.6 + Math.random() * 1.6; sp.size[i] = .5 + Math.random() * .7; }
          else { sp.vel[j] = (Math.random() - .5) * .5; sp.vel[j + 1] = (.15 + Math.random() * .7) * (0.7 + face * .12); sp.vel[j + 2] = -(.2 + Math.random() * .9); sp.life[i] = .5 + Math.random() * .8; sp.size[i] = .035 + Math.random() * .08; }
        }
        const j = i * 3; if (!isMist) sp.vel[j + 1] -= 3.0 * dt; sp.pos[j] += sp.vel[j] * dt; sp.pos[j + 1] += sp.vel[j + 1] * dt; sp.pos[j + 2] += sp.vel[j + 2] * dt;
        const t = Math.max(0, sp.life[i]);
        if (isMist) { sp.alpha[i] = Math.min(1, t * 0.9) * Math.min(1, (3.2 - t) * 1.2) * 0.13; sp.size[i] *= 1 + dt * .25; }
        else sp.alpha[i] = Math.min(1, t * 2.2) * Math.min(1, (1.3 - t) * 4) * 0.32;
      }
      const g = sp.pts.geometry; (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aA') as THREE.BufferAttribute).needsUpdate = true;
    };
    let faceM = 1.5, placed = false;
    const setBand = async (id: string) => {
      if (id === current) return; current = id; const my = ++token;
      try {
        const [{geom, meta}, surf] = await Promise.all([loadBand(id), loadSurfer()]); if (disposed || my !== token) return;
        clear(); faceM = meta.face_m; uniforms.uFace.value = meta.face_m;
        waveMesh = new THREE.Mesh(geom, mat); group.add(waveMesh); geom.computeBoundingBox(); sea = new THREE.Mesh(surroundGeometry(geom.boundingBox!), mat); group.add(sea);
        surfer = surf.clone(true); surfer.matrixAutoUpdate = false; surfer.matrix.fromArray(meta.surfer_matrix_colmajor); surfer.matrixWorldNeedsUpdate = true; group.add(surfer);
        surfer.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && 'emissiveIntensity' in m) { m.emissiveIntensity = 0.15; } });
        spray = makeSpray(geom, meta.face_m); if (spray) group.add(spray.pts);
        const sx = meta.surfer_matrix_colmajor[12], d = 6 + meta.face_m * 2.5;
        if (!placed) { placed = true; const tx = sx + meta.pocket_m * 0.3; camera.position.set(tx - d * 0.25, meta.face_m * 1.4 + 1.9, -d); controls.target.set(tx, meta.face_m * 0.75, 0); }
        else { const off = camera.position.clone().sub(controls.target); controls.target.set(sx - 0.3, meta.face_m * 0.5, 0); camera.position.copy(controls.target).add(off); }
        controls.update(); sync(); el.dataset.surfer = JSON.stringify(new THREE.Box3().setFromObject(surfer).min.toArray().concat(new THREE.Box3().setFromObject(surfer).max.toArray()).map((n) => Math.round(n * 100) / 100)); setLive(true); cb.current.onReady?.();
      } catch { if (!disposed && my === token) cb.current.onFail?.(); }
    };
    api.current = {setBand: (id) => { void setBand(id); }};

    // render loop: only while visible and the tab is shown
    let frames = 0, statAt = performance.now(), visible = true, raf = 0, last = performance.now(), t0 = last;
    const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); }); io.observe(el);
    const frame = (now: number) => {
      raf = 0; if (disposed || !visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; uniforms.uTime.value = (now - t0) / 1000;
      controls.update(); if (spray) stepSpray(spray, dt, faceM); renderer.render(scene, camera); frames++; if (now - statAt > 1000) { el.dataset.fps = String(Math.round(frames * 1000 / (now - statAt))); el.dataset.geoms = String(renderer.info.memory.geometries); el.dataset.textures = String(renderer.info.memory.textures); frames = 0; statAt = now; } raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const vis = () => { if (!document.hidden) kick(); }; document.addEventListener('visibilitychange', vis);
    size(); void setBand(band); kick();
    const onLost = (e: Event) => { e.preventDefault(); cb.current.onFail?.(); }; canvas.addEventListener('webglcontextlost', onLost);
    return () => {
      disposed = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); canvas.removeEventListener('webglcontextlost', onLost); controls.dispose();
      clear(); mat.dispose(); spMat.dispose(); sky.geometry.dispose(); (sky.material as THREE.Material).dispose(); renderer.dispose(); canvas.remove(); api.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLive(false); api.current?.setBand(band); }, [band]);
  return (
    <div className={'live' + (live ? ' is-live' : '')} data-state={live ? 'live' : 'loading'} data-band={band} role="group" aria-label={`3D view, ${alt}. Drag to orbit, scroll or pinch to zoom.`}>
      <img className="live-poster" src={poster} alt="" aria-hidden="true" draggable={false} />
      <div ref={host} className="live-host" />
    </div>
  );
}
export default WaveLive;
