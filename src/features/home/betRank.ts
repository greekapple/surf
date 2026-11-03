/** T-075: how Home ranks best-bet candidates. Only a spot with a surf estimate at its window can be "your best bet", so sized candidates rank first,
 *  then the verdict at the window's first hour (Go before Worth a look), then how soon the window starts. Pure, for tests. */
export type BetVerdict = 'Go' | 'Worth a look' | 'Skip' | 'Dark';
export interface BetLike {sized: boolean; verdict: BetVerdict; window: {start: string}}
const RANK: Record<BetVerdict, number> = {Go: 3, 'Worth a look': 2, Skip: 1, Dark: 0};
export const rankBets = <T extends BetLike>(bets: T[]): T[] =>
  [...bets].sort((a, b) => Number(b.sized) - Number(a.sized) || RANK[b.verdict] - RANK[a.verdict] || Date.parse(a.window.start) - Date.parse(b.window.start));
