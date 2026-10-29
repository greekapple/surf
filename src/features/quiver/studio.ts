import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {TINTS, type Look, type Template} from './looks';

/** Scene units are inches: +X is the nose, +Y is up, Z is the board's width. */
export type Preset = 'deck' | 'bottom' | 'rail' | 'tail' | '360';
export interface ShapeSpec {template: Template; length: number; width: number; thickness: number; volume: number}

const BG = 0x0c141b, FOAM = 0xece6d6, WOOD = 0x6e4a2c;
const FLOOR_Y = -22;
const FILL_REF: Record<Template, number> = {shortboard: 0.52, fish: 0.57, longboard: 0.6, gun: 0.51, midlength: 0.55};
const base = () => (import.meta.env.BASE_URL ?? '/') + 'models/boards/';

/** One loaded template: pristine vertex data so the shape can be re-derived from the dimensions at any time. */
interface Part {geom: THREE.BufferGeometry; pos0: Float32Array; nrm0: Float32Array; station: Uint16Array}
interface Tpl {resin: Part; stringer: Part; width: number; thickness: number; ymin: Float32Array; hw: Float32Array; xs: Float32Array}

const loader = new GLTFLoader();
const tplCache = new Map<Template, Promise<Tpl>>();
let finsCache: Promise<THREE.Object3D> | null = null;

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
      const r = resin as THREE.Mesh, s = stringer as THREE.Mesh;
      r.geometry.computeBoundingBox();
      const bb = r.geometry.boundingBox!, cy = (bb.min.y + bb.max.y) / 2, cx = (bb.min.x + bb.max.x) / 2;
      const key = (x: number) => Math.round(x * 4000);
      const idx = new Map<number, number>(), xs: number[] = [], ymin: number[] = [], hw: number[] = [];
      const rp = r.geometry.getAttribute('position');
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
        resin: part(r), stringer: part(s), width: meta.width ?? 0.27, thickness: meta.thickness ?? 0.035,
        xs: Float32Array.from(order.map((i) => xs[i])), ymin: Float32Array.from(order.map((i) => ymin[i])), hw: Float32Array.from(order.map((i) => hw[i])),
      };
      out.resin.geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rp.count * 3).fill(1), 3));
      return out;
    });
    tplCache.set(name, p);
  }
  return p;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Long softbox strips over a dim room: glossy resin reads as a real photographed board. */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(80, 40, 80), new THREE.MeshBasicMaterial({color: new THREE.Color(0x1b232b), side: THREE.BackSide})));
  const panel = (w: number, h: number, pos: [number, number, number], power: number, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(tint).multiplyScalar(power), side: THREE.DoubleSide}));
    m.position.set(...pos); m.lookAt(0, 0, 0); room.add(m);
  };
  panel(46, 6, [0, 18, -2], 14, 0xfff3e4);      // long overhead strip
  panel(18, 13, [-24, 9, 17], 5.5, 0xe6efff);   // big key softbox, front left
  panel(12, 18, [30, 5, 4], 3.6, 0xffe9d2);     // warm fill, right
  panel(4, 24, [-12, 6, -30], 11);              // rim strips behind
  panel(4, 24, [16, 6, -30], 9);
  panel(60, 60, [0, -19, 0], 0.7, 0x56606b);    // floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  return env;
}

function radialTexture(size: number) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)'); grad.addColorStop(0.45, 'rgba(0,0,0,0.42)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

interface Tween {t0: number; dur: number; from: THREE.Spherical; to: THREE.Spherical; fromT: THREE.Vector3; toT: THREE.Vector3; fromFlip: number; toFlip: number; fromSpin: number; toSpin: number}

export interface StudioOptions {reducedMotion: boolean; onUserMove: () => void; onReady: () => void; onError: () => void}

export class Studio {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
  private controls: OrbitControls;
  private env: THREE.Texture;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private raf = 0;
  private visible = true;
  private dirty = true;
  private last = 0;
  private disposed = false;
  private token = 0;

  private spin = new THREE.Group(); private flip = new THREE.Group(); private pivot = new THREE.Group();
  private shape = new THREE.Group(); private finRoot = new THREE.Group();
  private mirror = new THREE.Group();
  private shadow: THREE.Mesh; private floor: THREE.Mesh; private shadowRoot = new THREE.Group();
  private resinMat = new THREE.MeshPhysicalMaterial({vertexColors: true, color: 0xffffff});
  private stringerMat = new THREE.MeshPhysicalMaterial({color: WOOD});
  private finMat = new THREE.MeshPhysicalMaterial({color: 0x20262b, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.12});
  private baseMat = new THREE.MeshStandardMaterial({color: 0x0a0b0d, roughness: 0.5});

  private tpl: Tpl | null = null;
  private resinMesh: THREE.Mesh | null = null; private stringerMesh: THREE.Mesh | null = null;
  private spec: ShapeSpec | null = null;
  private look: Look | null = null;
  private fillKey = '';
  private finKey = '';
  private spinOn: boolean;
  private tween: Tween | null = null;
  private preset: Preset | null = 'deck';
  private flipTarget = 0;
  private flipAngle = 0;
  private spinAngle = 0.4;
  private reduced: boolean;
  private opts: StudioOptions;

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, opts: StudioOptions) {
    this.opts = opts; this.reduced = opts.reducedMotion; this.spinOn = !opts.reducedMotion;
    const r = this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.setClearColor(BG);
    this.env = studioEnvironment(r);
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.7;
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 150, 420);

    // Floor: a dark, slightly glossy cyclorama. The board's mirror image shows through it.
    const floor = this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({color: 0x0e161d, roughness: 0.5, metalness: 0, transparent: true, opacity: 0.86, depthWrite: false, envMapIntensity: 0.25}));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.renderOrder = 2; this.scene.add(floor);
    const pool = new THREE.SpotLight(0xfff1de, 4, 0, 0.62, 1, 0);
    pool.position.set(-30, 160, 70); pool.target.position.set(0, FLOOR_Y, 0); this.scene.add(pool, pool.target);
    const rim = new THREE.DirectionalLight(0xbcd6ff, 0.9); rim.position.set(60, 40, -90); this.scene.add(rim);

    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: radialTexture(256), transparent: true, opacity: 0.8, depthWrite: false, fog: false}));
    this.shadow.rotation.x = -Math.PI / 2; this.shadowRoot.position.y = FLOOR_Y + 0.06; this.shadow.renderOrder = 3;
    this.shadowRoot.add(this.shadow); this.scene.add(this.shadowRoot);

    this.pivot.add(this.shape, this.finRoot); this.flip.add(this.pivot); this.spin.add(this.flip); this.scene.add(this.spin);
    this.mirror.scale.y = -1; this.mirror.position.y = 2 * FLOOR_Y; this.scene.add(this.mirror);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false; this.controls.enableDamping = !this.reduced; this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7; this.controls.maxPolarAngle = 1.5;
    this.controls.addEventListener('start', () => { this.tween = null; this.preset = null; if (this.spinOn) { this.spinOn = false; } this.opts.onUserMove(); });
    this.controls.addEventListener('change', () => { this.dirty = true; });
    // Phones: vertical swipes scroll the page, horizontal swipes turn the board.
    if (window.matchMedia('(pointer: coarse)').matches) canvas.style.touchAction = 'pan-y';

    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.io = new IntersectionObserver((e) => { this.visible = e[0]?.isIntersecting ?? true; if (this.visible) this.kick(); }, {threshold: 0});
    this.io.observe(host);
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
    this.snapPreset('deck');
    this.kick();
  }

  private onVis = () => { if (!document.hidden) this.kick(); };
  private kick() { if (!this.raf && !this.disposed) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed || document.hidden || !this.visible) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    let draw = this.dirty;
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
    if (this.controls.update()) draw = true;
    if (draw) {
      this.spin.rotation.y = this.spinAngle; this.flip.rotation.x = this.flipAngle;
      this.shadowRoot.rotation.y = this.spinAngle;
      this.syncMirror();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    if (this.spinOn || this.tween || draw) this.raf = requestAnimationFrame(this.loop);
  };

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.preset && !this.tween) this.snapPreset(this.preset);
    this.dirty = true; this.kick();
  }

  // ----------------------------------------------------------------- camera
  private fitDist(L: number) {
    const vf = THREE.MathUtils.degToRad(this.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    return Math.max((L * 0.58) / Math.tan(hf / 2), (L * 0.46) / Math.tan(vf / 2));
  }
  private presetPose(p: Preset) {
    const L = this.spec?.length ?? 72;
    switch (p) {
      case 'deck': return {az: -24, el: 52, m: 1.0, flip: 0, target: new THREE.Vector3(0, 0, 0)};
      case 'bottom': return {az: -24, el: 52, m: 1.0, flip: Math.PI, target: new THREE.Vector3(0, 0, 0)};
      case 'rail': return {az: 4, el: 7, m: 1.0, flip: 0, target: new THREE.Vector3(0, -1, 0)};
      case 'tail': return {az: -96, el: 20, m: 0.5, flip: 0, target: new THREE.Vector3(-L * 0.3, -1, 0)};
      default: return {az: 32, el: 22, m: 1.06, flip: 0, target: new THREE.Vector3(0, 0, 0)};
    }
  }
  private poseSpherical(p: Preset) {
    const q = this.presetPose(p), d = this.fitDist(this.spec?.length ?? 72) * q.m;
    const s = new THREE.Spherical(Math.max(d, 20), Math.PI / 2 - THREE.MathUtils.degToRad(q.el), THREE.MathUtils.degToRad(q.az));
    return {s, target: q.target, flip: q.flip};
  }
  private snapPreset(p: Preset) {
    const {s, target, flip} = this.poseSpherical(p);
    this.controls.target.copy(target); this.camera.position.setFromSpherical(s).add(target); this.camera.lookAt(target);
    this.flipAngle = flip; this.flipTarget = flip; if (p !== '360') this.spinAngle = 0;
    const L = this.spec?.length ?? 72;
    this.controls.minDistance = L * 0.28; this.controls.maxDistance = L * 3;
    this.scene.fog = new THREE.Fog(BG, s.radius * 1.5, s.radius * 4.2);
    this.controls.update(); this.dirty = true; this.kick();
  }
  goTo(p: Preset) {
    this.preset = p;
    this.spinOn = p === '360' && !this.reduced;
    const {s, target, flip} = this.poseSpherical(p);
    if (this.reduced) { this.snapPreset(p); return; }
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dTheta = s.theta - from.theta; dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    this.tween = {t0: performance.now(), dur: 1000, from, to: new THREE.Spherical(s.radius, s.phi, from.theta + dTheta), fromT: this.controls.target.clone(), toT: target, fromFlip: this.flipAngle, toFlip: flip, fromSpin: this.spinAngle, toSpin: p === '360' ? this.spinAngle : Math.round(this.spinAngle / (2 * Math.PI)) * 2 * Math.PI};
    this.scene.fog = new THREE.Fog(BG, s.radius * 1.5, s.radius * 4.2);
    this.kick();
  }
  setSpin(on: boolean) { this.spinOn = on && !this.reduced; this.kick(); }
  /** Keyboard alternative to dragging: turn, tilt and zoom in small steps. */
  nudge(dAz: number, dEl: number, zoom: number) {
    this.tween = null; this.preset = null;
    const off = this.camera.position.clone().sub(this.controls.target), s = new THREE.Spherical().setFromVector3(off);
    s.theta += dAz; s.phi = THREE.MathUtils.clamp(s.phi - dEl, 0.05, 1.5); s.radius = THREE.MathUtils.clamp(s.radius * zoom, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.setFromSpherical(s).add(this.controls.target); this.camera.lookAt(this.controls.target);
    this.dirty = true; this.kick();
  }

  // ----------------------------------------------------------------- board
  async setBoard(spec: ShapeSpec) {
    const first = !this.spec; this.spec = spec;
    const token = ++this.token;
    if (!this.tpl || this.tplName !== spec.template) {
      try {
        const [tpl] = await Promise.all([loadTemplate(spec.template), this.loadFins()]);
        if (token !== this.token || this.disposed) return;
        this.installTemplate(spec.template, tpl);
      } catch (e) { console.error('showroom', e); if (!this.disposed) this.opts.onError(); return; }
    }
    this.applyShape();
    if (first) { this.snapPreset(this.preset ?? 'deck'); this.opts.onReady(); }
  }
  private tplName: Template | null = null;
  private installTemplate(name: Template, tpl: Tpl) {
    this.shape.clear(); this.tpl = tpl; this.tplName = name; this.fillKey = ''; this.finKey = '';
    this.resinMesh = new THREE.Mesh(tpl.resin.geom, this.resinMat); this.stringerMesh = new THREE.Mesh(tpl.stringer.geom, this.stringerMat);
    this.shape.add(this.resinMesh, this.stringerMesh); this.mirrorDirty = true;
  }
  private async loadFins() {
    finsCache ??= loader.loadAsync(`${base()}fins.glb`).then((g) => g.scene);
    return finsCache;
  }
  setLook(look: Look) { this.look = look; this.applyLook(); }

  private applyShape() {
    const tpl = this.tpl, s = this.spec;
    if (!tpl || !s) return;
    const L = s.length, kT = s.thickness / L / tpl.thickness, kW = s.width / L / tpl.width;
    const fill = s.volume / (s.length * s.width * s.thickness * 0.016387);
    const bulge = THREE.MathUtils.clamp((fill - FILL_REF[s.template]) * 1.6, -0.2, 0.2) * tpl.thickness;
    const key = [s.template, L, kT.toFixed(4), kW.toFixed(4), bulge.toFixed(4)].join('|');
    if (key !== this.fillKey) {
      this.fillKey = key;
      for (const part of [tpl.resin, tpl.stringer]) {
        const pos = part.geom.getAttribute('position') as THREE.BufferAttribute, p0 = part.pos0, nr = part.nrm0, st = part.station, half = tpl.width / 2;
        for (let i = 0; i < pos.count; i++) {
          const y0 = p0[i * 3 + 1], z0 = p0[i * 3 + 2], yb = tpl.ymin[st[i]];
          const q = Math.min(1, Math.abs(z0) / half), dir = Math.max(-1, Math.min(1, nr[i * 3 + 1] * 3));
          pos.setXYZ(i, p0[i * 3], yb + (y0 - yb) * kT + dir * bulge * Math.pow(q, 1.5), z0 * kW);
        }
        pos.needsUpdate = true; part.geom.computeVertexNormals(); part.geom.computeBoundingSphere(); part.geom.computeBoundingBox();
      }
    }
    this.shape.scale.setScalar(L);
    this.applyLook();
    this.placeFins();
    const lw = s.width * 1.25;
    this.shadow.scale.set(L * 1.2, lw * 1.9, 1);
    this.dirty = true; this.kick();
  }

  private applyLook() {
    const tpl = this.tpl, look = this.look;
    if (!tpl || !look) return;
    const tint = TINTS.find((t) => t.key === look.tint) ?? TINTS[0], tintC = new THREE.Color(tint.hex), hasTint = tint.key !== 'none';
    const mix = (c: THREE.Color) => (hasTint ? c.lerp(c.clone().multiply(tintC), 0.78) : c);
    const deck = mix(new THREE.Color(look.finish === 'clear' ? FOAM : look.deck)), bottom = mix(new THREE.Color(look.finish === 'clear' ? FOAM : look.bottom));
    const f = 0.05 + look.fade * 0.85;
    const col = tpl.resin.geom.getAttribute('color') as THREE.BufferAttribute, nr = tpl.resin.nrm0, c = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      c.copy(bottom).lerp(deck, smooth(-f, f, nr[i * 3 + 1]));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    const m = this.resinMat, w = this.stringerMat;
    if (look.finish === 'matte') { m.roughness = 0.72; m.clearcoat = 0; m.sheen = 0.25; m.sheenRoughness = 0.6; m.sheenColor.set(0xffffff); m.envMapIntensity = 0.9; }
    else if (look.finish === 'clear') { m.roughness = 0.42; m.clearcoat = 1; m.clearcoatRoughness = 0.035; m.sheen = 0; m.envMapIntensity = 1.15; }
    else { m.roughness = 0.5; m.clearcoat = 1; m.clearcoatRoughness = 0.018; m.sheen = 0; m.envMapIntensity = 1.2; }
    w.color.set(WOOD); if (hasTint) w.color.multiply(tintC.clone().lerp(new THREE.Color(1, 1, 1), 0.4));
    w.roughness = look.finish === 'matte' ? 0.7 : 0.38; w.clearcoat = look.finish === 'matte' ? 0 : 1; w.clearcoatRoughness = 0.03;
    m.needsUpdate = true; w.needsUpdate = true;
    this.placeFins();
    this.dirty = true; this.kick();
  }

  /** Fins sit on the bottom: a ray from beneath finds the surface at each fin position. */
  private placeFins() {
    const s = this.spec, look = this.look, tpl = this.tpl;
    const body = this.resinMesh;
    if (!s || !look || !tpl || !body) return;
    const key = [look.fins, s.length, s.width, s.thickness, s.volume, s.template].join('|');
    if (key === this.finKey) return;
    this.finKey = key;
    this.finRoot.clear(); this.mirrorDirty = true;
    const src = finsCache; if (!src) return;
    void src.then((root) => {
      if (this.disposed || key !== this.finKey) return;
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
      // Cast against the unrotated board.
      const savedFlip = this.flip.rotation.x, savedSpin = this.spin.rotation.y;
      this.flip.rotation.x = 0; this.spin.rotation.y = 0; this.scene.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(), meshes: THREE.Object3D[] = [body];
      for (const f of plan) {
        const node = root.getObjectByName(f.name); if (!node) continue;
        const z = f.side * Math.max(0, halfAt(f.x) - f.edge);
        ray.set(new THREE.Vector3(f.x, -300, z), new THREE.Vector3(0, 1, 0));
        const hit = ray.intersectObjects(meshes, false)[0]; if (!hit || !hit.face) continue;
        const n = hit.face.normal.clone().transformDirection(body.matrixWorld).normalize();
        const fin = node.clone(true);
        fin.traverse((o) => {
          const m = o as THREE.Mesh; if (!m.isMesh) return;
          m.material = (m.material as THREE.Material).name === 'FinBase' ? this.baseMat : this.finMat;
        });
        fin.position.copy(hit.point).addScaledVector(n, -0.05); fin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
        fin.scale.setScalar(f.scale);
        this.finRoot.add(fin);
      }
      this.flip.rotation.x = savedFlip; this.spin.rotation.y = savedSpin; this.scene.updateMatrixWorld(true); this.mirrorDirty = true;
      this.dirty = true; this.kick();
    });
  }

  /** The floor reflection is a mirrored copy that shares geometry and materials. */
  private syncMirror() {
    if (this.mirrorDirty) {
      this.mirror.clear();
      const spin = new THREE.Group(), flip = new THREE.Group(), pivot = new THREE.Group();
      pivot.add(this.shape.clone(true), this.finRoot.clone(true)); flip.add(pivot); spin.add(flip); this.mirror.add(spin);
      this.mirrorDirty = false;
    }
    const spin = this.mirror.children[0] as THREE.Group | undefined;
    if (!spin) return;
    spin.rotation.y = this.spin.rotation.y; (spin.children[0] as THREE.Group).rotation.x = this.flip.rotation.x;
  }
  private mirrorDirty = true;

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVis);
    this.ro.disconnect(); this.io.disconnect(); this.controls.dispose();
    // Template and fin geometry stay cached for the session; everything the scene owns is released here.
    for (const m of [this.floor, this.shadow]) { m.geometry.dispose(); const mat = m.material as THREE.MeshBasicMaterial; mat.map?.dispose(); mat.dispose(); }
    [this.resinMat, this.stringerMat, this.finMat, this.baseMat].forEach((m) => m.dispose());
    this.env.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
