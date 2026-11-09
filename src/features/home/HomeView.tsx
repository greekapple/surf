import {fmtIn} from '../../ocean/time';
import {timeZoneOf} from '../../ocean/spotZone';
import {useMemo} from 'react';
import {isFlat, nowcastNearby, NOWCAST_NEARBY_TEXT} from '../../services/flatSurf';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {conditionWord} from '../../ui/Condition';
import {bestNearbyAt, dashCard, ribbon12, rankLabel, type DashCard, type RankWhen, type RibbonHour} from '../../services/homeDash';
import {SurfSpark, sparkPoints} from './SurfSpark';
import {useState} from 'react';
import {dataPhase} from '../../services/dataPhase';
import {transferTag} from '../../services/headlineSurf';
import {CallBar} from '../forecast/Trust';
import {WeekGrid} from './WeekGrid';
import {HORIZON_DAYS_TEXT} from '../../services/certainty';
import {Welcome} from './Welcome';
import {evidenceSpots} from '../../ocean/spots';
import {callFor, isDark} from '../forecast/trustApi';
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

const hourShortIn = (iso: string, tz: string) => fmtIn(tz, {hour: 'numeric'}).format(new Date(iso)); // in the zone of the spot the card shows
/** The next 12 hours of the existing rating as a mini bar ribbon; an hour without a record is a gap, never a guess. */
function Ribbon({hours, name, tz}: {hours: RibbonHour[]; name: string; tz: string}) {
  const hourShort = (iso: string) => hourShortIn(iso, tz);
  const have = hours.filter((h) => h.score !== null);
  return (
    <div className="dc-ribbon" role="img" aria-label={have.length ? `${name}: rating for the next 12 hours, ${hourShort(hours[0].iso)} to ${hourShort(hours[11].iso)}. ${have.map((h) => `${hourShort(h.iso)} ${conditionWord(h.category!)}${(h as {dark?: boolean}).dark ? ', after dark' : ''}`).join(', ')}` : `${name}: no rating hours available`}>
      <span className="dc-rb-bars">{hours.map((h) => <i key={h.iso} title={h.score === null ? `${hourShort(h.iso)}: no data` : `${hourShort(h.iso)}: ${conditionWord(h.category!)} (${Math.round(h.score)})${(h as {dark?: boolean}).dark ? ', after dark' : ''}`} style={{'--b': h.score === null ? 'var(--line-2)' : BAND_COLOR[bandOf(h.category!)], height: h.score === null ? '4px' : `${6 + Math.round((h.score / 100) * 22)}px`} as React.CSSProperties} />)}</span>
      <span className="dc-rb-axis" aria-hidden="true"><span>Now</span><span>{hourShort(hours[4].iso)}</span><span>{hourShort(hours[8].iso)}</span><span>{hourShort(hours[11].iso)}</span></span>
    </div>
  );
}

/** Home (T-047, T-051; T-106 six items: name, rating, number, line, wind · tide, the call's window; T-119: the line is the 7-day surf estimate), a 12-hour rating ribbon on hover or tap, and a ranking you can move in time. */
export function HomeView({go}: ViewProps) {
  const {data, now, spotOptions, view, setSpot, spot, spreadV} = useSwello();
  const saved = data.state.favorites, personal = saved.length > 0, profile = data.state.profile;
  const bundle = view.ocean.bundle, ctx = useMemo(() => ({bundle, extrema: bundle?.extrema, spreadV}), [bundle, spreadV]); // spreadV: a wave-model spread arrived, so the ranges are recomputed
  const ids = (personal ? saved : POPULAR).filter((id) => spotOptions.some((s) => s.id === id)).slice(0, MAX_CARDS);
  const cards = useMemo(() => ids.map((id) => dashCard(spotOptions.find((s) => s.id === id)!, view.mapRecords, now, profile, ctx)), [ids.join('|'), spotOptions, view.mapRecords, now, profile, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const ribbons = useMemo(() => Object.fromEntries(ids.map((id) => [id, ribbon12(spotOptions.find((s) => s.id === id)!, view.mapRecords, now)])), [ids.join('|'), spotOptions, view.mapRecords, now]); // eslint-disable-line react-hooks/exhaustive-deps
  // Skeletons while the first retrieval is in flight; "No forecast data" only after it has actually failed (T-055).
  const phase = dataPhase(view.ocean), waiting = phase === 'loading';
  const refId = ids[0] ?? spot.id;
  // T-082: after dark the nearby ranking opens on tomorrow morning (the next time you could surf); "Now" still rates the dark hour.
  const [when, setWhen] = useState<RankWhen>(() => (isDark(refId, new Date(now).toISOString()) ? 'tomorrow-am' : 'now')), [openId, setOpenId] = useState<string | null>(null);
  const nearby = useMemo(() => bestNearbyAt(spotOptions, view.mapRecords, now, profile, refId, when, {exclude: ids, limit: 3, ctx}), [ids.join('|'), refId, when, spotOptions, view.mapRecords, now, profile, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  // T-065: the call for a card's own hour, from the same records (the verdict + window; the reasons are on the spot page).
  const callOf = (id: string, validTime: string | null) => {
    const sp = spotOptions.find((x) => x.id === id), rec = validTime ? view.mapRecords.find((f) => f.spotId === id && f.timestamp === validTime) : undefined;
    return sp && rec ? callFor(sp, rec, profile, {records: view.mapRecords, bundle, nowMs: now}) : null;
  };
  /** The same kind of number everywhere: the surf estimate, or a muted line when only offshore height exists (never styled as surf). */
  const surfOf = (c: DashCard, small = false) => c.surf.headline.kind === 'offshore'
    ? <span className="dc-na">Surf est. unavailable · offshore {c.surf.value}</span>
    : <><span className="dc-val">{c.surf.value}</span>{!small && <span className="dc-words">{c.surf.words ?? ''}{c.surf.words && <em title="Body words are an informal convention for face height, shown as approximate"> ~</em>}</span>}<span className={small ? 'dc-tag-sm' : 'dc-tag ' + c.surf.tag.replace(/\s/g, '-')}>{isFlat(c.surf.headline) ? `(${c.surf.tag})` : c.surf.tag}</span>{!small && c.surf.tuned && <span className="dc-conf"> · {c.surf.tuned}</span>}{!small && transferTag(c.surf.headline) && <span className="dc-conf" title={c.surf.headline.kind === 'estimate' ? c.surf.headline.transfer?.text : undefined}> · {transferTag(c.surf.headline)}</span>}{!small && nowcastNearby(c.surf.headline) && <span className="dc-conf" title={nowcastNearby(c.surf.headline)!.source}> · {NOWCAST_NEARBY_TEXT}</span>}{!small && c.surf.confidenceText && <span className="dc-conf" title={c.surf.confidenceDetail}> · {c.surf.confidenceText}</span>}</>;
  const open = (id: string) => (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); setSpot(id); go('forecast'); };
  const refName = spotOptions.find((s) => s.id === refId)?.name ?? '';
  const WHENS: RankWhen[] = ['now', '3h', 'tomorrow-am'];
  const onWhenKey = (e: React.KeyboardEvent) => { const i = WHENS.indexOf(when), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = WHENS[(i + d + WHENS.length) % WHENS.length]; setWhen(n); (e.currentTarget.children[WHENS.indexOf(n)] as HTMLElement | undefined)?.focus(); };
  const at = (iso: string, id: string) => fmtIn(timeZoneOf(id), {weekday: 'short', hour: 'numeric'}).format(new Date(iso));
  // T-106: the card's drawing, from the SAME headline as its number (period and est. breaker type from that hour's record).
  // T-119: each card's small undulating 7-day surf-height line (the user's "lines that undulate"), in place of T-106's wave-beside-a-person drawing.
  const sparkOf = (c: DashCard) => sparkPoints(c.id, view.mapRecords, now, bundle);
  return (
    <div className="home">
      {!waiting && (() => {
        // T-067: the week at a glance, saved (or popular) spots first, then the nearest others, up to 8 rows.
        const ref = evidenceSpots.find((e) => e.id === refId);
        const near = ref ? evidenceSpots.filter((e) => !ids.includes(e.id) && spotOptions.some((x) => x.id === e.id)).map((e) => ({id: e.id, d: Math.hypot(e.latitude - ref.latitude, (e.longitude - ref.longitude) * 0.8)})).sort((a, b) => a.d - b.d).map((x) => x.id) : [];
        const pool = [...ids, ...near.slice(0, Math.max(0, 12 - ids.length))].map((id) => spotOptions.find((x) => x.id === id)!).filter(Boolean); // greeting: every saved spot + nearest others
        const rowSpots = pool.slice(0, 5); // the grid: 5 rows (T-082: Home within two screens), saved first, nearest by distance (not rating: the grid is a fixed list, not a ranking)
        const openAt = (id: string, iso: string | null) => { setSpot(id); if (iso) view.selectTime(iso); go('forecast'); };
        return (<>
          {/* T-074: the greeting and the day's answer, the best spot's photo, today at a glance and the quiver's pick. */}
          <Welcome name={profile.displayName ?? null} spots={pool} refSpot={rowSpots[0] ?? spot} records={view.mapRecords} profile={profile} bundle={bundle} extrema={bundle?.extrema}
            boards={data.state.boards} nowMs={now} onOpen={openAt} stationTides={view.ocean.bundle?.stationTides} />
          <section className="wk-s" aria-labelledby="wk-h">
            <header className="hd-head"><h2 id="wk-h">This week</h2><p className="hd-note">Surf estimate at midday by day, the AM, midday and PM rating under it, and <span className="wk-key" aria-hidden="true" />the shape of the midday size through the week. <span className="wk-key wk-key-hatch" aria-hidden="true" />Hatched: less certain, or too far out past {HORIZON_DAYS_TEXT}. Tap a day for every hour</p></header>
            <WeekGrid spots={rowSpots} records={view.mapRecords} nowMs={now} profile={profile} bundle={bundle} unit={profile.heightUnit} onOpen={openAt} />
          </section>
        </>);
      })()}
      <section className="hd" aria-labelledby="hd-h">
        <header className="hd-head">
          <h2 id="hd-h">{personal ? 'Your spots' : 'Popular spots'}</h2>
          {!personal && <p className="hd-note">Not personalised. <a href="/personal/spots" onClick={(e) => { e.preventDefault(); go('personal', 'spots'); }}>Choose favorite spots</a></p>}
        </header>
        {waiting && <ul className="dc-grid" aria-busy="true" aria-label="Loading your spots">{(ids.length ? ids : POPULAR).slice(0, 3).map((id) => <li key={id} className="dsk" aria-hidden="true"><i className="sk-ph" /><span className="dc-body"><i className="sk-l w50" /><i className="sk-l w70" /><i className="sk-l w90" /></span></li>)}</ul>}
        {!waiting && cards.length === 0 && <p className="hd-empty">No forecast data for your spots right now. Open the forecast to pick another.</p>}
        {!waiting && <ul className="dc-grid">
          {cards.map((c) => { const sp = sparkOf(c), k = callOf(c.id, c.validTime); return (
            <li key={c.id} className={'dc' + (openId === c.id ? ' is-open' : '')} style={{'--band': BAND_COLOR[bandOf(c.rating.category)]} as React.CSSProperties}>
              <a className="dc-a" href="/forecast" onClick={open(c.id)} aria-label={`${c.name}, ${c.region}. ${c.surf.label}. ${c.rating.score === null ? 'No rating' : conditionWord(c.rating.category)}. Open forecast`}>
                <span className="dc-body">
                  <span className="dc-top"><span className="dc-name"><b title={c.region}>{c.name}</b></span><RatingBar c={c.rating} /></span>
                  <span className="dc-mid">
                    <SurfSpark points={sp} p={profile} />
                    <span className="dc-surf">{surfOf(c, true)}{c.surf.headline.kind !== 'estimate' && c.surf.headline.kind !== 'offshore' && <span className="dc-sub">{c.surf.headline.label}</span>}</span>
                  </span>
                  <span className="dc-line">{c.wind ? `Wind ${c.wind.label} · ${c.wind.relation}` : 'Wind —'} · {c.tide ? `Tide ${c.tide.state === 'unknown' ? 'trend unknown' : c.tide.state}` : 'Tide —'}</span>
                  {k ? <CallBar call={k} compact /> : <span className="dc-line">{c.window ? `Best today ${c.window.label}` : 'No good daylight window left'}</span>}
                </span>
              </a>
              <div className="dc-more">
                <button type="button" className="dc-rb-t" aria-expanded={openId === c.id} aria-controls={`rb-${c.id}`} onClick={() => setOpenId(openId === c.id ? null : c.id)}>Next 12 hours<span aria-hidden="true">{openId === c.id ? '–' : '+'}</span></button>
                <div id={`rb-${c.id}`} className="dc-rb"><Ribbon hours={ribbons[c.id]} name={c.name} tz={timeZoneOf(c.id)} /></div>
              </div>
            </li>
          ); })}
        </ul>}
      </section>

      <section className="hd" aria-labelledby="nb-h">
        <header className="hd-head">
          <h2 id="nb-h">{rankLabel(when, now).title}</h2>
          <div className="nb-when" role="radiogroup" aria-label="Rank spots for" onKeyDown={onWhenKey}>
            {WHENS.map((w) => <button key={w} type="button" role="radio" aria-checked={w === when} tabIndex={w === when ? 0 : -1} onClick={() => setWhen(w)}>{rankLabel(w, now).tab}</button>)}
          </div>
          {refName && <p className="hd-note">Within 100 km of {refName}, ranked by the rating at that time</p>}
        </header>
        {waiting ? <ul className="nb-list" aria-busy="true" aria-label="Loading nearby spots">{[0, 1, 2].map((i) => <li key={i} className="nbsk" aria-hidden="true"><i className="sk-l w70" /></li>)}</ul>
          : nearby.length === 0
          ? <p className="hd-empty">No other rated spots within 100 km for that time.</p>
          : <ol className="nb-list">
              {nearby.map(({card: c, km, at: when_}, i) => (
                <li key={c.id} className="nb" style={{'--band': BAND_COLOR[bandOf(c.rating.category)]} as React.CSSProperties}>
                  <a className="nb-a" href="/forecast" onClick={open(c.id)} aria-label={`Number ${i + 1}: ${c.name}, ${km} kilometres away. ${c.surf.label}. ${conditionWord(c.rating.category)}${when !== 'now' ? `, judged ${at(when_, c.id)}` : ''}. Open forecast`}>
                    <span className="nb-rank" aria-hidden="true">{i + 1}</span>
                    <span className="nb-name"><b>{c.name}</b><small>{c.region} · {km} km{when !== 'now' ? ` · ${at(when_, c.id)}` : ''}</small>{(() => { const k = callOf(c.id, c.validTime); return k ? <CallBar call={k} compact /> : null; })()}</span>
                    <span className="nb-surf">{surfOf(c, true)}</span>
                    <RatingBar c={c.rating} />
                  </a>
                </li>
              ))}
            </ol>}
        <p className="hd-fine">Ratings are provisional model scores. Surf heights are model estimates of the height surf reports quote (about the nearshore wave height), or labelled offshore; not measurements.</p>
      </section>
    </div>
  );
}
