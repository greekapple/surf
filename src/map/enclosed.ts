import enclosedData from './enclosed-waters.json' with {type: 'json'};

/** T-092: enclosed waters (bays, harbours, estuaries) where the sea-state grid (0.25 to 0.5 degree cells) is not meaningful. Built from the repo's own 1:10m coastline by
 *  docs/forecast/data/enclosed-waters.ts (a water point is enclosed when more than 75% of 24 rays hit land within 20 km). Display only: the raster, arrows and flow skip these points. */
const d = enclosedData as {lon0: number; lat0: number; step: number; w: number; h: number; rows: number[][]};
const grid = new Uint8Array(d.w * d.h);
d.rows.forEach((runs, j) => { for (let r = 0; r < runs.length; r += 2) for (let i = runs[r]; i < runs[r] + runs[r + 1]; i++) grid[j * d.w + i] = 1; });
export const ENCLOSED_NOTE = 'Enclosed waters (bays, harbours, estuaries) are left blank: the wave-model grid does not resolve them.';
/** How enclosed a point is (0..1): the 0/1 cell grid interpolated bilinearly between cell CENTRES (map-smooth). Its 0.5 contour is the enclosed-water edge, so the edge follows the bays as a smooth line instead of 1 km squares;
 *  the GL shader (glCommon.ts `ENC_GLSL`) evaluates the same function, and paints its 0.5 contour anti-aliased. */
export function enclosedness(lat: number, lon: number): number {
  const lonN = ((((lon + 180) % 360) + 360) % 360) - 180; // a wrapped Leaflet world copy (e.g. 237.6 = -122.4) is the same place (T-100)
  const gx = (lonN - d.lon0) / d.step - 0.5, gy = (lat - d.lat0) / d.step - 0.5; if (!(gx > -1 && gy > -1 && gx < d.w && gy < d.h)) return 0;
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, at = (ii: number, jj: number) => (ii >= 0 && jj >= 0 && ii < d.w && jj < d.h ? grid[jj * d.w + ii] : 0);
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
}
export function isEnclosedWater(lat: number, lon: number): boolean { return enclosedness(lat, lon) >= 0.5; }
export const enclosedCellCount = () => grid.reduce((a, b) => a + b, 0);

/** The enclosed-water grid for the GL field shader (1 = enclosed), same data and rule as `enclosedness`. */
export const enclosedGrid = () => ({lon0: d.lon0, lat0: d.lat0, step: d.step, w: d.w, h: d.h, grid});
