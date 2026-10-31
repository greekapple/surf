import {useEffect, useRef, useState} from 'react';
import './media.css';
import {captionFor, creditLine, resolveMedia, srcSet, type MediaEntry, type MediaManifest} from './mediaModel';

let manifestPromise: Promise<MediaManifest | null> | undefined;
/** Loaded once from /media/manifest.json so assets can be dropped in without a rebuild; null if it cannot be read. */
function loadManifest(): Promise<MediaManifest | null> {
  manifestPromise ??= fetch('/media/manifest.json').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<MediaManifest>; })
    .catch((e) => { console.error('Media: manifest unavailable, using built-in photos only', e); return null; });
  return manifestPromise;
}
/** True on phone-width screens; lets a page pick the tall or wide variant of an asset (e.g. ai-home-loop-tall / -wide). */
export function useNarrow(max = 860) {
  const q = `(max-width: ${max}px)`;
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(q), f = () => setOn(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}
/** Video is skipped (poster only) when the user asks to save data. */
const saveData = () => !!(navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData;
const useReducedMotion = () => {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)'), f = () => setOn(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return on;
};

/** The resolved manifest entry for an id (undefined until the manifest has loaded, or if there is none). Lets a screen offer "play loop" only where a loop exists. */
export function useMediaEntry(id: string): MediaEntry | undefined {
  const [manifest, setManifest] = useState<MediaManifest | null | undefined>(undefined);
  useEffect(() => { let live = true; loadManifest().then((m) => live && setManifest(m)); return () => { live = false; }; }, []);
  return resolveMedia(id, manifest);
}

export interface MediaProps {
  /** Manifest id (public/media/manifest.json), or the id of a built-in CC photo. */
  id: string;
  className?: string;
  /** Hide the photo credit line (the AI caption can never be hidden). */
  hideCredit?: boolean;
  /** Load straight away instead of when it nears the viewport (use for the top image on a page). */
  eager?: boolean;
  sizes?: string;
  /** Overrides the entry's alt text; use "" for a decorative image or when the photo is not of the thing it sits beside. */
  alt?: string;
  /** Show the poster only, even where a video exists (phones, until the user taps play). */
  still?: boolean;
}

/** An image, or a looping muted video with a poster, with its focal point, credit and (for AI art) the required caption. */
export function Media({id, className = '', hideCredit, eager, sizes = '100vw', alt, still}: MediaProps) {
  const [manifest, setManifest] = useState<MediaManifest | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(!!eager);
  const [videoFailed, setVideoFailed] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => { let live = true; loadManifest().then((m) => live && setManifest(m)); return () => { live = false; }; }, []);
  useEffect(() => { setFailed(false); setVideoFailed(false); }, [id]);
  useEffect(() => {
    if (near || !ref.current) return;
    if (typeof IntersectionObserver !== 'function') { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, {rootMargin: '200px'});
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);

  // Play only while on screen.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); });
    io.observe(v);
    return () => io.disconnect();
  });

  let entry: MediaEntry | undefined = resolveMedia(id, manifest);
  // An AI asset that will not load is replaced by its fallback photo, which then carries the photo's own credit and no AI caption.
  const swappable = !!(entry && failed && entry.fallback), broken = failed && !swappable;
  if (swappable) entry = resolveMedia(entry!.fallback!, manifest);
  if (!entry && manifest !== undefined) console.warn(`Media: no entry or built-in photo for "${id}"`);
  if (!entry) return manifest === undefined ? <figure ref={ref} className={`media media-wait ${className}`} aria-hidden="true" /> : null;
  const caption = captionFor(entry), pos = `${entry.focal[0]}% ${entry.focal[1]}%`;
  const poster = entry.sources[entry.sources.length - 1].src;
  const playVideo = !!entry.video && !still && !reduced && !saveData() && !videoFailed && near;
  return (
    <figure ref={ref} className={`media media-${entry.kind} ${className}`} data-media-id={id} data-media-kind={entry.kind}>
      {playVideo
        ? <video ref={videoRef} className="media-el" autoPlay loop muted playsInline preload="metadata" poster={poster} style={{objectPosition: pos}} aria-label={alt ?? entry.alt} onError={() => { console.warn(`Media: video failed for ${id}, showing its poster`); setVideoFailed(true); }}><source src={entry.video!.src} type={entry.video!.type} /></video>
        : <img className="media-el" src={near ? poster : undefined} srcSet={near ? srcSet(entry) : undefined} sizes={sizes} alt={alt ?? entry.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" style={{objectPosition: pos}} onError={() => { console.warn(`Media: failed to load ${id}`); setFailed(true); }} />}
      {caption && <figcaption className="media-caption media-caption-ai">{caption}</figcaption>}
      {!caption && !hideCredit && !broken && <figcaption className="media-caption media-credit">{creditLine(entry)}</figcaption>}
    </figure>
  );
}
