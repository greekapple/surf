import type {Forecast, Surfboard, UserProfile} from '../../models/index.ts';
import {boardRanges, scoreBoard} from '../../recommendation/board.ts';

export type BoardPick =
  | {kind: 'match'; board: Surfboard; score: number}
  | {kind: 'heuristic'; board: Surfboard}
  | {kind: 'none'}
  | {kind: 'empty'};

/** Existing board scoring when the forecast hour has a breaking-wave estimate; otherwise a labelled heuristic on the preferred range. */
export function pickBoard(boards: Surfboard[], f: Forecast | undefined, p: UserProfile): BoardPick {
  if (!boards.length) return {kind: 'empty'};
  if (f && f.availability?.face !== false && Number.isFinite(f.face)) {
    const ranked = boards.map((b) => scoreBoard(b, f, p)).filter((r) => r.eligible).sort((a, b) => b.score - a.score);
    if (ranked.length) return {kind: 'match', board: ranked[0].board, score: ranked[0].score};
  }
  const mid = (p.minWave + p.maxWave) / 2;
  const fit = boards
    .map((b) => {
      const r = boardRanges[b.type];
      const lo = b.minWave ?? r?.[0], hi = b.maxWave ?? r?.[1];
      if (lo === undefined || hi === undefined) return null;
      const d = mid < lo ? lo - mid : mid > hi ? mid - hi : 0;
      return {b, d, c: Math.abs(mid - (lo + hi) / 2)};
    })
    .filter((x): x is {b: Surfboard; d: number; c: number} => !!x && x.d === 0)
    .sort((a, b) => a.c - b.c)[0];
  return fit ? {kind: 'heuristic', board: fit.b} : {kind: 'none'};
}
