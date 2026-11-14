import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {REFERENCE_BOARD, boardParamsFor} from '../scale/boardMesh';
import {quiverTemplate} from '../scale/boardObject';
import {STRIPE_BANDS, TINTS, type Look, type Template} from './looks';

/** Scene units are inches: floor at y = 0. A board's own axes: +X nose, +Y deck, Z width. */
export type Preset = 'deck' | 'bottom' | 'rail' | 'tail' | 'nose' | 'three';
export type Anchor = 'nose' | 'tail' | 'fins' | 'rail';
/** Screen position of a hotspot anchor in canvas CSS pixels; `on` is false when the board hides it or it is off screen. */
export interface AnchorPos {x: number; y: number; on: boolean}
export type Mode = 'lineup' | 'focus';
export interface ShapeSpec {template: Template; length: number; width: number; thickness: number; volume: number; /** Tail shape word from the board record; narrows or widens the template's tail (an approximation). */ tail?: string;
  /** the hull was built at these very numbers (an example model, traced.ts referenceTpl): no fill bulge, no tail re-fit */ exact?: boolean;
  /** a soft-top: no stringer, a slick bottom under a matte foam deck */ softTop?: boolean}
/** One board on the rack. `tpl`/`tplKey` override the category template (a board traced from a photo). */
export interface BoardEntry {id: string; spec: ShapeSpec; look: Look; tpl?: Promise<Tpl>; tplKey?: string; /** The user's own deck photo (JPEG data URL), straightened with the nose at the left. */ deckTex?: string;
  /** the outline's half-widths (40, nose to tail) a procedural deck pattern (look.pattern) follows */ patternHw?: number[];
  /** quiver-look: an example model's trim (looks.trimFor): the centre line (null = none shows) and the fin colour */ trim?: {stringer: string | null; fin: string} | null}

const WHITE = new THREE.Color(1, 1, 1);
const WOOD = 0xbd9a68, FOAM = 0xece6d6; // FOAM must equal looks.ts FOAM_HEX (the 2D renderer's effectiveDeck mirrors applyLook; test: board-look.test.ts)
const FOCUS_Y = 15;          // height a single board hovers above the floor in Focus (low, so the contact shadow reads as the board's)
/** Deck and bottom rest pose: nose pointing away from the viewer (camera azimuth -24°), twisted 25° for a three-quarter view, so the
 *  board reads upright and fills the stage height like the reference showroom instead of lying across it. */
const STAND = THREE.MathUtils.degToRad(-24 + 90 - 25);
const LEAN = THREE.MathUtils.degToRad(3.2);
const GAP = 7;               // inches between boards on the rack
const FILL_REF: Record<Template, number> = {shortboard: 0.52, fish: 0.57, longboard: 0.6, gun: 0.51, midlength: 0.55};
/** Tail shapes as a width factor over the last 16% of the board, relative to the template's own tail. An approximation, not a shaped tail. */
const TAIL_K: Record<string, number> = {pin: 0.6, 'rounded pin': 0.72, round: 0.84, diamond: 0.9, squash: 1, swallow: 1.06, square: 1.12};
const TAIL_ZONE = -0.5 + 0.16;
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

/** R16: the category templates come from the same `buildBoard` the wave rides (boardMesh.ts), no template GLBs any more: the shortboard
 *  is the reference 5'10" x 19 1/4" x 2 3/8", the others the category defaults at a typical size (the rack rescales each to the record). */
const TEMPLATE_BOARD: Record<Template, Parameters<typeof boardParamsFor>[0]> = {
  shortboard: {type: 'Performance shortboard', length: 70, width: 19.25, thickness: 2.375}, fish: {type: 'Fish', length: 68, width: 21, thickness: 2.5}, longboard: {type: 'Longboard', length: 110, width: 22.5, thickness: 3},
  gun: {type: 'Gun', length: 84, width: 19, thickness: 2.75}, midlength: {type: 'Midlength', length: 86, width: 21, thickness: 2.75},
};
function loadTemplate(name: Template): Promise<Tpl> {
  let p = tplCache.get(name);
  if (!p) {
    p = Promise.resolve().then(() => { const t = quiverTemplate(name === 'shortboard' ? REFERENCE_BOARD : boardParamsFor(TEMPLATE_BOARD[name])); return stationTpl(t.resin, t.stringer, t.width, t.thickness); });
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
  const bottomRough = {value: -1}; m.userData.bottomRough = bottomRough;   // >= 0: the underside's own roughness (a soft-top's slick skin under matte foam)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBottomRough = bottomRough;
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (uBottomRough >= 0.0) roughnessFactor = mix(uBottomRough, roughnessFactor, vDeckW);')
      .replace('#include <common>', '#include <common>\nuniform float uBottomRough;');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float deckw;\nvarying float vDeckW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeckW = deckw;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDeckW;')
      // quiver-polish: the atlas's top half is the deck, its lower half the bottom (white unless a pattern fills it, e.g. the carbon bottom)
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n vec4 sampledBottom = texture2D( map, vec2( vMapUv.x, vMapUv.y - 0.5 ) );\n diffuseColor.rgb *= mix( sampledBottom.rgb, sampledDiffuseColor.rgb, vDeckW );\n#endif');
  };
  return m;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A procedural deck for the example models, drawn into the deck-photo atlas (top half; nose at the left, the board's width down the rows):
 *  `carbon` a dark 2x2 twill inside a white rail band (the Inferno C1 Carbon), `stripes` the soft-top's blue bands along the rails (the
 *  Wavestorm). The bands follow the traced outline. Colours only: no logos, graphics or text. */
function patternCanvas(kind: 'carbon' | 'stripes', hw: number[]): HTMLCanvasElement {
  const W = 1024, H = 256, c = document.createElement('canvas'); c.width = W; c.height = 2 * H;
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, W, 2 * H);
  const img = g.createImageData(W, H), d = img.data, mx = Math.max(...hw), n = hw.length;
  // quiver-look: the shared soft-top palette (navy rail band, royal and sky bands on white), the same table the 2D wall draws
  // quiver-polish: the studio lights lift saturated matte foam about 2x; the blue bands are pre-darkened for the 3D atlas (whites unchanged) so the
  // rendered deck lands on the photo's navy, royal and sky. The 2D wall draws STRIPE_BANDS as they are.
  const FOAM_K = 0.62, dk = (v: number, white: boolean) => (white ? v : Math.round(v * FOAM_K));
  const STRIPES: [number, number, number, number][] = STRIPE_BANDS.map(([r, h]) => { const w = h.toLowerCase() === '#f7f8f8'; return [r, dk(parseInt(h.slice(1, 3), 16), w), dk(parseInt(h.slice(3, 5), 16), w), dk(parseInt(h.slice(5, 7), 16), w)]; });
  for (let x = 0; x < W; x++) {
    const f = (x / (W - 1)) * (n - 1), i = Math.min(n - 2, Math.floor(f)), h = Math.max(1e-3, (hw[i] + (hw[i + 1] - hw[i]) * (f - i)) / mx);
    for (let y = 0; y < H; y++) {
      const r = Math.abs(1 - 2 * (y + 0.5) / H) / h, o = (y * W + x) * 4;   // 0 on the centreline, 1 at the rail
      let R: number, G: number, B: number;
      if (kind === 'carbon') {
        // quiver-look: 7 px tows (about half an inch on the board) and more contrast, so the twill reads at 1440 under a satin finish
        const tx = Math.floor(x / 7), ty = Math.floor(y / 7), warp = ((tx + ty) & 3) < 2, ph = warp ? (x % 7) / 7 : (y % 7) / 7, v = 7 + 24 * Math.sin(Math.PI * ph) + (warp ? 6 : 0);   // quiver-polish: darker, so the deck reads black from above as on the photo
        const rim = smooth(0.8, 0.86, r);   // the white rail band of the reference photo, about a sixth of the half-width
        R = v + (243 - v) * rim; G = v + 1 + (241 - v - 1) * rim; B = v + 4 + (236 - v - 4) * rim;
      } else { const s = STRIPES.find((b) => r < b[0])!; R = s[1]; G = s[2]; B = s[3]; }
      d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (kind === 'carbon') {
    // quiver-polish: the Inferno's bottom is carbon too (black weave inside a thin white rail band, the bottom photo): the atlas's lower half,
    // which the resin shader samples where the surface faces down. Darker than the deck, so it reads black, not charcoal, under the lights.
    const lo = g.createImageData(W, H), e = lo.data;
    for (let x = 0; x < W; x++) {
      const f = (x / (W - 1)) * (n - 1), i = Math.min(n - 2, Math.floor(f)), h = Math.max(1e-3, (hw[i] + (hw[i + 1] - hw[i]) * (f - i)) / mx);
      for (let y = 0; y < H; y++) {
        const r = Math.abs(1 - 2 * (y + 0.5) / H) / h, o = (y * W + x) * 4;
        const tx = Math.floor(x / 7), ty = Math.floor(y / 7), warp = ((tx + ty) & 3) < 2, ph = warp ? (x % 7) / 7 : (y % 7) / 7, v = 5 + 20 * Math.sin(Math.PI * ph) + (warp ? 5 : 0);
        const rim = smooth(0.9, 0.95, r);   // a thinner band than the deck's
        e[o] = v + (243 - v) * rim; e[o + 1] = v + 1 + (241 - v - 1) * rim; e[o + 2] = v + 3 + (236 - v - 3) * rim; e[o + 3] = 255;
      }
    }
    g.putImageData(lo, 0, H);
  }
  return c;
}

/** Soft overhead strips and a big front softbox over a pale room: resin reads as a photographed board. */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(400, 260, 400), new THREE.MeshBasicMaterial({color: new THREE.Color(0x5c6064), side: THREE.BackSide}))); // T-072: a darker room, so the strips read as highlight lines on the resin
  const panel = (w: number, h: number, pos: [number, number, number], power: number, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(tint).multiplyScalar(power), side: THREE.DoubleSide}));
    m.position.set(...pos); m.lookAt(0, 40, 0); room.add(m);
  };
  panel(240, 40, [0, 120, 20], 12, 0xfff6ea);        // long overhead strip
  panel(260, 10, [0, 118, -40], 16, 0xffffff);       // T-072: thin second strip, a crisp highlight line along the rails
  // T-072: car-studio light strips. Clearcoat reflects only ~4% head-on, so gloss reads as crisp bright lines against a darker room, not as an
  // evenly lit box. Three long ceiling strips run along the board and a bright band circles the walls, so streaks cross the deck and rails
  // from any camera angle.
  for (const z of [-60, 0, 60]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(360, 9), new THREE.MeshBasicMaterial({color: new THREE.Color(0xffffff).multiplyScalar(26), side: THREE.DoubleSide}));
    m.position.set(0, 128, z); m.rotation.x = Math.PI / 2; room.add(m); }
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, m = new THREE.Mesh(new THREE.PlaneGeometry(396, 14), new THREE.MeshBasicMaterial({color: new THREE.Color(0xfffaf2).multiplyScalar(18), side: THREE.DoubleSide}));
    m.position.set(Math.sin(a) * 197, 84, Math.cos(a) * 197); m.rotation.y = a; room.add(m); }
  panel(400, 120, [0, -125, 0], 0.35, 0xb8b4ac);     // T-072: darker floor below, so the bottom and rails pick up contrast
  panel(90, 150, [-150, 70, 130], 6, 0xeef3ff);   // big key softbox, front left
  panel(70, 150, [160, 60, 90], 2.2, 0xffeedd);     // warm fill, right
  panel(30, 190, [-60, 70, -170], 5);               // rim strips behind
  panel(30, 190, [80, 70, -170], 4);
  const pm = new THREE.PMREMGenerator(renderer);
  // T-072: near/far must contain the room (fromScene defaults to far = 100; the 400-unit room and every panel sat beyond it, so the board reflected
  // an empty environment and read as flat plastic).
  const env = pm.fromScene(room, 0.02, 0.1, 1000).texture;
  pm.dispose();
  room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  return env;
}

const isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
/** The gallery floor's soft pool of light, fading into the CSS stage: warm white on the light stage, a dark neutral on the dark one (T-109). */
const floorPool = (dark: boolean) => radialTexture(256, dark
  ? [[0, 'rgba(70,73,78,0.9)'], [0.35, 'rgba(56,59,63,0.6)'], [0.75, 'rgba(42,45,49,0.18)'], [1, 'rgba(38,41,45,0)']]
  : [[0, 'rgba(226,231,234,0.9)'], [0.4, 'rgba(212,218,222,0.58)'], [0.8, 'rgba(198,205,210,0.16)'], [1, 'rgba(192,199,204,0)']]);   // quiver-lock: a mid-light neutral, so a white board has an edge against it
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

interface Tween {t0: number; dur: number; from: THREE.Spherical; to: THREE.Spherical; fromT: THREE.Vector3; toT: THREE.Vector3; fromFlip: number; toFlip: number; fromSpin: number; toSpin: number; fromQ: THREE.Quaternion; toQ: THREE.Quaternion}
interface CamPose {s: THREE.Spherical; target: THREE.Vector3; flip: number}

/** One board on the rack: its own geometry, materials, fins and floor shadow. */
interface Rig {
  id: string; root: THREE.Group; orient: THREE.Group; flip: THREE.Group; shape: THREE.Group; fins: THREE.Group;
  shadowRoot: THREE.Group; shadow: THREE.Mesh;
  resinMat: THREE.MeshPhysicalMaterial; stringerMat: THREE.MeshPhysicalMaterial;
  /** quiver-look: the example model's trim, and its own fin material when it has a fin colour */
  trim: {stringer: string | null; fin: string} | null; finMatOwn: THREE.MeshPhysicalMaterial | null;
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
  /** Called after every rendered frame (hotspot overlays follow the board). */
  onFrame?: () => void;
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
  private catcher: THREE.Mesh;
  private themeMo: MutationObserver;
  private key!: THREE.DirectionalLight;
  private shadowTex = radialTexture(128, [[0, 'rgba(40,36,30,0.62)'], [0.4, 'rgba(40,36,30,0.28)'], [1, 'rgba(40,36,30,0)']]);
  // T-072: fins as smoky fibreglass foils (translucent, clear-coated) so their outline and thin edge read, not a black blob.
  private finMat = new THREE.MeshPhysicalMaterial({color: 0x7e95a0, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, transmission: 0.45, thickness: 0.25, ior: 1.5, attenuationColor: new THREE.Color(0x46606c), attenuationDistance: 0.6, side: THREE.DoubleSide});
  private baseMat = new THREE.MeshStandardMaterial({color: 0x3a4045, roughness: 0.4});
  private rigs = new Map<string, Rig>();
  private raycaster = new THREE.Raycaster();

  private mode: Mode;
  private selectedId = '';
  private room: RoomSpec | null = null;
  private roomBits: THREE.Object3D[] = [];
  private framing: 'all' | 'sel' | null = 'all';
  private spinOn = false;
  private tween: Tween | null = null;
  private preset: Preset | null = 'three';
  private flipAngle = 0;
  private spinAngle = 0.4;
  private reduced: boolean;
  private opts: StudioOptions;
  private ready = false;
  private down: {x: number; y: number; t: number} | null = null;
  /** quiver-lock: the board's free turn (any axis, from dragging or the keys), applied in world space on top of the preset's yaw; the camera only zooms. */
  private turnQ = new THREE.Quaternion();
  private settleFit = false;                   // a turn just ended: check the board is still inside the frame
  private vel = {x: 0, y: 0};                 // inertia, radians per second about the world up axis (x) and the camera's right axis (y)
  private drag: {id: number; x: number; y: number; t: number; sx: number; sy: number; moved: boolean} | null = null;
  private lastTap = {t: 0, x: 0, y: 0};
  private coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  private lastFit = 0;

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, opts: StudioOptions, mode: Mode = 'lineup') {
    this.opts = opts; this.reduced = opts.reducedMotion; this.mode = mode;
    const r = this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.04;
    r.setClearColor(0x000000, 0);
    this.env = studioEnvironment(r);
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.42; // T-072: the environment now actually renders (see studioEnvironment); 1.3 washed the colour out
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4cc, 0.55)); // light set: white wall above, pale floor bounce below

    // Gallery floor: a soft pool of light that fades into the CSS backdrop, so there is no hard horizon.
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshBasicMaterial({map: floorPool(isDarkTheme()), transparent: true, depthWrite: false, toneMapped: false}));
    this.floor.rotation.x = -Math.PI / 2; this.floor.renderOrder = 1; this.scene.add(this.floor);
    // T-109: the floor pool follows the page theme (a dark neutral stage in dark mode), also when the theme is switched while the showroom is open.
    this.themeMo = new MutationObserver(() => { const m = this.floor.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.map = floorPool(isDarkTheme()); m.needsUpdate = true; this.dirty = true; this.kick(); });
    this.themeMo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    const key = new THREE.DirectionalLight(0xfff3e4, 2.4); key.position.set(-80, 220, 160); this.scene.add(key);
    // T-072: a real soft shadow from the key light onto the floor (focus view), on top of the contact pool. Lineup with the photo room has its own.
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap  /* R14: PCFSoftShadowMap is removed in this three.js (it warned on every load) */;
    this.key = key; key.castShadow = mode === 'focus'; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0005;
    Object.assign(key.shadow.camera, {left: -110, right: 110, top: 110, bottom: -110, near: 20, far: 600});
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShadowMaterial({opacity: 0.2}));
    this.catcher.rotation.x = -Math.PI / 2; this.catcher.position.y = 0.04; this.catcher.receiveShadow = true; this.catcher.renderOrder = 2;
    this.catcher.visible = mode === 'focus'; this.scene.add(this.catcher);
    const rim = new THREE.DirectionalLight(0xdbe6ff, 1.1); rim.position.set(90, 120, -160); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(120, 60, 220); this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false; this.controls.enableDamping = !this.reduced; this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    // quiver-lock: in Focus the board turns, not the camera (so the underside is as reachable as the top); OrbitControls keeps only the zoom (wheel, pinch). Lineup keeps its orbit.
    this.controls.enableRotate = mode === 'lineup'; this.controls.zoomSpeed = 0.8; this.controls.touches = {ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN};
    this.controls.addEventListener('start', () => { this.tween = null; this.preset = null; this.framing = null; this.spinOn = false; this.opts.onUserMove(); });
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.limits();
    // Phones: a vertical swipe that starts on the stage scrolls the page (pan-y); one that starts sideways turns the board and then follows the finger on both axes. In full screen (setFull) every drag turns it.
    canvas.style.touchAction = this.coarse ? 'pan-y' : 'none';
    canvas.addEventListener('pointerdown', this.onDown); canvas.addEventListener('pointerup', this.onUp); canvas.addEventListener('pointermove', this.onHover);
    canvas.addEventListener('pointerdown', this.onTurnDown); canvas.addEventListener('pointermove', this.onTurnMove); canvas.addEventListener('pointerup', this.onTurnUp); canvas.addEventListener('pointercancel', this.onTurnUp);
    canvas.addEventListener('dblclick', this.onDbl); canvas.addEventListener('webglcontextlost', this.onLost);

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
  /** Screen box of the selected board as fractions of the canvas (0..1), for layout checks. Null when nothing is shown. */
  selectedBox() {
    const r = this.sel(); if (!r || !r.root.visible) return null;
    r.root.updateWorldMatrix(true, true);
    const v = new THREE.Vector3();
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    r.flip.traverse((o) => {
      const pos = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry.getAttribute('position') : null;
      if (!pos || !o.visible) return;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld).project(this.camera);
        const x = (v.x + 1) / 2, y = (1 - v.y) / 2; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    });
    return x1 > x0 ? {x0, x1, y0, y1} : null;
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed || document.hidden || !this.visible) return;
    // rAF hands the frame's start time, which can be earlier than the performance.now() kick() stored: a negative step grew the fling (k > 1) and turned the board backwards each frame, the "frantic" drag. Never below zero.
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = Math.max(this.last, now);
    let draw = this.dirty, moving = false;
    if (this.spinOn) { this.spinAngle += dt * 0.28; draw = true; }
    if (!this.drag && (Math.abs(this.vel.x) > 0.02 || Math.abs(this.vel.y) > 0.02)) {   // inertia after a release: decays by half every ~0.17 s; none under reduced motion
      this.turnBy(this.vel.x * dt, this.vel.y * dt); const k = Math.pow(0.5, dt / 0.17); this.vel.x *= k; this.vel.y *= k; draw = true; moving = true;
    }
    if (this.mode === 'focus' && this.settleFit && !this.drag && !this.tween && Math.abs(this.vel.x) <= 0.02 && Math.abs(this.vel.y) <= 0.02) {
      // After a turn comes to rest, a board that now pokes out of the frame (stood on end in a wide stage) is brought back inside by backing the camera off; resetting returns to the tight framing.
      this.settleFit = false;
      for (const rig of this.rigs.values()) this.pose(rig);
      const b = this.selectedBox();
      if (b) {
        const over = Math.max(0, 0.05 - b.x0, b.x1 - 0.95, 0.05 - b.y0, b.y1 - 0.95);
        if (over > 0) {
          const c = this.controls, off = this.camera.position.clone().sub(c.target), want = Math.min(c.maxDistance, off.length() * (1 + over * 2.4 + 0.04));
          this.limits(); off.setLength(want); this.camera.position.copy(c.target).add(off); this.camera.lookAt(c.target); this.controls.update(); draw = true;
        }
      }
    }
    if (this.tween) {
      const k = Math.max(0, Math.min(1, (now - this.tween.t0) / this.tween.dur)), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, tw = this.tween;
      const s = new THREE.Spherical(THREE.MathUtils.lerp(tw.from.radius, tw.to.radius, e), THREE.MathUtils.lerp(tw.from.phi, tw.to.phi, e), THREE.MathUtils.lerp(tw.from.theta, tw.to.theta, e));
      const t = tw.fromT.clone().lerp(tw.toT, e);
      this.controls.target.copy(t); this.camera.position.setFromSpherical(s).add(t); this.camera.lookAt(t);
      this.flipAngle = THREE.MathUtils.lerp(tw.fromFlip, tw.toFlip, e);
      this.spinAngle = THREE.MathUtils.lerp(tw.fromSpin, tw.toSpin, e);
      this.turnQ.copy(tw.fromQ).slerp(tw.toQ, e);
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
      this.opts.onFrame?.();
    }
    if (this.spinOn || this.tween || moving || draw) this.raf = requestAnimationFrame(this.loop);
  };

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // quiver-lock: on a resize or a rotation of the phone the board is refit; a zoom the person made is kept in proportion (the whole board stays inside the stage)
    const sp0 = this.sel()?.spec, fit = sp0 && this.mode === 'focus' ? this.sphereDist(Math.hypot(sp0.length / 2, sp0.width / 2, sp0.thickness / 2)) : 0;
    if (fit && this.lastFit && this.preset === null && !this.tween) { const c = this.controls, s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(c.target)); s.radius *= fit / this.lastFit; this.limits(); s.radius = THREE.MathUtils.clamp(s.radius, c.minDistance, c.maxDistance); this.camera.position.setFromSpherical(s).add(c.target); this.camera.lookAt(c.target); }
    if (fit) this.lastFit = fit;
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
  private static Y = new THREE.Vector3(0, 1, 0);
  private static UP = (() => {
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -LEAN).multiply(q);
  })();

  private pose(rig: Rig) {
    const L = rig.spec.length, mat = rig.shadow.material as THREE.MeshBasicMaterial;
    if (this.mode === 'focus') {
      rig.root.visible = rig.id === this.selectedId;
      rig.root.position.set(0, FOCUS_Y, 0); rig.root.quaternion.setFromAxisAngle(Studio.Y, this.spinAngle).premultiply(this.turnQ);
      rig.orient.quaternion.identity(); rig.flip.rotation.x = this.flipAngle;
      rig.shadowRoot.visible = rig.root.visible; rig.shadowRoot.position.set(0, 0.05, 0);
      // a tight contact shadow: the board's footprint on the floor (its eight corners projected down), as an ellipse along its principal axis, fading as the board stands on end
      const fp = this.footprint(rig); rig.shadowRoot.rotation.y = fp.angle; rig.shadow.scale.set(fp.a * 1.75, fp.b * 2.2, 1); mat.opacity = 0.6 * fp.density;
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
      // zoom: never inside the board's bounding sphere (the camera would clip it), never so far out that it is a dot
      const sp = this.sel()?.spec, R = sp ? Math.hypot(sp.length / 2, sp.width / 2, sp.thickness / 2) : 40, fit = this.sphereDist(R); c.minDistance = Math.max(R * 1.25, fit * 0.45); c.maxDistance = fit * 1.8;
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
      // quiver-look: Deck and Bottom look straight down with the board turned nose-up on screen (spin = azimuth + 90°), like the makers'
      // top-down product photos, so the traced outline reads; the target sits a little toward the tail so the board clears the toolbar.
      case 'deck': case 'bottom': {
        const az = -24, sh = 0, a = THREE.MathUtils.degToRad(az);   // quiver-polish: centred (a wide stage's toolbar sits bottom-left, clear of a vertical board)
        return {az, el: 88.5, m: 1.0, flip: p === 'bottom' ? Math.PI : 0, spin: THREE.MathUtils.degToRad(az + 90), target: new THREE.Vector3(Math.sin(a) * sh, y, Math.cos(a) * sh)};
      }
      case 'rail': return {az: 4, el: 7, m: 1.0, flip: 0, spin: 0, target: new THREE.Vector3(0, y - 1, 0)};
      // quiver-look: Tail and Nose from a low three-quarter (22°, about 45° off the board's axis), not end-on, so the outline's end, the fins and
      // the rocker read instead of a foreshortened oval.
      // quiver-polish: a phone's square stage cut the board's far end off; there the end view aims nearer the middle and frames more of the board
      case 'tail': return {az: -51, el: 22, m: 0.55, flip: 0, spin: 0, target: new THREE.Vector3(-L * (this.camera.aspect < 1.3 ? 0.12 : 0.28), y - 1, 0)};
      case 'nose': return {az: 40, el: 22, m: 0.55, flip: 0, spin: 0, target: new THREE.Vector3(L * (this.camera.aspect < 1.3 ? 0.12 : 0.28), y - 1, 0)};
      case 'three': return {az: 30, el: 36, m: 1.0, flip: 0, spin: STAND, target: new THREE.Vector3(0, y, 0)};
      default: return {az: 32, el: 22, m: 1.06, flip: 0, spin: 0, target: new THREE.Vector3(0, y, 0)};
    }
  }
  /** Distance at which a sphere of radius r fits the view at this aspect ratio, with a margin. */
  private sphereDist(r: number) {
    const vf = THREE.MathUtils.degToRad(this.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    return (r * 1.14) / Math.sin(Math.min(vf, hf) / 2);
  }
  private focusPose(p: Preset): CamPose {
    const q = this.presetPose(p), sp = this.sel()?.spec, L = sp?.length ?? 72;
    // The tail view frames the tail third inside its bounding sphere. Other views fit the extents the board can reach at any
    // spin angle: its length across the frame, and at most L·sin(elevation) plus thickness tall. A whole-board sphere left a wide
    // stage half empty (T-016: the board filled ~55% of the stage height).
    const R = Math.hypot(L / 2, (sp?.width ?? 20) / 2, (sp?.thickness ?? 3) / 2);
    // (Deck and Bottom: a phone's stage has pills over its top and bottom, so the board gets more vertical room there.)
    const d = p === 'deck' || p === 'bottom' ? Math.max(this.fitDist((sp?.width ?? 20) * 1.5, L * 1.16), this.sphereDist(R * 0.62)) : p !== 'three' && p !== 'rail' ? this.sphereDist(R) : this.fitDist(L * 1.16, (L * Math.sin(THREE.MathUtils.degToRad(q.el)) + (sp?.thickness ?? 3) + (sp?.width ?? 20) * Math.cos(THREE.MathUtils.degToRad(q.el)) * 0.5) * 1.12);
    return {s: new THREE.Spherical(Math.max(d, 20), Math.PI / 2 - THREE.MathUtils.degToRad(q.el), THREE.MathUtils.degToRad(q.az)), target: q.target, flip: q.flip};
  }
  private currentPose() {
    if (this.mode === 'focus') return this.focusPose(this.preset ?? 'three');
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
    this.still();
    const {s, target, flip} = this.currentPose();
    this.controls.target.copy(target); this.camera.position.setFromSpherical(s).add(target); this.camera.lookAt(target);
    if (this.mode === 'focus') { this.flipAngle = flip; this.spinAngle = this.presetPose(this.preset ?? 'three').spin; }
    this.limits(); this.controls.update(); this.dirty = true; this.kick();
  }
  /** Drops any orbit inertia left from a drag, so a scripted move (preset, reset, framing) lands exactly where it was aimed. Without this,
   *  OrbitControls kept applying the decaying drag delta after a tween ended, worst at low frame rates (Reset stopped ~3° short). */
  private still() { const d = this.controls.enableDamping; this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = d; }
  private glide(pose: CamPose, spinTo?: number) {
    this.still(); this.limits();
    if (this.reduced) {
      this.controls.target.copy(pose.target); this.camera.position.setFromSpherical(pose.s).add(pose.target); this.camera.lookAt(pose.target);
      this.flipAngle = pose.flip; if (spinTo !== undefined) this.spinAngle = spinTo; this.turnQ.identity(); this.vel.x = this.vel.y = 0; this.controls.update(); this.dirty = true; this.kick(); return;
    }
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dTheta = pose.s.theta - from.theta; dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    this.tween = {t0: performance.now(), dur: 950, from, to: new THREE.Spherical(pose.s.radius, pose.s.phi, from.theta + dTheta), fromT: this.controls.target.clone(), toT: pose.target,
      fromFlip: this.flipAngle, toFlip: pose.flip, fromSpin: this.spinAngle, toSpin: spinTo ?? this.spinAngle, fromQ: this.turnQ.clone(), toQ: new THREE.Quaternion()};
    this.vel.x = this.vel.y = 0;
    this.kick();
  }

  /** T-072: thumbnails of the preset angles rendered from the live scene (the board as it is now: shape, colour, fins), as image URLs.
   *  Each pose is drawn into a corner of the main canvas with the stage's own tone mapping and colour output (a render target would skip both,
   *  Codex review of fbbb89c), copied out at once, and the full view is redrawn in the same task, so nothing visible moves. Focus mode only. */
  snapshot(presets: Preset[], w = 200, h = 128): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.mode !== 'focus' || this.disposed || !this.sel()?.resin) return out;
    const r = this.renderer, cam = this.camera, pr = r.getPixelRatio(), buf = r.getDrawingBufferSize(new THREE.Vector2());
    const vw = Math.min(w, Math.floor(buf.x / pr)), vh = Math.min(h, Math.floor(buf.y / pr)), W = Math.round(vw * pr), H = Math.round(vh * pr);
    if (vw < 40 || vh < 30) return out;
    const keep = {pos: cam.position.clone(), aspect: cam.aspect, target: this.controls.target.clone(), flip: this.flipAngle, spin: this.spinAngle};
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
    const clear = new THREE.Color(), alpha = r.getClearAlpha(); r.getClearColor(clear);
    cam.aspect = vw / vh; cam.updateProjectionMatrix();
    try {
      r.setScissorTest(true); r.setViewport(0, 0, vw, vh); r.setScissor(0, 0, vw, vh); r.setClearColor(isDarkTheme() ? 0x2b2e32 : 0xf1f2f1, 1); // the thumbnail's own ground (T-109: dark neutral in dark mode)
      for (const p of presets) {
        const pose = this.focusPose(p), q = this.presetPose(p);
        cam.position.setFromSpherical(pose.s).add(pose.target); cam.lookAt(pose.target);
        this.flipAngle = pose.flip; this.spinAngle = q.spin;
        for (const rig of this.rigs.values()) this.pose(rig);
        r.render(this.scene, cam);
        g.clearRect(0, 0, W, H); g.drawImage(r.domElement, 0, buf.y - H, W, H, 0, 0, W, H); // viewport y=0 is the canvas bottom
        out[p] = c.toDataURL('image/jpeg', 0.86);
      }
    } finally {
      r.setScissorTest(false); r.setViewport(0, 0, buf.x / pr, buf.y / pr); r.setClearColor(clear, alpha);
      cam.aspect = keep.aspect; cam.updateProjectionMatrix(); cam.position.copy(keep.pos); this.controls.target.copy(keep.target); cam.lookAt(keep.target);
      this.flipAngle = keep.flip; this.spinAngle = keep.spin; for (const rig of this.rigs.values()) this.pose(rig);
      r.render(this.scene, cam); // redraw the stage now, in this task, so the corner renders are never seen
      this.dirty = true; this.kick();
    }
    return out;
  }

  /** Focus presets (deck, bottom, rail, tail, nose, three-quarter, 360). */
  goTo(p: Preset) {
    if (this.mode !== 'focus') return;
    this.preset = p; this.spinOn = false;
    const rest = this.presetPose(p).spin, turn = 2 * Math.PI; // nearest equivalent of the rest angle, so the board turns the short way
    this.glide(this.focusPose(p), rest + Math.round((this.spinAngle - rest) / turn) * turn);
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
    if (mode === 'focus') { this.preset = 'three'; this.spinOn = false; this.spinAngle = this.presetPose('three').spin; this.flipAngle = 0; this.turnQ.identity(); this.vel.x = this.vel.y = 0; }
    else { this.framing = 'all'; this.spinOn = false; this.preset = null; }
    this.floor.visible = !(this.room && mode === 'lineup'); for (const b of this.roomBits) b.visible = !!this.room && mode === 'lineup';
    this.catcher.visible = mode === 'focus'; this.key.castShadow = mode === 'focus'; // T-072: the cast shadow belongs to the focus set
    this.controls.enableRotate = mode === 'lineup';
    this.layout();
    for (const r of this.rigs.values()) this.pose(r);
    this.snapFrame(); this.dirty = true; this.kick();
  }
  /** Enter the photographed showroom: real sun shadows on a shadow-catching floor; the CSS backplate is the room. */
  setRoom(rm: RoomSpec | null) {
    for (const b of this.roomBits) { this.scene.remove(b); }
    this.roomBits = []; this.room = rm;
    if (rm) {
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap  /* R14: PCFSoftShadowMap is removed in this three.js (it warned on every load) */;
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
  /** Back to the preset the view started from (or the three-quarter view after a free orbit). */
  reset(p: Preset = 'three') { if (this.mode === 'focus') this.goTo(p); else this.frame('all'); }
  /** Where the hotspot anchors of the selected board are on screen (Focus only). Hidden anchors (behind the board, off screen) are off. */
  anchors(): Record<Anchor, AnchorPos> | null {
    const r = this.sel(); if (!r || this.mode !== 'focus' || !r.root.visible || !r.resin) return null;
    const L = r.spec.length, T = r.spec.thickness;
    r.root.updateWorldMatrix(true, true);
    // Anchors come from the mesh itself (nose and tail tips, the widest rail point), so rocker and outline are respected; fins use one fin.
    const ex = this.extremes(r);
    const fin = r.fins.children[0];
    const fins = fin ? fin.position.clone().add(new THREE.Vector3(0, -Math.min(3, T), 0)) : ex.tail.clone().add(new THREE.Vector3(L * 0.1, -T * 0.6, 0));
    const local: Record<Anchor, THREE.Vector3> = {nose: ex.nose.clone().lerp(ex.mid, 0.07), tail: ex.tail.clone().lerp(ex.mid, 0.05), fins, rail: ex.rail};
    const meshes: THREE.Object3D[] = [r.shape, r.fins], rect = this.canvas.getBoundingClientRect(), cam = this.camera.position, out = {} as Record<Anchor, AnchorPos>;
    for (const k of Object.keys(local) as Anchor[]) {
      const w = local[k].clone().applyMatrix4(r.flip.matrixWorld), ndc = w.clone().project(this.camera);
      const dist = cam.distanceTo(w);
      this.raycaster.set(cam, w.clone().sub(cam).normalize());
      const hit = this.raycaster.intersectObjects(meshes, true)[0];
      const hidden = !!hit && hit.distance < dist - Math.max(1.2, T * 0.6);
      out[k] = {x: ((ndc.x + 1) / 2) * rect.width, y: ((1 - ndc.y) / 2) * rect.height, on: !hidden && Math.abs(ndc.x) < 0.94 && Math.abs(ndc.y) < 0.92 && ndc.z < 1};
    }
    return out;
  }
  private ext = new WeakMap<Rig, {key: string; nose: THREE.Vector3; tail: THREE.Vector3; rail: THREE.Vector3; mid: THREE.Vector3}>();
  /** Nose tip, tail tip and widest rail point of a board's resin, in its flip space (inches); cached per shape. */
  private extremes(r: Rig) {
    const hit = this.ext.get(r); if (hit && hit.key === r.fillKey) return hit;
    const pos = r.resin!.geometry.getAttribute('position') as THREE.BufferAttribute, L = r.spec.length, v = new THREE.Vector3();
    const nose = new THREE.Vector3(-Infinity), tail = new THREE.Vector3(Infinity), rail = new THREE.Vector3(0, 0, -Infinity);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.x > nose.x) nose.copy(v);
      if (v.x < tail.x) tail.copy(v);
      if (Math.abs(v.x) < 0.12 && v.z > rail.z) rail.copy(v);
    }
    const out = {key: r.fillKey, nose: nose.multiplyScalar(L), tail: tail.multiplyScalar(L), rail: rail.multiplyScalar(L), mid: new THREE.Vector3()};
    this.ext.set(r, out); return out;
  }
  setSpin(on: boolean) { this.spinOn = on && !this.reduced && this.mode === 'focus'; this.kick(); }
  /** Keyboard alternative to dragging: turn, tilt and zoom in small steps. */
  nudge(dAz: number, dEl: number, zoom: number) {
    this.tween = null; this.preset = null; this.framing = null;
    if (this.mode === 'focus') {   // quiver-lock: arrows turn the board about the vertical and the horizontal axis; plus and minus zoom
      if (dAz || dEl) this.turnBy(dAz, dEl);
      if (zoom !== 1) { const c = this.controls, s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(c.target)); s.radius = THREE.MathUtils.clamp(s.radius * zoom, c.minDistance, c.maxDistance); this.camera.position.setFromSpherical(s).add(c.target); this.camera.lookAt(c.target); }
      this.dirty = true; this.kick(); return;
    }
    const c = this.controls, s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(c.target));
    s.theta = THREE.MathUtils.clamp(s.theta + dAz, c.minAzimuthAngle, c.maxAzimuthAngle);
    s.phi = THREE.MathUtils.clamp(s.phi - dEl, Math.max(0.05, c.minPolarAngle), c.maxPolarAngle); s.radius = THREE.MathUtils.clamp(s.radius * zoom, c.minDistance, c.maxDistance);
    this.camera.position.setFromSpherical(s).add(c.target); this.camera.lookAt(c.target);
    this.dirty = true; this.kick();
  }

  // ----------------------------------------------------------------- free turning (quiver-lock)
  /** Turn the board about the world's vertical axis by `yaw` and about the camera's horizontal axis by `pitch` (radians): a trackball, so any side, the rails and the underside are reachable. */
  private turnBy(yaw: number, pitch: number) {
    if (this.mode !== 'focus' || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    if (yaw) this.turnQ.premultiply(new THREE.Quaternion().setFromAxisAngle(Studio.Y, yaw));
    if (pitch) this.turnQ.premultiply(new THREE.Quaternion().setFromAxisAngle(right, pitch));
    this.turnQ.normalize(); if (![this.turnQ.x, this.turnQ.y, this.turnQ.z, this.turnQ.w].every(Number.isFinite)) { this.turnQ.identity(); this.vel.x = this.vel.y = 0; }
    this.preset = null; this.dirty = true; this.kick();
  }
  /** The board's footprint on the floor: its eight bounding-box corners (nose to tail, deck to bottom, rail to rail) projected down, as a principal axis and half-extents; `density` falls as the board stands on end. */
  private footprint(rig: Rig) {
    const sp = rig.spec, hx = sp.length / 2, hy = Math.max(1, sp.thickness / 2), hz = sp.width / 2, q = new THREE.Quaternion().setFromAxisAngle(Studio.Y, this.spinAngle).premultiply(this.turnQ);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.flipAngle));
    const pts: [number, number][] = []; const v = new THREE.Vector3();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { v.set(sx * hx, sy * hy, sz * hz).applyQuaternion(q); pts.push([v.x, v.z]); }
    let cxx = 0, czz = 0, cxz = 0; for (const [x, z] of pts) { cxx += x * x; czz += z * z; cxz += x * z; }
    const angle = 0.5 * Math.atan2(2 * cxz, cxx - czz);   // principal axis in the floor plane
    const c = Math.cos(angle), s = Math.sin(angle); let a = 0.5, b = 0.5;
    for (const [x, z] of pts) { a = Math.max(a, Math.abs(x * c + z * s)); b = Math.max(b, Math.abs(-x * s + z * c)); }
    const flat = Math.min(1, (hx * hz * 4) / Math.max(1, a * b * 4 * 1.0)), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert());   // how close the deck normal is to vertical
    return {angle: -angle, a: Math.max(a, 6), b: Math.max(b, 4), density: THREE.MathUtils.clamp(0.35 + 0.65 * Math.abs(up.y) * (flat > 0 ? 1 : 1), 0.35, 1)};
  }
  private onTurnDown = (e: PointerEvent) => {
    if (this.mode !== 'focus' || this.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.drag = {id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), sx: e.clientX, sy: e.clientY, moved: false}; this.vel.x = this.vel.y = 0;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* not capturable (synthetic) */ }
  };
  private onTurnMove = (e: PointerEvent) => {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, now = performance.now(), dt = Math.max(12, now - d.t), K = 0.0085;   // a step under ~12 ms (coalesced events on a busy machine) no longer reads as a huge flick
      // radians per pixel: a full turn across about 740 px
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
    // Phone, not full screen: a swipe that starts more up-and-down than sideways belongs to the page (it scrolls); the viewer lets go of it.
    if (!d.moved && e.pointerType === 'touch' && this.canvas.style.touchAction === 'pan-y' && Math.abs(e.clientY - d.sy) > Math.abs(e.clientX - d.sx)) { this.drag = null; try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ } return; }
    if (!d.moved) { d.moved = true; this.tween = null; this.spinOn = false; this.preset = null; this.opts.onUserMove(); }
    this.turnBy(dx * K, dy * K);
    // smoothed release velocity (rad/s)
    const a = 0.5; this.vel.x = this.vel.x * (1 - a) + ((dx * K) / dt) * 1000 * a; this.vel.y = this.vel.y * (1 - a) + ((dy * K) / dt) * 1000 * a;
    d.x = e.clientX; d.y = e.clientY; d.t = now;
  };
  private onTurnUp = (e: PointerEvent) => {
    const d = this.drag; if (!d || e.pointerId !== d.id) return; this.drag = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (this.reduced || performance.now() - d.t > 90) { this.vel.x = this.vel.y = 0; }   // a pause before letting go means no fling
    else { const m = 4; this.vel.x = THREE.MathUtils.clamp(this.vel.x, -m, m); this.vel.y = THREE.MathUtils.clamp(this.vel.y, -m, m); this.kick(); }
    if (d.moved) { this.settleFit = true; this.kick(); }
    // a quick second tap or click in the same place resets the view
    if (!d.moved) { const now = performance.now(); if (now - this.lastTap.t < 320 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 28) { this.lastTap.t = 0; this.reset(); } else this.lastTap = {t: now, x: e.clientX, y: e.clientY}; }
  };
  private onDbl = () => { if (this.mode === 'focus') this.reset(); };
  private onLost = (e: Event) => { e.preventDefault(); if (!this.disposed) this.opts.onError(); };
  /** Full screen on a phone: every drag turns the board (the page does not scroll behind it). */
  setFull(on: boolean) { this.canvas.style.touchAction = on || !this.coarse ? 'none' : 'pan-y'; }

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
      trim: null, finMatOwn: null,
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
    rig.tex?.dispose(); rig.resinMat.dispose(); rig.stringerMat.dispose(); rig.finMatOwn?.dispose(); (rig.shadow.material as THREE.Material).dispose(); rig.shadow.geometry.dispose();
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
      rig.spec = e.spec; rig.look = e.look; this.setTrim(rig, e.trim ?? null); if (!e.deckTex && e.look.pattern && e.patternHw) this.setPattern(rig, e.look.pattern, e.patternHw); else this.setDeckTex(rig, e.deckTex ?? '');
      if (rig.tplKey !== key || !rig.tpl) {
        rig.shape.clear(); rig.resin?.geometry.dispose(); rig.stringer?.geometry.dispose();
        rig.tpl = cloneTpl(tpls[i]); rig.tplKey = key; rig.fillKey = ''; rig.lookKey = ''; rig.finKey = '';
        rig.resin = new THREE.Mesh(rig.tpl.resin.geom, rig.resinMat); rig.stringer = new THREE.Mesh(rig.tpl.stringer.geom, rig.stringerMat); rig.resin.castShadow = rig.stringer.castShadow = true;
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
    const bulge = s.exact ? 0 : THREE.MathUtils.clamp((fill - FILL_REF[s.template]) * 1.6, -0.2, 0.2) * tpl.thickness;
    const tk = s.exact ? 1 : TAIL_K[(s.tail ?? '').trim().toLowerCase()] ?? 1;
    const key = [rig.tplKey, L, kT.toFixed(4), kW.toFixed(4), bulge.toFixed(4), tk].join('|');
    if (key !== rig.fillKey) {
      rig.fillKey = key;
      for (const part of [tpl.resin, tpl.stringer]) {
        const pos = part.geom.getAttribute('position') as THREE.BufferAttribute, p0 = part.pos0, nr = part.nrm0, st = part.station, half = tpl.width / 2;
        let uv = part.geom.getAttribute('uv') as THREE.BufferAttribute | undefined;
        if (!uv || uv.count !== pos.count) { uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); part.geom.setAttribute('uv', uv); }
        for (let i = 0; i < pos.count; i++) {
          const y0 = p0[i * 3 + 1], z0 = p0[i * 3 + 2], yb = tpl.ymin[st[i]];
          const q = Math.min(1, Math.abs(z0) / half), dir = Math.max(-1, Math.min(1, nr[i * 3 + 1] * 3));
          const x = p0[i * 3], y = yb + (y0 - yb) * kT + dir * bulge * Math.pow(q, 1.5), tt = THREE.MathUtils.clamp((TAIL_ZONE - x) / 0.16, 0, 1), z = z0 * kW * (1 + (tk - 1) * tt * tt);
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
    const lk = JSON.stringify(look) + (rig.tex ? 'T' + rig.texSrc.slice(0, 40) : '') + (rig.spec.softTop ? 'S' : '');
    if (lk === rig.lookKey) return;
    rig.lookKey = lk;
    const tint = TINTS.find((t) => t.key === look.tint) ?? TINTS[0], tintC = new THREE.Color(tint.hex), hasTint = tint.key !== 'none';
    const mix = (c: THREE.Color) => (hasTint ? c.lerp(c.clone().multiply(tintC), 0.78) : c);
    const deck = mix(new THREE.Color(look.finish === 'clear' ? FOAM : look.deck)), bottom = mix(new THREE.Color(look.finish === 'clear' ? FOAM : look.bottom));
    const f = 0.05 + look.fade * 0.85, photo = !!rig.tex, pattern = rig.texSrc.startsWith('pattern:');
    const col = tpl.resin.geom.getAttribute('color') as THREE.BufferAttribute, nr = tpl.resin.nrm0, c = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      if (pattern && look.pattern === 'carbon') c.copy(deck);   // quiver-polish: the carbon atlas colours deck, rails and bottom itself
      // quiver-polish: a soft-top's rails are the solid band colour from just below the rail's apex (the old -f..f blend left the apex half white,
      // so the navy read as a bright royal); the slick bottom stays the bottom colour
      else if (pattern && look.pattern === 'stripes') c.copy(bottom).lerp(deck.clone().multiplyScalar(0.62), smooth(-0.55, -0.3, nr[i * 3 + 1])).lerp(WHITE, smooth(0.45, 0.8, nr[i * 3 + 1]));
      else if (pattern) c.copy(bottom).lerp(deck, smooth(-f, f, nr[i * 3 + 1])).lerp(WHITE, smooth(0.45, 0.8, nr[i * 3 + 1]));   // the rails in the look's colour, the deck white under the pattern
      else if (photo) c.copy(bottom).lerp(WHITE, smooth(0.45, 0.8, nr[i * 3 + 1])); else c.copy(bottom).lerp(deck, smooth(-f, f, nr[i * 3 + 1]));
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
    (m.userData.bottomRough as {value: number}).value = rig.spec.softTop ? 0.3 : -1;
    // quiver-look: a white sheen at 0.3 washed the soft-top's navy and royal into periwinkle; foam keeps its colour with a faint, deck-tinted sheen.
    if (rig.spec.softTop) { m.roughness = 0.9; m.clearcoat = 0; m.sheen = 0.06; m.sheenRoughness = 0.9; m.sheenColor.set(0xdfe6f2); m.envMapIntensity = 0.45; m.normalScale.set(0.1, 0.1); }   // closed-cell foam, no resin gloss   // a soft-top: the slick bottom skin under the matte foam deck
    if (rig.stringer) rig.stringer.visible = !rig.spec.softTop && look.pattern !== 'carbon';   // no stringer shows through a soft-top's foam or the carbon deck
    // quiver-look: carbon is a satin weave, not polished metal: roughness ~0.48, a thin soft clearcoat, the weave's relief in the normal map.
    // quiver-polish: straight-down views reflected the overhead light strips and turned the black weave mid-grey; carbon takes less of the room
    if (look.pattern === 'carbon') { m.roughness = 0.5; m.clearcoat = 0.12; m.clearcoatRoughness = 0.45; m.sheen = 0.02; m.envMapIntensity = 0.32; m.specularIntensity = 0.35; m.normalScale.set(0.22, 0.22); }
    if (rig.stringer && rig.trim && rig.trim.stringer === null) rig.stringer.visible = false;   // an example model whose photos show no centre line
    w.color.set(rig.trim?.stringer ?? WOOD); if (hasTint) w.color.multiply(tintC.clone().lerp(new THREE.Color(1, 1, 1), 0.5));
    w.roughness = look.finish === 'matte' ? 0.7 : 0.45; w.clearcoat = look.finish === 'matte' ? 0 : 0.8; w.clearcoatRoughness = 0.06;
    m.needsUpdate = true; w.needsUpdate = true;
  }

  /** quiver-look: an example model's trim. Its fins are solid, satin-glossed foils in the model's colour (black, the soft-top's blue) instead of
   *  the default smoky glass; the stringer colour is applied in applyLook. */
  private setTrim(rig: Rig, trim: {stringer: string | null; fin: string} | null) {
    const k = (t: typeof trim) => (t ? `${t.stringer}|${t.fin}` : '');
    if (k(trim) === k(rig.trim)) return;
    rig.trim = trim; rig.finMatOwn?.dispose(); rig.finMatOwn = null; rig.lookKey = ''; rig.finKey = '';
    if (trim) rig.finMatOwn = new THREE.MeshPhysicalMaterial({color: new THREE.Color(trim.fin), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide});
  }

  /** A procedural deck pattern for an example model (drawn once per outline into the same atlas as a deck photo). */
  private setPattern(rig: Rig, kind: 'carbon' | 'stripes', hw: number[]) {
    const src = `pattern:${kind}:${hw.join(',')}`;
    if (rig.texSrc === src) return;
    rig.texSrc = src; rig.tex?.dispose();
    const t = new THREE.CanvasTexture(patternCanvas(kind, hw)); t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.anisotropy = 8;
    rig.tex = t; rig.lookKey = '';
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
    const key = [look.fins, s.length, s.width, s.thickness, s.volume, rig.tplKey, rig.fillKey, rig.trim?.fin ?? ''].join('|');
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
        : look.fins === 'quad' ? [{name: 'fin_side_R', x: fromTail(0.2), side: 1, edge: 1.35, scale: bigger}, {name: 'fin_side_L', x: fromTail(0.2), side: -1, edge: 1.35, scale: bigger},
          {name: 'fin_side_R', x: fromTail(0.11), side: 1, edge: 2.4, scale: bigger * 0.82}, {name: 'fin_side_L', x: fromTail(0.11), side: -1, edge: 2.4, scale: bigger * 0.82}]   // a quad: the rear pair smaller, further in
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
          m.material = (m.material as THREE.Material).name === 'FinBase' ? this.baseMat : rig.finMatOwn ?? this.finMat;
        });
        fin.position.copy(hit.point).addScaledVector(n, -0.05); fin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
        fin.scale.setScalar(f.scale); fin.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
        rig.fins.add(fin);
      }
      this.dirty = true; this.kick();
    });
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('pointerdown', this.onDown); this.canvas.removeEventListener('pointerup', this.onUp); this.canvas.removeEventListener('pointermove', this.onHover);
    for (const [ev, fn] of [['pointerdown', this.onTurnDown], ['pointermove', this.onTurnMove], ['pointerup', this.onTurnUp], ['pointercancel', this.onTurnUp], ['dblclick', this.onDbl], ['webglcontextlost', this.onLost]] as [string, EventListener][]) this.canvas.removeEventListener(ev, fn);
    this.ro.disconnect(); this.io.disconnect(); this.themeMo.disconnect(); this.controls.dispose();
    // Template and fin geometry stay cached for the session; everything the scene owns is released here.
    for (const rig of [...this.rigs.values()]) this.removeRig(rig);
    this.floor.geometry.dispose(); const fm = this.floor.material as THREE.MeshBasicMaterial; fm.map?.dispose(); fm.dispose();
    this.shadowTex.dispose(); this.weave.dispose();
    [this.finMat, this.baseMat].forEach((m) => m.dispose());
    this.env.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
