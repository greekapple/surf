// Time formatting helpers shared across SWELLO views. They format in the zone passed, else the zone of the spot on screen (ocean/spotZone.ts activeZone, America/Los_Angeles until a world spot is open).
import {fmtIn} from '../../ocean/time.ts';
import {activeZone} from '../../ocean/spotZone.ts';
const z = (tz?: string) => tz ?? activeZone();
export const timeLabelPT = (iso: string | number, tz?: string) => fmtIn(z(tz), {hour: 'numeric', minute: '2-digit'}).format(new Date(iso));
export const weekdayPT = (iso: string, tz?: string) => fmtIn(z(tz), {weekday: 'short'}).format(new Date(iso));
export const dayNumPT = (iso: string, tz?: string) => fmtIn(z(tz), {day: 'numeric'}).format(new Date(iso));
export const localHour = (iso: string, tz?: string) => Number(fmtIn(z(tz), {hour: 'numeric', hourCycle: 'h23'}).format(new Date(iso)));
