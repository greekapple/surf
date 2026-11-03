import {useMemo} from 'react';
import {pacificDateMs, pacificHour} from '../../ocean/time';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import type {OceanBundle} from '../../ocean/types';
import {dayRange, type DayRange} from '../../services/spotHour';
import {weekCell} from '../../services/weekCell';
import {rateForecast} from '../../ratings/adapters';
import {isDark} from '../forecast/trustApi';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {conditionWord} from '../../ui/Condition';
import {weekDays} from './weekDays';

/* T-067 "Your spots this week" (T-069: estimate rows first; an offshore-only day is a small grey number, the row label says offshore) (Surfline home pattern): rows are spots, columns 8 days. Each cell is the day's surf range from the T-064/T-057 day
 * logic (dayRange over daylight hours), a three-part AM / midday / PM rating bar (dark parts unrated), and behind the row a soft curve of the
 * daily size. Offshore-only days are muted ("7 off"), never styled as surf. A cell opens that spot at that day's representative hour. */

const DAYS = 8, BLOCKS = [7, 12, 17] as const, BLOCK_WORD = ['AM', 'midday', 'PM'];
const pt = pacificDateMs; // cached formatter (T-091)
const dayHead = (key: string, k: number) => { if (k === 0) return 'Today'; const d = new Date(`${key}T12:00:00-08:00`); return `${d.toLocaleDateString('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short'})} ${d.toLocaleDateString('en-US', {timeZone: 'America/Los_Angeles', day: 'numeric'})}`; };
const hourOf = (iso: string) => pacificHour(iso) % 24;

type Seg = {state: 'dark' | 'none' | 'rated'; color: string; word: string};
interface Cell {key: string; dr: DayRange; segs: Seg[]}
interface Row {spot: SurfSpot; cells: Cell[]}

export function WeekGrid({spots, records, nowMs, profile, bundle, unit, onOpen}: {spots: SurfSpot[]; records: Forecast[]; nowMs: number; profile: UserProfile; bundle: Pick<OceanBundle, 'nearshore' | 'mop'> | null | undefined; unit: string; onOpen: (spotId: string, iso: string | null) => void}) {
  // T-088b: no column for a trailing day beyond the forecast horizon (after midnight the 8th day has no records at all).
  const keys = useMemo(() => weekDays(nowMs, records, spots.map((x) => x.id), DAYS), [Math.floor(nowMs / 36e5), records, spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows: Row[] = useMemo(() => spots.map((spot) => {
    const mine = records.filter((f) => f.spotId === spot.id);
    return {spot, cells: keys.map((key) => {
      const dr = dayRange(spot, mine, key, nowMs, profile, {bundle});
      const segs = BLOCKS.map((h, i): Seg => {
        const f = mine.find((r) => pt(Date.parse(r.timestamp)) === key && hourOf(r.timestamp) === h);
        if (!f) return {state: 'none', color: 'var(--none)', word: `${BLOCK_WORD[i]} no data`};
        if (isDark(spot.id, f.timestamp)) return {state: 'dark', color: 'var(--wk-dark)', word: `${BLOCK_WORD[i]} dark`};
        const r = rateForecast(spot, f, nowMs);
        return r.score === null ? {state: 'none', color: 'var(--none)', word: `${BLOCK_WORD[i]} not rated`} : {state: 'rated', color: BAND_COLOR[bandOf(r.category)], word: `${BLOCK_WORD[i]} ${conditionWord(r.category).toLowerCase()}`};
      });
      return {key, dr, segs};
    })};
  }).map((r, i) => ({r, i, est: r.cells.filter((c) => c.dr.kind === 'estimate').length}))
    .sort((a, b) => b.est - a.est || a.i - b.i).map((x) => x.r), [spots, records, keys, nowMs, profile, bundle]); // T-069: spots with surf estimates first
  const max = Math.max(4, ...rows.flatMap((r) => r.cells.map((c) => (c.dr.kind === 'estimate' ? c.dr.hiFt ?? 0 : 0))));
  return (
    <div className="wk" role="region" aria-label="Your spots this week" tabIndex={0}>
      <table className="wk-t">
        <thead><tr><th scope="col" className="wk-spot">Spot</th>{keys.map((k, i) => <th key={k} scope="col">{dayHead(k, i)}</th>)}</tr></thead>
        <tbody>{rows.map(({spot, cells}) => {
          // The row's soft size curve: daily midpoints of the surf estimate, drawn behind the cells (estimate days only).
          const pts = cells.map((c, i) => (c.dr.kind === 'estimate' && c.dr.loFt !== null && c.dr.hiFt !== null ? [(i + 0.5) / keys.length, 1 - ((c.dr.loFt + c.dr.hiFt) / 2) / max] as const : null));
          const segPaths: string[] = []; let cur = '';
          pts.forEach((q) => { if (q) cur += `${cur ? 'L' : 'M'}${(q[0] * 800).toFixed(1)},${(8 + q[1] * 40).toFixed(1)}`; else if (cur) { segPaths.push(cur); cur = ''; } }); if (cur) segPaths.push(cur);
          return (
            <tr key={spot.id}>
              <th scope="row" className="wk-spot"><b>{spot.name}</b><small>{spot.region}{(() => { const off = cells.filter((c) => c.dr.kind === 'offshore').length, est = cells.filter((c) => c.dr.kind === 'estimate').length;
                return off ? <span className="wk-kind"> · {est ? 'offshore where grey' : 'offshore only'}</span> : null; })()}</small></th>
              {cells.map((c, i) => {
                const wc = weekCell(c.dr, unit), est = wc.kind === 'estimate', off = wc.kind === 'offshore', label = wc.label;
                const aria = `${spot.name}, ${dayHead(c.key, i)}: ${est ? `surf estimate ${label} ${unit}, ${wc.midday}${wc.spread ? `; ${wc.spread}` : ''}` : off ? `surf estimate unavailable, offshore ${label} ${unit}, ${wc.midday}${wc.spread ? `; ${wc.spread}` : ''}` : 'no forecast height for this day'}; ${c.segs.map((s) => s.word).join(', ')}. Open forecast`;
                return (
                  <td key={c.key} className={i === 0 ? 'wk-c wk-first' : 'wk-c'}>
                    {i === 0 && segPaths.length > 0 && <svg className="wk-curve" style={{width: `${keys.length * 100}%`}} viewBox="0 0 800 56" preserveAspectRatio="none" aria-hidden="true">{segPaths.map((d) => <path key={d} d={d} />)}</svg>}
                    <button type="button" aria-label={aria} onClick={() => onOpen(spot.id, c.dr.typical?.atIso ?? null)}>
                      <span className={est ? 'wk-h' : off ? 'wk-h wk-off' : 'wk-h wk-none'} data-central-ft={wc.centralFt ?? undefined} title={wc.spread ? `${wc.midday}; ${wc.spread}` : undefined}>{label}</span>
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
