import {PHOTOS} from './photos.ts';
/** Shown on every AI-generated asset, always. Never optional. */
export const AI_CAPTION = 'Illustration · AI-generated, not current conditions';
/** Wave-scale illustrations carry this longer caption (still starts with the forced "Illustration · AI-generated"). */
export const AI_SCALE_CAPTION = 'Illustration · AI-generated, approximate scale, not current conditions';
/** The only captions an AI entry may carry. */
export const AI_CAPTIONS: readonly string[] = [AI_CAPTION, AI_SCALE_CAPTION];
export type MediaKind = 'photo' | 'ai-illustration';
export interface MediaEntry {
  kind: MediaKind; alt: string;
  /** Image files by width, smallest first. For a video entry this is the poster. */
  sources: {src: string; width: number}[];
  /** Looping muted clip; the poster (sources) is all that shows under reduced motion. */
  video?: {src: string; type: string};
  /** Focal point as [x%, y%]: the part of the frame that must stay visible when it is cropped. */
  focal: [number, number];
  credit: string; licence: string; licenceUrl?: string; source?: string;
  /** Required when kind is 'ai-illustration' and must be one of AI_CAPTIONS. */
  caption?: string;
  /** Id of a photo entry shown if this asset cannot be loaded. */
  fallback?: string;
}
export interface MediaManifest {version: number; entries: Record<string, MediaEntry>}
/** Home image slots (T-030) and the CC photo each shows until a manifest entry replaces it, so a failed manifest fetch never leaves them blank. */
export const SLOT_DEFAULTS: Record<string, string> = {'home-hero': 'ob-sunset-negative-tide', 'home-panel-forecast': 'ocean-beach-fog-clearing', 'home-panel-map': 'bolinas-beach-wide', 'home-panel-quiver': 'pacifica-state-beach-surfer'};
/** The CC photos already in the repo as manifest entries, so nothing is blank before a manifest or AI assets exist. */
export const PHOTO_FALLBACKS: Record<string, MediaEntry> = Object.fromEntries(Object.values(PHOTOS).map((p) => [p.id, {
  kind: 'photo' as const, alt: p.location, focal: [50, 50] as [number, number], credit: p.photographer, licence: p.license, licenceUrl: p.licenseUrl, source: p.source,
  sources: [800, 1600].map((w) => ({src: `/photos/${p.id}-${w}.jpg`, width: w}))}]));
/** The entry for an id: manifest first, else the built-in CC photo, else undefined (the caller renders nothing rather than a blank box). */
export function resolveMedia(id: string, manifest?: MediaManifest | null): MediaEntry | undefined {
  return manifest?.entries[id] ?? PHOTO_FALLBACKS[id] ?? PHOTO_FALLBACKS[SLOT_DEFAULTS[id]];
}
/** Text that must be visible with the asset: the AI caption for illustrations, null for photos. */
export function captionFor(e: MediaEntry): string | null { return e.kind === 'ai-illustration' ? (e.caption && AI_CAPTIONS.includes(e.caption) ? e.caption : AI_CAPTION) : null; }
/** Visible credit line, e.g. "Brocken Inaglory · CC BY-SA 3.0". */
export function creditLine(e: MediaEntry): string { return `${e.credit} · ${e.licence}`; }
export const srcSet = (e: MediaEntry) => e.sources.map((s) => `${s.src} ${s.width}w`).join(', ');
/** Problems with an entry that would break the labelling rules. Empty when it is fine. */
export function entryProblems(id: string, e: MediaEntry, all: Record<string, MediaEntry>): string[] {
  const p: string[] = [];
  if (e.kind !== 'photo' && e.kind !== 'ai-illustration') p.push(`${id}: kind must be 'photo' or 'ai-illustration'`);
  if (!e.credit?.trim() || !e.licence?.trim()) p.push(`${id}: credit and licence are required`);
  if (!e.alt?.trim()) p.push(`${id}: alt text is required`);
  if (!e.sources?.length) p.push(`${id}: needs at least one image source (the poster for a video)`);
  if (!Array.isArray(e.focal) || e.focal.length !== 2 || e.focal.some((n) => !(n >= 0 && n <= 100))) p.push(`${id}: focal must be [x, y] percentages`);
  if (e.kind === 'ai-illustration') {
    if (!e.caption || !AI_CAPTIONS.includes(e.caption)) p.push(`${id}: AI entries must carry the caption "${AI_CAPTION}" or "${AI_SCALE_CAPTION}"`);
    if (!e.fallback || all[e.fallback]?.kind !== 'photo') p.push(`${id}: AI entries need a fallback photo id`);
  }
  return p;
}
