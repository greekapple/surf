import type {Forecast, SurfSpot} from '../models/index.ts';
import {windOf, tideOf} from './spotHour.ts';
import {defaultProfile} from '../data/demo.ts';

/** The forecast inputs beyond height and period that "looks like your sessions" compares (quiver item 3): the primary swell direction, the wind speed and its relation to the beach, the tide stage. Taken from the SAME forecast
 *  record the app shows; each is null when the record has no such value (never filled in). Stored with the archive entry and the session's model pair so a later session can be compared against what was forecast THEN. */
export interface ExtraInputs {dirDeg: number | null; windMph: number | null; windRel: string | null; tide: 'rising' | 'falling' | null}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** Derived through the page's own accessors (windOf / tideOf), so the stale and saved checks are the page's: a stale or saved wind or tide is NOT stored as data, and an 'unknown' relation or trend is null, never data.
 *  Raw wind mph is kept (one decimal) so the adjective matches what the page showed. */
export function forecastInputs(spot: SurfSpot | undefined, f: Forecast, nowMs: number = Date.now()): ExtraInputs {
  const w = spot ? windOf(spot, f, defaultProfile, nowMs) : null, t = tideOf(f, defaultProfile, nowMs), rel = w && !w.stale ? w.relation : null;
  return {dirDeg: finite(f.primary?.direction) ? Math.round(f.primary.direction) : null, windMph: w && !w.stale && rel && rel !== 'unknown' ? Math.round(w.mph * 10) / 10 : null, windRel: rel && rel !== 'unknown' ? rel : null,
    tide: t && !t.stale && (t.state === 'rising' || t.state === 'falling') ? t.state : null};
}
