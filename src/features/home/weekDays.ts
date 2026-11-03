/** T-088b: the week grid's day columns. Up to `max` Pacific days from today, but a trailing day that no row has any forecast record for is left
 *  out (after midnight the 8th day falls beyond the forecast horizon). Pure, for tests. */
export const pacificDay = (ms: number) => new Date(ms).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
export function weekDays(nowMs: number, records: {spotId: string; timestamp: string}[], spotIds: string[], max = 8): string[] {
  const keys = Array.from({length: max}, (_, k) => pacificDay(nowMs + k * 864e5));
  const ids = new Set(spotIds), have = new Set(records.filter((r) => ids.has(r.spotId)).map((r) => pacificDay(Date.parse(r.timestamp))));
  while (keys.length > 1 && !have.has(keys[keys.length - 1])) keys.pop();
  return keys;
}
