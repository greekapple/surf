import type {Forecast, Surfboard, SurfSpot, UserProfile} from '../../models/index';
import {boardRanges, scoreBoard} from '../../recommendation/board.ts';
import {coarseSkill, levelOf} from '../../services/skillLevels.ts';
import {spotHourOf, type HourContext} from '../../services/spotHour.ts';
import {periodFit, type PeriodFit} from '../../services/boardPeriod.ts';

/** T-050 "today's match" per board, from real numbers only: the board's own wave range (its min/max if recorded, else its category's
 *  documented range in recommendation/board.ts) against the selected spot-hour's estimated face range. No range estimate → no verdict. */
export type SizeFit = {state: 'in' | 'edge' | 'big' | 'small'; label: string; board: [number, number]; source: 'board' | 'category'} | {state: 'none'; label: string};
/** Where a board's wave range comes from, in words: the person's own range for the board, or OUR rule for its type (recommendation/board.ts boardRanges; not a published standard). */
export const rangeSourceText = (s: SizeFit, type: string): string => (s.state === 'none' ? '' : s.source === 'board' ? 'your range' : `our rule for a ${type.toLowerCase()}`);

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
/** A fixed tie-break (favourite first, then name, then id), so the same quiver gives the same answer in any order. */
const tie = (a: Surfboard, b: Surfboard) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function rankBoards(boards: Surfboard[], est: [number, number] | null, periodS: number | null): BoardPick[] {
  return boards.map((b) => {
    const size = sizeFit(b, est), period = periodS !== null && Number.isFinite(periodS) ? periodFit(periodKind(b.type), periodS, b.length) : null;
    const rank = (size.state === 'in' ? 3 : size.state === 'edge' ? 2 : 0) + (period?.fit === 'ok' ? 1 : 0);
    return {board: b, size, period, rank, distance: rangeDistance(size, est)};
  }).sort((a, b) => {
    const ao = a.size.state === 'in' || a.size.state === 'edge' ? 0 : 1, bo = b.size.state === 'in' || b.size.state === 'edge' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (ao === 1 && a.distance !== b.distance) return a.distance - b.distance;
    return b.rank - a.rank || (a.board.favorite === b.board.favorite ? 0 : a.board.favorite ? -1 : 1) || tie(a.board, b.board);
  });
}
/** Review MEDIUM: score-mode Board Match orders like size mode: boards the surf is in or at the edge of (or with no range verdict) by score,
 *  then the boards the surf is outside of by how far. Each row carries its size fit for the label. */
export function orderScored<T extends {board: Surfboard; score: number}>(scored: T[], est: [number, number] | null): (T & {size: SizeFit; distance: number})[] {
  return scored.map((m) => { const size = sizeFit(m.board, est); return {...m, size, distance: rangeDistance(size, est)}; })
    .sort((a, b) => { const ao = a.size.state === 'big' || a.size.state === 'small' ? 1 : 0, bo = b.size.state === 'big' || b.size.state === 'small' ? 1 : 0;
      return ao - bo || (ao === 1 ? a.distance - b.distance : 0) || b.score - a.score || tie(a.board, b.board); });
}
/** Review P2: the pick's heading. An edge fit is the closest fit, not "best": it says which end of its range the surf is at. */
export function pickHeading(size: SizeFit, est: [number, number] | null, best: string): string {
  if (size.state !== 'edge' || !est) return best;
  return `Closest fit · ${est[1] > size.board[1] ? 'top' : 'bottom'} of its range`;
}
/** The ability gate, the same one scoreBoard applies (its "Experience" factor): a board category asks for a minimum of the old three skills (boardRanges' last column: 0 any, 1 intermediate,
 *  2 expert), and the surfer's seven levels map onto them as levels 1-3 beginner, 4-5 intermediate, 6-7 expert (skillLevels.ts coarseSkill). Size-only mode applies it too, so a beginner is never
 *  told to take a step-up just because the surf is big. */
const ASKS: Record<string, number> = {Beginner: 0, Intermediate: 1, Expert: 2};
export const abilityOk = (b: Pick<Surfboard, 'type'>, p: Pick<UserProfile, 'skill' | 'skillLevel'>): boolean => (ASKS[coarseSkill(levelOf(p))] ?? 0) >= (boardRanges[b.type]?.[3] ?? 0);
/** The one rule for a board that suits the hour by size: the surf is inside its range or at its edge. */
export const suits = (s: SizeFit) => s.state === 'in' || s.state === 'edge';
export const recommended = (picks: BoardPick[]) => picks.filter((x) => suits(x.size));

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
    const scored = boards.map((b) => scoreBoard(b, f, p, est)).sort((a, b) => b.score - a.score || (a.board.favorite === b.board.favorite ? 0 : a.board.favorite ? -1 : 1) || tie(a.board, b.board));
    // quiver-lock: ONE rule for "this board suits the hour", the same in score mode and size mode (and so on Home, the spot page, Personal and Quiver): the surf is inside
    // the board's range or at its edge. A board scoreBoard calls eligible because it is within a foot OUTSIDE its range is NOT a pick (Home and the spot page said nothing for
    // it while Board Match named it).
    const sizeEst = est ?? (f.availability?.face && Number.isFinite(f.face) ? [f.face, f.face] as [number, number] : null);
    return {mode: 'score', est, scored, ranked, pick: scored.find((x) => x.eligible && suits(sizeFit(x.board, sizeEst)))?.board ?? null};
  }
  if (!est) return {mode: 'none', est: null, scored: [], ranked, pick: null};
  return {mode: 'size', est, scored: [], ranked, pick: recommended(ranked).find((x) => abilityOk(x.board, p))?.board ?? null};
}
