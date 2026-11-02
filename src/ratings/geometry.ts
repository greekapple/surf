/** Smallest angle between two compass bearings, 0–180. */
export const angleDiffDeg = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return d > 180 ? 360 - d : d; };
