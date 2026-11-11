import {useEffect, useRef, useState} from 'react';
import {useEmbedAllowed} from './embedAllowed';
import {liveCamsFor, type LiveCam as Cam} from '../../data/liveCamsSourced';
import {STILL_REFRESH_MS, STREAM_LOAD_TIMEOUT_MS, ageWords, checkedWords, distanceWords, offlineWords, postedLabel, stillState, streamErrorWords, streamLiveness, type StillBasis, type StreamState} from './liveCamLogic';

/** "Live cam" on the spot page (bayarea-cams-wire). DISPLAY ONLY: SWELLO shows the owner's picture or player with its credit, never analyses, copies or stores a frame.
 *  A still is loaded by the visitor's browser from the owner's host; its time is the owner's own Last-Modified (via the Worker's /api/cam-meta, metadata only). A YouTube stream is a lite embed: our own poster, and
 *  nothing is loaded from YouTube until the visitor clicks. Offline is said, never hidden: a still older than 2 h is not shown. Only spots with a usable-now camera row get the panel. */
type YTPlayer = {destroy: () => void; pauseVideo?: () => void; getVideoData?: () => {isLive?: unknown}; getPlayerState?: () => number};
declare global { interface Window {YT?: {Player: new (el: HTMLElement | string, o: unknown) => YTPlayer; PlayerState?: Record<string, number>}; onYouTubeIframeAPIReady?: () => void} }
let apiPromise: Promise<void> | null = null;
/** The YouTube IFrame API, loaded only when a visitor first clicks a stream (and shared after that). */
const loadYouTubeApi = () => (apiPromise ??= new Promise<void>((resolve, reject) => {
  if (window.YT?.Player) { resolve(); return; }
  const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = () => { apiPromise = null; reject(new Error('YouTube API blocked')); }; document.head.appendChild(s);
}));

/** A YouTube camera's page link is named for where it goes: YouTube, or the owner's own page (Redondo's web-cams page). */
const pageLabel = (url: string) => /^https?:\/\/(www\.|m\.)?youtube\.com\//.test(url) ? 'Open on YouTube' : 'Owner page';

function Credit({cam}: {cam: Cam}) {
  return <p className="lc-credit"><span>{cam.credit}</span>{' · '}<a href={cam.pageUrl} target="_blank" rel="noopener noreferrer">{cam.kind === 'still' ? 'USGS page' : cam.kind === 'hdontap' ? 'Open on HDOnTap' : pageLabel(cam.pageUrl)} ↗</a>
    {cam.channelUrl && <>{' · '}<a href={cam.channelUrl} target="_blank" rel="noopener noreferrer">Channel ↗</a></>}</p>;
}

/** The caption says what is known: by day the picture was taken a little before it was posted (observed 13-31 min, 2026-11-10); a re-posted frame (after dusk, before first light, or the same content seen earlier) is dated by the most recent last light or the first sighting, and says it is an estimate. */
function stillCaption(st: {postedMs: number; takenMs: number; ageMs: number; postedAgeMs: number; basis: StillBasis}, zone: string, now: number): string {
  const posted = postedLabel(st.postedMs, zone, now), taken = postedLabel(st.takenMs, zone, now);
  if (st.basis === 'posted') return `Frame posted ${posted} (${ageWords(st.postedAgeMs)} ago); the picture was taken a little earlier (USGS posted a frame 13–31 min after its stamp when checked on 2026-11-10), and the file carries no capture time`;
  if (st.basis === 'first-seen') return `Picture taken ${taken} at the latest (${ageWords(st.ageMs)} ago): this frame was already online then, and was posted again ${posted}; the file carries no capture time`;
  return `Picture taken about ${taken} or earlier (${ageWords(st.ageMs)} ago, an estimate): USGS collects in daylight only, and this frame was re-posted ${posted} (${ageWords(st.postedAgeMs)} ago)`;
}
function StillCam({cam, zone, spotId}: {cam: Cam; zone: string; spotId: string}) {
  const [meta, setMeta] = useState<{lastModified: string | null; firstSeenAt?: string} | null | undefined>(undefined), [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    const ask = () => { if (typeof document !== 'undefined' && document.hidden) return; setNow(Date.now()); fetch(`/api/cam-meta?id=${encodeURIComponent(cam.metaId!)}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setMeta(j ?? null); }).catch(() => { if (live) setMeta(null); }); };
    const onVisible = () => { if (!document.hidden) ask(); };   // coming back to the tab asks at once, so the age and the offline rule are current
    ask(); const t = setInterval(ask, STILL_REFRESH_MS), tick = setInterval(() => setNow(Date.now()), 60000);   // the age is re-read every minute
    document.addEventListener('visibilitychange', onVisible);
    return () => { live = false; clearInterval(t); clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [cam.metaId]);
  const st = meta === undefined ? null : stillState(meta?.lastModified, now, {spotId, zone, firstSeenAt: meta?.firstSeenAt});
  return <div className="lc-body" data-state={st?.state ?? 'loading'}>
    {st?.state === 'live' && <figure className="lc-fig"><img className="lc-img" src={`${cam.stillUrl}?t=${encodeURIComponent(meta!.lastModified!)}`} alt={`${cam.view}. Still from ${cam.credit}.`} loading="lazy" />
      <figcaption>{stillCaption(st, zone, now)} · new frame every 30 min in daylight.</figcaption></figure>}
    {st?.state === 'offline' && <p className="lc-off" role="status"><b>Offline.</b> {offlineWords({postedMs: st.postedMs, takenMs: st.takenMs, ageMs: st.ageMs, zone, spotId, nowMs: now, offlineNote: cam.offlineNote})}</p>}
    {st?.state === 'unknown' && <p className="lc-off" role="status"><b>Offline or unreachable.</b> The time of the newest frame could not be read, so the picture is not shown (a frame whose age is unknown is not presented as live). {cam.offlineNote}</p>}
    {!st && <p className="lc-load" aria-busy="true">Checking the newest frame…</p>}
  </div>;
}

function StreamCam({cam}: {cam: Cam}) {
  const [state, setState] = useState<StreamState>('idle'), [msg, setMsg] = useState(''), host = useRef<HTMLDivElement>(null), player = useRef<YTPlayer | null>(null);
  useEffect(() => () => { try { player.current?.destroy(); } catch { /* gone */ } player.current = null; }, []);
  const load = () => {
    setState('loading'); setMsg('');
    const guard = setTimeout(() => { setState((s) => (s === 'loading' ? 'failed' : s)); setMsg('The YouTube player did not load (blocked, or no connection).'); }, STREAM_LOAD_TIMEOUT_MS);
    loadYouTubeApi().then(() => {
      if (!host.current || !window.YT) return;
      const el = document.createElement('div'); host.current.replaceChildren(el);
      player.current = new window.YT.Player(el, {videoId: cam.videoId, width: '100%', height: '100%', playerVars: {autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1}, events: {
        onReady: () => { clearTimeout(guard); const live = streamLiveness(player.current?.getVideoData?.()); if (live === 'not-live') { try { player.current?.pauseVideo?.(); } catch { /* player gone */ } setState('offline'); setMsg('YouTube reports this is not a live stream right now (a recording or an ended broadcast).'); } else setState('playing'); },
        onError: (e: {data: number}) => { clearTimeout(guard); setState('unavailable'); setMsg(streamErrorWords(e.data)); },
        onStateChange: (e: {data: number}) => { if (e.data === 0) { setState('offline'); setMsg('The stream ended.'); } else if (e.data === 1) { const live = streamLiveness(player.current?.getVideoData?.()); setState(live === 'not-live' ? 'offline' : 'playing'); if (live === 'not-live') { try { player.current?.pauseVideo?.(); } catch { /* player gone */ } setMsg('YouTube reports this is not a live stream right now (a recording or an ended broadcast).'); } } },
      }});
    }).catch(() => { clearTimeout(guard); setState('failed'); setMsg('YouTube could not be reached (blocked, or no connection).'); });
  };
  return <div className="lc-body" data-state={state}>
    {state === 'idle' && <button type="button" className="lc-poster" onClick={load} aria-label={`Load the video stream: ${cam.view}. This loads the YouTube player.`}>
      <span className="lc-play" aria-hidden="true">▶</span><b>Video stream · {cam.owner.split(' (')[0].replace(/^"|"$/g, '')}</b><small>Live when we last checked it by hand ({checkedWords(cam.checked)}). Tap to load YouTube's player; it shows whether the stream is live now.</small><small>Nothing is loaded from YouTube before you tap.</small></button>}
    <div className={`lc-player${state === 'idle' ? ' lc-hidden' : ''}${state === 'offline' ? ' lc-dim' : ''}`} ref={host} />
    {state === 'loading' && <p className="lc-load" aria-busy="true">Loading the YouTube player…</p>}
    {(state === 'offline' || state === 'unavailable' || state === 'failed') && <p className="lc-off" role="status"><b>{state === 'failed' ? 'Could not load.' : 'Offline.'}</b> {msg} <a href={cam.pageUrl} target="_blank" rel="noopener noreferrer">{pageLabel(cam.pageUrl)} ↗</a></p>}
  </div>;
}

/** An HDOnTap stream: a lite poster; HDOnTap's own player page (an iframe, as HDOnTap's help gives to its customers) is created only on a tap. Never the raw HLS, never a proxy. HDOnTap's player says by itself whether the stream is live, so SWELLO says nothing about it. Only rendered for an ENABLED camera (the kill switch) AND when the Worker confirms HDOnTap's headers allow our site (useEmbedAllowed). */
function HdontapCam({cam}: {cam: Cam}) {
  const [open, setOpen] = useState(false);
  return <div className="lc-body" data-state={open ? 'loading' : 'idle'}>
    {!open && <button type="button" className="lc-poster" onClick={() => setOpen(true)} aria-label={`Load the video stream: ${cam.view}. This loads HDOnTap's player.`}>
      <span className="lc-play" aria-hidden="true">▶</span><b>Video stream · {cam.credit}</b><small>Tap to load HDOnTap's player; it shows whether the stream is live now. Nothing is loaded from HDOnTap before you tap.</small></button>}
    {open && <div className="lc-player"><iframe src={cam.embedUrl} title={`${cam.title}, video stream from HDOnTap`} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>}
  </div>;
}

/** The panel: one card per camera of the spot (the first one open; Chamberlin's west view is first), each with its distance, what it shows and its credit. */
export function LiveCamPanel({spotId, zone}: {spotId: string; zone: string}) {
  const all = liveCamsFor(spotId), allowed = useEmbedAllowed(all.filter((c) => c.kind === 'hdontap' && c.embedId).map((c) => c.embedId!));
  // an HDOnTap camera is drawn only when HDOnTap's own headers allow our site (confirmed by the Worker); otherwise its "HDOnTap cam ↗" link is what shows (HdontapLinks)
  const cams = all.filter((c) => c.kind !== 'hdontap' || (c.embedId && allowed[c.embedId] === true)), [sel, setSel] = useState(0); if (!cams.length) return null;
  const cam = cams[Math.min(sel, cams.length - 1)];
  return <section className="sp-live-cam card" aria-labelledby="lc-h">
    <h2 id="lc-h">Camera</h2>
    {cams.length > 1 && <div className="seg lc-tabs" role="tablist" aria-label="Camera views">{cams.map((c, i) => <button key={c.id} role="tab" aria-selected={i === sel} onClick={() => setSel(i)}>{c.tab ?? c.view}</button>)}</div>}
    <p className="lc-view"><b>{cam.view}</b><small>{distanceWords(cam)}{cam.kind === 'still' ? ' · a still picture, not video' : ' · video stream (live status shown after you tap)'}{cam.ownerDescribed ? ' · view described by the owner, not checked by SWELLO' : ''}</small></p>
    {cam.kind === 'still' ? <StillCam key={cam.id} cam={cam} zone={zone} spotId={spotId} /> : cam.kind === 'hdontap' ? <HdontapCam key={cam.id} cam={cam} /> : <StreamCam key={cam.id} cam={cam} />}
    <Credit cam={cam} />
    {cam.operatorNote && <p className="lc-note">{cam.operatorNote}</p>}
  </section>;
}
