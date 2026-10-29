import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {TINTS, type Look, type Template} from './looks';

/** Scene units are inches: floor at y = 0. A board's own axes: +X nose, +Y deck, Z width. */
export type Preset = 'deck' | 'bottom' | 'rail' | 'tail' | '360';
export type Mode = 'lineup' | 'focus';
export interface ShapeSpec {template: Template; length: number; width: number; thickness: number; volume: number}
/** One board on the rack. `tpl`/`tplKey` override the category template (a board traced from a photo). */
export interface BoardEntry {id: string; spec: ShapeSpec; look: Look; tpl?: Promise<Tpl>; tplKey?: string; /** The user's own deck photo (JPEG data URL), straightened with the nose at the left. */ deckTex?: string}

const WHITE = new THREE.Color(1, 1, 1);
const WOOD = 0xbd9a68, FOAM = 0xece6d6;
const FOCUS_Y = 24;          // height a single board hovers above the floor in Focus
const LEAN = THREE.MathUtils.degToRad(3.2);
const GAP = 7;               // inches between boards on the rack
const FILL_REF: Record<Template, number> = {shortboard: 0.52, fish: 0.57, longboard: 0.6, gun: 0.51, midlength: 0.55};
const base = () => (import.meta.env.BASE_URL ?? '/') + 'models/boards/';

/** One loaded template: pristine vertex data so the shape can be re-derived from the dimensions at any time. */
export interface Part {geom: THREE.BufferGeometry; pos0: Float32Array; nrm0: Float32Array; station: Uint16Array}
export interface Tpl {resin: Part; stringer: Part; width: number; thickness: number; ymin: Float32Array; hw: Float32Array; xs: Float32Array}

const loader = new GLTFLoader();
const tplCache = new Map<Template, Promise<Tpl>>();
let finsCache: Promise<THREE.Object3D> | null = null;

/** Index vertices by station (x position) so thickness can be rescaled from the bottom up. */
export function stationTpl(resin: THREE.Mesh, stringer: THREE.Mesh, width: number, thickness: number): Tpl {
  resin.geometry.computeBoundingBox();
  const bb = resin.geometry.boundingBox!, cy = (bb.min.y + bb.max.y) / 2, cx = (bb.min.x + bb.max.x) / 2;
  const key = (x: number) => Math.round(x * 4000);
  const idx = new Map<number, number>(), xs: number[] = [], ymin: number[] = [], hw: number[] = [];
  const rp = resin.geometry.getAttribute('position');
  for (let i = 0; i < rp.count; i++) {
    const k = key(rp.getX(i) - cx);
    let j = idx.get(k);
    if (j === undefined) { j = xs.length; idx.set(k, j); xs.push(rp.getX(i) - cx); ymin.push(1e9); hw.push(0); }
    ymin[j] = Math.min(ymin[j], rp.getY(i) - cy); hw[j] = Math.max(hw[j], Math.abs(rp.getZ(i)));
  }
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]), rank = new Map(order.map((o, i) => [o, i]));
  const part = (m: THREE.Mesh): Part => {
    const geom = m.geometry, pos = geom.getAttribute('position');
    const pos0 = new Float32Array(pos.count * 3), station = new Uint16Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      pos0[i * 3] = pos.getX(i) - cx; pos0[i * 3 + 1] = pos.getY(i) - cy; pos0[i * 3 + 2] = pos.getZ(i);
      station[i] = rank.get(idx.get(key(pos.getX(i) - cx)) ?? 0) ?? 0;
    }
    return {geom, pos0, nrm0: new Float32Array((geom.getAttribute('normal') as THREE.BufferAttribute).array), station};
  };
  const out: Tpl = {
    resin: part(resin), stringer: part(stringer), width, thickness,
    xs: Float32Array.from(order.map((i) => xs[i])), ymin: Float32Array.from(order.map((i) => ymin[i])), hw: Float32Array.from(order.map((i) => hw[i])),
  };
  out.resin.geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rp.count * 3).fill(1), 3));
  return out;
}

function loadTemplate(name: Template): Promise<Tpl> {
  let p = tplCache.get(name);
  if (!p) {
    p = loader.loadAsync(`${base()}board-${name}.glb`).then((g) => {
      let resin: THREE.Mesh | undefined, stringer: THREE.Mesh | undefined, meta: {width?: number; thickness?: number} = {};
      g.scene.traverse((o) => {
        if (typeof o.userData?.thickness === 'number') meta = o.userData;
        const m = o as THREE.Mesh;
        if (m.isMesh) { if ((m.material as THREE.Material).name === 'Stringer') stringer = m; else resin = m; }
      });
      if (!resin || !stringer) throw new Error('board model is missing a part');
      return stationTpl(resin, stringer, meta.width ?? 0.27, meta.thickness ?? 0.035);
    });
    tplCache.set(name, p);
  }
  return p;
}
export const templateTpl = loadTemplate;

/** The shared template is read-only: every board on the rack deforms its own copy. */
const clonePart = (p: Part): Part => ({geom: p.geom.clone(), pos0: p.pos0, nrm0: p.nrm0, station: p.station});
const cloneTpl = (t: Tpl): Tpl => ({...t, resin: clonePart(t.resin), stringer: clonePart(t.stringer)});

/** Resin material whose photo (map) applies only where the per-vertex `deckw` weight says the surface faces up: rails and bottom keep the board colour. */
function deckMaterial() {
  const m = new THREE.MeshPhysicalMaterial({vertexColors: true, color: 0xffffff});
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float deckw;\nvarying float vDeckW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeckW = deckw;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDeckW;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n diffuseColor.rgb *= mix( vec3( 1.0 ), sampledDiffuseColor.rgb, vDeckW );\n#endif');
  };
  return m;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Soft overhead strips and a big front softbox over a pale room: resin reads as a photographed board. */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(400, 260, 400), new THREE.MeshBasicMaterial({color: new THREE.Color(0xdcdcdc), side: THREE.BackSide})));
  const panel = (w: number, h: number, pos: [number, number, number], power: number, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(tint).multiplyScalar(power), side: THREE.DoubleSide}));
    m.position.set(...pos); m.lookAt(0, 40, 0); room.add(m);
  };
  panel(240, 40, [0, 120, 20], 12, 0xfff6ea);        // long overhead strip
  panel(90, 150, [-150, 70, 130], 6, 0xeef3ff);   // big key softbox, front left
  panel(70, 150, [160, 60, 90], 2.2, 0xffeedd);     // warm fill, right
  panel(30, 190, [-60, 70, -170], 5);               // rim strips behind
  panel(30, 190, [80, 70, -170], 4);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.02).texture;
  pm.dispose();
  room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  return env;
}

function radialTexture(size: number, stops: [number, string][]) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** A faint fibreglass weave plus fine noise, as a tangent-space normal map. One weave cell is one inch on the board. */
function weaveNormal(size = 256, cells = 8) {
  const h = new Float32Array(size * size), rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * cells, fy = (y / size) * cells;
    const over = (Math.floor(fx) + Math.floor(fy)) & 1, tx = fx % 1, ty = fy % 1;
    const bar = over ? Math.sin(Math.PI * tx) : Math.sin(Math.PI * ty);
    h[y * size + x] = bar * 0.5 + (rnd() - 0.5) * 0.35;
  }
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size), at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / (cells / 4), 1 / (cells / 4)); t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; return t;
}

interface Tween {t0: number; dur: number; from: THREE.Spherical; to: THREE.Spherical; fromT: THREE.Vector3; toT: THREE.Vector3; fromFlip: number; toFlip: number; fromSpin: number; toSpin: number}
interface CamPose {s: THREE.Spherical; target: THREE.Vector3; flip: number}

/** One board on the rack: its own geometry, materials, fins and floor shadow. */
interface Rig {
  id: string; root: THREE.Group; orient: THREE.Group; flip: THREE.Group; shape: THREE.Group; fins: THREE.Group;
  shadowRoot: THREE.Group; shadow: THREE.Mesh;
  resinMat: THREE.MeshPhysicalMaterial; stringerMat: THREE.MeshPhysicalMaterial;
  tpl: Tpl | null; tplKey: string; resin: THREE.Mesh | null; stringer: THREE.Mesh | null;
  spec: ShapeSpec; look: Look; fillKey: string; lookKey: string; finKey: string;
  x: number; lift: number;
  /** The user's deck photo, drawn once into an atlas: photo above, flat white below (the underside keeps its colour). */
  texSrc: string; tex: THREE.CanvasTexture | null;
  /** Room mode: height of the stand or pedestal the board rests on, and its current (gliding) x. */
  base: number; cx: number;
}

/** Camera and stand layout exported by scripts/blender/build_showroom.py (public/showroom/room.json), in inches, Y-up. */
export interface RoomSpec {fovY: number; position: [number, number, number]; forward: [number, number, number]; up: [number, number, number]; sunToward: [number, number, number]; slot: number; slots: number; standH: number; pedH: number}

export interface StudioOptions {
  reducedMotion: boolean; onUserMove: () => void; onReady: () => void; onError: () => void;
  onPick: (id: string) => void;
}

export class Studio {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 4000);
  private controls: OrbitControls;
  private env: THREE.Texture;
  private weave = weaveNormal();
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private raf = 0;
  private visible = true;
  private dirty = true;
  private last = 0;
  private disposed = false;
  private token = 0;
  private floor: THREE.Mesh;
  private shadowTex = radialTexture(128, [[0, 'rgba(40,36,30,0.62)'], [0.4, 'rgba(40,36,30,0.28)'], [1, 'rgba(40,36,30,0)']]);
  private finMat = new THREE.MeshPhysicalMaterial({color: 0x4a5258, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.1, side: THREE.DoubleSide});
  private baseMat = new THREE.MeshStandardMaterial({color: 0x2c3034, roughness: 0.45});
  private rigs = new Map<string, Rig>();
  private raycaster = new THREE.Raycaster();

  private mode: Mode;
  private selectedId = '';
  private room: RoomSpec | null = null;
  private roomBits: THREE.Object3D[] = [];
  private framing: 'all' | 'sel' | null = 'all';
  private spinOn = false;
  private tween: Tween | null = null;
  private preset: Preset | null = 'deck';
  private flipAngle = 0;
  private spinAngle = 0.4;
  private reduced: boolean;
  private opts: StudioOptions;
  private ready = false;
  private down: {x: number; y: number; t: number} | null = null;

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, opts: StudioOptions, mode: Mode = 'lineup') {
    this.opts = opts; this.reduced = opts.reducedMotion; this.mode = mode;
    const r = this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.setClearColor(0x000000, 0);
    this.env = studioEnvironment(r);
    this.scene.environment = this.env; this.scene.environmentIntensity = 1.25;

    // Gallery floor: a soft pool of light that fades into the CSS backdrop, so there is no hard horizon.
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshBasicMaterial({
      map: radialTexture(256, [[0, 'rgba(255,253,249,0.92)'], [0.35, 'rgba(250,248,243,0.62)'], [0.75, 'rgba(240,237,230,0.18)'], [1, 'rgba(236,233,226,0)']]),
      transparent: true, depthWrite: false, toneMapped: false,
    }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.renderOrder = 1; this.scene.add(this.floor);
    const key = new THREE.DirectionalLight(0xfff3e4, 2.4); key.position.set(-80, 220, 160); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xdbe6ff, 1.1); rim.position.set(90, 120, -160); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(120, 60, 220); this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false; this.controls.enableDamping = !this.reduced; this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.addEventListener('start', () => { this.tween = null; this.preset = null; this.framing = null; this.spinOn = false; this.opts.onUserMove(); });
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.limits();
    // Phones: vertical swipes scroll the page, horizontal swipes turn the view.
    if (window.matchMedia('(pointer: coarse)').matches) canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', this.onDown); canvas.addEventListener('pointerup', this.onUp); canvas.addEventListener('pointermove', this.onHover);

    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.io = new IntersectionObserver((e) => { this.visible = e[0]?.isIntersecting ?? true; if (this.visible) this.kick(); }, {threshold: 0});
    this.io.observe(host);
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
    this.kick();
  }

  private onVis = () => { if (!document.hidden) this.kick(); };
  private kick() { if (!this.raf && !this.disposed) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } }
  private sel() { return this.rigs.get(this.selectedId) ?? null; }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed || document.hidden || !this.visible) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    let draw = this.dirty, moving = false;
    if (this.spinOn) { this.spinAngle += dt * 0.28; draw = true; }
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, tw = this.tween;
      const s = new THREE.Spherical(THREE.MathUtils.lerp(tw.from.radius, tw.to.radius, e), THREE.MathUtils.lerp(tw.from.phi, tw.to.phi, e), THREE.MathUtils.lerp(tw.from.theta, tw.to.theta, e));
      const t = tw.fromT.clone().lerp(tw.toT, e);
      this.controls.target.copy(t); this.camera.position.setFromSpherical(s).add(t); this.camera.lookAt(t);
      this.flipAngle = THREE.MathUtils.lerp(tw.fromFlip, tw.toFlip, e);
      this.spinAngle = THREE.MathUtils.lerp(tw.fromSpin, tw.toSpin, e);
      if (k >= 1) this.tween = null;
      draw = true;
    }
    for (const rig of this.rigs.values()) {
      if (!Number.isFinite(rig.cx) || this.reduced) rig.cx = rig.x;
      const dx = rig.x - rig.cx; if (Math.abs(dx) > 0.05) { rig.cx += dx * Math.min(1, dt * 6); moving = true; draw = true; } else rig.cx = rig.x;
      const goal = this.mode === 'lineup' && rig.id === this.selectedId && !this.room ? 3.4 : 0, d = goal - rig.lift;
      if (Math.abs(d) > 0.005) { rig.lift = this.reduced ? goal : rig.lift + d * Math.min(1, dt * 9); moving = true; draw = true; }
    }
    if (!(this.room && this.mode === 'lineup') && this.controls.update()) draw = true;
    if (draw) {
      for (const rig of this.rigs.values()) this.pose(rig);
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    if (this.spinOn || this.tween || moving || draw) this.raf = requestAnimationFrame(this.loop);
  };

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (!this.tween && this.ready) this.snapFrame();
    this.dirty = true; this.kick();
  }

  // ----------------------------------------------------------------- layout and pose
  private ordered() { return [...this.rigs.values()].sort((a, b) => a.spec.length - b.spec.length || (a.id < b.id ? -1 : 1)); }
  /** Boards stand shortest to longest from the left, like a shop rack. */
  private layout() {
    if (this.room && this.mode === 'lineup') {
      // Selected board on the centre pedestal (inside the glass case); the rest fill the stands outward, right then left.
      const rm = this.room, list = this.ordered(), sel = list.find((r) => r.id === this.selectedId) ?? list[0], rest = list.filter((r) => r !== sel);
      const half = Math.floor(rm.slots / 2);
      if (sel) { sel.x = 0; sel.base = rm.pedH; }
      rest.forEach((r, k) => { const step = Math.floor(k / 2) + 1, side = k % 2 ? -1 : 1; r.x = side * Math.min(step, half) * rm.slot + (step > half ? side * (step - half) * rm.slot * 0.55 : 0); r.base = rm.standH; });
      return;
    }
    for (const r of this.rigs.values()) r.base = 0.2;
    const list = this.ordered(), total = list.reduce((s, r) => s + r.spec.width, 0) + GAP * Math.max(0, list.length - 1);
    let x = -total / 2;
    for (const r of list) { r.x = x + r.spec.width / 2; x += r.spec.width + GAP; }
  }
  /** local +X (nose) to world +Y, local +Y (deck) to world +Z (toward the viewer), local Z to world +X; then the top leans back. */
  private static UP = (() => {
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -LEAN).multiply(q);
  })();

  private pose(rig: Rig) {
    const L = rig.spec.length, mat = rig.shadow.material as THREE.MeshBasicMaterial;
    if (this.mode === 'focus') {
      rig.root.visible = rig.id === this.selectedId;
      rig.root.position.set(0, FOCUS_Y, 0); rig.root.rotation.y = this.spinAngle;
      rig.orient.quaternion.identity(); rig.flip.rotation.x = this.flipAngle;
      rig.shadowRoot.visible = rig.root.visible; rig.shadowRoot.position.set(0, 0.05, 0); rig.shadowRoot.rotation.y = this.spinAngle;
      rig.shadow.scale.set(L * 1.25, rig.spec.width * 2.3, 1); mat.opacity = 0.55;
    } else {
      rig.root.visible = true;
      const x = Number.isFinite(rig.cx) ? rig.cx : rig.x;
      rig.root.position.set(x, (L / 2) * Math.cos(LEAN) + rig.base + rig.lift, 0); rig.root.rotation.y = 0;
      rig.orient.quaternion.copy(Studio.UP); rig.flip.rotation.x = 0;
      rig.shadowRoot.visible = !this.room; rig.shadowRoot.position.set(x, 0.05, (L / 2) * Math.sin(LEAN) - 1.5); rig.shadowRoot.rotation.y = 0;
      rig.shadow.scale.set(rig.spec.width * 1.7, 11 + L * 0.03, 1);
      mat.opacity = Math.max(0.3, 1 - rig.lift * 0.08);
    }
  }

  private limits() {
    const c = this.controls;
    if (this.mode === 'lineup') {
      c.minAzimuthAngle = -0.75; c.maxAzimuthAngle = 0.75; c.minPolarAngle = 1.05; c.maxPolarAngle = 1.62;
      c.minDistance = 40; c.maxDistance = 700;
    } else {
      c.minAzimuthAngle = -Infinity; c.maxAzimuthAngle = Infinity; c.minPolarAngle = 0; c.maxPolarAngle = 1.5;
      const L = this.sel()?.spec.length ?? 72; c.minDistance = L * 0.28; c.maxDistance = L * 3;
    }
  }

  // ----------------------------------------------------------------- camera
  private fitDist(w: number, h: number) {
    const vf = THREE.MathUtils.degToRad(this.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    return Math.max((w / 2) / Math.tan(hf / 2), (h / 2) / Math.tan(vf / 2));
  }
  private lineupPose(which: 'all' | 'sel'): CamPose {
    const list = this.ordered(), s = this.sel();
    let target: THREE.Vector3, d: number;
    if (which === 'sel' && s) {
      target = new THREE.Vector3(s.x, s.spec.length * 0.48, 0);
      d = this.fitDist(s.spec.width * 3.2, s.spec.length * 1.36);
    } else {
      const maxL = Math.max(72, ...list.map((r) => r.spec.length)), span = list.length ? list[list.length - 1].x - list[0].x + (list[0].spec.width + list[list.length - 1].spec.width) / 2 : 40;
      target = new THREE.Vector3(list.length ? (list[0].x + list[list.length - 1].x) / 2 : 0, maxL * 0.47, 0);
      d = this.fitDist(span + 24, maxL * 1.16);
    }
    return {s: new THREE.Spherical(d, Math.PI / 2 - THREE.MathUtils.degToRad(8), 0), target, flip: 0};
  }
  private presetPose(p: Preset) {
    const L = this.sel()?.spec.length ?? 72, y = FOCUS_Y;
    switch (p) {
      case 'deck': return {az: -24, el: 52, m: 1.0, flip: 0, target: new THREE.Vector3(0, y, 0)};
      case 'bottom': return {az: -24, el: 52, m: 1.0, flip: Math.PI, target: new THREE.Vector3(0, y, 0)};
      case 'rail': return {az: 4, el: 7, m: 1.0, flip: 0, target: new THREE.Vector3(0, y - 1, 0)};
      case 'tail': return {az: -96, el: 20, m: 0.5, flip: 0, target: new THREE.Vector3(-L * 0.3, y - 1, 0)};
      default: return {az: 32, el: 22, m: 1.06, flip: 0, target: new THREE.Vector3(0, y, 0)};
    }
  }
  /** Distance at which a sphere of radius r fits the view at this aspect ratio, with a margin. */
  private sphereDist(r: number) {
    const vf = THREE.MathUtils.degToRad(this.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    return (r * 1.14) / Math.sin(Math.min(vf, hf) / 2);
  }
  private focusPose(p: Preset): CamPose {
    const q = this.presetPose(p), sp = this.sel()?.spec, L = sp?.length ?? 72;
    // The board's bounding sphere (it also covers every spin angle); the tail view frames the tail third only.
    const R = Math.hypot(L / 2, (sp?.width ?? 20) / 2, (sp?.thickness ?? 3) / 2), d = this.sphereDist(p === 'tail' ? R * 0.5 : R);
    return {s: new THREE.Spherical(Math.max(d, 20), Math.PI / 2 - THREE.MathUtils.degToRad(q.el), THREE.MathUtils.degToRad(q.az)), target: q.target, flip: q.flip};
  }
  private currentPose() {
    if (this.mode === 'focus') return this.focusPose(this.preset ?? 'deck');
    return this.lineupPose(this.framing === 'all' ? 'all' : 'sel');
  }
  /** Room mode: the camera is exactly the Blender camera that rendered the backplate, so boards sit in the photo. */
  private roomCamera() {
    const rm = this.room!, c = this.camera, [px, py, pz] = rm.position, [fx, fy, fz] = rm.forward;
    c.fov = rm.fovY; c.position.set(px, py, pz); c.up.set(...rm.up); c.lookAt(px + fx, py + fy, pz + fz); c.updateProjectionMatrix();
    this.controls.enabled = false; this.tween = null; this.dirty = true; this.kick();
  }
  private snapFrame() {
    if (this.room && this.mode === 'lineup') { this.roomCamera(); return; }
    this.controls.enabled = true;
    if (this.mode === 'lineup' && this.framing === null) return;
    if (this.mode === 'focus' && this.preset === null) return;
    const {s, target, flip} = this.currentPose();
    this.controls.target.copy(target); this.camera.position.setFromSpherical(s).add(target); this.camera.lookAt(target);
    if (this.mode === 'focus') { this.flipAngle = flip; if (this.preset !== '360') this.spinAngle = 0; }
    this.limits(); this.controls.update(); this.dirty = true; this.kick();
  }
  private glide(pose: CamPose, spinTo?: number) {
    this.limits();
    if (this.reduced) {
      this.controls.target.copy(pose.target); this.camera.position.setFromSpherical(pose.s).add(pose.target); this.camera.lookAt(pose.target);
      this.flipAngle = pose.flip; if (spinTo !== undefined) this.spinAngle = spinTo; this.controls.update(); this.dirty = true; this.kick(); return;
    }
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dTheta = pose.s.theta - from.theta; dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    this.tween = {t0: performance.now(), dur: 950, from, to: new THREE.Spherical(pose.s.radius, pose.s.phi, from.theta + dTheta), fromT: this.controls.target.clone(), toT: pose.target,
      fromFlip: this.flipAngle, toFlip: pose.flip, fromSpin: this.spinAngle, toSpin: spinTo ?? this.spinAngle};
    this.kick();
  }

  /** Focus presets (deck, bottom, rail, tail, 360). */
  goTo(p: Preset) {
    if (this.mode !== 'focus') return;
    this.preset = p; this.spinOn = p === '360' && !this.reduced;
    this.glide(this.focusPose(p), p === '360' ? this.spinAngle : Math.round(this.spinAngle / (2 * Math.PI)) * 2 * Math.PI);
  }
  /** Lineup views: the whole rack, or the selected board. */
  frame(which: 'all' | 'sel') {
    if (this.mode !== 'lineup') return;
    if (this.room) { this.roomCamera(); return; }
    this.framing = which; this.glide(this.lineupPose(which));
  }
  setMode(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode; this.tween = null;
    if (mode === 'focus') { this.preset = 'deck'; this.spinOn = !this.reduced; this.spinAngle = 0.4; this.flipAngle = 0; }
    else { this.framing = 'all'; this.spinOn = false; this.preset = null; }
    this.floor.visible = !(this.room && mode === 'lineup'); for (const b of this.roomBits) b.visible = !!this.room && mode === 'lineup';
    this.layout();
    for (const r of this.rigs.values()) this.pose(r);
    this.snapFrame(); this.dirty = true; this.kick();
  }
  /** Enter the photographed showroom: real sun shadows on a shadow-catching floor; the CSS backplate is the room. */
  setRoom(rm: RoomSpec | null) {
    for (const b of this.roomBits) { this.scene.remove(b); }
    this.roomBits = []; this.room = rm;
    if (rm) {
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const catcher = new THREE.Mesh(new THREE.PlaneGeometry(900, 600), new THREE.ShadowMaterial({opacity: 0.32}));
      catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.02; catcher.receiveShadow = true;
      const [sx, sy, sz] = rm.sunToward, sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
      sun.position.set(-sx * 400, -sy * 400 + 0, -sz * 400); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4;
      Object.assign(sun.shadow.camera, {left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 1200}); sun.shadow.bias = -0.0004;
      const sky = new THREE.HemisphereLight(0xf6efe6, 0xcbbfae, 0.9);
      this.roomBits = [catcher, sun, sky];
      for (const b of this.roomBits) { this.scene.add(b); b.visible = this.mode === 'lineup'; }
      for (const rig of this.rigs.values()) rig.root.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    }
    this.floor.visible = !(rm && this.mode === 'lineup');
    this.layout(); for (const r of this.rigs.values()) this.pose(r); this.snapFrame();
  }
  setSpin(on: boolean) { this.spinOn = on && !this.reduced && this.mode === 'focus'; this.kick(); }
  /** Keyboard alternative to dragging: turn, tilt and zoom in small steps. */
  nudge(dAz: number, dEl: number, zoom: number) {
    this.tween = null; this.preset = null; this.framing = null;
    const c = this.controls, s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(c.target));
    s.theta = THREE.MathUtils.clamp(s.theta + dAz, c.minAzimuthAngle, c.maxAzimuthAngle);
    s.phi = THREE.MathUtils.clamp(s.phi - dEl, Math.max(0.05, c.minPolarAngle), c.maxPolarAngle); s.radius = THREE.MathUtils.clamp(s.radius * zoom, c.minDistance, c.maxDistance);
    this.camera.position.setFromSpherical(s).add(c.target); this.camera.lookAt(c.target);
    this.dirty = true; this.kick();
  }

  // ----------------------------------------------------------------- picking
  private pickAt(e: PointerEvent): string | null {
    if (this.mode !== 'lineup') return null;
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObjects([...this.rigs.values()].map((x) => x.root), true)[0];
    for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) if (typeof o.userData.rigId === 'string') return o.userData.rigId;
    return null;
  }
  private onDown = (e: PointerEvent) => { this.down = {x: e.clientX, y: e.clientY, t: performance.now()}; };
  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    const id = this.pickAt(e);
    if (id && id !== this.selectedId) this.opts.onPick(id);
  };
  private onHover = (e: PointerEvent) => {
    if (e.buttons || e.pointerType !== 'mouse') return;
    const id = this.pickAt(e);
    this.canvas.style.cursor = id && id !== this.selectedId ? 'pointer' : '';
  };

  // ----------------------------------------------------------------- boards
  private addRig(id: string, spec: ShapeSpec, look: Look): Rig {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: this.shadowTex, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false}));
    shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2;
    const rig: Rig = {
      id, root: new THREE.Group(), orient: new THREE.Group(), flip: new THREE.Group(), shape: new THREE.Group(), fins: new THREE.Group(), shadowRoot: new THREE.Group(), shadow,
      resinMat: deckMaterial(), stringerMat: new THREE.MeshPhysicalMaterial({color: WOOD}),
      tpl: null, tplKey: '', resin: null, stringer: null, spec, look, fillKey: '', lookKey: '', finKey: '', x: 0, lift: 0, texSrc: '', tex: null, base: 0.2, cx: NaN,
    };
    rig.root.userData.rigId = id;
    rig.flip.add(rig.shape, rig.fins); rig.orient.add(rig.flip); rig.root.add(rig.orient);
    rig.shadowRoot.add(shadow); this.scene.add(rig.root, rig.shadowRoot);
    this.rigs.set(id, rig);
    return rig;
  }
  private removeRig(rig: Rig) {
    this.scene.remove(rig.root, rig.shadowRoot); this.rigs.delete(rig.id);
    rig.resin?.geometry.dispose(); rig.stringer?.geometry.dispose();
    rig.tex?.dispose(); rig.resinMat.dispose(); rig.stringerMat.dispose(); (rig.shadow.material as THREE.Material).dispose(); rig.shadow.geometry.dispose();
  }

  /** Sync the rack to the boards given. The first call frames the selected board; later calls only update shapes. */
  async setBoards(entries: BoardEntry[], selectedId: string) {
    const token = ++this.token;
    let tpls: Tpl[];
    try {
      [, ...tpls] = await Promise.all([this.loadFins(), ...entries.map((e) => e.tpl ?? loadTemplate(e.spec.template))]);
    } catch (e) { console.error('showroom', e); if (!this.disposed) this.opts.onError(); return; }
    if (token !== this.token || this.disposed) return;
    for (const rig of [...this.rigs.values()]) if (!entries.some((e) => e.id === rig.id)) this.removeRig(rig);
    const changedSel = selectedId !== this.selectedId;
    this.selectedId = selectedId;
    entries.forEach((e, i) => {
      const rig = this.rigs.get(e.id) ?? this.addRig(e.id, e.spec, e.look), key = e.tplKey ?? e.spec.template;
      rig.spec = e.spec; rig.look = e.look; this.setDeckTex(rig, e.deckTex ?? '');
      if (rig.tplKey !== key || !rig.tpl) {
        rig.shape.clear(); rig.resin?.geometry.dispose(); rig.stringer?.geometry.dispose();
        rig.tpl = cloneTpl(tpls[i]); rig.tplKey = key; rig.fillKey = ''; rig.lookKey = ''; rig.finKey = '';
        rig.resin = new THREE.Mesh(rig.tpl.resin.geom, rig.resinMat); rig.stringer = new THREE.Mesh(rig.tpl.stringer.geom, rig.stringerMat);
        rig.shape.add(rig.resin, rig.stringer);
      }
      this.applyShape(rig);
    });
    this.layout();
    if (this.room) for (const rig of this.rigs.values()) rig.root.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    for (const r of this.rigs.values()) this.pose(r);
    if (!this.ready) {
      for (const r of this.rigs.values()) r.lift = r.id === selectedId && this.mode === 'lineup' ? 3.4 : 0;
      this.ready = true; this.snapFrame(); this.opts.onReady();
    } else if (changedSel) {
      if (this.mode === 'focus') { this.limits(); this.snapFrame(); }
      else if (this.room) this.roomCamera();
      else { this.framing = 'sel'; this.glide(this.lineupPose('sel')); }
    } else if (this.mode === 'lineup' && this.framing) this.snapFrame();
    this.dirty = true; this.kick();
  }
  private async loadFins() {
    finsCache ??= loader.loadAsync(`${base()}fins.glb`).then((g) => g.scene);
    return finsCache;
  }

  private applyShape(rig: Rig) {
    const tpl = rig.tpl, s = rig.spec;
    if (!tpl || !rig.resin) return;
    const L = s.length, kT = s.thickness / L / tpl.thickness, kW = s.width / L / tpl.width;
    const fill = s.volume / (s.length * s.width * s.thickness * 0.016387);
    const bulge = THREE.MathUtils.clamp((fill - FILL_REF[s.template]) * 1.6, -0.2, 0.2) * tpl.thickness;
    const key = [rig.tplKey, L, kT.toFixed(4), kW.toFixed(4), bulge.toFixed(4)].join('|');
    if (key !== rig.fillKey) {
      rig.fillKey = key;
      for (const part of [tpl.resin, tpl.stringer]) {
        const pos = part.geom.getAttribute('position') as THREE.BufferAttribute, p0 = part.pos0, nr = part.nrm0, st = part.station, half = tpl.width / 2;
        let uv = part.geom.getAttribute('uv') as THREE.BufferAttribute | undefined;
        if (!uv || uv.count !== pos.count) { uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); part.geom.setAttribute('uv', uv); }
        for (let i = 0; i < pos.count; i++) {
          const y0 = p0[i * 3 + 1], z0 = p0[i * 3 + 2], yb = tpl.ymin[st[i]];
          const q = Math.min(1, Math.abs(z0) / half), dir = Math.max(-1, Math.min(1, nr[i * 3 + 1] * 3));
          const x = p0[i * 3], y = yb + (y0 - yb) * kT + dir * bulge * Math.pow(q, 1.5), z = z0 * kW;
          pos.setXYZ(i, x, y, z);
          // Weave coordinates in inches, laid along the board.
          uv.setXY(i, x * L, (z + Math.sign(z) * Math.abs(y) * 0.5) * L);
        }
        if (part === tpl.resin) {
          // Deck-photo coordinates: along the board from the nose, across its width; the underside samples the flat half of the atlas.
          let uv1 = part.geom.getAttribute('uv1') as THREE.BufferAttribute | undefined;
          if (!uv1 || uv1.count !== pos.count) { uv1 = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); part.geom.setAttribute('uv1', uv1); }
          let dw = part.geom.getAttribute('deckw') as THREE.BufferAttribute | undefined;
          if (!dw || dw.count !== pos.count) { dw = new THREE.BufferAttribute(new Float32Array(pos.count), 1); part.geom.setAttribute('deckw', dw); }
          const wF = s.width / L;
          for (let i = 0; i < pos.count; i++) {
            const u = THREE.MathUtils.clamp(0.5 - pos.getX(i), 0, 1), vn = THREE.MathUtils.clamp(pos.getZ(i) / wF + 0.5, 0, 1);
            uv1.setXY(i, u, 0.5 + 0.5 * vn);
            dw.setX(i, smooth(0.45, 0.8, nr[i * 3 + 1]));
          }
          uv1.needsUpdate = true; dw.needsUpdate = true;
        }
        pos.needsUpdate = true; uv.needsUpdate = true; part.geom.computeVertexNormals(); part.geom.computeBoundingSphere(); part.geom.computeBoundingBox();
      }
    }
    rig.shape.scale.setScalar(L);
    this.applyLook(rig);
    this.placeFins(rig);
  }

  private applyLook(rig: Rig) {
    const tpl = rig.tpl, look = rig.look;
    if (!tpl) return;
    const lk = JSON.stringify(look) + (rig.tex ? 'T' : '');
    if (lk === rig.lookKey) return;
    rig.lookKey = lk;
    const tint = TINTS.find((t) => t.key === look.tint) ?? TINTS[0], tintC = new THREE.Color(tint.hex), hasTint = tint.key !== 'none';
    const mix = (c: THREE.Color) => (hasTint ? c.lerp(c.clone().multiply(tintC), 0.78) : c);
    const deck = mix(new THREE.Color(look.finish === 'clear' ? FOAM : look.deck)), bottom = mix(new THREE.Color(look.finish === 'clear' ? FOAM : look.bottom));
    const f = 0.05 + look.fade * 0.85, photo = !!rig.tex;
    const col = tpl.resin.geom.getAttribute('color') as THREE.BufferAttribute, nr = tpl.resin.nrm0, c = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      if (photo) c.copy(bottom).lerp(WHITE, smooth(0.45, 0.8, nr[i * 3 + 1])); else c.copy(bottom).lerp(deck, smooth(-f, f, nr[i * 3 + 1]));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    const m = rig.resinMat, w = rig.stringerMat;
    if (m.map !== rig.tex) { m.map = rig.tex; m.needsUpdate = true; }
    m.normalMap = this.weave; m.normalScale.set(0.06, 0.06);
    m.ior = 1.5; m.specularIntensity = 0.7;
    if (look.finish === 'matte') { m.roughness = 0.62; m.clearcoat = 0; m.clearcoatRoughness = 0.5; m.sheen = 0.35; m.sheenRoughness = 0.7; m.sheenColor.set(0xffffff); m.envMapIntensity = 0.85; }
    else if (look.finish === 'clear') { m.roughness = 0.32; m.clearcoat = 1; m.clearcoatRoughness = 0.04; m.sheen = 0.12; m.sheenRoughness = 0.5; m.sheenColor.set(0xfff4e0); m.envMapIntensity = 1.0; }
    else { m.roughness = 0.34; m.clearcoat = 1; m.clearcoatRoughness = 0.03; m.sheen = 0.18; m.sheenRoughness = 0.55; m.sheenColor.set(0xf6f2ea); m.envMapIntensity = 1.05; }
    w.color.set(WOOD); if (hasTint) w.color.multiply(tintC.clone().lerp(new THREE.Color(1, 1, 1), 0.5));
    w.roughness = look.finish === 'matte' ? 0.7 : 0.45; w.clearcoat = look.finish === 'matte' ? 0 : 0.8; w.clearcoatRoughness = 0.06;
    m.needsUpdate = true; w.needsUpdate = true;
  }

  /** Load or clear the deck photo for a board. */
  private setDeckTex(rig: Rig, src: string) {
    if (rig.texSrc === src) return;
    rig.texSrc = src;
    if (!src) { rig.tex?.dispose(); rig.tex = null; rig.lookKey = ''; return; }
    const img = new Image();
    img.onload = () => {
      if (this.disposed || rig.texSrc !== src || !this.rigs.has(rig.id)) return;
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 1024, 512); g.drawImage(img, 0, 0, 1024, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.anisotropy = 4;
      rig.tex?.dispose(); rig.tex = t; rig.lookKey = ''; this.applyLook(rig); this.dirty = true; this.kick();
    };
    img.src = src;
  }

  /** Fins sit on the bottom: a ray from beneath finds the surface at each fin position. */
  private placeFins(rig: Rig) {
    const s = rig.spec, look = rig.look, tpl = rig.tpl, body = rig.resin;
    if (!tpl || !body) return;
    const key = [look.fins, s.length, s.width, s.thickness, s.volume, rig.tplKey, rig.fillKey].join('|');
    if (key === rig.finKey) return;
    rig.finKey = key;
    rig.fins.clear();
    const src = finsCache; if (!src) return;
    void src.then((root) => {
      if (this.disposed || key !== rig.finKey || rig.tpl !== tpl) return;
      const L = s.length, kW = s.width / L / tpl.width;
      const halfAt = (x: number) => {
        const u = x / L, xs = tpl.xs; let lo = 0, hi = xs.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] > u) hi = mid; else lo = mid; }
        const t = (u - xs[lo]) / Math.max(1e-6, xs[hi] - xs[lo]);
        return (tpl.hw[lo] + (tpl.hw[hi] - tpl.hw[lo]) * THREE.MathUtils.clamp(t, 0, 1)) * kW * L;
      };
      const fromTail = (f: number) => -L / 2 + f * L;
      const bigger = THREE.MathUtils.clamp(Math.sqrt(L / 72), 0.85, 1.2);
      type Spot = {name: string; x: number; side: number; edge: number; scale: number};
      const plan: Spot[] = look.fins === 'single' ? [{name: 'fin_single', x: fromTail(0.1), side: 0, edge: 0, scale: s.template === 'longboard' ? 1 : s.template === 'midlength' ? 0.8 : 0.62}]
        : look.fins === 'twin' ? [{name: 'fin_twin_R', x: fromTail(0.19), side: 1, edge: 1.7, scale: bigger}, {name: 'fin_twin_L', x: fromTail(0.19), side: -1, edge: 1.7, scale: bigger}]
        : look.fins === 'thruster' ? [{name: 'fin_side_R', x: fromTail(0.2), side: 1, edge: 1.35, scale: bigger}, {name: 'fin_side_L', x: fromTail(0.2), side: -1, edge: 1.35, scale: bigger}, {name: 'fin_center', x: fromTail(0.08), side: 0, edge: 0, scale: bigger}]
        : [];
      // Cast against a detached copy in board space (scaled to inches), so the rack pose does not matter.
      const ghost = new THREE.Mesh(body.geometry, body.material), ghosts = [ghost];
      if (rig.stringer) ghosts.push(new THREE.Mesh(rig.stringer.geometry, rig.stringer.material));   // the stringer fills the centreline gap
      for (const g of ghosts) { g.scale.setScalar(L); g.updateMatrixWorld(true); }
      const ray = new THREE.Raycaster();
      for (const f of plan) {
        const node = root.getObjectByName(f.name); if (!node) continue;
        const z = f.side * Math.max(0, halfAt(f.x) - f.edge);
        ray.set(new THREE.Vector3(f.x, -300, z), new THREE.Vector3(0, 1, 0));
        const hit = ray.intersectObjects(ghosts, false)[0]; if (!hit || !hit.face) continue;
        const n = hit.face.normal.clone().transformDirection(ghost.matrixWorld).normalize();
        const fin = node.clone(true);
        fin.traverse((o) => {
          const m = o as THREE.Mesh; if (!m.isMesh) return;
          m.material = (m.material as THREE.Material).name === 'FinBase' ? this.baseMat : this.finMat;
        });
        fin.position.copy(hit.point).addScaledVector(n, -0.05); fin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
        fin.scale.setScalar(f.scale);
        rig.fins.add(fin);
      }
      this.dirty = true; this.kick();
    });
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('pointerdown', this.onDown); this.canvas.removeEventListener('pointerup', this.onUp); this.canvas.removeEventListener('pointermove', this.onHover);
    this.ro.disconnect(); this.io.disconnect(); this.controls.dispose();
    // Template and fin geometry stay cached for the session; everything the scene owns is released here.
    for (const rig of [...this.rigs.values()]) this.removeRig(rig);
    this.floor.geometry.dispose(); const fm = this.floor.material as THREE.MeshBasicMaterial; fm.map?.dispose(); fm.dispose();
    this.shadowTex.dispose(); this.weave.dispose();
    [this.finMat, this.baseMat].forEach((m) => m.dispose());
    this.env.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
