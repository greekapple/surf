import {officialRange} from '../../services/officialSurf.ts';
import {mapZone} from '../../ocean/spotZone';
import {mapZoneAbbr, stampLabel} from './mapTime';
import {loadSnapshot, snapshotHour, type ClientSnapshot} from './coastSnapshot';
import {spotTier} from '../../data/spotTiers';
import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {ENCLOSED_NOTE, enclosedCovers, isEnclosedWater} from '../../map/enclosed';
import {createPortal} from 'react-dom';
import 'leaflet/dist/leaflet.css';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {useSpatial} from '../../hooks/useSpatial';
import {useGlobe} from '../../hooks/useGlobe';
import {dataPhase} from '../../services/dataPhase';
import {allSpots as spots} from '../../data/catalog';
import {rateForecast} from '../../ratings/adapters';
import {Icon, type IconName} from '../../ui/Icon';
import {conditionWord} from '../../ui/Condition';
import {BAND_COLOR, bandOf, hourLabel} from '../forecast/model';
import {ht} from '../forecast/helpers';
import {weekdayPT} from '../forecast/format';
import {cacheLabel} from './cacheLabel';
import {isFlat, FLAT_ESTIMATE_TEXT} from '../../services/flatSurf';
import {buildField, legendModel, sampleField, type Field, type FieldController, type FieldLayer} from '../../map/field';
import {mapConfig, minZoomFor, type ScaleKey} from '../../map/mapConfig';
import {erddapHosts, schedulePrefetch, viaHosts} from '../../map/spatial';
import {fillQueue} from './mapFill';
import {framesBase} from '../../map/packedFrame';
import {attachDebugOverlay, debugEnabled, type DebugInfo} from '../../map/debugOverlay';
import type {MapLayer, MapVariable} from '../../map/types';
import type {SpatialFrame} from '../../map/spatial';
import {usePointForecast, type Pt} from './PointCard';
import {ForecastPanel, PinLabel, pointLine} from './PointPanel';
import {pointExtras} from '../../map/pointExtras';
import {CompareSpots} from './Compare';
import {FindSpots} from './FindSpots';
import {parseMapUrl, writeMapUrl} from './mapUrl';
import {createEngine, engineKind, type DotIcon, type MapDot, type MapEngine, type MarkerHandle} from '../../map/engine';
import {mapStatus} from './mapStatus';
import {ahead, indexBySpot, near} from './recordIndex';
import {DOT_ZOOM, dotFace, inkFor, swellFrom, type Band, type DotFace} from './dots';
import {currentTheme} from '../../map/basemap';
import {DayStrip, DotKey, DotKeyList, LayerList, LegendChip, ModelChip, SpotRow} from './Panels';
import {zoneOf} from '../../data/zones';
import {zonesWithSpots} from '../../ocean/regionGate';
import {AutofillInput} from '../../ui/AutofillInput';
import {LEGEND_NAMES} from './legendNames';
import {completion as completeOf, rememberSpot, recentSpots, searchSpots} from '../../services/spotSearch';
import {COAST_MAX_ZOOM, buildNodes, type NodeId, type SpotState} from './coastGroups';
import {headlineSurf, headlineText} from '../../services/headlineSurf';
import {isDark} from '../forecast/trustApi';
import {SpotCallout, type HourBar} from './Callout';
import './explore.css';

/** Field layers the regional grids can actually supply. One is shown at a time. */
type FieldId = 'waves' | 'swell' | 'period' | 'wind';
const FIELDS: {id: FieldId; label: string; /** T-096: the chip's word in the layers popover; `label` stays the honest full name */ short: string; icon: IconName; layer: MapLayer; variable: MapVariable; unit: SpatialFrame['unit']; note: string}[] = [
  {id: 'waves', label: 'Offshore wave height · not surf size', short: 'Offshore waves', icon: 'waves', layer: 'WAVES', variable: 'Offshore Hs', unit: 'm', note: 'Combined significant wave height (WW3), offshore'},
  {id: 'swell', label: 'Offshore swell height · not surf size', short: 'Swell', icon: 'tide', layer: 'SWELL', variable: 'Height', unit: 'm', note: 'Swell partition height (WW3), offshore'},
  {id: 'period', label: 'Wave period', short: 'Period', icon: 'forecast', layer: 'WAVES', variable: 'Period', unit: 's', note: 'Peak wave period (WW3)'},
  {id: 'wind', label: 'Wind', short: 'Wind', icon: 'wind', layer: 'WIND', variable: 'Speed', unit: 'm/s', note: '10 m wind speed (GFS), 3-hourly'},
];
const sectionField = (section: string): FieldId => (section === 'wind' ? 'wind' : section === 'swell' ? 'swell' : 'waves');
const fieldSection: Record<FieldId, string> = {waves: '', swell: 'swell', period: '', wind: 'wind'};
const surfSpot = (id: string) => spots.find((s) => s.id === id)!;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PHONE = '(max-width: 860px)';
const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches;

/** 4E coast groups: the nodes (regions, zones, coasts, seaboards) with their spots, the regions the layout starts from, and one pill's DOM. */
type Detent = 'peek' | 'half' | 'full';
const DETENTS: Detent[] = ['peek', 'half', 'full'];

/** Stage 3: ONE fixed scale per layer (mapConfig.scales); the legend is built from the same ramp the painter uses, in the person's units. */
const scaleKeyOfField = (id: FieldId): ScaleKey => id.toUpperCase() as ScaleKey;
const themeNow = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark';

/** How many spots carry a name label at this zoom (Surfline map: the selected spot and the best few; the rest are dots). */
// T-116: labels only for the selected spot and the top-rated few (Windy-quiet); the rest are rating-coloured dots that name themselves on hover or focus.
/** The popular spots (as Home's "Popular spots"): after favourites, they get labels and survive low-zoom thinning. */
const POPULAR_SPOTS = ['spot-2', 'spot-0', 'spot-3'];

/** An engine-neutral popup shell: an outer box (positioned by useAnchored, marked data-map-overlay so the engine's map click ignores it) with the
 *  content element (the portal target) and a tip. Same look as the old Leaflet popups (CSS: .xpopup .xp-in / .xp-tip). */
function overlayBox(cls: string): HTMLElement {
  const box = document.createElement('div'); box.className = cls; box.dataset.mapOverlay = ''; box.style.display = 'none';
  const inner = document.createElement('div'); inner.className = 'xp-in'; const tip = document.createElement('div'); tip.className = 'xp-tip';
  box.append(inner, tip); return box;
}
/** Keeps an overlay box anchored (bottom-centre, `dy` px above) at a point on any engine, re-placed on every map move; on open it pans the map
 *  just enough to bring the box inside `pad` (as Leaflet's popup auto-pan did).
 *  map-review (c): when the point has a marker (`anchorEl`: the picker, the selected pin) the box follows that element's painted position, every
 *  frame from movestart to moveend. Leaflet animates zooms with a CSS transform and fires no move events meanwhile, so a projected point lagged
 *  the marker by up to 200 px (and thousands on a 3-level zoom) until zoomend; the marker's own box is where the eye is, on both engines. */
function useAnchored(eng: MapEngine | null, box: HTMLElement, at: {lat: number; lon: number} | null, dy: number, pad: {top: number; left: number; right: number; bottom: number}, autoPan: boolean, anchorEl?: () => HTMLElement | null | undefined, flying?: () => boolean) {
  useEffect(() => {
    if (!eng || !at) { box.style.display = 'none'; box.classList.remove('on'); return; }
    if (box.parentElement !== eng.container) eng.container.appendChild(box);
    box.style.display = ''; box.classList.add('on');
    const where = () => {
      const a = anchorEl?.(), r = a?.isConnected ? a.getBoundingClientRect() : null;
      if (r && r.width) { const c = eng.container.getBoundingClientRect(); return {x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top}; }
      return eng.project(at.lat, at.lon);
    };
    const place = () => { const q = where(); box.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y + dy)}px) translate(-50%, -100%)`; };
    place();
    // While the map moves: if the marker (or a wrapper of it) moves by a CSS transition (Leaflet's zoom), the box runs the same move with the
    // same timing, started at the same instant; reading the marker's box each frame would always trail it by one frame (the transition is
    // sampled after rAF). Otherwise (MapLibre moves markers per frame from JS) the box is re-placed from the marker every frame.
    let follow = 0, base: {x: number; y: number} | null = null, mirror: Animation | null = null, src: Animation | null = null;
    const transitionOf = (a: HTMLElement) => { for (let n: HTMLElement | null = a; n && n !== eng.container; n = n.parentElement) {
      const t = n.getAnimations().find((x) => x.playState === 'running' && (x.effect as KeyframeEffect | null)?.getKeyframes().some((k) => k.transform)); if (t) return t; } return null; };
    const mirrorOf = (t: Animation) => {
      const kf = (t.effect as KeyframeEffect).getKeyframes(), from = new DOMMatrix(String(kf[0].transform)), to = new DOMMatrix(String(kf.at(-1)!.transform)), tm = t.effect!.getTiming();
      const b = base ?? where(), at2 = (x: number, y: number) => `translate(${Math.round(x)}px, ${Math.round(y + dy)}px) translate(-50%, -100%)`;
      const m = box.animate([{transform: at2(b.x, b.y)}, {transform: at2(b.x + to.e - from.e, b.y + to.f - from.f)}], {duration: Number(tm.duration), easing: tm.easing, fill: 'forwards'});
      if (t.startTime !== null) m.startTime = t.startTime; // still pending: aligned in the loop once the browser has timed it
      return m;
    };
    const loop = () => { const a = anchorEl?.();
      if (!mirror) { const t = a?.isConnected ? transitionOf(a) : null; if (t) { src = t; mirror = mirrorOf(t); } else place(); }
      else if (src && src.startTime !== null && mirror.startTime !== src.startTime) mirror.startTime = src.startTime;
      follow = requestAnimationFrame(loop); };
    const start = () => { if (follow || !anchorEl) return; base = where(); follow = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(follow); follow = 0; mirror?.cancel(); mirror = null; src = null; base = null; place(); };
    const offs = [...(['move', 'resize'] as const).map((e) => eng.on(e, place)), eng.on('movestart', start), eng.on('moveend', stop), eng.on('zoomend', stop)];
    let raf = 0;
    const doPan = () => {
      const r = box.getBoundingClientRect(), c = eng.container.getBoundingClientRect(); let dx = 0, dyy = 0;
      if (r.left < c.left + pad.left) dx = r.left - c.left - pad.left; else if (r.right > c.right - pad.right) dx = r.right - c.right + pad.right;
      if (r.top < c.top + pad.top) dyy = r.top - c.top - pad.top; else if (r.bottom > c.bottom - pad.bottom) dyy = r.bottom - c.bottom + pad.bottom;
      if (dx || dyy) eng.panBy(Math.round(dx), Math.round(dyy), {animate: !reduced()});
    };
    // a fly to the spot is under way (a search pick): panning now would cancel it; settle the callout once the map lands
    if (autoPan) raf = requestAnimationFrame(() => { if (flying?.()) { const off = eng.on('moveend', () => { off(); raf = requestAnimationFrame(doPan); }); offs.push(off); } else doPan(); });
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(follow); mirror?.cancel(); offs.forEach((f) => f()); };
  }, [eng, box, at?.lat, at?.lon, dy, autoPan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { box.remove(); }, [box]);
}

/** map-load: how long one field request may stay open before the map says it is slow (still loading, with Retry); generous for a phone on a slow connection. */
export const SLOW_MS = 20000;
export function ExploreView({section, go}: ViewProps) {
  if (section === 'discover') return <FindSpots go={go} />;
  if (section === 'compare') return <CompareSpots go={go} />;
  return <OceanMap section={section} go={go} />;
}

function OceanMap({section, go}: ViewProps) {
  const {view, data, spot, setSpot, now, live, reportVisible, requestSpots, fillSpots, mapFocused, setMapFocused, gate} = useSwello();
  // ca-only: every list on the map (dots, clusters, "N spots in view", search) reads the gated list, never the whole catalogue; the region chips are the zones that hold a gated spot (zonesWithSpots)
  const evidenceSpots = gate.evidence;
  const COAST_NODES = useMemo(() => buildNodes(evidenceSpots), [evidenceSpots]);   // the coast groups (regions, zones, coasts); map-clusters replaced their dots with MapLibre clusters
  const SPOT_BY_ID = useMemo(() => new Map(evidenceSpots.map((e) => [e.id, e] as const)), [evidenceSpots]);
  // 1B: the map's focus (the app's selected spot stays when it is cleared). `focused` = the spot the map highlights, or null.
  const focused = mapFocused ? spot.id : null;
  useEffect(() => { writeMapUrl({focus: mapFocused ? null : 'none'}); }, [mapFocused]);
  useEffect(() => () => writeMapUrl({focus: null}), []);   // the key is the map's: other pages never carry ?focus=none (the store keeps the state)
  const reportVisibleRef = useRef(reportVisible); reportVisibleRef.current = reportVisible;
  const p = data.state.profile;
  // Map-seamless Stage 1: the view in the URL (?layer, lat, lon, z, t) is read once on load, so a reload or a shared link restores it.
  const urlInit = useMemo(() => parseMapUrl(typeof location === 'undefined' ? '' : location.search), []);
  const [fieldId, setFieldId] = useState<FieldId>(urlInit.layer ?? sectionField(section));
  // A link's ?layer= wins on arrival: its section is opened (swell and wind have their own) instead of the section resetting the layer (it was lost).
  const urlLayerFirst = useRef(!!urlInit.layer);
  useEffect(() => {
    if (urlLayerFirst.current) { urlLayerFirst.current = false; const want = fieldSection[urlInit.layer!]; if (want !== section) { go('explore', want); return; } }
    setFieldId((f) => (fieldSection[f] === section ? f : sectionField(section)));
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const rank = useRef(new Map<string, number>());
  const flying = useRef(false), flight = useRef(0);   // §5: a fly to a picked spot is under way (the callout's auto-pan waits for it to land)
  const step = 3; // T-117: play steps 3 h, as Windy
  const [opts, setOpts] = useState({heat: true, flow: true, arrows: false});
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => { const mq = matchMedia(PHONE), on = () => setPhone(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  // Wide screens: the spot list is a slim sheet under its toggle, open only on demand. Phones: a bottom sheet with three detents.
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(''), [zone, setZone] = useState('In view'); // Track 2: the list opens on the spots in view (Surfline's synced list)
  const [active, setActive] = useState(0), [recents, setRecents] = useState<string[]>(recentSpots);   // §6: the arrow-key suggestion, the last 5 picks (this browser only)
  const [inView, setInView] = useState<Set<string> | null>(null);
  // "In view" = the part of the map a person can see: not under the time strip, the phone sheet or the open desktop list.
  const seenRef = useRef(() => {});
  seenRef.current = () => {
    const x = map.current; if (!x) return;
    const c = x.container.getBoundingClientRect(); let L = c.left, R = c.right, T = c.top, B = c.bottom;
    const strip = x.container.parentElement?.querySelector('.xbottom')?.getBoundingClientRect(); if (strip?.height) B = Math.min(B, strip.top);
    const sheet = x.container.parentElement?.querySelector('.xsheet.phone')?.getBoundingClientRect(); if (sheet?.height) B = Math.min(B, sheet.top);
    const panel = x.container.parentElement?.querySelector('.xsearchbox .xsheet')?.getBoundingClientRect(); if (panel?.width) L = Math.max(L, panel.right);
    const ids = evidenceSpots.filter((e) => { const q = x.project(e.latitude, e.longitude), px = c.left + q.x, py = c.top + q.y; return px >= L && px <= R && py >= T && py <= B; }).map((e) => e.id);
    setInView((old) => (old && old.size === ids.length && ids.every((id) => old.has(id)) ? old : new Set(ids)));
  }; // T-116: the map's top bar (search + region chips)
  const [detent, setDetent] = useState<Detent>('peek');
  const [drag, setDrag] = useState<number | null>(null);
  const [callout, setCallout] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // map-fill (lead, 2026-11-11): after the spots in view have loaded, the rest of the seaboard loads in the background, one region per settled load, nearest
  // region to the selected spot first. Never ahead of the spots in view (the list goes last in the scope and only grows once nothing is loading), paused while
  // the time plays or within 4 s of a scrub, and cleared when the map closes (so the 10-minute refresh elsewhere does not keep the whole seaboard).
  const lastScrub = useRef(0), fillStep = useRef(0), [fillTick, setFillTick] = useState(0);
  const fillAnchor = SPOT_BY_ID.get(spot.id);
  const fillQ = useMemo(() => (fillAnchor ? fillQueue({lat: fillAnchor.latitude, lon: fillAnchor.longitude, region: fillAnchor.region}, evidenceSpots) : []), [fillAnchor?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fillStep.current = 0; }, [fillQ]);
  useEffect(() => () => fillSpots([]), [fillSpots]);
  const [zoom, setZoom] = useState(9);
  const def = FIELDS.find((f) => f.id === fieldId)!;
  const mapEl = useRef<HTMLDivElement>(null);
  // map-maplibre: ExploreView talks only to the MapEngine seam (Leaflet or MapLibre behind ?engine=), never to a map library directly.
  const map = useRef<MapEngine | null>(null);
  const [eng, setEng] = useState<MapEngine | null>(null);
  // Tap-the-sea point forecast: one popup, one temporary pin.
  const [pt, setPt] = useState<Pt | null>(null);
  const [livePt, setLivePt] = useState<Pt | null>(null); // Stage 6: the picker's position while it is being dragged or nudged (the value follows it live)
  const closedAt = useRef(0); // T-099: a touch tap on the card's close button also reached the map and opened a new point where the finger was
  const [panel, setPanel] = useState(false); // T-117: the point's hourly panel (expand from the pin label)
  const [sheetOn, setSheetOn] = useState(false); // T-117: phones show the spot sheet only once a spot is picked or the search is used (Windy)
  // The point label and the spot callout are our own DOM, anchored at their point (engine-neutral; data-map-overlay keeps map clicks off them).
  const popupBox = useMemo(() => overlayBox('xpopup xpl-pop'), []), popupEl = popupBox.firstElementChild as HTMLElement;
  const spotPopBox = useMemo(() => overlayBox('xpopup xspotpop'), []), spotPopEl = spotPopBox.firstElementChild as HTMLElement;
  const sheetRef = useRef<HTMLElement>(null);
  const point = usePointForecast(pt);
  const [slow, setSlow] = useState(false);
  const fieldTime = view.selectedTime;   // B8: a debounced field time was tried and measured no faster (the per-step cost is mostly the pins), so the field follows every step
  const spatial = useSpatial(def.layer, def.variable, fieldTime, false, live && (opts.heat || opts.flow || opts.arrows));
  const waiting = spatial.loading && !spatial.frame;
  
  // Keep the last good frame of this field on screen while the next hour loads, so scrubbing doesn't flash blank.
  const shown = useRef<SpatialFrame | null>(null);
  // Map-seamless Stage 1: a failed load keeps the last good frame too (it used to drop it and blank the sea); the error says which hour is shown.
  const shownFor = useRef<FieldId>(fieldId); // which layer the held frame belongs to (waves and swell share a unit, so a held frame can be the other layer)
  if (spatial.frame) { shown.current = spatial.frame; shownFor.current = fieldId; } else if (!spatial.loading) shown.current = null; // the hold lasts only while the next frame is loading: a finished request with no frame clears it (Codex P1)
  const frame = shown.current && shown.current.unit === def.unit ? shown.current : null;
  // Worldwide native 0.5° frame underneath, so colour and flow continue past the California grid to the whole globe.
  const globe = useGlobe(def.layer, def.variable, fieldTime, live && (opts.heat || opts.flow || opts.arrows));
  const shownGlobe = useRef<SpatialFrame | null>(null);
  if (globe.frame) shownGlobe.current = globe.frame; else if (!globe.loading) shownGlobe.current = null;
  const gframe = shownGlobe.current && shownGlobe.current.unit === def.unit ? shownGlobe.current : null;
  const gfield = useMemo(() => (gframe ? buildField(gframe, def.layer === 'WIND') : null), [gframe, def.layer]);
  // Stage 2b: when the global frame is the GFS-Wave 0.25° pipeline frame, it IS the model on screen; the regional WW3 0.5° nest would blend a different model into it, so it is not painted.
  const settledEmpty = !spatial.loading && !globe.loading && !gframe && !frame;
  const packedGlobal = !!gframe?.provider.startsWith('NOAA GFS-Wave');
  // The regional California grid is the same WW3 0.5° as the native global frame, so once the global frame is here it is painted alone (no nest seam, no second source). Swell height is never painted from the regional grid: it has no "no swell partition" fill (see NO_SWELL_NOTE), so it would show grey holes.
  const nestPainted = !!frame && !packedGlobal && !(gframe && gframe.resolution <= frame.resolution) && def.layer !== 'SWELL';
  const field = useMemo(() => (nestPainted && frame ? buildField(frame, def.layer === 'WIND') : null), [frame, def.layer, nestPainted]);
  // Map-seamless Stage 1: a non-blocking "Still loading · Retry" after 5 s (was 20 s); the held frame stays on screen meanwhile.
  const anyLoading = spatial.loading || globe.loading;
  // map-load (user, 2026-11-12: "a bunch of error messages that fill the screen"): 'slow' only after SLOW_MS of one request still open (it restarts with each new request,
  // never counted from page start), and it still says LOADING (with Retry), never a 'failed' wording: a failure is only an error or an empty answer (seaFailed).
  useEffect(() => { setSlow(false); if (!anyLoading) return; const t = window.setTimeout(() => setSlow(true), SLOW_MS); return () => window.clearTimeout(t); }, [anyLoading, spatial.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const allTimes = view.timeline;
  // The forecast window (1 / 3 / 7 days from the first frame) bounds the slider, stepping and playback.
  const times = allTimes; // T-117: the day strip spans the whole forecast range
  // Stage 1 URL state: restore the shared hour once the timeline exists (nearest model hour within 3 h; an hour outside the forecast is ignored),
  // then keep ?layer and ?t current; the map's keys leave the URL with the map (the store keeps ?spot).
  const tRestored = useRef(!urlInit.t);
  useEffect(() => {
    if (tRestored.current || !times.length) return; tRestored.current = true;
    const want = Date.parse(urlInit.t!), best = times.reduce((b, t) => (Math.abs(Date.parse(t) - want) < Math.abs(Date.parse(b) - want) ? t : b), times[0]);
    if (Math.abs(Date.parse(best) - want) <= 3 * 36e5 && best !== view.selectedTime) view.selectTime(best);
  }, [times]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { writeMapUrl({layer: fieldId}); }, [fieldId]);
  useEffect(() => { if (tRestored.current && view.selectedTime) writeMapUrl({t: new Date(view.selectedTime).toISOString()}); }, [view.selectedTime, times.length]);
  useEffect(() => () => writeMapUrl({layer: null, lat: null, lon: null, z: null, t: null}), []);
  const sel = times.indexOf(view.selectedTime ?? '');
  const ti = sel >= 0 ? sel : view.selectedTime && times.length && Date.parse(view.selectedTime) > Date.parse(times[times.length - 1]) ? times.length - 1 : 0;
  // One lookup table per (records, hour): the old per-call scan of every record of every spot made each pin, label and list row O(records) (~0.3 s of main thread on a phone at 492 spots, T-091). First match wins, as find() did.
  const recIndex = useMemo(() => { const m = new Map<string, (typeof view.mapRecords)[number]>(); for (const r of view.mapRecords) if (r.timestamp === view.selectedTime && !m.has(r.spotId)) m.set(r.spotId, r); return m; }, [view.mapRecords, view.selectedTime]);
  const recAt = (id: string) => recIndex.get(id);
  // pills-snapshot: for the selected hour, the daily forecast of every spot (Worker `/api/coast-ratings`, the newest complete daily capture re-rated with the current engine). Only spots with no live record at the hour use it,
  // and the pills say so. An hour outside the capture's 48 hours, no capture or a failed request leaves `snap` null: those spots read "Not loaded yet". Asked once per hour.
  const [snap, setSnap] = useState<ClientSnapshot | null>(null), [snapLoading, setSnapLoading] = useState(false);
  useEffect(() => {
    const t = snapshotHour(view.selectedTime); setSnap((cur) => (cur && cur.t === t ? cur : null));
    if (!t) { setSnapLoading(false); return; }
    let live = true; setSnapLoading(true);
    const timer = setTimeout(() => { loadSnapshot(t).then((v) => { if (live) { setSnap(v); setSnapLoading(false); } }); }, 150);   // scrubbing the time strip asks once, for the hour it stops on; the pill says "Loading forecast…", never "Not loaded yet", meanwhile
    return () => { live = false; clearTimeout(timer); };
  }, [view.selectedTime]);

  useEffect(() => {
    if (!mapEl.current) return;
    const small = matchMedia('(max-width: 860px)').matches, el = mapEl.current; let alive = true, made: MapEngine | null = null;
    const init = {view: {lat: urlInit.lat ?? 37.5, lon: urlInit.lon ?? (small ? -122.5 : -122.45), zoom: urlInit.z ?? (small ? 8 : 9)}, // Stage 1: the URL's view
      minZoom: minZoomFor(el.clientWidth || window.innerWidth), maxZoom: mapConfig.view.maxZoom, theme: currentTheme()};
    // If the requested engine cannot start (no WebGL, or its code failed to load), fall back to the Leaflet engine: the map never stays empty.
    const kind = engineKind();
    void createEngine(kind, el, init).catch((err) => { if (kind === 'leaflet') throw err; console.warn('Map engine', kind, 'unavailable, using Leaflet:', err); el.replaceChildren(); return createEngine('leaflet', el, init); }).then((x) => {
      if (!alive) { x.dispose(); return; }
      made = x; map.current = x; fieldCtl.current = x.field;
      const z = () => setZoom(x.getView().zoom); x.on('zoomend', z); z();
      x.on('moveend', () => { const v = x.getView(); writeMapUrl({lat: v.lat, lon: v.lon, z: v.zoom}); });
      // Track 2: which spots are in view, after every settled move (the "In view" list follows the map)
      x.on('moveend', () => seenRef.current()); seenRef.current(); // Stage 1 (product): the URL follows every settled move
      for (const e of ['zoomend', 'moveend', 'resize'] as const) x.on(e, () => declutterRef.current()); // panels stay put while the map pans
      // T-117: a clean tap on the sea opens the point there (the engine never reports clicks on markers, overlays, or after a drag); it also closes the spot callout.
      // 1B: on wide screens a click on empty map (never a pin: the engine does not report those) also clears the map's spot focus.
      x.on('click', (c) => { setCallout(null); if (!isPhone()) setMapFocused(false); if (c && Date.now() - closedAt.current > 400) { setPanel(false); setPt({lat: c.lat, lon: c.lon}); } });
      setEng(x);
    });
    return () => { alive = false; made?.dispose(); map.current = null; fieldCtl.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // T-056: on phones the tile attribution is one line; tapping it shows the full credit (links work once it is open).
  useEffect(() => {
    const el = rootRef.current?.querySelector<HTMLElement>('.leaflet-control-attribution, .xcredit'); if (!el) return;
    el.tabIndex = 0; el.setAttribute('aria-label', 'Map credits. Press to show in full'); el.setAttribute('aria-expanded', 'false');
    const open = (e: Event) => {
      if (!matchMedia('(max-width: 860px)').matches || el.classList.contains('open')) return;
      e.preventDefault(); e.stopPropagation(); el.classList.add('open'); el.setAttribute('aria-expanded', 'true');
    };
    const close = () => { el.classList.remove('open'); el.setAttribute('aria-expanded', 'false'); requestAnimationFrame(() => declutterRef.current()); };
    // lead review (OSMF attribution guidelines): on phones the credit shows in full when the map opens and folds to the (i) at the first interaction, as
    // MapLibre's compact attribution does
    if (matchMedia('(max-width: 860px)').matches) { el.classList.add('open'); el.setAttribute('aria-expanded', 'true'); }
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') open(e); else if (e.key === 'Escape') close(); };
    // phone pass 2: the credit is an (i) until opened; a tap anywhere else folds it back
    const away = (e: Event) => { if (el.classList.contains('open') && !el.contains(e.target as Node)) close(); };
    el.addEventListener('click', open, true); el.addEventListener('keydown', key); document.addEventListener('pointerdown', away, true);
    return () => { el.removeEventListener('click', open, true); el.removeEventListener('keydown', key); document.removeEventListener('pointerdown', away, true); };
  }, [eng]);


  // Map-seamless Stage 1: ONE field controller per map. A layer or hour change draws the new field off-screen and crossfades it over the old one (the old stays until the new is drawn); a frame still loading keeps what is on screen.
  const fieldCtl = useRef<FieldController | null>(null);
  const [paintedFrame, setPainted] = useState<{layer: FieldLayer; validAt: string} | null>(null); const painted = paintedFrame?.layer ?? null; // the layer actually on the canvas (onFrame 'ready'): while a new layer loads the held picture is the previous one, and the legend must say so
  // (the field controller is the engine's: set when the engine is ready, disposed with it)
  useEffect(() => {
    const fields = [field, gfield].filter((f): f is NonNullable<typeof f> => !!f), ctl = fieldCtl.current;
    if (!ctl) return;
    if (!opts.heat && !opts.flow && !opts.arrows) { ctl.clear(); return; }
    if (!fields.length && settledEmpty) { ctl.clear(); setPainted(null); return; } // both requests finished with no usable field: clear the overlay instead of leaving an old frame up unlabelled
    if (fields.length) ctl.update(fields, {heat: opts.heat, flow: opts.flow, arrows: opts.arrows, opacity: 0.72, reducedMotion: reduced(), onFrame: (st) => { if (st.state === 'ready') setPainted({layer: st.key.split('|')[0] as FieldLayer, validAt: st.validAt}); }});
  }, [field, gfield, opts.heat, opts.flow, opts.arrows, eng, settledEmpty]);
  // Idle prefetch of the neighbouring hours and the next layer once the visible frames have settled (Stage 1).
  useEffect(() => {
    if (!live || spatial.loading || globe.loading || !fieldTime) return;
    return schedulePrefetch(def.layer, def.variable, fieldTime, times);
  }, [live, spatial.loading, globe.loading, fieldTime, def.layer, def.variable]); // eslint-disable-line react-hooks/exhaustive-deps

  // map-dots (user, 2026-11-12; spec docs/specs/2026-11-12-map-dots.md): one small dot per spot (close in) and per coast group (coast zoom), nothing far out.
  // The engine draws them (MapLibre symbol layers, collided by priority; no DOM markers). Each dot is built from the SAME record, rating and headline
  // number the spot page shows for the hour (dots.ts dotFace: the number is the midpoint of the page's own range text).
  const [themeKey, setThemeKey] = useState(themeNow);
  useEffect(() => { const mo = new MutationObserver(() => setThemeKey(themeNow())); mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']}); return () => mo.disconnect(); }, []);
  const [fontsOk, setFontsOk] = useState(false);   // the numbers are drawn with Archivo: wait for it (at most 1.5 s), so no dot is drawn in a fallback face
  useEffect(() => { let on = true; const done = () => { if (on) setFontsOk(true); }; const t = window.setTimeout(done, 1500); (document.fonts?.load('700 12px Archivo') ?? Promise.resolve()).then(done, done); return () => { on = false; window.clearTimeout(t); }; }, []);
  /** what each dot stands for (spots by id, groups by node id), for the tooltip and the group list */
  const dotInfo = useRef(new Map<string, {name: string; face: DotFace; band: Band; word: string; dark: boolean; ink: string; /** groups: the spot the dot stands for */ best?: string}>());
  const [statusOpen, setStatusOpen] = useState(false), [srcOpen, setSrcOpen] = useState(false);   // map-warn (lead, 2026-11-13): the phone's top source warning is one line too, a tap shows all of it   // map-clusters (lead): the status line is one line with an ellipsis; a tap shows all of it
  // B8 (scrub): the dots are built only for the part of the world around the view (the view plus half a screen each side), refreshed when a settled move
  // leaves that box or crosses a zoom band; far out (no dots) nothing is built. A scrub step then rates tens of spots, not all 1,168.
  const [dotBox, setDotBox] = useState<{s: number; n: number; w: number; e: number; band: 0 | 1 | 2} | null>(null), dotBoxRef = useRef<typeof dotBox>(null);
  useEffect(() => {
    const x = map.current; if (!x) return;
    const upd = () => {
      const z = x.getView().zoom, band = z < DOT_ZOOM.groupsFrom ? 0 : z < DOT_ZOOM.spotsFrom ? 1 : 2, b = x.getBounds(), cur = dotBoxRef.current;
      // (review) refresh while the view is still a margin inside the box, so a cluster at the view's edge never misses spots just outside the box (the margin, 15% of
      // the view, is well over the 46 px cluster radius on any screen)
      const my = (b.north - b.south) * 0.15, mx = (b.east - b.west) * 0.15;
      if (cur && cur.band === band && b.south - my >= cur.s && b.north + my <= cur.n && b.west - mx >= cur.w && b.east + mx <= cur.e) return;
      const dy = (b.north - b.south) / 2, dx = (b.east - b.west) / 2, nb = {s: b.south - dy, n: b.north + dy, w: b.west - dx, e: b.east + dx, band} as const;
      dotBoxRef.current = nb; setDotBox(nb);
    };
    upd(); const offs = [x.on('moveend', upd), x.on('zoomend', upd)]; return () => offs.forEach((f) => f());
  }, [eng]);
  const [hoverDot, setHoverDot] = useState<{id: string} | null>(null);
  useEffect(() => {
    const x = map.current;
    if (!x?.setDots || !fontsOk || !dotBox) return;
    rank.current.clear();
    const box = dotBox, inBox = (lat: number, lon: number) => lat >= box.s && lat <= box.n && [lon, lon + 360, lon - 360].some((l) => l >= box.w && l <= box.e);
    // map-clusters: from the cluster zoom on, every spot in the box goes to the engine, which clusters them (the cluster's number is how many spots it holds)
    const needIds = new Set<string>(); if (focused) needIds.add(focused);
    if (box.band >= 1) for (const e of evidenceSpots) if (inBox(e.latitude, e.longitude)) needIds.add(e.id);
    const need = evidenceSpots.filter((e) => needIds.has(e.id));
    const css = getComputedStyle(document.documentElement), tok = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
    const surface = tok('--bg', '#ffffff'), text = tok('--text', '#1d1d1f'), muted = tok('--muted', '#8a949c');
    const fillOf: Record<Band, string> = {good: tok('--good', '#248a3d'), fair: tok('--fair', '#b8860b'), poor: tok('--poor', '#8e8e93'), none: muted};
    const inkOf = (c: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(c); const n = m ? parseInt(m[1], 16) : 0; return m && inkFor([n >> 16, (n >> 8) & 255, n & 255]) === 'dark' ? '#0e1a22' : '#ffffff'; };
    const unit = p.heightUnit === 'm' ? 'm' : 'ft', info = dotInfo.current; info.clear();
    const rated = new Map(need.map((e) => { const f = recAt(e.id), rating = f ? rateForecast(surfSpot(e.id), f, now) : null; return [e.id, {f, rating, rank: (data.state.favorites.includes(e.id) ? 3000 : POPULAR_SPOTS.includes(e.id) ? 2000 : spotTier(e.id) ? 1000 : 0) + (rating?.baseScore ?? -1)}] as const; }));
    const icons = new Map<string, DotIcon>(), states = new Map<string, SpotState>(), dots: MapDot[] = [];
    for (const e of need) {
      const r = rated.get(e.id)!, {f, rating} = r;
      rank.current.set(e.id, r.rank);
      // a spot with a live record keeps it; one whose live load finished with nothing at the hour stays "nothing"; only a spot not loaded takes the daily forecast (as the pills did)
      const loadedForReal = !!view.ocean.bundle && view.ocean.isSpotLoaded(e.id), sn = !f && !loadedForReal ? snap?.byId.get(e.id) : undefined;
      const hs = f ? headlineSurf(e.id, f, {bundle: view.ocean.bundle, nowMs: now}) : null;
      const face = sn ? dotFace(null, null, unit, {loaded: false, snap: true, captured: `${stampLabel(new Date(sn[3] * 60000).toISOString())} ${mapZoneAbbr(sn[3] * 60000)}`}) : dotFace(hs, hs ? headlineText(hs, p) : null, unit, {loaded: !!f});
      const category = sn ? sn[1] : rating && rating.score !== null ? rating.category : null, band: Band = category ? bandOf(category) : 'none', dark = sn ? sn[2] === 1 : !!rating?.dark;
      const fill = face.kind === 'none' ? muted : fillOf[band];
      const icon: DotIcon = {kind: face.kind, num: face.num, fill, ink: inkOf(fill), surface, text, dir: f && face.kind !== 'snap' ? swellFrom(f.primary) : null, size: face.kind === 'none' ? 12 : 22, sel: false, faded: face.faded, unrated: face.kind === 'est' && band === 'none', pill: face.pill ?? null};
      icons.set(e.id, icon);
      states.set(e.id, sn ? {id: e.id, name: e.name, loaded: false, snap: true, retrieved: sn[3] * 60000, score: sn[0], category: sn[1], band, dark, rank: r.rank} : {id: e.id, name: e.name, loaded: !!f || view.ocean.isSpotLoaded(e.id), score: rating?.score ?? null, category: rating?.category ?? null, band: rating ? bandOf(rating.category) : 'none', dark, rank: r.rank});
      info.set(e.id, {name: e.name, face, band, word: hs?.kind !== 'demonstration' && category && (sn || (rating && rating.score !== null)) ? conditionWord(category) : '', dark, ink: icon.ink});   // a demonstration value never carries a rating word
      // a dot with nothing to show is placed last; the selected spot is its own layer (always drawn, bigger, ringed, named)
      const prio = (face.kind === 'none' ? -10000 : face.kind === 'snap' ? -5000 : 0) + r.rank;
      if (e.id === focused) dots.push({id: e.id, lat: e.latitude, lon: e.longitude, layer: 'sel', icon: {...icon, size: face.kind === 'none' ? 14 : 26, sel: true}, prio: 1e6, name: e.name, dim: dark});
      else if (box.band >= 1) dots.push({id: e.id, lat: e.latitude, lon: e.longitude, layer: 'spot', icon, prio, name: e.name, dim: dark, band: face.kind === 'none' || face.kind === 'snap' ? 'none' : band});
    }
    x.setDots(dots, {...DOT_ZOOM, pad: isPhone() ? 9 : 4, text, halo: surface, ring: {good: fillOf.good, fair: fillOf.fair, poor: fillOf.poor, none: muted, surface}});
    x.container.dataset.dots = String(dots.length);   // the dots are set (QA waits on [data-dots]; they are drawn on the map canvas, not as DOM)
    x.container.dataset.dotsAt = view.selectedTime ?? '';   // map-clusters (QA): the hour the dots were built for
    declutterRef.current();
  }, [eng, fontsOk, dotBox, themeKey, view.mapRecords, view.selectedTime, snap, focused, p.heightUnit, p.scale, data.state.favorites.join('|'), evidenceSpots]); // eslint-disable-line react-hooks/exhaustive-deps
  // taps and hover on the dots: a spot dot opens its callout (as the pin did), a group dot its list; hover names the dot
  useEffect(() => {
    const x = map.current; if (!x?.onDot) return;
    const off = x.onDot((ev) => {
      const group = ev.layer === 'group' || ev.layer === 'cluster';   // map-clusters: a cluster tap zooms to its spots (the engine); it closes any callout
      if (ev.type === 'click') { setHoverDot(null); if (group) setCallout(null); else pickRef.current(ev.id); }
      else if (ev.type === 'enter') { if (!group) { setHoverDot({id: ev.id}); setHover(ev.id); } }
      else { setHoverDot(null); setHover(null); }
    });
    const offMove = x.on('movestart', () => setHoverDot(null));
    // QA hook (dev only): the dots drawn now, after collision, with what each one shows
    const w = window as unknown as {__xdots?: unknown};
    if (import.meta.env.DEV) w.__xdots = () => { const placed = x.placedDots?.() ?? [], {width, height} = x.getSize(), on = placed.filter((d) => d.x >= 0 && d.y >= 0 && d.x <= width && d.y <= height);
      return {spots: on.filter((d) => d.layer === 'spot').length, groups: on.filter((d) => d.layer === 'group').length, clusters: on.filter((d) => d.layer === 'cluster').length, sel: on.filter((d) => d.layer === 'sel').length,
        list: on.map((d) => { if (d.layer === 'cluster') return d; const i = dotInfo.current.get(d.id); return {...d, kind: i?.face.kind, num: i?.face.num ?? null, pill: i?.face.pill ?? null, band: i?.band, word: i?.word, name: i?.name}; })}; };
    if (import.meta.env.DEV) (w as {__xleaves?: unknown}).__xleaves = (id: string) => x.clusterLeaves?.(id) ?? Promise.resolve([]);
    return () => { off(); offMove(); if (import.meta.env.DEV) delete w.__xdots; };
  }, [eng]);

  /** The spots in view (subset loading) after every settled move: best-ranked first, the selected spot first; only from zoom 7 (a regional view), so a
   *  world-zoom pan never marks 150 spots as wanted. The dots themselves are placed by the engine. */
  const reportTimer = useRef<number | null>(null);
  const declutter = () => {
    const m = map.current;
    if (!m) return;
    const {width, height} = m.getSize(), z = m.getView().zoom;
    const vis = z >= 7 ? evidenceSpots.filter((e) => { const q = m.project(e.latitude, e.longitude); return q.x >= 0 && q.y >= 0 && q.x <= width && q.y <= height; })
      .sort((a, b) => Number(b.id === focused) - Number(a.id === focused) || (rank.current.get(b.id) ?? -1) - (rank.current.get(a.id) ?? -1)).slice(0, 60).map((e) => e.id) : [];
    if (reportTimer.current) window.clearTimeout(reportTimer.current);
    reportTimer.current = window.setTimeout(() => reportVisibleRef.current(vis), 500);
    // design re-critique: the floating controls (search, chips, the layer and zoom buttons, notes, the credit) shield the basemap's place names, so no
    // town name hides under a button (the engine leaves out a name that would collide with these boxes; nothing is drawn)
    if (m.shieldLabels) {
      const edge = m.container.getBoundingClientRect(), root = m.container.parentElement;
      const top = Array.from(root?.querySelectorAll<HTMLElement>('.xtopbar > *') ?? []).flatMap((el) => (el.tagName === 'DIV' && el.children.length ? Array.from(el.children) : [el]));
      const boxes = [...top, ...Array.from(root?.querySelectorAll<HTMLElement>('.xfabs > *, .xfabs .xzoom > *, .xsrcwarn, .xcredit, .xdark, .xspotpop') ?? [])]
        .map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height && r.right > edge.left && r.left < edge.right && r.bottom > edge.top && r.top < edge.bottom)
        .map((r) => { const c = m.unproject(r.left - edge.left + r.width / 2, r.top - edge.top + r.height / 2); return {lat: c.lat, lon: c.lon, w: r.width + 6, h: r.height + 6}; });
      m.shieldLabels(boxes);
    }
  };
  // T-058: on phones the map opens with the selected spot in the clear area above the time bar (never under it or the attribution).
  useEffect(() => {
    if (!phone || !focused) return;
    const t = window.setTimeout(() => {
      const m = map.current, e = evidenceSpots.find((x) => x.id === spot.id), root = rootRef.current; if (!m || !e || !root) return;
      const box = m.container.getBoundingClientRect(), floor = root.querySelector('.leaflet-control-attribution, .xcredit')?.getBoundingClientRect().top ?? box.bottom;
      const at = m.project(e.latitude, e.longitude), want = {x: box.width * 0.4, y: (floor - box.top) * 0.55};
      m.panBy(at.x - want.x, at.y - want.y, {animate: false});
    }, 400);
    return () => window.clearTimeout(t);
  }, [phone, eng]); // eslint-disable-line react-hooks/exhaustive-deps
  const declutterRef = useRef(declutter);
  declutterRef.current = declutter;
  // Sheets and popovers open and slide; re-place labels once they settle.
  useEffect(() => { const t = setTimeout(() => declutterRef.current(), 280); return () => clearTimeout(t); }, [open, detent, callout, phone]);


  // The point label sits on the picker (it follows the picker while it is dragged); the spot callout sits on its pin (wide screens only).
  useEffect(() => { if (pt) setCallout(null); }, [pt]);
  // Stage 6 (Windy's picker): a draggable handle at the point. Dragging moves the label and its value live (sampled from the painted field, no
  // network); the hourly point forecast is fetched once, on release. Arrow keys nudge it 0.1° and commit 0.7 s after the last press.
  // The handle is created once and moved after (never re-created), so keyboard focus stays on it across commits.
  const pickMk = useRef<MarkerHandle | null>(null), pickEl = useMemo(() => { const d = document.createElement('div'); d.className = 'xpick'; d.innerHTML = '<i></i>'; d.dataset.mapOverlay = ''; return d; }, []);
  useEffect(() => {
    const x = map.current;
    if (!x || !pt) { pickMk.current?.remove(); pickMk.current = null; setLivePt(null); return; }
    setLivePt(null);
    if (pickMk.current) { pickMk.current.setLatLon(pt.lat, pt.lon); return; }
    pickMk.current = x.addMarker({lat: pt.lat, lon: pt.lon, element: pickEl, size: [44, 44], anchor: 'center', draggable: true, keyboard: true, zIndex: 1500,
      title: 'Point picker: drag it, or use the arrow keys, to read another point',
      onDrag: (lat, lon) => { setPanel(false); setLivePt({lat, lon}); },
      onDragEnd: (lat, lon) => { closedAt.current = Date.now(); setPt({lat, lon}); }});
  }, [pt, eng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let t = 0;
    const key = (e: KeyboardEvent) => {
      const d: Record<string, [number, number]> = {ArrowUp: [0.1, 0], ArrowDown: [-0.1, 0], ArrowLeft: [0, -0.1], ArrowRight: [0, 0.1]}, mk = pickMk.current;
      if (!d[e.key] || !mk) return; e.preventDefault(); e.stopPropagation();
      const ll = mk.getLatLon(), n = {lat: ll.lat + d[e.key][0], lon: ((((ll.lon + d[e.key][1]) + 180) % 360 + 360) % 360) - 180};
      mk.setLatLon(n.lat, n.lon); setLivePt(n);
      clearTimeout(t); t = window.setTimeout(() => setPt(n), 700);
    };
    pickEl.addEventListener('keydown', key); return () => { clearTimeout(t); pickEl.removeEventListener('keydown', key); };
  }, [pickEl]);
  useEffect(() => () => { pickMk.current?.remove(); pickMk.current = null; }, [eng]);
  // 1B: Esc clears the map's spot focus (and closes its callout); typing in a field keeps its own Esc.
  const clearFocus = () => { setCallout(null); setMapFocused(false); };
  useEffect(() => {
    if (!focused && !callout) return;
    // An Esc that closes something else (a menu, popover, the layers sheet, the spot picker) is theirs: they mark it handled (preventDefault),
    // and an Esc from inside an open dialog, menu or popover is skipped too. Checked after the other listeners ran (whatever order they were added in).
    const OPEN = '[role="dialog"], [role="menu"], [role="listbox"], .xpop, .menu, [aria-modal="true"]';
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select') || t?.closest?.(OPEN)) return;
      const overlayOpen = !!document.querySelector('[aria-expanded="true"]:not(.xtb-search input):not(.xcredit):not(.leaflet-control-attribution)');
      window.setTimeout(() => {
        if (e.defaultPrevented || overlayOpen) return;
        setCallout(null); setMapFocused(false);
      }, 0);
    };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [callout, focused, spot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepBy = useCallback((dir: -1 | 1, wrap = false) => {
    if (!times.length) return;
    const ms = times.map((t) => Date.parse(t)), want = ms[ti] + dir * step * 36e5;
    let k = -1;
    if (dir > 0) { k = ms.findIndex((v) => v >= want); if (k < 0) k = wrap ? 0 : ms.length - 1; }
    else { ms.forEach((v, i) => { if (v <= want) k = i; }); if (k < 0) k = 0; }
    view.selectTime(times[k]);
  }, [times, ti, step, view]);
  const stepRef = useRef(stepBy);
  stepRef.current = stepBy;
  // Play speed follows the step: 1 h frames are slow and detailed, 1 d frames sweep the whole week quickly.
  useEffect(() => {
    if (!playing || !times.length) return;
    const id = setInterval(() => stepRef.current(1, true), 600);
    return () => clearInterval(id);
  }, [playing, times.length, step]);

  /** Height of the phone sheet in px (for keeping pins and popups above it). */
  const sheetPx = () => sheetRef.current?.getBoundingClientRect().height ?? 0;
  const at0 = livePt ?? pt, callEv0 = !phone && callout ? evidenceSpots.find((x) => x.id === callout) : undefined;
  useAnchored(eng, popupBox, at0 ? {lat: at0.lat, lon: at0.lon} : null, -16, phone ? {top: 16, left: 16, right: 64, bottom: sheetPx() + 70} : {top: 80, left: open ? 380 : 16, right: 76, bottom: 90}, !!pt && !livePt, () => pickMk.current?.element);
  // point-panel-390: on phones the panel now stands on the time bar, higher up; when it opens, the map pans just enough to keep the point's label and
  // picker above it (only where the space above the panel can hold them: a landscape phone leaves the panel the map).
  useEffect(() => {
    if (!phone || !panel || !pt) return;
    let r1 = 0, r2 = 0;
    // the panel grows when its table arrives (it opens as a short skeleton): check again whenever its size changes, not only when it opens
    const check = () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(place); }); };
    const ro = new ResizeObserver(check); const panelEl = rootRef.current?.querySelector('.xpanel'); if (panelEl) ro.observe(panelEl);
    const place = () => {
      const m = map.current, pan = rootRef.current?.querySelector('.xpanel')?.getBoundingClientRect(); if (!m || !pan) return;
      const boxes = [popupEl.getBoundingClientRect(), pickEl.getBoundingClientRect()].filter((r) => r.width);
      if (!boxes.length) return;
      const top = Math.min(...boxes.map((r) => r.top)), bottom = Math.max(...boxes.map((r) => r.bottom)), c = m.container.getBoundingClientRect();
      // under the search box and its focus chip: their visible parts (the .xsearchbox container is taller than what it shows)
      const head = Math.max(c.top + 8, ...Array.from(rootRef.current?.querySelectorAll<HTMLElement>('.xtopbar > *') ?? []).map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => r.bottom));
      const room = pan.top - 4 - (head + 4), need = bottom - (pan.top - 4);   // 4 px clear of each (the label's note can wrap to two lines on a phone)
      if (need > 0 && bottom - top <= room) m.panBy(0, Math.round(need), {animate: !reduced()});
    };
    check();
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); ro.disconnect(); };
  }, [phone, panel, pt?.lat, pt?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  useAnchored(eng, spotPopBox, callEv0 ? {lat: callEv0.latitude, lon: callEv0.longitude} : null, -26, /* clear of the pin's own label (as the Leaflet popup sat) */ {top: 80, left: open ? 380 : 80, right: 80, bottom: 90}, true, () => null, () => flying.current);
  // The phone peek sizes itself to the spot card; the time bar, legend and attribution sit just above it.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheetRef.current, root = rootRef.current;
    if (root && (!phone || !sheetOn)) root.style.setProperty('--peek', '0px'); // T-117: no spot sheet, so the strip sits on the map's bottom edge
    if (!phone || !el || !root || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => { if (detent === 'peek') root.style.setProperty('--peek', `${Math.round(el.getBoundingClientRect().height)}px`); });
    ro.observe(el); return () => ro.disconnect();
  }, [phone, detent, sheetOn]);
  // Phones: the point panel sits ON the time bar (not under it), so the bar's live height is a CSS variable (--xbot-h); it wraps to two rows and grows with the dark/cache notes.
  useEffect(() => {
    const root = rootRef.current, bar = root?.querySelector<HTMLElement>('.xbottom');
    if (!root || !bar || typeof ResizeObserver !== 'function') return;
    const set = () => root.style.setProperty('--xbot-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    const ro = new ResizeObserver(set); ro.observe(bar); set(); return () => ro.disconnect();
  }, [eng]);
  /** Glide to a spot; the target sits in the free part of the map, clear of the list sheet or the phone sheet. */
  const flyToSpot = (id: string, sheetOpen = open, focusPin = false) => {
    const m = map.current, e = evidenceSpots.find((x) => x.id === id);
    if (!m || !e) return;
    const cur = m.getView().zoom, z = Math.max(COAST_MAX_ZOOM, cur);   // §5: land at the pins level, so the spot's own pin shows
    const shift: [number, number] = phone ? [0, Math.min(sheetPx(), 260) / 2] : [sheetOpen ? -184 : 0, -60];
    // The shift is in pixels at the target zoom; at the current zoom it is 2^(cur - z) as many (engine-neutral, via project/unproject).
    const k = 2 ** (cur - z), at = m.project(e.latitude, e.longitude), to = m.unproject(at.x + shift[0] * k, at.y + shift[1] * k);
    // once landed: the callout may settle; a pick from search or the list puts keyboard focus on the spot's pin (only if focus was not taken elsewhere meanwhile)
    // map-dots: the dots are drawn by the engine (no focusable pin), so a pick from search or the list puts keyboard focus on the spot's callout (wide) or
    // its peek card (phone), which names the spot and the hour; only if focus was not taken elsewhere meanwhile
    const land = () => { flying.current = false; if (!focusPin) return; requestAnimationFrame(() => { const a = document.activeElement; if (a && a !== document.body && !m.container.contains(a)) return;
      const t = rootRef.current?.ownerDocument.querySelector<HTMLElement>('.xspotpop .xco, #xsheet .xco') ?? rootRef.current?.querySelector<HTMLElement>('#xsheet') ?? null; if (!t) return; if (t.tabIndex < 0 && !t.hasAttribute('tabindex')) t.tabIndex = -1; t.focus({preventScroll: true}); }); };
    const here = m.project(to.lat, to.lon), c = m.container.getBoundingClientRect();
    if (Math.abs(z - cur) < 0.01 && Math.hypot(here.x - c.width / 2, here.y - c.height / 2) < 1) { land(); return; }   // already there: no flight, nothing to wait for
    // a flight token: only the newest flight's landing acts; the listener is registered after the call (a jump's synchronous moveend is ignored) with a timeout fallback
    const token = ++flight.current; flying.current = true;
    if (reduced()) m.setView({lat: to.lat, lon: to.lon, zoom: z}, {animate: false}); else m.flyTo({lat: to.lat, lon: to.lon, zoom: z}, {durationMs: 1100});
    let done = false; const finish = () => { if (done) return; done = true; off(); window.clearTimeout(timer); if (flight.current === token) land(); };
    const off = m.on('moveend', finish), timer = window.setTimeout(finish, reduced() ? 60 : 1500);
  };
  const flyRef = useRef(flyToSpot);
  /** 4E: tapping a coast pill frames its spots (the region chips' fit); below COAST_MAX_ZOOM a merged pill shows its parts, from there on the pins. */
  const frameGroup = (id: NodeId) => {
    const m = map.current, ids = COAST_NODES.get(id); if (!m || !ids?.length) return;
    const z0 = m.getView().zoom, animate = !reduced();
    m.fitPoints(ids.map((sid) => { const e = SPOT_BY_ID.get(sid)!; return {lat: e.latitude, lon: e.longitude}; }), {padRatio: 0.15, maxZoom: 11, animate, padding: {top: phone ? 120 : 80, left: phone ? 16 : 24, right: phone ? 64 : 200, bottom: phone ? 120 : 80}});
    // already at its fit zoom (the tap would do nothing visible): zoom in one step on it. Then keyboard focus goes to the map, as the pill may now be gone.
    let done = false; const off = m.on('moveend', () => settle()), timer = window.setTimeout(() => settle(), animate ? 1500 : 60);
    function settle() { if (done) return; done = true; off(); window.clearTimeout(timer); if (Math.abs(m!.getView().zoom - z0) < 0.25) m!.zoomBy(1); (m!.container.querySelector<HTMLElement>('canvas, .leaflet-container') ?? m!.container).focus({preventScroll: true}); }
  };
  const frameRef = useRef(frameGroup); frameRef.current = frameGroup;
  flyRef.current = flyToSpot;
  /** Choose a spot: select it, open its callout (popup or the phone sheet's peek) and bring it into view. */
  const pickSpot = (id: string, fromList = false) => {
    if (fromList) setRecents(rememberSpot(id));   // §6: the last 5 picks, this browser only
    setSpot(id); setCallout(id); setPt(null);
    if (phone) { setDetent('peek'); setSheetOn(true); }
    else if (fromList) setOpen(false);
    flyRef.current(id, phone ? false : fromList ? false : open, fromList);
  };
  const pickRef = useRef(pickSpot);
  pickRef.current = pickSpot;
  const pickField = (id: FieldId | null) => {
    if (!id) { setOpts({...opts, heat: false}); return; }
    setOpts({...opts, heat: true}); setFieldId(id); if (fieldSection[id] !== section) go('explore', fieldSection[id]);
  };
  const f = recAt(spot.id);
  const rating = f ? rateForecast(spot, f, now) : null;
  const here = evidenceSpots.find((e) => e.id === spot.id) ?? evidenceSpots[0];
  // Your area first: regions ordered by their nearest spot to the focused spot (with nothing focused, to the map's centre), spots north to south within a region.
  const c0 = !focused ? map.current?.getView() : null, ref0 = c0 ? {latitude: c0.lat, longitude: c0.lon} : here;
  const dist = (e: {latitude: number; longitude: number}) => Math.hypot(e.latitude - ref0.latitude, (e.longitude - ref0.longitude) * 0.8);
  const regionRank = new Map<string, number>();
  for (const e of evidenceSpots) regionRank.set(e.region, Math.min(regionRank.get(e.region) ?? Infinity, dist(e)));
  const needle = q.trim().toLowerCase();
  // Track 2 "In view": the spots inside the map's bounds, best rated first, then the larger surf estimate; unrated (or dark) last. Typing searches every spot.
  const byView = zone === 'In view' && !needle;
  // the same height text as the spot's pin: the surf estimate, or the offshore height said as offshore
  const pinHeight = (id: string) => { const r = recAt(id), h = r ? headlineSurf(id, r, {bundle: view.ocean.bundle, nowMs: now}) : null;
    return isFlat(h) ? FLAT_ESTIMATE_TEXT : h?.kind === 'estimate' ? `${ht(h.loFt, p, 0)}–${ht(h.hiFt, p, 0)} ${p.heightUnit}` : h?.kind === 'offshore' ? `${ht(h.ft, p, 0)} ${p.heightUnit} offshore` : h?.kind === 'official' ? `NWS ${officialRange(h, p.heightUnit)}${h.stale ? ' (older)' : ''}` : null; };
  const score = (id: string) => { const r = recAt(id), rt = r ? rateForecast(surfSpot(id), r, now) : null; return rt && rt.score !== null ? rt.score : null; };
  const hiAt = (id: string) => { const r = recAt(id), h = r ? headlineSurf(id, r, {bundle: view.ocean.bundle, nowMs: now}) : null; return h?.kind === 'estimate' ? h.hiFt : -1; };
  // §6: typing searches every spot with the shared matcher (prefix, word starts, region, one typo; accents and apostrophes ignored), favourites and recent picks first among equals
  // the zone filter applies BEFORE the limit of 20 (so a zone's spots are never cut by matches elsewhere); the zone lists are built once each (the matcher's index is per list)
  const zoneSpots = useMemo(() => (zone === 'All' || zone === 'In view' ? evidenceSpots : evidenceSpots.filter((e) => zoneOf(e.region) === zone)), [zone, evidenceSpots]);
  const hits = needle ? searchSpots(zoneSpots, q, {favorites: data.state.favorites, recents, limit: 20}) : [];
  // sea-field (B8): the "in view" list rates and sorts every spot in view, so it is built only while the list is on screen (it was built, then not shown, on every hour of a scrub: ~1.8 s of 24 steps at z6)
  const listShown = phone ? detent !== 'peek' : open;
  const list = byView
    ? !listShown ? [] : evidenceSpots.filter((e) => inView?.has(e.id)).map((e) => ({e, s: score(e.id), h: hiAt(e.id)}))
      .sort((a, b) => (a.s === null ? 1 : 0) - (b.s === null ? 1 : 0) || (b.s ?? 0) - (a.s ?? 0) || b.h - a.h).map((x) => x.e)
    : needle ? hits.map((h) => SPOT_BY_ID.get(h.id)!)
    : [...evidenceSpots].filter((e) => zone === 'All' || zone === 'In view' || zoneOf(e.region) === zone)
      .sort((a, b) => (regionRank.get(a.region)! - regionRank.get(b.region)!) || b.latitude - a.latitude);
  const act = Math.min(active, Math.max(0, list.length - 1)), ghost = needle && list[0] && hits[0]?.id === list[0].id && act === 0 ? completeOf(q, hits[0]) : '';
  /** A region chip frames that stretch of coast (All: back to the selected spot's area) and filters the list. */
  const pickZone = (z: string) => {
    setZone(z); const m = map.current; if (!m || z === 'In view') return; // "In view" follows the map; it never moves it
    const pts = evidenceSpots.filter((e) => z !== 'All' && zoneOf(e.region) === z).map((e) => ({lat: e.latitude, lon: e.longitude}));
    if (pts.length) m.fitPoints(pts, {padRatio: 0.15, animate: !reduced(), padding: {top: phone ? 120 : 80, left: phone ? 16 : 24, right: phone ? 64 : 200, bottom: phone ? 120 : 80}});
    else if (focused) flyRef.current(spot.id);
  };
  // after dark the spots keep their rating; the map says once, quietly, that the hour is dark.
  const darkNow = !!focused && !!view.selectedTime && isDark(spot.id, view.selectedTime);   // the dark mark is about the focused spot; none when nothing is focused
  // T-128: a frame drawn from this device's cache says so, with its own valid time, until the fresh frame replaces it.
  // the ERDDAP frames drawn (the global one and the California subset), each with its components: one server named, or both if they differ
  const shownUrls = [gframe, frame].flatMap((x) => (x ? x.sources ?? [x.url] : []));
  const cache = cacheLabel(nestPainted ? frame : (gframe ?? frame), anyLoading, (iso) => `${weekdayPT(iso, mapZone())} ${hourLabel(iso, mapZone())} ${mapZoneAbbr(iso)}`);
  // lead review: the cache label only once that cached frame is on the canvas (it is drawn a few seconds after the label could show); until then the
  // phone note says the layer is loading, so the label never claims a picture the screen does not show yet
  const cachedF = nestPainted ? frame : (gframe ?? frame);
  const cacheReady = !!cache && !!paintedFrame && !!cachedF && paintedFrame.layer === def.layer && Date.parse(paintedFrame.validAt) === Date.parse(cachedF.validAt);
  // 'ready' is when the frame is drawn; it then fades in (mapConfig.crossfadeMs, longer for the first paint after a reload): the label waits a second
  const [cacheFaded, setCacheFaded] = useState(false);
  useEffect(() => { if (!cacheReady) { setCacheFaded(false); return; } const t = window.setTimeout(() => setCacheFaded(true), Math.max(1000, mapConfig.crossfadeMs + 150)); return () => window.clearTimeout(t); }, [cacheReady]);
  const cacheDrawn = cacheReady && cacheFaded;
  // A8 (audit M2): 'valid' dates the frame actually painted (the same rule as cacheLabel above: the regional nest when it is drawn, else the global frame),
  // and the note says how that frame relates to the hour on the time bar: interpolated between two model steps, or the nearest model step
  const shownFrame = nestPainted ? frame : (gframe ?? frame);
  const interpNote = shownFrame?.provider.match(/hour interpolated between the model steps at [0-9:Z]+ and [0-9:Z]+/)?.[0] ?? null;
  const stepNote = shownFrame && view.selectedTime && !interpNote && Date.parse(shownFrame.validAt) !== Date.parse(view.selectedTime) ? ' · nearest model step' : '';
  // C (audit M21): the chip (below) names the same frame this note describes, so the two can never name different sources
  const shownPacked = !!shownFrame?.provider.startsWith('NOAA GFS-Wave');
  const status = !live ? 'Model layers need live data; the demonstration week shows spots only.'
    : cache && cacheDrawn && opts.heat ? cache.line
    : spatial.loading && !frame && slow ? 'Sea color still loading (taking longer than usual) · spots and forecasts still work'
    : spatial.loading && !frame ? (paintedFrame && opts.heat ? `Loading model… still showing ${FIELDS.find((f) => f.layer === paintedFrame.layer)?.label ?? 'the previous layer'} for ${weekdayPT(paintedFrame.validAt, mapZone())} ${hourLabel(paintedFrame.validAt, mapZone())} ${mapZoneAbbr(paintedFrame.validAt)}` : 'Loading model…')
    : frame || gframe ? `${def.label} · ${shownPacked ? shownFrame!.provider : `${def.layer === 'WIND' ? 'GFS' : 'WW3'}${viaHosts(shownUrls)}`}${shownPacked ? '' : ` · ${gframe ? `global ${gframe.resolution}°` : `${(frame as SpatialFrame).resolution}°`}${frame && gframe ? ' grid (California subset, same model)' : ''}${interpNote ? ` · ${interpNote}` : ''}`} · valid ${weekdayPT(shownFrame!.validAt, mapZone())} ${hourLabel(shownFrame!.validAt, mapZone())} ${mapZoneAbbr(shownFrame!.validAt)}${stepNote}${spatial.loading || globe.loading ? ' · updating…' : ''}`
    : spatial.status;
  const paintedDef = (opts.heat && painted && FIELDS.find((f) => f.layer === painted)) || def; // legend (label + ramp) follows the frame actually painted
  const legend = legendModel(scaleKeyOfField(paintedDef.id), {heightUnit: p.heightUnit, windUnit: p.windUnit}, themeNow());
  const ends = frame || gframe || (opts.heat && painted) ? ([legend.lo, legend.hi] as const) : null;
  const unitLabel = legend.unitLabel;
  const when = view.selectedTime ? `${weekdayPT(view.selectedTime, mapZone())} ${hourLabel(view.selectedTime, mapZone())} ${mapZoneAbbr(view.selectedTime)}` : 'this hour';

  // list-index: the map records by spot, built once whenever they change (rangeAt and hoursFor read only their spot's records, not all of them)
  const recBySpot = useMemo(() => indexBySpot(view.mapRecords), [view.mapRecords]);
  /** Offshore height range at a spot across the shared hour +/- 3 h (from the model records, not invented). */
  const rangeAt = (id: string) => {
    if (!view.selectedTime) return null;
    const t0 = Date.parse(view.selectedTime);
    const hs = near(recBySpot.get(id), t0, 3).map((r) => Number(ht(r.offshore, p, 1)));
    if (!hs.length) return null;
    const lo = Math.floor(Math.min(...hs)), hi = Math.ceil(Math.max(...hs));
    return `${lo === hi ? lo : `${lo}–${hi}`} ${p.heightUnit} offshore`;
  };
  // Track 2: the card's next-hours bars, from the shown hour: each record's surf estimate (offshore-only and missing hours are gaps) and its rating colour.
  const hoursFor = (id: string): HourBar[] => {
    const t0 = view.selectedTime ? Date.parse(view.selectedTime) : now, s = surfSpot(id);
    const byT = new Map(ahead(recBySpot.get(id), t0, 12).map((x) => [x.t, x.r]));
    if (!byT.size) return [];
    // Codex P2 (T-121): one slot per hour, so an hour with no record shows as a gap instead of the bars closing up.
    const h0 = Math.ceil(t0 / 36e5) * 36e5;
    return Array.from({length: 12}, (_, i) => h0 + i * 36e5).filter((t) => t < t0 + 12 * 36e5).map((t) => {
      const r = byT.get(t);
      if (!r) return {t, lo: null, hi: null, c: 'var(--none)', rated: false};
      const h = headlineSurf(id, r, {bundle: view.ocean.bundle, nowMs: now}), rt = rateForecast(s, r, now), ok = rt.score !== null;
      return {t, lo: h.kind === 'estimate' ? h.loFt : null, hi: h.kind === 'estimate' ? h.hiFt : null, flat: isFlat(h), c: ok ? BAND_COLOR[bandOf(rt!.category)] : 'var(--none)', rated: ok};
    });
  };
  const callSpot = callout ? surfSpot(callout) : null, callRec = callout ? recAt(callout) : undefined;
  const callEv = evidenceSpots.find((e) => e.id === callout);
  const tipFor = hoverDot ?? (hover && !phone ? {id: hover} : null);
  const tip$ = eng && tipFor ? (() => {
    const d = dotInfo.current.get(tipFor.id), ll = SPOT_BY_ID.get(tipFor.id);
    if (!d || !ll) return null;
    const q = eng.project(ll.latitude, ll.longitude), sz = eng.getSize(); if (q.x < 0 || q.y < 0 || q.x > sz.width || q.y > sz.height) return null;
    return <div className="xdot-tip" role="tooltip" style={{left: q.x, top: q.y}}><b>{d.name}</b><span>{`${d.face.words}${d.word ? ` · ${d.word}` : ''}`}{d.dark ? ' · after dark' : ''}</span></div>;
  })() : null;
  const callout$ = callSpot && callEv ? (
    <SpotCallout spot={callSpot} region={callEv.region} f={callRec} rating={callRec ? rateForecast(callSpot, callRec, now) : null} when={when} p={p} hours={hoursFor(callSpot.id)}
      onOpen={() => go('forecast')} onClose={phone ? undefined : clearFocus} closeLabel="Clear selection" />
  ) : null;
  const peek$ = phone ? (focused
    ? <SpotCallout spot={spot} region={here.region} f={f} rating={rating} when={when} p={p} hours={hoursFor(spot.id)} onOpen={() => go('forecast')} />
    : <p className="xpickh" data-focus="none">No spot selected · tap a pin or <button type="button" onClick={() => setDetent('half')}>pick from the list</button></p>
  ) : null;

  // Phone sheet: drag the handle between detents, or press it to step through them.
  const dragFrom = useRef<{y: number; h: number} | null>(null), dragged = useRef(false);
  const onHandleDown = (e: React.PointerEvent) => { dragged.current = false; dragFrom.current = {y: e.clientY, h: sheetPx()}; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onHandleMove = (e: React.PointerEvent) => { if (dragFrom.current) setDrag(Math.max(120, dragFrom.current.h + dragFrom.current.y - e.clientY)); };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = dragFrom.current; dragFrom.current = null;
    if (!d) return;
    const moved = d.y - e.clientY;
    setDrag(null);
    // T-116: a tap steps the detent in onClick, not here: changing it on pointer-up moved the sheet before the browser's click, which then landed on a
    // spot row under the finger (picking it and snapping back to the peek).
    if (Math.abs(moved) < 8) return;
    dragged.current = true;
    const root = sheetRef.current?.parentElement?.getBoundingClientRect().height ?? 700, h = d.h + moved;
    setDetent(h > root * 0.72 ? 'full' : h > root * 0.36 ? 'half' : 'peek');
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setDetent(DETENTS[Math.min(2, DETENTS.indexOf(detent) + 1)]); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setDetent(DETENTS[Math.max(0, DETENTS.indexOf(detent) - 1)]); }
  };
  const showList = listShown;
  useEffect(() => { const t = window.setTimeout(() => seenRef.current(), 320); return () => clearTimeout(t); }, [open, detent, sheetOn, phone]); // after the sheet's own transition
  const listBody = (
    <div className="xlist" aria-label="Spots">
      <div className="xtb-chips" role="group" aria-label="Region">
        {['In view', 'All', ...zonesWithSpots(evidenceSpots)].map((z) => <button key={z} type="button" aria-pressed={zone === z} onClick={() => pickZone(z)}>{z}</button>)}
      </div>
      {byView && <p className="xinv-h" aria-live="polite">{list.length ? `${list.length} spot${list.length === 1 ? '' : 's'} in view · best rated first` : 'No surf spot in view: zoom out or pan along the coast.'}</p>}
      {!byView && !list.length && <p className="fine">No spot matches “{q}”{zone !== 'All' && zone !== 'In view' ? ` in ${zone}` : ''}.</p>}
      {/* §6: the last 5 picks while the box is empty */}
      {/* the ratings in these rows are for the map's selected hour (the header search rates now): say which */}
      {(needle || recents.length > 0) && view.selectedTime && <p className="xinv-h">Ratings for {weekdayPT(view.selectedTime, mapZone())} {hourLabel(view.selectedTime, mapZone())} {mapZoneAbbr(view.selectedTime)}</p>}
      {!needle && recents.length > 0 && <><p className="xregion">Recent</p><ul className="xrecent" aria-label="Recent picks">{recents.map((id) => SPOT_BY_ID.get(id)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => {
        const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null, rated = !!rt && rt.score !== null && !!r;
        return <li key={e.id}><SpotRow id={e.id} rowId={`xrec-${e.id}`} name={e.name} sub={`${e.region}${rated ? (rt!.dark ? ' · after dark' : '') : ' · not rated'}`} category={rated ? rt!.category : null} current={false} highlighted={hover === e.id} onPick={() => pickSpot(e.id, true)} onHover={(on) => setHover(on ? e.id : null)} /></li>;
      })}</ul></>}
      <ul role={needle ? 'listbox' : undefined} id={needle ? 'xsuggest' : undefined} aria-label={needle ? 'Suggestions' : undefined}>{list.map((e, i) => {
        const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null;
        const head = !byView && !needle && (i === 0 || list[i - 1].region !== e.region) ? <p className="xregion">{e.region}</p> : null;
        const rated = !!rt && rt.score !== null && !!r, sub = (byView ? pinHeight(e.id) : null) ?? rangeAt(e.id) ?? 'No record at this hour';
        return <li key={e.id} role="presentation">{head}<SpotRow id={e.id} name={e.name} sub={byView || needle ? `${e.region} · ${sub}${rated ? (rt!.dark ? ' · after dark' : '') : ' · not rated'}` : sub} category={rated ? rt!.category : null}
          current={e.id === focused} highlighted={hover === e.id || (!!needle && i === act)} selected={needle ? i === act : undefined} onPick={() => pickSpot(e.id, true)} onHover={(on) => setHover(on ? e.id : null)} /></li>;
      })}</ul>
      <p className="xmore">
        <a href="/explore/discover" onClick={(ev) => { ev.preventDefault(); go('explore', 'discover'); }}>Find spots near you</a>
        <a href="/explore/compare" onClick={(ev) => { ev.preventDefault(); go('explore', 'compare'); }}>Compare spots</a>
      </p>
      {!live && <p className="fine">The demonstration week shows spots only.</p>}
    </div>
  );
  // T-117 (Windy): top left, a search box with a locate button. Focusing or typing shows the region chips and matching spots (a dropdown on wide
  // screens, the sheet on phones).
  const showResults = () => { if (phone) { setSheetOn(true); setDetent('half'); } else setOpen(true); };
  const locate = () => {
    // 1B: with no spot focused this is "my location" only (no fallback to a spot the map is not showing)
    const fallback = () => { if (focused) flyToSpot(spot.id); };
    if (!navigator.geolocation) { fallback(); return; }
    navigator.geolocation.getCurrentPosition((pos) => { const m = map.current; if (m) m.flyTo({lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: Math.max(9, m.getView().zoom)}, {reducedMotion: reduced()}); }, fallback, {timeout: 8000, maximumAge: 600000});
  };
  const topBar = (
    <div className="xtopbar">
      <label className="xsearch xtb-search"><Icon name="search" size={16} /><span className="sr">Find a spot on the map</span>
        <AutofillInput type="search" value={q} completion={ghost} onAccept={() => setQ(q + ghost)} placeholder="Search spots" aria-label="Search spots"
          role="combobox" aria-controls={needle ? 'xsuggest' : 'xsheet'} aria-expanded={showList} aria-activedescendant={needle && showList && list[act] ? `xrow-${list[act].id}` : undefined}
          onFocus={showResults} onChange={(e) => { setQ(e.target.value); setActive(0); showResults(); }}
          onKeyDown={(e) => {
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && needle && list.length) { e.preventDefault(); const n = (act + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length; setActive(n); document.getElementById(`xrow-${list[n].id}`)?.scrollIntoView({block: 'nearest'}); return; }
            if (e.key === 'Enter' && list[act]) { e.preventDefault(); pickSpot(list[act].id, true); (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setQ(''); setActive(0); setOpen(false); }
          }} />
        <button type="button" className="xtb-loc" aria-label={focused ? 'Go to my location (or the selected spot)' : 'Go to my location'} onClick={locate}><Icon name="locate" size={17} /></button>
      </label>
      {/* 1B: the focused spot as a chip with its clear control (when its callout or the phone sheet is not already showing it) */}
      {focused && !(phone ? sheetOn : callout === spot.id) && <span className="xfocus" data-focus={spot.id}>
        <span className="xfocus-n">{spot.name}</span>
        <button type="button" className="xfocus-x" aria-label="Clear selection" title="Clear selection" onClick={clearFocus}><Icon name="close" size={13} /></button></span>}
      {!phone && !open && inView && inView.size > 0 && <button type="button" className="xinview" aria-controls="xsheet" aria-expanded={false}
        onClick={() => { setQ(''); setZone('In view'); setOpen(true); }}>{inView.size} spot{inView.size === 1 ? '' : 's'} in view<Icon name="chevron" size={14} /></button>}
    </div>
  );
  // T-117: the pin label's value is the painted field's own, at the tapped point; the period comes from the period layer when shown, else the point forecast.
  const fieldsNow = [field, gfield].filter((x): x is Field => !!x);
  const at = livePt ?? pt; // while dragging, the label reads the painted field under the moving picker
  const pv = at ? sampleField(fieldsNow, at.lat, at.lon) : null;
  let perS: number | null = null, perFromPoint = false;
  const extras = pointExtras(point.data, view.selectedTime); // picker values per layer: wind gust, swell period and direction, from the point forecast at the same hour
  if (pt && pv && !pv.note && (fieldId === 'waves' || fieldId === 'swell') && point.data && view.selectedTime) { // no period for an empty swell partition
    const t = Date.parse(view.selectedTime) / 1000, d = point.data, k = d.time.reduce((best, x, i) => (Math.abs(x - t) < Math.abs(d.time[best] - t) ? i : best), 0);
    const x = Math.abs(d.time[k] - t) <= 5400 ? (fieldId === 'swell' ? d.swellPeriod?.[k] : (d.wavePeriod?.[k] ?? d.swellPeriod[k])) : null; if (x !== null && x !== undefined) { perS = x; perFromPoint = true; } // the swell layer reads the SWELL period only (Codex P2, T-120: never the total sea's in its place), waves the total sea's
  }
  // map-review (b): a 0-ft swell point is wind sea only; the label gives that wind sea's height from the WAVES frame of the same hour (same model
  // family as the swell frame), fetched only while such a point is open.
  const wavesGlobe = useGlobe('WAVES', 'Offshore Hs', fieldTime, fieldId === 'swell' && !!pv?.note);
  const wavesField = useMemo(() => (wavesGlobe.frame ? buildField(wavesGlobe.frame, false) : null), [wavesGlobe.frame]);
  const windSea = pv?.note && wavesField && at ? sampleField([wavesField], at.lat, at.lon)?.value ?? null : null;
  // audit P1-4: a point with no value says why, and says "enclosed water" only where the enclosed-water mask marks it
  const noValueWhy = !(opts.heat || opts.flow || opts.arrows) ? 'sea color off' : !(frame || gframe) ? 'loading…' : pt && enclosedCovers(pt.lat, pt.lon) && isEnclosedWater(pt.lat, pt.lon) ? 'enclosed water' : 'no model cell this close to shore';
  const line = pointLine(pv, perS, p, fieldId, windSea, extras, shownPacked ? 'GFS-Wave' : def.layer === 'WIND' ? 'GFS' : 'WW3');   // A19: the label names the model it samples
  const cycleUnit = def.unit === 'm' ? () => data.profile({heightUnit: p.heightUnit === 'ft' ? 'm' : 'ft'})
    : def.unit === 'm/s' ? () => data.profile({windUnit: p.windUnit === 'mph' ? 'kn' : p.windUnit === 'kn' ? 'km/h' : 'mph'}) : null;
  const modelName = shownPacked ? `GFS-Wave ${shownFrame!.resolution}° · NOAA` : `${def.layer === 'WIND' ? 'GFS' : 'WW3'}${erddapHosts(shownUrls) ? ` · ${erddapHosts(shownUrls)}` : ''}`;   // the server(s) the drawn frames came from (PacIOOS since NOAA's move)
  // Debug overlay (?debug=1, dev only): what the map is painting, from the same frames the field uses.
  const debugInfo = useRef<DebugInfo | null>(null);
  { const f = gframe ?? frame; debugInfo.current = f && opts.heat ? {model: modelName, source: f.provider, run: packedGlobal ? (/run ([^)]*)\)/.exec(f.provider)?.[1] ?? '?') : 'n/a (ERDDAP best series, no run id)', validAt: f.validAt, retrievedAt: f.retrievedAt, layer: (paintedDef.label ?? def.label), held: paintedDef.id !== def.id} : null; }
  useEffect(() => (debugEnabled() ? attachDebugOverlay(() => debugInfo.current) : undefined), []);

  const loadedIds = view.ocean.bundle?.loadedSpotIds;
  useEffect(() => {
    if (!live || view.ocean.loading || playing || fillStep.current >= fillQ.length) return;
    const t = window.setTimeout(() => {
      if (Date.now() - lastScrub.current < 4000) { setFillTick((x) => x + 1); return; }   // scrubbing: look again shortly
      const done = new Set(loadedIds ?? []);
      let step = fillStep.current; while (step < fillQ.length && fillQ[step].every((id) => done.has(id))) step++;   // regions already loaded add nothing
      fillStep.current = Math.min(fillQ.length, step + 1);
      fillSpots(fillQ.slice(0, fillStep.current).flat());
    }, 800);
    return () => window.clearTimeout(t);
  }, [live, view.ocean.loading, playing, fillQ, fillTick, loadedIds, fillSpots]);
  // lead (phone pass 2a): the phone map has no app header, so the header's source warning shows here without a tap: the sources the map depends on that are
  // not connected (unavailable, or a stale copy), or the demonstration / unavailable state. Still-loading sources are not a limit.
  const srcWarn = !live ? 'Demonstration · not live' : !view.ocean.bundle && !view.ocean.loading ? 'Forecast unavailable'
    : (() => { const bad = view.ocean.statuses.filter((x) => x.state === 'unavailable' || x.state === 'partial'); // statuses are per spot ('Open-Meteo Marine · Ocean Beach'): one entry per source, with how many spots it limits
      const by = new Map<string, Set<string>>(); for (const x of bad) { const [src, where = ''] = x.provider.split(' · '); const k = `${src}${x.state === 'partial' ? ' (stale copy)' : ''}`; if (!by.has(k)) by.set(k, new Set()); by.get(k)!.add(where); }
      return by.size ? `Limited: ${[...by].map(([k, w]) => `${k}${w.size > 1 ? ` (${w.size} spots)` : ''}`).join(', ')}` : ''; })();
  const srcWarnTitle = view.ocean.statuses.filter((x) => x.state === 'unavailable' || x.state === 'partial').map((x) => `${x.provider}: ${x.message}`).join('\n');
  // lead (phone pass, data honesty): on a phone (no model chip) the sea names its model when the global GFS-Wave frames are not in use (a stale or missing run:
  // the map falls back to WW3/GFS over ERDDAP), and says it is loading while no field for this hour has arrived, instead of an unlabelled sea.
  const fallbackName = opts.heat && framesBase() && (frame || gframe) && !packedGlobal ? `${def.layer === 'WIND' ? 'GFS' : 'WW3'} fallback${erddapHosts(shownUrls) ? ` (${erddapHosts(shownUrls).replace(/ ERDDAP$/, '')})` : ''}` : '';
  const seaLoading = opts.heat && live && !!view.selectedTime && !slow && !(frame || gframe) ? `Loading ${LEGEND_NAMES[def.id as keyof typeof LEGEND_NAMES]?.word.toLowerCase() ?? def.short.toLowerCase()}…` : '';
  // lead review 3: the phone has no model chip, so a held picture (the previous layer or hour still on screen while the new one loads, or the sea not loading
  // at all) is captioned here with what is actually shown
  const heldWord = paintedFrame ? (LEGEND_NAMES[(FIELDS.find((f) => f.layer === paintedFrame.layer)?.id ?? '') as keyof typeof LEGEND_NAMES]?.word ?? 'the previous layer') : '';
  const heldWhen = paintedFrame ? `${weekdayPT(paintedFrame.validAt, mapZone())} ${hourLabel(paintedFrame.validAt, mapZone())}` : '';
  const isHeld = opts.heat && live && !!paintedFrame && anyLoading && (paintedFrame.layer !== def.layer || (!!view.selectedTime && Date.parse(paintedFrame.validAt) !== Date.parse(view.selectedTime)));
  // On phones this note also stands in for the .xload pill (hidden there): the forecast still loading, a failed hour (with Retry) and a slow one (with Retry)
  const seaFailed = opts.heat && live && !!view.selectedTime && !spatial.loading && !spatial.frame && !/^Loading/.test(spatial.status);
  const showing = paintedFrame ? ` · showing ${heldWord}, ${heldWhen}` : '';
  const heldNote = !opts.heat || !live || (cache && cacheDrawn) ? ''
    : cache ? `Loading ${LEGEND_NAMES[def.id as keyof typeof LEGEND_NAMES]?.word.toLowerCase() ?? 'the layer'}…`
    : !view.selectedTime && dataPhase(view.ocean) === 'loading' ? 'Loading the forecast…'
    : seaFailed ? `Couldn't load ${LEGEND_NAMES[def.id as keyof typeof LEGEND_NAMES]?.word.toLowerCase() ?? 'the layer'}${showing}`
    : slow && anyLoading ? `Still loading ${LEGEND_NAMES[def.id as keyof typeof LEGEND_NAMES]?.word.toLowerCase() ?? 'the layer'} (taking longer than usual)${paintedFrame ? showing : ' · spots still work'}`
    : isHeld ? `Loading ${LEGEND_NAMES[def.id as keyof typeof LEGEND_NAMES]?.word.toLowerCase() ?? 'the layer'}…${showing}` : '';
  const seaRetry = !!heldNote && (seaFailed || (slow && anyLoading)) ? () => { setSlow(false); spatial.retry(); } : null;
  // (lead P2) over a cached map heldNote is '': the cache label says 'not updated' (or is slow), and its note gets the Retry instead
  const cacheRetry = !seaRetry && !!cache && cacheDrawn && opts.heat && live && (!anyLoading || slow) ? () => { setSlow(false); spatial.retry(); } : null, retryFn = seaRetry ?? cacheRetry;
  const seaNote = heldNote || (fallbackName ? `${LEGEND_NAMES[def.id as keyof typeof LEGEND_NAMES]?.word ?? def.short} model: ${fallbackName}` : seaLoading);
  // map-load: ONE status on the map at a time, by priority: a real failure (the forecast or a source unavailable, or the layer failed) > the after-dark note > loading
  // and model notes. On phones everything else is held back; the after-dark note carries the model fallback name when both apply (an honesty label, kept).
  // (data-honesty review) no label is ever dropped by the one-status rule: the one message on a phone FOLDS the others in. A real failure is the forecast
  // unavailable or the sea layer failed; 'Limited: …' (a source stale for some spots) and 'Demonstration' are labels, carried by whichever note shows.
  const cacheNote = cache && cacheDrawn && opts.heat ? cache.chip : '';
  const ms = mapStatus({phone, srcWarn, heldNote, seaNote, fallbackName, cacheNote, darkNow, seaFailed}), phoneTop = ms.top;   // mapStatus.ts: one message, no label dropped
  // the warning sits in the top bar: pills and labels lay out again when it appears or changes, so none sits under it
  useEffect(() => { const id = requestAnimationFrame(() => declutterRef.current()); return () => cancelAnimationFrame(id); }, [srcWarn, seaNote]);
  return (
    <div ref={rootRef} className="xmap" data-d={phone ? detent : undefined}>
      <div ref={mapEl} className="xleaf" role="application" aria-label="Ocean map. Drag to pan; use the zoom buttons or scroll to zoom." />
      {/* The MapLibre engine draws no credit control: the page shows the basemap's attribution (same place and style as Leaflet's). */}
      {eng?.kind === 'maplibre' && <p className="xcredit" data-map-overlay=""><span className="xcr-t">{eng.attribution()}</span></p>}

      {phone && sheetOn ? (
        <section ref={sheetRef} className="xsheet phone" id="xsheet" data-d={detent} aria-label="Spots"
          style={drag !== null ? ({height: `${drag}px`, transition: 'none'} as CSSProperties) : undefined}>
          <button className="xgrab" aria-label={`Spot sheet: ${detent === 'peek' ? (focused ? 'selected spot' : 'no spot selected') : detent === 'half' ? 'half height' : 'full list'}. Press to resize`}
            onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={() => { dragFrom.current = null; setDrag(null); }} onKeyDown={handleKey}
            onClick={() => { if (dragged.current) { dragged.current = false; return; } setDetent(DETENTS[(DETENTS.indexOf(detent) + 1) % 3]); }}><i /></button>
          {/* 1B: on the peek, × clears the focused spot (the sheet then offers the list); otherwise it closes the sheet */}
          <button className="xsheet-x" aria-label={focused && !showList ? 'Clear selection' : 'Close the spot sheet'} onClick={() => { if (focused && !showList) { clearFocus(); return; } setSheetOn(false); setDetent('peek'); setCallout(null); }}><Icon name="close" size={16} /></button>
          {showList ? listBody : peek$}
        </section>
      ) : null}
      <div className="xsearchbox">
        {topBar}
        {ms.showTop && (seaNote ? <p className={`xsrcwarn info${seaFailed && heldNote ? ' err' : ''}`} data-open={srcOpen ? 'true' : undefined} role={seaFailed && heldNote ? 'alert' : 'status'} data-fallback={fallbackName ? 'true' : undefined} title={srcWarnTitle || undefined}><i aria-hidden="true" /><button type="button" className="xsw-t" aria-expanded={srcOpen} onClick={() => setSrcOpen((v) => !v)}>{phoneTop}</button>{retryFn && <button type="button" onClick={retryFn}>Retry</button>}</p>
          : <p className="xsrcwarn" data-open={srcOpen ? 'true' : undefined} role="status" title={srcWarnTitle || undefined}><i aria-hidden="true" /><button type="button" className="xsw-t" aria-expanded={srcOpen} onClick={() => setSrcOpen((v) => !v)}>{phoneTop}</button>{retryFn && <button type="button" onClick={retryFn}>Retry</button>}</p>)}
        {!phone && open && <section ref={sheetRef} className="xsheet" id="xsheet" aria-label="Spots">{listBody}</section>}
      </div>

      {/* Map-seamless Stage 1: never a blocking overlay. A thin line while the next frame loads (the previous one stays on screen), "Still loading ·
          Retry" after 5 s, and on failure a clear error naming the hour that is still shown. */}
      {opts.heat && live && anyLoading && <div className="xprog" aria-hidden="true"><i /></div>}
      {opts.heat && live && (() => {
        // T-129: before the forecast has chosen an hour (view.selectedTime null) there is no field to have failed: say it is loading, never "Couldn't load"
        if (!view.selectedTime && dataPhase(view.ocean) === 'loading') return <p className="xload" role="status">Loading the forecast…</p>;
        const failed = !!view.selectedTime && !spatial.loading && !spatial.frame && !/^Loading/.test(spatial.status), held = (frame ?? gframe)?.validAt;
        // Say what is actually on screen: the held frame may be the previous layer (honest while the new one loads or fails).
        const heldName = shownFor.current !== fieldId ? (FIELDS.find((x) => x.id === shownFor.current)?.short ?? '').toLowerCase() : '';
        const showing = held ? ` · showing ${heldName ? `${heldName}, ` : ''}${weekdayPT(held, mapZone())} ${hourLabel(held, mapZone())} ${mapZoneAbbr(held)}` : '';
        const retry = () => { setSlow(false); spatial.retry(); };
        if (failed) return <p className="xload err" role="alert">Couldn't load {def.short.toLowerCase()} for {when}{showing} <button type="button" onClick={retry}>Retry</button></p>;
        if (slow && anyLoading) return <p className="xload" role="status">Still loading {def.short.toLowerCase()} for {when}…{heldName ? ` Showing ${heldName} meanwhile.` : ''} <button type="button" onClick={retry}>Retry</button></p>;
        return null;
      })()}
      {/* T-117 (Windy): the layers down the right edge as labelled round thumbnails (a menu button and sheet on phones), the zoom and centre controls under them. */}
      <div className="xfabs">
        <LayerList phone={phone} fields={['waves', 'swell', 'wind', 'period'].map((id) => { const f = FIELDS.find((x) => x.id === id)!; return {...f, short: id === 'waves' ? 'Waves' : f.short, ramp: legendModel(scaleKeyOfField(f.id), {heightUnit: p.heightUnit, windUnit: p.windUnit}, themeNow(), 14).gradient}; })} field={fieldId} on={opts.heat} setField={(id) => pickField(id as FieldId | null)}
          flow={opts.flow} setFlow={(v) => setOpts({...opts, flow: v})} arrows={opts.arrows} setArrows={(v) => setOpts({...opts, arrows: v})} note={status}
          onPoint={() => { const c = map.current?.getView(); if (!c) return; setPanel(true); setPt({lat: c.lat, lon: c.lon}); }} />
        <div className="xzoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomBy(1)}><Icon name="plus" size={18} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomBy(-1)}><Icon name="minus" size={18} /></button></div>
        {focused ? <button className="xround xcenter" aria-label="Center on the selected spot" onClick={() => flyToSpot(spot.id)}><Icon name="star" size={18} /></button>
          : <button className="xround xcenter" aria-label="Go to my location" onClick={locate}><Icon name="locate" size={18} /></button>}
      </div>

      {/* T-116: one bottom strip (Windy): the time scrubber and the legend, plus one quiet mark when the hour is dark. */}
      <div className="xbottom">
        {ms.showDark && <p className="xdark" role="status">After dark<span className="xdark-l"> at this hour</span> · not a surf window{phone ? ms.darkExtras.map((t) => ` · ${t}`).join('') : ''}{phone && retryFn && <button type="button" className="xdark-retry" onClick={retryFn}>Retry</button>}</p>}
        {ms.showCacheChip && <p className="xdark xcache" role="status">{cacheNote[0].toUpperCase() + cacheNote.slice(1)}{cacheRetry && <button type="button" className="xdark-retry" onClick={cacheRetry}>Retry</button>}</p>}
        <DayStrip times={times} index={ti} playing={playing} onPlay={() => setPlaying(!playing)} onScrub={(i) => { lastScrub.current = Date.now(); fieldCtl.current?.holdFlow?.(); setPlaying(false); view.selectTime(times[i]); }}
          valueText={view.selectedTime ? `${weekdayPT(view.selectedTime, mapZone())} ${hourLabel(view.selectedTime, mapZone())} ${mapZoneAbbr(view.selectedTime)}` : ''} />
        <div className="xb-right">
          {!phone && <DotKey unit={p.heightUnit === 'm' ? 'm' : 'ft'} hawaiian={p.scale === 'Hawaiian'} />}
          {opts.heat && <ModelChip name={modelName} sub={cacheDrawn ? cache?.chip : undefined} note={<>{status} {ENCLOSED_NOTE}</>} />}
        {opts.heat && ends ? <LegendChip unit={unitLabel} ramp={legend.gradient} ticks={legend.ticks} lo={ends[0]} hi={ends[1]} label={LEGEND_NAMES[paintedDef.id].full} short={LEGEND_NAMES[paintedDef.id].short} word={LEGEND_NAMES[paintedDef.id].word} loading={spatial.loading || globe.loading || paintedDef.id !== def.id} onCycle={cycleUnit} ><DotKeyList unit={p.heightUnit === 'm' ? 'm' : 'ft'} hawaiian={p.scale === 'Hawaiian'} /></LegendChip>
          : <button type="button" className="xchip xstatus" aria-live="polite" aria-expanded={statusOpen} data-loading={spatial.loading || globe.loading ? 'true' : undefined} data-open={statusOpen ? 'true' : undefined} title={opts.heat ? status : undefined}
              onClick={() => setStatusOpen((v) => !v)}>{opts.heat ? status : 'Sea color off'}</button>}
        </div>
      </div>
      {pt && panel && <ForecastPanel pt={pt} data={point.data} error={point.error} time={view.selectedTime} p={p} bundle={view.ocean.bundle}
        onClose={() => setPanel(false)} onOpenSpot={(id) => { setSpot(id); go('forecast'); }} />}

      {pt && createPortal(<PinLabel layer={def.short === 'Offshore waves' ? 'Waves' : def.short} icon={def.icon} line={line} why={noValueWhy} periodFromPoint={perFromPoint} expanded={panel}
        onExpand={() => setPanel(!panel)} onClose={() => { closedAt.current = Date.now(); setPt(null); setPanel(false); }} />, popupEl)}
      {!phone && callout$ && createPortal(callout$, spotPopEl)}
      {tip$ && eng && createPortal(tip$, eng.container)}
    </div>
  );
}
