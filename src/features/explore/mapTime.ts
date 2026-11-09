// The clock labels of the global map surfaces, all in the current label zone (mapZone(), ocean/spotZone.ts): one instant, one zone, never the zone of the last spot opened.
// The zone is read at each call (the focused spot's, or the viewer's), so the strip's day boundaries follow it.
import {fmtIn, dateIn} from '../../ocean/time.ts';
import {mapZone} from '../../ocean/spotZone.ts';
export const mapClock = (iso: string | number) => fmtIn(mapZone(), {hour: 'numeric', minute: '2-digit'}).format(new Date(iso));
/** "Mon, Nov 9 · 11:30 PM": date and hour of the SAME zone. */
export const stampLabel = (iso: string) => `${fmtIn(mapZone(), {weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(iso))} · ${mapClock(iso).replace(':00', '')}`;
export const mapDayKey = (iso: string) => dateIn(mapZone(), iso);
export const mapWeekdayLong = (iso: string) => fmtIn(mapZone(), {weekday: 'long'}).format(new Date(iso));
export const mapWeekdayShort = (iso: string) => fmtIn(mapZone(), {weekday: 'short'}).format(new Date(iso));
export const mapDayNum = (iso: string) => fmtIn(mapZone(), {day: 'numeric'}).format(new Date(iso));
export const mapHour = (iso: string) => fmtIn(mapZone(), {hour: 'numeric'}).format(new Date(iso));
export const mapWeekLong = (iso: string) => `${mapWeekdayLong(iso)} ${mapDayNum(iso)}`;    // "Tuesday 3" (Windy), not Intl's "3 Tuesday"
export const mapWeekShort = (iso: string) => `${mapWeekdayShort(iso)} ${mapDayNum(iso)}`;
export const mapWhen = (iso: string) => `${mapWeekdayShort(iso)} ${mapHour(iso)}`;
/** "PST" / "HST" / "GMT": the label zone's abbreviation at an instant, shown on the time strip so a 2 h difference to a Hawaii spot's own clock is explained. */
export const mapZoneAbbr = (iso: string | number) => fmtIn(mapZone(), {timeZoneName: 'short'}).formatToParts(new Date(iso)).find((x) => x.type === 'timeZoneName')?.value ?? '';
