import enclosedData from './enclosed-waters.json' with {type: 'json'};

/** T-092: enclosed waters (bays, harbours, estuaries) where the sea-state grid (0.25 to 0.5 degree cells) is not meaningful. Built from the repo's own 1:10m coastline by
 *  docs/forecast/data/enclosed-waters.ts (a water point is enclosed when more than 75% of 24 rays hit land within 20 km). Display only: the raster, arrows and flow skip these points. */
const d = enclosedData as {lon0: number; lat0: number; step: number; w: number; h: number; rows: number[][]};
const grid = new Uint8Array(d.w * d.h);
d.rows.forEach((runs, j) => { for (let r = 0; r < runs.length; r += 2) for (let i = runs[r]; i < runs[r] + runs[r + 1]; i++) grid[j * d.w + i] = 1; });
export const ENCLOSED_NOTE = 'Enclosed waters (bays, harbours, estuaries) are left blank: the wave-model grid does not resolve them.';
export function isEnclosedWater(lat: number, lon: number): boolean {
  const lonN = ((((lon + 180) % 360) + 360) % 360) - 180; // a wrapped Leaflet world copy (e.g. 237.6 = -122.4) is the same place (T-100)
  const i = Math.floor((lonN - d.lon0) / d.step), j = Math.floor((lat - d.lat0) / d.step);
  return i >= 0 && j >= 0 && i < d.w && j < d.h && grid[j * d.w + i] === 1;
}
export const enclosedCellCount = () => grid.reduce((a, b) => a + b, 0);
