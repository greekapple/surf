// Stage 2b: the client side of the GFS-Wave 0.25° pipeline (tools/map-pipeline/build_frames.py). Pure decoding is here (tested under Node);
// the browser loader at the bottom is only used when a frames base URL is configured, otherwise the map keeps using /api/ocean (WW3 0.5°).
import type {GridData} from './spatial.ts';

export interface PackedGroup {scale: number; unit: string; /** swell height: an exact 0 = no swell partition (wind sea only) */ noPartitionIsZero?: boolean}
export interface PackedManifest {version: number; source: string; run: string; generatedAt: string; grid: {nlon: number; nlat: number; lon0: number; lat0: number; dlon: number; dlat: number}; groups: Record<string, PackedGroup>; frames: {fh: number; validAt: string; files: Record<string, string>}[]}

/** Which pipeline group carries a spatialSpec's scalar (WW3 variable names are what the rest of the map uses). */
export const packedGroupOf = (scalar: string): 'waves' | 'period' | 'swell' | 'swellper' | 'wind' | null =>
  ({Thgt: 'waves', Tper: 'period', shgt: 'swell', sper: 'swellper', ugrd10m: 'wind'} as Record<string, 'waves' | 'period' | 'swell' | 'swellper' | 'wind'>)[scalar] ?? null;

/** RGB pixels (row 0 = north) → a GridData with latitude ascending. R,G = 16-bit value (65535 = no data), B = direction FROM in 360/255° steps (255 = none). */
export function decodePackedPixels(px: ArrayLike<number>, channels: 3 | 4, m: PackedManifest['grid'], scale: number): GridData {
  const {nlon: W, nlat: H} = m, val = new Float32Array(W * H), dir = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const oy = H - 1 - y; // flip: output row 0 is the southern edge
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * channels, q = px[i] * 256 + px[i + 1], o = oy * W + x;
      val[o] = q === 65535 ? NaN : q / scale; dir[o] = q === 65535 || px[i + 2] === 255 ? NaN : (px[i + 2] * 360) / 255;
    }
  }
  return {lat0: m.lat0 + m.dlat * (H - 1), dlat: -m.dlat, nlat: H, lon0: m.lon0, dlon: m.dlon, nlon: W, val, dir};
}

/** The frame for a valid time: exact match only (a different hour is never shifted onto this one). */
export const frameAt = (man: PackedManifest, validAt: string) => man.frames.find((f) => Date.parse(f.validAt) === Date.parse(validAt)) ?? null;

/** Base URL of the frames (a local folder in dev, the R2 public URL later): `VITE_MAP_FRAMES_BASE`, empty = not configured. */
export const framesBase = (): string => { try { return String((import.meta as unknown as {env?: Record<string, string>}).env?.VITE_MAP_FRAMES_BASE ?? '').replace(/\/$/, ''); } catch { return ''; } };

let manifestCache: {base: string; at: number; p: Promise<PackedManifest>} | null = null;
export function loadManifest(base: string, signal?: AbortSignal): Promise<PackedManifest> {
  if (manifestCache && manifestCache.base === base && Date.now() - manifestCache.at < 300000) return manifestCache.p;
  const p = fetch(`${base}/manifest.json`, {signal, cache: 'no-cache'}).then(async (r) => { if (!r.ok) throw new Error('Frames manifest unavailable.'); const m = (await r.json()) as PackedManifest; if (m.version !== 1) throw new Error('Unknown frames manifest version.'); return m; });
  manifestCache = {base, at: Date.now(), p}; p.catch(() => { if (manifestCache?.p === p) manifestCache = null; });
  return p;
}

/** A run older than this is not used (the scheduled job publishes every 6 h; three missed runs = stale): the map falls back to /api/ocean (WW3), labelled as such. */
export const PACKED_MAX_RUN_AGE_MS = 18 * 3600_000;
export const packedRunFresh = (man: PackedManifest, now = Date.now()): boolean => { const t = Date.parse(man.run); return Number.isFinite(t) && now - t <= PACKED_MAX_RUN_AGE_MS; };

/** Browser only: fetch one packed PNG and read its pixels untouched (no colour management, no premultiplied alpha: the PNG has no alpha channel). */
export async function loadPackedGrid(base: string, man: PackedManifest, group: string, validAt: string, signal?: AbortSignal): Promise<{grid: GridData; run: string; url: string; source: string} | null> {
  const f = frameAt(man, validAt), file = f?.files[group], g = man.groups[group]; if (!f || !file || !g) return null;
  const url = `${base}/${file}`, r = await fetch(url, {signal}); if (!r.ok) throw new Error('Packed frame unavailable.');
  const bmp = await createImageBitmap(await r.blob(), {colorSpaceConversion: 'none', premultiplyAlpha: 'none'});
  const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; const cx = cv.getContext('2d', {willReadFrequently: true})!; cx.drawImage(bmp, 0, 0);
  if (bmp.width !== man.grid.nlon || bmp.height !== man.grid.nlat) throw new Error('Packed frame size does not match its manifest.');
  return {grid: decodePackedPixels(cx.getImageData(0, 0, bmp.width, bmp.height).data, 4, man.grid, g.scale), run: man.run, url, source: man.source};
}
