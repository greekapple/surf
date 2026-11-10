/** Is a point on land? Natural Earth land polygons already in the app: the 10 m West Coast clip (coast.json, California) where the point lies inside its box, the 50 m world file (land-globe.json) elsewhere.
 *  Even-odd ray casting over every ring. Used by the spot importer (docs/forecast/data/add-spots.ts) so a marine query point that falls on land fails loudly instead of returning no wave data. */
import coast from './coast.json' with {type: 'json'};
import globe from './land-globe.json' with {type: 'json'};

type Ring = [number, number][];
const inRing = (lon: number, lat: number, r: Ring): boolean => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c; };
const COAST_BOX = [-128.0, 31.0, -115.5, 43.5];
const coastRings = (coast as unknown as {rings: Ring[]}).rings, globeRings = (globe as unknown as {rings: {b: number[]; r: Ring}[]}).rings;
export function pointOnLand(lat: number, lon: number): boolean {
  if (lon >= COAST_BOX[0] && lon <= COAST_BOX[2] && lat >= COAST_BOX[1] && lat <= COAST_BOX[3]) { let c = false; for (const r of coastRings) if (inRing(lon, lat, r)) c = !c; return c; }
  let c = false; for (const g of globeRings) { const [x0, y0, x1, y1] = g.b; if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue; if (inRing(lon, lat, g.r)) c = !c; } return c;
}
