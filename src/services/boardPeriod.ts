/** Board fit by swell period (T-064), to sit beside the quiver's size fit. OUR OWN rule of thumb, not a published standard or a validated model:
 *  short-period (wind-swell) waves are weak and mushy, so boards that need push (performance shortboards, step-ups and guns) want more period, while fish, mid-lengths and longboards cope with less.
 *  A long period is powerful and fast, which asks more of a small, low-volume board. Returns a plain note ready to show in one line. */
export type BoardKind = 'shortboard' | 'fish' | 'midlength' | 'longboard' | 'gun' | 'stepup' | string;
export interface PeriodFit {fit: 'short' | 'ok' | 'long'; note: string}
/** Minimum comfortable period in seconds per board kind. */
export const MIN_PERIOD_S: Record<string, number> = {shortboard: 10, stepup: 11, gun: 12, fish: 8, midlength: 8, longboard: 7};
export const LONG_PERIOD_S = 16, SMALL_BOARD_IN = 68; // under 5'8" counts as small
export function periodFit(kind: BoardKind, periodS: number | null | undefined, lengthIn?: number | null): PeriodFit {
  if (typeof periodS !== 'number' || !Number.isFinite(periodS) || periodS <= 0) return {fit: 'ok', note: 'swell period unknown, so the period is not part of this fit.'};
  // Audit F11/R17: judged on the whole seconds every card shows (the Swell card's "10 s"), so the board line never calls a "10 s" swell short;
  // the notes are lower-case clauses that read inside a sentence ("it suits 3–8 ft; this 9 s swell is short for it …").
  const k = String(kind).toLowerCase().replace(/[^a-z]/g, ''), min = MIN_PERIOD_S[k] ?? 9, p = Math.round(periodS);
  if (p < min) return {fit: 'short', note: `this ${p} s swell is short for it (it likes ${min} s or more), so expect it to feel soft.`};
  if (p >= LONG_PERIOD_S && typeof lengthIn === 'number' && lengthIn < SMALL_BOARD_IN) return {fit: 'long', note: `this ${p} s swell is powerful for a small board; more volume or length helps.`};
  return {fit: 'ok', note: `this ${p} s swell suits it.`};
}
