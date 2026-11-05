/** R16: the three.js side of the shared board: `buildBoard`'s geometry as one mesh with a material per part (glossy resin with a clearcoat,
 *  a white deck with the wood stringer, wax only in the foot zone with a bumpy procedural normal map and a matte roughness, the tail pad
 *  in grooved EVA, smoky foiled fins on dark boxes), plus two soft contact-shadow blobs the viewer slides under the feet. Everything is
 *  procedural (no image downloads), so it can be committed. The Quiver's template builder (`quiverTemplate`) lives here too: the same
 *  geometry in the showroom's unit frame (nose at +x, length 1). */
import * as THREE from 'three';
import {buildBoard, type BoardCurves, type BoardGeometryData, type BoardParams, type BoardPart} from './boardMesh';

/** A tangent-space normal map from a height field (tileable): `h(u, v)` in [0, 1] over the unit square. */
function normalTexture(size: number, h: (u: number, v: number) => number, strength: number): THREE.DataTexture {
  const d = new Uint8Array(size * size * 4), H = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) H[j * size + i] = h(i / size, j / size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const l = H[j * size + (i + size - 1) % size], r = H[j * size + (i + 1) % size], dn = H[((j + size - 1) % size) * size + i], up = H[((j + 1) % size) * size + i];
    const nx = -(r - l) * strength, ny = -(up - dn) * strength, len = Math.hypot(nx, ny, 1), o = (j * size + i) * 4;
    d[o] = Math.round((nx / len * 0.5 + 0.5) * 255); d[o + 1] = Math.round((ny / len * 0.5 + 0.5) * 255); d[o + 2] = Math.round((1 / len * 0.5 + 0.5) * 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
/** Wax: soft random bumps (the comb's ridges knocked down by feet), a few per 8 cm tile. */
let waxTex: THREE.DataTexture | null = null;
function waxNormal() {
  if (waxTex) return waxTex;
  const bumps: [number, number, number][] = []; for (let i = 0; i < 9; i++) bumps.push([hash(i, 1), hash(i, 2), 0.16 + 0.14 * hash(i, 3)]);
  return (waxTex = normalTexture(128, (u, v) => { let h = 0; for (const [bx, by, r] of bumps) { let dx = u - bx, dy = v - by; dx -= Math.round(dx); dy -= Math.round(dy); const q = (dx * dx + dy * dy) / (r * r); if (q < 1) h += 0.6 * (1 - q) * (1 - q) * (1 + 0.3 * Math.sin(dx * 90 + dy * 70)); }
    return Math.min(1, h + 0.08 * hash(Math.floor(u * 64), Math.floor(v * 64))); }, 0.8));
}
/** The pad: grooves along the board (across v) and a fine EVA grain. */
let padTex: THREE.DataTexture | null = null;
function padNormal() {
  return (padTex ??= normalTexture(64, (u, v) => 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 4) + 0.1 * hash(Math.floor(u * 64), Math.floor(v * 64)), 3.0));
}
/** The pad's colour: near-black EVA, the three pieces' gaps lighter (the deck shows through), the kick a shade lighter. */
let padMapTex: THREE.DataTexture | null = null;
function padMap() {
  if (padMapTex) return padMapTex;
  const w = 128, hgt = 256, d = new Uint8Array(w * hgt * 4);
  for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) { const u = i / w, v = j / hgt, gap = Math.abs(v - 1 / 3) < 0.012 || Math.abs(v - 2 / 3) < 0.012, kick = u > 0.8;
    const ridge = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 48);   // 48 grooves across the pad: the ridges a shade lighter than the troughs
    const g = gap ? 190 : Math.round((kick ? 78 : 56) + 40 * ridge), o = (j * w + i) * 4; d[o] = g; d[o + 1] = g; d[o + 2] = g + 4; d[o + 3] = 255; }   // charcoal EVA, the ridges a clear step lighter than the troughs, the kick lighter still
  const t = new THREE.DataTexture(d, w, hgt, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return (padMapTex = t);
}
/** A soft radial blob (alpha falls off to the edge) for the contact shadows. */
let blobTex: THREE.DataTexture | null = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const s = 64, d = new Uint8Array(s * s * 4);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const dx = (i + 0.5) / s - 0.5, dy = (j + 0.5) / s - 0.5, r = Math.hypot(dx, dy) * 2, a = Math.max(0, 1 - r * r), o = (j * s + i) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(255 * Math.sqrt(a)); }
  const t = new THREE.DataTexture(d, s, s, THREE.RGBAFormat); t.needsUpdate = true; return (blobTex = t);
}

export const BOARD_PARTS: BoardPart[] = ['resin', 'wax', 'stringer', 'pad', 'fin', 'finbox'];
/** One material per part. `deck` is the resin's base colour (the Quiver's deck colour when a quiver board is shown). */
export function boardMaterials(deck = 0xf4f1ea, softTop?: {foam: number; bottom: number}): Record<BoardPart, THREE.Material> {
  const wax = waxNormal(); wax.repeat.set(1 / 0.14, 1 / 0.14);
  const base = {
    resin: new THREE.MeshPhysicalMaterial({color: deck, roughness: 0.2, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.1, specularIntensity: 0.9}),
    wax: new THREE.MeshPhysicalMaterial({color: 0xf7f4ec, roughness: 0.8, metalness: 0, clearcoat: 0, normalMap: wax, normalScale: new THREE.Vector2(0.3, 0.3)}),
    stringer: new THREE.MeshStandardMaterial({color: 0xc9a66a, roughness: 0.4, metalness: 0, transparent: true, opacity: 0.92}),
    pad: new THREE.MeshStandardMaterial({color: 0xffffff, map: padMap(), roughness: 0.92, metalness: 0, normalMap: padNormal(), normalScale: new THREE.Vector2(0.7, 0.7)}),
    fin: new THREE.MeshPhysicalMaterial({color: 0x8ea3ab, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide}),
    finbox: new THREE.MeshStandardMaterial({color: 0x141414, roughness: 0.55, metalness: 0}),
  };
  if (!softTop) return base;
  // a soft-top: the deck faces ('wax' group) are matte foam with a faint closed-cell bump, the rails and bottom a slick (HDPE-like) skin, no resin gloss
  base.wax.dispose(); base.resin.dispose();
  return {...base,
    wax: new THREE.MeshPhysicalMaterial({color: softTop.foam, roughness: 0.92, metalness: 0, clearcoat: 0, sheen: 0.3, sheenRoughness: 0.8, normalMap: wax, normalScale: new THREE.Vector2(0.12, 0.12)}),
    resin: new THREE.MeshPhysicalMaterial({color: softTop.bottom, roughness: 0.38, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.35, specularIntensity: 0.6}),
  };
}
/** The pad's texture coordinates: u along the pad (0 front, 1 back), v across (-1..1); the colour map spans it once, the grooves 12 times. */
function padUvFix(m: THREE.MeshStandardMaterial) { if (m.map) { m.map = m.map.clone(); m.map.repeat.set(1, 0.5); m.map.offset.set(0, 0.5); m.map.needsUpdate = true; } if (m.normalMap) { m.normalMap = m.normalMap.clone(); m.normalMap.repeat.set(1, 12); m.normalMap.needsUpdate = true; } }

/** `buildBoard`'s output as a BufferGeometry with a group per part (material index = BOARD_PARTS order). */
export function boardGeometry(data: BoardGeometryData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
  for (const g of data.groups) geo.addGroup(g.start, g.count, BOARD_PARTS.indexOf(g.part));
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

export interface BoardObject {
  /** the board (named 'Board': the sim, the monitor and the probes find it by name) */ group: THREE.Group; mesh: THREE.Mesh;
  params: BoardParams; data: BoardGeometryData; curves: BoardCurves; /** the board's materials (the viewer fades them with the rider) */ materials: THREE.Material[];
  /** the contact-shadow blobs (children of `shadows`, which the viewer parents beside the board in the rider frame) */ shadows: THREE.Group; blobs: THREE.Mesh[];
  /** put blob k under a foot: its centre (board frame, m), the foot's yaw about the deck normal (rad) and the footprint (m) */ placeBlob(k: number, x: number, z: number, yaw: number, lengthM: number, widthM: number, strength: number): void;
  dispose(): void;
}
const _n = new Float32Array(3), _up = new THREE.Vector3(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _qy = new THREE.Quaternion();
/** The board as a three.js object in the surfer model's board frame (nose at -x, y up, z across, the bottom's flat spot at y = 0). */
export function buildBoardObject(params: BoardParams, deckColor?: number, bottomColor?: number): BoardObject {
  const data = buildBoard(params), geo = boardGeometry(data), mats = boardMaterials(deckColor, params.softTop?.value ? {foam: deckColor ?? 0xf2f2ee, bottom: bottomColor ?? 0xf2f3f4} : undefined); padUvFix(mats.pad as THREE.MeshStandardMaterial);
  const materials = BOARD_PARTS.map((p) => mats[p]);
  const mesh = new THREE.Mesh(geo, materials); mesh.name = 'BoardHull'; mesh.frustumCulled = false;
  const group = new THREE.Group(); group.name = 'Board'; group.add(mesh);
  const shadows = new THREE.Group(); shadows.name = 'FootShadows'; const blobs: THREE.Mesh[] = [];
  const blobMat = new THREE.MeshBasicMaterial({map: blobTexture(), color: 0x2a3844, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false});
  for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat); b.name = 'FootShadow' + k; b.frustumCulled = false; b.renderOrder = 2; b.visible = false; shadows.add(b); blobs.push(b); }
  const c = data.curves;
  return {
    group, mesh, params, data, curves: c, materials, shadows, blobs,
    placeBlob(k, x, z, yaw, lengthM, widthM, strength) {
      const b = blobs[k], sx = group.scale.x, sy = group.scale.y, sz = group.scale.z;   // the drawn board may be scaled to the band; the blobs sit beside it, unscaled
      c.deckNormalAt(x / sx, z / sz, _n); _up.set(_n[0] / sx, _n[1] / sy, _n[2] / sz).normalize();
      b.position.set(x, c.deckAt(x / sx, z / sz) * sy + 0.002, z); _q.setFromUnitVectors(_y, _up); _qy.setFromAxisAngle(_y, yaw);
      b.quaternion.copy(_q).multiply(_qy).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      b.scale.set(widthM, lengthM, 1); (b.material as THREE.MeshBasicMaterial).opacity = 0.8 * strength; b.visible = strength > 0.01;
    },
    dispose() { geo.dispose(); for (const m of materials) m.dispose(); blobMat.dispose(); for (const b of blobs) b.geometry.dispose(); },
  };
}

/** The Quiver showroom's template from the same geometry: the hull (resin) and the stringer ribbon as two meshes in the showroom's unit
 *  frame (nose at +x, length 1, y up), with the width and thickness as fractions of the length (what `stationTpl` expects). */
export function quiverTemplate(params: BoardParams, detail?: {segments?: number; ring?: number}): {resin: THREE.Mesh; stringer: THREE.Mesh; width: number; thickness: number} {
  const data = buildBoard(params, {fins: false, pad: false, ...detail}), L = data.curves.L, n = data.positions.length / 3, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -data.positions[i * 3] / L; pos[i * 3 + 1] = data.positions[i * 3 + 1] / L; pos[i * 3 + 2] = data.positions[i * 3 + 2] / L; }
  const part = (parts: BoardPart[]) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    const idx: number[] = []; for (const gr of data.groups) if (parts.includes(gr.part)) for (let i = gr.start; i < gr.start + gr.count; i++) idx.push(data.indices[i]);
    // the hull's winding was for nose at -x; mirrored in x it turns inside out, so swap two corners
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const resin = new THREE.Mesh(part(['resin', 'wax']), new THREE.MeshPhysicalMaterial()), stringer = new THREE.Mesh(part(['stringer']), new THREE.MeshPhysicalMaterial({name: 'Stringer'}));
  return {resin, stringer, width: data.curves.W / L, thickness: data.curves.T / L};
}
