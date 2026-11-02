import {SCALE_BANDS, type ScaleBand} from './waveScale.ts';

/** Paths and drag/keyboard maths for the 3D spin viewer (T-044). Renders go in public/media/scale3d/<band>/a00.jpg … a23.jpg plus poster.jpg;
 *  dropping a folder in is all it takes, nothing is registered anywhere else. */
export const SPIN_FRAMES = 24;
export const SPIN_ROOT = '/media/scale3d';
export const SPIN_CAPTION = '3D illustration · approximate scale, not current conditions';

/** Folder name of a band: its id without the "ft" suffix ("4-6ft" → "4-6", "15-plusft" → "15-plus"). */
export const bandFolder = (b: Pick<ScaleBand, 'id'>) => b.id.replace(/ft$/, '');
export const framePath = (b: Pick<ScaleBand, 'id'>, i: number) => `${SPIN_ROOT}/${bandFolder(b)}/a${String(i).padStart(2, '0')}.jpg`;
export const framePaths = (b: Pick<ScaleBand, 'id'>, n = SPIN_FRAMES) => Array.from({length: n}, (_, i) => framePath(b, i));
export const posterPath = (b: Pick<ScaleBand, 'id'>) => `${SPIN_ROOT}/${bandFolder(b)}/poster.jpg`;
export const allBandFolders = () => SCALE_BANDS.map(bandFolder);

/** Wraps any integer into 0..n-1. */
export const wrapFrame = (i: number, n = SPIN_FRAMES) => ((Math.round(i) % n) + n) % n;
/** Dragging right turns the object toward the viewer's right (previous frame); one full stage width is one full turn. */
export function frameFromDrag(startFrame: number, dx: number, stageWidth: number, n = SPIN_FRAMES) {
  if (!Number.isFinite(dx) || !(stageWidth > 0)) return wrapFrame(startFrame, n);
  return wrapFrame(startFrame - Math.round((dx / stageWidth) * n), n);
}
/** Frame after a key press, or null when the key does nothing. Arrows ±1, Page keys ±4, Home and End jump to the ends of the loop. */
export function frameFromKey(key: string, frame: number, n = SPIN_FRAMES): number | null {
  const d: Record<string, number> = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4};
  if (key in d) return wrapFrame(frame + d[key], n);
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}
/** "n / 24" counter text for a zero-based frame. */
export const counterText = (frame: number, n = SPIN_FRAMES) => `${wrapFrame(frame, n) + 1} / ${n}`;

/** A band's caption in the user's height unit: "4–6 ft wave · surfer 5′9″" or "1.2–1.8 m wave · surfer 1.75 m". The renders use a 1.75 m surfer. */
export function spinCaption(b: Pick<ScaleBand, 'lo' | 'hi' | 'label'>, unit: 'ft' | 'm'): string {
  if (unit === 'ft') return `${b.label} wave · surfer 5′9″`;
  const m = (ft: number) => (Math.round(ft * 0.3048 * 10) / 10).toFixed(1);
  const lo = Math.max(b.lo, 1); // the first band also holds anything smaller; its picture is a 1–2 ft wave
  return `${Number.isFinite(b.hi) ? `${m(lo)}–${m(b.hi)} m` : `${m(lo)}+ m`} wave · surfer 1.75 m`;
}
