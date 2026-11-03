import {staleText, staleWord, type Stale} from '../services/freshness';
/** A small "stale" / "saved" mark beside a value whose source is a saved copy or older than its refresh limit (T-086). Renders nothing for fresh data. */
export function StaleTag({s}: {s: Stale | null | undefined}) {
  return s ? <small className="stale-tag" title={staleText(s)} aria-label={staleText(s)}>{staleWord(s)}</small> : null;
}
