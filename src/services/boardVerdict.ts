import type {Surfboard} from '../models/index.ts';
import {abilityOk, rangeSourceText, suits, type BoardChoice, type SizeFit} from '../features/quiver/fit.ts';
import type {UserProfile} from '../models/index.ts';

/** quiver-lock: the Quiver's answer-first verdict, built from the ONE Board Match result (fit.ts boardPickFor): the pick or an honest "none fits", with its caveat.
 *  No new numbers and no new logic: only words for what boardPickFor already decided. Pure, so it is tested. */
export type VerdictTone = 'pick' | 'none' | 'unknown' | 'loading' | 'failed';
export interface Verdict {tone: VerdictTone; /** the one sentence */ sentence: string; /** what the match does not know ("size and period only; wave shape unknown") or null */ caveat: string | null; pickId: string | null; closestId: string | null}
export interface VerdictInput {choice: BoardChoice; boards: Surfboard[]; spotName: string; estText: string | null; pending?: boolean; failed?: boolean; fmtRange: (lo: number, hi: number) => string; /** the surfer, for the ability gate */ profile: Pick<UserProfile, 'skill' | 'skillLevel'>}
const rangeOf = (s: SizeFit, fmt: (lo: number, hi: number) => string) => (s.state === 'none' ? '' : fmt(s.board[0], s.board[1]));

export function boardVerdict({choice, boards, spotName, estText, pending, failed, fmtRange, profile}: VerdictInput): Verdict {
  if (pending) return {tone: 'loading', sentence: `Loading the match for ${spotName}.`, caveat: null, pickId: null, closestId: null};
  if (failed) return {tone: 'failed', sentence: `The forecast for ${spotName} did not load, so there is nothing to match against.`, caveat: null, pickId: null, closestId: null};
  if (choice.mode === 'none' || !estText) return {tone: 'unknown', sentence: `No surf estimate for ${spotName} at this hour (offshore height only), so no board is matched.`, caveat: null, pickId: null, closestId: null};
  const caveat = choice.mode === 'size' ? 'By size and swell period only; wave shape is unknown.' : 'Size, wave shape and your level; provisional, not validated against sessions.';
  const pick = choice.pick ? choice.ranked.find((x) => x.board.id === choice.pick!.id) ?? null : null;
  if (choice.pick) {
    const sz = pick?.size, how = sz && sz.state === 'edge' ? 'at the edge of its range' : 'in its range';
    const range = sz && sz.state !== 'none' ? ` (${rangeOf(sz, fmtRange)}, ${rangeSourceText(sz, choice.pick.type)})` : '';
    return {tone: 'pick', sentence: `Take your ${choice.pick.name}${choice.pick.demo ? ' (an example board: add your own in Quiver)' : ''}. ${estText} is ${how}${range}.`, caveat, pickId: choice.pick.id, closestId: null};
  }
  // a board the surf suits by size but that asks more of the surfer than their level: said, not picked
  const tooMuch = choice.ranked.find((x) => suits(x.size) && !abilityOk(x.board, profile)) ?? null;
  if (tooMuch) return {tone: 'none', sentence: `None of your boards is a pick for ${estText}: the ${tooMuch.board.name} fits the size but asks more than your level.`, caveat, pickId: null, closestId: tooMuch.board.id};
  const closest = choice.ranked.find((x) => x.size.state !== 'none') ?? null;
  const cl = closest && closest.size.state !== 'none' ? ` Closest: ${closest.board.name}, ${closest.size.state === 'big' ? 'surf above' : 'surf below'} its ${rangeOf(closest.size, fmtRange)} range.` : '';
  return {tone: 'none', sentence: `None of your boards fits ${estText} by size.${cl}`, caveat, pickId: null, closestId: closest?.board.id ?? null};
}
