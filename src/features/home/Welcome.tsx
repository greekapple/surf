import {useMemo, useState} from 'react';
import {figureOf} from '../../ui/PersonShape';
import {betHour, windowPhrase} from '../../services/homeDash';
import {dateInMs, hourInMs, fmtIn, addDaysKey} from '../../ocean/time';
import {differsFromViewer, timeZoneOf, viewerTag, viewerZone} from '../../ocean/spotZone';
import type {Forecast, SurfSpot, Surfboard, UserProfile} from '../../models/index';
import type {OceanBundle, TidePrediction} from '../../ocean/types';
import {callFor, hourCall, type CallWindow, type Verdict} from '../../services/call';
import {daylightFor} from '../../services/daylight';
import {spotHourOf, windOf} from '../../services/spotHour';
import {breakerType} from '../../services/breaker';
import {glyphFor} from '../../services/waveGlyph';
import {formatHeight, userHeight} from '../../services/heightMath';
import {rateForecast} from '../../ratings/adapters';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {DRAWN_CAPTION, WaveGlyph} from '../../ui/WaveGlyph';
import {heroMediaFor} from './heroMedia';
import type {OwnCam} from '../../data/cams';
import {NwsBanner} from '../forecast/Trust';
import {boardPickFor, rangeSourceText} from '../quiver/fit';
import {heroEstimateText} from '../../services/headlineLabel';
import {certaintyOf, wideText, HORIZON_HOURS} from '../../services/certainty';
import {greetingLine} from './greeting';
import {rankBets, type BetConfidence} from './betRank';
import {evidenceSpots} from '../../ocean/spots';
import {tideStationFor, SF_STATION, noTideNote} from '../../ocean/tideStations';
import {regionNote} from '../../ocean/coverage';
import {surfRange} from '../../utils/units';

const TIDE_RANGE_KM = 40; // a station further than this is not a fair tide reference for the spot

/* T-074 welcoming Home (spec 2026-11-02-forecast-driven-3d-home §3): a greeting with the day's answer in one sentence (from the Call),
 * T-106: the hero's media slot (a SWELLO live cam when one exists, else the bet's wave drawn to scale beside you on a time-of-day gradient; the
 * credited photo stays on the spot page), today at a glance and the quiver's pick. Every number comes from the existing
 * accessors (callFor, hourCall, spotHourOf, daylightFor, the tide extrema); nothing is invented, and the sentence says so when nothing is good. */

type Bundle = Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null | undefined;
interface Bet {spot: SurfSpot; window: CallWindow; verdict: Verdict; rec: Forecast; /** the window is on now: `rec` is the current hour */ onNow: boolean; when: string; /** The window's first hour has a surf estimate. */ sized: boolean; confidence: BetConfidence}
const clock = (iso: string, tz: string) => fmtIn(tz, {hour: 'numeric', minute: '2-digit'}).format(new Date(iso)); // in the zone of the spot shown
// 'today'/'tomorrow' are the spot's days; where its clock is not the viewer's they could be a different day for the reader, so the weekday is named (round 3 data-honesty)
const dayWord = (iso: string, nowMs: number, tz: string) => { if (differsFromViewer(tz, iso)) return fmtIn(tz, {weekday: 'long'}).format(new Date(iso)); const d = dateInMs(tz, Date.parse(iso)), today = dateInMs(tz, nowMs); if (d === today) return 'today'; if (d === addDaysKey(today, 1)) return 'tomorrow'; return fmtIn(tz, {weekday: 'long'}).format(new Date(iso)); };

/** The best bet: across the candidate spots, the next daylight window (today's if still ahead, else the next one), Go or Worth a look at its first hour.
 *  T-075: only a spot with a SURF ESTIMATE at that hour can be "your best bet" (we can't recommend a size we don't have), so sized spots rank first,
 *  then verdict, then how soon. `bet.sized` is false only when no candidate has an estimate; the sentence then says so. */
export function bestBet(spots: SurfSpot[], records: Forecast[], profile: UserProfile, bundle: Bundle, nowMs: number): {bet: Bet | null; alt: Bet | null; withData: number; total: number} {
  const ctx = {records, bundle, nowMs}, bets: Bet[] = []; let withData = 0;
  for (const spot of spots) {
    const mine = records.filter((f) => f.spotId === spot.id).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const cur = mine.find((f) => Date.parse(f.timestamp) + 36e5 > nowMs); if (!cur) continue; // no current or future record: not evaluated
    withData++;
    const call = callFor(spot, cur, profile, ctx), w = call.window && Date.parse(call.window.end) > nowMs ? call.window : call.nextWindow; if (!w) continue;
    const {rec, onNow} = betHour(mine, spot.id, w, nowMs); if (!rec) continue; // hero-now: the current hour when the window is on now, else the hour holding its start (a window may start at first light)
    if (Date.parse(w.start) - nowMs >= HORIZON_HOURS * 36e5) continue; // certainty: never a best bet past the horizon (too far out to call)
    const v = hourCall(spot, rec, profile, ctx).verdict; if (v !== 'Go' && v !== 'Worth a look') continue;
    const hl = spotHourOf(spot, rec, nowMs, profile, {bundle}).surf.headline;
    bets.push({spot, window: w, verdict: v, rec, onNow, when: dayWord(w.start, nowMs, timeZoneOf(spot)), sized: hl.kind === 'estimate', confidence: certaintyOf(spot.id, hl, rec.timestamp, nowMs)?.level ?? null});
  }
  const ranked = rankBets(bets), bet = ranked[0] ?? null;
  // the runner-up, offered only when the first answer is shaky: another spot, with its own surf estimate
  const alt = bet?.sized ? ranked.find((b) => b !== bet && b.sized && b.spot.id !== bet.spot.id) ?? null : null;
  return {bet, alt, withData, total: spots.length};
}

/** A SWELLO cam (none yet): plays muted inline; if it fails, the hero falls back to the drawing. */
function CamPlayer({cam, onFail}: {cam: OwnCam; onFail: () => void}) {
  return <video className="wel-cam" src={cam.src} muted autoPlay playsInline loop onError={onFail} aria-label={`${cam.label}, live view`} />;
}

const cap = (w: string) => w.replace(/^\w/, (c) => c.toUpperCase());
const tintOf = (nowMs: number, spotId: string) => {
  const d = daylightFor(spotId, dateInMs(timeZoneOf(spotId), nowMs)), t = nowMs, fl = Date.parse(d.firstLight), sr = Date.parse(d.sunrise), ss = Date.parse(d.sunset), ll = Date.parse(d.lastLight);
  return t < fl || t > ll ? 'night' : t < sr + 45 * 6e4 ? 'dawn' : t > ss - 60 * 6e4 ? 'dusk' : 'day';
};

export function Welcome({name, spots, refSpot, records, profile, bundle, extrema, boards, nowMs, onOpen, stationTides}: {
  name: string | null; spots: SurfSpot[]; refSpot: SurfSpot; records: Forecast[]; profile: UserProfile; bundle: Bundle; extrema: TidePrediction[] | undefined;
  boards: Surfboard[]; nowMs: number; onOpen: (spotId: string, iso: string | null) => void; stationTides?: OceanBundle['stationTides'];
}) {
  const hourKey = Math.floor(nowMs / 36e5);
  const {bet, alt, withData, total} = useMemo(() => bestBet(spots, records, profile, bundle, nowMs), [spots, records, profile, bundle, hourKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const spot = bet?.spot ?? refSpot, greeting = greetingLine(hourInMs(viewerZone(), nowMs),   // the viewer's own clock: it greets the person, not the spot
     name?.trim() ? name.trim().split(/\s+/)[0] : null);
  // The sentence: the window, the surf estimate at its first hour and the wind there. Offshore-only height is never stated as surf.
  const at = bet ? spotHourOf(bet.spot, bet.rec, nowMs, profile, {bundle}) : null, wind = bet ? windOf(bet.spot, bet.rec, profile, nowMs) : null;
  const surf0 = at ? (at.surf.headline.kind === 'estimate' ? at.surf.value : at.surf.headline.kind === 'demonstration' ? `${at.surf.value} (demonstration)` : null) : null;
  // certainty (2026-11-06): the first read stays one sentence; it only adds words when the size is shaky: "(models differ; could be 4–9 ft)" after the band where the models disagree; no best bet past the horizon.
  const cv = bet && at ? certaintyOf(bet.spot.id, at.surf.headline, bet.rec.timestamp, nowMs) : null;
  const surf = surf0 && cv ? (cv.level === 'too-far' ? 'too far out to size yet' : cv.disagree ? `${surf0} (models differ${cv.wide ? `; could be ${wideText(cv.wide, profile).full}` : ''})` : surf0) : surf0; // the band stays the number (T-118), as in the hero caption below; the confidence word is in that caption
  const windWords = wind ? `${wind.word.split(' ')[0].toLowerCase()} ${wind.relation}${wind.stale ? (wind.stale.reason === 'saved' ? ' (saved data)' : ' (stale data)') : ''}` : null;
  const answer = bet && bet.sized && surf
    ? `${bet.spot.name} is your best bet ${bet.when}, ${windowPhrase(bet.window, nowMs)}${viewerTag(timeZoneOf(bet.spot), bet.window.start)}, ${surf}${windWords ? ` and ${windWords}` : ''}.`
    : bet ? `No sized forecast nearby ${bet.when}; ${bet.spot.name} looks best on wind alone, ${windowPhrase(bet.window, nowMs)}${viewerTag(timeZoneOf(bet.spot), bet.window.start)}${windWords ? `, ${windWords}` : ''}.`
    : withData === 0 ? `There is no forecast for your spots right now, so there is no answer yet.`
    : withData < total ? `Nothing worth it in the next few days at the ${withData} of ${total} spots with a forecast; the others have none right now.`
    : `Nothing at your spots looks worth it in the next few days. The forecast below shows why.`;
  // Today at a glance, for the best spot (or your first spot when there is no bet).
  const tz = timeZoneOf(spot), today = daylightFor(spot.id, dateInMs(tz, nowMs));
  const nowRec = records.filter((f) => f.spotId === spot.id).find((f) => Date.parse(f.timestamp) + 36e5 > nowMs);
  // T-075: the next tide turn at the chosen spot's nearest CO-OPS station within ${TIDE_RANGE_KM} km, named (a station prediction, not the beach).
  // US spots: the nearest open-coast station (tideStationForSpot); outside the US: none (coverage.ts, never borrowed across a border)
  const ev = evidenceSpots.find((e) => e.id === spot.id), near = ev ? tideStationFor(ev) ?? undefined : undefined;
  const station = near && near.distanceKm <= TIDE_RANGE_KM ? near : null;
  const stationTurns = !station ? [] : (station.station.id === SF_STATION ? extrema ?? [] : stationTides?.[station.station.id]?.extrema ?? []);
  const nextTide = stationTurns.filter((e) => e.height.value !== null && Date.parse(e.timestamp) > nowMs).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).map((e) => ({t: e.timestamp, type: e.type, saved: e.height.source?.delivery === 'saved'}))[0];   // tide-label: the turn's own feed can be a saved copy; the cell says so, as the wind words do
  const water = nowRec && Number.isFinite(nowRec.waterTempF) ? Math.round(nowRec.waterTempF as number) : null;
  // The quiver's pick for the bet: size + period at the window's first hour (wave shape unknown).
  // T-099: the one board pick (fit.ts boardPickFor) for the bet's spot-hour, the same function Board Match and Personal use.
  const choice = bet ? boardPickFor(boards, bet.spot, bet.rec, nowMs, profile, {bundle}) : null;
  const pick = choice?.pick ? choice.ranked.find((x) => x.board.id === choice.pick!.id) ?? null : null;
  // "Go, when, on what": the board and how sure we are sit right under the answer (first screen on a phone); the second choice only when we are not sure.
  const altAt = alt && cv?.level === 'low' ? spotHourOf(alt.spot, alt.rec, nowMs, profile, {bundle}) : null, altCv = alt && altAt ? certaintyOf(alt.spot.id, altAt.surf.headline, alt.rec.timestamp, nowMs) : null;
  const altText = alt && altAt?.surf.headline.kind === 'estimate' ? `${alt.spot.name}, ${alt.when === bet?.when ? '' : `${alt.when} `}${alt.window.label}${viewerTag(timeZoneOf(alt.spot), alt.window.start)}, ${altAt.surf.value}${altCv?.disagree ? ' (models differ)' : ''}${altCv && altCv.level !== 'too-far' ? `, ${altCv.word}` : ''}` : null;
  // only a board the surf is inside (or at the edge of) its range; in size-only mode the wave shape is unknown and the line says so
  const boardText = bet?.sized && pick && (pick.size.state === 'in' || pick.size.state === 'edge') ? `${pick.board.name}` : null,
    // quiver-lock: an example board is said to be one (it is not the surfer's), with a way to add their own
    boardNote = boardText ? `${choice?.mode === 'size' ? ' (by size; wave shape unknown)' : ''}${pick?.board.demo ? ' · an example board: add your own in Quiver' : ''}` : '';
  // T-106: the hero draws the hour the sentence talks about (the bet's first hour), else the spot's current hour; same headline as the number.
  const [camFailed, setCamFailed] = useState(false), media = camFailed ? {kind: 'drawn' as const} : heroMediaFor(spot.id);
  const heroRec = bet?.rec ?? nowRec, heroHour = at ?? (nowRec ? spotHourOf(spot, nowRec, nowMs, profile, {bundle}) : null), me = userHeight(profile);
  const glyph = heroRec && heroHour ? glyphFor(heroHour.surf.headline, me.feet, heroRec.primary?.period, breakerType(spot, heroRec).type) : null;
  const heroBand = heroRec ? BAND_COLOR[bandOf(rateForecast(spot, heroRec, nowMs).category)] : undefined;
  // Audit F19: the caption names the same time as the sentence and the button (the window's start, e.g. 6:20), not the top of the hour holding it.
  // hero-now: a window on now is shown and opened at the current hour, and called "now"
  const heroT = bet ? (bet.onNow ? bet.rec.timestamp : bet.window.start) : heroRec?.timestamp;
  const heroWhen = bet?.onNow ? 'now' : heroT ? `${dayWord(heroT, nowMs, tz) === 'today' ? '' : dayWord(heroT, nowMs, tz).replace(/^\w/, (c) => c.toUpperCase()) + ' '}${clock(heroT, tz)}${viewerTag(tz, heroT)}` : '';
  return (
    <section className={`wel wel-${tintOf(nowMs, spot.id)}`} aria-labelledby="wel-h">
      <div className={`wel-hero is-${media.kind}`}>
        <div className="wel-in">
          <h1 id="wel-h">{greeting}</h1>
          <p className="wel-a" title={bet ? "Surf windows end at last light (civil twilight, our cut-off), not at sunset" : undefined}>{answer}</p>
          {(boardText || (cv && cv.level !== 'too-far')) && <p className="wel-sub">
            {[boardText && <>Take your <b>{boardText}</b>{boardNote}</>, cv && cv.level !== 'too-far' && <span title={`${cap(cv.word)}: ${cv.why}`}>{cap(cv.word)}</span>].filter(Boolean).map((x, k) => <span key={k}>{k ? ' · ' : ''}{x}</span>)}
          </p>}
          {altText && <p className="wel-sub">Second choice: {altText}</p>}
          {bet && <button type="button" className="wel-go" onClick={() => onOpen(bet.spot.id, bet.rec.timestamp)}>Open {bet.spot.name}, {bet.onNow ? 'now' : <>{bet.when} {clock(bet.window.start, timeZoneOf(bet.spot))}{viewerTag(timeZoneOf(bet.spot), bet.window.start)}</>}</button>}
        </div>
        {media.kind === 'cam'
          ? <figure className="wel-media"><CamPlayer cam={media.cam} onFail={() => setCamFailed(true)} /><figcaption>{media.cam.label} · {spot.name}</figcaption></figure>
          : glyph && <figure className="wel-media" style={heroBand ? {'--band': heroBand} as React.CSSProperties : undefined}>
              <WaveGlyph glyph={glyph} size="lg" personIn={me.inches} unit={profile.heightUnit} figure={figureOf(profile)} />
              <figcaption><span><span className="wel-cap-where">{spot.name} · {heroWhen} · </span>{glyph.kind !== 'offshore' ? `${heroEstimateText(heroHour!.surf.headline, profile) ?? `Est. ${heroHour!.surf.value}`} · you ${formatHeight(me.inches, profile.heightUnit)}${me.isDefault ? ' (default)' : ''}` : 'offshore swell only'}</span><span>{DRAWN_CAPTION}</span></figcaption>
            </figure>}
      </div>
      <NwsBanner spotId={spot.id} />
      <dl className="wel-glance" aria-label={`Today at ${spot.name}`}>
        <div><dt>Sunrise</dt><dd>{clock(today.sunrise, tz)}{viewerTag(tz, today.sunrise)}</dd></div>
        <div><dt>Sunset</dt><dd>{clock(today.sunset, tz)}{viewerTag(tz, today.sunset)}</dd></div>
        <div><dt>Next tide</dt><dd title={nextTide && station ? `NOAA CO-OPS prediction at ${station.station.name}, ${station.distanceKm} km away; not at the beach${nextTide.saved ? '; saved copy, the latest refresh did not succeed' : ''}` : station ? 'No prediction loaded for the nearest station' : noTideNote(spot.id).replace('near this spot.', 'within range.')}>{nextTide && station ? <>{nextTide.type.toLowerCase()} {clock(nextTide.t, tz)}{viewerTag(tz, nextTide.t)}{nextTide.saved ? ' (saved data)' : ''} <small>{station.station.name} station, {station.distanceKm} km{(station as {fallback?: boolean}).fallback ? ` · ${((station as {fallbackLabel?: string}).fallbackLabel ?? 'inlet or bay-side station').toLowerCase()}: times and range may differ from the open beach` : ''}</small></> : (regionNote(spot, 'tide') ?? '—')}</dd></div>
        <div><dt>Water</dt><dd>{water !== null ? `${water}°F` : '—'}</dd></div>
        <div className="wel-pick"><dt>Your quiver's pick</dt><dd>{pick && (pick.size.state === 'in' || pick.size.state === 'edge') ? <>{pick.board.name} <small>suits {surfRange(pick.size.board[0], pick.size.board[1], profile)} ({rangeSourceText(pick.size, pick.board.type)}){choice?.mode === 'size' ? ', wave shape unknown' : ''}</small></> : boards.length ? <small>No board fits a known surf estimate here</small> : <small>Add boards to get a pick</small>}</dd></div>
      </dl>
    </section>
  );
}
