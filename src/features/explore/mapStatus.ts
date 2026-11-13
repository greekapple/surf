/** map-load (lead, 2026-11-12; user: "a bunch of error messages that fill the screen"): what the map says about its own state, as ONE message on a phone,
 *  without ever dropping a label (data-honesty review). Pure, so every combination is testable (src/tests/map-status.test.ts).
 *  Priority on a phone: a failure (any source warning, or the sea layer failed) > after dark > the sea and model notes. The one message FOLDS the others in:
 *  - the top note leads with the source warning, then what the sea shows (held, loading, still loading, couldn't load), the cached-map label, and 'after dark';
 *  - at night the after-dark note carries what the sea shows (with its Retry), the fallback model and the cached-map label.
 *  On a wide screen the notes sit in different places (the after-dark note in the bottom strip, the loading pill over the map), so none hides another. */
export interface MapStatusIn {
  phone: boolean;
  /** 'Limited: …', 'Forecast unavailable', 'Demonstration · not live', or '' */ srcWarn: string;
  /** the sea's own note: held/loading/still loading/couldn't load ('' when the sea is fine) */ heldNote: string;
  /** heldNote, or else the fallback model's name, or else the plain 'Loading waves…' */ seaNote: string;
  /** 'WW3 fallback (…)' when the map fell back to another model, else '' */ fallbackName: string;
  /** the cached-map label when a cached frame is drawn, else '' */ cacheNote: string;
  darkNow: boolean; seaFailed: boolean;
}
export interface MapStatusOut {status: 'fail' | 'dark' | 'note' | null; top: string; darkExtras: string[]; showDark: boolean; showTop: boolean; showCacheChip: boolean}
const has = (s: string, part: string) => !!part && s.includes(part);
export function mapStatus(i: MapStatusIn): MapStatusOut {
  const failNote = !!i.srcWarn || (i.seaFailed && !!i.heldNote);
  const status = failNote ? 'fail' : i.darkNow ? 'dark' : i.srcWarn || i.seaNote ? 'note' : null;
  const top = [i.srcWarn, i.seaNote, has(i.seaNote, i.cacheNote) || /cached/.test(i.seaNote) ? '' : i.cacheNote, i.darkNow && failNote ? 'after dark · not a surf window' : ''].filter(Boolean).join(' · ');
  const darkExtras = [i.heldNote, has(i.heldNote, i.fallbackName) ? '' : i.fallbackName, /cached/.test(i.heldNote) ? '' : i.cacheNote].filter(Boolean);
  return {status, top, darkExtras,
    showTop: i.phone && (status === 'fail' || status === 'note'),
    showDark: i.darkNow && (i.phone ? status === 'dark' : true),
    showCacheChip: !!i.cacheNote && (!i.phone || status === null)};
}
