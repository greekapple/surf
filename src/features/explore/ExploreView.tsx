import {useCallback, useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
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
import {attachField, buildField, RAMP, RANGE, RANGE_WIDE} from '../../map/field';
import {addBasemap} from '../../map/basemap';
import type {MapLayer, MapVariable} from '../../map/types';
import type {SpatialFrame} from '../../map/spatial';
import {PointCard, usePointForecast, type Pt} from './PointCard';
import {CompareSpots} from './Compare';
import {FindSpots} from './FindSpots';
import {LayerMenu, LegendChip, SpotRow, TimeBar, stampLabel} from './Panels';
import {SpotCallout} from './Callout';
import './explore.css';

/** Field layers the regional grids can actually supply. One is shown at a time. */
type FieldId = 'waves' | 'swell' | 'period' | 'wind';
const FIELDS: {id: FieldId; label: string; icon: IconName; layer: MapLayer; variable: MapVariable; unit: SpatialFrame['unit']; note: string}[] = [
  {id: 'waves', label: 'Wave height', icon: 'waves', layer: 'WAVES', variable: 'Offshore Hs', unit: 'm', note: 'Combined significant wave height (WW3), offshore'},
  {id: 'swell', label: 'Swell height', icon: 'tide', layer: 'SWELL', variable: 'Height', unit: 'm', note: 'Swell partition height (WW3), offshore'},
  {id: 'period', label: 'Wave period', icon: 'forecast', layer: 'WAVES', variable: 'Period', unit: 's', note: 'Peak wave period (WW3)'},
  {id: 'wind', label: 'Wind', icon: 'wind', layer: 'WIND', variable: 'Speed', unit: 'm/s', note: '10 m wind speed (GFS), 3-hourly'},
];
const sectionField = (section: string): FieldId => (section === 'wind' ? 'wind' : section === 'swell' ? 'swell' : 'waves');
const fieldSection: Record<FieldId, string> = {waves: '', swell: 'swell', period: '', wind: 'wind'};
const surfSpot = (id: string) => spots.find((s) => s.id === id)!;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PHONE = '(max-width: 860px)';
const isPhone = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches;
type Detent = 'peek' | 'half' | 'full';
const DETENTS: Detent[] = ['peek', 'half', 'full'];

/** Legend end values in the user's units. */
function legendEnds(unit: SpatialFrame['unit'], hu: string, wu: string, wide = false) {
  const [a, b] = (wide ? RANGE_WIDE : RANGE)[unit] ?? [0, 1];
  const f = (v: number) => (unit === 'm' ? (hu === 'ft' ? v / 0.3048 : v) : unit === 'm/s' ? v * (wu === 'mph' ? 2.23694 : wu === 'kn' ? 1.94384 : 3.6) : v).toFixed(0);
  return [f(a), `${f(b)}+`] as const;
}

/** How many spots carry a name label at this zoom (Surfline map: the selected spot and the best few; the rest are dots). */
const labelBudget = (zoom: number, phone: boolean) => (zoom < 9 ? (phone ? 2 : 3) : zoom < 11 ? (phone ? 3 : 5) : (phone ? 5 : 8));

export function ExploreView({section, go}: ViewProps) {
  if (section === 'discover') return <FindSpots go={go} />;
  if (section === 'compare') return <CompareSpots go={go} />;
  return <OceanMap section={section} go={go} />;
}

function OceanMap({section, go}: ViewProps) {
  const {view, data, spot, setSpot, now, live} = useSwello();
  const p = data.state.profile;
  const [fieldId, setFieldId] = useState<FieldId>(sectionField(section));
  useEffect(() => { setFieldId((f) => (fieldSection[f] === section ? f : sectionField(section))); }, [section]);
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const markers = useRef(new Map<string, L.Marker>());
  const rank = useRef(new Map<string, number>());
  const [step, setStep] = useState(3);
  const [horizon, setHorizon] = useState(7);
  const [opts, setOpts] = useState({heat: true, flow: true, arrows: false});
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => { const mq = matchMedia(PHONE), on = () => setPhone(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  // Wide screens: the spot list is a slim sheet under the search, open only on demand. Phones: a bottom sheet with three detents.
  const [open, setOpen] = useState(false);
  const [detent, setDetent] = useState<Detent>('peek');
  const [drag, setDrag] = useState<number | null>(null);
  const [callout, setCallout] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(9);
  const wide = zoom < 5; // ocean-basin view uses the wider colour ramp
  const def = FIELDS.find((f) => f.id === fieldId)!;
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  // Tap-the-sea point forecast: one popup, one temporary pin.
  const [pt, setPt] = useState<Pt | null>(null);
  const [pinned, setPinned] = useState<Pt | null>(null);
  const popup = useRef<L.Popup | null>(null);
  const popupEl = useMemo(() => document.createElement('div'), []);
  // Spot callout at the pin (wide screens).
  const spotPop = useRef<L.Popup | null>(null);
  const spotPopEl = useMemo(() => document.createElement('div'), []);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const point = usePointForecast(pt);
  const spatial = useSpatial(def.layer, def.variable, view.selectedTime, false, live && (opts.heat || opts.flow || opts.arrows));
  // Keep the last good frame of this field on screen while the next hour loads, so scrubbing doesn't flash blank.
  const shown = useRef<SpatialFrame | null>(null);
  if (spatial.frame) shown.current = spatial.frame;
  else if (!spatial.loading) shown.current = null;
  const frame = shown.current && shown.current.unit === def.unit ? shown.current : null;
  const field = useMemo(() => (frame ? buildField(frame, def.layer === 'WIND') : null), [frame, def.layer]);
  // Worldwide 2° frame underneath, so colour and flow continue past the California grid to the whole globe.
  const globe = useGlobe(def.layer, def.variable, view.selectedTime, live && (opts.heat || opts.flow || opts.arrows));
  const shownGlobe = useRef<SpatialFrame | null>(null);
  if (globe.frame) shownGlobe.current = globe.frame;
  else if (!globe.loading) shownGlobe.current = null;
  const gframe = shownGlobe.current && shownGlobe.current.unit === def.unit ? shownGlobe.current : null;
  const gfield = useMemo(() => (gframe ? buildField(gframe, def.layer === 'WIND') : null), [gframe, def.layer]);
  const allTimes = view.timeline;
  // The forecast window (1 / 3 / 7 days from the first frame) bounds the slider, stepping and playback.
  const times = useMemo(() => { const t0 = Date.parse(allTimes[0] ?? ''); return Number.isFinite(t0) ? allTimes.filter((t) => Date.parse(t) <= t0 + horizon * 864e5) : allTimes; }, [allTimes, horizon]);
  const sel = times.indexOf(view.selectedTime ?? '');
  const ti = sel >= 0 ? sel : view.selectedTime && times.length && Date.parse(view.selectedTime) > Date.parse(times[times.length - 1]) ? times.length - 1 : 0;
  const recAt = (id: string) => view.mapRecords.find((r) => r.spotId === id && r.timestamp === view.selectedTime);

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const small = matchMedia('(max-width: 860px)').matches;
    const m = L.map(mapEl.current, {zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 14, zoomSnap: 0.5, worldCopyJump: true, maxBounds: [[-85, -540], [85, 540]], maxBoundsViscosity: 0.8}).setView(small ? [37.5, -122.5] : [37.5, -122.45], small ? 8 : 9);
    if (!small) m.panBy([-170, 0], {animate: false}); // centre the coast in the space right of the side panel
    const lod = () => { m.getContainer().classList.toggle('far', m.getZoom() < 9); m.getContainer().classList.toggle('world', m.getZoom() < 5); setZoom(m.getZoom()); };
    m.on('zoomend', lod); lod();
    m.on('zoomend moveend resize', () => declutterRef.current()); // panels stay put while the map pans
    L.control.attribution({position: 'bottomleft', prefix: false}).addTo(m);
    // Light or dark Esri Canvas basemap by theme (satellite on request), with maxNativeZoom so tiles upscale: src/map/basemap.ts (T-042).
    const disposeBase = addBasemap(m);
    pins.current = L.layerGroup().addTo(m);
    pinLayer.current = L.layerGroup().addTo(m);
    popup.current = L.popup({closeButton: false, closeOnClick: false, autoClose: false, className: 'xpopup', minWidth: 248, maxWidth: 248, autoPanPaddingTopLeft: [16, 16], autoPanPaddingBottomRight: [16, 70]});
    popup.current.setContent(popupEl);
    m.on('click', (e: L.LeafletMouseEvent) => setPt({lat: Math.round(e.latlng.lat * 10) / 10, lon: Math.round((((e.latlng.lng + 180) % 360 + 360) % 360 - 180) * 10) / 10}));
    map.current = m; if (import.meta.env.DEV) (window as unknown as {__swelloMap?: L.Map}).__swelloMap = m; // test hook for the zoom script (dev only)
    if (import.meta.env.DEV) Object.assign(window, {__xmap: m}); // browser QA scripts drive zoom through this; stripped from builds
    return () => { disposeBase(); m.remove(); map.current = null; };
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

  useEffect(() => {
    const m = map.current;
    const fields = [field, gfield].filter((f): f is NonNullable<typeof f> => !!f);
    if (!m || !fields.length) return;
    return attachField(m, fields, {heat: opts.heat, flow: opts.flow, arrows: opts.arrows, opacity: 0.72, reducedMotion: reduced(), wide});
  }, [field, gfield, opts.heat, opts.flow, opts.arrows, wide]);

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
      const label = `<span class="xlabel"><b>${e.name}</b>${rating ? `<small>${conditionWord(rating.category)}</small>` : ''}</span>`;
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
  useEffect(() => {
    const g = pinLayer.current;
    if (!g) return;
    g.clearLayers();
    if (!pinned) return;
    const icon = L.divIcon({className: 'xpinned', html: '<i></i>', iconSize: [18, 18], iconAnchor: [9, 9]});
    L.marker([pinned.lat, pinned.lon], {icon, keyboard: true, title: `Pinned model point ${pinned.lat}, ${pinned.lon}`, alt: `Pinned model point ${pinned.lat}, ${pinned.lon}`}).on('click', () => setPt(pinned)).addTo(g);
  }, [pinned]);
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
    const id = setInterval(() => stepRef.current(1, true), step === 1 ? 800 : step === 3 ? 600 : 450);
    return () => clearInterval(id);
  }, [playing, times.length, step]);

  /** Height of the phone sheet in px (for keeping pins and popups above it). */
  const sheetPx = () => sheetRef.current?.getBoundingClientRect().height ?? 0;
  // The phone peek sizes itself to the spot card; the time bar, legend and attribution sit just above it.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheetRef.current, root = rootRef.current;
    if (!phone || !el || !root || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => { if (detent === 'peek') root.style.setProperty('--peek', `${Math.round(el.getBoundingClientRect().height)}px`); });
    ro.observe(el); return () => ro.disconnect();
  }, [phone, detent]);
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
    if (phone) setDetent('peek');
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
  const list = [...evidenceSpots].sort((a, b) => (regionRank.get(a.region)! - regionRank.get(b.region)!) || b.latitude - a.latitude).filter((e) => !query || `${e.name} ${e.region}`.toLowerCase().includes(query.toLowerCase()));
  const status = !live ? 'Model layers need live data; the demonstration week shows spots only.'
    : spatial.loading && !frame ? 'Loading model…'
    : frame || gframe ? `${def.label} · ${def.layer === 'WIND' ? 'GFS' : 'WW3'} via NOAA ERDDAP · ${frame ? 'California 0.5°' : ''}${frame && gframe ? ' + ' : ''}${gframe ? 'global 2°' : ''} · valid ${weekdayPT((frame ?? gframe)!.validAt)} ${hourLabel((frame ?? gframe)!.validAt)}${spatial.loading || globe.loading ? ' · updating…' : ''}`
    : spatial.status;
  const ends = frame || gframe ? legendEnds((frame ?? gframe)!.unit, p.heightUnit, p.windUnit, wide) : null;
  const unitLabel = def.unit === 'm' ? p.heightUnit : def.unit === 'm/s' ? p.windUnit : 's';
  const allDays = times.map((t, i) => ({t, i})).filter(({t}, k) => k === 0 || weekdayPT(t) !== weekdayPT(times[k - 1]));
  // A partial first day too short to hold its label is dropped; the readout still names the day.
  const dayStarts = allDays.filter((d, k) => k > 0 || !allDays[1] || allDays[1].i >= 10).map(({t, i}) => ({t, i, label: weekdayPT(t)}));
  const stamp = view.selectedTime ? stampLabel(view.selectedTime) : null;
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
  const dragFrom = useRef<{y: number; h: number} | null>(null);
  const onHandleDown = (e: React.PointerEvent) => { dragFrom.current = {y: e.clientY, h: sheetPx()}; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onHandleMove = (e: React.PointerEvent) => { if (dragFrom.current) setDrag(Math.max(120, dragFrom.current.h + dragFrom.current.y - e.clientY)); };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = dragFrom.current; dragFrom.current = null;
    if (!d) return;
    const moved = d.y - e.clientY;
    setDrag(null);
    if (Math.abs(moved) < 8) { setDetent(DETENTS[(DETENTS.indexOf(detent) + 1) % 3]); return; }
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
      {list.length === 0 && <p className="fine">No spot matches “{query}”.</p>}
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
  const search = (
    <div className="xsearch">
      <Icon name="search" size={16} />
      <input type="search" placeholder="Search spots" value={query} aria-label="Search spots"
        onFocus={() => (phone ? setDetent('full') : setOpen(true))} onChange={(e) => { setQuery(e.target.value); if (phone) setDetent('full'); else setOpen(true); }} />
      {!phone && <button className="xcollapse" aria-expanded={open} aria-controls="xsheet" aria-label={open ? 'Hide spot list' : 'Show spot list'} onClick={() => setOpen(!open)}><Icon name="chevron" size={16} /></button>}
    </div>
  );

  return (
    <div ref={rootRef} className="xmap" data-d={phone ? detent : undefined}>
      <div ref={mapEl} className="xleaf" role="application" aria-label="Ocean map. Drag to pan; use the zoom buttons or scroll to zoom." />

      {phone ? (
        <section ref={sheetRef} className="xsheet phone" id="xsheet" data-d={detent} aria-label="Spots"
          style={drag !== null ? ({height: `${drag}px`, transition: 'none'} as CSSProperties) : undefined}>
          <button className="xgrab" aria-label={`Spot sheet: ${detent === 'peek' ? 'selected spot' : detent === 'half' ? 'half height' : 'full list'}. Press to resize`}
            onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={() => { dragFrom.current = null; setDrag(null); }} onKeyDown={handleKey}
            onClick={(e) => { if (e.detail === 0) setDetent(DETENTS[(DETENTS.indexOf(detent) + 1) % 3]); }}><i /></button>
          {search}
          {showList ? listBody : peek$}
        </section>
      ) : (
        <div className="xsearchbox">
          {search}
          {open && <section ref={sheetRef} className="xsheet" id="xsheet" aria-label="Spots">{listBody}</section>}
        </div>
      )}

      <div className="xfabs">
        <div className="xzoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Icon name="plus" size={18} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Icon name="minus" size={18} /></button></div>
        <div className="xfabgrp">
          <LayerMenu fields={FIELDS} field={fieldId} on={opts.heat} setField={(id) => pickField(id as FieldId | null)} flow={opts.flow} setFlow={(v) => setOpts({...opts, flow: v})}
            arrows={opts.arrows} setArrows={(v) => setOpts({...opts, arrows: v})} note={status}
            onPoint={() => { const c = map.current!.getCenter(); setPt({lat: Math.round(c.lat * 10) / 10, lon: Math.round(c.lng * 10) / 10}); }} />
          <button className="xfab" aria-label="Center on selected spot" onClick={() => flyToSpot(spot.id)}><Icon name="locate" size={18} /></button>
        </div>
      </div>

      <div className="xbottom">
        <TimeBar times={times} index={ti} stamp={stamp} playing={playing} step={step} horizon={horizon} days={dayStarts}
          valueText={view.selectedTime ? `${weekdayPT(view.selectedTime)} ${hourLabel(view.selectedTime)}` : ''}
          onPlay={() => setPlaying(!playing)} onStep={(d) => { setPlaying(false); stepBy(d); }} onRange={setStep}
          onHorizon={(d) => { setHorizon(d); const t0 = Date.parse(allTimes[0] ?? ''); if (view.selectedTime && Date.parse(view.selectedTime) > t0 + d * 864e5) view.selectTime([...allTimes].filter((t) => Date.parse(t) <= t0 + d * 864e5).pop()!); }}
          onScrub={(i) => { setPlaying(false); view.selectTime(times[i]); }} />
        {opts.heat && ends ? <LegendChip unit={unitLabel} ramp={RAMP} lo={ends[0]} hi={ends[1]} label={def.label} loading={spatial.loading || globe.loading} note={status} />
          : <p className="xchip xstatus" role="status" data-loading={spatial.loading || globe.loading ? 'true' : undefined}>{opts.heat ? status : 'Sea colour off'}</p>}
      </div>

      {pt && createPortal(<PointCard pt={pt} state={point} time={view.selectedTime} p={p} pinned={!!pinned && pinned.lat === pt.lat && pinned.lon === pt.lon}
        onPin={() => setPinned(pinned && pinned.lat === pt.lat && pinned.lon === pt.lon ? null : pt)} onClose={() => setPt(null)} />, popupEl)}
      {!phone && callout$ && createPortal(callout$, spotPopEl)}
    </div>
  );
}
