// forecast-visuals (user, 2026-11-13: "Surfline's swell direction is a little box that shows the coastline"): the geometry behind the coast tiles on the spot page.
// Pure, so it is tested (src/tests/coast-tile.test.ts). The tile is a 5 km square, north up, the spot's pin in the middle (src/data/coastTiles.json, built from
// OpenStreetMap land polygons by tools/coast-tiles/build-coast-tiles.py). Nothing here invents data: the arrow is the forecast's direction, the window is the
// beach's facing ±55° (the same wedge as the compass dials), and a spot with no coastline data shows its facing line only, saying so.
export const TILE = 1000, PIN = 500;
/** where a direction (degrees, clockwise from north) points from the pin, at radius r in tile units (y down) */
export const at = (deg: number, r: number): [number, number] => [PIN + Math.sin((deg * Math.PI) / 180) * r, PIN - Math.cos((deg * Math.PI) / 180) * r];
const f = (n: number) => Math.round(n * 10) / 10;
/** the land rings as one SVG path (even-odd: lakes and lagoons stay sea) */
export const landPath = (rings: number[][]) => rings.map((r) => { let d = ''; for (let i = 0; i < r.length; i += 2) d += `${i ? 'L' : 'M'}${r[i]},${r[i + 1]}`; return `${d}Z`; }).join('');
/** the beach's open-water window: its facing ±55°, out to radius r */
export function windowPath(facing: number, r = 470, half = 55): string {
  const [x1, y1] = at(facing - half, r), [x2, y2] = at(facing + half, r);
  return `M${PIN},${PIN} L${f(x1)},${f(y1)} A${r},${r} 0 0 1 ${f(x2)},${f(y2)}Z`;
}
/** one arrow for a swell or wind that comes FROM `from`: it starts at the tile's edge on that side and points at the pin (where it travels) */
export function arrowGeom(from: number, outer = 430, inner = 92, head = 120, wing = 70) {
  const [x0, y0] = at(from, outer), [x1, y1] = at(from, inner), [hx, hy] = at(from, inner + head);
  const px = Math.cos((from * Math.PI) / 180) * wing, py = Math.sin((from * Math.PI) / 180) * wing;   // perpendicular to the arrow
  return {shaft: `M${f(x0)},${f(y0)} L${f(hx)},${f(hy)}`, head: `M${f(hx + px)},${f(hy + py)} L${f(x1)},${f(y1)} L${f(hx - px)},${f(hy - py)}Z`};
}
/** with no coastline data: the shore drawn as a line through the pin, square to the facing (a schematic, labelled as such) */
export function facingShore(facing: number, half = 300): string { const [x0, y0] = at(facing - 90, half), [x1, y1] = at(facing + 90, half); return `M${f(x0)},${f(y0)} L${f(x1)},${f(y1)}`; }
const C16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass16 = (deg: number) => C16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
/** 3-step period class for the swell arrows (a display bin, said in the key): short under 10 s, mid 10 to 13 s, long 14 s and up */
export const periodStep = (s: number): 'short' | 'mid' | 'long' => (s >= 14 ? 'long' : s >= 10 ? 'mid' : 'short');
export const PERIOD_STEP_WORDS = {short: 'under 10 s', mid: '10–13 s', long: '14 s and up'} as const;
/** arrows on a chart row: every `stepH` hours on the clock (3 on a wide screen, 6 on a phone; 12 only when even 6 would sit closer than `minPx`) */
export const arrowStepH = (pxPerHour: number, wide: boolean, minPx = 11) => { const want = wide ? 3 : 6; return [want, 6, 12, 24].find((s) => s >= want && s * pxPerHour >= minPx) ?? 24; };
