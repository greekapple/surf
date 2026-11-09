/** T-075: how Home ranks best-bet candidates. Only a spot with a surf estimate at its window can be "your best bet", so sized candidates rank first,
 *  then the verdict at the window's first hour (Go before Worth a look), then the day (today before tomorrow), then how sure we are of the size
 *  (user, 2026-11-08: a clearly more certain spot wins when the two are otherwise level), then how soon the window starts. Pure, for tests. */
import {pacificDate} from '../../ocean/time.ts';
export type BetVerdict = 'Go' | 'Worth a look' | 'Skip' | 'Dark';
export type BetConfidence = 'high' | 'medium' | 'low' | 'too-far' | null | undefined;
export interface BetLike {sized: boolean; verdict: BetVerdict; window: {start: string}; confidence?: BetConfidence}
const RANK: Record<BetVerdict, number> = {Go: 3, 'Worth a look': 2, Skip: 1, Dark: 0};
const SURE = (c: BetConfidence) => (c === 'high' ? 3 : c === 'medium' ? 2 : c === 'low' ? 1 : 0);
export const rankBets = <T extends BetLike>(bets: T[]): T[] =>
  [...bets].sort((a, b) => Number(b.sized) - Number(a.sized) || RANK[b.verdict] - RANK[a.verdict]
    || pacificDate(a.window.start).localeCompare(pacificDate(b.window.start)) || SURE(b.confidence) - SURE(a.confidence)
    || Date.parse(a.window.start) - Date.parse(b.window.start));
