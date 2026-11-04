import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import {ENCLOSED_NOTE} from '../../map/enclosed';
import {createPortal} from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {useSpatial} from '../../hooks/useSpatial';
import {useGlobe} from '../../hooks/useGlobe';
import {evidenceSpots} from '../../ocean/spots';
import {allSpots as spots} from '../../data/catalog';
import {rateForecast} from '../../ratings/adapters';
import {Icon, type IconName} from '../../ui/Icon';
import {conditionWord} from '../../ui/Condition';
import {BAND_COLOR, bandOf, hourLabel} from '../forecast/model';
import {ht} from '../forecast/helpers';
import {weekdayPT} from '../forecast/format';
import {createFieldController, buildField, legendModel, sampleField, type Field, type FieldController} from '../../map/field';
import {mapConfig, minZoomFor, type ScaleKey} from '../../map/mapConfig';
import {schedulePrefetch} from '../../map/spatial';
import {addBasemap} from '../../map/basemap';
import type {MapLayer, MapVariable} from '../../map/types';
import type {SpatialFrame} from '../../map/spatial';
import {usePointForecast, type Pt} from './PointCard';
import {ForecastPanel, PinLabel, pointLine} from './PointPanel';
import {CompareSpots} from './Compare';
import {FindSpots} from './FindSpots';
import {parseMapUrl, writeMapUrl} from './mapUrl';
import {DayStrip, LayerList, LegendChip, ModelChip, SpotRow} from './Panels';
import {ZONES, zoneOf} from '../../data/zones';
import {headlineSurf} from '../../services/headlineSurf';
import {isDark} from '../forecast/trustApi';
import {SpotCallout} from './Callout';
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
const labelBudget = (zoom: number, phone: boolean) => (zoom < 9 ? (phone ? 1 : 2) : zoom < 11 ? (phone ? 2 : 3) : (phone ? 3 : 5));

export function ExploreView({section, go}: ViewProps) {
  if (section === 'discover') return <FindSpots go={go} />;
  if (section === 'compare') return <CompareSpots go={go} />;
  return <OceanMap section={section} go={go} />;
}

function OceanMap({section, go}: ViewProps) {
  const {view, data, spot, setSpot, now, live} = useSwello();
  const p = data.state.profile;
  // Map-seamless Stage 1: the view in the URL (?layer, lat, lon, z, t) is read once on load, so a reload or a shared link restores it.
  const urlInit = useMemo(() => parseMapUrl(typeof location === 'undefined' ? '' : location.search), []);
  const [fieldId, setFieldId] = useState<FieldId>(urlInit.layer ?? sectionField(section));
  useEffect(() => { setFieldId((f) => (fieldSection[f] === section ? f : sectionField(section))); }, [section]);
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const markers = useRef(new Map<string, L.Marker>());
  const rank = useRef(new Map<string, number>());
  const step = 3; // T-117: play steps 3 h, as Windy
  const [opts, setOpts] = useState({heat: true, flow: true, arrows: false});
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => { const mq = matchMedia(PHONE), on = () => setPhone(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  // Wide screens: the spot list is a slim sheet under its toggle, open only on demand. Phones: a bottom sheet with three detents.
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(''), [zone, setZone] = useState('All'); // T-116: the map's top bar (search + region chips)
  const [detent, setDetent] = useState<Detent>('peek');
  const [drag, setDrag] = useState<number | null>(null);
  const [callout, setCallout] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(9);
  const def = FIELDS.find((f) => f.id === fieldId)!;
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  // Tap-the-sea point forecast: one popup, one temporary pin.
  const [pt, setPt] = useState<Pt | null>(null);
  const closedAt = useRef(0); // T-099: a touch tap on the card's close button also reached the map and opened a new point where the finger was
  const [panel, setPanel] = useState(false); // T-117: the point's hourly panel (expand from the pin label)
  const [sheetOn, setSheetOn] = useState(false); // T-117: phones show the spot sheet only once a spot is picked or the search is used (Windy)
  const popup = useRef<L.Popup | null>(null);
  const popupEl = useMemo(() => document.createElement('div'), []);
  // Spot callout at the pin (wide screens).
  const spotPop = useRef<L.Popup | null>(null);
  const spotPopEl = useMemo(() => document.createElement('div'), []);
  const sheetRef = useRef<HTMLElement>(null);
  const point = usePointForecast(pt);
  const [slow, setSlow] = useState(false);
  const spatial = useSpatial(def.layer, def.variable, view.selectedTime, false, live && (opts.heat || opts.flow || opts.arrows));
  const waiting = spatial.loading && !spatial.frame;
  
  // Keep the last good frame of this field on screen while the next hour loads, so scrubbing doesn't flash blank.
  const shown = useRef<SpatialFrame | null>(null);
  // Map-seamless Stage 1: a failed load keeps the last good frame too (it used to drop it and blank the sea); the error says which hour is shown.
  const shownFor = useRef<FieldId>(fieldId); // which layer the held frame belongs to (waves and swell share a unit, so a held frame can be the other layer)
  if (spatial.frame) { shown.current = spatial.frame; shownFor.current = fieldId; }
  const frame = shown.current && shown.current.unit === def.unit ? shown.current : null;
  const field = useMemo(() => (frame ? buildField(frame, def.layer === 'WIND') : null), [frame, def.layer]);
  // Worldwide 2° frame underneath, so colour and flow continue past the California grid to the whole globe.
  const globe = useGlobe(def.layer, def.variable, view.selectedTime, live && (opts.heat || opts.flow || opts.arrows));
  const shownGlobe = useRef<SpatialFrame | null>(null);
  if (globe.frame) shownGlobe.current = globe.frame;
  const gframe = shownGlobe.current && shownGlobe.current.unit === def.unit ? shownGlobe.current : null;
  const gfield = useMemo(() => (gframe ? buildField(gframe, def.layer === 'WIND') : null), [gframe, def.layer]);
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
    if (!mapEl.current || map.current) return;
    const small = matchMedia('(max-width: 860px)').matches;
    const m = L.map(mapEl.current, {zoomControl: false, attributionControl: false, minZoom: minZoomFor(mapEl.current.clientWidth || window.innerWidth), maxZoom: mapConfig.view.maxZoom, zoomSnap: mapConfig.view.zoomSnap, worldCopyJump: true, maxBounds: [[-mapConfig.view.maxLat, -540], [mapConfig.view.maxLat, 540]], maxBoundsViscosity: mapConfig.view.maxBoundsViscosity}).setView(urlInit.lat !== null && urlInit.lon !== null ? [urlInit.lat, urlInit.lon] : small ? [37.5, -122.5] : [37.5, -122.45], urlInit.z ?? (small ? 8 : 9)); // Stage 1: the URL's view; the poles are a hard edge (viscosity 1: no dark band past them)
    const lod = () => { m.getContainer().classList.toggle('far', m.getZoom() < 9); m.getContainer().classList.toggle('world', m.getZoom() < 5); setZoom(m.getZoom()); };
    m.on('zoomend', lod); lod();
    m.on('resize', () => m.setMinZoom(minZoomFor(m.getSize().x))); // the world always fills the width (Stage 1 pole clamp)
    m.on('moveend', () => { const c = m.getCenter(); writeMapUrl({lat: c.lat, lon: c.lng, z: m.getZoom()}); }); // Stage 1 (product): the URL follows every settled move
    m.on('zoomend moveend resize', () => declutterRef.current()); // panels stay put while the map pans
    L.control.attribution({position: 'bottomleft', prefix: false}).addTo(m);
    // Light or dark Esri Canvas basemap by theme (satellite on request), with maxNativeZoom so tiles upscale: src/map/basemap.ts (T-042).
    const disposeBase = addBasemap(m);
    pins.current = L.layerGroup().addTo(m);
    popup.current = L.popup({closeButton: false, closeOnClick: false, autoClose: false, className: 'xpopup xpl-pop', minWidth: 170, maxWidth: 280, offset: [0, -4], autoPanPaddingTopLeft: [16, 16], autoPanPaddingBottomRight: [16, 70]});
    popup.current.setContent(popupEl);
    m.on('click', (e: L.LeafletMouseEvent) => { if (Date.now() - closedAt.current > 400) { setPanel(false); setPt({lat: e.latlng.lat, lon: (((e.latlng.lng + 180) % 360) + 360) % 360 - 180}); } }); // T-117: the exact point (the label samples the field there)
    map.current = m; if (import.meta.env.DEV) (window as unknown as {__swelloMap?: L.Map}).__swelloMap = m; // test hook for the zoom script (dev only)
    if (import.meta.env.DEV) Object.assign(window, {__xmap: m}); // browser QA scripts drive zoom through this; stripped from builds
    return () => { disposeBase(); m.remove(); map.current = null; };
  }, []);

  // T-056: on phones the tile attribution is one line; tapping it shows the full credit (links work once it is open).
  useEffect(() => {
    const el = rootRef.current?.querySelector<HTMLElement>('.leaflet-control-attribution'); if (!el) return;
    el.tabIndex = 0; el.setAttribute('aria-label', 'Map credits. Press to show in full'); el.setAttribute('aria-expanded', 'false');
    const open = (e: Event) => {
      if (!matchMedia('(max-width: 860px)').matches || el.classList.contains('open')) return;
      e.preventDefault(); e.stopPropagation(); el.classList.add('open'); el.setAttribute('aria-expanded', 'true');
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') open(e); };
    el.addEventListener('click', open, true); el.addEventListener('keydown', key);
    return () => { el.removeEventListener('click', open, true); el.removeEventListener('keydown', key); };
  }, []);

  // T-043: the spot callout popup (wide screens) and closing it with a tap on the sea.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    spotPop.current = L.popup({closeButton: false, closeOnClick: false, autoClose: false, className: 'xpopup xspotpop', minWidth: 264, maxWidth: 264, offset: [0, -8], autoPanPaddingTopLeft: [380, 80], autoPanPaddingBottomRight: [80, 90]}).setContent(spotPopEl);
    const off = () => setCallout(null);
    m.on('click', off);
    return () => { m.off('click', off); };
  }, [spotPopEl]);

  // Map-seamless Stage 1: ONE field controller per map. A layer or hour change draws the new field off-screen and crossfades it over the old one (the old stays until the new is drawn); a frame still loading keeps what is on screen.
  const fieldCtl = useRef<FieldController | null>(null);
  useEffect(() => { const m = map.current; if (!m) return; fieldCtl.current = createFieldController(m); return () => { fieldCtl.current?.dispose(); fieldCtl.current = null; }; }, []);
  useEffect(() => {
    const fields = [field, gfield].filter((f): f is NonNullable<typeof f> => !!f), ctl = fieldCtl.current;
    if (!ctl) return;
    if (!opts.heat && !opts.flow && !opts.arrows) { ctl.clear(); return; }
    if (fields.length) ctl.update(fields, {heat: opts.heat, flow: opts.flow, arrows: opts.arrows, opacity: 0.72, reducedMotion: reduced()});
  }, [field, gfield, opts.heat, opts.flow, opts.arrows]);
  // Idle prefetch of the neighbouring hours and the next layer once the visible frames have settled (Stage 1).
  useEffect(() => {
    if (!live || spatial.loading || globe.loading || !view.selectedTime) return;
    return schedulePrefetch(def.layer, def.variable, view.selectedTime, times);
  }, [live, spatial.loading, globe.loading, view.selectedTime, def.layer, def.variable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spot markers: a rating-coloured dot in a white ring; a name label (with the rating word, no unlabelled number) where room allows.
  useEffect(() => {
    const g = pins.current;
    if (!g) return;
    g.clearLayers();
    markers.current.clear();
    rank.current.clear();
    for (const e of evidenceSpots) {
      const f = recAt(e.id), rating = f ? rateForecast(surfSpot(e.id), f, now) : null;
      rank.current.set(e.id, rating?.baseScore ?? -1);
      const color = rating ? BAND_COLOR[bandOf(rating.category)] : 'var(--none)';
      // T-116: name · height · rating word. An unrated or dark hour says nothing per spot (one quiet mark in the bottom strip says it is dark).
      const hs = f ? headlineSurf(e.id, f, {bundle: view.ocean.bundle, nowMs: now}) : null;
      const hText = hs?.kind === 'estimate' ? `${ht(hs.loFt, p, 0)}–${ht(hs.hiFt, p, 0)} ${p.heightUnit}` : hs?.kind === 'offshore' ? `${ht(hs.ft, p, 0)} ${p.heightUnit} offshore` : '';
      const word = rating && rating.score !== null && !isDark(e.id, view.selectedTime ?? '') ? conditionWord(rating.category) : '';
      const sub = [hText, word].filter(Boolean).join(' · ');
      const label = `<span class="xlabel"><b>${e.name}</b>${sub ? `<small>${sub}</small>` : ''}</span>`;
      const icon = L.divIcon({className: `xpin${e.id === spot.id ? ' sel' : ''}${e.id === hoverRef.current ? ' hl' : ''}`, html: `<i style="--c:${color}"></i>${label}`, iconSize: [22, 22], iconAnchor: [11, 11]});
      const mk = L.marker([e.latitude, e.longitude], {icon, keyboard: true, title: e.name, alt: e.name, riseOnHover: true})
        .on('click', () => pickRef.current(e.id))
        .on('mouseover', () => { setHover(e.id); document.getElementById(`xrow-${e.id}`)?.scrollIntoView({block: 'nearest'}); })
        .on('mouseout', () => setHover(null)).addTo(g);
      markers.current.set(e.id, mk);
    }
    declutterRef.current();
  }, [view.mapRecords, view.selectedTime, spot.id, p.heightUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sparse labels that never collide: the selected spot first, then the best-rated; a zoom-dependent budget; the rest are dots.
   *  Each label tries right of its pin, then left, else stays a dot until zoomed in. Labels keep clear of the floating controls. */
  const declutter = () => {
    const m = map.current;
    const els = evidenceSpots.map((e) => ({id: e.id, el: markers.current.get(e.id)?.getElement()})).filter((x): x is {id: string; el: HTMLElement} => !!x.el);
    els.sort((a, b) => Number(b.el.classList.contains('sel')) - Number(a.el.classList.contains('sel')) || (rank.current.get(b.id) ?? -1) - (rank.current.get(a.id) ?? -1));
    els.forEach(({el}) => el.classList.remove('xhide', 'lft', 'xdot'));
    const boxes = els.map(({el}) => ({el, dot: el.querySelector('i')!.getBoundingClientRect(), lab: el.querySelector('.xlabel')?.getBoundingClientRect()}));
    const taken: DOMRect[] = boxes.filter((x) => x.dot.width).map((x) => x.dot);
    m?.getContainer().parentElement?.querySelectorAll('.xsearchbox, .xsheet, .xfabs > *, .xbottom > *, .leaflet-control-attribution, .xspotpop')
      .forEach((el) => { const r = el.getBoundingClientRect(); if (r.width) taken.push(r); });
    const edge = m?.getContainer().getBoundingClientRect();
    const inView = (r: DOMRect) => !edge || (r.right > edge.left && r.left < edge.right && r.bottom > edge.top && r.top < edge.bottom);
    const free = (r: DOMRect, own: DOMRect) => (!edge || (r.left >= edge.left + 4 && r.right <= edge.right - 4 && r.top >= edge.top && r.bottom <= edge.bottom)) && !taken.some((t) => t !== own && r.left < t.right + 2 && t.left < r.right + 2 && r.top < t.bottom + 2 && t.top < r.bottom + 2);
    let budget = labelBudget(m?.getZoom() ?? 9, isPhone());
    for (const {el, dot, lab} of boxes) {
      if (!lab?.width) continue;
      const isSel = el.classList.contains('sel');
      if (!isSel && (budget <= 0 || !inView(dot))) { el.classList.add('xdot'); continue; }
      const left = new DOMRect(dot.left - 8 - lab.width, lab.top, lab.width, lab.height);
      if (free(lab, dot) || (isSel && !free(left, dot))) { taken.push(lab); budget--; }
      else if (free(left, dot)) { taken.push(left); el.classList.add('lft'); budget--; }
      else el.classList.add('xdot');
    }
  };
  // T-058: on phones the map opens with the selected spot in the clear area above the time bar (never under it or the attribution).
  useEffect(() => {
    if (!phone) return;
    const t = window.setTimeout(() => {
      const m = map.current, e = evidenceSpots.find((x) => x.id === spot.id), root = rootRef.current; if (!m || !e || !root) return;
      const box = m.getContainer().getBoundingClientRect(), floor = root.querySelector('.leaflet-control-attribution')?.getBoundingClientRect().top ?? box.bottom;
      const at = m.latLngToContainerPoint([e.latitude, e.longitude]), want = {x: box.width * 0.4, y: (floor - box.top) * 0.55};
      m.panBy([at.x - want.x, at.y - want.y], {animate: false});
    }, 400);
    return () => window.clearTimeout(t);
  }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps
  const declutterRef = useRef(declutter);
  declutterRef.current = declutter;
  // Sheets and popovers open and slide; re-place labels once they settle.
  useEffect(() => { const t = setTimeout(() => declutterRef.current(), 280); return () => clearTimeout(t); }, [open, detent, callout, phone]);

  // Hover link between list rows and map markers: toggle a class on the marker element, no rebuild.
  useEffect(() => {
    markers.current.forEach((mk, id) => { mk.getElement()?.classList.toggle('hl', id === hover); mk.setZIndexOffset(id === hover ? 1000 : 0); });
  }, [hover]);

  useEffect(() => {
    const m = map.current, pop = popup.current;
    if (!m || !pop) return;
    pop.options.autoPanPaddingTopLeft = phone ? L.point(16, 16) : L.point(open ? 380 : 16, 80);
    pop.options.autoPanPaddingBottomRight = L.point(phone ? 64 : 76, phone ? sheetPx() + 70 : 90);
    if (pt) { setCallout(null); pop.setLatLng([pt.lat, pt.lon]).openOn(m); } else m.closePopup(pop);
  }, [pt]); // eslint-disable-line react-hooks/exhaustive-deps
  // The card grows when data arrives; re-measure so the popup pans fully into view.
  useEffect(() => { if (pt && (point.data || point.error)) popup.current?.update(); }, [point.data, point.error]); // eslint-disable-line react-hooks/exhaustive-deps
  // The spot callout follows the selected spot; phones show it in the sheet instead.
  useEffect(() => {
    const m = map.current, pop = spotPop.current, e = evidenceSpots.find((x) => x.id === callout);
    if (!m || !pop) return;
    if (e && !phone) { pop.options.autoPanPaddingTopLeft = L.point(open ? 380 : 16, 80); pop.setLatLng([e.latitude, e.longitude]).openOn(m); } else m.closePopup(pop);
  }, [callout, phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (callout && !phone) spotPop.current?.update(); }, [view.selectedTime, callout, phone]);
  useEffect(() => {
    if (!callout) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCallout(null); markers.current.get(spot.id)?.getElement()?.focus(); } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [callout, spot.id]);

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
    const z = Math.max(10, m.getZoom());
    const shift: [number, number] = phone ? [0, Math.min(sheetPx(), 260) / 2] : [sheetOpen ? -184 : 0, -60];
    const to = m.unproject(m.project([e.latitude, e.longitude], z).add(shift), z);
    if (reduced()) m.setView(to, z, {animate: false}); else m.flyTo(to, z, {duration: 1.1});
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
  const list = [...evidenceSpots].filter((e) => (zone === 'All' || zoneOf(e.region) === zone) && (!needle || e.name.toLowerCase().includes(needle) || e.region.toLowerCase().includes(needle)))
    .sort((a, b) => (regionRank.get(a.region)! - regionRank.get(b.region)!) || b.latitude - a.latitude);
  /** A region chip frames that stretch of coast (All: back to the selected spot's area) and filters the list. */
  const pickZone = (z: string) => {
    setZone(z); const m = map.current; if (!m) return;
    const pts = evidenceSpots.filter((e) => z !== 'All' && zoneOf(e.region) === z).map((e) => [e.latitude, e.longitude] as [number, number]);
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.15), {animate: !reduced(), paddingTopLeft: [phone ? 16 : 24, phone ? 120 : 80], paddingBottomRight: [phone ? 64 : 200, phone ? 120 : 80]});
    else flyRef.current(spot.id);
  };
  // T-116: after dark nothing is rated, so the map says it once, quietly, instead of on every spot.
  const darkNow = !!view.selectedTime && isDark(spot.id, view.selectedTime);
  const status = !live ? 'Model layers need live data; the demonstration week shows spots only.'
    : spatial.loading && !frame && slow ? 'Sea colour is not loading right now · spots and forecasts still work'
    : spatial.loading && !frame ? 'Loading model…'
    : frame || gframe ? `${def.label} · ${def.layer === 'WIND' ? 'GFS' : 'WW3'} via NOAA ERDDAP · ${frame ? 'California 0.5°' : ''}${frame && gframe ? ' + ' : ''}${gframe ? 'global 2°' : ''} · valid ${weekdayPT((frame ?? gframe)!.validAt)} ${hourLabel((frame ?? gframe)!.validAt)}${spatial.loading || globe.loading ? ' · updating…' : ''}`
    : spatial.status;
  const legend = legendModel(scaleKeyOfField(fieldId), {heightUnit: p.heightUnit, windUnit: p.windUnit}, themeNow());
  const ends = frame || gframe ? ([legend.lo, legend.hi] as const) : null;
  const unitLabel = legend.unitLabel;
  const when = view.selectedTime ? `${weekdayPT(view.selectedTime)} ${hourLabel(view.selectedTime)}` : 'this hour';

  /** Offshore height range at a spot across the shared hour +/- 3 h (from the model records, not invented). */
  const rangeAt = (id: string) => {
    if (!view.selectedTime) return null;
    const t0 = Date.parse(view.selectedTime);
    const hs = view.mapRecords.filter((r) => r.spotId === id && Math.abs(Date.parse(r.timestamp) - t0) <= 3 * 36e5).map((r) => Number(ht(r.offshore, p, 1)));
    if (!hs.length) return null;
    const lo = Math.floor(Math.min(...hs)), hi = Math.ceil(Math.max(...hs));
    return `${lo === hi ? lo : `${lo}–${hi}`} ${p.heightUnit} offshore`;
  };
  const callSpot = callout ? surfSpot(callout) : null, callRec = callout ? recAt(callout) : undefined;
  const callEv = evidenceSpots.find((e) => e.id === callout);
  const callout$ = callSpot && callEv ? (
    <SpotCallout spot={callSpot} region={callEv.region} f={callRec} rating={callRec ? rateForecast(callSpot, callRec, now) : null} when={when} p={p}
      onOpen={() => go('forecast')} onClose={phone ? undefined : () => setCallout(null)} />
  ) : null;
  const peek$ = phone ? (
    <SpotCallout spot={spot} region={here.region} f={f} rating={rating} when={when} p={p} onOpen={() => go('forecast')} />
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
  const listBody = (
    <div className="xlist" aria-label="Spots">
      <div className="xtb-chips" role="group" aria-label="Region">
        {['All', ...ZONES.map(([z]) => z)].map((z) => <button key={z} type="button" aria-pressed={zone === z} onClick={() => pickZone(z)}>{z}</button>)}
      </div>
      {!list.length && <p className="fine">No spot matches “{q}”{zone !== 'All' ? ` in ${zone}` : ''}.</p>}
      <ul>{list.map((e, i) => {
        const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null;
        const head = i === 0 || list[i - 1].region !== e.region ? <p className="xregion">{e.region}</p> : null;
        return <li key={e.id}>{head}<SpotRow id={e.id} name={e.name} sub={rangeAt(e.id) ?? 'No record at this hour'} category={rt?.category ?? null}
          current={e.id === spot.id} highlighted={hover === e.id} onPick={() => pickSpot(e.id, true)} onHover={(on) => setHover(on ? e.id : null)} /></li>;
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
    if (!navigator.geolocation) { flyToSpot(spot.id); return; }
    navigator.geolocation.getCurrentPosition((pos) => { const m = map.current; if (m) m.flyTo([pos.coords.latitude, pos.coords.longitude], Math.max(9, m.getZoom()), {animate: !reduced()}); }, () => flyToSpot(spot.id), {timeout: 8000, maximumAge: 600000});
  };
  const topBar = (
    <div className="xtopbar">
      <label className="xsearch xtb-search"><Icon name="search" size={16} /><span className="sr">Find a spot on the map</span>
        <input type="search" value={q} placeholder="Search spots" autoComplete="off" aria-controls="xsheet" aria-expanded={showList}
          onFocus={showResults} onChange={(e) => { setQ(e.target.value); showResults(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); pickSpot(list[0].id, true); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setQ(''); setOpen(false); } }} />
        <button type="button" className="xtb-loc" aria-label="Go to my location (or the selected spot)" onClick={locate}><Icon name="locate" size={17} /></button>
      </label>
    </div>
  );
  // T-117: the pin label's value is the painted field's own, at the tapped point; the period comes from the period layer when shown, else the point forecast.
  const fieldsNow = [field, gfield].filter((x): x is Field => !!x);
  const pv = pt ? sampleField(fieldsNow, pt.lat, pt.lon) : null;
  let perS: number | null = null, perFromPoint = false;
  if (pt && pv && (fieldId === 'waves' || fieldId === 'swell') && point.data && view.selectedTime) {
    const t = Date.parse(view.selectedTime) / 1000, d = point.data, k = d.time.reduce((best, x, i) => (Math.abs(x - t) < Math.abs(d.time[best] - t) ? i : best), 0);
    const x = Math.abs(d.time[k] - t) <= 5400 ? (d.wavePeriod?.[k] ?? d.swellPeriod[k]) : null; if (x !== null && x !== undefined) { perS = x; perFromPoint = true; }
  }
  const line = pointLine(pv, perS, p, fieldId);
  const cycleUnit = def.unit === 'm' ? () => data.profile({heightUnit: p.heightUnit === 'ft' ? 'm' : 'ft'})
    : def.unit === 'm/s' ? () => data.profile({windUnit: p.windUnit === 'mph' ? 'kn' : p.windUnit === 'kn' ? 'km/h' : 'mph'}) : null;
  const modelName = `${def.layer === 'WIND' ? 'GFS' : 'WW3'} · NOAA ERDDAP`;

  return (
    <div ref={rootRef} className="xmap" data-d={phone ? detent : undefined}>
      <div ref={mapEl} className="xleaf" role="application" aria-label="Ocean map. Drag to pan; use the zoom buttons or scroll to zoom." />

      {phone && sheetOn ? (
        <section ref={sheetRef} className="xsheet phone" id="xsheet" data-d={detent} aria-label="Spots"
          style={drag !== null ? ({height: `${drag}px`, transition: 'none'} as CSSProperties) : undefined}>
          <button className="xgrab" aria-label={`Spot sheet: ${detent === 'peek' ? 'selected spot' : detent === 'half' ? 'half height' : 'full list'}. Press to resize`}
            onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={() => { dragFrom.current = null; setDrag(null); }} onKeyDown={handleKey}
            onClick={() => { if (dragged.current) { dragged.current = false; return; } setDetent(DETENTS[(DETENTS.indexOf(detent) + 1) % 3]); }}><i /></button>
          <button className="xsheet-x" aria-label="Close the spot sheet" onClick={() => { setSheetOn(false); setDetent('peek'); setCallout(null); }}><Icon name="close" size={16} /></button>
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
        const failed = !spatial.loading && !spatial.frame && !/^Loading/.test(spatial.status), held = (frame ?? gframe)?.validAt;
        // Say what is actually on screen: the held frame may be the previous layer (honest while the new one loads or fails).
        const heldName = shownFor.current !== fieldId ? (FIELDS.find((x) => x.id === shownFor.current)?.short ?? '').toLowerCase() : '';
        const showing = held ? ` · showing ${heldName ? `${heldName}, ` : ''}${weekdayPT(held)} ${hourLabel(held)}` : '';
        const retry = () => { setSlow(false); spatial.retry(); };
        if (failed) return <p className="xload err" role="alert">Couldn't load {def.short.toLowerCase()} for {when}{showing} <button type="button" onClick={retry}>Retry</button></p>;
        if (slow && anyLoading) return <p className="xload" role="status">Still loading {def.short.toLowerCase()} for {when}…{heldName ? ` Showing ${heldName} meanwhile.` : ''} <button type="button" onClick={retry}>Retry</button></p>;
        return null;
      })()}
      {/* T-117 (Windy): the layers down the right edge as labelled round thumbnails (a menu button and sheet on phones), the zoom and centre controls under them. */}
      <div className="xfabs">
        <LayerList phone={phone} fields={['waves', 'swell', 'wind', 'period'].map((id) => { const f = FIELDS.find((x) => x.id === id)!; return {...f, short: id === 'waves' ? 'Waves' : f.short, ramp: legendModel(scaleKeyOfField(f.id), {heightUnit: p.heightUnit, windUnit: p.windUnit}, themeNow(), 14).gradient}; })} field={fieldId} on={opts.heat} setField={(id) => pickField(id as FieldId | null)}
          flow={opts.flow} setFlow={(v) => setOpts({...opts, flow: v})} arrows={opts.arrows} setArrows={(v) => setOpts({...opts, arrows: v})} note={status}
          onPoint={() => { const c = map.current!.getCenter(); setPanel(true); setPt({lat: c.lat, lon: c.lng}); }} />
        <div className="xzoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Icon name="plus" size={18} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Icon name="minus" size={18} /></button></div>
        <button className="xround xcenter" aria-label="Center on the selected spot" onClick={() => flyToSpot(spot.id)}><Icon name="star" size={18} /></button>
      </div>

      {/* T-116: one bottom strip (Windy): the time scrubber and the legend, plus one quiet mark when the hour is dark. */}
      <div className="xbottom">
        {darkNow && <p className="xdark" role="status">Dark<span className="xdark-l"> at this hour</span> · not rated</p>}
        <DayStrip times={times} index={ti} playing={playing} onPlay={() => setPlaying(!playing)} onScrub={(i) => { setPlaying(false); view.selectTime(times[i]); }}
          valueText={view.selectedTime ? `${weekdayPT(view.selectedTime)} ${hourLabel(view.selectedTime)}` : ''} />
        <div className="xb-right">
          {opts.heat && <ModelChip name={modelName} note={<>{status} {ENCLOSED_NOTE}</>} />}
        {opts.heat && ends ? <LegendChip unit={unitLabel} ramp={legend.gradient} ticks={legend.ticks} lo={ends[0]} hi={ends[1]} label={def.label} loading={spatial.loading || globe.loading} onCycle={cycleUnit} />
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
