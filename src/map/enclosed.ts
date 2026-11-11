import enclosedData from './enclosed-waters.json' with {type: 'json'};

/** T-092: enclosed waters (bays, harbors, estuaries) have no wave-model value (CONTRACTS "Map field"): transparent, no colour, no label. The mask is
 *  `enclosed-waters.json` (0.01° cells), built from the repo's Natural Earth coastline plus OpenStreetMap ocean water near the bays
 *  (docs/forecast/data/enclosed-waters-osm.ts; © OpenStreetMap contributors, ODbL) with one rule, water far from the open Pacific is enclosed, and named
 *  mouths made explicit (west of the Golden Gate line is open ocean). It covers California only (31.8-43.6 N, 124.8-114.4 W; see `enclosedCovers`).
 *  Display only: the raster, arrows, flow, the pin label and the point panel skip these points. */
const d = enclosedData as {lon0: number; lat0: number; step: number; w: number; h: number; rows: number[][]};
const grid = new Uint8Array(d.w * d.h);
d.rows.forEach((runs, j) => { for (let r = 0; r < runs.length; r += 2) for (let i = runs[r]; i < runs[r] + runs[r + 1]; i++) grid[j * d.w + i] = 1; });
export const ENCLOSED_NOTE = 'Enclosed waters in California (bays, harbors, estuaries) are left blank: the wave model does not resolve them.';
/** How enclosed a point is (0..1): the 0/1 cell grid interpolated bilinearly between cell CENTRES (map-smooth). Its 0.5 contour is the enclosed-water edge, so the edge follows the bays as a smooth line instead of 1 km squares;
 *  the GL shader (glCommon.ts `ENC_GLSL`) evaluates the same function, and paints its 0.5 contour anti-aliased. */
export function enclosedness(lat: number, lon: number): number {
  const lonN = ((((lon + 180) % 360) + 360) % 360) - 180; // a wrapped Leaflet world copy (e.g. 237.6 = -122.4) is the same place (T-100)
  const gx = (lonN - d.lon0) / d.step - 0.5, gy = (lat - d.lat0) / d.step - 0.5; if (!(gx > -1 && gy > -1 && gx < d.w && gy < d.h)) return 0;
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, at = (ii: number, jj: number) => (ii >= 0 && jj >= 0 && ii < d.w && jj < d.h ? grid[jj * d.w + ii] : 0);
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
}
/** Whether the mask grid covers a point at all (it spans 31.8-43.6 N, 124.8-114.4 W): outside it `enclosedness` is 0, which means "not known", not "open sea". */
export const enclosedCovers = (lat: number, lon: number): boolean => { const gx = (lon - d.lon0) / d.step, gy = (lat - d.lat0) / d.step; return gx >= 0 && gy >= 0 && gx < d.w && gy < d.h; };
export function isEnclosedWater(lat: number, lon: number): boolean { return enclosedness(lat, lon) >= 0.5; }
export const enclosedCellCount = () => grid.reduce((a, b) => a + b, 0);

/** The enclosed-water grid for the GL field shader (1 = enclosed), same data and rule as `enclosedness`. */
export const enclosedGrid = () => ({lon0: d.lon0, lat0: d.lat0, step: d.step, w: d.w, h: d.h, grid});
