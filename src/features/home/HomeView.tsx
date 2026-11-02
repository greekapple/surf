import {useMemo} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {conditionWord} from '../../ui/Condition';
import {bestNearby, dashCard, type DashCard} from '../../services/homeDash';
import './home.css';

/** Spots shown, clearly labelled, when nothing is saved. Not a personal list. */
const POPULAR = ['spot-2', 'spot-0', 'spot-3'];
const MAX_CARDS = 12;

function RatingBar({c}: {c: DashCard['rating']}) {
  const color = BAND_COLOR[bandOf(c.category)];
  return (
    <span className="dc-rate" style={{'--band': color} as React.CSSProperties} aria-label={c.score === null ? 'No rating' : `${conditionWord(c.category)}, ${c.bars} of 5`}>
      <b>{c.score === null ? 'No rating' : conditionWord(c.category)}</b>
      <span className="dc-bar" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= c.bars ? 'on' : ''} />)}</span>
    </span>
  );
}

/** Home (T-047): a dashboard of your spots, then the best nearby right now. No hero and no greeting; every number carries its label. */
export function HomeView({go}: ViewProps) {
  const {data, now, spotOptions, view, setSpot, spot} = useSwello();
  const saved = data.state.favorites, personal = saved.length > 0, profile = data.state.profile;
  const bundle = view.ocean.bundle, ctx = useMemo(() => ({bundle, extrema: bundle?.extrema}), [bundle]);
  const ids = (personal ? saved : POPULAR).filter((id) => spotOptions.some((s) => s.id === id)).slice(0, MAX_CARDS);
  const cards = useMemo(() => ids.map((id) => dashCard(spotOptions.find((s) => s.id === id)!, view.mapRecords, now, profile, ctx)), [ids.join('|'), spotOptions, view.mapRecords, now, profile, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const refId = ids[0] ?? spot.id;
  const nearby = useMemo(() => bestNearby(spotOptions, view.mapRecords, now, profile, refId, {exclude: ids, limit: 5, ctx}), [ids.join('|'), refId, spotOptions, view.mapRecords, now, profile, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: string) => (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); setSpot(id); go('forecast'); };
  const refName = spotOptions.find((s) => s.id === refId)?.name ?? '';
  return (
    <div className="home">
      <section className="hd" aria-labelledby="hd-h">
        <header className="hd-head">
          <h1 id="hd-h">{personal ? 'Your spots' : 'Popular spots'}</h1>
          {!personal && <p className="hd-note">Not personalised. <a href="/personal/spots" onClick={(e) => { e.preventDefault(); go('personal', 'spots'); }}>Choose favorite spots</a></p>}
        </header>
        {cards.length === 0 && <p className="hd-empty">No forecast data for your spots right now. Open the forecast to pick another.</p>}
        <ul className="dc-grid">
          {cards.map((c) => (
            <li key={c.id} className="dc" style={{'--band': BAND_COLOR[bandOf(c.rating.category)]} as React.CSSProperties}>
              <a className="dc-a" href="/forecast" onClick={open(c.id)} aria-label={`${c.name}, ${c.region}. ${c.surf.label}. ${c.rating.score === null ? 'No rating' : conditionWord(c.rating.category)}. Open forecast`}>
                <span className="dc-top"><span className="dc-name"><b>{c.name}</b><small>{c.region}</small></span><RatingBar c={c.rating} /></span>
                <span className="dc-surf">
                  <span className="dc-val">{c.surf.value}</span>
                  <span className="dc-words">{c.surf.words ?? ''}{c.surf.words && <em title="Body words are an informal convention for face height, shown as approximate"> ~</em>}</span>
                  <span className={'dc-tag ' + c.surf.tag.replace(/\s/g, '-')}>{c.surf.tag}</span>
                </span>
                <span className="dc-sub">{c.surf.headline.kind === 'estimate' ? (c.surf.offshoreLabel ?? c.surf.label) : c.surf.headline.kind === 'offshore' ? 'offshore · not surf size' : c.surf.headline.label}</span>
                <span className="dc-meta">
                  <span><i>Wind</i>{c.wind ? `${c.wind.label} · ${c.wind.relation}` : '—'}</span>
                  <span><i>Tide</i>{c.tide ? `${c.tide.state === 'unknown' ? 'trend unknown' : c.tide.state}${c.tide.label ? ` · ${c.tide.label}` : ''}` : '—'}</span>
                  <span><i>Best today</i>{c.window ? c.window.label : 'No good daylight window left'}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="hd" aria-labelledby="nb-h">
        <header className="hd-head"><h2 id="nb-h">Best right now nearby</h2>{refName && <p className="hd-note">Within 100 km of {refName}, ranked by the current rating</p>}</header>
        {nearby.length === 0
          ? <p className="hd-empty">No other rated spots within 100 km right now.</p>
          : <ol className="nb-list">
              {nearby.map(({card: c, km}) => (
                <li key={c.id} className="nb" style={{'--band': BAND_COLOR[bandOf(c.rating.category)]} as React.CSSProperties}>
                  <a className="nb-a" href="/forecast" onClick={open(c.id)} aria-label={`${c.name}, ${km} kilometres away. ${c.surf.label}. ${conditionWord(c.rating.category)}. Open forecast`}>
                    <span className="nb-name"><b>{c.name}</b><small>{c.region} · {km} km</small></span>
                    <span className="nb-surf"><span className="dc-val">{c.surf.value}</span><span className="dc-tag-sm">{c.surf.tag}</span></span>
                    <RatingBar c={c.rating} />
                  </a>
                </li>
              ))}
            </ol>}
        <p className="hd-fine">Ratings are provisional model scores. Surf heights are estimates of the breaking wave (or labelled offshore), not measurements.</p>
      </section>
    </div>
  );
}
