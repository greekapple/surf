/** Water quality line (spec item 4): pure wording of the Worker's answer (services/water-quality.mjs). The agency's OWN words and date, never an estimate. */
export interface WqAnswer {ok: boolean; none?: boolean; kind?: 'status' | 'result' | 'link' | 'season'; source?: string; agency?: string; agencyUrl?: string; station?: string; status?: string | null; detail?: string | null; date?: string | null; dateLabel?: string | null; link?: string; retrievedAt?: string; note?: string | null}
export interface WqLine {label: string; text: string; date: string | null; link: string; linkText: string; credit: string; note: string | null}
const niceDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}); };
const NOADV = 'no advisory is not a clean-water result';
const daysAgo = (d: string, at?: string | null) => { const t = at ? Date.parse(at) : Date.now(), n = Math.floor((Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate()) - Date.parse(`${d}T00:00:00Z`)) / 86400000); return n <= 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`; };
/** null = show nothing (no reviewed station, or the agency did not answer): a missing line is the honest answer, never a guess. One rule for every "no advisory" wording: the sentence that it is not a clean-water result is always added. */
export function wqLine(a: WqAnswer | null): WqLine | null {
  if (!a || !a.ok || a.none || !a.kind || !a.agency) return null;
  const link = a.link ?? a.agencyUrl ?? ''; if (!link) return null;
  const credit = `Source: ${a.agency}`;
  if (a.kind === 'link') return a.source === 'fl-doh-healthy-beaches'
    ? {label: 'Water quality', text: '', date: null, link, linkText: 'Check FL Healthy Beaches ↗', credit, note: 'Florida Department of Health posts its own results; SWELLO shows none of them.'}
    : {label: 'Water quality', text: '', date: null, link, linkText: 'Check the agency page ↗', credit, note: a.note ?? null};
  if (a.kind === 'season') return {label: 'Water quality', text: a.status ?? '', date: null, link, linkText: 'Agency page ↗', credit, note: null};
  if (!a.status) return null;
  const stamp = a.date ? `${a.dateLabel ?? 'dated'} ${niceDate(a.date)}` : null;
  if (a.kind === 'result') return {label: 'Water quality', text: `Latest test ${a.date ? `${niceDate(a.date)} (${daysAgo(a.date, a.retrievedAt)})` : ''}: ${a.status}`, date: null, link, linkText: 'Agency page ↗', credit, note: a.detail ?? null};
  const noAdv = /\bno (open )?(advisory|doh notice)|^green\b|\bno advisory\b/i.test(a.status), detail = a.detail ?? null;
  const note = noAdv && !(detail ?? '').includes(NOADV) ? [detail, NOADV].filter(Boolean).join('; ') : detail;
  return {label: 'Water quality', text: a.status, date: stamp, link, linkText: 'Agency page ↗', credit, note};
}
