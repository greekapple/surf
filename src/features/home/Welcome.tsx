import {useMemo} from 'react';
import {pacificDateMs, pacificHourMs} from '../../ocean/time';
import type {Forecast, SurfSpot, Surfboard, UserProfile} from '../../models/index';
import type {OceanBundle, TidePrediction} from '../../ocean/types';
import {callFor, hourCall, type CallWindow, type Verdict} from '../../services/call';
import {daylightFor} from '../../services/daylight';
import {spotHourOf, windOf} from '../../services/spotHour';
import {SpotBand} from '../forecast/SpotBand';
import {NwsBanner} from '../forecast/Trust';
import {rankBoards, recommended} from '../quiver/fit';
import {rankBets} from './betRank';
import {evidenceSpots} from '../../ocean/spots';
import {nearestTideStations, SF_STATION} from '../../ocean/tideStations';

const TIDE_RANGE_KM = 40; // a station further than this is not a fair tide reference for the spot

/* T-074 welcoming Home (spec 2026-11-02-forecast-driven-3d-home §3): a greeting with the day's answer in one sentence (from the Call), the best spot's
 * credited photo (or its drawn coast) with a time-of-day tint, today at a glance and the quiver's pick. Every number comes from the existing
 * accessors (callFor, hourCall, spotHourOf, daylightFor, the tide extrema); nothing is invented, and the sentence says so when nothing is good. */

type Bundle = Pick<OceanBundle, 'nearshore' | 'mop'> | null | undefined;
interface Bet {spot: SurfSpot; window: CallWindow; verdict: Verdict; rec: Forecast; when: string; /** The window's first hour has a surf estimate. */ sized: boolean}
const pt = pacificDateMs; // cached formatter (T-091)
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'});
const hourOfDay = pacificHourMs;
const dayWord = (iso: string, nowMs: number) => { const d = pt(Date.parse(iso)); if (d === pt(nowMs)) return 'today'; if (d === pt(nowMs + 864e5)) return 'tomorrow'; return new Date(iso).toLocaleDateString('en-US', {timeZone: 'America/Los_Angeles', weekday: 'long'}); };

/** The best bet: across the candidate spots, the next daylight window (today's if still ahead, else the next one), Go or Worth a look at its first hour.
 *  T-075: only a spot with a SURF ESTIMATE at that hour can be "your best bet" (we can't recommend a size we don't have), so sized spots rank first,
 *  then verdict, then how soon. `bet.sized` is false only when no candidate has an estimate; the sentence then says so. */
export function bestBet(spots: SurfSpot[], records: Forecast[], profile: UserProfile, bundle: Bundle, nowMs: number): {bet: Bet | null; withData: number; total: number} {
  const ctx = {records, bundle, nowMs}, bets: Bet[] = []; let withData = 0;
  for (const spot of spots) {
    const mine = records.filter((f) => f.spotId === spot.id).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const cur = mine.find((f) => Date.parse(f.timestamp) + 36e5 > nowMs); if (!cur) continue; // no current or future record: not evaluated
    withData++;
    const call = callFor(spot, cur, profile, ctx), w = call.window && Date.parse(call.window.end) > nowMs ? call.window : call.nextWindow; if (!w) continue;
    const rec = mine.find((f) => f.timestamp === w.start); if (!rec) continue;
    const v = hourCall(spot, rec, profile, ctx).verdict; if (v !== 'Go' && v !== 'Worth a look') continue;
    bets.push({spot, window: w, verdict: v, rec, when: dayWord(w.start, nowMs), sized: spotHourOf(spot, rec, nowMs, profile, {bundle}).surf.headline.kind === 'estimate'});
  }
  return {bet: rankBets(bets)[0] ?? null, withData, total: spots.length};
}

const greetingWord = (h: number) => (h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
const tintOf = (nowMs: number, spotId: string) => {
  const d = daylightFor(spotId, pt(nowMs)), t = nowMs, fl = Date.parse(d.firstLight), sr = Date.parse(d.sunrise), ss = Date.parse(d.sunset), ll = Date.parse(d.lastLight);
  return t < fl || t > ll ? 'night' : t < sr + 45 * 6e4 ? 'dawn' : t > ss - 60 * 6e4 ? 'dusk' : 'day';
};

export function Welcome({name, spots, refSpot, records, profile, bundle, extrema, boards, nowMs, onOpen, stationTides}: {
  name: string | null; spots: SurfSpot[]; refSpot: SurfSpot; records: Forecast[]; profile: UserProfile; bundle: Bundle; extrema: TidePrediction[] | undefined;
  boards: Surfboard[]; nowMs: number; onOpen: (spotId: string, iso: string | null) => void; stationTides?: OceanBundle['stationTides'];
}) {
  const hourKey = Math.floor(nowMs / 36e5);
  const {bet, withData, total} = useMemo(() => bestBet(spots, records, profile, bundle, nowMs), [spots, records, profile, bundle, hourKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const spot = bet?.spot ?? refSpot, hi = greetingWord(hourOfDay(nowMs)), who = name?.trim() ? `, ${name.trim().split(/\s+/)[0]}` : '';
  // The sentence: the window, the surf estimate at its first hour and the wind there. Offshore-only height is never stated as surf.
  const at = bet ? spotHourOf(bet.spot, bet.rec, nowMs, profile, {bundle}) : null, wind = bet ? windOf(bet.spot, bet.rec, profile, nowMs) : null;
  const surf = at ? (at.surf.headline.kind === 'estimate' ? at.surf.value : at.surf.headline.kind === 'demonstration' ? `${at.surf.value} (demonstration)` : null) : null;
  const windWords = wind ? `${wind.word.split(' ')[0].toLowerCase()} ${wind.relation}${wind.stale ? (wind.stale.reason === 'saved' ? ' (saved data)' : ' (stale data)') : ''}` : null;
  const answer = bet && bet.sized && surf
    ? `${bet.spot.name} is your best bet ${bet.when}, ${bet.window.label}, ${surf}${windWords ? ` and ${windWords}` : ''}.`
    : bet ? `No sized forecast nearby ${bet.when}; ${bet.spot.name} looks best on wind alone, ${bet.window.label}${windWords ? `, ${windWords}` : ''}.`
    : withData === 0 ? `There is no forecast for your spots right now, so there is no answer yet.`
    : withData < total ? `Nothing worth it in the next few days at the ${withData} of ${total} spots with a forecast; the others have none right now.`
    : `Nothing at your spots looks worth it in the next few days. The forecast below shows why.`;
  // Today at a glance, for the best spot (or your first spot when there is no bet).
  const today = daylightFor(spot.id, pt(nowMs));
  const nowRec = records.filter((f) => f.spotId === spot.id).find((f) => Date.parse(f.timestamp) + 36e5 > nowMs);
  // T-075: the next tide turn at the chosen spot's nearest CO-OPS station within ${TIDE_RANGE_KM} km, named (a station prediction, not the beach).
  const ev = evidenceSpots.find((e) => e.id === spot.id), near = ev ? nearestTideStations(ev.latitude, ev.longitude)[0] : undefined;
  const station = near && near.distanceKm <= TIDE_RANGE_KM ? near : null;
  const stationTurns = !station ? [] : (station.station.id === SF_STATION ? extrema ?? [] : stationTides?.[station.station.id]?.extrema ?? []);
  const nextTide = stationTurns.filter((e) => e.height.value !== null && Date.parse(e.timestamp) > nowMs).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).map((e) => ({t: e.timestamp, type: e.type}))[0];
  const water = nowRec && Number.isFinite(nowRec.waterTempF) ? Math.round(nowRec.waterTempF as number) : null;
  // The quiver's pick for the bet: size + period at the window's first hour (wave shape unknown).
  const est: [number, number] | null = at?.surf.headline.kind === 'estimate' ? [at.surf.headline.loFt, at.surf.headline.hiFt] : null;
  const period = bet?.rec.primary && Number.isFinite(bet.rec.primary.period) ? bet.rec.primary.period : null;
  const pick = bet && est ? recommended(rankBoards(boards, est, period))[0] ?? null : null;
  return (
    <section className={`wel wel-${tintOf(nowMs, spot.id)}`} aria-labelledby="wel-h">
      <SpotBand spotId={spot.id}>
        <div className="wel-in">
          <h1 id="wel-h">{hi}{who}.</h1>
          <p className="wel-a">{answer}</p>
          {bet && <button type="button" className="wel-go" onClick={() => onOpen(bet.spot.id, bet.window.start)}>Open {bet.spot.name}, {bet.when} {clock(bet.window.start)}</button>}
        </div>
      </SpotBand>
      <NwsBanner spotId={spot.id} />
      <dl className="wel-glance" aria-label={`Today at ${spot.name}`}>
        <div><dt>Sunrise</dt><dd>{clock(today.sunrise)}</dd></div>
        <div><dt>Sunset</dt><dd>{clock(today.sunset)}</dd></div>
        <div><dt>Next tide</dt><dd title={nextTide && station ? `NOAA CO-OPS prediction at ${station.station.name}, ${station.distanceKm} km away; not at the beach` : station ? 'No prediction loaded for the nearest station' : 'No tide station within range'}>{nextTide && station ? <>{nextTide.type.toLowerCase()} {clock(nextTide.t)} <small>{station.station.name} station</small></> : '—'}</dd></div>
        <div><dt>Water</dt><dd>{water !== null ? `${water}°F` : '—'}</dd></div>
        <div className="wel-pick"><dt>Your quiver's pick</dt><dd>{pick && pick.size.state !== 'none' ? <>{pick.board.name} <small>suits {pick.size.board[0]}–{pick.size.board[1]} ft, wave shape unknown</small></> : boards.length ? <small>No board fits a known surf estimate here</small> : <small>Add boards to get a pick</small>}</dd></div>
      </dl>
    </section>
  );
}
