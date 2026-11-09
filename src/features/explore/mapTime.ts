// The clock labels of the global map surfaces, all in MAP_TIME_ZONE (ocean/spotZone.ts): one instant, one zone, never the zone of the last spot opened.
import {fmtIn, dateIn} from '../../ocean/time.ts';
import {MAP_TIME_ZONE} from '../../ocean/spotZone.ts';
const Z = MAP_TIME_ZONE;
export const mapClock = (iso: string | number) => fmtIn(Z, {hour: 'numeric', minute: '2-digit'}).format(new Date(iso));
/** "Mon, Nov 9 · 11:30 PM": date and hour of the SAME zone. */
export const stampLabel = (iso: string) => `${fmtIn(Z, {weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(iso))} · ${mapClock(iso).replace(':00', '')}`;
export const mapDayKey = (iso: string) => dateIn(Z, iso);
export const mapWeekdayLong = (iso: string) => fmtIn(Z, {weekday: 'long'}).format(new Date(iso));
export const mapWeekdayShort = (iso: string) => fmtIn(Z, {weekday: 'short'}).format(new Date(iso));
export const mapDayNum = (iso: string) => fmtIn(Z, {day: 'numeric'}).format(new Date(iso));
export const mapHour = (iso: string) => fmtIn(Z, {hour: 'numeric'}).format(new Date(iso));
export const mapWeekLong = (iso: string) => `${mapWeekdayLong(iso)} ${mapDayNum(iso)}`;    // "Tuesday 3" (Windy), not Intl's "3 Tuesday"
export const mapWeekShort = (iso: string) => `${mapWeekdayShort(iso)} ${mapDayNum(iso)}`;
export const mapWhen = (iso: string) => `${mapWeekdayShort(iso)} ${mapHour(iso)}`;
