// T-092 (rebuild, map-maplibre): the enclosed-water mask with OpenStreetMap water near the existing bays.
// The 1:10m Natural Earth coastline in enclosed-waters.ts has no tidal creeks, sloughs or salt ponds (Alameda estuary, Redwood Shores, Corte Madera/Larkspur creeks, Bolinas Lagoon channels), so they were classed as open
// sea and the map painted the model's open-ocean value there. Here the OSM "ocean" water polygons (OpenFreeMap vector tiles of OpenStreetMap, ODbL, fetched once; nothing is committed but the mask) of the tiles
// around every existing enclosed cell are rasterised at 0.002 degrees, a 0.01 degree cell with more than 5% ocean water counts as water, and the SAME open-core rule decides: water far from the open Pacific is enclosed.
// Open coast stays open (Drakes Bay, Monterey Bay, the sea outside the Golden Gate): the rule is distance to the open core, unchanged.
// Run: node --experimental-strip-types docs/forecast/data/enclosed-waters-osm.ts   (needs network; dev dependencies @mapbox/vector-tile and pbf)
import fs from 'node:fs';
import {PbfReader} from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {build, GRID, RULE} from './enclosed-waters.ts';

const Z = 12, SUB = 5, W = GRID.w, H = GRID.h, STEP = GRID.step, KX = Math.cos((37 * Math.PI) / 180) * 111.19, KY = 111.19;
const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * 2 ** Z), tileY = (lat: number) => { const s = Math.sin((lat * Math.PI) / 180); return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** Z); };
const lonOf = (x: number) => (x / 2 ** Z) * 360 - 180, latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;

const base = build(), pad = 0.06; // 6 km
const tiles = new Set<string>();
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { if (!base.enc[j * W + i]) continue; const lon = GRID.lon0 + (i + 0.5) * STEP, lat = GRID.lat0 + (j + 0.5) * STEP; for (let x = tileX(lon - pad); x <= tileX(lon + pad); x++) for (let y = tileY(lat + pad); y <= tileY(lat - pad); y++) tiles.add(`${x}/${y}`); }
console.log(`${tiles.size} z${Z} tiles around ${base.cells} enclosed cells`);

const tj = (await (await fetch('https://tiles.openfreemap.org/planet')).json()) as {tiles: string[]}, tpl = tj.tiles[0];
// sub-grid mask over the whole grid at STEP/SUB
const SW = W * SUB, SH = H * SUB, mask = new Uint8Array(SW * SH);
const fill = (rings: [number, number][][]) => { // even-odd scanline over the sub-grid, rings in lon/lat
  let ymin = Infinity, ymax = -Infinity; for (const r of rings) for (const [, y] of r) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const j0 = Math.max(0, Math.floor((ymin - GRID.lat0) / (STEP / SUB))), j1 = Math.min(SH - 1, Math.ceil((ymax - GRID.lat0) / (STEP / SUB)));
  for (let j = j0; j <= j1; j++) { const lat = GRID.lat0 + (j + 0.5) * (STEP / SUB), xs: number[] = [];
    for (const r of rings) for (let k = 1; k < r.length; k++) { const [x1, y1] = r[k - 1], [x2, y2] = r[k]; if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1)); }
    xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil((xs[k] - GRID.lon0) / (STEP / SUB) - 0.5)), i1 = Math.min(SW - 1, Math.floor((xs[k + 1] - GRID.lon0) / (STEP / SUB) - 0.5)); for (let i = i0; i <= i1; i++) mask[j * SW + i] = 1; } }
};
let done = 0, polys = 0;
for (const t of tiles) {
  const [x, y] = t.split('/').map(Number); let buf: ArrayBuffer | null = null;
  for (let a = 0; a < 3 && !buf; a++) { try { const r = await fetch(tpl.replace('{z}', String(Z)).replace('{x}', String(x)).replace('{y}', String(y))); if (r.status === 404) { buf = new ArrayBuffer(0); } else if (r.ok) buf = await r.arrayBuffer(); } catch { /* retry */ } }
  if (buf && buf.byteLength) {
    const layer = new VectorTile(new PbfReader(buf)).layers.water; if (layer) for (let k = 0; k < layer.length; k++) { const f = layer.feature(k); if (f.type !== 3 || f.properties.class !== 'ocean') continue;
      const ext = f.extent ?? 4096, rings = f.loadGeometry().map((r) => r.map((p) => [lonOf(x + p.x / ext), latOf(y + p.y / ext)] as [number, number]));
      // a ring that touches the tile edge is closed along the edge by the tile itself: fill each feature's rings together (even-odd)
      fill(rings); polys++; }
  }
  if (++done % 25 === 0) console.log(`${done}/${tiles.size}`);
}
const osm = new Uint8Array(W * H); let wc = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let n = 0; for (let b = 0; b < SUB; b++) for (let a = 0; a < SUB; a++) n += mask[(j * SUB + b) * SW + i * SUB + a]; if (n / (SUB * SUB) > 0.05) { osm[j * W + i] = 1; wc++; } }
const {rows, cells} = build(osm);
fs.writeFileSync(new URL('../../../src/map/enclosed-waters.json', import.meta.url), JSON.stringify({source: 'Natural Earth 10m land v5.1.2 (src/map/coast.json) plus OpenStreetMap ocean water near the enclosed cells (OpenFreeMap tiles, ODbL, (c) OpenStreetMap contributors); docs/forecast/data/enclosed-waters-osm.ts', rule: RULE, ...GRID, rows}));
console.log(`OSM water cells ${wc}, polygons ${polys}; enclosed cells ${base.cells} -> ${cells} (about ${(cells * STEP * STEP * KX * KY).toFixed(0)} km2)`);
