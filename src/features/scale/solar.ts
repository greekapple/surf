/** wave-v3 P5a: where the sun is at a spot and hour, and the lighting the live wave uses for it. NOAA simplified solar position
 *  (about a minute and a few tenths of a degree), the same model as src/ocean/sun.ts. An illustration of the light at that hour,
 *  not a sky observation (no clouds, fog or haze). */
import {evidenceSpots} from '../../ocean/spots.ts';

const R = Math.PI / 180;

/** Sun elevation and azimuth (degrees; azimuth clockwise from north) at a UTC time and place. */
export function sunPosition(ms: number, lat: number, lon: number): {elevation: number; azimuth: number} {
  const jd = ms / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * R);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60, eps = eps0 + 0.00256 * Math.cos((125.04 - 1934.136 * T) * R);
  const dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R));
  const y = Math.tan(eps * R / 2) ** 2;
  const eqt = 4 / R * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) + 4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R) - 0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R));
  const utcMin = ((ms / 60000) % 1440 + 1440) % 1440, tst = ((utcMin + eqt + 4 * lon) % 1440 + 1440) % 1440, ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cz = Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha * R), zen = Math.acos(Math.max(-1, Math.min(1, cz)));
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(lat * R) * Math.cos(zen) - Math.sin(dec)) / (Math.cos(lat * R) * Math.sin(zen))))) / R;
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360;
  return {elevation: 90 - zen / R, azimuth: az};
}

/** A spot's coordinates and seaward shore normal (CDIP MOP), falling back to Ocean Beach like the daylight service. */
export function spotGeo(spotId: string): {lat: number; lon: number; seaward: number} {
  const e = evidenceSpots.find((s) => s.id === spotId) as {latitude?: number; longitude?: number; orientation?: number | null} | undefined;
  return {lat: e?.latitude ?? 37.76, lon: e?.longitude ?? -122.51, seaward: e?.orientation ?? 263.49};
}

/** Compass azimuth -> direction in the wave scene (crest along x, seaward +z, beach -z), seen from above. */
export function sceneDir(azimuth: number, seaward: number): [number, number] {
  const d = (azimuth - seaward) * R; return [-Math.sin(d), Math.cos(d)];
}

type RGB = [number, number, number];
export interface Lighting {
  sun: [number, number, number]; elevation: number; azimuth: number;
  /** sun colour times its strength on the water (0 once the sun is down) */ sunColor: RGB;
  horizon: RGB; top: RGB; /** warm sky glow low toward the sun (golden hour, twilight) */ glow: RGB; /** overall light on the water body and foam, 1 = daylight */ ambient: number;
  hemiSky: RGB; hemiGround: RGB; hemiIntensity: number; dirIntensity: number; phase: 'day' | 'golden' | 'twilight' | 'night';
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/** The light for a sun elevation: daylight, a warm low sun, then honest twilight (no direct sun, dim and cool) and night. sRGB colours. */
export function lightingFor(elevation: number, azimuth: number, seaward: number): Lighting {
  const [dx, dz] = sceneDir(azimuth, seaward), el = Math.max(elevation, -18) * R;
  // the light direction stays a little above the horizon so the shader's backlight and shading keep a sense of where the glow is
  const ly = Math.max(Math.sin(el), 0.04), lh = Math.sqrt(1 - ly * ly), sun: [number, number, number] = [dx * lh, ly, dz * lh];
  const day = sm(-1, 12, elevation), low = 1 - sm(2, 20, elevation), dusk = sm(-12, -0.5, elevation);
  const direct = sm(-1.5, 3, elevation);
  const sunTint = mix(hex('#fff3df'), hex('#ffb070'), low * 0.85);
  const sunColor = sunTint.map((c) => c * direct * (0.55 + 0.45 * sm(3, 25, elevation))) as RGB;
  const dayTop = hex('#86a3bb'), dayHor = hex('#dde4e6');
  const goldHor = hex('#f0d2b4'), twTop = hex('#3a4d68'), twHor = hex('#9a97a3'), nightTop = hex('#18253b'), nightHor = hex('#3a4558');
  let top = mix(nightTop, twTop, dusk), horizon = mix(nightHor, twHor, dusk);
  top = mix(top, dayTop, day); horizon = mix(horizon, mix(dayHor, goldHor, low * 0.6), day);
  // after dark the scene is kept dim but readable (a size comparison you cannot see is no use); the caption says it is brightened
  const ambient = 0.32 + 0.22 * dusk + 0.46 * day;
  const phase = elevation > 8 ? 'day' : elevation > -0.833 ? 'golden' : elevation > -6 ? 'twilight' : 'night';
  const glow = hex('#ff9c5a').map((c) => c * (0.3 * low * day + 0.4 * dusk * (1 - day))) as RGB;
  return {sun, elevation, azimuth, sunColor, horizon, top, glow, ambient, hemiSky: mix(hex('#5d6f8c'), hex('#dfeaf2'), day), hemiGround: mix(hex('#0d1c26'), hex('#2b5d70'), day),
    hemiIntensity: 0.25 + 0.85 * (0.3 * dusk + 0.7 * day), dirIntensity: 2.2 * direct, phase};
}

/** Lighting at a spot and hour (ISO time). */
export function lightingAt(spotId: string, iso: string): Lighting | null {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return null;
  const g = spotGeo(spotId), p = sunPosition(t, g.lat, g.lon);
  return lightingFor(p.elevation, p.azimuth, g.seaward);
}
