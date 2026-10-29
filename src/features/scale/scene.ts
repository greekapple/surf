// Imperative three.js scene for the Wave Scale. React owns the controls; this owns the canvas.
// Units: 1 unit = 1 m, +Y up, the wave travels toward +Z (the shore), the camera looks back at the face.
// The wave is a sculpted breaking-wave mesh (see wave.ts) scaled uniformly by face height; the water shader
// is in waveShader.ts. The surfer is a GLB when available (surfer.ts) with a procedural fallback.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {NZ, envAt, fillWave, makeWaveGeometry, profileAt} from './wave';
import {SKY_FRAG, SKY_VERT, SPRAY_FRAG, SPRAY_VERT, WATER_FRAG, WATER_VERT} from './waveShader';

export const FT = 0.3048;
export const SURFER_M = 1.78;
export type Mode = 'ride' | 'paddle';
export type View = 'front' | 'profile' | 'above' | 'free';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const XU = 7; // surfer's position along the crest, in face heights
const SUN = new THREE.Vector3(0.62, 0.3, -0.72).normalize();
const curlFor = (ft: number) => THREE.MathUtils.smoothstep(ft, 2.5, 7); // small waves spill instead of curling

export interface SceneState {ft: number; mode: Mode; view: View}
export interface Tags {face: HTMLElement; person: HTMLElement}

export class WaveScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 6000);
  controls: OrbitControls;
  private build = makeWaveGeometry();
  private waveGroup = new THREE.Group();
  private surfer = new THREE.Group();
  private rider: THREE.Group;
  private paddler: THREE.Group;
  private sky: THREE.Mesh;
  private shared: Record<string, THREE.IUniform>;
  private sprayU = {uTime: {value: 0}, uPx: {value: 900}, uScale: {value: 1}};
  private dimGeo = new THREE.BufferGeometry().setFromPoints(Array.from({length: 6}, () => new THREE.Vector3()));
  /** Standing-height reference (1.78 m) beside the surfer, so the figure's true size can be judged. */
  private refGeo = new THREE.BufferGeometry().setFromPoints(Array.from({length: 6}, () => new THREE.Vector3()));
  private cur: number;
  private curlBuilt = -1;
  private tween: {fromP: THREE.Vector3; fromT: THREE.Vector3; toP: THREE.Vector3; toT: THREE.Vector3; t0: number} | null = null;
  private dirty = true;
  private raf = 0;
  private last = performance.now();
  private lastDraw = 0;
  private visible = true;
  private disposed = false;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  frames = 0;
  customWave = false;
  customSurfer = false;
  onFree?: () => void;

  constructor(private stage: HTMLElement, canvas: HTMLCanvasElement, private tags: Tags, public s: SceneState) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'default'});
    const r = this.renderer;
    r.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.cur = s.ft;

    const sc = this.scene;
    this.shared = {uSun: {value: SUN}, uTime: {value: 0}, uAnim: {value: reduced() ? 0 : 1}};
    sc.background = new THREE.Color(0xd9bda8);
    // Lights are for the surfer and board only; the water shades itself.
    sc.add(new THREE.HemisphereLight(0xcfe0f2, 0x2a4048, 1.1));
    const sun = new THREE.DirectionalLight(0xffe2c0, 2.2);
    sun.position.copy(SUN).multiplyScalar(30);
    sc.add(sun);
    const fill = new THREE.DirectionalLight(0xbfd6ea, 0.9);
    fill.position.set(-6, 5, 14);
    sc.add(fill);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({uniforms: this.shared, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false}));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    sc.add(this.sky);

    const mat = (bump: number, haze: number) => new THREE.ShaderMaterial({uniforms: {...this.shared, uBump: {value: bump}, uHaze: {value: haze}}, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, side: THREE.DoubleSide});
    const seaGeo = new THREE.PlaneGeometry(6000, 6000, 1, 1);
    seaGeo.rotateX(-Math.PI / 2);
    seaGeo.setAttribute('aFoam', new THREE.BufferAttribute(new Float32Array(4), 1));
    seaGeo.setAttribute('aThin', new THREE.BufferAttribute(new Float32Array(4), 1));
    const sea = new THREE.Mesh(seaGeo, mat(0.012, 0.0016));
    sea.position.y = -0.004; sea.frustumCulled = false;
    sc.add(sea);

    this.waveGroup.add(new THREE.Mesh(this.build.geo, mat(0.1, 0.0016)));
    this.waveGroup.add(this.makeSpray());
    sc.add(this.waveGroup);

    this.rider = riderFigure();
    this.paddler = paddlerFigure();
    this.surfer.add(makeBoard(), this.rider, this.paddler);
    void this.loadSurfer();
    sc.add(this.surfer);
    sc.add(new THREE.LineSegments(this.refGeo, new THREE.LineBasicMaterial({color: 0xffd9a0, transparent: true, opacity: 0.9, depthTest: false})));
    sc.add(new THREE.LineSegments(this.dimGeo, new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false})));

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {enableDamping: true, dampingFactor: 0.08, minDistance: 3, maxDistance: 90, maxPolarAngle: Math.PI * 0.495});
    this.controls.addEventListener('start', () => { this.tween = null; this.s.view = 'free'; this.onFree?.(); });
    this.controls.addEventListener('change', () => (this.dirty = true));

    this.layout(this.cur);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(stage);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.dirty = true; });
    this.io.observe(stage);
    this.resize();
    this.goTo(s.view === 'free' ? 'front' : s.view, false);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Replace the procedural stand-in with the sculpted Blender surfer, board and paddler (scripts/blender/build_surfer.py). */
  private async loadSurfer() {
    try {
      const {GLTFLoader} = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const g = await new GLTFLoader().loadAsync((import.meta.env.BASE_URL ?? '/') + 'models/wave/surfer.glb');
      const board = g.scene.getObjectByName('board'), rider = g.scene.getObjectByName('rider'), paddler = g.scene.getObjectByName('paddler');
      if (!board || !rider || !paddler || this.disposed) return;
      this.surfer.clear();
      this.surfer.add(await this.realBoard(new GLTFLoader(), board), rider, paddler);
      this.rider = rider as THREE.Group; this.paddler = paddler as THREE.Group;
      this.leanSrc = []; this.leanAngle = NaN;
      this.seatOnDeck();
      this.customSurfer = true;
      this.place(this.cur * FT);
      this.dirty = true;
    } catch { /* keep the procedural figure */ }
  }

  private leanSrc: {geo: THREE.BufferGeometry; pos: Float32Array; nor: Float32Array}[] = [];
  private leanAngle = NaN;
  /** Counter-lean the rider about the board's long axis: soles stay on the deck (weight 0), the lean ramps in over the
   * shins and is full from the knees up, like ankles flexing. Skin-free, so vertices are bent from the rest pose. */
  private leanRider(angle: number) {
    if (Math.abs(angle - this.leanAngle) < 0.002) return;
    this.leanAngle = angle;
    if (!this.leanSrc.length) this.rider.traverse((o) => { const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null; if (g) this.leanSrc.push({geo: g, pos: Float32Array.from(g.attributes.position.array), nor: Float32Array.from(g.attributes.normal.array)}); });
    for (const {geo, pos, nor} of this.leanSrc) {
      const P = geo.attributes.position as THREE.BufferAttribute, N = geo.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const y = pos[i * 3 + 1], z = pos[i * 3 + 2], w = THREE.MathUtils.smoothstep(y, 0.07, 0.5), a = angle * w, c = Math.cos(a), s = Math.sin(a);
        P.setXYZ(i, pos[i * 3], y * c - z * s, y * s + z * c);
        const ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
        N.setXYZ(i, nor[i * 3], ny * c - nz * s, ny * s + nz * c);
      }
      P.needsUpdate = true; N.needsUpdate = true; geo.computeBoundingSphere();
    }
  }

  /** Drop the rider and paddler onto the actual board's deck: ray-cast under the soles / belly in board space, so the
   * feet touch the deck whatever the shortboard's rocker and thickness are. Roots sit at the deck; their children start at y = 0. */
  private seatOnDeck() {
    const saved = {p: this.surfer.position.clone(), r: this.surfer.rotation.clone()};
    this.surfer.position.set(0, 0, 0); this.surfer.rotation.set(0, 0, 0);
    this.surfer.updateMatrixWorld(true);
    const board = this.surfer.getObjectByName('board'), meshes: THREE.Mesh[] = [];
    board?.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const deck = (pts: [number, number][], fallback: number) => {
      let y = -Infinity;
      for (const [x, z] of pts) { rc.set(new THREE.Vector3(x, 2, z), down); const h = rc.intersectObjects(meshes, false)[0]; if (h) y = Math.max(y, h.point.y); }
      return Number.isFinite(y) ? y : fallback;
    };
    // Sole footprints (back foot across the board, front foot angled to the nose) and the prone body's contact line.
    this.rider.position.y = deck([[-0.31, -0.1], [-0.29, 0.0], [-0.27, 0.1], [0.27, -0.06], [0.32, 0.0], [0.4, 0.1]], 0.07) - 0.002;
    this.paddler.position.y = deck([[-0.3, 0], [-0.1, 0], [0.1, 0], [0.3, 0]], 0.07) - 0.002;
    this.surfer.position.copy(saved.p); this.surfer.rotation.copy(saved.r);
  }

  /** Swap the plain placeholder board for the Quiver's Blender shortboard (rocker, rails, stringer, fins), fitted to the
   * placeholder's footprint so the surfer's stance still lines up. Falls back to the placeholder on any failure. */
  private async realBoard(loader: {loadAsync: (u: string) => Promise<{scene: THREE.Group}>}, placeholder: THREE.Object3D): Promise<THREE.Object3D> {
    try {
      const g = await loader.loadAsync((import.meta.env.BASE_URL ?? '/') + 'models/boards/board-shortboard.glb');
      const real = g.scene, want = new THREE.Box3().setFromObject(placeholder), have = new THREE.Box3().setFromObject(real);
      const ws = want.getSize(new THREE.Vector3()), hs = have.getSize(new THREE.Vector3());
      // The placeholder's long axis is X or Z; the board GLB is normalised along X.
      if (ws.z > ws.x) real.rotation.y = Math.PI / 2;
      const len = Math.max(ws.x, ws.z), k = len / hs.x;
      real.scale.setScalar(k);
      const fitted = new THREE.Box3().setFromObject(real), c = want.getCenter(new THREE.Vector3()), fc = fitted.getCenter(new THREE.Vector3());
      real.position.add(new THREE.Vector3(c.x - fc.x, want.min.y - fitted.min.y, c.z - fc.z));
      real.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; const mat = m.material as THREE.MeshStandardMaterial; if (mat && /deck|bottom|board/i.test(mat.name || m.name)) { mat.color?.set('#f4efe6'); } } });
      const wrap = new THREE.Group(); wrap.add(real); wrap.name = 'board';
      return wrap;
    } catch { return placeholder; }
  }

  /** Spray: soft points thrown from the lip tip, the whitewater and the toe of the wave (unit space). */
  private makeSpray() {
    const N = 700, pos = new Float32Array(N * 3), seed = new Float32Array(N * 4), vel = new Float32Array(N * 3), tmp = new Float32Array(NZ * 4);
    const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646; })();
    for (let i = 0; i < N; i++) {
      const kind = rnd(), x = kind < 0.45 ? -8 + rnd() * 10 : kind < 0.85 ? -17 + rnd() * 10 : -4 + rnd() * 9;
      profileAt(x, 1, tmp);
      const j = kind < 0.45 ? 55 + Math.floor(rnd() * 4) : kind < 0.85 ? 52 + Math.floor(rnd() * 20) : 80 + Math.floor(rnd() * 14);
      pos.set([x, tmp[j * 4 + 1] + 0.02, tmp[j * 4]], i * 3);
      const mist = rnd() < 0.22;
      vel.set([(rnd() - 0.5) * 0.25, (kind < 0.45 ? 0.14 : 0.22) + rnd() * 0.38, 0.1 + rnd() * 0.3], i * 3);
      // z: diameter in metres at 1 m face height (drops 2-6 cm, mist puffs 12-25 cm); w: peak alpha.
      seed.set([rnd(), 0.06 + rnd() * 0.1, mist ? 0.12 + rnd() * 0.13 : 0.02 + rnd() * 0.04, mist ? 0.1 + rnd() * 0.1 : 0.4 + rnd() * 0.5], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({uniforms: this.sprayU, vertexShader: SPRAY_VERT, fragmentShader: SPRAY_FRAG, transparent: true, depthWrite: false}));
    pts.frustumCulled = false;
    return pts;
  }

  /** Surface point and outward normal on the open face at height fraction f, at crest position x (unit space). */
  private faceAt(x: number, f: number) {
    const p = profileAt(x, curlFor(this.cur), new Float32Array(NZ * 4));
    for (let j = 40; j < NZ - 1; j++) {
      if (p[j * 4 + 1] <= f && p[(j - 1) * 4 + 1] > p[j * 4 + 1]) {
        const dz = p[(j + 1) * 4] - p[(j - 1) * 4], dy = p[(j + 1) * 4 + 1] - p[(j - 1) * 4 + 1], l = Math.hypot(dz, dy) || 1;
        return {z: p[j * 4], y: p[j * 4 + 1], nz: -dy / l, ny: dz / l};
      }
    }
    return {z: 2, y: 0, nz: 0, ny: 1};
  }
  private crestZ(x: number) {
    const p = profileAt(x, curlFor(this.cur)); let best = 0;
    for (let j = 0; j < NZ; j++) if (p[j * 4 + 1] > p[best * 4 + 1]) best = j;
    return p[best * 4];
  }

  /** Apply face height: rebuild only the cross-section when the curl changes, scale for everything else. */
  private layout(ft: number) {
    const Hm = ft * FT, curl = curlFor(ft);
    if (Math.abs(curl - this.curlBuilt) > 0.004) { fillWave(this.build, curl); this.curlBuilt = curl; }
    this.waveGroup.scale.setScalar(Hm);
    this.sprayU.uScale.value = Hm;
    this.place(Hm);
  }

  private place(Hm: number) {
    const ride = this.s.mode === 'ride';
    this.rider.visible = ride; this.paddler.visible = !ride;
    if (ride) {
      // Sit on the face, not in it: lift along the surface normal by board thickness plus the shader's swell,
      // and yaw the board along the face's height contour so nose and tail stay on the curving shoulder.
      // Big faces: ride a little lower (out of the throwing lip) and cap the tilt so the board reads as a board, not a disc.
      const at = Hm > 3 ? 0.27 : 0.34, f = this.faceAt(XU, at), roll = Math.min(0.85, Math.atan2(f.nz, f.ny)), d = 0.9 / Hm;
      const a = this.faceAt(XU - d, at), b = this.faceAt(XU + d, at), yaw = Math.max(-0.4, Math.min(0.4, -Math.atan2((b.z - a.z) * Hm, 2 * d * Hm)));
      const clear = 0.16 + Hm * 0.012;
      this.surfer.position.set(XU * Hm, f.y * Hm + f.ny * clear, f.z * Hm + f.nz * clear);
      this.surfer.rotation.set(roll, yaw, 0, 'YXZ');
      this.leanRider(-roll * 0.8); // body stays closer to upright; the soles stay flat on the deck
    } else {
      this.surfer.position.set((XU - 0.6) * Hm, 0.02, 1.9 * Hm + 2.2);
      this.surfer.rotation.set(0, Math.PI / 2, 0);
    }
    const sp = this.surfer.position, R = this.refGeo.attributes.position as THREE.BufferAttribute, rx = sp.x - 1.25, ry = sp.y, rz = sp.z + 0.1;
    R.setXYZ(0, rx, ry, rz); R.setXYZ(1, rx, ry + SURFER_M, rz); R.setXYZ(2, rx - 0.12, ry + SURFER_M, rz); R.setXYZ(3, rx + 0.12, ry + SURFER_M, rz); R.setXYZ(4, rx - 0.12, ry, rz); R.setXYZ(5, rx + 0.12, ry, rz);
    R.needsUpdate = true;
    const x = XU * Hm + 2.4, zc = this.crestZ(x / Hm) * Hm, P = this.dimGeo.attributes.position as THREE.BufferAttribute;
    const h = Hm * envAt(x / Hm);
    P.setXYZ(0, x, 0, zc); P.setXYZ(1, x, h, zc); P.setXYZ(2, x - 0.35, h, zc); P.setXYZ(3, x + 0.35, h, zc); P.setXYZ(4, x - 0.35, 0, zc); P.setXYZ(5, x + 0.35, 0, zc);
    P.needsUpdate = true;
  }

  private viewFor(name: View, Hm: number) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z), xs = XU * Hm;
    if (this.s.mode === 'paddle' && name === 'front') return {pos: V(xs + 2, 1.5 + 0.18 * Hm, 1.9 * Hm + 8 + 0.5 * Hm), target: V(xs - 1, 0.35 * Hm, 0.4 * Hm)};
    if (name === 'profile') return {pos: V(xs + 12 + 1.6 * Hm, 0.9 * Hm + 1.6, 1.2 * Hm + 4), target: V(xs, 0.5 * Hm, 0.25 * Hm)};
    if (name === 'above') return {pos: V(xs + 9 + Hm, 2.1 * Hm + 7, 2.3 * Hm + 12), target: V(xs, 0.3 * Hm, 0.2 * Hm)};
    return {pos: V(xs + 3 + 0.7 * Hm, 1.5 + 0.45 * Hm, 0.95 * Hm + 5.5), target: V(xs - 1.6 * Hm - 0.4, 0.45 * Hm, 0.2 * Hm)};
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
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (Math.abs(this.cur - this.s.ft) > 0.002) {
      this.cur = reduced() ? this.s.ft : this.cur + (this.s.ft - this.cur) * (1 - Math.exp(-dt * 9));
      this.layout(this.cur);
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
    // Ambient water motion: ~30 fps, paused when hidden/offscreen, off entirely under prefers-reduced-motion.
    const anim = !reduced();
    this.shared.uAnim.value = anim ? 1 : 0;
    if (anim && this.visible && now - this.lastDraw > 33) { this.shared.uTime.value = now / 3000; this.sprayU.uTime.value = now / 3000; this.dirty = true; }
    if (this.dirty && this.visible && !document.hidden) {
      this.lastDraw = now;
      this.sky.position.copy(this.camera.position);
      this.sprayU.uPx.value = this.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
      this.renderer.render(this.scene, this.camera);
      const Hm = this.cur * FT, xt = XU * Hm + 2.4, sp = this.surfer.position;
      this.projectTag(this.tags.face, xt, Hm * envAt(xt / Hm), this.crestZ(xt / Hm) * Hm, `${this.fmt(this.cur, this.unit)} face`);
      this.projectTag(this.tags.person, sp.x, sp.y + (this.s.mode === 'ride' ? 1.42 : 0.65), sp.z, this.s.mode === 'ride' ? 'Surfer 5′10″' : 'Paddling 5′10″');
      this.dirty = false;
      this.frames++;
    }
  };

  private resize() {
    const r = this.stage.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / Math.max(1, r.height);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
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
