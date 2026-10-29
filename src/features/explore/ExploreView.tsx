import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {StateMessage} from '../../ui/common';
import {DirArrow, Icon, type IconName} from '../../ui/Icon';
import {Condition} from '../../ui/Condition';
import {BAND_COLOR, bandOf, hourLabel, titleCase} from '../forecast/model';
import {compass, ht, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT} from '../forecast/format';
import {attachField, buildField, RAMP, RANGE, RANGE_WIDE} from '../../map/field';
import type {MapLayer, MapVariable} from '../../map/types';
import type {SpatialFrame} from '../../map/spatial';
import {PointCard, usePointForecast, type Pt} from './PointCard';
import {CompareSpots} from './Compare';
import {FindSpots} from './FindSpots';
import {LayerRows, SpotRow, TimeCard, ownPhoto, stampLabel, type LayerRowDef} from './Panels';
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

/** Legend tick values in the user's units. */
function legendTicks(unit: SpatialFrame['unit'], hu: string, wu: string, wide = false) {
  const [a, b] = (wide ? RANGE_WIDE : RANGE)[unit] ?? [0, 1], n = 5;
  return Array.from({length: n}, (_, i) => {
    const v = a + ((b - a) * i) / (n - 1);
    if (unit === 'm') return (hu === 'ft' ? v / 0.3048 : v).toFixed(0);
    if (unit === 'm/s') return (v * (wu === 'mph' ? 2.23694 : wu === 'kn' ? 1.94384 : 3.6)).toFixed(0);
    return v.toFixed(0);
  });
}

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
  const [tab, setTab] = useState<'spots' | 'conditions' | 'layers'>('spots');
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const markers = useRef(new Map<string, L.Marker>());
  const [step, setStep] = useState(3);
  const [horizon, setHorizon] = useState(7);
  const [layersOpen, setLayersOpen] = useState(() => typeof matchMedia !== 'function' || !matchMedia('(max-width: 860px)').matches);
  const [opts, setOpts] = useState({heat: true, flow: true, arrows: true, labels: true});
  // Floating search panel: open on desktop, collapsed to just the search box on phones.
  const [open, setOpen] = useState(() => typeof matchMedia !== 'function' || !matchMedia('(max-width: 860px)').matches);
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
  const pinLayer = useRef<L.LayerGroup | null>(null);
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
    L.control.attribution({position: 'bottomleft', prefix: false}).addTo(m);
    // Esri World Imagery + reference labels (attribution required); VITE_MAP_TILE_URL swaps in a licensed provider.
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16, className: 'xbase', attribution: import.meta.env.VITE_MAP_ATTRIBUTION || 'Imagery &copy; Esri, Maxar, Earthstar Geographics · Coastline: Natural Earth',
    }).addTo(m);
    m.createPane('labels'); m.getPane('labels')!.style.zIndex = '450'; m.getPane('labels')!.style.pointerEvents = 'none';
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {pane: 'labels', maxZoom: 16, opacity: 0.7}).addTo(m);
    pins.current = L.layerGroup().addTo(m);
    pinLayer.current = L.layerGroup().addTo(m);
    popup.current = L.popup({closeButton: false, closeOnClick: false, autoClose: false, className: 'xpopup', minWidth: 248, maxWidth: 248, autoPanPaddingTopLeft: [16, 16], autoPanPaddingBottomRight: [16, 70]});
    popup.current.setContent(popupEl);
    m.on('click', (e: L.LeafletMouseEvent) => setPt({lat: Math.round(e.latlng.lat * 10) / 10, lon: Math.round((((e.latlng.lng + 180) % 360 + 360) % 360 - 180) * 10) / 10}));
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    const fields = [field, gfield].filter((f): f is NonNullable<typeof f> => !!f);
    if (!m || !fields.length) return;
    return attachField(m, fields, {heat: opts.heat, flow: opts.flow, arrows: opts.arrows, opacity: 0.72, reducedMotion: reduced(), wide});
  }, [field, gfield, opts.heat, opts.flow, opts.arrows, wide]);

  // Spot markers: white ring + rating dot, label with the offshore height at the shared hour.
  useEffect(() => {
    const g = pins.current;
    if (!g) return;
    g.clearLayers();
    markers.current.clear();
    for (const e of evidenceSpots) {
      const f = recAt(e.id), rating = f ? rateForecast(surfSpot(e.id), f, now) : null;
      const color = rating ? BAND_COLOR[bandOf(rating.category)] : 'var(--none)';
      const label = opts.labels ? `<span class="xlabel"><b>${e.name}</b>${f ? `<small>${ht(f.offshore, p)} ${p.heightUnit}</small>` : ''}</span>` : '';
      const icon = L.divIcon({className: `xpin${e.id === spot.id ? ' sel' : ''}${e.id === hoverRef.current ? ' hl' : ''}`, html: `<i style="--c:${color}"></i>${label}`, iconSize: [22, 22], iconAnchor: [11, 11]});
      const mk = L.marker([e.latitude, e.longitude], {icon, keyboard: true, title: e.name, alt: e.name, riseOnHover: true})
        .on('click', () => { setSpot(e.id); setTab('conditions'); setOpen(true); flyRef.current(e.id); })
        .on('mouseover', () => { setHover(e.id); document.getElementById(`xrow-${e.id}`)?.scrollIntoView({block: 'nearest'}); })
        .on('mouseout', () => setHover(null)).addTo(g);
      markers.current.set(e.id, mk);
    }
  }, [view.mapRecords, view.selectedTime, spot.id, p.heightUnit, opts.labels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hover link between list rows and map markers: toggle a class on the marker element, no rebuild.
  useEffect(() => {
    markers.current.forEach((mk, id) => { mk.getElement()?.classList.toggle('hl', id === hover); mk.setZIndexOffset(id === hover ? 1000 : 0); });
  }, [hover]);

  useEffect(() => {
    const m = map.current, pop = popup.current;
    if (!m || !pop) return;
    // Keep the card clear of the floating search panel (wide screens) or the search bar and layer column (phones).
    const phone = matchMedia('(max-width: 860px)').matches;
    pop.options.autoPanPaddingTopLeft = phone ? L.point(16, 80) : L.point(open ? 356 : 16, 16);
    pop.options.autoPanPaddingBottomRight = L.point(phone ? 70 : 76, 70);
    if (pt) pop.setLatLng([pt.lat, pt.lon]).openOn(m); else m.closePopup(pop);
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

  /** Glide to a spot; the target sits in the free part of the map, clear of the side panel. */
  const flyToSpot = (id: string) => {
    const m = map.current, e = evidenceSpots.find((x) => x.id === id);
    if (!m || !e) return;
    const z = Math.max(10, m.getZoom()), desk = !matchMedia('(max-width: 860px)').matches;
    const to = m.unproject(m.project([e.latitude, e.longitude], z).subtract([desk && open ? 170 : 0, 0]), z);
    if (reduced()) m.setView(to, z, {animate: false}); else m.flyTo(to, z, {duration: 1.1});
  };
  const center = flyToSpot;
  const flyRef = useRef(flyToSpot);
  flyRef.current = flyToSpot;
  const pickField = (id: FieldId) => { setFieldId(id); if (fieldSection[id] !== section) go('explore', fieldSection[id]); };
  const f = recAt(spot.id);
  const rating = f ? rateForecast(spot, f, now) : null;
  const list = [...evidenceSpots].sort((a, b) => b.latitude - a.latitude).filter((e) => !query || `${e.name} ${e.region}`.toLowerCase().includes(query.toLowerCase()));
  const status = !live ? 'Model layers need live data; the demonstration week shows spots only.'
    : spatial.loading && !frame ? 'Loading model…'
    : frame || gframe ? `${def.label} · ${def.layer === 'WIND' ? 'GFS' : 'WW3'} via NOAA ERDDAP · ${frame ? 'California 0.5°' : ''}${frame && gframe ? ' + ' : ''}${gframe ? 'global 2°' : ''} · valid ${weekdayPT((frame ?? gframe)!.validAt)} ${hourLabel((frame ?? gframe)!.validAt)}${spatial.loading || globe.loading ? ' · updating…' : ''}`
    : spatial.status;
  const ticks = frame || gframe ? legendTicks((frame ?? gframe)!.unit, p.heightUnit, p.windUnit, wide) : [];
  const unitLabel = def.unit === 'm' ? p.heightUnit : def.unit === 'm/s' ? p.windUnit : 's';
  const allDays = times.map((t, i) => ({t, i})).filter(({t}, k) => k === 0 || weekdayPT(t) !== weekdayPT(times[k - 1]));
  // A partial first day too short to hold its label is dropped; the readout still names the day.
  const dayStarts = allDays.filter((d, k) => k > 0 || !allDays[1] || allDays[1].i >= 10).map(({t, i}) => ({t, i, label: weekdayPT(t)}));
  const stamp = view.selectedTime ? stampLabel(view.selectedTime) : null;

  /** Offshore height range at a spot across the shared hour +/- 3 h (from the model records, not invented). */
  const rangeAt = (id: string) => {
    if (!view.selectedTime) return '—';
    const t0 = Date.parse(view.selectedTime);
    const hs = view.mapRecords.filter((r) => r.spotId === id && Math.abs(Date.parse(r.timestamp) - t0) <= 3 * 36e5).map((r) => Number(ht(r.offshore, p, 1)));
    if (!hs.length) return '—';
    const lo = Math.floor(Math.min(...hs)), hi = Math.ceil(Math.max(...hs));
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  };

  const fieldRow = (id: FieldId, label: string, icon: IconName): LayerRowDef => {
    const on = fieldId === id && opts.heat;
    return {key: id, label, icon, on, set: () => { if (on) setOpts({...opts, heat: false}); else { setOpts({...opts, heat: true}); pickField(id); } }};
  };
  const optRow = (k: keyof typeof opts, label: string, icon: IconName): LayerRowDef => ({key: k, label, icon, on: opts[k], set: () => setOpts({...opts, [k]: !opts[k]})});
  const cardRows: LayerRowDef[] = [
    fieldRow('waves', 'Wave height', 'waves'), fieldRow('swell', 'Swell height', 'waves'), optRow('arrows', 'Swell direction', 'arrow'), fieldRow('wind', 'Wind', 'wind'),
    {key: 'tides', label: 'Tides', icon: 'tide', on: false, set: () => {}, soon: true}, {key: 'sst', label: 'SST', icon: 'thermo', on: false, set: () => {}, soon: true},
  ];
  const tabRows: LayerRowDef[] = [
    fieldRow('waves', 'Wave height', 'waves'), fieldRow('swell', 'Swell height', 'waves'), fieldRow('period', 'Wave period', 'forecast'), fieldRow('wind', 'Wind', 'wind'),
    optRow('arrows', 'Swell direction', 'arrow'), optRow('flow', 'Flow animation', 'tide'), optRow('labels', 'Spot labels', 'locate'),
    {key: 'tides', label: 'Tides', icon: 'tide', on: false, set: () => {}, soon: true}, {key: 'sst', label: 'SST', icon: 'thermo', on: false, set: () => {}, soon: true},
  ];
  const TABS = [['spots', 'Spots'], ['conditions', 'Conditions'], ['layers', 'Layers']] as const;
  const pickSpot = (id: string) => { setSpot(id); flyToSpot(id); setTab('conditions'); };

  return (
    <div className="xmap on-dark">
      <div ref={mapEl} className="xleaf" role="application" aria-label="Ocean map. Drag to pan; use the zoom buttons or scroll to zoom." />

      <aside className={`xside${open ? '' : ' closed'}`} aria-label="Spots and conditions">
        <div className="xsearch">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search spots..." value={query} aria-label="Search spots"
            onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setTab('spots'); setOpen(true); }} />
          <button className="xcollapse" aria-expanded={open} aria-label={open ? 'Collapse spot list' : 'Expand spot list'} onClick={() => setOpen(!open)}><Icon name="chevron" size={16} /></button>
        </div>
        {open && <>
          <div className="xtabs" role="tablist" aria-label="Panel">
            {TABS.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{l}</button>)}
          </div>
          {tab === 'spots' && (
            <div className="xlist" role="tabpanel" aria-label="Spots">
              {list.length === 0 && <p className="fine">No spot matches “{query}”.</p>}
              <ul>{list.map((e, i) => {
                const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null;
                const head = i === 0 || list[i - 1].region !== e.region ? <p className="xregion">{e.region}</p> : null;
                return <li key={e.id} id={`xrow-${e.id}`}>{head}<SpotRow id={e.id} name={e.name} range={rangeAt(e.id)} unit={p.heightUnit} category={rt?.category ?? null}
                  current={e.id === spot.id} highlighted={hover === e.id} onPick={() => pickSpot(e.id)} onHover={(on) => setHover(on ? e.id : null)} /></li>;
              })}</ul>
              {!live && <p className="fine">The demonstration week shows spots only. <a href="/explore/discover" onClick={(ev) => { ev.preventDefault(); go('explore', 'discover'); }}>Discover Spots</a></p>}
            </div>
          )}
          {tab === 'layers' && <div className="xlist xlayertab" role="tabpanel" aria-label="Layers"><LayerRows rows={tabRows} /></div>}
          {tab === 'conditions' && (
            <div className="xcond" role="tabpanel" aria-label="Conditions">
              <div className={`xc-photo${ownPhoto(spot.id) ? '' : ' plain'}`} style={ownPhoto(spot.id) ? {backgroundImage: `url(${ownPhoto(spot.id)})`} : undefined}><h2>{spot.name}</h2><span>{spot.region}{spot.character === 'Generic profile' ? ' · generic spot profile' : ''}</span></div>
              {!f ? <StateMessage title="No record at this hour" /> : <>
                <p className="xc-big">{ht(f.offshore, p)}<small>{p.heightUnit} offshore</small>{rating && <span className="xc-rate"><Condition category={rating.category} chip /></span>}</p>
                <dl className="xc-kv">
                  <dt>Swell</dt><dd>{f.primary ? <><DirArrow from={f.primary.direction} size={13} /> {ht(f.primary.height, p)} {p.heightUnit} · {Math.round(f.primary.period)} s {compass(f.primary.direction)}</> : '—'}</dd>
                  <dt>Wind</dt><dd>{Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} size={13} /> {windVal(f.wind.speed, p)} {p.windUnit} {compass(f.wind.direction)}</> : '—'}</dd>
                  <dt>Tide</dt><dd>{Number.isFinite(f.tide.height) ? <>{ht(f.tide.height, p)} {p.heightUnit} {f.tide.trend?.toLowerCase()} <span className="fine">SF station</span></> : <span className="fine">No tide station nearby</span>}</dd>
                </dl>
                <button className="btn primary wide" onClick={() => go('forecast')}>Full forecast</button>
              </>}
            </div>
          )}
        </>}
      </aside>

      <div className="xlayers">
        <div className="xzoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Icon name="plus" size={18} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Icon name="minus" size={18} /></button></div>
        <button className="xlbtn" aria-label="Map layers" aria-expanded={layersOpen} aria-controls="xlcard" onClick={() => setLayersOpen(!layersOpen)}><Icon name="layers" size={20} /></button>
        {layersOpen && <div className="xlcard" id="xlcard" role="group" aria-label="Map layers"><LayerRows rows={cardRows} /></div>}
      </div>

      <div className="xcorner">
        <div className="xtools"><button aria-label="Center on selected spot" onClick={() => center(spot.id)}><Icon name="locate" size={18} /></button><button aria-label="Point forecast at the map centre" onClick={() => { const c = map.current!.getCenter(); setPt({lat: Math.round(c.lat * 10) / 10, lon: Math.round(c.lng * 10) / 10}); }}><Icon name="forecast" size={18} /></button></div>
        <div className="xlegend" aria-label={`${def.label} legend`}>
          {(frame || gframe) && opts.heat && <>
            <div className="xl-bar"><span>{unitLabel}</span>
              <div><i style={{background: `linear-gradient(90deg, ${RAMP.join(',')})`}} /><div>{ticks.map((t, k) => <small key={k}>{t}{k === ticks.length - 1 ? '+' : ''}</small>)}</div></div>
            </div>
          </>}
          <p className="xstatus" role="status" data-loading={spatial.loading || globe.loading ? 'true' : undefined}>{status}</p>
        </div>
      </div>

      <TimeCard times={times} index={ti} stamp={stamp} playing={playing} step={step} horizon={horizon} days={dayStarts}
        valueText={view.selectedTime ? `${weekdayPT(view.selectedTime)} ${hourLabel(view.selectedTime)}` : ''}
        onPlay={() => setPlaying(!playing)} onStep={(d) => { setPlaying(false); stepBy(d); }} onRange={setStep}
        onHorizon={(d) => { setHorizon(d); const t0 = Date.parse(allTimes[0] ?? ''); if (view.selectedTime && Date.parse(view.selectedTime) > t0 + d * 864e5) view.selectTime([...allTimes].filter((t) => Date.parse(t) <= t0 + d * 864e5).pop()!); }}
        onScrub={(i) => { setPlaying(false); view.selectTime(times[i]); }} />
      {pt && createPortal(<PointCard pt={pt} state={point} time={view.selectedTime} p={p} pinned={!!pinned && pinned.lat === pt.lat && pinned.lon === pt.lon}
        onPin={() => setPinned(pinned && pinned.lat === pt.lat && pinned.lon === pt.lon ? null : pt)} onClose={() => setPt(null)} />, popupEl)}
    </div>
  );
}
