import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {useSpatial} from '../../hooks/useSpatial';
import {useGlobe} from '../../hooks/useGlobe';
import {evidenceSpots} from '../../ocean/spots';
import {allSpots as spots} from '../../data/catalog';
import {rateForecast} from '../../ratings/adapters';
import {GENERIC_PHOTOS, SPOT_PHOTOS} from '../../ui/photos';
import {StateMessage} from '../../ui/common';
import {DirArrow, Icon, type IconName} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, titleCase} from '../forecast/model';
import {compass, ht, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT} from '../forecast/format';
import {attachField, buildField, RAMP, RANGE, RANGE_WIDE} from '../../map/field';
import type {MapLayer, MapVariable} from '../../map/types';
import type {SpatialFrame} from '../../map/spatial';
import {CompareSpots} from './Compare';
import {FindSpots} from './FindSpots';
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
const thumb = (id: string, i = 0) => `/photos/${SPOT_PHOTOS[id]?.[0] ?? GENERIC_PHOTOS[i % GENERIC_PHOTOS.length]}-800.jpg`;
/** A spot's own photograph, or null: coast spots without one get a region tile rather than a misleading generic photo. */
const ownPhoto = (id: string) => (SPOT_PHOTOS[id]?.[0] ? `/photos/${SPOT_PHOTOS[id][0]}-800.jpg` : null);
const initials = (name: string) => name.replace(/[()’']/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function Thumb({id, name, region}: {id: string; name: string; region: string}) {
  const src = ownPhoto(id);
  return src ? <img src={src} alt="" loading="lazy" /> : <span className="xthumb" data-region={region} aria-hidden="true">{initials(name)}</span>;
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const chip = (c: string) => ({'--c': c}) as CSSProperties;

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
  const [tab, setTab] = useState<'spots' | 'conditions'>('spots');
  const [opts, setOpts] = useState({heat: true, flow: true, arrows: false, labels: true});
  // Floating search panel: open on desktop, collapsed to just the search box on phones.
  const [open, setOpen] = useState(() => typeof matchMedia !== 'function' || !matchMedia('(max-width: 860px)').matches);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(7);
  const wide = zoom < 5; // ocean-basin view uses the wider colour ramp
  const def = FIELDS.find((f) => f.id === fieldId)!;
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
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
  const times = view.timeline;
  const ti = Math.max(0, times.indexOf(view.selectedTime ?? ''));
  const recAt = (id: string) => view.mapRecords.find((r) => r.spotId === id && r.timestamp === view.selectedTime);

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const small = matchMedia('(max-width: 860px)').matches;
    const m = L.map(mapEl.current, {zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 14, zoomSnap: 0.5, worldCopyJump: true, maxBounds: [[-85, -540], [85, 540]], maxBoundsViscosity: 0.8}).setView(small ? [37.2, -121.9] : [36.9, -121.0], small ? 6 : 7);
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
    for (const e of evidenceSpots) {
      const f = recAt(e.id), rating = f ? rateForecast(surfSpot(e.id), f, now) : null;
      const color = rating ? BAND_COLOR[bandOf(rating.category)] : 'var(--none)';
      const label = opts.labels ? `<span class="xlabel"><b>${e.name}</b>${f ? `<small>${ht(f.offshore, p)} ${p.heightUnit}</small>` : ''}</span>` : '';
      const icon = L.divIcon({className: `xpin${e.id === spot.id ? ' sel' : ''}`, html: `<i style="--c:${color}"></i>${label}`, iconSize: [22, 22], iconAnchor: [11, 11]});
      L.marker([e.latitude, e.longitude], {icon, keyboard: true, title: e.name, alt: e.name, riseOnHover: true}).on('click', () => { setSpot(e.id); setTab('conditions'); }).addTo(g);
    }
  }, [view.mapRecords, view.selectedTime, spot.id, p.heightUnit, opts.labels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !times.length) return;
    const id = setInterval(() => { const i = times.indexOf(view.selectedTime ?? ''); view.selectTime(times[(i + 1) % times.length]); }, 900);
    return () => clearInterval(id);
  }, [playing, times, view]);

  const center = (id: string) => { const e = evidenceSpots.find((x) => x.id === id); if (e) map.current?.flyTo([e.latitude, e.longitude], Math.max(10, map.current.getZoom()), {duration: 0.8}); };
  const pickField = (id: FieldId) => { setFieldId(id); if (fieldSection[id] !== section) go('explore', fieldSection[id]); };
  const f = recAt(spot.id);
  const rating = f ? rateForecast(spot, f, now) : null;
  const list = [...evidenceSpots].sort((a, b) => b.latitude - a.latitude).filter((e) => !query || `${e.name} ${e.region}`.toLowerCase().includes(query.toLowerCase()));
  const status = !live ? 'Model layers need live data; the demonstration week shows spots only.'
    : spatial.loading && !frame ? 'Loading regional model…'
    : frame || gframe ? `${def.label} · ${def.layer === 'WIND' ? 'GFS' : 'WW3'} via NOAA ERDDAP · ${frame ? 'California 0.5°' : ''}${frame && gframe ? ' + ' : ''}${gframe ? 'global 2°' : ''} · valid ${weekdayPT((frame ?? gframe)!.validAt)} ${hourLabel((frame ?? gframe)!.validAt)}${spatial.loading || globe.loading ? ' · updating…' : ''}`
    : spatial.status;
  const ticks = frame || gframe ? legendTicks((frame ?? gframe)!.unit, p.heightUnit, p.windUnit, wide) : [];
  const unitLabel = def.unit === 'm' ? p.heightUnit : def.unit === 'm/s' ? p.windUnit : 's';
  const allDays = times.map((t, i) => ({t, i})).filter(({t}, k) => k === 0 || weekdayPT(t) !== weekdayPT(times[k - 1]));
  // A partial first day too short to hold its label is dropped; the readout still names the day.
  const dayStarts = allDays.filter((d, k) => k > 0 || !allDays[1] || allDays[1].i >= 10);
  const pct = (i: number) => `${times.length > 1 ? (i / (times.length - 1)) * 100 : 0}%`;

  const OPTS = [['heat', 'Colour field'], ['flow', 'Flow animation'], ['arrows', 'Direction arrows'], ['labels', 'Spot labels']] as const;

  return (
    <div className="xmap on-dark">
      <div ref={mapEl} className="xleaf" role="application" aria-label="Ocean map. Drag to pan; use the zoom buttons or scroll to zoom." />

      <aside className={`xside${open ? '' : ' closed'}`} aria-label="Spots and conditions">
        <div className="xsearch">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search spots" value={query} aria-label="Search spots"
            onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setTab('spots'); setOpen(true); }} />
          <button className="xcollapse" aria-expanded={open} aria-label={open ? 'Collapse spot list' : 'Expand spot list'} onClick={() => setOpen(!open)}><Icon name="chevron" size={16} /></button>
        </div>
        {open && <>
          <div className="xtabs" role="tablist" aria-label="Panel">
            {(['spots', 'conditions'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{titleCase(t)}</button>)}
          </div>
          {tab === 'spots' && (
            <div className="xlist" role="tabpanel" aria-label="Spots">
              {list.length === 0 && <p className="fine">No spot matches “{query}”.</p>}
              <ul>{list.map((e, i) => {
                const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null;
                const head = i === 0 || list[i - 1].region !== e.region ? <p className="xregion">{e.region}</p> : null;
                return <li key={e.id}>{head}<button aria-current={e.id === spot.id} onClick={() => { setSpot(e.id); center(e.id); setTab('conditions'); }}>
                  <i className="xdot" style={{background: rt ? BAND_COLOR[bandOf(rt.category)] : 'var(--none)'}} aria-hidden="true" />
                  <b>{e.name}</b>
                  <small>{r ? `${ht(r.offshore, p)} ${p.heightUnit}` : '—'}</small>
                  {rt && <span className="sr">{titleCase(rt.category)}</span>}
                </button></li>;
              })}</ul>
              {!live && <p className="fine">The demonstration week shows spots only. <a href="/explore/discover" onClick={(ev) => { ev.preventDefault(); go('explore', 'discover'); }}>Discover Spots</a></p>}
            </div>
          )}
          {tab === 'conditions' && (
            <div className="xcond" role="tabpanel" aria-label="Conditions">
              <div className={`xc-photo${ownPhoto(spot.id) ? '' : ' plain'}`} style={ownPhoto(spot.id) ? {backgroundImage: `url(${ownPhoto(spot.id)})`} : undefined}><h2>{spot.name}</h2><span>{spot.region}{spot.character === 'Generic profile' ? ' · generic spot profile' : ''}</span></div>
              {!f ? <StateMessage title="No record at this hour" /> : <>
                <p className="xc-big">{ht(f.offshore, p)}<small>{p.heightUnit} offshore</small>{rating && <em className="xc-rate"><i style={{background: BAND_COLOR[bandOf(rating.category)]}} />{titleCase(rating.category)}</em>}</p>
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
        <div role="group" aria-label="Map layers">
          {FIELDS.map((x) => <button key={x.id} className="xround" data-label={x.label} aria-label={x.label} aria-pressed={fieldId === x.id} onClick={() => pickField(x.id)}><Icon name={x.icon} size={20} /></button>)}
        </div>
        <button className="xround" data-label="Display options" aria-label="Display options" aria-expanded={more} aria-controls="xopts" onClick={() => setMore(!more)}><Icon name="layers" size={20} /></button>
        {more && <div className="xopts" id="xopts">
          {OPTS.map(([k, l]) => (
            <label key={k} className="xswitch"><span>{l}</span><input type="checkbox" role="switch" checked={opts[k]} onChange={() => setOpts({...opts, [k]: !opts[k]})} /><i /></label>
          ))}
        </div>}
      </div>

      <div className="xcorner">
        <div className="xzoom"><button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Icon name="plus" size={18} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Icon name="minus" size={18} /></button><button aria-label="Center on selected spot" onClick={() => center(spot.id)}><Icon name="locate" size={18} /></button></div>
        <div className="xlegend" aria-label={`${def.label} legend`}>
          {(frame || gframe) && opts.heat && <>
            <div className="xl-bar"><span>{unitLabel}</span>
              <div><i style={{background: `linear-gradient(90deg, ${RAMP.join(',')})`}} /><div>{ticks.map((t, k) => <small key={k}>{t}{k === ticks.length - 1 ? '+' : ''}</small>)}</div></div>
            </div>
          </>}
          <p className="xstatus" role="status">{status}</p>
        </div>
      </div>

      <div className="xtime">
        <button className="xplay" aria-label={playing ? 'Pause' : 'Play forecast'} aria-pressed={playing} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : 'play'} size={16} /></button>
        <b className="xt-now">{view.selectedTime ? <>{weekdayPT(view.selectedTime)} {dayNumPT(view.selectedTime)}<span> · {hourLabel(view.selectedTime)}</span></> : '—'}</b>
        <div className="xtrack">
          <div className="xt-days" aria-hidden="true">{dayStarts.map(({t, i}) => <span key={t} style={{left: pct(i)}}>{weekdayPT(t)}<em> {dayNumPT(t)}</em></span>)}</div>
          <input type="range" min={0} max={Math.max(0, times.length - 1)} value={ti} aria-label="Forecast hour"
            aria-valuetext={view.selectedTime ? `${weekdayPT(view.selectedTime)} ${hourLabel(view.selectedTime)}` : ''}
            style={{'--pct': pct(ti)} as CSSProperties}
            onChange={(e) => { setPlaying(false); view.selectTime(times[Number(e.target.value)]); }} />
        </div>
      </div>
    </div>
  );
}
