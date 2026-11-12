import {useEffect, useRef, useState} from 'react';
import {HDONTAP_ATTRIBUTION, HDONTAP_LOGO, HDONTAP_LOGO_LINK, SNAPSHOT_REFRESH_MS, hdontapLink, ownerWords, snapshotCamsFor, snapshotSrc, type HdontapCam} from '../../ocean/hdontapCams';
import {distanceWords, postedLabel} from './liveCamLogic';

/** hdontap-snaps: HDOnTap's live-updating snapshots for the spot (terms and rules: src/ocean/hdontapCams.ts). DISPLAY ONLY: the visitor's browser loads HDOnTap's image from HDOnTap,
 *  about once a minute while the page is visible and the block is on screen; SWELLO never proxies, copies, stores or analyses a frame. The time shown is when this browser loaded the
 *  picture, not when the camera took it (HDOnTap refreshes it about every minute). A spot without a snapshot camera renders nothing; an image that fails hides its camera, and the block with the last one. */
const SNAPSHOT_LOAD_TIMEOUT_MS = 20000;
/** at the spot, or the distance ("about 500 m from this spot"), and for a neighboring beach or harbor where it is and that it is not this spot */
const where = (c: HdontapCam) => (c.km < 0.1 && !c.neighbour ? 'at this spot' : distanceWords({km: c.km, kmApprox: true, neighbour: c.neighbour}));

export function HdontapSnaps({spotId, zone}: {spotId: string; zone: string}) {
  const [failed, setFailed] = useState<Record<string, true>>({}), [sel, setSel] = useState(0), [now, setNow] = useState(() => Date.now()), [loadedAt, setLoadedAt] = useState<number | null>(null);
  const box = useRef<HTMLElement>(null), inView = useRef(true), [seen, setSeen] = useState(false);
  const cams = snapshotCamsFor(spotId).filter((c) => !failed[c.stream]);
  useEffect(() => { setSel(0); setFailed({}); setLoadedAt(null); }, [spotId]);
  useEffect(() => {
    if (!cams.length) return;
    const el = box.current, io = el && 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; if (e.isIntersecting) setSeen(true); }) : null; if (el) io?.observe(el); if (!io) setSeen(true);
    const t = window.setInterval(() => { if (!document.hidden && inView.current) setNow(Date.now()); }, SNAPSHOT_REFRESH_MS);   // never faster than once a minute
    return () => { window.clearInterval(t); io?.disconnect(); };
  }, [cams.length]);
  const cur = cams.length ? cams[Math.min(sel, cams.length - 1)].stream : null;
  // a picture that has not arrived SNAPSHOT_LOAD_TIMEOUT_MS after the block came on screen counts as failed (HDOnTap answers an unknown camera with a slow 504, which the browser may wait out for a long time)
  useEffect(() => { if (!seen || !cur || loadedAt) return; const t = window.setTimeout(() => setFailed((f) => ({...f, [cur]: true})), SNAPSHOT_LOAD_TIMEOUT_MS); return () => window.clearTimeout(t); }, [seen, cur, loadedAt]);
  if (!cams.length) return null;
  const cam: HdontapCam = cams[Math.min(sel, cams.length - 1)];
  return <section className="sp-live-cam sp-hds card" aria-labelledby="hds-h" ref={box}>
    <h2 id="hds-h">Camera <span className="lc-tag">snapshot</span></h2>
    {cams.length > 1 && <div className="seg lc-tabs" role="tablist" aria-label="Camera views">{cams.map((c, i) => <button key={c.stream} type="button" role="tab" aria-selected={c.stream === cam.stream} onClick={() => { if (c.stream !== cam.stream) { setSel(i); setLoadedAt(null); } }}>{c.short}</button>)}</div>}
    <p className="lc-view"><b>{cam.name}</b><small>{ownerWords(cam)} · {where(cam)}{cam.partial ? ' · the camera list says it shows only part of the break or the beach' : ''} · a still picture, not video; HDOnTap says it updates about every minute</small></p>
    <figure className="lc-fig">
      <a className="hds-a" href={hdontapLink(cam)} target="_blank" rel="noopener noreferrer" aria-label={`${cam.name}: open this camera on HDOnTap.com in a new tab`}>
        <img key={cam.stream} className="lc-img hds-img" src={snapshotSrc(cam.snapshotUrl!, now)} alt={`${cam.name}, camera snapshot from HDOnTap`} loading="lazy" width={640} height={360}
          onLoad={() => setLoadedAt(Date.now())} onError={() => setFailed((f) => ({...f, [cam.stream]: true}))} />
      </a>
      <figcaption>{loadedAt ? `Loaded by your browser ${postedLabel(loadedAt, zone, loadedAt)}; the picture may be a minute or more older` : 'Snapshot'}</figcaption>
    </figure>
    <p className="lc-credit hds-credit"><span>{HDONTAP_ATTRIBUTION}</span>
      <a className="hds-logo" href={HDONTAP_LOGO_LINK} target="_blank" rel="noopener noreferrer" title="HDOnTap.com (opens in a new tab)">
        <img className="hds-logo-l" src={HDONTAP_LOGO.light} alt={HDONTAP_LOGO.alt} width={HDONTAP_LOGO.w} height={HDONTAP_LOGO.h} loading="lazy" />
        <img className="hds-logo-d" src={HDONTAP_LOGO.dark} alt={HDONTAP_LOGO.alt} width={HDONTAP_LOGO.w} height={HDONTAP_LOGO.h} loading="lazy" /></a></p>
  </section>;
}
