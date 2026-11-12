import {useMemo} from 'react';
import {hourIn, fmtIn} from '../../ocean/time';
import {timeZoneOf, differsFromViewer, viewerTag} from '../../ocean/spotZone';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {OceanBundle} from '../../ocean/types';
import {dayRange, type DayRange} from '../../services/spotHour';
import {weekCell, dayText, type WeekCell} from '../../services/weekCell';
import {rateForecast} from '../../ratings/adapters';
import {isDark} from '../forecast/trustApi';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {conditionWord} from '../../ui/Condition';
import {weekDays, bucketByColumn} from './weekDays';
import {monotonePath} from '../forecast/helpers';
import {dayCertainty, certainLabel, type CertaintyView} from '../../services/certainty';

/* T-067 "Your spots this week" (T-069: estimate rows first; an offshore-only day is a small grey number, the row label says offshore) (Surfline home pattern): rows are spots, columns 8 days. Each cell is the MIDDAY hour's
 * surf range (T-107 weekCell; the daylight spread is in the title and aria, the section note says "at midday"), a three-part AM / midday / PM rating bar (dark parts unrated),  and
 * (T-119, the user's "lines that undulate", replacing T-106's tiny drawings) a smooth line across each row through the days' midday sizes. Offshore-only days are muted ("7 off"), never styled as surf. A cell opens that spot at that day's representative hour. */

const DAYS = 8, BLOCKS = [7, 12, 17] as const, BLOCK_WORD = ['AM', 'midday', 'PM'];
const dayHead = (key: string, k: number) => { if (k === 0) return 'Today'; const d = new Date(`${key}T12:00:00Z`); return `${fmtIn('UTC', {weekday: 'short'}).format(d)} ${fmtIn('UTC', {day: 'numeric'}).format(d)}`; }; // a date KEY's weekday and day number: zone-free (noon UTC of that date)
const zoneAbbr = (tz: string, ms: number) => fmtIn(tz, {timeZoneName: 'short'}).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? tz;
const hourOf = (tz: string, iso: string) => hourIn(tz, iso) % 24;

type Seg = {state: 'dark' | 'none' | 'rated'; color: string; word: string};
interface Cell {key: string; dr: DayRange; wc: WeekCell; segs: Seg[]; /** certainty (2026-11-06): the midday hour's level, null when none is honest to show */ cv: CertaintyView | null}
interface Row {spot: SurfSpot; tz: string; cells: Cell[]}

export function WeekGrid({spots, records, nowMs, profile, bundle, unit, onOpen}: {spots: SurfSpot[]; records: Forecast[]; nowMs: number; profile: UserProfile; bundle: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null | undefined; unit: string; onOpen: (spotId: string, iso: string | null) => void}) {
  // T-088b: no column for a trailing day beyond the forecast horizon (after midnight the 8th day has no records at all).
  const colTz = timeZoneOf(spots[0]), keys = useMemo(() => weekDays(nowMs, records, spots.map((x) => x.id), DAYS, colTz), [Math.floor(nowMs / 36e5), records, spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows: Row[] = useMemo(() => spots.map((spot) => {
    const mine = records.filter((f) => f.spotId === spot.id), tz = timeZoneOf(spot), byCol = bucketByColumn(mine, spot.id, tz, keys);   // every row uses the COLUMN's dates, each read in the row's own zone: the head's date is the cell's date (round 3 data-honesty)
    return {spot, tz, cells: keys.map((_, ki) => {
      const key = keys[ki];
      const dr = dayRange(spot, mine, key, nowMs, profile, {bundle});
      const segs = BLOCKS.map((h, i): Seg => {
        const f = byCol[ki].find((r) => hourOf(tz, r.timestamp) === h);
        if (!f) return {state: 'none', color: 'var(--none)', word: `${BLOCK_WORD[i]} no data`};
        const r = rateForecast(spot, f, nowMs), dark = isDark(spot.id, f.timestamp); // after dark the conditions keep their color, dimmed (user, 2026-11-08)
        return r.score === null ? {state: 'none', color: 'var(--none)', word: `${BLOCK_WORD[i]} not rated`} : {state: dark ? 'dark' : 'rated', color: BAND_COLOR[bandOf(r.category)], word: `${BLOCK_WORD[i]} ${conditionWord(r.category).toLowerCase()}${dark ? ', after dark' : ''}`};
      });
      const wc = weekCell(dr, unit);
      return {key, dr, wc, segs, cv: wc.kind === 'none' ? null : dayCertainty(spot.id, dr, nowMs)};
    })};
  }).map((r, i) => ({r, i, est: r.cells.filter((c) => c.dr.kind === 'estimate').length}))
    .sort((a, b) => b.est - a.est || a.i - b.i).map((x) => x.r), [spots, records, keys, nowMs, profile, bundle, unit]); // T-069: spots with surf estimates first
  return (
    <div className="wk" role="region" aria-label="Your spots this week" tabIndex={0}>
      <table className="wk-t">
        <thead><tr><th scope="col" className="wk-spot">Spot<small className="wk-unit"> · surf est., {unit}</small>{differsFromViewer(colTz, nowMs) ? <small> · days in {zoneAbbr(colTz, nowMs)}</small> : null}</th>{keys.map((k, i) => <th key={k} scope="col">{dayHead(k, i)}</th>)}</tr></thead>
        <tbody>{rows.map(({spot, cells, tz}) => {
          // T-119 (Surfline-style, the user's "lines that undulate"): a smooth monotone curve through the days' midday sizes (wc.centralFt, the cell's own
          // number) on the row's own scale (its lowest to highest day, padded), so the week's shape reads; the numbers above carry the values.
          // Estimate days only: a day without an estimate breaks the line.
          // certainty: a day past the horizon calls no size, so the line stops before it (never drawn through "too far out").
          const sized = (c: Cell) => c.wc.kind === 'estimate' && c.cv?.level !== 'too-far';
          const vs = cells.map((c) => (sized(c) ? c.wc.centralFt : null)).filter((v): v is number => v !== null);
          const rLo = Math.min(...vs), rHi = Math.max(...vs), span = Math.max(2, rHi - rLo), base = rLo - (span - (rHi - rLo)) / 2;
          const runs: [number, number][][] = []; let cur: [number, number][] = [];
          cells.forEach((c, i) => { if (sized(c) && c.wc.centralFt !== null) cur.push([(i + 0.5) * 100, 36 - ((c.wc.centralFt - base) / span) * 32]); else if (cur.length) { runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
          return (
            <tr key={spot.id}>
              <th scope="row" className="wk-spot"><b>{spot.name}</b><small>{spot.region}{tz !== colTz ? ` · ${zoneAbbr(tz, nowMs)} time` : ''}{(() => { const off = cells.filter((c) => c.dr.kind === 'offshore').length, est = cells.filter((c) => c.dr.kind === 'estimate').length;
                return off ? <span className="wk-kind"> · {est ? 'offshore where gray' : 'offshore only'}</span> : null; })()}</small></th>
              {cells.map((c, i) => {
                const line = i === 0 && runs.length ? <svg className="wk-line" style={{width: `${keys.length * 100}%`}} viewBox={`0 0 ${keys.length * 100} 40`} preserveAspectRatio="none" aria-hidden="true">{runs.map((r) => r.length > 1 ? <path key={r[0][0]} d={monotonePath(r)} /> : <circle key={r[0][0]} cx={r[0][0]} cy={r[0][1]} r={2.5} />)}</svg> : null;
                const wc = c.wc, est = wc.kind === 'estimate', off = wc.kind === 'offshore', nws = wc.kind === 'official', cv = c.cv, far = cv?.level === 'too-far';
                const shown = certainLabel(wc.label, off ? `${unit} offshore` : unit, cv, profile), label = shown.text;
                const st = wc.stale ? `, ${wc.stale === 'saved' ? 'saved' : 'stale'} source` : '';
                const fullText = dayText(c.dr.typical)?.full ?? `${label} ${unit}`; // T-112: unit and Hawaiian qualifier, as the spot page says it
                const word = cv && !far ? `, ${cv.word}` : wc.confidence ? `, ${wc.confidence} confidence` : '', differ = shown.note ? `, ${shown.note}${shown.detail ? ` (${shown.detail})` : ''}` : ''; // the confidence word once (data-honesty cycle 1)
                const day = tz === colTz ? dayHead(keys[i], i) : dayHead(keys[i], 1), at = c.dr.typical?.atIso, mid = `${wc.midday}${at ? viewerTag(tz, at) : ''}`;   // another zone's row: the date, not 'Today'; the midday hour names the spot's zone where it is not the viewer's
                const aria = `${spot.name}, ${day}: ${far ? `too far out to call (${cv!.why}); ${shown.detail} at ${mid}${st}` : est ? `surf estimate ${fullText}${word}${differ} at ${mid}${st}${wc.spread ? `; ${wc.spread}` : ''}` : nws ? `NWS surf forecast ${fullText}, the National Weather Service's range for the zone, not our estimate${st}` : off ? `surf estimate unavailable, offshore ${fullText} at ${mid}${st}${wc.spread ? `; ${wc.spread}` : ''}` : 'no forecast height for this day'}; ${c.segs.map((s) => s.word).join(', ')}. Open forecast`;
                const tip = [cv ? `${cv.word}: ${cv.why}` : null, shown.detail, wc.spread ? `${mid}${st}; ${wc.spread}` : null].filter(Boolean).join('. ') || undefined;
                return (
                  <td key={c.key} className={`wk-c${i === 0 ? ' wk-first' : ''}${cv ? ` is-${cv.level}` : ''}`}>
                    {line}
                    <button type="button" aria-label={aria} onClick={() => onOpen(spot.id, c.dr.typical?.atIso ?? null)}>
                      <span className={(far ? 'wk-h wk-far' : est ? 'wk-h' : nws ? 'wk-h wk-nws' : off ? 'wk-h wk-off' : 'wk-h wk-none') + (wc.stale ? ' wk-stale' : '')} data-central-ft={wc.centralFt ?? undefined} data-certainty={cv?.level} title={tip}>{label}{off && <small className="wk-off-tag"> offsh.</small>}{nws && <small className="wk-off-tag"> NWS</small>}{wc.stale && <small className="wk-stale-tag"> {wc.stale}</small>}{shown.note && <small className="wk-why">{shown.note}</small>}</span>
                      <span className="wk-bar" aria-hidden="true">{c.segs.map((s, k) => <i key={k} className={s.state} style={{background: s.color}} />)}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
