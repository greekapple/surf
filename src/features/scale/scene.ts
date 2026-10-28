// Imperative three.js scene for the Wave Scale. React owns the controls; this owns the canvas.
// Production assets: set VITE_WAVE_GLB / VITE_SURFER_GLB to Blender-exported GLB files (metres,
// +Y up, wave travelling +Z, trough at y = 0, 1 unit = 1 m). Without them, procedural fallbacks render.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

export const FT = 0.3048;
export const SURFER_M = 1.78;
export type Mode = 'ride' | 'paddle';
export type View = 'front' | 'profile' | 'above' | 'free';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cross-sections at unit height (z = toward shore, y = up). The breaking section throws a lip
// forward over a hollow face; the shoulder section is an unbroken, rounded swell.
const BREAK = [[-7, 0], [-4, 0.16], [-2, 0.55], [-0.8, 0.9], [0, 1], [0.32, 0.96], [0.52, 0.84], [0.6, 0.7], [0.5, 0.6], [0.4, 0.5], [0.52, 0.3], [0.8, 0.12], [1.2, 0.03], [1.8, 0], [6, 0]];
const SHOULDER = [[-7, 0], [-4, 0.18], [-2, 0.6], [-0.7, 0.94], [0, 1], [0.5, 0.95], [0.95, 0.8], [1.25, 0.6], [1.5, 0.42], [1.85, 0.24], [2.3, 0.1], [2.9, 0.03], [3.6, 0], [4.8, 0], [6, 0]];
const NZ = 96, NX = 150, XMIN = -34, XMAX = 34, XS = 5;
const sample = (pts: number[][]) => new THREE.CatmullRomCurve3(pts.map(([z, y]) => new THREE.Vector3(z, y, 0)), false, 'centripetal').getSpacedPoints(NZ - 1);
const UB = sample(BREAK), US = sample(SHOULDER);
const CREST = UB.reduce((b, p, i) => (p.y > UB[b].y ? i : b), 0);
/** Peak tapering to a shoulder; `peel` 0 = breaking section, 1 = unbroken shoulder. */
// Ends taper smoothly into the sea so the mesh never shows a cut cross-section.
const heightAt = (x: number, H: number) => H * (0.6 + 0.4 * Math.exp(-((x / 11) ** 2))) * (1 - THREE.MathUtils.smoothstep(Math.abs(x), 20, XMAX));
const peelAt = (x: number) => THREE.MathUtils.smoothstep(x, -6, 14);
const unitAt = (j: number, x: number, out: THREE.Vector3) => out.copy(UB[j]).lerp(US[j], peelAt(x));

export interface SceneState {ft: number; mode: Mode; view: View}
export interface Tags {face: HTMLElement; person: HTMLElement}

export class WaveScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  controls: OrbitControls;
  private waveGeo = new THREE.BufferGeometry();
  private pos = new Float32Array(NX * NZ * 3);
  private col = new Float32Array(NX * NZ * 3);
  private wave: THREE.Mesh;
  private surfer = new THREE.Group();
  private rider: THREE.Group;
  private paddler: THREE.Group;
  private dimGeo = new THREE.BufferGeometry().setFromPoints(Array.from({length: 6}, () => new THREE.Vector3()));
  private cur: number;
  private tween: {fromP: THREE.Vector3; fromT: THREE.Vector3; toP: THREE.Vector3; toT: THREE.Vector3; t0: number} | null = null;
  private dirty = true;
  private raf = 0;
  private last = performance.now();
  private ro: ResizeObserver;
  frames = 0;
  customWave = false;
  customSurfer = false;
  onFree?: () => void;

  constructor(private stage: HTMLElement, canvas: HTMLCanvasElement, private tags: Tags, public s: SceneState) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'default'});
    const r = this.renderer;
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cur = s.ft;

    const sc = this.scene;
    sc.background = new THREE.Color(0x0b1822);
    sc.fog = new THREE.Fog(0x0b1822, 50, 180);
    sc.add(new THREE.HemisphereLight(0xcfe6ff, 0x0b2a3d, 0.95));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2);
    sun.position.set(18, 30, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
    Object.assign(sun.shadow.camera, {left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90});
    sc.add(sun);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshPhysicalMaterial({color: 0x0f3e58, roughness: 0.3, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25}));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.01;
    sea.receiveShadow = true;
    sc.add(sea);

    this.waveGeo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.waveGeo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const idx: number[] = [];
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NZ - 1; j++) { const a = i * NZ + j, b = a + NZ; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    this.waveGeo.setIndex(idx);
    // Physical water: vertex colour for depth/foam, clearcoat for the glassy face, sheen at grazing angles.
    // FrontSide: double-sided rendering depth-fights where the lip folds back over the face.
    this.wave = new THREE.Mesh(this.waveGeo, new THREE.MeshPhysicalMaterial({vertexColors: true, roughness: 0.22, metalness: 0.02, clearcoat: 0.8, clearcoatRoughness: 0.18, sheen: 0.5, sheenColor: new THREE.Color(0x9fdcf5), side: THREE.FrontSide}));
    sc.add(this.wave);

    this.rider = riderFigure();
    this.paddler = paddlerFigure();
    this.surfer.add(makeBoard(), this.rider, this.paddler);
    sc.add(this.surfer);
    sc.add(new THREE.LineSegments(this.dimGeo, new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.85})));

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {enableDamping: true, dampingFactor: 0.08, minDistance: 4, maxDistance: 90, maxPolarAngle: Math.PI * 0.495});
    this.controls.addEventListener('start', () => { this.tween = null; this.s.view = 'free'; this.onFree?.(); });
    this.controls.addEventListener('change', () => (this.dirty = true));

    this.build(this.cur * FT);
    this.place(this.cur * FT);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(stage);
    this.resize();
    this.goTo(s.view === 'free' ? 'front' : s.view, false);
    this.raf = requestAnimationFrame(this.loop);
    void this.loadModels();
  }

  /** Replace procedural parts with production GLB files when configured. */
  private async loadModels() {
    const waveUrl = import.meta.env.VITE_WAVE_GLB as string | undefined, surferUrl = import.meta.env.VITE_SURFER_GLB as string | undefined;
    if (!waveUrl && !surferUrl) return;
    const {GLTFLoader} = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const load = (url: string) => loader.loadAsync(url).then((g) => g.scene).catch(() => null);
    if (waveUrl) { const m = await load(waveUrl); if (m) { this.wave.visible = false; this.scene.add(m); this.customWave = true; } }
    if (surferUrl) { const m = await load(surferUrl); if (m) { this.rider.visible = this.paddler.visible = false; this.surfer.add(m); this.customSurfer = true; } }
    this.dirty = true;
  }

  private build(Hm: number) {
    const C_DEEP = new THREE.Color(0x082f48), C_MID = new THREE.Color(0x1a6a93), C_TOP = new THREE.Color(0x76c3e4), C_FOAM = new THREE.Color(0xeef7fb);
    const c = new THREE.Color(), p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < NX; i++) {
      const x = XMIN + ((XMAX - XMIN) * i) / (NX - 1), h = heightAt(x, Hm), peel = peelAt(x);
      for (let j = 0; j < NZ; j++) {
        unitAt(j, x, p);
        const k = (i * NZ + j) * 3;
        this.pos[k] = x; this.pos[k + 1] = p.y * h; this.pos[k + 2] = p.z * h;
        const t = p.y;
        c.copy(C_DEEP).lerp(C_MID, Math.min(1, t * 1.6));
        if (t > 0.55) c.lerp(C_TOP, (t - 0.55) / 0.45);
        // Thin translucent band just below the lip on the breaking section.
        if (j > CREST && t > 0.45 && t < 0.75) c.lerp(C_TOP, 0.35 * (1 - peel));
        // Whitewater at the lip on the breaking section; fades out toward the shoulder.
        if (j >= CREST - 2 && j <= CREST + NZ * 0.1 && t > 0.6) c.lerp(C_FOAM, Math.min(1, (t - 0.6) / 0.28) * 0.75 * (1 - peel));
        // Foam line on the flats in front of the breaking peak.
        if (j > NZ * 0.66) { unitAt(j - 1, x, q); if (q.y < 0.04) c.lerp(C_FOAM, 0.22 * (1 - peel) * Math.exp(-((j - NZ * 0.72) ** 2) / 20)); }
        this.col[k] = c.r; this.col[k + 1] = c.g; this.col[k + 2] = c.b;
      }
    }
    this.waveGeo.attributes.position.needsUpdate = true;
    this.waveGeo.attributes.color.needsUpdate = true;
    this.waveGeo.computeVertexNormals();
    this.waveGeo.computeBoundingSphere();
  }

  private frontPoint(fraction: number) {
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let j = CREST; j < NZ - 1; j++) {
      unitAt(j, XS, v);
      if (v.y <= fraction) { unitAt(j - 1, XS, a); unitAt(j + 1, XS, b); return {p: v, slope: (b.y - a.y) / (b.z - a.z || 1e-6)}; }
    }
    return {p: unitAt(NZ - 1, XS, v), slope: 0};
  }

  private place(Hm: number) {
    const h = heightAt(XS, Hm), ride = this.s.mode === 'ride';
    if (!this.customSurfer) { this.rider.visible = ride; this.paddler.visible = !ride; }
    if (ride) {
      const {p, slope} = this.frontPoint(0.42), tilt = Math.atan(slope);
      this.surfer.position.set(XS, p.y * h + 0.02, p.z * h);
      this.surfer.rotation.set(-tilt * 0.9, 0, 0);
      this.rider.rotation.set(tilt * 0.6, 0, 0);
    } else {
      this.surfer.position.set(XS - 2, 0, 1.8 * h + 2.2);
      this.surfer.rotation.set(0, Math.PI / 2, 0);
    }
    const x = XS + 2.4, zc = UB[CREST].z * h, P = this.dimGeo.attributes.position as THREE.BufferAttribute;
    P.setXYZ(0, x, 0, zc); P.setXYZ(1, x, h, zc); P.setXYZ(2, x - 0.35, h, zc); P.setXYZ(3, x + 0.35, h, zc); P.setXYZ(4, x - 0.35, 0, zc); P.setXYZ(5, x + 0.35, 0, zc);
    P.needsUpdate = true;
  }

  private viewFor(name: View, Hm: number) {
    const h = heightAt(XS, Hm), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    if (this.s.mode === 'paddle' && name === 'front') { const zp = 1.8 * h + 2.2; return {pos: V(XS + 2, 1.5 + 0.18 * h, zp + 5 + 0.5 * h), target: V(XS - 1, 0.4 * h, 0.4 * h)}; }
    // From the channel beyond the tapered shoulder, looking back along the crest at the peak's silhouette.
    if (name === 'profile') return {pos: V(XS + 12 + 1.6 * h, 0.9 * h + 1.6, 1.2 * h + 4), target: V(XS, 0.5 * h, 0.25 * h)};
    if (name === 'above') return {pos: V(XS + 9 + h, 2.1 * h + 7, 2.3 * h + 12), target: V(XS, 0.3 * h, 0.2 * h)};
    return {pos: V(XS + 3, 1.6 + 0.22 * h, 1.9 * h + 8), target: V(XS, 0.48 * h, 0.3 * h)};
  }

  goTo(name: Exclude<View, 'free'>, animate = true) {
    this.s.view = name;
    const v = this.viewFor(name, this.s.ft * FT);
    if (!animate || reduced()) { this.camera.position.copy(v.pos); this.controls.target.copy(v.target); this.controls.update(); this.tween = null; this.dirty = true; return; }
    this.tween = {fromP: this.camera.position.clone(), fromT: this.controls.target.clone(), toP: v.pos, toT: v.target, t0: performance.now()};
  }

  set(next: Partial<SceneState>) {
    const modeChanged = next.mode && next.mode !== this.s.mode;
    Object.assign(this.s, next);
    if (modeChanged) { this.place(this.cur * FT); if (this.s.view !== 'free') this.goTo(this.s.view); }
    this.dirty = true;
  }

  private projectTag(el: HTMLElement, x: number, y: number, z: number, text: string) {
    const v = new THREE.Vector3(x, y, z).project(this.camera), r = this.stage.getBoundingClientRect();
    el.style.opacity = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 ? '1' : '0';
    el.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height - 6}px) translate(-50%, -100%)`;
    el.textContent = text;
  }

  fmt = (ft: number, unit: 'ft' | 'm') => (unit === 'm' ? `${(ft * FT).toFixed(1)} m` : `${Number.isInteger(ft) ? ft : ft.toFixed(1)} ft`);
  unit: 'ft' | 'm' = 'ft';

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (Math.abs(this.cur - this.s.ft) > 0.002) {
      this.cur = reduced() ? this.s.ft : this.cur + (this.s.ft - this.cur) * (1 - Math.exp(-dt * 9));
      this.build(this.cur * FT);
      this.place(this.cur * FT);
      if (this.s.view !== 'free' && !this.tween) { const v = this.viewFor(this.s.view, this.cur * FT); this.camera.position.lerp(v.pos, 0.18); this.controls.target.lerp(v.target, 0.18); }
      this.dirty = true;
    }
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.t0) / 700), e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.tween.fromP, this.tween.toP, e);
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, e);
      if (t >= 1) this.tween = null;
      this.dirty = true;
    }
    if (this.controls.update()) this.dirty = true;
    if (this.dirty && !document.hidden) {
      this.renderer.render(this.scene, this.camera);
      const h = heightAt(XS, this.cur * FT), sp = this.surfer.position;
      this.projectTag(this.tags.face, XS + 2.4, h, UB[CREST].z * h, `${this.fmt(this.cur, this.unit)} face`);
      this.projectTag(this.tags.person, sp.x, sp.y + (this.s.mode === 'ride' ? 1.75 : 0.65), sp.z, this.s.mode === 'ride' ? 'Surfer 5′10″' : 'Paddling 5′10″');
      this.dirty = false;
      this.frames++;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private resize() {
    const r = this.stage.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / Math.max(1, r.height);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
  }
}

/* ---------- Procedural fallbacks (replace with GLB for production) ---------- */
function makeBoard() {
  // 6'0" x 19 1/4" outline in metres, extruded to 2 1/2" with a rounded rail.
  const s = new THREE.Shape();
  s.moveTo(-0.915, -0.16); s.lineTo(-0.915, 0.16);
  s.bezierCurveTo(-0.5, 0.25, 0.2, 0.26, 0.5, 0.2);
  s.bezierCurveTo(0.75, 0.13, 0.88, 0.04, 0.915, 0);
  s.bezierCurveTo(0.88, -0.04, 0.75, -0.13, 0.5, -0.2);
  s.bezierCurveTo(0.2, -0.26, -0.5, -0.25, -0.915, -0.16);
  const g = new THREE.ExtrudeGeometry(s, {depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 4, curveSegments: 28});
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({color: 0xf4f1ea, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1}));
  m.castShadow = true;
  return m;
}
const SUIT = new THREE.MeshStandardMaterial({color: 0x15191d, roughness: 0.55});
const SKIN = new THREE.MeshStandardMaterial({color: 0xc49474, roughness: 0.7});
const UP = new THREE.Vector3(0, 1, 0);
type P3 = [number, number, number];
/** Tapered limb: a lathe between two radii, so thighs and forearms narrow naturally. */
function limb(g: THREE.Group, a: P3, b: P3, r0: number, r1 = r0 * 0.8, mat = SUIT) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry((r0 + r1) / 2, Math.max(0.01, len), 6, 14), mat);
  const geo = m.geometry as THREE.BufferGeometry, p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const t = THREE.MathUtils.clamp(p.getY(i) / len + 0.5, 0, 1), k = (r0 + (r1 - r0) * t) / ((r0 + r1) / 2); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  geo.computeVertexNormals();
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  g.add(m);
}
function ball(g: THREE.Group, p: P3, r: number, mat: THREE.Material, sy = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
  m.position.set(...p); m.scale.y = sy; m.castShadow = true; g.add(m);
}
function torso(g: THREE.Group, hip: P3, chest: P3) {
  // Lathe profile: hips → waist → chest → shoulders.
  const prof = [[0.0, 0], [0.13, 0.02], [0.14, 0.12], [0.12, 0.24], [0.15, 0.38], [0.17, 0.46], [0.12, 0.52], [0.05, 0.56]].map(([r, y]) => new THREE.Vector2(r, y));
  const A = new THREE.Vector3(...hip), B = new THREE.Vector3(...chest), d = B.clone().sub(A);
  const geo = new THREE.LatheGeometry(prof, 20);
  geo.scale(1, d.length() / 0.56, 0.7);
  const m = new THREE.Mesh(geo, SUIT);
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.castShadow = true;
  g.add(m);
}
// Joints in board space (x along the board, y up, z across). Standing height 1.78 m, compressed stance.
function riderFigure() {
  const g = new THREE.Group(), d = 0.06;
  ball(g, [-0.3, d + 0.03, 0.02], 0.05, SUIT, 0.6); ball(g, [0.32, d + 0.03, -0.02], 0.05, SUIT, 0.6);
  limb(g, [-0.3, d + 0.04, 0.02], [-0.22, d + 0.44, 0.05], 0.05, 0.065); limb(g, [-0.22, d + 0.44, 0.05], [0, d + 0.82, 0.02], 0.068, 0.09);
  limb(g, [0.32, d + 0.04, -0.02], [0.4, d + 0.42, 0.0], 0.05, 0.065); limb(g, [0.4, d + 0.42, 0.0], [0.04, d + 0.82, -0.02], 0.068, 0.09);
  torso(g, [0.02, d + 0.78, 0], [0.16, d + 1.36, 0]);
  limb(g, [0.15, d + 1.3, 0.17], [0.42, d + 1.12, 0.29], 0.05, 0.042); limb(g, [0.42, d + 1.12, 0.29], [0.7, d + 1.02, 0.31], 0.04, 0.032);
  limb(g, [0.15, d + 1.3, -0.17], [-0.16, d + 1.1, -0.25], 0.05, 0.042); limb(g, [-0.16, d + 1.1, -0.25], [-0.4, d + 0.95, -0.27], 0.04, 0.032);
  ball(g, [0.73, d + 1.01, 0.31], 0.04, SKIN, 1.2); ball(g, [-0.43, d + 0.94, -0.27], 0.04, SKIN, 1.2);
  limb(g, [0.17, d + 1.38, 0], [0.19, d + 1.46, 0], 0.045, 0.045, SKIN);
  ball(g, [0.21, d + 1.56, 0], 0.1, SKIN, 1.15);
  return g;
}
function paddlerFigure() {
  const g = new THREE.Group(), d = 0.07;
  torso(g, [-0.2, d + 0.14, 0], [0.4, d + 0.22, 0]);
  limb(g, [-0.2, d + 0.11, 0.09], [-0.62, d + 0.1, 0.1], 0.068, 0.058); limb(g, [-0.62, d + 0.1, 0.1], [-1.0, d + 0.14, 0.1], 0.052, 0.04);
  limb(g, [-0.2, d + 0.11, -0.09], [-0.62, d + 0.1, -0.1], 0.068, 0.058); limb(g, [-0.62, d + 0.1, -0.1], [-1.0, d + 0.14, -0.1], 0.052, 0.04);
  limb(g, [0.38, d + 0.24, 0.17], [0.6, d + 0.06, 0.32], 0.05, 0.042); limb(g, [0.6, d + 0.06, 0.32], [0.72, -0.24, 0.34], 0.04, 0.032);
  limb(g, [0.38, d + 0.24, -0.17], [0.3, d + 0.09, -0.33], 0.05, 0.042); limb(g, [0.3, d + 0.09, -0.33], [0.06, -0.2, -0.35], 0.04, 0.032);
  ball(g, [0.62, d + 0.36, 0], 0.1, SKIN, 1.15);
  return g;
}
