// Pacific-time formatting helpers shared across SWELLO views.
const TZ = 'America/Los_Angeles';
const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', {timeZone: TZ, ...o});
const tShort = f({hour: 'numeric', minute: '2-digit'});
const weekday = f({weekday: 'short'});
const dayNum = f({day: 'numeric'});
const h23 = new Intl.DateTimeFormat('en-US', {timeZone: TZ, hour: 'numeric', hourCycle: 'h23'});
export const timeLabelPT = (iso: string | number) => tShort.format(new Date(iso));
export const weekdayPT = (iso: string) => weekday.format(new Date(iso));
export const dayNumPT = (iso: string) => dayNum.format(new Date(iso));
export const localHour = (iso: string) => Number(h23.format(new Date(iso)));
