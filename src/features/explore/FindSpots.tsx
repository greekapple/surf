import {mapZone} from '../../ocean/spotZone';
import {conditionWord} from '../../ui/Condition';
import {useEffect, useMemo, useState, type CSSProperties} from 'react';
import {nearPoint} from '../../ocean/spotScope';
import {hourFreshness} from '../../services/freshness';
import {StaleTag} from '../../ui/StaleTag';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {evidenceSpots} from '../../ocean/spots';
import {rateForecast} from '../../ratings/adapters';
import {Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf, hourLabel, type HourSample} from '../forecast/model';
import {compass, ht, windVal} from '../forecast/helpers';
import {bestWindowFrom} from '../../services/call';
import {headlineSurf} from '../../services/headlineSurf';
import {estimateLabel} from '../../services/headlineLabel';
import {weekdayPT} from '../forecast/format';

/** Distance bands, by how realistic a session is (straight-line miles; drive time is longer). */
const BANDS: [string, string, number][] = [['Close by', 'under 25 mi', 25], ['Short drive', '25–75 mi', 75], ['Day trip', '75–200 mi', 200], ['Road trip', 'over 200 mi', Infinity]];
const miles = (a: [number, number], b: [number, number]) => {
  const R = 3958.8, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
type Anchor = {lat: number; lon: number; label: string; kind: 'location' | 'region' | 'spot'};

/** Find spots around you: where you are (or your home region), then what is worth the trip right now. */
export function FindSpots({go}: {go: ViewProps['go']}) {
  const {view, data, spot, spotOptions, setSpot, now, requestSpots} = useSwello();
  const p = data.state.profile, fav = data.state.favorites;
  const [geo, setGeo] = useState<{lat: number; lon: number} | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'denied' | 'unavailable'>('idle');
  const [expanded, setExpanded] = useState<string[]>([]);
  const home = useMemo(() => {
    const inRegion = evidenceSpots.filter((e) => e.region === p.region);
    return inRegion.length ? {lat: inRegion.reduce((a, e) => a + e.latitude, 0) / inRegion.length, lon: inRegion.reduce((a, e) => a + e.longitude, 0) / inRegion.length} : null;
  }, [p.region]);
  const sel = evidenceSpots.find((e) => e.id === spot.id);
  const anchor: Anchor | null = geo ? {...geo, label: 'your location', kind: 'location'} : home ? {...home, label: p.region, kind: 'region'} : sel ? {lat: sel.latitude, lon: sel.longitude, label: sel.name, kind: 'spot'} : null;
  const locate = () => {
    if (!('geolocation' in navigator)) { setGeoState('unavailable'); return; }
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition((pos) => { setGeo({lat: pos.coords.latitude, lon: pos.coords.longitude}); setGeoState('idle'); }, (e) => setGeoState(e.code === 1 ? 'denied' : 'unavailable'), {timeout: 10000, maximumAge: 600000});
  };

  const rows = useMemo(() => {
    return spotOptions.flatMap((s) => {
      const e = evidenceSpots.find((x) => x.id === s.id);
      if (!e) return [];
      const recs = view.mapRecords.filter((r) => r.spotId === s.id);
      const f = recs.find((r) => r.timestamp === view.selectedTime) ?? null;
      const rating = f ? rateForecast(s, f, now) : null;
      const best = bestWindowFrom(s, p, {records: recs, bundle: view.ocean.bundle, nowMs: now}, now); // T-108: the call's best window, same as the spot page
      const pending = !view.ocean.isSpotLoaded(s.id), dist = anchor ? miles([anchor.lat, anchor.lon], [e.latitude, e.longitude]) : Infinity;
      const est = f ? estimateLabel(headlineSurf(s.id, f, {bundle: view.ocean.bundle, nowMs: now}), p) : null; // T-112: the surf estimate where one exists, like the spot page and Compare
      return [{s, e, f, rating, best, dist, est, pending}];
    });
  }, [spotOptions, view.mapRecords, view.selectedTime, view.ocean.bundle, p, now, anchor?.lat, anchor?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // subset loading: ask for the spots around the anchor (the selection, the home region or the user's location can be far from what is already loaded); unloaded ones are never ranked
  const aroundKey = anchor ? `${anchor.lat.toFixed(2)},${anchor.lon.toFixed(2)}` : '';
  useEffect(() => { if (anchor) requestSpots(nearPoint(anchor.lat, anchor.lon)); }, [aroundKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadingN = anchor ? rows.filter((r) => r.pending && r.dist < 75).length : 0;
  const score = (r: (typeof rows)[number]) => r.rating?.score ?? -1;
  const bets = rows.filter((r) => r.dist < 75 && !r.pending && r.rating && !r.rating.dark && r.rating.category !== 'POOR').sort((a, b) => score(b) - score(a)).slice(0, 3);   // never a best bet after dark; unloaded spots are never ranked
  const open = (id: string, where: 'forecast' | 'explore') => { setSpot(id); go(where); };

  const Card = ({r, big}: {r: (typeof rows)[number]; big?: boolean}) => (
    <li className={`fs-row${big ? ' big' : ''}`}>
      <i className="fs-bar" style={{background: r.rating ? BAND_COLOR[bandOf(r.rating.category)] : 'var(--none)'}} />
      <button className="fs-main" onClick={() => open(r.s.id, 'forecast')}>
        <span className="fs-name"><b>{r.s.name}</b><small>{r.s.region}{Number.isFinite(r.dist) ? ` · ${Math.round(r.dist)} mi` : ''}</small></span>
        <span className="fs-hs">{r.f && r.est ? <span title={`${r.est.tag} · ${r.est.detail}`}>{r.est.value}<small> {r.est.suffix}{r.est.tuned ? ` · ${r.est.tuned}` : ''}{r.est.confidenceText ? ` · ${r.est.confidenceText}` : ''}</small><span className="sr-only">: {r.est.tag}. {r.est.confidenceText}. {r.est.detail}</span></span> : r.f ? <>{ht(r.f.offshore, p)}<small> {p.heightUnit} offshore</small></> : '—'}</span>
        <span className="fs-rate">{r.rating ? <em style={{'--c': BAND_COLOR[bandOf(r.rating.category)]} as CSSProperties}>{conditionWord(r.rating.category)}</em> : <small>no record</small>}</span>
        <span className="fs-meta">{r.f?.primary ? `${Math.round(r.f.primary.period)} s ${compass(r.f.primary.direction)}` : ''}{r.f && Number.isFinite(r.f.wind.speed) ? ` · wind ${windVal(r.f.wind.speed, p)} ${p.windUnit}` : ''}{r.f && Number.isFinite(r.f.wind.speed) && <StaleTag s={hourFreshness(r.f, now).wind} />}</span>
        <span className="fs-best">{r.best ? `Best ${r.best.when} ${r.best.label}` : ''}</span>
      </button>
      <button className="star" aria-pressed={fav.includes(r.s.id)} aria-label={`${fav.includes(r.s.id) ? 'Remove' : 'Save'} ${r.s.name}`} onClick={() => data.favorite(r.s.id)}><Icon name="star" size={17} /></button>
      <button className="iconbtn" aria-label={`${r.s.name} on the map`} onClick={() => open(r.s.id, 'explore')}><Icon name="explore" size={17} /></button>
    </li>
  );

  return (
    <div className="fs">
      <header className="fs-h">
        <div>
          <h1>Find spots</h1>
          <p>{anchor ? <>Around <b>{anchor.label}</b>, sorted by how far and how good it is at {view.selectedTime ? `${weekdayPT(view.selectedTime, mapZone())} ${hourLabel(view.selectedTime, mapZone())}` : 'the selected hour'}.</> : 'Choose where you are to see spots by distance.'}</p>
        </div>
        <div className="fs-loc">
          <button className="btn" onClick={locate} disabled={geoState === 'asking'}><Icon name="locate" size={16} />{geoState === 'asking' ? 'Locating…' : geo ? 'Update my location' : 'Use my location'}</button>
          {geoState === 'denied' && <span className="fine">Location permission was declined. Set a home region in Personal instead.</span>}
          {geoState === 'unavailable' && <span className="fine">Location is unavailable in this browser.</span>}
          {!geo && !home && <button className="btn" onClick={() => go('personal', '')}>Set home region</button>}
        </div>
      </header>

      {loadingN > 0 && <p className="fine" role="status">{loadingN} nearby spot{loadingN === 1 ? ' is' : 's are'} still loading: best bets rank only the spots that have loaded.</p>}
      {bets.length > 0 && (
        <section aria-labelledby="fs-bets">
          <h2 id="fs-bets" className="fs-sh">Best bets nearby <span>within 75 mi · provisional ratings</span></h2>
          <ol className="fs-list fs-bets">{bets.map((r) => <Card key={r.s.id} r={r} big />)}</ol>
        </section>
      )}

      {BANDS.map(([name, range, max], k) => {
        const min = k ? BANDS[k - 1][2] : -1;
        const list = rows.filter((r) => r.dist > min && r.dist <= max).sort((a, b) => score(b) - score(a) || a.dist - b.dist);
        if (!list.length) return null;
        return (
          <section key={name} aria-labelledby={`fs-${k}`}>
            <h2 id={`fs-${k}`} className="fs-sh">{name} <span>{range} · {list.length} {list.length === 1 ? 'spot' : 'spots'}</span></h2>
            <ol className="fs-list">{(expanded.includes(name) ? list : list.slice(0, 6)).map((r) => <Card key={r.s.id} r={r} />)}</ol>
            {list.length > 6 && !expanded.includes(name) && <button className="btn fs-more" onClick={() => setExpanded([...expanded, name])}>Show all {list.length}</button>}
          </section>
        );
      })}
      <p className="fine">Distances are straight-line from {anchor?.label ?? 'the selected spot'}, not driving distance. Heights are the surf estimate where one exists (est.), otherwise the offshore model value, labelled offshore (not surf size); ratings are provisional.</p>
    </div>
  );
}
