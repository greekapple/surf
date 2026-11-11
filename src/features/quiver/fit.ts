import type {Forecast, Surfboard, SurfSpot, UserProfile} from '../../models/index';
import {boardRanges, scoreBoard} from '../../recommendation/board.ts';
import {spotHourOf, type HourContext} from '../../services/spotHour.ts';
import {periodFit, type PeriodFit} from '../../services/boardPeriod.ts';

/** T-050 "today's match" per board, from real numbers only: the board's own wave range (its min/max if recorded, else its category's
 *  documented range in recommendation/board.ts) against the selected spot-hour's estimated face range. No range estimate → no verdict. */
export type SizeFit = {state: 'in' | 'edge' | 'big' | 'small'; label: string; board: [number, number]; source: 'board' | 'category'} | {state: 'none'; label: string};

export function sizeFit(b: Surfboard, est: [number, number] | null): SizeFit {
  if (!est) return {state: 'none', label: 'No surf estimate here now'};
  const cat = boardRanges[b.type], recorded = b.minWave !== undefined && b.maxWave !== undefined;
  if (!recorded && !cat) return {state: 'none', label: 'No wave range for this board type'};
  const lo = recorded ? b.minWave! : cat[0], hi = recorded ? b.maxWave! : cat[1], source = recorded ? 'board' : 'category';
  const [elo, ehi] = est;
  const r = (n: number) => +n.toFixed(1);
  const range: [number, number] = [r(lo), r(hi)];
  if (elo >= lo && ehi <= hi) return {state: 'in', label: 'In its range', board: range, source};
  if (ehi < lo) return {state: 'small', label: 'Surf below its range', board: range, source};
  if (elo > hi) return {state: 'big', label: 'Surf above its range', board: range, source};
  return {state: 'edge', label: 'Edge of its range', board: range, source};
}

/** The periodFit board kind for each SWELLO board type (boardPeriod.ts knows shortboard, fish, midlength, longboard, stepup, gun). */
export const PERIOD_KIND: Record<string, string> = {'Performance shortboard': 'shortboard', 'Everyday shortboard': 'shortboard', Groveler: 'shortboard', Fish: 'fish',
  Hybrid: 'midlength', Midlength: 'midlength', Funboard: 'midlength', Longboard: 'longboard', 'Soft-top': 'longboard', 'Step-up': 'stepup', Gun: 'gun'};
export const periodKind = (type: string) => PERIOD_KIND[type] ?? type;

/** T-065 Board Match on size + period (wave shape is unknown): every board ranked by how today's estimate sits in its range, then by whether the
 *  dominant swell period suits it (T-064 periodFit). Only boards with the estimate inside or at the edge of their range are recommended.
 *  Audit A5: boards the surf is outside of rank below every in/edge board, ordered by how far (ft) the estimate sits from their range,
 *  so a 1–5 ft fish never outranks a 3–8 ft shortboard in 10–13 ft surf just because the period suits it. */
export interface BoardPick {board: Surfboard; size: SizeFit; period: PeriodFit | null; rank: number; distance: number}
/** Feet between the estimate and the board's range (0 when they overlap). */
export const rangeDistance = (s: SizeFit, est: [number, number] | null) =>
  s.state === 'none' || !est ? Infinity : Math.max(0, s.board[0] - est[1], est[0] - s.board[1]);
export const outOfRange = (x: BoardPick) => x.size.state === 'big' || x.size.state === 'small';
export function rankBoards(boards: Surfboard[], est: [number, number] | null, periodS: number | null): BoardPick[] {
  return boards.map((b) => {
    const size = sizeFit(b, est), period = periodS !== null && Number.isFinite(periodS) ? periodFit(periodKind(b.type), periodS, b.length) : null;
    const rank = (size.state === 'in' ? 3 : size.state === 'edge' ? 2 : 0) + (period?.fit === 'ok' ? 1 : 0);
    return {board: b, size, period, rank, distance: rangeDistance(size, est)};
  }).sort((a, b) => {
    const ao = a.size.state === 'in' || a.size.state === 'edge' ? 0 : 1, bo = b.size.state === 'in' || b.size.state === 'edge' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (ao === 1 && a.distance !== b.distance) return a.distance - b.distance;
    return b.rank - a.rank || (a.board.favorite === b.board.favorite ? 0 : a.board.favorite ? -1 : 1);
  });
}
/** Review MEDIUM: score-mode Board Match orders like size mode: boards the surf is in or at the edge of (or with no range verdict) by score,
 *  then the boards the surf is outside of by how far. Each row carries its size fit for the label. */
export function orderScored<T extends {board: Surfboard; score: number}>(scored: T[], est: [number, number] | null): (T & {size: SizeFit; distance: number})[] {
  return scored.map((m) => { const size = sizeFit(m.board, est); return {...m, size, distance: rangeDistance(size, est)}; })
    .sort((a, b) => { const ao = a.size.state === 'big' || a.size.state === 'small' ? 1 : 0, bo = b.size.state === 'big' || b.size.state === 'small' ? 1 : 0;
      return ao - bo || (ao === 1 ? a.distance - b.distance : 0) || b.score - a.score; });
}
/** Review P2: the pick's heading. An edge fit is the closest fit, not "best": it says which end of its range the surf is at. */
export function pickHeading(size: SizeFit, est: [number, number] | null, best: string): string {
  if (size.state !== 'edge' || !est) return best;
  return `Closest fit · ${est[1] > size.board[1] ? 'top' : 'bottom'} of its range`;
}
export const recommended = (picks: BoardPick[]) => picks.filter((x) => x.size.state === 'in' || x.size.state === 'edge');

/** T-099: THE board pick, used by Home's quiver pick, Board Match and Personal, so one spot-hour gives one answer everywhere.
 *  The size is the hour's headline (spotHourOf(...).surf.headline, as every surface shows it). When the record carries a measured face value
 *  and a wave character, the full board scoring decides (Board Match's "score" list); otherwise boards are ranked on size + period
 *  (rankBoards; wave shape unknown). `pick` is the top board only when it actually suits the size; there is no preference-range heuristic. */
export type BoardChoice = {mode: 'score'; est: [number, number] | null; scored: ReturnType<typeof scoreBoard>[]; ranked: BoardPick[]; pick: Surfboard | null}
  | {mode: 'size'; est: [number, number]; scored: []; ranked: BoardPick[]; pick: Surfboard | null}
  | {mode: 'none'; est: null; scored: []; ranked: BoardPick[]; pick: null};
export function boardPickFor(boards: Surfboard[], spot: SurfSpot, f: Forecast | undefined, nowMs: number, p: UserProfile, ctx: HourContext = {}): BoardChoice {
  if (!f || !boards.length) return {mode: 'none', est: null, scored: [], ranked: [], pick: null};
  const hs = spotHourOf(spot, f, nowMs, p, ctx).surf.headline;
  const est: [number, number] | null = hs.kind === 'estimate' ? [hs.loFt, hs.hiFt] : null;
  const period = f.primary && Number.isFinite(f.primary.period) ? f.primary.period : null;
  const ranked = rankBoards(boards, est, period);
  const faceOk = ((f.availability?.face && Number.isFinite(f.face)) || !!est) && !!f.character && f.character !== 'Unknown';
  if (faceOk) {
    const scored = boards.map((b) => scoreBoard(b, f, p, est)).sort((a, b) => b.score - a.score);
    return {mode: 'score', est, scored, ranked, pick: scored.find((x) => x.eligible)?.board ?? null};
  }
  if (!est) return {mode: 'none', est: null, scored: [], ranked, pick: null};
  return {mode: 'size', est, scored: [], ranked, pick: recommended(ranked)[0]?.board ?? null};
}
