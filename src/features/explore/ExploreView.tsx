import {mapZone} from '../../ocean/spotZone';
import {mapZoneAbbr} from './mapTime';
import {spotTier} from '../../data/spotTiers';
import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {ENCLOSED_NOTE} from '../../map/enclosed';
import {createPortal} from 'react-dom';
import 'leaflet/dist/leaflet.css';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {useSpatial} from '../../hooks/useSpatial';
import {useGlobe} from '../../hooks/useGlobe';
import {dataPhase} from '../../services/dataPhase';
import {evidenceSpots} from '../../ocean/spots';
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
import {schedulePrefetch} from '../../map/spatial';
import {attachDebugOverlay, debugEnabled, type DebugInfo} from '../../map/debugOverlay';
import type {MapLayer, MapVariable} from '../../map/types';
import type {SpatialFrame} from '../../map/spatial';
import {usePointForecast, type Pt} from './PointCard';
import {ForecastPanel, PinLabel, pointLine} from './PointPanel';
import {pointExtras} from '../../map/pointExtras';
import {CompareSpots} from './Compare';
import {FindSpots} from './FindSpots';
import {parseMapUrl, writeMapUrl} from './mapUrl';
import {createEngine, engineKind, type MapEngine, type MarkerHandle} from '../../map/engine';
import {currentTheme} from '../../map/basemap';
import {DayStrip, LayerList, LegendChip, ModelChip, SpotRow} from './Panels';
import {ZONES, zoneOf} from '../../data/zones';
import {headlineSurf} from '../../services/headlineSurf';
import {isDark} from '../forecast/trustApi';
import {SpotCallout, type HourBar} from './Callout';
import {camsFor} from '../../data/cams';
const CAMERA_D = 'M4 7.5h3l1.6-2h6.8l1.6 2h3V18H4zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'; // the app's camera icon (ui/Icon), drawn inline in the pin's DOM
import './explore.css';

/** Field layers the regional grids can actually supply. One is shown at a time. */
type FieldId = 'waves' | 'swell' | 'period' | 'wind';
const FIELDS: {id: FieldId; label: string; /** T-096: the chip's word in the layers popover; `label` stays the honest full name */ short: string; icon: IconName; layer: MapLayer; variable: MapVariable; unit: SpatialFrame['unit']; note: string}[] = [
  {id: 'waves', label: 'Offshore wave height · not surf size', short: 'Offshore waves', icon: 'waves', layer: 'WAVES', variable: 'Offshore Hs', unit: 'm', note: 'Combined significant wave height (WW3), offshore'},
  {id: 'swell', label: 'Swell height', short: 'Swell', icon: 'tide', layer: 'SWELL', variable: 'Height', unit: 'm', note: 'Swell partition height (WW3), offshore'},
  {id: 'period', label: 'Wave period', short: 'Period', icon: 'forecast', layer: 'WAVES', variable: 'Period', unit: 's', note: 'Peak wave period (WW3)'},
  {id: 'wind', label: 'Wind', short: 'Wind', icon: 'wind', layer: 'WIND', variable: 'Speed', unit: 'm/s', note: '10 m wind speed (GFS), 3-hourly'},
];
const sectionField = (section: string): FieldId => (section === 'wind' ? 'wind' : section === 'swell' ? 'swell' : 'waves');
const fieldSection: Record<FieldId, string> = {waves: '', swell: 'swell', period: '', wind: 'wind'};
const surfSpot = (id: string) => spots.find((s) => s.id === id)!;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PHONE = '(max-width: 860px)';
const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches;
type Detent = 'peek' | 'half' | 'full';
const DETENTS: Detent[] = ['peek', 'half', 'full'];

/** Stage 3: ONE fixed scale per layer (mapConfig.scales); the legend is built from the same ramp the painter uses, in the person's units. */
const scaleKeyOfField = (id: FieldId): ScaleKey => id.toUpperCase() as ScaleKey;
const themeNow = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark';

/** How many spots carry a name label at this zoom (Surfline map: the selected spot and the best few; the rest are dots). */
// T-116: labels only for the selected spot and the top-rated few (Windy-quiet); the rest are rating-coloured dots that name themselves on hover or focus.
/** The popular spots (as Home's "Popular spots"): after favourites, they get labels and survive low-zoom thinning. */
const POPULAR_SPOTS = ['spot-2', 'spot-0', 'spot-3'];
/** spots-map: the minimum screen distance (px) between two drawn spot dots; a closer, lower-priority pin waits for a closer zoom. Phones need more:
 *  each pin's touch target is 44 px tall (explore.css .xpin::before), so a neighbour within ~29 px would take the tap meant for the dot. */
const pinGap = (phone: boolean) => (phone ? 30 : 20);
const labelBudget = (zoom: number, phone: boolean) => (zoom < 9 ? (phone ? 1 : 2) : zoom < 11 ? (phone ? 2 : 3) : (phone ? 3 : 5));

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
function useAnchored(eng: MapEngine | null, box: HTMLElement, at: {lat: number; lon: number} | null, dy: number, pad: {top: number; left: number; right: number; bottom: number}, autoPan: boolean, anchorEl?: () => HTMLElement | null | undefined) {
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
    if (autoPan) raf = requestAnimationFrame(() => {
      const r = box.getBoundingClientRect(), c = eng.container.getBoundingClientRect(); let dx = 0, dyy = 0;
      if (r.left < c.left + pad.left) dx = r.left - c.left - pad.left; else if (r.right > c.right - pad.right) dx = r.right - c.right + pad.right;
      if (r.top < c.top + pad.top) dyy = r.top - c.top - pad.top; else if (r.bottom > c.bottom - pad.bottom) dyy = r.bottom - c.bottom + pad.bottom;
      if (dx || dyy) eng.panBy(Math.round(dx), Math.round(dyy), {animate: !reduced()});
    });
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(follow); mirror?.cancel(); offs.forEach((f) => f()); };
  }, [eng, box, at?.lat, at?.lon, dy, autoPan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { box.remove(); }, [box]);
}

export function ExploreView({section, go}: ViewProps) {
  if (section === 'discover') return <FindSpots go={go} />;
  if (section === 'compare') return <CompareSpots go={go} />;
  return <OceanMap section={section} go={go} />;
}

function OceanMap({section, go}: ViewProps) {
  const {view, data, spot, setSpot, now, live, reportVisible, requestSpots, mapFocused, setMapFocused} = useSwello();
  // 1B: the map's focus (the app's selected spot stays when it is cleared). `focused` = the spot the map highlights, or null.
  const focused = mapFocused ? spot.id : null;
  useEffect(() => { writeMapUrl({focus: mapFocused ? null : 'none'}); }, [mapFocused]);
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
  const markers = useRef(new Map<string, MarkerHandle>());
  const rank = useRef(new Map<string, number>());
  // map-maplibre: each pin's dot and label box relative to its anchor point, measured once per rebuild; the declutter then places them from
  // project() alone, so a pan or zoom reads no element layout (it used to force a layout of all 45 pins on every move: the phone's long tasks).
  const geom = useRef(new Map<string, {d: [number, number, number, number]; l: [number, number, number, number] | null; c: [number, number, number, number] | null}>());
  const step = 3; // T-117: play steps 3 h, as Windy
  const [opts, setOpts] = useState({heat: true, flow: true, arrows: false});
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => { const mq = matchMedia(PHONE), on = () => setPhone(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  // Wide screens: the spot list is a slim sheet under its toggle, open only on demand. Phones: a bottom sheet with three detents.
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(''), [zone, setZone] = useState('In view'); // Track 2: the list opens on the spots in view (Surfline's synced list)
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
  const spatial = useSpatial(def.layer, def.variable, view.selectedTime, false, live && (opts.heat || opts.flow || opts.arrows));
  const waiting = spatial.loading && !spatial.frame;
  
  // Keep the last good frame of this field on screen while the next hour loads, so scrubbing doesn't flash blank.
  const shown = useRef<SpatialFrame | null>(null);
  // Map-seamless Stage 1: a failed load keeps the last good frame too (it used to drop it and blank the sea); the error says which hour is shown.
  const shownFor = useRef<FieldId>(fieldId); // which layer the held frame belongs to (waves and swell share a unit, so a held frame can be the other layer)
  if (spatial.frame) { shown.current = spatial.frame; shownFor.current = fieldId; } else if (!spatial.loading) shown.current = null; // the hold lasts only while the next frame is loading: a finished request with no frame clears it (Codex P1)
  const frame = shown.current && shown.current.unit === def.unit ? shown.current : null;
  // Worldwide native 0.5° frame underneath, so colour and flow continue past the California grid to the whole globe.
  const globe = useGlobe(def.layer, def.variable, view.selectedTime, live && (opts.heat || opts.flow || opts.arrows));
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
  useEffect(() => { setSlow(false); if (!anyLoading) return; const t = window.setTimeout(() => setSlow(true), 5000); return () => window.clearTimeout(t); }, [anyLoading, spatial.status]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const recAt = (id: string) => view.mapRecords.find((r) => r.spotId === id && r.timestamp === view.selectedTime);

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
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') open(e); };
    el.addEventListener('click', open, true); el.addEventListener('keydown', key);
    return () => { el.removeEventListener('click', open, true); el.removeEventListener('keydown', key); };
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
    if (!live || spatial.loading || globe.loading || !view.selectedTime) return;
    return schedulePrefetch(def.layer, def.variable, view.selectedTime, times);
  }, [live, spatial.loading, globe.loading, view.selectedTime, def.layer, def.variable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spot markers: a rating-coloured dot in a white ring; a name label (with the rating word, no unlabelled number) where room allows.
  useEffect(() => {
    const x = map.current;
    if (!x) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    rank.current.clear();
    for (const e of evidenceSpots) {
      const f = recAt(e.id), rating = f ? rateForecast(surfSpot(e.id), f, now) : null;
      // Stage 6 label priority: selected > favourites > popular spots > the original spots > spots added in the expansion > rating (sel is handled by the declutter sort).
      // spots-map: the same order decides which pin stays when dots crowd (declutter).
      rank.current.set(e.id, (data.state.favorites.includes(e.id) ? 3000 : POPULAR_SPOTS.includes(e.id) ? 2000 : spotTier(e.id) ? 1000 : 0) + (rating?.baseScore ?? -1));
      const color = rating ? BAND_COLOR[bandOf(rating.category)] : 'var(--none)';
      // T-116: name · height · rating word. After dark the word stays (user, 2026-11-08); one quiet mark in the bottom strip says it is dark.
      const hs = f ? headlineSurf(e.id, f, {bundle: view.ocean.bundle, nowMs: now}) : null;
      const hText = isFlat(hs) ? 'Flat' : hs?.kind === 'estimate' ? `${ht(hs.loFt, p, 0)}–${ht(hs.hiFt, p, 0)} ${p.heightUnit}` : hs?.kind === 'offshore' ? `${ht(hs.ft, p, 0)} ${p.heightUnit} offshore` : '';
      const word = rating && rating.score !== null ? conditionWord(rating.category) : '';
      const sub = [hText, word].filter(Boolean).join(' · ');
      const label = `<span class="xlabel"><b>${e.name}</b>${sub ? `<small>${sub}</small>` : ''}</span>`;
      // Track 2 (Surfline's pins): a compact height chip where the full label has no room. Surf estimates only: an offshore-only number is
      // never shown without its "offshore" word, so those spots fall back to the dot (their full label still says "offshore").
      const chip = hs?.kind === 'estimate' ? `<span class="xhchip" aria-hidden="true">${hText}</span>` : '';
      const el = document.createElement('div');
      el.className = `xpin${e.id === focused ? ' sel' : ''}${e.id === hoverRef.current ? ' hl' : ''}`;       // Track 2: a camera badge on spots with a verified public cam (T-080: the card links to the owner's page; never embedded)
      const cam = camsFor(e.id).length > 0;
      el.style.setProperty('--c', color); el.innerHTML = `<i></i>${cam ? `<em class="xcam" aria-hidden="true"><svg viewBox="0 0 24 24" width="9" height="9"><path d="${CAMERA_D}"/></svg></em>` : ''}${label}${chip}`;
      const mk = x.addMarker({lat: e.latitude, lon: e.longitude, element: el, size: [22, 22], anchor: 'center', title: (cam ? `${e.name} · has a public live cam` : e.name) + (view.ocean.isSpotLoaded(e.id) ? '' : ' · forecast loading (grey pin: not loaded yet, not flat)'), keyboard: true, riseOnHover: true,
        onClick: () => pickRef.current(e.id), onHover: (on) => { if (on) { setHover(e.id); document.getElementById(`xrow-${e.id}`)?.scrollIntoView({block: 'nearest'}); } else setHover(null); }});
      markers.current.set(e.id, mk);
    }
    geom.current.clear();
    const box0 = x.container.getBoundingClientRect();
    for (const e of evidenceSpots) {
      const el = markers.current.get(e.id)?.element; if (!el) continue;
      const q = x.project(e.latitude, e.longitude), cx = box0.left + q.x, cy = box0.top + q.y;
      const d = el.querySelector('i')!.getBoundingClientRect(), l = el.querySelector('.xlabel')?.getBoundingClientRect();
      let c: [number, number, number, number] | null = null; const ch = el.querySelector('.xhchip');
      if (ch) { el.classList.add('xdot', 'xchipon'); const r = ch.getBoundingClientRect(); if (r.width) c = [r.left - cx, r.top - cy, r.width, r.height]; el.classList.remove('xdot', 'xchipon'); }
      geom.current.set(e.id, {d: [d.left - cx, d.top - cy, d.width, d.height], l: l && l.width ? [l.left - cx, l.top - cy, l.width, l.height] : null, c});
    }
    declutterRef.current();
  }, [eng, view.mapRecords, view.selectedTime, focused, p.heightUnit, data.state.favorites.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sparse labels that never collide: the selected spot first, then the best-rated; a zoom-dependent budget; the rest are dots.
   *  Each label tries right of its pin, then left, else stays a dot until zoomed in. Labels keep clear of the floating controls. */
  const reportTimer = useRef<number | null>(null);
  const declutter = () => {
    const m = map.current;
    if (!m) return;
    // Reads first (the map box and the few floating controls), then class writes, then pure geometry from project(): no forced layout per pin.
    const edge = m.container.getBoundingClientRect();
    const ctl = Array.from(m.container.parentElement?.querySelectorAll<HTMLElement>('.xsearchbox, .xsheet, .xfabs > *, .xbottom > *, .leaflet-control-attribution, .xcredit, .xspotpop') ?? []).map((el) => el.getBoundingClientRect()).filter((r) => r.width);
    const els = evidenceSpots.map((e) => ({id: e.id, el: markers.current.get(e.id)?.element})).filter((x): x is {id: string; el: HTMLElement} => !!x.el);
    els.sort((a, b) => Number(b.el.classList.contains('sel')) - Number(a.el.classList.contains('sel')) || (rank.current.get(b.id) ?? -1) - (rank.current.get(a.id) ?? -1));
    els.forEach(({el}) => el.classList.remove('xhide', 'lft', 'xdot', 'xthin', 'xchipon', 'clft'));
    // Stage 6: thin at low zoom: below z6 only the selected spot, favourites, popular spots and the 5 best-rated keep a pin (the rest return on zoom-in).
    if (m.getView().zoom < 6) els.forEach(({el, id}, i) => { if (!el.classList.contains('sel') && (rank.current.get(id) ?? -1) < 2000 && i > 5) el.classList.add('xthin'); });
    const at = new Map(evidenceSpots.map((e) => [e.id, e] as const));
    // spots-map: a pin whose dot centre falls within pinGap px of a higher-priority pin is not drawn at this zoom (it returns on zoom-in);
    // search, the list, Find Spots and Compare still reach it. Same order as the labels: selected, favourites, popular, original, added, rating.
    const kept: [number, number][] = [], gap = pinGap(isPhone());
    for (const {el, id} of els) {
      if (el.classList.contains('xthin')) continue;
      const e = at.get(id)!, q = m.project(e.latitude, e.longitude);
      if (!el.classList.contains('sel') && kept.some(([kx, ky]) => Math.hypot(kx - q.x, ky - q.y) < gap)) el.classList.add('xthin');
      else kept.push([q.x, q.y]);
    }
    const boxes = els.filter(({el}) => !el.classList.contains('xthin')).map(({el, id}) => {
      const e = at.get(id)!, q = m.project(e.latitude, e.longitude), cx = edge.left + q.x, cy = edge.top + q.y, g = geom.current.get(id);
      const dot = g ? new DOMRect(cx + g.d[0], cy + g.d[1], g.d[2], g.d[3]) : new DOMRect(cx - 11, cy - 11, 22, 22);
      return {id, el, dot, lab: g?.l ? new DOMRect(cx + g.l[0], cy + g.l[1], g.l[2], g.l[3]) : undefined, chip: g?.c ? new DOMRect(cx + g.c[0], cy + g.c[1], g.c[2], g.c[3]) : undefined};
    });
    const taken: DOMRect[] = [...boxes.filter((x) => x.dot.width).map((x) => x.dot), ...ctl];
    const inView = (r: DOMRect) => !edge || (r.right > edge.left && r.left < edge.right && r.bottom > edge.top && r.top < edge.bottom);
    const free = (r: DOMRect, own: DOMRect) => (!edge || (r.left >= edge.left + 4 && r.right <= edge.right - 4 && r.top >= edge.top && r.bottom <= edge.bottom)) && !taken.some((t) => t !== own && r.left < t.right + 2 && t.left < r.right + 2 && r.top < t.bottom + 2 && t.top < r.bottom + 2);
    let budget = labelBudget(m.getView().zoom, isPhone());
    const chipsOn = m.getView().zoom >= 7; // mid zoom and closer (Surfline's coloured height pins); wider views keep dots
    const small: typeof boxes = [];
    for (const b of boxes) {
      const {el, dot, lab} = b;
      if (!lab?.width) continue;
      const isSel = el.classList.contains('sel');
      if (!isSel && (budget <= 0 || !inView(dot))) { el.classList.add('xdot'); small.push(b); continue; }
      const left = new DOMRect(dot.left - 8 - lab.width, lab.top, lab.width, lab.height);
      if (free(lab, dot) || (isSel && !free(left, dot))) { taken.push(lab); budget--; }
      else if (free(left, dot)) { taken.push(left); el.classList.add('lft'); budget--; }
      else { el.classList.add('xdot'); small.push(b); }
    }
    // Then a height chip for the dots that are in view, best-ranked first (same order), right of the dot or left, never over anything.
    if (chipsOn) for (const {el, dot, chip} of small) {
      if (!chip?.width || !inView(dot)) continue;
      // `chip` is the measured right-hand box; the left one mirrors it about the dot's centre (CSS keeps both gaps equal).
      const mid = dot.left + dot.width / 2, right = chip, left = new DOMRect(2 * mid - chip.right, chip.top, chip.width, chip.height);
      if (free(right, dot)) { taken.push(right); el.classList.add('xchipon'); }
      else if (free(left, dot)) { taken.push(left); el.classList.add('xchipon', 'clft'); }
    }
    // subset loading: the drawn pins in view are the spots whose forecast the map needs; reported debounced, they load with the next scope
    // Only from zoom 7 (a regional view): a world-zoom pan must not mark 150 spots as requested (that would make them hot on the Worker and spend Open-Meteo quota nobody is looking at).
    const vis = m.getView().zoom >= 7 ? boxes.filter((b) => inView(b.dot)).slice(0, 60).map((b) => b.id) : [];
    if (reportTimer.current) window.clearTimeout(reportTimer.current);
    reportTimer.current = window.setTimeout(() => reportVisibleRef.current(vis), 500);
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

  // Hover link between list rows and map markers: toggle a class on the marker element, no rebuild.
  useEffect(() => {
    markers.current.forEach((mk, id) => { mk.element.classList.toggle('hl', id === hover); }); // .hl lifts it (CSS z-index on the label)
  }, [hover]);

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
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || (e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      const pin = markers.current.get(spot.id)?.element; setCallout(null); setMapFocused(false); if (pin && document.activeElement === pin) pin.blur();
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
  useAnchored(eng, spotPopBox, callEv0 ? {lat: callEv0.latitude, lon: callEv0.longitude} : null, -26, /* clear of the pin's own label (as the Leaflet popup sat) */ {top: 80, left: open ? 380 : 80, right: 80, bottom: 90}, true, () => (callEv0 ? markers.current.get(callEv0.id)?.element : null));
  // The phone peek sizes itself to the spot card; the time bar, legend and attribution sit just above it.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheetRef.current, root = rootRef.current;
    if (root && (!phone || !sheetOn)) root.style.setProperty('--peek', '0px'); // T-117: no spot sheet, so the strip sits on the map's bottom edge
    if (!phone || !el || !root || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => { if (detent === 'peek') root.style.setProperty('--peek', `${Math.round(el.getBoundingClientRect().height)}px`); });
    ro.observe(el); return () => ro.disconnect();
  }, [phone, detent, sheetOn]);
  /** Glide to a spot; the target sits in the free part of the map, clear of the list sheet or the phone sheet. */
  const flyToSpot = (id: string, sheetOpen = open) => {
    const m = map.current, e = evidenceSpots.find((x) => x.id === id);
    if (!m || !e) return;
    const cur = m.getView().zoom, z = Math.max(10, cur);
    const shift: [number, number] = phone ? [0, Math.min(sheetPx(), 260) / 2] : [sheetOpen ? -184 : 0, -60];
    // The shift is in pixels at the target zoom; at the current zoom it is 2^(cur - z) as many (engine-neutral, via project/unproject).
    const k = 2 ** (cur - z), at = m.project(e.latitude, e.longitude), to = m.unproject(at.x + shift[0] * k, at.y + shift[1] * k);
    if (reduced()) m.setView({lat: to.lat, lon: to.lon, zoom: z}, {animate: false}); else m.flyTo({lat: to.lat, lon: to.lon, zoom: z}, {durationMs: 1100});
  };
  const flyRef = useRef(flyToSpot);
  flyRef.current = flyToSpot;
  /** Choose a spot: select it, open its callout (popup or the phone sheet's peek) and bring it into view. */
  const pickSpot = (id: string, fromList = false) => {
    setSpot(id); setCallout(id); setPt(null);
    if (phone) { setDetent('peek'); setSheetOn(true); }
    else if (fromList) setOpen(false);
    flyRef.current(id, phone ? false : fromList ? false : open);
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
  // Your area first: regions ordered by their nearest spot to the selected spot, spots north to south within a region.
  const dist = (e: {latitude: number; longitude: number}) => Math.hypot(e.latitude - here.latitude, (e.longitude - here.longitude) * 0.8);
  const regionRank = new Map<string, number>();
  for (const e of evidenceSpots) regionRank.set(e.region, Math.min(regionRank.get(e.region) ?? Infinity, dist(e)));
  const needle = q.trim().toLowerCase();
  // Track 2 "In view": the spots inside the map's bounds, best rated first, then the larger surf estimate; unrated (or dark) last. Typing searches every spot.
  const byView = zone === 'In view' && !needle;
  // the same height text as the spot's pin: the surf estimate, or the offshore height said as offshore
  const pinHeight = (id: string) => { const r = recAt(id), h = r ? headlineSurf(id, r, {bundle: view.ocean.bundle, nowMs: now}) : null;
    return isFlat(h) ? FLAT_ESTIMATE_TEXT : h?.kind === 'estimate' ? `${ht(h.loFt, p, 0)}–${ht(h.hiFt, p, 0)} ${p.heightUnit}` : h?.kind === 'offshore' ? `${ht(h.ft, p, 0)} ${p.heightUnit} offshore` : null; };
  const score = (id: string) => { const r = recAt(id), rt = r ? rateForecast(surfSpot(id), r, now) : null; return rt && rt.score !== null ? rt.score : null; };
  const hiAt = (id: string) => { const r = recAt(id), h = r ? headlineSurf(id, r, {bundle: view.ocean.bundle, nowMs: now}) : null; return h?.kind === 'estimate' ? h.hiFt : -1; };
  const list = byView
    ? evidenceSpots.filter((e) => inView?.has(e.id)).map((e) => ({e, s: score(e.id), h: hiAt(e.id)}))
      .sort((a, b) => (a.s === null ? 1 : 0) - (b.s === null ? 1 : 0) || (b.s ?? 0) - (a.s ?? 0) || b.h - a.h).map((x) => x.e)
    : [...evidenceSpots].filter((e) => (zone === 'All' || zone === 'In view' || zoneOf(e.region) === zone) && (!needle || e.name.toLowerCase().includes(needle) || e.region.toLowerCase().includes(needle)))
      .sort((a, b) => (regionRank.get(a.region)! - regionRank.get(b.region)!) || b.latitude - a.latitude);
  /** A region chip frames that stretch of coast (All: back to the selected spot's area) and filters the list. */
  const pickZone = (z: string) => {
    setZone(z); const m = map.current; if (!m || z === 'In view') return; // "In view" follows the map; it never moves it
    const pts = evidenceSpots.filter((e) => z !== 'All' && zoneOf(e.region) === z).map((e) => ({lat: e.latitude, lon: e.longitude}));
    if (pts.length) m.fitPoints(pts, {padRatio: 0.15, animate: !reduced(), padding: {top: phone ? 120 : 80, left: phone ? 16 : 24, right: phone ? 64 : 200, bottom: phone ? 120 : 80}});
    else if (focused) flyRef.current(spot.id);
  };
  // after dark the spots keep their rating; the map says once, quietly, that the hour is dark.
  const darkNow = !!view.selectedTime && isDark(spot.id, view.selectedTime);
  // T-128: a frame drawn from this device's cache says so, with its own valid time, until the fresh frame replaces it.
  const cache = cacheLabel(nestPainted ? frame : (gframe ?? frame), anyLoading, (iso) => `${weekdayPT(iso, mapZone())} ${hourLabel(iso, mapZone())} ${mapZoneAbbr(iso)}`);
  const status = !live ? 'Model layers need live data; the demonstration week shows spots only.'
    : cache && opts.heat ? cache.line
    : spatial.loading && !frame && slow ? 'Sea colour is not loading right now · spots and forecasts still work'
    : spatial.loading && !frame ? (paintedFrame && opts.heat ? `Loading model… still showing ${FIELDS.find((f) => f.layer === paintedFrame.layer)?.label ?? 'the previous layer'} for ${weekdayPT(paintedFrame.validAt, mapZone())} ${hourLabel(paintedFrame.validAt, mapZone())} ${mapZoneAbbr(paintedFrame.validAt)}` : 'Loading model…')
    : frame || gframe ? `${def.label} · ${packedGlobal ? gframe!.provider : `${def.layer === 'WIND' ? 'GFS' : 'WW3'} via NOAA ERDDAP`}${packedGlobal ? '' : ` · ${gframe ? `global ${gframe.resolution}°` : `${(frame as SpatialFrame).resolution}°`}${frame && gframe ? ' grid (California subset, same model)' : ''}`} · valid ${weekdayPT((frame ?? gframe)!.validAt, mapZone())} ${hourLabel((frame ?? gframe)!.validAt, mapZone())} ${mapZoneAbbr((frame ?? gframe)!.validAt)}${spatial.loading || globe.loading ? ' · updating…' : ''}`
    : spatial.status;
  const paintedDef = (opts.heat && painted && FIELDS.find((f) => f.layer === painted)) || def; // legend (label + ramp) follows the frame actually painted
  const legend = legendModel(scaleKeyOfField(paintedDef.id), {heightUnit: p.heightUnit, windUnit: p.windUnit}, themeNow());
  const ends = frame || gframe || (opts.heat && painted) ? ([legend.lo, legend.hi] as const) : null;
  const unitLabel = legend.unitLabel;
  const when = view.selectedTime ? `${weekdayPT(view.selectedTime, mapZone())} ${hourLabel(view.selectedTime, mapZone())} ${mapZoneAbbr(view.selectedTime)}` : 'this hour';

  /** Offshore height range at a spot across the shared hour +/- 3 h (from the model records, not invented). */
  const rangeAt = (id: string) => {
    if (!view.selectedTime) return null;
    const t0 = Date.parse(view.selectedTime);
    const hs = view.mapRecords.filter((r) => r.spotId === id && Math.abs(Date.parse(r.timestamp) - t0) <= 3 * 36e5).map((r) => Number(ht(r.offshore, p, 1)));
    if (!hs.length) return null;
    const lo = Math.floor(Math.min(...hs)), hi = Math.ceil(Math.max(...hs));
    return `${lo === hi ? lo : `${lo}–${hi}`} ${p.heightUnit} offshore`;
  };
  // Track 2: the card's next-hours bars, from the shown hour: each record's surf estimate (offshore-only and missing hours are gaps) and its rating colour.
  const hoursFor = (id: string): HourBar[] => {
    const t0 = view.selectedTime ? Date.parse(view.selectedTime) : now, s = surfSpot(id);
    const byT = new Map(view.mapRecords.filter((r) => r.spotId === id && Date.parse(r.timestamp) >= t0 && Date.parse(r.timestamp) < t0 + 12 * 36e5).map((r) => [Date.parse(r.timestamp), r]));
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
  const showList = phone ? detent !== 'peek' : open;
  useEffect(() => { const t = window.setTimeout(() => seenRef.current(), 320); return () => clearTimeout(t); }, [open, detent, sheetOn, phone]); // after the sheet's own transition
  const listBody = (
    <div className="xlist" aria-label="Spots">
      <div className="xtb-chips" role="group" aria-label="Region">
        {['In view', 'All', ...ZONES.map(([z]) => z)].map((z) => <button key={z} type="button" aria-pressed={zone === z} onClick={() => pickZone(z)}>{z}</button>)}
      </div>
      {byView && <p className="xinv-h" aria-live="polite">{list.length ? `${list.length} spot${list.length === 1 ? '' : 's'} in view · best rated first` : 'No surf spot in view: zoom out or pan along the coast.'}</p>}
      {!byView && !list.length && <p className="fine">No spot matches “{q}”{zone !== 'All' && zone !== 'In view' ? ` in ${zone}` : ''}.</p>}
      <ul>{list.map((e, i) => {
        const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null;
        const head = !byView && (i === 0 || list[i - 1].region !== e.region) ? <p className="xregion">{e.region}</p> : null;
        const rated = !!rt && rt.score !== null && !!r, sub = (byView ? pinHeight(e.id) : null) ?? rangeAt(e.id) ?? 'No record at this hour';
        return <li key={e.id}>{head}<SpotRow id={e.id} name={e.name} sub={byView ? `${e.region} · ${sub}${rated ? '' : ' · not rated'}` : sub} category={rated ? rt!.category : null}
          current={e.id === focused} highlighted={hover === e.id} onPick={() => pickSpot(e.id, true)} onHover={(on) => setHover(on ? e.id : null)} /></li>;
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
        <input type="search" value={q} placeholder="Search spots" autoComplete="off" aria-controls="xsheet" aria-expanded={showList}
          onFocus={showResults} onChange={(e) => { setQ(e.target.value); showResults(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); pickSpot(list[0].id, true); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setQ(''); setOpen(false); } }} />
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
  const wavesGlobe = useGlobe('WAVES', 'Offshore Hs', view.selectedTime, fieldId === 'swell' && !!pv?.note);
  const wavesField = useMemo(() => (wavesGlobe.frame ? buildField(wavesGlobe.frame, false) : null), [wavesGlobe.frame]);
  const windSea = pv?.note && wavesField && at ? sampleField([wavesField], at.lat, at.lon)?.value ?? null : null;
  const line = pointLine(pv, perS, p, fieldId, windSea, extras);
  const cycleUnit = def.unit === 'm' ? () => data.profile({heightUnit: p.heightUnit === 'ft' ? 'm' : 'ft'})
    : def.unit === 'm/s' ? () => data.profile({windUnit: p.windUnit === 'mph' ? 'kn' : p.windUnit === 'kn' ? 'km/h' : 'mph'}) : null;
  const modelName = packedGlobal ? 'GFS-Wave 0.25° · NOAA' : `${def.layer === 'WIND' ? 'GFS' : 'WW3'} · NOAA ERDDAP`;
  // Debug overlay (?debug=1, dev only): what the map is painting, from the same frames the field uses.
  const debugInfo = useRef<DebugInfo | null>(null);
  { const f = gframe ?? frame; debugInfo.current = f && opts.heat ? {model: modelName, source: f.provider, run: packedGlobal ? (/run ([^)]*)\)/.exec(f.provider)?.[1] ?? '?') : 'n/a (ERDDAP best series, no run id)', validAt: f.validAt, retrievedAt: f.retrievedAt, layer: (paintedDef.label ?? def.label), held: paintedDef.id !== def.id} : null; }
  useEffect(() => (debugEnabled() ? attachDebugOverlay(() => debugInfo.current) : undefined), []);

  return (
    <div ref={rootRef} className="xmap" data-d={phone ? detent : undefined}>
      <div ref={mapEl} className="xleaf" role="application" aria-label="Ocean map. Drag to pan; use the zoom buttons or scroll to zoom." />
      {/* The MapLibre engine draws no credit control: the page shows the basemap's attribution (same place and style as Leaflet's). */}
      {eng?.kind === 'maplibre' && <p className="xcredit" data-map-overlay="">{eng.attribution()}</p>}

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
        {darkNow && <p className="xdark" role="status">After dark<span className="xdark-l"> at this hour</span> · not a surf window</p>}
        {cache && opts.heat && <p className="xdark xcache" role="status">{cache.chip[0].toUpperCase() + cache.chip.slice(1)}</p>}
        <DayStrip times={times} index={ti} playing={playing} onPlay={() => setPlaying(!playing)} onScrub={(i) => { setPlaying(false); view.selectTime(times[i]); }}
          valueText={view.selectedTime ? `${weekdayPT(view.selectedTime, mapZone())} ${hourLabel(view.selectedTime, mapZone())} ${mapZoneAbbr(view.selectedTime)}` : ''} />
        <div className="xb-right">
          {opts.heat && <ModelChip name={modelName} sub={cache?.chip} note={<>{status} {ENCLOSED_NOTE}</>} />}
        {opts.heat && ends ? <LegendChip unit={unitLabel} ramp={legend.gradient} ticks={legend.ticks} lo={ends[0]} hi={ends[1]} label={paintedDef.label} loading={spatial.loading || globe.loading || paintedDef.id !== def.id} onCycle={cycleUnit} />
          : <p className="xchip xstatus" role="status" data-loading={spatial.loading || globe.loading ? 'true' : undefined}>{opts.heat ? status : 'Sea colour off'}</p>}
        </div>
      </div>
      {pt && panel && <ForecastPanel pt={pt} data={point.data} error={point.error} time={view.selectedTime} p={p} bundle={view.ocean.bundle}
        onClose={() => setPanel(false)} onOpenSpot={(id) => { setSpot(id); go('forecast'); }} />}

      {pt && createPortal(<PinLabel layer={def.short === 'Offshore waves' ? 'Waves' : def.short} icon={def.icon} line={line} periodFromPoint={perFromPoint} expanded={panel}
        onExpand={() => setPanel(!panel)} onClose={() => { closedAt.current = Date.now(); setPt(null); setPanel(false); }} />, popupEl)}
      {!phone && callout$ && createPortal(callout$, spotPopEl)}
    </div>
  );
}
