import {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {useSpatial} from '../../hooks/useSpatial';
import {evidenceSpots} from '../../ocean/spots';
import {spots} from '../../data/demo';
import {rateForecast} from '../../ratings/adapters';
import {CameraPanel, StateMessage} from '../../ui/common';
import {DirArrow, Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, titleCase} from '../forecast/model';
import {compass, ht, windColor, windVal} from '../forecast/helpers';
import {weekdayPT, dayNumPT} from '../forecast/format';

type Layer = 'none' | 'WAVES' | 'WIND';
/** Offshore Hs (metres) to a blue→sand→coral scale. */
const hsColor = (m: number) => {
  const t = Math.max(0, Math.min(1, m / 0.3048 / 16));
  const stops = [[30, 70, 140], [61, 142, 199], [140, 207, 255], [230, 210, 120], [235, 120, 80]];
  const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return `rgb(${stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f)).join(',')})`;
};
const surfSpot = (id: string) => spots.find((s) => s.id === id)!;

export function ExploreView({section, go}: ViewProps) {
  const {view, data, spot, setSpot, now, live} = useSwello();
  const p = data.state.profile;
  const [layer, setLayer] = useState<Layer>(section === 'wind' ? 'WIND' : section === 'swell' ? 'WAVES' : 'none');
  useEffect(() => { if (section === 'wind') setLayer('WIND'); else if (section === 'swell') setLayer('WAVES'); }, [section]);
  const [playing, setPlaying] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const grid = useRef<L.LayerGroup | null>(null);
  const spatial = useSpatial(layer === 'WIND' ? 'WIND' : 'WAVES', layer === 'WIND' ? 'Speed' : 'Offshore Hs', view.selectedTime, false, live && layer !== 'none');
  const times = view.timeline;
  const ti = Math.max(0, times.indexOf(view.selectedTime ?? ''));
  const recAt = (id: string) => view.mapRecords.find((r) => r.spotId === id && r.timestamp === view.selectedTime);

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, {zoomControl: true, preferCanvas: true}).setView([37.75, -122.62], 10);
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 16, attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    grid.current = L.layerGroup().addTo(m);
    pins.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  // Spot pins coloured by the provisional rating at the shared hour.
  useEffect(() => {
    const g = pins.current;
    if (!g) return;
    g.clearLayers();
    for (const e of evidenceSpots) {
      const f = recAt(e.id);
      const rating = f ? rateForecast(surfSpot(e.id), f, now) : null;
      const icon = L.divIcon({className: `spotpin${e.id === spot.id ? ' sel' : ''}`, html: `<i style="background:${rating ? BAND_COLOR[bandOf(rating.category)] : '#2a343c'}"></i>`, iconSize: [26, 26]});
      L.marker([e.latitude, e.longitude], {icon, keyboard: true, title: e.name, alt: e.name})
        .bindTooltip(`${e.name} · ${f ? `${ht(f.offshore, p)} ${p.heightUnit} Hs` : 'no record'}`, {permanent: true, direction: 'right', offset: [12, 0], className: 'pinlabel'})
        .on('click', () => setSpot(e.id)).addTo(g);
    }
  }, [view.mapRecords, view.selectedTime, spot.id, p.heightUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only genuine regional grid cells are drawn; nothing appears when the service has no frame.
  useEffect(() => {
    const g = grid.current;
    if (!g) return;
    g.clearLayers();
    const frame = spatial.frame;
    if (!frame || layer === 'none') return;
    const r = frame.resolution / 2;
    for (const c of frame.cells) {
      if (c.value === null) continue;
      const color = layer === 'WIND' ? windColor(c.value * 2.23694) : hsColor(c.value);
      L.rectangle([[c.lat - r, c.lon - r], [c.lat + r, c.lon + r]], {stroke: false, fillColor: color, fillOpacity: 0.42, interactive: false}).addTo(g);
    }
  }, [spatial.frame, layer]);

  useEffect(() => {
    if (!playing || !times.length) return;
    const id = setInterval(() => { const i = times.indexOf(view.selectedTime ?? ''); view.selectTime(times[(i + 1) % times.length]); }, 600);
    return () => clearInterval(id);
  }, [playing, times, view]);

  const f = recAt(spot.id);
  const rating = f ? rateForecast(spot, f, now) : null;
  const center = (id: string) => { const e = evidenceSpots.find((x) => x.id === id); if (e) map.current?.flyTo([e.latitude, e.longitude], 11, {duration: 0.6}); };
  const gridStatus = !live ? 'Regional grids are not part of the demonstration week.' : spatial.loading ? 'Loading regional model grid…'
    : spatial.frame ? `${layer === 'WIND' ? 'Wind speed' : 'Offshore Hs'} · ${spatial.frame.provider} · ${spatial.frame.resolution}° grid · valid ${weekdayPT(spatial.frame.validAt)} ${hourLabel(spatial.frame.validAt)}${spatial.frame.delivery === 'saved' ? ' · saved snapshot' : ''}` : spatial.status;

  return (
    <div className="explore">
      <div style={{display: 'grid', gap: 10, minWidth: 0}}>
        <div className="mapbox">
          <div ref={mapEl} style={{width: '100%', height: '100%'}} role="application" aria-label="Map of surf spots. Drag to pan; use plus and minus or scroll to zoom." />
          <div className="map-layers">
            <div className="seg" role="radiogroup" aria-label="Map layer">
              {(['none', 'WAVES', 'WIND'] as Layer[]).map((l) => <button key={l} role="radio" aria-checked={layer === l} onClick={() => setLayer(l)}>{l === 'none' ? 'Spots' : l === 'WAVES' ? 'Swell grid' : 'Wind grid'}</button>)}
            </div>
          </div>
          {layer !== 'none' && <p className="map-status" role="status">{gridStatus}</p>}
        </div>
        <div className="card" style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <button className="btn" aria-pressed={playing} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'close' : 'play'} size={16} />{playing ? 'Pause' : 'Play'}</button>
          <input type="range" min={0} max={Math.max(0, times.length - 1)} value={ti} style={{flex: 1, accentColor: 'var(--accent)'}} aria-label="Forecast hour"
            aria-valuetext={view.selectedTime ? `${weekdayPT(view.selectedTime)} ${hourLabel(view.selectedTime)}` : ''}
            onChange={(e) => { setPlaying(false); view.selectTime(times[Number(e.target.value)]); }} />
          <span style={{minWidth: 110, textAlign: 'right'}}>{view.selectedTime ? `${weekdayPT(view.selectedTime)} ${dayNumPT(view.selectedTime)}, ${hourLabel(view.selectedTime)}` : '—'}</span>
        </div>
      </div>

      <aside className="side">
        <section className="card" aria-label="Selected spot">
          <div className="card-h"><h2>{spot.name}</h2><span>{spot.region}</span></div>
          {!f ? <StateMessage title="No record at this hour" /> : (
            <div style={{display: 'grid', gap: 10}}>
              <p className="num" style={{fontSize: 44}}>{ht(f.offshore, p)}<small>{p.heightUnit} offshore Hs</small></p>
              {rating && <p><span className="qdot" style={{background: BAND_COLOR[bandOf(rating.category)]}} /> <b>{titleCase(rating.category)}</b> <span className="fine">{rating.score ?? ''} · provisional · reliability {rating.reliability.category.toLowerCase()}</span></p>}
              <dl className="kv">
                <dt>Swell</dt><dd>{f.primary ? <><DirArrow from={f.primary.direction} size={13} /> {ht(f.primary.height, p)} {p.heightUnit} · {Math.round(f.primary.period)} s {compass(f.primary.direction)}</> : '—'}</dd>
                <dt>Wind</dt><dd>{Number.isFinite(f.wind.direction) ? <><DirArrow from={f.wind.direction} size={13} color={windColor(f.wind.speed)} /> {windVal(f.wind.speed, p)} {p.windUnit} {compass(f.wind.direction)}</> : '—'}</dd>
                <dt>Tide</dt><dd>{ht(f.tide.height, p)} {p.heightUnit} {f.tide.trend?.toLowerCase()} · regional</dd>
              </dl>
              <div style={{display: 'flex', gap: 8}}><button className="btn primary" onClick={() => go('forecast')}>Open forecast</button><button className="btn" onClick={() => center(spot.id)}>Center map</button></div>
            </div>
          )}
        </section>
        <section className="card" aria-label="Discover spots">
          <div className="card-h"><h2>{section === 'discover' ? 'Discover spots' : 'Spots'}</h2><span>at {view.selectedTime ? hourLabel(view.selectedTime) : '—'}</span></div>
          <ul className="windows">{evidenceSpots.map((e) => {
            const r = recAt(e.id), rt = r ? rateForecast(surfSpot(e.id), r, now) : null;
            return <li key={e.id}><button aria-current={e.id === spot.id} onClick={() => { setSpot(e.id); center(e.id); }}>
              <span><b>{e.name}</b> <small>{e.region}{e.breakType ? ` · ${e.breakType.toLowerCase()}` : ''}</small></span>
              <span>{r ? `${ht(r.offshore, p)} ${p.heightUnit}` : '—'}</span>
              <small>{rt ? `${titleCase(rt.category)} · provisional` : 'no record'}</small>
            </button></li>;
          })}</ul>
          {!live && <p className="fine" style={{marginTop: 8}}>The demonstration week includes more illustrative spots; only spots with real coordinates appear on the map.</p>}
        </section>
        <CameraPanel spotName={spot.name} />
      </aside>
    </div>
  );
}
