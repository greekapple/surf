import type {Surfboard} from '../../models/index';
import {boardRanges} from '../../recommendation/board';
import {periodFit, type PeriodFit} from '../forecast/trustApi';

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
  if (ehi < lo) return {state: 'small', label: 'Smaller than its range', board: range, source};
  if (elo > hi) return {state: 'big', label: 'Bigger than its range', board: range, source};
  return {state: 'edge', label: 'Edge of its range', board: range, source};
}

/** T-065 Board Match on size + period (wave shape is unknown): every board ranked by how today's estimate sits in its range, then by whether the
 *  dominant swell period suits it (T-064 periodFit). Only boards with the estimate inside or at the edge of their range are recommended. */
export interface BoardPick {board: Surfboard; size: SizeFit; period: PeriodFit | null; rank: number}
export function rankBoards(boards: Surfboard[], est: [number, number] | null, periodS: number | null): BoardPick[] {
  return boards.map((b) => {
    const size = sizeFit(b, est), period = periodS !== null && Number.isFinite(periodS) ? periodFit(b.type, periodS) : null;
    const rank = (size.state === 'in' ? 3 : size.state === 'edge' ? 2 : 0) + (period?.fit === 'ok' ? 1 : 0);
    return {board: b, size, period, rank};
  }).sort((a, b) => b.rank - a.rank || (a.board.favorite === b.board.favorite ? 0 : a.board.favorite ? -1 : 1));
}
export const recommended = (picks: BoardPick[]) => picks.filter((x) => x.size.state === 'in' || x.size.state === 'edge');
