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
const HORIZON = new THREE.Color('#e8edf0'), SKY_TOP = new THREE.Color('#b9cfe0');

const WATER_VS = /* glsl */ `
attribute vec4 color; varying vec3 vW; varying vec3 vN; varying vec4 vC;
void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vC=color; gl_Position=projectionMatrix*viewMatrix*w; }`;
const WATER_FS = /* glsl */ `
precision highp float;
uniform float uTime; uniform vec3 uSun, uHorizon, uTop, uDeep, uMid, uJade, uFoam; uniform float uFog;
varying vec3 vW; varying vec3 vN; varying vec4 vC;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
vec2 ripple(vec2 p, float t){ vec2 g=vec2(0.);
  for(int i=0;i<7;i++){ float fi=float(i); float ang=fi*2.399+0.6; vec2 d=vec2(cos(ang),sin(ang)); float fr=2.2+fi*2.6; float sp=.5+fi*.18; float am=0.018/(1.+fi*.9);
    g+=d*fr*am*cos(dot(d,p)*fr+t*sp+fi*1.7); }
  return g; }
vec3 skyCol(vec3 r){ float h=clamp(r.y,0.,1.); vec3 c=mix(uHorizon,uTop,pow(h,.55)); float s=pow(max(dot(r,uSun),0.),64.); return c+vec3(1.,.93,.8)*s*1.4; }
void main(){
  vec3 V=normalize(cameraPosition-vW); float dist=length(cameraPosition-vW);
  vec3 N=normalize(vN); vec2 g=ripple(vW.xz, uTime)*(1./(1.+dist*0.09)); N=normalize(N+vec3(g.x,0.,g.y)*(1.-0.6*clamp(vC.r,0.,1.)));
  float nv=max(dot(N,V),0.); float fres=.05+.95*pow(1.-nv,4.);
  vec3 R=reflect(-V,N); R.y=abs(R.y); vec3 sky=skyCol(R);
  float depth=clamp(vC.b,0.,1.), thin=clamp(vC.g,0.,1.), foam=clamp(vC.r,0.,1.);
  vec3 body=mix(uMid,uDeep,clamp(smoothstep(0.,.5,depth)*.8+.35*(1.-nv),0.,1.));
  float diff=clamp(dot(N,uSun)*.5+.5,0.,1.);
  float back=smoothstep(-.1,.85,-dot(uSun,V));
  vec3 col=body*(.55+.55*diff)+uTop*.05;
  col=mix(col,uJade*(.55+.45*back),clamp(thin*(.15+.85*back),0.,1.)*.32); col+=uJade*.12*(1.-depth)*(.35+back);
  col=mix(col,sky,fres*.92);
  float spec=pow(max(dot(R,uSun),0.),900.); col+=vec3(1.,.95,.85)*spec*3.;
  float nz=fbm(vW.xz*1.7+vec2(uTime*.25,-uTime*.12));
  float f=smoothstep(.28,.62,foam*1.25+(nz-.5)*.7*foam+foam*foam*.4)*foam;
  f=clamp(f*1.5,0.,1.);
  col=mix(col,uFoam*(.7+.3*diff),f);
  float fog=1.-exp(-pow(dist*uFog,2.)); col=mix(col,uHorizon*.99,clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
}`;
const waterUniforms = () => ({uTime: {value: 0}, uSun: {value: SUN}, uHorizon: {value: HORIZON}, uTop: {value: SKY_TOP}, uDeep: {value: new THREE.Color('#0a4a66')}, uMid: {value: new THREE.Color('#1a8f93')},
  uJade: {value: new THREE.Color('#3fe0a4')}, uFoam: {value: new THREE.Color('#f4f8f8')}, uFog: {value: 0.0042}});
const SKY_VS = `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.); gl_Position.z=gl_Position.w; }`;
const SKY_FS = `uniform vec3 uHorizon,uTop,uSun; varying vec3 vD; void main(){ float h=clamp(vD.y,0.,1.); vec3 c=mix(uHorizon,uTop,pow(h,.5)); c+=vec3(1.,.9,.75)*pow(max(dot(vD,uSun),0.),24.)*.5; gl_FragColor=vec4(c,1.); }`;
const SPRAY_VS = `attribute float aSize; attribute float aA; varying float vA; uniform float uScale; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/max(-mv.z,.1); gl_Position=projectionMatrix*mv; }`;
const SPRAY_FS = `varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,0.,d); a*=a; gl_FragColor=vec4(.96,.98,.99,a*vA*.4); }`;

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

const SPRAY_N = 520;
interface Spray {pts: THREE.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; size: Float32Array; alpha: Float32Array; src: Float32Array; n: number}

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
    const size = () => { const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); (spMat.uniforms.uScale.value = h * dpr * 0.42); };
    const spMat = new THREE.ShaderMaterial({uniforms: {uScale: {value: 600}}, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false});
    const ro = new ResizeObserver(size); ro.observe(el);

    const clear = () => { if (waveMesh) { group.remove(waveMesh); waveMesh.geometry.dispose(); /* frees the GPU copy; the parsed data stays cached for a quick switch back */ } if (sea) { group.remove(sea); sea.geometry.dispose(); sea = null; } if (surfer) { group.remove(surfer); surfer = null; } if (spray) { group.remove(spray.pts); spray.pts.geometry.dispose(); spray = null; } };
    const makeSpray = (geom: THREE.BufferGeometry, faceM: number): Spray | null => {
      const p = geom.getAttribute('position'), c = geom.getAttribute('color'), src: number[] = [];
      for (let i = 0; i < p.count; i++) { const r = c.getX(i), g = c.getY(i), y = p.getY(i); if ((g > 0.45 && y > faceM * 0.55) || (r > 0.55 && y < faceM * 0.5 && y > -0.05)) src.push(p.getX(i), y, p.getZ(i)); }
      if (src.length < 9) return null;
      const n = SPRAY_N, pos = new Float32Array(n * 3), life = new Float32Array(n), size = new Float32Array(n), alpha = new Float32Array(n), vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) life[i] = Math.random() * 1.6;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aA', new THREE.BufferAttribute(alpha, 1));
      const pts = new THREE.Points(g, spMat); pts.frustumCulled = false; return {pts, pos, vel, life, size, alpha, src: new Float32Array(src), n};
    };
    const stepSpray = (sp: Spray, dt: number, face: number) => {
      const m = sp.src.length / 3;
      for (let i = 0; i < sp.n; i++) {
        sp.life[i] -= dt;
        if (sp.life[i] <= 0) { const k = (Math.random() * m | 0) * 3; sp.pos[i * 3] = sp.src[k] + (Math.random() - .5) * .25; sp.pos[i * 3 + 1] = sp.src[k + 1] + Math.random() * .1; sp.pos[i * 3 + 2] = sp.src[k + 2] + (Math.random() - .5) * .25;
          sp.vel[i * 3] = (Math.random() - .5) * .8; sp.vel[i * 3 + 1] = (.3 + Math.random() * 1.1) * (0.6 + face * .15); sp.vel[i * 3 + 2] = .4 + Math.random() * 1.2; sp.life[i] = .7 + Math.random() * 1.1; sp.size[i] = .16 + Math.random() * .3; }
        sp.vel[i * 3 + 1] -= 3.2 * dt; sp.pos[i * 3] += sp.vel[i * 3] * dt; sp.pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt; sp.pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
        const t = Math.max(0, sp.life[i]); sp.alpha[i] = Math.min(1, t * 1.4) * Math.min(1, (1.8 - t) * 3); sp.size[i] *= 1 + dt * .5;
      }
      const g = sp.pts.geometry; (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true; (g.getAttribute('aA') as THREE.BufferAttribute).needsUpdate = true;
    };
    let faceM = 1.5, placed = false;
    const setBand = async (id: string) => {
      if (id === current) return; current = id; const my = ++token;
      try {
        const [{geom, meta}, surf] = await Promise.all([loadBand(id), loadSurfer()]); if (disposed || my !== token) return;
        clear(); faceM = meta.face_m;
        waveMesh = new THREE.Mesh(geom, mat); group.add(waveMesh); geom.computeBoundingBox(); sea = new THREE.Mesh(surroundGeometry(geom.boundingBox!), mat); group.add(sea);
        surfer = surf.clone(true); surfer.matrixAutoUpdate = false; surfer.matrix.fromArray(meta.surfer_matrix_colmajor); surfer.matrixWorldNeedsUpdate = true; group.add(surfer);
        surfer.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && 'emissiveIntensity' in m) { m.emissiveIntensity = 0.15; } });
        spray = makeSpray(geom, meta.face_m); if (spray) group.add(spray.pts);
        const sx = meta.surfer_matrix_colmajor[12], d = 4.5 + meta.face_m * 2.3;
        if (!placed) { placed = true; camera.position.set(sx - d * 0.3, meta.face_m * 0.6 + 1.3, -d); controls.target.set(sx - 0.4, meta.face_m * 0.4, 0); }
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
