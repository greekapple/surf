/** Audit F25: the header status chip names which source is limited, not just "some sources limited". A source that is still loading is not
 *  limited (it has not failed). Sources are grouped into families a surfer can recognise ("CDIP nearshore", "NDBC buoys"). Pure, for tests. */
export interface StatusLike {provider: string; state: string}
export function sourceFamily(provider: string): string {
  const p = provider.trim();
  if (/^Open-Meteo Marine/i.test(p)) return 'Open-Meteo marine';
  if (/^Open-Meteo Weather/i.test(p)) return 'Open-Meteo weather';
  if (/^Open-Meteo/i.test(p)) return 'Open-Meteo';
  if (/^NOAA CO-OPS/i.test(p)) return 'NOAA tides';
  if (/^NOAA NDBC|^NDBC/i.test(p)) return 'NDBC buoys';
  if (/^CDIP (MOP|.*nearshore)/i.test(p)) return 'CDIP nearshore';
  if (/^CDIP/i.test(p)) return 'CDIP buoys';
  return p.split(/\s+/).slice(0, 2).join(' ');
}
const LIMITED = new Set(['partial', 'unavailable']);
/** The families with at least one limited source, in first-seen order. */
export const limitedFamilies = (statuses: readonly StatusLike[]): string[] => [...new Set(statuses.filter((s) => LIMITED.has(s.state)).map((s) => sourceFamily(s.provider)))];
/** " · CDIP nearshore limited", " · CDIP nearshore and NDBC buoys limited", " · CDIP nearshore, NDBC buoys and 1 more limited", or '' when nothing is limited. */
export function limitedText(statuses: readonly StatusLike[]): string {
  const f = limitedFamilies(statuses);
  if (!f.length) return '';
  const names = f.length === 1 ? f[0] : f.length === 2 ? `${f[0]} and ${f[1]}` : `${f[0]}, ${f[1]} and ${f.length - 2} more`;
  return ` · ${names} limited`;
}
