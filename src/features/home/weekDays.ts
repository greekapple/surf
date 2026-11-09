/** T-088b: the week grid's day columns. Up to `max` days (in `tz`, the zone of the first spot shown) from today, but a trailing day that no row has any forecast record for is left
 *  out (after midnight the 8th day falls beyond the forecast horizon). Pure, for tests. */
import {dateInMs, addDaysKey, DEFAULT_TIME_ZONE} from '../../ocean/time.ts';
export const pacificDay = (ms: number, tz: string = DEFAULT_TIME_ZONE) => dateInMs(tz, ms);
export function weekDays(nowMs: number, records: {spotId: string; timestamp: string}[], spotIds: string[], max = 8, tz: string = DEFAULT_TIME_ZONE): string[] {
  const today = pacificDay(nowMs, tz), keys = Array.from({length: max}, (_, k) => addDaysKey(today, k));   // calendar days: now + k x 24 h skips a 23-hour day
  const ids = new Set(spotIds), have = new Set(records.filter((r) => ids.has(r.spotId)).map((r) => pacificDay(Date.parse(r.timestamp), tz)));
  while (keys.length > 1 && !have.has(keys[keys.length - 1])) keys.pop();
  return keys;
}
